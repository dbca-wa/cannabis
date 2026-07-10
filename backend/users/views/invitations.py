"""
Invitation views: external user search, invite user, and invitation activation.
"""

import logging

from django.conf import settings
from django.contrib.auth import get_user_model
from rest_framework.permissions import AllowAny
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
from ..models import InviteRecord
from ..permissions import HasAppAccess

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

    permission_classes = [HasAppAccess]

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

            # Get existing user emails to exclude (only active users)
            existing_emails = set(
                User.objects.filter(is_active=True).values_list("email", flat=True)
            )

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

    permission_classes = [HasAppAccess]

    @handle_network_errors
    def post(self, request):
        """Send invitation to external user"""
        import secrets
        from datetime import timedelta

        from django.utils import timezone

        from common.services import EmailService

        from ..models import InviteRecord

        # Validate request data
        external_user_data = request.data.get("external_user_data", {})
        role = request.data.get("role", "none")
        invite_as_admin = request.data.get("is_staff", False)

        # Only admins can invite as admin
        if invite_as_admin and not (request.user.is_staff or request.user.is_superuser):
            return ErrorResponseBuilder.build_error_response(
                error_code=ErrorCodes.INVALID_ROLE,
                message="Only administrators can invite users as admin.",
                field_errors={
                    "is_staff": ["Only administrators can grant admin access"]
                },
                status_code=HTTP_400_BAD_REQUEST,
            )

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

        # Check if user already exists (active users only)
        if User.objects.filter(email=email, is_active=True).exists():
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
                is_staff=bool(invite_as_admin),
            )

            # Build the activation link from configuration; no trailing slash so
            # it matches the SPA route /auth/activate-invite/:token.
            from common.utils import get_frontend_url

            activation_link = get_frontend_url(f"/auth/activate-invite/{token}")
            role_display = dict(User.RoleChoices.choices).get(role, "None")

            # Prepare email context (matches emails/invitation_email.html)
            context = {
                "recipient_given_names": external_user_data.get("given_name")
                or "there",
                "inviter_given_names": request.user.given_names,
                "inviter_last_name": request.user.last_name,
                "inviter_email": request.user.email,
                "invitee_proposed_role": role_display,
                "invitation_link": activation_link,
                "expires_at": expires_at,
            }

            # Determine recipient based on system settings (send-to-self toggle)
            from common.models import SystemSettings

            system_settings = SystemSettings.load()

            if system_settings.send_emails_to_self:
                recipient_list = [system_settings.forward_certificate_emails_to]
                logger.info(
                    f"Sending invitation email to admin "
                    f"({system_settings.forward_certificate_emails_to}) instead of {email}"
                )
            else:
                recipient_list = [email]
                logger.info(f"Sending invitation email to actual recipient: {email}")

            # Send via the centralised email service (shared emails/ template,
            # inline logo, test-mode redirection).
            EmailService.send_template_email(
                template_name="emails/invitation_email.html",
                recipient_email=recipient_list,
                subject="Invitation to Cannabis Management System",
                context=context,
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


class TestInviteEmailView(APIView):
    """
    POST: Send a live invitation email for testing/preview purposes.

    Renders and sends the real invitation email to a chosen address with a
    chosen role, WITHOUT creating an InviteRecord or User. Staff/superuser only.
    Sends directly to the provided address so the tester controls the recipient.
    """

    permission_classes = [HasAppAccess]

    def post(self, request):
        import secrets
        from datetime import timedelta

        from django.utils import timezone
        from rest_framework.exceptions import PermissionDenied
        from rest_framework.exceptions import ValidationError as DRFValidationError

        from common.services import EmailService
        from common.utils import get_frontend_url

        if not (request.user.is_staff or request.user.is_superuser):
            raise PermissionDenied(
                "Only staff or admin users can send test invitation emails."
            )

        email = (request.data.get("email") or request.user.email or "").strip()
        role = request.data.get("role", "none")

        if not email:
            raise DRFValidationError({"email": ["An email address is required."]})

        valid_roles = [choice[0] for choice in User.RoleChoices.choices]
        if role not in valid_roles:
            raise DRFValidationError(
                {"role": [f"Role must be one of: {', '.join(valid_roles)}"]}
            )

        # A sample (non-functional) activation link so the email renders exactly
        # as a real invite would, without persisting a token.
        sample_token = f"sample-{secrets.token_urlsafe(16)}"
        activation_link = get_frontend_url(f"/auth/activate-invite/{sample_token}")
        role_display = dict(User.RoleChoices.choices).get(role, "None")
        expires_at = timezone.now() + timedelta(hours=24)

        context = {
            "recipient_given_names": "there",
            "inviter_given_names": request.user.given_names,
            "inviter_last_name": request.user.last_name,
            "inviter_email": request.user.email,
            "invitee_proposed_role": role_display,
            "invitation_link": activation_link,
            "expires_at": expires_at,
        }

        EmailService.send_template_email(
            template_name="emails/invitation_email.html",
            recipient_email=[email],
            subject="[TEST] Invitation to Cannabis Management System",
            context=context,
        )

        logger.info(
            f"Test invitation email sent to {email} (role={role}) by "
            f"{request.user.email}"
        )

        return Response(
            {
                "success": True,
                "message": f"Test invitation email sent to {email}.",
            },
            status=HTTP_200_OK,
        )


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

            # Check if user already exists (safety check - active users only)
            if User.objects.filter(email=invite_record.email, is_active=True).exists():
                SecurityEventLogger.log_invitation_activation_failed(
                    email=invite_record.email,
                    reason="user_already_exists",
                    token_prefix=token_prefix,
                )
                return InvitationErrorHandler.handle_user_already_exists(
                    invite_record.email
                )

            # Generate a temporary password guaranteed to satisfy the password
            # policy (>=1 letter, >=1 digit, >=1 special, length >= MIN_LENGTH).
            # Building from each required class avoids a rare random password
            # that lacks a digit/special and would otherwise fail validation.
            specials = "!@#$%^&*"
            required = [
                secrets.choice(string.ascii_letters),
                secrets.choice(string.digits),
                secrets.choice(specials),
            ]
            pool = string.ascii_letters + string.digits + specials
            remaining = [secrets.choice(pool) for _ in range(11)]  # total length 14
            password_chars = required + remaining
            secrets.SystemRandom().shuffle(password_chars)
            temp_password = "".join(password_chars)

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

            # Create user account from stored external data (or reactivate
            # a previously soft-deleted user with the same email).
            external_data = invite_record.external_user_data
            existing_deleted = User.objects.filter(
                email=invite_record.email, is_active=False
            ).first()

            if existing_deleted:
                # Reactivate deactivated user
                user = existing_deleted
                user.is_active = True
                user.given_names = external_data.get("given_name", "")
                user.last_name = external_data.get("surname", "")
                user.role = invite_record.role
                user.is_staff = invite_record.is_staff
                user.set_password(temp_password)
                user.employee_id = external_data.get("employee_id")
                user.it_asset_id = external_data.get("id")
                user.invited_by = invite_record.invited_by
                user.password_last_changed = None
                user.save()
            else:
                user = User.objects.create_user(
                    email=invite_record.email,
                    given_names=external_data.get("given_name", ""),
                    last_name=external_data.get("surname", ""),
                    role=invite_record.role,
                    is_staff=invite_record.is_staff,
                    password=temp_password,
                    employee_id=external_data.get("employee_id"),
                    it_asset_id=external_data.get("id"),
                    invited_by=invite_record.invited_by,
                    invitation_accepted_at=timezone.now(),
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


class InviteListView(APIView):
    """
    GET: List all invitations (admin/staff only).
    Returns pending, used, and expired invitations for management.
    """

    permission_classes = [HasAppAccess]

    def get(self, request):
        if not (request.user.is_staff or request.user.is_superuser):
            from rest_framework.exceptions import PermissionDenied

            raise PermissionDenied("Only administrators can view invitations.")

        invites = InviteRecord.objects.select_related("invited_by").all()

        data = []
        for invite in invites:
            data.append(
                {
                    "id": invite.id,
                    "email": invite.email,
                    "role": invite.role,
                    "role_display": dict(User.RoleChoices.choices).get(
                        invite.role, invite.role
                    ),
                    "invited_by": {
                        "id": invite.invited_by.id,
                        "email": invite.invited_by.email,
                        "full_name": invite.invited_by.full_name,
                    },
                    "created_at": invite.created_at.isoformat(),
                    "expires_at": invite.expires_at.isoformat(),
                    "is_valid": invite.is_valid,
                    "is_used": invite.is_used,
                    "used_at": invite.used_at.isoformat() if invite.used_at else None,
                    "is_expired": invite.is_expired,
                    "status": (
                        "used"
                        if invite.is_used
                        else (
                            "expired"
                            if invite.is_expired
                            else ("revoked" if not invite.is_valid else "pending")
                        )
                    ),
                }
            )

        return Response(data, status=HTTP_200_OK)


class InviteRevokeView(APIView):
    """
    POST: Revoke a pending invitation (admin/staff only).
    Sets is_valid=False so the token can no longer be used.
    """

    permission_classes = [HasAppAccess]

    def post(self, request, pk):
        from rest_framework.exceptions import NotFound, PermissionDenied

        if not (request.user.is_staff or request.user.is_superuser):
            raise PermissionDenied("Only administrators can revoke invitations.")

        try:
            invite = InviteRecord.objects.get(pk=pk)
        except InviteRecord.DoesNotExist:
            raise NotFound("Invitation not found.")

        if invite.is_used:
            return Response(
                {"error": "Cannot revoke an invitation that has already been used."},
                status=HTTP_400_BAD_REQUEST,
            )

        invite.is_valid = False
        invite.save(update_fields=["is_valid"])

        logger.info(
            f"Invitation {invite.id} for {invite.email} revoked by "
            f"{request.user.email}"
        )

        return Response(
            {"success": True, "message": f"Invitation for {invite.email} revoked."},
            status=HTTP_200_OK,
        )
