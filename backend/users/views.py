# base
from django.utils.decorators import method_decorator
from django.views.decorators.cache import never_cache
from django.contrib.auth import get_user_model
from django.conf import settings
from django.db.models import Q

# drf
from rest_framework_simplejwt.views import TokenObtainPairView
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.token_blacklist.models import (
    OutstandingToken,
    BlacklistedToken,
)
from rest_framework import serializers
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.generics import ListCreateAPIView, RetrieveUpdateDestroyAPIView

from rest_framework.status import (
    HTTP_200_OK,
    HTTP_204_NO_CONTENT,
    HTTP_202_ACCEPTED,
    HTTP_400_BAD_REQUEST,
    HTTP_201_CREATED,
    HTTP_401_UNAUTHORIZED,
    HTTP_404_NOT_FOUND,
    HTTP_409_CONFLICT,
    HTTP_413_REQUEST_ENTITY_TOO_LARGE,
    HTTP_429_TOO_MANY_REQUESTS,
    HTTP_500_INTERNAL_SERVER_ERROR,
)

from django.http import HttpResponse, StreamingHttpResponse
import csv
import json
import io
import logging

# Import error handling utilities
from .error_handlers import (
    ErrorCodes,
    UserFriendlyMessages,
    SecurityEventLogger,
    ErrorResponseBuilder,
    InvitationErrorHandler,
    PasswordErrorHandler,
    handle_network_errors
)

logger = logging.getLogger(__name__)



from rest_framework.permissions import (
    IsAuthenticated,
    IsAuthenticatedOrReadOnly,
    AllowAny,
    IsAdminUser,
)

from users.serializers import (
    UserBasicSerializer,
    UserCreateSerializer,
    UserJWTObjectSerializer,
    UserTinySerializer,
)

User = get_user_model()


# ============================================================================
# region AUTHENTICATION VIEWS
# ============================================================================


class CustomTokenObtainPairSerializer(TokenObtainPairSerializer):
    """Custom JWT serializer with complete user data and preferences"""

    def validate(self, attrs):
        data = super().validate(attrs)

        # Add complete user object
        user_serializer = UserJWTObjectSerializer(self.user)
        data["user"] = user_serializer.data

        # Add token metadata
        data["token_type"] = "Bearer"
        data["expires_in"] = settings.SIMPLE_JWT.get(
            "ACCESS_TOKEN_LIFETIME"
        ).total_seconds()

        return data


class CustomTokenObtainPairView(TokenObtainPairView):
    """JWT Login - returns tokens + complete user data with preferences"""

    serializer_class = CustomTokenObtainPairSerializer


class JWTLogoutView(APIView):
    """JWT Logout - blacklists refresh token"""

    permission_classes = [IsAuthenticated]

    def post(self, request):
        try:
            refresh_token = request.data.get("refresh_token")
            if refresh_token:
                token = RefreshToken(refresh_token)
                token.blacklist()
                return Response(
                    {"message": "Logged out successfully", "status": "success"},
                    status=HTTP_200_OK,
                )
            else:
                return Response(
                    {"error": "Refresh token required"}, status=HTTP_400_BAD_REQUEST
                )
        except Exception as e:
            return Response(
                {"error": f"Logout failed: {str(e)}"}, status=HTTP_400_BAD_REQUEST
            )


# endregion


# ============================================================================
# region CURRENT USER VIEWS (Self-management)
# ============================================================================

# password reset etc.


class WhoAmI(APIView):
    """Quick authentication check - lightweight user info"""

    permission_classes = [AllowAny]

    @method_decorator(never_cache)
    def get(self, request):
        user = request.user

        if user.is_anonymous:
            return Response(
                {
                    "id": None,
                    "email": None,
                    "first_name": None,
                    "last_name": None,
                    "full_name": None,
                    "initials": "?",
                    "role": "none",
                    "role_display": "None",
                    "is_authenticated": False,
                },
                status=HTTP_200_OK,
            )

        # Return basic user info (no preferences - keep it lightweight)
        user_data = UserBasicSerializer(user).data
        return Response(user_data, status=HTTP_200_OK)


class UserProfileView(APIView):
    """Current user's complete profile with preferences - for profile pages"""

    permission_classes = [IsAuthenticated]

    def get(self, request):
        """Get complete profile with preferences"""
        user = request.user
        user.get_preferences()  # Ensure preferences exist

        serializer = UserJWTObjectSerializer(user)
        return Response(serializer.data, status=HTTP_200_OK)

    def patch(self, request):
        """Update current user's profile and preferences"""
        user = request.user

        # Separate user fields from preference fields
        user_fields = ["first_name", "last_name"]  # Don't allow email changes via PATCH
        user_data = {k: v for k, v in request.data.items() if k in user_fields}
        preference_data = request.data.get("preferences", {})

        # Update user fields
        if user_data:
            user_serializer = UserJWTObjectSerializer(
                user, data=user_data, partial=True
            )
            if user_serializer.is_valid():
                user_serializer.save()
            else:
                return Response(user_serializer.errors, status=HTTP_400_BAD_REQUEST)

        # Update preferences
        if preference_data:
            preferences = user.get_preferences()
            from .serializers import UserPreferencesSerializer

            pref_serializer = UserPreferencesSerializer(
                preferences, data=preference_data, partial=True
            )
            if pref_serializer.is_valid():
                pref_serializer.save()
            else:
                return Response(pref_serializer.errors, status=HTTP_400_BAD_REQUEST)

        # Return updated profile
        updated_serializer = UserJWTObjectSerializer(user)
        return Response(updated_serializer.data, status=HTTP_200_OK)


# endregion


# ============================================================================
# region USER PREFERENCES VIEWS (Dedicated preference management)
# ============================================================================


class UserPreferencesView(APIView):
    """
    GET: Get current user's preferences
    PATCH: Update current user's preferences
    """

    permission_classes = [IsAuthenticated]

    def get(self, request):
        """Get current user's preferences"""
        user = request.user
        preferences = user.get_preferences  # Property, not method

        from .serializers import UserPreferencesSerializer

        serializer = UserPreferencesSerializer(preferences)
        return Response(serializer.data, status=HTTP_200_OK)

    def patch(self, request):
        """Update current user's preferences"""
        user = request.user
        preferences = user.get_preferences  # Property, not method

        from .serializers import UserPreferencesSerializer

        serializer = UserPreferencesSerializer(
            preferences, data=request.data, partial=True
        )

        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data, status=HTTP_200_OK)
        else:
            return Response(serializer.errors, status=HTTP_400_BAD_REQUEST)


# endregion


# ============================================================================
# region EXTERNAL USER SEARCH (For invitations)
# ============================================================================


class ExternalUserSearchView(APIView):
    """
    Search external IT Assets API for users not already in the system
    Used for user invitations
    """

    permission_classes = [IsAuthenticated]

    def get(self, request):
        """Search external users by query parameter"""
        import requests
        from django.core.cache import cache

        query = request.query_params.get("search", "").strip()

        if not query or len(query) < 2:
            return Response(
                {"results": [], "message": "Query must be at least 2 characters"},
                status=HTTP_200_OK,
            )

        # Cache key for external API results
        cache_key = f"external_users_search_{query.lower()}"
        cached_results = cache.get(cache_key)

        if cached_results is not None:
            return Response({"results": cached_results}, status=HTTP_200_OK)

        try:
            # Call external IT Assets API using configured URL and Basic auth
            # Add limit parameter to prevent massive responses
            external_api_url = f"{settings.IT_ASSETS_URLS}?limit=100"
            auth = (settings.IT_ASSETS_USER, settings.IT_ASSETS_ACCESS_TOKEN)
            response = requests.get(external_api_url, auth=auth, timeout=10)
            response.raise_for_status()

            external_users = response.json()

            # Get existing user emails to exclude them
            existing_emails = set(User.objects.values_list("email", flat=True))

            # Filter and format results
            filtered_results = []
            for user in external_users:
                email = user.get("email", "").lower()

                # Skip if user already exists in our system
                if email in existing_emails:
                    continue

                # Skip if doesn't match search query
                full_name = (
                    f"{user.get('given_name', '')} {user.get('surname', '')}".strip()
                )
                if (
                    query.lower() not in full_name.lower()
                    and query.lower() not in email.lower()
                ):
                    continue

                # Format for frontend
                filtered_results.append(
                    {
                        "id": user.get("id"),
                        "employee_id": user.get("employee_id"),
                        "given_name": user.get("given_name"),
                        "surname": user.get("surname"),
                        "email": email,
                        "full_name": full_name,
                        "title": user.get("title"),
                        "division": user.get("division"),
                        "unit": user.get("unit"),
                    }
                )

            # Limit to 8 results and cache for 5 minutes
            limited_results = filtered_results[:8]
            cache.set(cache_key, limited_results, 300)  # 5 minutes

            return Response({"results": limited_results}, status=HTTP_200_OK)

        except requests.RequestException as e:
            settings.LOGGER.error(f"External API error: {str(e)}")
            return Response(
                {"error": "Failed to search external users", "results": []},
                status=HTTP_500_INTERNAL_SERVER_ERROR,
            )
        except Exception as e:
            settings.LOGGER.error(f"Unexpected error in external user search: {str(e)}")
            return Response(
                {"error": "Internal server error", "results": []},
                status=HTTP_500_INTERNAL_SERVER_ERROR,
            )


# endregion


# ============================================================================
# region PASSWORD VALIDATION
# ============================================================================


class PasswordValidationView(APIView):
    """
    POST: Validate password strength and requirements
    Provides real-time validation for frontend forms
    """
    
    permission_classes = [AllowAny]  # Allow unauthenticated access for registration forms
    
    def post(self, request):
        """Validate password and return detailed strength information"""
        from .services import PasswordValidator
        
        password = request.data.get('password', '')
        
        if not password:
            return Response(
                {"error": "Password is required"}, 
                status=HTTP_400_BAD_REQUEST
            )
        
        # Get detailed password strength information
        strength_info = PasswordValidator.get_password_strength(password)
        
        return Response(strength_info, status=HTTP_200_OK)


# endregion


# ============================================================================
# region PASSWORD RESET SYSTEM
# ============================================================================


class ForgotPasswordView(APIView):
    """
    POST: Handle password reset requests
    Validates email and sends password reset code via email
    """
    
    permission_classes = [AllowAny]
    throttle_classes = []  # Will be set in post method for custom throttling
    
    @handle_network_errors
    def post(self, request):
        """Send password reset code to user"""
        from django.core.mail import send_mail
        from django.template.loader import render_to_string
        from django.utils.html import strip_tags
        from .services import PasswordResetCodeService
        from .throttles import PasswordResetEmailThrottle
        
        # Apply custom throttling
        throttle = PasswordResetEmailThrottle()
        if not throttle.allow_request(request, self):
            return ErrorResponseBuilder.build_error_response(
                error_code=ErrorCodes.RATE_LIMITED,
                message="Too many password reset requests. Please wait before trying again.",
                status_code=HTTP_429_TOO_MANY_REQUESTS
            )
        
        email = request.data.get('email', '').strip().lower()
        
        if not email:
            return ErrorResponseBuilder.build_validation_error_response({
                "email": ["Email address is required"]
            })
        
        user_exists = False
        
        try:
            # Check if user exists
            user = User.objects.get(email=email, is_active=True)
            user_exists = True
            
            # Check if user is eligible for password reset
            is_eligible, reason = PasswordResetCodeService.validate_password_change_eligibility(user)
            if not is_eligible:
                return ErrorResponseBuilder.build_error_response(
                    error_code=ErrorCodes.RATE_LIMITED,
                    message=reason,
                    status_code=HTTP_400_BAD_REQUEST
                )
            
            # Generate secure 4-digit reset code
            try:
                reset_code = PasswordResetCodeService.generate_reset_code(user)
                plain_code = reset_code._plain_code  # Get the plain code for email
            except ValueError as e:
                # User already has an active reset code
                return ErrorResponseBuilder.build_error_response(
                    error_code=ErrorCodes.DUPLICATE_REQUEST,
                    message=UserFriendlyMessages.DUPLICATE_REQUEST,
                    status_code=HTTP_400_BAD_REQUEST
                )
            
            # Prepare email context
            context = {
                "user": user,
                "reset_code": plain_code,
                "frontend_url": f"http://127.0.0.1:3000/auth/reset-code",
                "site_name": "Cannabis Management System",
                "expires_at": reset_code.expires_at,
                "max_attempts": reset_code.max_attempts,
            }
            
            # Render email templates
            subject = f'Password Reset Code - {context["site_name"]}'
            html_message = render_to_string("users/password_reset_email.html", context)
            plain_message = strip_tags(html_message)
            
            # Determine recipient based on system settings
            from common.models import SystemSettings
            system_settings = SystemSettings.load()
            
            if system_settings.send_emails_to_self:
                # Send to admin instead of actual recipient
                recipient_list = [system_settings.forward_certificate_emails_to]
                logger.info(f"Sending password reset code to admin ({system_settings.forward_certificate_emails_to}) instead of {email}")
            else:
                # Send to actual recipient
                recipient_list = [email]
                logger.info(f"Sending password reset code to actual recipient: {email}")
            
            # Send password reset email
            send_mail(
                subject=subject,
                message=plain_message,
                html_message=html_message,
                from_email=settings.DEFAULT_FROM_EMAIL,
                recipient_list=recipient_list,
                fail_silently=False,
            )
            
            # Log the password reset request
            SecurityEventLogger.log_password_reset_requested(email, exists=True)
            
        except User.DoesNotExist:
            # Log the attempt but continue with success message
            SecurityEventLogger.log_password_reset_requested(email, exists=False)
            
        except Exception as e:
            logger.error(f"Failed to send password reset code to {email}: {str(e)}")
            return ErrorResponseBuilder.build_error_response(
                error_code=ErrorCodes.EMAIL_SEND_FAILED,
                message=UserFriendlyMessages.EMAIL_SEND_FAILED,
                status_code=HTTP_500_INTERNAL_SERVER_ERROR
            )
        
        # Always return success to prevent email enumeration attacks
        return Response(
            {
                "success": True,
                "message": "If an account with this email exists, a 4-digit reset code has been sent to your email.",
                "email": email,
                "next_step": "Check your email and enter the 4-digit code on the reset page."
            },
            status=HTTP_200_OK,
        )


class VerifyResetCodeView(APIView):
    """
    POST: Verify password reset code and authenticate user
    Handles 4-digit code verification and automatic login
    """
    
    permission_classes = [AllowAny]
    throttle_classes = []  # Will be set in post method for custom throttling
    
    def post(self, request):
        """Verify reset code and authenticate user"""
        from django.contrib.auth import login
        from rest_framework_simplejwt.tokens import RefreshToken
        from .services import PasswordResetCodeService
        from .throttles import ResetCodeVerificationThrottle, BruteForceProtectionThrottle
        
        # Apply custom throttling
        throttle = ResetCodeVerificationThrottle()
        if not throttle.allow_request(request, self):
            return ErrorResponseBuilder.build_error_response(
                error_code=ErrorCodes.RATE_LIMITED,
                message="Too many verification attempts. Please wait before trying again.",
                status_code=HTTP_429_TOO_MANY_REQUESTS
            )
        
        email = request.data.get('email', '').strip().lower()
        code = request.data.get('code', '').strip()
        
        # Validate required fields
        field_errors = {}
        
        if not email:
            field_errors["email"] = ["Email address is required"]
        
        if not code:
            field_errors["code"] = ["Reset code is required"]
        elif len(code) != 4 or not code.isdigit():
            field_errors["code"] = ["Reset code must be exactly 4 digits"]
        
        if field_errors:
            return ErrorResponseBuilder.build_validation_error_response(field_errors)
        
        # Get client IP address for brute force protection
        def get_client_ip(request):
            x_forwarded_for = request.META.get('HTTP_X_FORWARDED_FOR')
            if x_forwarded_for:
                ip = x_forwarded_for.split(',')[0]
            else:
                ip = request.META.get('REMOTE_ADDR')
            return ip
        
        client_ip = get_client_ip(request)
        
        # Check brute force protection
        is_allowed, reason, wait_time = BruteForceProtectionThrottle.check_brute_force_protection(email, client_ip)
        if not is_allowed:
            return ErrorResponseBuilder.build_error_response(
                error_code=ErrorCodes.RATE_LIMITED,
                message=f"{reason}. Please try again in {wait_time} seconds.",
                status_code=HTTP_429_TOO_MANY_REQUESTS
            )
        
        try:
            # Find the user
            user = User.objects.get(email=email, is_active=True)
            
            # Verify the reset code
            is_valid, reset_code_instance, message = PasswordResetCodeService.verify_reset_code(user, code)
            
            if not is_valid:
                # Record failed attempt for brute force protection
                attempt_count = reset_code_instance.attempts if reset_code_instance else 1
                BruteForceProtectionThrottle.record_failed_attempt(email, client_ip, attempt_count)
                
                # Log the failed attempt
                SecurityEventLogger.log_password_reset_failed(
                    email=email,
                    reason="invalid_code",
                    token_prefix=f"code_{code}"
                )
                
                # Provide specific error messages based on the failure reason
                if "expired" in message.lower():
                    return ErrorResponseBuilder.build_error_response(
                        error_code=ErrorCodes.TOKEN_EXPIRED,
                        message=UserFriendlyMessages.EXPIRED_TOKEN,
                        status_code=HTTP_400_BAD_REQUEST
                    )
                elif "maximum" in message.lower():
                    return ErrorResponseBuilder.build_error_response(
                        error_code=ErrorCodes.MAX_ATTEMPTS_EXCEEDED,
                        message=UserFriendlyMessages.MAX_ATTEMPTS_EXCEEDED,
                        status_code=HTTP_400_BAD_REQUEST
                    )
                else:
                    return ErrorResponseBuilder.build_error_response(
                        error_code=ErrorCodes.INVALID_CODE,
                        message=UserFriendlyMessages.INVALID_CODE,
                        status_code=HTTP_400_BAD_REQUEST
                    )
            
            # Code is valid - generate JWT tokens for automatic login
            refresh = RefreshToken.for_user(user)
            access_token = refresh.access_token
            
            # Update password change timestamp
            PasswordResetCodeService.update_password_change_timestamp(user)
            
            # Clear failed attempts after successful verification
            BruteForceProtectionThrottle.clear_failed_attempts(email, client_ip)
            
            # Log successful verification
            SecurityEventLogger.log_password_reset_success(email)
            
            # Return authentication tokens and user data
            from .serializers import UserJWTObjectSerializer
            user_serializer = UserJWTObjectSerializer(user)
            
            return Response(
                {
                    "success": True,
                    "message": "Reset code verified successfully. You are now logged in.",
                    "user": user_serializer.data,
                    "access": str(access_token),
                    "refresh": str(refresh),
                    "token_type": "Bearer",
                    "expires_in": settings.SIMPLE_JWT.get("ACCESS_TOKEN_LIFETIME").total_seconds(),
                    "requires_password_change": True,
                    "next_step": "Please update your password to complete the reset process."
                },
                status=HTTP_200_OK,
            )
            
        except User.DoesNotExist:
            # Record failed attempt for brute force protection
            BruteForceProtectionThrottle.record_failed_attempt(email, client_ip, 1)
            
            # Log the attempt but return generic error
            SecurityEventLogger.log_password_reset_failed(
                email=email,
                reason="user_not_found",
                token_prefix=f"code_{code}"
            )
            return ErrorResponseBuilder.build_error_response(
                error_code=ErrorCodes.INVALID_CREDENTIALS,
                message=UserFriendlyMessages.INVALID_CREDENTIALS,
                status_code=HTTP_400_BAD_REQUEST
            )
            
        except Exception as e:
            logger.error(f"Failed to verify reset code for {email}: {str(e)}")
            return ErrorResponseBuilder.build_internal_error_response()


class PasswordResetView(APIView):
    """
    GET: Validate reset token and redirect to password update form
    Handles password reset link validation (DEPRECATED - use VerifyResetCodeView)
    """
    
    permission_classes = [AllowAny]
    
    def get(self, request, token):
        """Validate reset token and provide reset context"""
        from django.utils import timezone
        from .models import RefreshToken
        
        token_prefix = token[:8] + "..." if len(token) > 8 else token
        
        try:
            # Find and validate reset token
            reset_record = RefreshToken.objects.get(
                token=token,
                is_blacklisted=False,
                expires_at__gt=timezone.now()
            )
            
            user = reset_record.user
            
            # Check if user is still active
            if not user.is_active:
                SecurityEventLogger.log_password_reset_failed(
                    email=user.email,
                    reason="user_inactive",
                    token_prefix=token_prefix
                )
                return ErrorResponseBuilder.build_error_response(
                    error_code=ErrorCodes.AUTHENTICATION_FAILED,
                    message="User account is not active",
                    status_code=HTTP_400_BAD_REQUEST
                )
            
            # Return user info for password reset form
            return Response(
                {
                    "success": True,
                    "message": "Reset token is valid",
                    "user": {
                        "id": user.id,
                        "email": user.email,
                        "full_name": user.full_name,
                    },
                    "reset_token": token,
                    "expires_at": reset_record.expires_at.isoformat(),
                },
                status=HTTP_200_OK,
            )
            
        except RefreshToken.DoesNotExist:
            # Check if token exists but is expired or blacklisted
            try:
                expired_record = RefreshToken.objects.get(token=token)
                if expired_record.expires_at <= timezone.now():
                    return InvitationErrorHandler.handle_invalid_token(token_prefix, "expired")
                elif expired_record.is_blacklisted:
                    return InvitationErrorHandler.handle_invalid_token(token_prefix, "already_used")
            except RefreshToken.DoesNotExist:
                pass
            
            # Token doesn't exist at all
            return InvitationErrorHandler.handle_invalid_token(token_prefix, "not_found")
            
        except Exception as e:
            logger.error(f"Failed to validate password reset token {token_prefix}: {str(e)}")
            return ErrorResponseBuilder.build_internal_error_response()


# endregion


# ============================================================================
# region PASSWORD UPDATE SYSTEM
# ============================================================================


class PasswordUpdateView(APIView):
    """
    POST: Handle password changes for both first-time setup and regular updates
    Validates current password for existing users and applies security requirements
    """
    
    permission_classes = [IsAuthenticated]
    
    def post(self, request):
        """Update user password with validation"""
        from django.contrib.auth import authenticate
        from django.utils import timezone
        from .services import PasswordValidator
        
        user = request.user
        current_password = request.data.get('current_password', '')
        new_password = request.data.get('new_password', '')
        confirm_password = request.data.get('confirm_password', '')
        is_first_time = request.data.get('is_first_time', False)
        
        # Convert is_first_time to boolean if it's a string
        if isinstance(is_first_time, str):
            is_first_time = is_first_time.lower() in ('true', '1', 'yes')
        
        # Validate required fields
        field_errors = {}
        
        if not new_password:
            field_errors["new_password"] = ["New password is required"]
        
        if not confirm_password:
            field_errors["confirm_password"] = ["Password confirmation is required"]
        
        # Check if passwords match
        if new_password and confirm_password and new_password != confirm_password:
            return PasswordErrorHandler.handle_passwords_dont_match()
        
        # Validate new password strength
        if new_password:
            is_valid, validation_errors = PasswordValidator.validate_password(new_password)
            if not is_valid:
                return PasswordErrorHandler.handle_weak_password(validation_errors)
        
        # For existing users (not first-time), verify current password
        if not is_first_time:
            if not current_password:
                field_errors["current_password"] = ["Current password is required"]
            elif not user.check_password(current_password):
                return PasswordErrorHandler.handle_incorrect_current_password(user.email)
        
        # Return validation errors if any
        if field_errors:
            return ErrorResponseBuilder.build_validation_error_response(field_errors)
        
        try:
            # Update password
            user.set_password(new_password)
            user.password_last_changed = timezone.now()
            user.save()
            
            # Log the password change
            SecurityEventLogger.log_password_update_success(user.email, is_first_time)
            
            # Return success response
            return Response(
                {
                    "success": True,
                    "message": "Password updated successfully",
                    "password_last_changed": user.password_last_changed.isoformat(),
                },
                status=HTTP_200_OK,
            )
            
        except Exception as e:
            logger.error(f"Failed to update password for user {user.email}: {str(e)}")
            SecurityEventLogger.log_password_update_failed(user.email, "internal_error")
            return ErrorResponseBuilder.build_internal_error_response()


# endregion


# ============================================================================
# region USER INVITATION SYSTEM
# ============================================================================


class InviteUserView(APIView):
    """
    POST: Send invitation to external user
    Creates invitation record and sends invitation email with activation link
    """

    permission_classes = [IsAuthenticated]

    @handle_network_errors
    def post(self, request):
        """Send invitation to external user"""
        from django.core.mail import send_mail
        from django.template.loader import render_to_string
        from django.utils.html import strip_tags
        from django.utils import timezone
        from datetime import timedelta
        import secrets
        from .models import InviteRecord

        # Validate request data
        external_user_data = request.data.get("external_user_data", {})
        role = request.data.get("role", "none")

        # Validate external user data
        if not external_user_data or not external_user_data.get("email"):
            return ErrorResponseBuilder.build_error_response(
                error_code=ErrorCodes.INVALID_EXTERNAL_DATA,
                message=UserFriendlyMessages.INVALID_EXTERNAL_DATA,
                field_errors={"external_user_data": ["External user data with email is required"]},
                status_code=HTTP_400_BAD_REQUEST
            )

        email = external_user_data.get("email").lower()

        # Validate role
        valid_roles = [choice[0] for choice in User.RoleChoices.choices]
        if role not in valid_roles:
            return ErrorResponseBuilder.build_error_response(
                error_code=ErrorCodes.INVALID_ROLE,
                message=UserFriendlyMessages.INVALID_ROLE,
                field_errors={"role": [f"Role must be one of: {', '.join(valid_roles)}"]},
                status_code=HTTP_400_BAD_REQUEST
            )

        # Check if user already exists
        if User.objects.filter(email=email).exists():
            return InvitationErrorHandler.handle_user_already_exists(email)

        # Check if there's already a valid invitation for this email
        existing_invite = InviteRecord.objects.filter(
            email=email,
            is_valid=True,
            is_used=False,
            expires_at__gt=timezone.now()
        ).first()
        
        if existing_invite:
            return InvitationErrorHandler.handle_invitation_already_exists(email)

        invite_record = None
        
        try:
            # Generate secure 32-character token
            token = secrets.token_urlsafe(32)
            
            # Set 24-hour expiration
            expires_at = timezone.now() + timedelta(hours=24)

            # Create invitation record (no user account yet)
            invite_record = InviteRecord.objects.create(
                email=email,
                invited_by=request.user,
                role=role,
                token=token,
                expires_at=expires_at,
                external_user_data=external_user_data
            )

            # Prepare email context
            context = {
                "invite_record": invite_record,
                "inviter": request.user,
                "external_user_data": external_user_data,
                "activation_url": f"{request.scheme}://{request.get_host()}/auth/activate-invite/{token}/",
                "site_name": "Cannabis Management System",
                "role_display": dict(User.RoleChoices.choices).get(role, "None"),
                "expires_at": expires_at,
            }

            # Render email templates
            subject = f'Invitation to {context["site_name"]}'
            html_message = render_to_string("users/invitation_email.html", context)
            plain_message = strip_tags(html_message)

            # Determine recipient based on system settings
            from common.models import SystemSettings
            system_settings = SystemSettings.load()
            
            if system_settings.send_emails_to_self:
                # Send to admin instead of actual recipient
                recipient_list = [system_settings.forward_certificate_emails_to]
                logger.info(f"Sending invitation email to admin ({system_settings.forward_certificate_emails_to}) instead of {email}")
            else:
                # Send to actual recipient
                recipient_list = [email]
                logger.info(f"Sending invitation email to actual recipient: {email}")
            
            # Send invitation email
            send_mail(
                subject=subject,
                message=plain_message,
                html_message=html_message,
                from_email=settings.DEFAULT_FROM_EMAIL,
                recipient_list=recipient_list,
                fail_silently=False,
            )

            # Log the invitation
            SecurityEventLogger.log_invitation_sent(
                inviter_email=request.user.email,
                invited_email=email,
                role=role,
                token_prefix=token[:8] + "..."
            )

            # Return invitation record data
            return Response(
                {
                    "success": True,
                    "message": "Invitation sent successfully",
                    "invitation": {
                        "id": invite_record.id,
                        "email": invite_record.email,
                        "role": invite_record.role,
                        "expires_at": invite_record.expires_at.isoformat(),
                        "created_at": invite_record.created_at.isoformat(),
                    }
                },
                status=HTTP_201_CREATED,
            )

        except Exception as e:
            # Clean up invitation record if created but email failed
            if invite_record:
                invite_record.delete()

            return InvitationErrorHandler.handle_email_send_failed(email, e)


class InviteActivationView(APIView):
    """
    GET: Handle invitation activation links
    Validates token, creates user account, and auto-logs in the user
    """

    permission_classes = [AllowAny]

    def get(self, request, token):
        """Activate invitation and create user account"""
        from django.utils import timezone
        from .models import InviteRecord
        from .services import PasswordValidator
        import secrets
        import string
        from rest_framework_simplejwt.tokens import RefreshToken

        token_prefix = token[:8] + "..." if len(token) > 8 else token

        try:
            # Find and validate invitation record
            invite_record = InviteRecord.objects.get(token=token)
            
            # Check if invitation is still valid
            if not invite_record.is_active:
                if invite_record.is_used:
                    return InvitationErrorHandler.handle_invalid_token(token_prefix, "already_used")
                elif invite_record.is_expired:
                    return InvitationErrorHandler.handle_invalid_token(token_prefix, "expired")
                else:
                    return InvitationErrorHandler.handle_invalid_token(token_prefix, "invalid")

            # Check if user already exists (shouldn't happen, but safety check)
            if User.objects.filter(email=invite_record.email).exists():
                SecurityEventLogger.log_invitation_activation_failed(
                    email=invite_record.email,
                    reason="user_already_exists",
                    token_prefix=token_prefix
                )
                return InvitationErrorHandler.handle_user_already_exists(invite_record.email)

            # Generate temporary password meeting security requirements
            alphabet = string.ascii_letters + string.digits + "!@#$%^&*"
            temp_password = "".join(secrets.choice(alphabet) for _ in range(12))
            
            # Validate the generated password meets requirements
            is_valid, errors = PasswordValidator.validate_password(temp_password)
            if not is_valid:
                # This should never happen with our generation logic, but safety check
                logger.error(f"Generated password failed validation: {errors}")
                SecurityEventLogger.log_invitation_activation_failed(
                    email=invite_record.email,
                    reason="password_generation_failed",
                    token_prefix=token_prefix
                )
                return ErrorResponseBuilder.build_internal_error_response()

            # Create user account from stored external data
            external_data = invite_record.external_user_data
            user = User.objects.create_user(
                email=invite_record.email,
                first_name=external_data.get("given_name", ""),
                last_name=external_data.get("surname", ""),
                role=invite_record.role,
                password=temp_password,
                employee_id=external_data.get("employee_id"),
                it_asset_id=external_data.get("id"),
                invited_by=invite_record.invited_by,
                invitation_accepted_at=timezone.now(),
                password_last_changed=timezone.now(),
            )

            # Mark invitation as used
            invite_record.is_used = True
            invite_record.used_at = timezone.now()
            invite_record.save()

            # Generate JWT tokens for auto-login
            refresh = RefreshToken.for_user(user)
            access_token = refresh.access_token

            # Log successful activation
            SecurityEventLogger.log_invitation_activation_success(
                email=user.email,
                inviter_email=invite_record.invited_by.email
            )

            # Return authentication tokens and user data
            from .serializers import UserJWTObjectSerializer
            user_serializer = UserJWTObjectSerializer(user)

            return Response(
                {
                    "success": True,
                    "message": "Invitation activated successfully",
                    "user": user_serializer.data,
                    "access": str(access_token),
                    "refresh": str(refresh),
                    "token_type": "Bearer",
                    "expires_in": settings.SIMPLE_JWT.get("ACCESS_TOKEN_LIFETIME").total_seconds(),
                    "temporary_password": temp_password,
                    "requires_password_change": True,
                },
                status=HTTP_200_OK,
            )

        except InviteRecord.DoesNotExist:
            return InvitationErrorHandler.handle_invalid_token(token_prefix, "not_found")
        except Exception as e:
            logger.error(f"Failed to activate invitation {token_prefix}: {str(e)}")
            SecurityEventLogger.log_invitation_activation_failed(
                email="unknown",
                reason="internal_error",
                token_prefix=token_prefix
            )
            return ErrorResponseBuilder.build_internal_error_response()


# endregion


# ============================================================================
# region USER MANAGEMENT VIEWS (Admin operations and listing)
# ============================================================================


class UserListView(ListCreateAPIView):
    """
    GET: List all users (with pagination, filtering, search)
    POST: Create new user (admin only)
    """

    queryset = User.objects.all().order_by("-date_joined")
    serializer_class = UserTinySerializer  # Lightweight for lists
    permission_classes = [IsAuthenticated]

    def get_permissions(self):
        """Different permissions for different actions"""
        if self.request.method == "POST":
            # Only admins can create users
            return [IsAdminUser()]
        else:
            # Staff can view user lists (adjust as needed)
            return [IsAuthenticated()]

    def get_serializer_class(self):
        """Use different serializers for different actions"""
        if self.request.method == "POST":
            return UserCreateSerializer
        return UserTinySerializer

    def get_queryset(self):
        """Add filtering and search capabilities"""
        queryset = super().get_queryset()

        # Filter by role
        role = self.request.query_params.get("role")
        if role:
            queryset = queryset.filter(role=role)

        # Filter by active status
        is_active = self.request.query_params.get("is_active")
        if is_active is not None:
            queryset = queryset.filter(is_active=is_active.lower() == "true")

        # Exclude specific user IDs
        exclude_ids = self.request.query_params.getlist("exclude")
        if exclude_ids:
            try:
                exclude_ids = [int(id) for id in exclude_ids if id.isdigit()]
                if exclude_ids:
                    queryset = queryset.exclude(id__in=exclude_ids)
            except (ValueError, TypeError):
                pass  # Ignore invalid exclude IDs

        # Search by name or email (case-insensitive partial match)
        search = self.request.query_params.get("search")
        if search and search.strip():
            search = search.strip()
            queryset = queryset.filter(
                Q(first_name__icontains=search)
                | Q(last_name__icontains=search)
                | Q(email__icontains=search)
            )

        return queryset


class UserDetailView(RetrieveUpdateDestroyAPIView):
    """
    GET: Get user details (full info except sensitive data)
    PUT/PATCH: Update user (admin only, or self with restrictions)
    DELETE: Delete user (admin only)
    """

    queryset = User.objects.all()
    serializer_class = UserJWTObjectSerializer  # Full details
    permission_classes = [IsAuthenticated]
    lookup_field = "pk"

    def get_permissions(self):
        """Different permissions for different actions"""
        if self.request.method in ["PUT", "PATCH", "DELETE"]:
            # Only admins or self can modify
            return [IsAuthenticated()]  # Handling in check_object_permissions
        else:
            return [IsAuthenticated()]

    def check_object_permissions(self, request, obj):
        """Custom permission logic"""
        super().check_object_permissions(request, obj)

        # For modifications, only allow admin or self
        if request.method in ["PUT", "PATCH", "DELETE"]:
            if not (request.user.is_staff or request.user == obj):
                self.permission_denied(request, "You can only modify your own profile")

        # For deletion, only admins
        if request.method == "DELETE":
            if not request.user.is_superuser:
                self.permission_denied(request, "Only administrators can delete users")

    def perform_update(self, serializer):
        """Custom update logic"""
        # Log the update
        settings.LOGGER.info(
            f"User {self.request.user} updated user {serializer.instance}"
        )
        serializer.save()

    def perform_destroy(self, instance):
        """Custom deletion logic"""
        # Log the deletion
        settings.LOGGER.warning(f"User {self.request.user} deleted user {instance}")

        # Soft delete instead of hard delete
        instance.is_active = False
        instance.save()
        # super().perform_destroy(instance) for hard delete


class UserExportView(APIView):
    """
    Export users data in CSV or JSON format
    Supports filtering and bypasses pagination for full dataset exports
    """

    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        """Get filtered queryset for export"""
        queryset = User.objects.all().order_by("-date_joined")

        # Filter by role
        role = self.request.query_params.get("role")
        if role:
            queryset = queryset.filter(role=role)

        # Filter by active status
        is_active = self.request.query_params.get("is_active")
        if is_active is not None:
            queryset = queryset.filter(is_active=is_active.lower() == "true")

        # Search by name or email (case-insensitive partial match)
        search = self.request.query_params.get("search")
        if search and search.strip():
            search = search.strip()
            queryset = queryset.filter(
                Q(first_name__icontains=search)
                | Q(last_name__icontains=search)
                | Q(email__icontains=search)
            )

        # Dynamic ordering
        ordering = self.request.query_params.get("ordering", "-date_joined")
        valid_orderings = {
            "id": "id",
            "-id": "-id",
            "first_name": "first_name",
            "-first_name": "-first_name",
            "last_name": "last_name",
            "-last_name": "-last_name",
            "email": "email",
            "-email": "-email",
            "role": "role",
            "-role": "-role",
            "is_active": "is_active",
            "-is_active": "-is_active",
            "date_joined": "date_joined",
            "-date_joined": "-date_joined",
        }

        if ordering in valid_orderings:
            queryset = queryset.order_by(valid_orderings[ordering])

        return queryset

    def get(self, request):
        """Export users data"""
        # Debug logging
        settings.LOGGER.info(f"=== USER EXPORT VIEW CALLED ===")
        settings.LOGGER.info(f"User: {request.user}")
        settings.LOGGER.info(f"Path: {request.path}")
        settings.LOGGER.info(f"Query params: {dict(request.query_params)}")
        settings.LOGGER.info(f"Method: {request.method}")
        settings.LOGGER.info(f"Headers: {dict(request.headers)}")

        export_format = request.query_params.get("export_format", "csv").lower()
        settings.LOGGER.info(f"Export format: {export_format}")

        # CRITICAL DEBUG: Test if this is even being called for CSV
        if export_format == "csv":
            settings.LOGGER.error(f"🚨 CSV EXPORT REQUESTED - VIEW IS BEING CALLED")
        else:
            settings.LOGGER.error(f"🚨 NON-CSV EXPORT REQUESTED: {export_format}")

        # Force CSV to work by bypassing format validation
        if export_format == "csv":
            settings.LOGGER.info("🔧 FORCING CSV EXPORT")
            try:
                queryset = self.get_queryset()
                total_count = queryset.count()
                settings.LOGGER.info(f"CSV: Got {total_count} users")

                # Simple CSV response
                output = io.StringIO()
                writer = csv.writer(output)

                writer.writerow(["ID", "First Name", "Last Name", "Email"])
                for user in queryset[:10]:  # Limit to 10 for testing
                    writer.writerow(
                        [user.id, user.first_name, user.last_name, user.email]
                    )

                response = HttpResponse(output.getvalue(), content_type="text/csv")
                response["Content-Disposition"] = (
                    'attachment; filename="users_test.csv"'
                )
                settings.LOGGER.info("✅ CSV response created successfully")
                return response
            except Exception as e:
                settings.LOGGER.error(f"❌ CSV generation failed: {str(e)}")
                return Response({"error": f"CSV failed: {str(e)}"}, status=500)

        if export_format not in ["csv", "json"]:
            return Response(
                {"error": "Invalid format. Supported formats: csv, json"},
                status=HTTP_400_BAD_REQUEST,
            )

        try:
            queryset = self.get_queryset()

            # Check if dataset is too large (safety limit)
            max_export_limit = getattr(settings, "MAX_EXPORT_LIMIT", 10000)
            total_count = queryset.count()

            if total_count > max_export_limit:
                return Response(
                    {
                        "error": f"Dataset too large for export. Maximum {max_export_limit} records allowed.",
                        "total_count": total_count,
                    },
                    status=HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                )

            # Use streaming response for large datasets
            if total_count > 1000:
                settings.LOGGER.info(
                    f"Using streaming response for {total_count} records"
                )
                if export_format == "csv":
                    settings.LOGGER.info("Calling _stream_csv_response")
                    return self._stream_csv_response(queryset)
                else:
                    settings.LOGGER.info("Calling _stream_json_response")
                    return self._stream_json_response(queryset)
            else:
                settings.LOGGER.info(
                    f"Using regular response for {total_count} records"
                )
                if export_format == "csv":
                    settings.LOGGER.info("Calling _csv_response")
                    return self._csv_response(queryset)
                else:
                    settings.LOGGER.info("Calling _json_response")
                    return self._json_response(queryset)

        except Exception as e:
            settings.LOGGER.error(f"Export error: {str(e)}")
            return Response(
                {"error": "Export failed. Please try again."},
                status=HTTP_500_INTERNAL_SERVER_ERROR,
            )

    def _csv_response(self, queryset):
        """Generate CSV response for smaller datasets"""
        settings.LOGGER.error(
            f"🚨 _csv_response METHOD CALLED - STARTING CSV GENERATION"
        )
        output = io.StringIO()
        writer = csv.writer(output)

        # Write header
        writer.writerow(
            [
                "ID",
                "First Name",
                "Last Name",
                "Email",
                "Role",
                "Role Display",
                "Is Active",
                "Is Staff",
                "Is Superuser",
                "Employee ID",
                "Date Joined",
            ]
        )

        # Write data
        for user in queryset:
            writer.writerow(
                [
                    user.id,
                    user.first_name,
                    user.last_name,
                    user.email,
                    user.role,
                    user.get_role_display(),
                    user.is_active,
                    user.is_staff,
                    user.is_superuser,
                    user.employee_id or "",
                    user.date_joined.isoformat() if user.date_joined else "",
                ]
            )

        response = HttpResponse(output.getvalue(), content_type="text/csv")
        response["Content-Disposition"] = 'attachment; filename="users_export.csv"'

        settings.LOGGER.info(
            f"User {self.request.user} exported {queryset.count()} users as CSV"
        )
        return response

    def _json_response(self, queryset):
        """Generate JSON response for smaller datasets"""
        serializer = UserTinySerializer(queryset, many=True)
        data = {"count": queryset.count(), "results": serializer.data}

        response = HttpResponse(
            json.dumps(data, indent=2), content_type="application/json"
        )
        response["Content-Disposition"] = 'attachment; filename="users_export.json"'

        settings.LOGGER.info(
            f"User {self.request.user} exported {queryset.count()} users as JSON"
        )
        return response

    def _stream_csv_response(self, queryset):
        """Generate streaming CSV response for large datasets"""

        def csv_generator():
            output = io.StringIO()
            writer = csv.writer(output)

            # Write header
            writer.writerow(
                [
                    "ID",
                    "First Name",
                    "Last Name",
                    "Email",
                    "Role",
                    "Role Display",
                    "Is Active",
                    "Is Staff",
                    "Is Superuser",
                    "Employee ID",
                    "Date Joined",
                ]
            )
            yield output.getvalue()
            output.seek(0)
            output.truncate(0)

            # Write data in chunks
            chunk_size = 100
            for i in range(0, queryset.count(), chunk_size):
                chunk = queryset[i : i + chunk_size]
                for user in chunk:
                    writer.writerow(
                        [
                            user.id,
                            user.first_name,
                            user.last_name,
                            user.email,
                            user.role,
                            user.get_role_display(),
                            user.is_active,
                            user.is_staff,
                            user.is_superuser,
                            user.employee_id or "",
                            user.date_joined.isoformat() if user.date_joined else "",
                        ]
                    )
                yield output.getvalue()
                output.seek(0)
                output.truncate(0)

        response = StreamingHttpResponse(csv_generator(), content_type="text/csv")
        response["Content-Disposition"] = 'attachment; filename="users_export.csv"'

        settings.LOGGER.info(
            f"User {self.request.user} started streaming export of {queryset.count()} users as CSV"
        )
        return response

    def _stream_json_response(self, queryset):
        """Generate streaming JSON response for large datasets"""

        def json_generator():
            yield '{"count": ' + str(queryset.count()) + ', "results": ['

            chunk_size = 100
            first_chunk = True

            for i in range(0, queryset.count(), chunk_size):
                chunk = queryset[i : i + chunk_size]
                serializer = UserTinySerializer(chunk, many=True)

                for j, item in enumerate(serializer.data):
                    if not first_chunk or j > 0:
                        yield ","
                    yield json.dumps(item)
                    first_chunk = False

            yield "]}"

        response = StreamingHttpResponse(
            json_generator(), content_type="application/json"
        )
        response["Content-Disposition"] = 'attachment; filename="users_export.json"'

        settings.LOGGER.info(
            f"User {self.request.user} started streaming export of {queryset.count()} users as JSON"
        )
        return response


class UserCSVExportView(APIView):
    """
    CSV-only export view to bypass routing issues
    """

    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        """Get filtered queryset for export"""
        queryset = User.objects.all().order_by("-date_joined")

        # Filter by role
        role = self.request.query_params.get("role")
        if role:
            queryset = queryset.filter(role=role)

        # Filter by active status
        is_active = self.request.query_params.get("is_active")
        if is_active is not None:
            is_active_bool = is_active.lower() in ["true", "1", "yes"]
            queryset = queryset.filter(is_active=is_active_bool)

        # Search functionality
        search = self.request.query_params.get("search")
        if search:
            queryset = queryset.filter(
                Q(first_name__icontains=search)
                | Q(last_name__icontains=search)
                | Q(email__icontains=search)
                | Q(employee_id__icontains=search)
            )

        # Dynamic ordering
        ordering = self.request.query_params.get("ordering", "-date_joined")
        valid_orderings = {
            "first_name": "first_name",
            "-first_name": "-first_name",
            "last_name": "last_name",
            "-last_name": "-last_name",
            "email": "email",
            "-email": "-email",
            "date_joined": "date_joined",
            "-date_joined": "-date_joined",
            "role": "role",
            "-role": "-role",
        }

        if ordering in valid_orderings:
            queryset = queryset.order_by(valid_orderings[ordering])

        return queryset

    def get(self, request):
        """Export users data as CSV only"""
        settings.LOGGER.info(f"🚨 CSV-ONLY EXPORT VIEW CALLED")
        settings.LOGGER.info(f"User: {request.user}")
        settings.LOGGER.info(f"Path: {request.path}")

        try:
            queryset = self.get_queryset()
            total_count = queryset.count()

            settings.LOGGER.info(f"Exporting {total_count} users as CSV")

            # Generate CSV response
            output = io.StringIO()
            writer = csv.writer(output)

            # Write header
            writer.writerow(
                [
                    "ID",
                    "First Name",
                    "Last Name",
                    "Email",
                    "Role",
                    "Role Display",
                    "Is Active",
                    "Is Staff",
                    "Is Superuser",
                    "Employee ID",
                    "Date Joined",
                ]
            )

            # Write data
            for user in queryset:
                writer.writerow(
                    [
                        user.id,
                        user.first_name,
                        user.last_name,
                        user.email,
                        user.role,
                        user.get_role_display(),
                        user.is_active,
                        user.is_staff,
                        user.is_superuser,
                        user.employee_id or "",
                        user.date_joined.isoformat() if user.date_joined else "",
                    ]
                )

            response = HttpResponse(output.getvalue(), content_type="text/csv")
            response["Content-Disposition"] = 'attachment; filename="users_export.csv"'

            settings.LOGGER.info(f"✅ CSV export successful: {total_count} users")
            return response

        except Exception as e:
            settings.LOGGER.error(f"❌ CSV export failed: {str(e)}")
            return Response(
                {"error": "CSV export failed. Please try again."},
                status=HTTP_500_INTERNAL_SERVER_ERROR,
            )


class SimpleCSVTestView(APIView):
    """
    Ultra-simple CSV test view to isolate the issue
    """

    permission_classes = []  # No authentication required for testing

    def get(self, request):
        """Simple CSV test"""
        settings.LOGGER.error(f"🔥 SIMPLE CSV TEST VIEW CALLED")
        settings.LOGGER.error(f"Query params: {dict(request.query_params)}")

        # Return simple CSV
        csv_content = "ID,Name\n1,Test User\n2,Another User"
        response = HttpResponse(csv_content, content_type="text/csv")
        response["Content-Disposition"] = 'attachment; filename="test.csv"'

        settings.LOGGER.error(f"🔥 SIMPLE CSV RESPONSE CREATED")
        return response


# endregion


# endregion
