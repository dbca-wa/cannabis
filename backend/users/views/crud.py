"""
User CRUD views: list, detail, export, and CSV export.
"""

import csv
import io
import json
import logging

from django.conf import settings
from django.contrib.auth import get_user_model
from django.db.models import Count, Q
from django.http import HttpResponse, StreamingHttpResponse
from rest_framework.exceptions import ValidationError
from rest_framework.generics import ListCreateAPIView, RetrieveUpdateDestroyAPIView
from rest_framework.permissions import IsAdminUser
from rest_framework.views import APIView

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
            return [IsAdminUser()]
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


class UserDetailView(RetrieveUpdateDestroyAPIView):
    """
    GET: Get user details (full info except sensitive data)
    PUT/PATCH: Update user (admin only, or self with restrictions)
    DELETE: Delete user (admin only)
    """

    queryset = User.objects.all()
    serializer_class = UserJWTObjectSerializer
    permission_classes = [HasAppAccess]
    lookup_field = "pk"

    def get_permissions(self):
        """Different permissions for different actions"""
        if self.request.method in ["PUT", "PATCH", "DELETE"]:
            return [HasAppAccess()]
        else:
            return [HasAppAccess()]

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
        # Only users with app access (roled or admin) may change a role. This
        # blocks a roleless user from escalating their own role via self-update.
        new_role = serializer.validated_data.get("role")
        if new_role is not None and new_role != serializer.instance.role:
            if not self.request.user.has_app_access:
                self.permission_denied(
                    self.request,
                    "You do not have permission to change a user's role.",
                )
        settings.LOGGER.info(
            f"User {self.request.user} updated user {serializer.instance}"
        )
        serializer.save()

    def perform_destroy(self, instance):
        """Delete user permanently."""
        settings.LOGGER.warning(f"User {self.request.user} deleted user {instance}")
        instance.delete()


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
        settings.LOGGER.info("=== USER EXPORT VIEW CALLED ===")
        settings.LOGGER.info(f"User: {request.user}")
        settings.LOGGER.info(f"Path: {request.path}")
        settings.LOGGER.info(f"Query params: {dict(request.query_params)}")
        settings.LOGGER.info(f"Method: {request.method}")
        settings.LOGGER.info(f"Headers: {dict(request.headers)}")

        export_format = request.query_params.get("export_format", "csv").lower()
        settings.LOGGER.info(f"Export format: {export_format}")

        if export_format == "csv":
            settings.LOGGER.error("CSV EXPORT REQUESTED - VIEW IS BEING CALLED")
        else:
            settings.LOGGER.error(f"NON-CSV EXPORT REQUESTED: {export_format}")

        # Force CSV to work by bypassing format validation
        if export_format == "csv":
            settings.LOGGER.info("FORCING CSV EXPORT")
            try:
                queryset = self.get_queryset()
                total_count = queryset.count()
                settings.LOGGER.info(f"CSV: Got {total_count} users")

                output = io.StringIO()
                writer = csv.writer(output)

                writer.writerow(["ID", "First Name", "Last Name", "Email"])
                for user in queryset[:10]:
                    writer.writerow(
                        [user.id, user.given_names, user.last_name, user.email]
                    )

                response = HttpResponse(output.getvalue(), content_type="text/csv")
                response["Content-Disposition"] = (
                    'attachment; filename="users_test.csv"'
                )
                settings.LOGGER.info("CSV response created successfully")
                return response
            except Exception as e:
                settings.LOGGER.error(f"CSV generation failed: {str(e)}")
                raise

        if export_format not in ["csv", "json"]:
            raise ValidationError(
                {"format": ["Invalid format. Supported formats: csv, json."]}
            )

        try:
            queryset = self.get_queryset()

            # Check if dataset is too large (safety limit)
            max_export_limit = getattr(settings, "MAX_EXPORT_LIMIT", 10000)
            total_count = queryset.count()

            if total_count > max_export_limit:
                raise ValidationError(
                    f"Dataset too large for export. Maximum {max_export_limit} records allowed. Total: {total_count}."
                )

            # Use streaming response for large datasets
            if total_count > 1000:
                settings.LOGGER.info(
                    f"Using streaming response for {total_count} records"
                )
                if export_format == "csv":
                    return self._stream_csv_response(queryset)
                else:
                    return self._stream_json_response(queryset)
            else:
                settings.LOGGER.info(
                    f"Using regular response for {total_count} records"
                )
                if export_format == "csv":
                    return self._csv_response(queryset)
                else:
                    return self._json_response(queryset)

        except Exception as e:
            settings.LOGGER.error(f"Export error: {str(e)}")
            raise

    def _csv_response(self, queryset):
        """Generate CSV response for smaller datasets"""
        settings.LOGGER.error("_csv_response METHOD CALLED - STARTING CSV GENERATION")
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
        settings.LOGGER.info("CSV-ONLY EXPORT VIEW CALLED")
        settings.LOGGER.info(f"User: {request.user}")
        settings.LOGGER.info(f"Path: {request.path}")

        try:
            queryset = self.get_queryset()
            total_count = queryset.count()

            settings.LOGGER.info(f"Exporting {total_count} users as CSV")

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

            settings.LOGGER.info(f"CSV export successful: {total_count} users")
            return response

        except Exception as e:
            settings.LOGGER.error(f"CSV export failed: {str(e)}")
            raise


# endregion
