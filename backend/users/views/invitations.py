"""
Invitation views: external user search, invite user, and invitation activation.
"""

import logging
import secrets
import string

from django.conf import settings
from django.contrib.auth import get_user_model
from django.db import transaction
from django.utils import timezone
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.status import (
    HTTP_200_OK,
    HTTP_201_CREATED,
    HTTP_400_BAD_REQUEST,
)
from rest_framework.views import APIView

from common.logging import describe_user
from common.permissions import NotInPracticeMode

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
    Search external IT Assets API for users not already in the system.
    Used for user invitations.

    Caches the full IT Assets user list for 5 minutes to avoid repeated
    API calls on every keystroke. Filtering is done locally with word-token
    matching so queries like "ben rich" match "Ben Richardson".
    """

    permission_classes = [HasAppAccess]

    def get(self, request):
        """Search external users by query parameter"""

        query = request.query_params.get("search", "").strip()

        if not query or len(query) < 2:
            return Response(
                {"results": [], "message": "Query must be at least 2 characters"},
                status=HTTP_200_OK,
            )

        # Full directory list, cached for five minutes by the service.
        from ..services.staff_accounts import (
            directory_person,
            fetch_directory_users,
        )

        external_users = fetch_directory_users()

        # Get existing user emails to exclude (only active users)
        existing_emails = set(
            User.objects.filter(is_active=True).values_list("email", flat=True)
        )

        # Tokenise search query for word-level matching
        query_tokens = query.lower().split()

        # Filter and format results
        filtered_results = []
        for user in external_users:
            email = user.get("email", "").lower()

            # Skip if user already exists in our system
            if email in existing_emails:
                continue

            person = directory_person(user)
            # Every query token must appear in the name, the directory's
            # combined name field or the email.
            searchable = (
                f"{person['full_name']} {user.get('name', '') or ''} {email}".lower()
            )
            if not all(token in searchable for token in query_tokens):
                continue
            filtered_results.append(person)

        # Return top 10 results
        return Response({"results": filtered_results[:10]}, status=HTTP_200_OK)


# endregion


# ============================================================================
# region USER INVITATION SYSTEM
# ============================================================================


class InviteUserView(APIView):
    """
    POST: Send invitation to external user
    Creates invitation record and sends invitation email with activation link
    """

    permission_classes = [HasAppAccess, NotInPracticeMode]

    @handle_network_errors
    def post(self, request):
        """Send invitation to external user"""

        from django.utils import timezone

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

        from ..services.staff_accounts import send_invitation

        try:
            invite_record, _, _ = send_invitation(
                {**external_user_data, "email": email},
                role,
                bool(invite_as_admin),
                request.user,
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
            # send_invitation removes the invitation when the email fails.
            return InvitationErrorHandler.handle_email_send_failed(email, e)


class TestInviteEmailView(APIView):
    """
    POST: Send a live invitation email for testing/preview purposes.

    Renders and sends the real invitation email to a chosen address with a
    chosen role, WITHOUT creating an InviteRecord or User. Staff/superuser only.
    Sends directly to the provided address so the tester controls the recipient.
    """

    permission_classes = [HasAppAccess, NotInPracticeMode]

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

        settings.LOGGER.info(
            f"{describe_user(request.user)} sent a test invitation email to "
            f"{email} (role {role})"
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
    GET: Check an invitation link and describe the invitation. It changes
        nothing, so opening the link (or a mail scanner opening it) never uses
        the invitation up.
    POST: Accept the invitation: create the account and sign the person in.
        Sent when the person clicks to set up their password.
    """

    permission_classes = [AllowAny]

    @staticmethod
    def _refusal(invite_record, token_prefix):
        """Why this invitation cannot be accepted, as a response, or None."""
        if not invite_record.is_active:
            if invite_record.is_used:
                reason = "already_used"
            elif invite_record.is_expired:
                reason = "expired"
            else:
                reason = "invalid"
            return InvitationErrorHandler.handle_invalid_token(token_prefix, reason)

        # An account already exists for this email (active users only).
        if User.objects.filter(email=invite_record.email, is_active=True).exists():
            SecurityEventLogger.log_invitation_activation_failed(
                email=invite_record.email,
                reason="user_already_exists",
                token_prefix=token_prefix,
            )
            return InvitationErrorHandler.handle_user_already_exists(
                invite_record.email
            )
        return None

    def get(self, request, token):
        """Describe a usable invitation without accepting it."""
        from ..models import InviteRecord

        token_prefix = token[:8] + "..." if len(token) > 8 else token
        try:
            invite_record = InviteRecord.objects.select_related("invited_by").get(
                token=token
            )
        except InviteRecord.DoesNotExist:
            return InvitationErrorHandler.handle_invalid_token(
                token_prefix, "not_found"
            )

        refusal = self._refusal(invite_record, token_prefix)
        if refusal is not None:
            return refusal

        external_data = invite_record.external_user_data or {}
        return Response(
            {
                "email": invite_record.email,
                "given_names": external_data.get("given_name", ""),
                "last_name": external_data.get("surname", ""),
                "role": invite_record.role,
                "role_display": invite_record.get_role_display(),
                "invited_by": (
                    invite_record.invited_by.full_name
                    if invite_record.invited_by
                    else None
                ),
                "expires_at": invite_record.expires_at.isoformat(),
            },
            status=HTTP_200_OK,
        )

    def post(self, request, token):
        """Accept the invitation and create the user account."""
        from ..models import InviteRecord

        token_prefix = token[:8] + "..." if len(token) > 8 else token

        try:
            with transaction.atomic():
                # Lock the invitation so two clicks cannot both accept it.
                invite_record = (
                    InviteRecord.objects.select_for_update()
                    .select_related("invited_by")
                    .get(token=token)
                )
                refusal = self._refusal(invite_record, token_prefix)
                if refusal is not None:
                    return refusal
                return self._accept(invite_record, token_prefix)
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

    @staticmethod
    def _temporary_password():
        """A random password that always satisfies the password policy.

        Built from each required character class (letter, digit, special) so
        it never fails validation; the person replaces it straight away.
        """
        specials = "!@#$%^&*"
        required = [
            secrets.choice(string.ascii_letters),
            secrets.choice(string.digits),
            secrets.choice(specials),
        ]
        pool = string.ascii_letters + string.digits + specials
        chars = required + [secrets.choice(pool) for _ in range(11)]
        secrets.SystemRandom().shuffle(chars)
        return "".join(chars)

    def _accept(self, invite_record, token_prefix):
        """Create (or reactivate) the account and return sign-in tokens."""
        from rest_framework_simplejwt.tokens import RefreshToken

        from ..serializers import UserJWTObjectSerializer
        from ..services import PasswordValidator

        temp_password = self._temporary_password()
        is_valid, errors = PasswordValidator.validate_password(temp_password)
        if not is_valid:
            logger.error(f"Generated password failed validation: {errors}")
            SecurityEventLogger.log_invitation_activation_failed(
                email=invite_record.email,
                reason="password_generation_failed",
                token_prefix=token_prefix,
            )
            return ErrorResponseBuilder.build_internal_error_response()

        # Create the account from the stored directory details, or reactivate
        # a previously deactivated user with the same email.
        external_data = invite_record.external_user_data or {}
        user = User.objects.filter(email=invite_record.email, is_active=False).first()
        if user is None and invite_record.role == User.RoleChoices.BOTANIST:
            # The legacy import made a placeholder for a former botanist with
            # this name: it becomes their account, so their past cases stay
            # with them instead of a second account being made.
            from ..services.staff_accounts import claim_placeholder, find_placeholder

            placeholder = find_placeholder(
                external_data.get("given_name", ""), external_data.get("surname", "")
            )
            if placeholder is not None:
                user = claim_placeholder(
                    placeholder, invite_record.email, external_data
                )
        if user:
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
            user.is_legacy = False
            user.invitation_accepted_at = timezone.now()
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

        invite_record.is_used = True
        invite_record.used_at = timezone.now()
        invite_record.save(update_fields=["is_used", "used_at"])

        refresh = RefreshToken.for_user(user)
        settings.LOGGER.info(
            f"{describe_user(user)} accepted their invitation "
            f"({invite_record.pk}) from {describe_user(invite_record.invited_by)}"
        )
        return Response(
            {
                "success": True,
                "message": "Invitation activated successfully",
                "user": UserJWTObjectSerializer(user).data,
                "access": str(refresh.access_token),
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

    permission_classes = [HasAppAccess, NotInPracticeMode]

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

        settings.LOGGER.info(
            f"{describe_user(request.user)} revoked the invitation for "
            f"{invite.email} ({invite.pk})"
        )

        return Response(
            {"success": True, "message": f"Invitation for {invite.email} revoked."},
            status=HTTP_200_OK,
        )
