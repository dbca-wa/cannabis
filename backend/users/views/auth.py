"""
Authentication views: login, logout, token refresh, whoami,
password validation, password reset, and password update.
"""

import logging

from django.conf import settings
from django.contrib.auth import get_user_model
from django.utils.decorators import method_decorator
from django.views.decorators.cache import never_cache
from rest_framework.exceptions import ValidationError
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.status import (
    HTTP_200_OK,
    HTTP_400_BAD_REQUEST,
    HTTP_429_TOO_MANY_REQUESTS,
    HTTP_500_INTERNAL_SERVER_ERROR,
)
from rest_framework.views import APIView
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from rest_framework_simplejwt.views import TokenObtainPairView

from ..error_handlers import (
    ErrorCodes,
    ErrorResponseBuilder,
    PasswordErrorHandler,
    SecurityEventLogger,
    UserFriendlyMessages,
    handle_network_errors,
)
from ..serializers import UserBasicSerializer, UserJWTObjectSerializer

logger = logging.getLogger(__name__)

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
        from ..services import AuthService

        refresh_token = request.data.get("refresh_token")
        AuthService.logout(refresh_token)
        return Response(
            {"message": "Logged out successfully", "status": "success"},
            status=HTTP_200_OK,
        )


# endregion


# ============================================================================
# region CURRENT USER VIEWS (Self-management)
# ============================================================================


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
                    "given_names": None,
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


# endregion


# ============================================================================
# region PASSWORD VALIDATION
# ============================================================================


class PasswordValidationView(APIView):
    """
    POST: Validate password strength and requirements
    Provides real-time validation for frontend forms
    """

    permission_classes = [AllowAny]

    def post(self, request):
        """Validate password and return detailed strength information"""
        from ..services import PasswordValidator

        password = request.data.get("password", "")

        if not password:
            raise ValidationError({"password": ["Password is required."]})

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
    throttle_classes = []

    @handle_network_errors
    def post(self, request):
        """Send password reset code to user"""
        from common.services import EmailService

        from ..services import PasswordResetCodeService
        from ..throttles import PasswordResetEmailThrottle

        # Apply custom throttling
        throttle = PasswordResetEmailThrottle()
        if not throttle.allow_request(request, self):
            return ErrorResponseBuilder.build_error_response(
                error_code=ErrorCodes.RATE_LIMITED,
                message="Too many password reset requests. Please wait before trying again.",
                status_code=HTTP_429_TOO_MANY_REQUESTS,
            )

        email = request.data.get("email", "").strip().lower()

        if not email:
            return ErrorResponseBuilder.build_validation_error_response(
                {"email": ["Email address is required"]}
            )

        try:
            # Check if user exists
            user = User.objects.get(email=email, is_active=True)

            # Check if user is eligible for password reset
            is_eligible, reason = (
                PasswordResetCodeService.validate_password_change_eligibility(user)
            )
            if not is_eligible:
                return ErrorResponseBuilder.build_error_response(
                    error_code=ErrorCodes.RATE_LIMITED,
                    message=reason,
                    status_code=HTTP_400_BAD_REQUEST,
                )

            # Generate secure 4-digit reset code
            try:
                reset_code = PasswordResetCodeService.generate_reset_code(user)
                plain_code = reset_code._plain_code
            except ValueError:
                return ErrorResponseBuilder.build_error_response(
                    error_code=ErrorCodes.DUPLICATE_REQUEST,
                    message=UserFriendlyMessages.DUPLICATE_REQUEST,
                    status_code=HTTP_400_BAD_REQUEST,
                )

            # Build the reset-page link from configuration (absolute, scheme-safe)
            from common.utils import get_frontend_url

            reset_page_url = get_frontend_url("/auth/reset-code")

            # Prepare email context
            context = {
                "user": user,
                "reset_code": plain_code,
                "frontend_url": reset_page_url,
                "site_name": "Cannabis Management System",
                "expires_at": reset_code.expires_at,
                "max_attempts": reset_code.max_attempts,
            }

            # Determine recipient based on system settings (send-to-self toggle)
            from common.models import SystemSettings

            system_settings = SystemSettings.load()

            if system_settings.send_emails_to_self:
                recipient_list = [system_settings.forward_certificate_emails_to]
                logger.info(
                    f"Sending password reset code to admin "
                    f"({system_settings.forward_certificate_emails_to}) instead of {email}"
                )
            else:
                recipient_list = [email]
                logger.info(f"Sending password reset code to actual recipient: {email}")

            # Send via the centralised email service (renders the shared
            # emails/ template, attaches the inline logo, applies test mode).
            EmailService.send_template_email(
                template_name="emails/password_reset_email.html",
                recipient_email=recipient_list,
                subject=f'Password Reset Code - {context["site_name"]}',
                context=context,
            )

            # Log the password reset request
            SecurityEventLogger.log_password_reset_requested(email, exists=True)

        except User.DoesNotExist:
            SecurityEventLogger.log_password_reset_requested(email, exists=False)

        except Exception as e:
            logger.error(f"Failed to send password reset code to {email}: {str(e)}")
            return ErrorResponseBuilder.build_error_response(
                error_code=ErrorCodes.EMAIL_SEND_FAILED,
                message=UserFriendlyMessages.EMAIL_SEND_FAILED,
                status_code=HTTP_500_INTERNAL_SERVER_ERROR,
            )

        # Always return success to prevent email enumeration attacks
        return Response(
            {
                "success": True,
                "message": "If an account with this email exists, a 4-digit reset code has been sent to your email.",
                "email": email,
                "next_step": "Check your email and enter the 4-digit code on the reset page.",
            },
            status=HTTP_200_OK,
        )


class VerifyResetCodeView(APIView):
    """
    POST: Verify password reset code and authenticate user
    Handles 4-digit code verification and automatic login
    """

    permission_classes = [AllowAny]
    throttle_classes = []

    def post(self, request):
        """Verify reset code and authenticate user"""
        from ..services import PasswordResetCodeService
        from ..throttles import (
            BruteForceProtectionThrottle,
            ResetCodeVerificationThrottle,
        )

        # Apply custom throttling
        throttle = ResetCodeVerificationThrottle()
        if not throttle.allow_request(request, self):
            return ErrorResponseBuilder.build_error_response(
                error_code=ErrorCodes.RATE_LIMITED,
                message="Too many verification attempts. Please wait before trying again.",
                status_code=HTTP_429_TOO_MANY_REQUESTS,
            )

        email = request.data.get("email", "").strip().lower()
        code = request.data.get("code", "").strip()

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
            x_forwarded_for = request.META.get("HTTP_X_FORWARDED_FOR")
            if x_forwarded_for:
                ip = x_forwarded_for.split(",")[0]
            else:
                ip = request.META.get("REMOTE_ADDR")
            return ip

        client_ip = get_client_ip(request)

        # Check brute force protection
        is_allowed, reason, wait_time = (
            BruteForceProtectionThrottle.check_brute_force_protection(email, client_ip)
        )
        if not is_allowed:
            return ErrorResponseBuilder.build_error_response(
                error_code=ErrorCodes.RATE_LIMITED,
                message=f"{reason}. Please try again in {wait_time} seconds.",
                status_code=HTTP_429_TOO_MANY_REQUESTS,
            )

        try:
            # Find the user
            user = User.objects.get(email=email, is_active=True)

            # Verify the reset code
            is_valid, reset_code_instance, message = (
                PasswordResetCodeService.verify_reset_code(user, code)
            )

            if not is_valid:
                # Record failed attempt for brute force protection
                attempt_count = (
                    reset_code_instance.attempts if reset_code_instance else 1
                )
                BruteForceProtectionThrottle.record_failed_attempt(
                    email, client_ip, attempt_count
                )

                # Log the failed attempt
                SecurityEventLogger.log_password_reset_failed(
                    email=email,
                    reason="invalid_code",
                    token_prefix=f"code_{code}",
                )

                # Provide specific error messages based on the failure reason
                if "expired" in message.lower():
                    return ErrorResponseBuilder.build_error_response(
                        error_code=ErrorCodes.TOKEN_EXPIRED,
                        message=UserFriendlyMessages.EXPIRED_TOKEN,
                        status_code=HTTP_400_BAD_REQUEST,
                    )
                elif "maximum" in message.lower():
                    return ErrorResponseBuilder.build_error_response(
                        error_code=ErrorCodes.MAX_ATTEMPTS_EXCEEDED,
                        message=UserFriendlyMessages.MAX_ATTEMPTS_EXCEEDED,
                        status_code=HTTP_400_BAD_REQUEST,
                    )
                else:
                    return ErrorResponseBuilder.build_error_response(
                        error_code=ErrorCodes.INVALID_CODE,
                        message=UserFriendlyMessages.INVALID_CODE,
                        status_code=HTTP_400_BAD_REQUEST,
                    )

            # Code is valid - generate JWT tokens for automatic login
            from ..services import AuthService

            tokens = AuthService.generate_tokens_for_user(user)

            # Clear failed attempts after successful verification
            BruteForceProtectionThrottle.clear_failed_attempts(email, client_ip)

            # Log successful verification
            SecurityEventLogger.log_password_reset_success(email)

            # Return authentication tokens and user data
            from ..serializers import UserJWTObjectSerializer

            user_serializer = UserJWTObjectSerializer(user)

            return Response(
                {
                    "success": True,
                    "message": "Reset code verified successfully. You are now logged in.",
                    "user": user_serializer.data,
                    "access": tokens["access"],
                    "refresh": tokens["refresh"],
                    "token_type": tokens["token_type"],
                    "expires_in": tokens["expires_in"],
                    "requires_password_change": True,
                    "next_step": "Please update your password to complete the reset process.",
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
                token_prefix=f"code_{code}",
            )
            return ErrorResponseBuilder.build_error_response(
                error_code=ErrorCodes.INVALID_CREDENTIALS,
                message=UserFriendlyMessages.INVALID_CREDENTIALS,
                status_code=HTTP_400_BAD_REQUEST,
            )

        except Exception as e:
            logger.error(f"Failed to verify reset code for {email}: {str(e)}")
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
        from django.utils import timezone

        from ..services import PasswordValidator

        user = request.user
        current_password = request.data.get("current_password", "")
        new_password = request.data.get("new_password", "")
        confirm_password = request.data.get("confirm_password", "")
        is_first_time = request.data.get("is_first_time", False)

        # Convert is_first_time to boolean if it's a string
        if isinstance(is_first_time, str):
            is_first_time = is_first_time.lower() in ("true", "1", "yes")

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
            is_valid, validation_errors = PasswordValidator.validate_password(
                new_password
            )
            if not is_valid:
                return PasswordErrorHandler.handle_weak_password(validation_errors)

        # For existing users (not first-time), verify current password
        if not is_first_time:
            if not current_password:
                field_errors["current_password"] = ["Current password is required"]
            elif not user.check_password(current_password):
                return PasswordErrorHandler.handle_incorrect_current_password(
                    user.email
                )

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
