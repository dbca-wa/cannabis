"""
User CRUD views: list, detail, export, CSV export, and admin password reset.
"""

import csv
import io
import json
import logging

from django.conf import settings
from django.contrib.auth import get_user_model
from django.db.models import Count, Q
from django.http import HttpResponse, StreamingHttpResponse
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.generics import ListCreateAPIView, RetrieveUpdateAPIView
from rest_framework.permissions import IsAdminUser, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from common.logging import describe_user
from common.permissions import NotInPracticeMode

from ..permissions import HasAppAccess
from ..serializers import (
    UserCreateSerializer,
    UserJWTObjectSerializer,
    UserTinySerializer,
)

logger = logging.getLogger(__name__)

User = get_user_model()


# ============================================================================
# region USER MANAGEMENT VIEWS (Admin operations and listing)
# ============================================================================


class UserListView(ListCreateAPIView):
    """
    GET: List all users (with pagination, filtering, search)
    POST: Create new user (admin only)
    """

    queryset = User.objects.all().order_by("-date_joined")
    serializer_class = UserTinySerializer
    permission_classes = [HasAppAccess]

    def get_permissions(self):
        """Different permissions for different actions"""
        if self.request.method == "POST":
            return [IsAdminUser(), NotInPracticeMode()]
        else:
            return [HasAppAccess()]

    def get_serializer_class(self):
        """Use different serializers for different actions"""
        if self.request.method == "POST":
            return UserCreateSerializer
        return UserTinySerializer

    def get_queryset(self):
        """Add filtering and search capabilities"""
        queryset = super().get_queryset()

        # Annotate with total cases count (botanist + finance)
        queryset = queryset.annotate(
            cases_count=Count("botanist_cases", distinct=True)
            + Count("finance_cases", distinct=True)
        )

        # Filter by role
        role = self.request.query_params.get("role")
        if role:
            queryset = queryset.filter(role=role)

        # Exclude legacy users from role-filtered results by default.
        # Pass ?include_legacy=true to override (e.g. admin views).
        include_legacy = self.request.query_params.get("include_legacy")
        if role and not include_legacy:
            queryset = queryset.filter(is_legacy=False)

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
                pass

        # Search by name or email (case-insensitive partial match)
        search = self.request.query_params.get("search")
        if search and search.strip():
            search = search.strip()
            queryset = queryset.filter(
                Q(given_names__icontains=search)
                | Q(last_name__icontains=search)
                | Q(email__icontains=search)
            )

        return queryset

    def perform_create(self, serializer):
        user = serializer.save()
        settings.LOGGER.info(
            f"{describe_user(self.request.user)} created user " f"{describe_user(user)}"
        )


class UserDetailView(RetrieveUpdateAPIView):
    """
    GET: Get user details (full info except sensitive data)
    PUT/PATCH: Update user (admin only, or self with restrictions)

    Users are never deleted through the app, by anyone: deleting a person
    would strip them from the cases they worked on. Deactivate them instead.
    A superuser can still delete an account through Django admin or code.
    """

    queryset = User.objects.all()
    serializer_class = UserJWTObjectSerializer
    permission_classes = [HasAppAccess]
    lookup_field = "pk"

    def get_permissions(self):
        """Different permissions for different actions"""
        if self.request.method in ["PUT", "PATCH"]:
            # Staff accounts are real and have no practice copy.
            return [HasAppAccess(), NotInPracticeMode()]
        else:
            return [HasAppAccess()]

    def check_object_permissions(self, request, obj):
        """Custom permission logic"""
        super().check_object_permissions(request, obj)

        # For modifications, only allow admin or self
        if request.method in ["PUT", "PATCH"]:
            if not (request.user.is_staff or request.user == obj):
                self.permission_denied(request, "You can only modify your own profile")

    def delete(self, request, *args, **kwargs):
        """Refuse: users are deactivated, never deleted, in the app."""
        raise PermissionDenied(
            "Users cannot be deleted in the app. Deactivate the account instead."
        )

    # Fields that decide what a user can do or who they are. Only an
    # administrator changes them, and never on their own account for the
    # access flags (matching the promote/demote endpoint).
    ADMIN_ONLY_FIELDS = (
        "role",
        "email",
        "it_asset_id",
        "employee_id",
        "is_staff",
        "is_superuser",
        "is_active",
        "is_legacy",
    )
    NOT_ON_SELF_FIELDS = ("is_staff", "is_superuser", "is_active")

    def _check_access_changes(self, serializer):
        """Refuse any change to a user's access the requester may not make.

        Sending a field with its current value is not a change, so a form that
        posts every field back still saves.
        """
        user = self.request.user
        target = serializer.instance
        changed = {
            field
            for field in self.ADMIN_ONLY_FIELDS
            if field in serializer.validated_data
            and serializer.validated_data[field] != getattr(target, field)
        }
        if not changed:
            return
        is_admin = user.is_staff or user.is_superuser
        if not is_admin:
            self.permission_denied(
                self.request,
                "Only an administrator can change a user's role, email or access.",
            )
        if user.pk == target.pk and changed & set(self.NOT_ON_SELF_FIELDS):
            self.permission_denied(
                self.request,
                "You cannot change your own admin, superuser or active status.",
            )
        if "is_superuser" in changed and not user.is_superuser:
            self.permission_denied(
                self.request, "Only a superuser can grant or remove superuser."
            )

    def perform_update(self, serializer):
        """Custom update logic"""
        self._check_access_changes(serializer)
        settings.LOGGER.info(
            f"{describe_user(self.request.user)} updated user "
            f"{describe_user(serializer.instance)}"
        )
        serializer.save()


class UserExportView(APIView):
    """
    Export users data in CSV or JSON format
    Supports filtering and bypasses pagination for full dataset exports
    """

    permission_classes = [HasAppAccess]

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

        # Search by name or email
        search = self.request.query_params.get("search")
        if search and search.strip():
            search = search.strip()
            queryset = queryset.filter(
                Q(given_names__icontains=search)
                | Q(last_name__icontains=search)
                | Q(email__icontains=search)
            )

        # Dynamic ordering
        ordering = self.request.query_params.get("ordering", "-date_joined")
        valid_orderings = {
            "id": "id",
            "-id": "-id",
            "given_names": "given_names",
            "-given_names": "-given_names",
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
        export_format = request.query_params.get("export_format", "csv").lower()

        if export_format not in ["csv", "json"]:
            raise ValidationError(
                {"format": ["Invalid format. Supported formats: csv, json."]}
            )

        queryset = self.get_queryset()

        # Check if dataset is too large (safety limit)
        max_export_limit = getattr(settings, "MAX_EXPORT_LIMIT", 10000)
        total_count = queryset.count()

        if total_count > max_export_limit:
            raise ValidationError(
                f"Dataset too large for export. Maximum {max_export_limit} "
                f"records allowed. Total: {total_count}."
            )

        settings.LOGGER.info(
            f"{describe_user(request.user)} exported users as {export_format}"
        )

        # Use streaming response for large datasets
        if total_count > 1000:
            if export_format == "csv":
                return self._stream_csv_response(queryset)
            return self._stream_json_response(queryset)

        if export_format == "csv":
            return self._csv_response(queryset)
        return self._json_response(queryset)

    def _csv_response(self, queryset):
        """Generate CSV response for smaller datasets"""
        output = io.StringIO()
        writer = csv.writer(output)

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

        for user in queryset:
            writer.writerow(
                [
                    user.id,
                    user.given_names,
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
        return response

    def _json_response(self, queryset):
        """Generate JSON response for smaller datasets"""
        serializer = UserTinySerializer(queryset, many=True)
        data = {"count": queryset.count(), "results": serializer.data}

        response = HttpResponse(
            json.dumps(data, indent=2), content_type="application/json"
        )
        response["Content-Disposition"] = 'attachment; filename="users_export.json"'
        return response

    def _stream_csv_response(self, queryset):
        """Generate streaming CSV response for large datasets"""

        def csv_generator():
            output = io.StringIO()
            writer = csv.writer(output)

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

            chunk_size = 100
            for i in range(0, queryset.count(), chunk_size):
                chunk = queryset[i : i + chunk_size]
                for user in chunk:
                    writer.writerow(
                        [
                            user.id,
                            user.given_names,
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
        return response


class UserCSVExportView(APIView):
    """
    CSV-only export view to bypass routing issues
    """

    permission_classes = [HasAppAccess]

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
                Q(given_names__icontains=search)
                | Q(last_name__icontains=search)
                | Q(email__icontains=search)
                | Q(employee_id__icontains=search)
            )

        # Dynamic ordering
        ordering = self.request.query_params.get("ordering", "-date_joined")
        valid_orderings = {
            "given_names": "given_names",
            "-given_names": "-given_names",
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
        queryset = self.get_queryset()
        total_count = queryset.count()

        output = io.StringIO()
        writer = csv.writer(output)

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

        for user in queryset:
            writer.writerow(
                [
                    user.id,
                    user.given_names,
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
            f"{describe_user(request.user)} exported {total_count} users as csv"
        )
        return response


class AdminSendResetEmailView(APIView):
    """POST: Admin-only — send a password reset email to a user.

    Clears any existing reset codes/timeouts and sends a fresh one
    so the user can reset their password immediately.
    """

    permission_classes = [IsAuthenticated, NotInPracticeMode]

    def post(self, request, pk):
        from urllib.parse import urlencode

        from common.models import SystemSettings
        from common.services import EmailService
        from common.utils import get_frontend_url

        from ..models import PasswordResetCode
        from ..services import PasswordResetCodeService

        # Admin only
        if not (request.user.is_superuser or request.user.is_staff):
            return Response(
                {"detail": "Only administrators can send reset emails."},
                status=403,
            )

        try:
            target_user = User.objects.get(pk=pk, is_active=True)
        except User.DoesNotExist:
            return Response({"detail": "User not found."}, status=404)

        # Clear any existing reset codes for this user
        PasswordResetCode.objects.filter(user=target_user).delete()

        # Generate a fresh reset code
        reset_code = PasswordResetCodeService.generate_reset_code(target_user)
        plain_code = reset_code._plain_code

        # Build the reset page URL
        reset_page_url = get_frontend_url(
            f"/auth/reset-code?{urlencode({'email': target_user.email})}"
        )

        # Prepare email context
        context = {
            "user": target_user,
            "reset_code": plain_code,
            "frontend_url": reset_page_url,
            "site_name": "Cannabis Management System",
            "expires_at": reset_code.expires_at,
            "max_attempts": reset_code.max_attempts,
        }

        # Determine recipient based on system settings
        system_settings = SystemSettings.load()
        if system_settings.send_emails_to_self:
            recipient_list = [system_settings.forward_certificate_emails_to]
        else:
            recipient_list = [target_user.email]

        # Send the email
        EmailService.send_template_email(
            template_name="emails/password_reset_email.html",
            recipient_email=recipient_list,
            subject="Password Reset Code - Cannabis Management System",
            context=context,
        )

        redirected = (
            f" (sent to {recipient_list[0]} instead)"
            if recipient_list != [target_user.email]
            else ""
        )
        settings.LOGGER.info(
            f"{describe_user(request.user)} sent a password reset code to "
            f"{describe_user(target_user)}{redirected}"
        )

        return Response(
            {
                "success": True,
                "message": f"Password reset email sent to {target_user.email}.",
            },
            status=200,
        )


class UserAdminStatusView(APIView):
    """
    PATCH: Promote or demote a user's admin status.
    Only admins (is_staff or is_superuser) can use this endpoint.
    An admin cannot change their own admin status.
    """

    permission_classes = [IsAuthenticated, NotInPracticeMode]

    def patch(self, request, pk):
        # Only admins can promote/demote
        if not (request.user.is_staff or request.user.is_superuser):
            return Response(
                {"detail": "Only administrators can promote or demote users."},
                status=403,
            )

        # Cannot change own admin status
        if request.user.pk == pk:
            return Response(
                {"detail": "You cannot change your own admin status."},
                status=400,
            )

        try:
            target_user = User.objects.get(pk=pk)
        except User.DoesNotExist:
            return Response({"detail": "User not found."}, status=404)

        action = request.data.get("action")
        if action not in ("promote", "demote"):
            return Response(
                {"detail": "Action must be 'promote' or 'demote'."},
                status=400,
            )

        if action == "promote":
            target_user.is_staff = True
            target_user.save(update_fields=["is_staff"])
            logger.info(
                f"{describe_user(request.user)} promoted {target_user.email} "
                f"to admin"
            )
            return Response(
                {
                    "success": True,
                    "message": f"{target_user.full_name} has been promoted to admin.",
                    "is_staff": True,
                },
                status=200,
            )
        else:
            target_user.is_staff = False
            target_user.save(update_fields=["is_staff"])
            logger.info(
                f"{describe_user(request.user)} demoted {target_user.email} "
                f"from admin"
            )
            return Response(
                {
                    "success": True,
                    "message": f"{target_user.full_name} has been demoted from admin.",
                    "is_staff": False,
                },
                status=200,
            )


# endregion
