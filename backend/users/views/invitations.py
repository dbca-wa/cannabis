"""
Invitation views: external user search, invite user, and invitation activation.
"""

import logging

from django.conf import settings
from django.contrib.auth import get_user_model
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.status import (
    HTTP_200_OK,
    HTTP_201_CREATED,
    HTTP_400_BAD_REQUEST,
)
from rest_framework.views import APIView

from ..error_handlers import (
    ErrorCodes,
    ErrorResponseBuilder,
    InvitationErrorHandler,
    SecurityEventLogger,
    UserFriendlyMessages,
    handle_network_errors,
)

logger = logging.getLogger(__name__)

User = get_user_model()


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
            cache.set(cache_key, limited_results, 300)

            return Response({"results": limited_results}, status=HTTP_200_OK)

        except requests.RequestException as e:
            settings.LOGGER.error(f"External API error: {str(e)}")
            raise
        except Exception as e:
            settings.LOGGER.error(f"Unexpected error in external user search: {str(e)}")
            raise


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
        import secrets
        from datetime import timedelta

        from django.core.mail import send_mail
        from django.template.loader import render_to_string
        from django.utils import timezone
        from django.utils.html import strip_tags

        from ..models import InviteRecord

        # Validate request data
        external_user_data = request.data.get("external_user_data", {})
        role = request.data.get("role", "none")

        # Validate external user data
        if not external_user_data or not external_user_data.get("email"):
            return ErrorResponseBuilder.build_error_response(
                error_code=ErrorCodes.INVALID_EXTERNAL_DATA,
                message=UserFriendlyMessages.INVALID_EXTERNAL_DATA,
                field_errors={
                    "external_user_data": ["External user data with email is required"]
                },
                status_code=HTTP_400_BAD_REQUEST,
            )

        email = external_user_data.get("email").lower()

        # Validate role
        valid_roles = [choice[0] for choice in User.RoleChoices.choices]
        if role not in valid_roles:
            return ErrorResponseBuilder.build_error_response(
                error_code=ErrorCodes.INVALID_ROLE,
                message=UserFriendlyMessages.INVALID_ROLE,
                field_errors={
                    "role": [f"Role must be one of: {', '.join(valid_roles)}"]
                },
                status_code=HTTP_400_BAD_REQUEST,
            )

        # Check if user already exists
        if User.objects.filter(email=email).exists():
            return InvitationErrorHandler.handle_user_already_exists(email)

        # Check if there's already a valid invitation for this email
        existing_invite = InviteRecord.objects.filter(
            email=email,
            is_valid=True,
            is_used=False,
            expires_at__gt=timezone.now(),
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
                external_user_data=external_user_data,
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
                recipient_list = [system_settings.forward_certificate_emails_to]
                logger.info(
                    f"Sending invitation email to admin ({system_settings.forward_certificate_emails_to}) instead of {email}"
                )
            else:
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
                token_prefix=token[:8] + "...",
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
                    },
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
        import secrets
        import string

        from django.utils import timezone
        from rest_framework_simplejwt.tokens import RefreshToken

        from ..models import InviteRecord
        from ..services import PasswordValidator

        token_prefix = token[:8] + "..." if len(token) > 8 else token

        try:
            # Find and validate invitation record
            invite_record = InviteRecord.objects.get(token=token)

            # Check if invitation is still valid
            if not invite_record.is_active:
                if invite_record.is_used:
                    return InvitationErrorHandler.handle_invalid_token(
                        token_prefix, "already_used"
                    )
                elif invite_record.is_expired:
                    return InvitationErrorHandler.handle_invalid_token(
                        token_prefix, "expired"
                    )
                else:
                    return InvitationErrorHandler.handle_invalid_token(
                        token_prefix, "invalid"
                    )

            # Check if user already exists (safety check)
            if User.objects.filter(email=invite_record.email).exists():
                SecurityEventLogger.log_invitation_activation_failed(
                    email=invite_record.email,
                    reason="user_already_exists",
                    token_prefix=token_prefix,
                )
                return InvitationErrorHandler.handle_user_already_exists(
                    invite_record.email
                )

            # Generate temporary password meeting security requirements
            alphabet = string.ascii_letters + string.digits + "!@#$%^&*"
            temp_password = "".join(secrets.choice(alphabet) for _ in range(12))

            # Validate the generated password meets requirements
            is_valid, errors = PasswordValidator.validate_password(temp_password)
            if not is_valid:
                logger.error(f"Generated password failed validation: {errors}")
                SecurityEventLogger.log_invitation_activation_failed(
                    email=invite_record.email,
                    reason="password_generation_failed",
                    token_prefix=token_prefix,
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
                inviter_email=invite_record.invited_by.email,
            )

            # Return authentication tokens and user data
            from ..serializers import UserJWTObjectSerializer

            user_serializer = UserJWTObjectSerializer(user)

            return Response(
                {
                    "success": True,
                    "message": "Invitation activated successfully",
                    "user": user_serializer.data,
                    "access": str(access_token),
                    "refresh": str(refresh),
                    "token_type": "Bearer",
                    "expires_in": settings.SIMPLE_JWT.get(
                        "ACCESS_TOKEN_LIFETIME"
                    ).total_seconds(),
                    "temporary_password": temp_password,
                    "requires_password_change": True,
                },
                status=HTTP_200_OK,
            )

        except InviteRecord.DoesNotExist:
            return InvitationErrorHandler.handle_invalid_token(
                token_prefix, "not_found"
            )
        except Exception as e:
            logger.error(f"Failed to activate invitation {token_prefix}: {str(e)}")
            SecurityEventLogger.log_invitation_activation_failed(
                email="unknown",
                reason="internal_error",
                token_prefix=token_prefix,
            )
            return ErrorResponseBuilder.build_internal_error_response()


# endregion
