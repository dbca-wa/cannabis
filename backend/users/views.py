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
    HTTP_500_INTERNAL_SERVER_ERROR,
)

from django.http import HttpResponse, StreamingHttpResponse
import csv
import json
import io
import logging

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
            # Call external IT Assets API
            external_api_url = "https://itassets.dbca.wa.gov.au/api/v3/departmentuser/"
            response = requests.get(external_api_url, timeout=10)
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
# region USER INVITATION SYSTEM
# ============================================================================


class InviteUserView(APIView):
    """
    POST: Send invitation to external user
    Creates user account and sends invitation email
    """

    permission_classes = [IsAuthenticated]

    def post(self, request):
        """Send invitation to external user"""
        from django.core.mail import send_mail
        from django.template.loader import render_to_string
        from django.utils.html import strip_tags
        from django.contrib.auth.tokens import default_token_generator
        from django.utils.encoding import force_bytes
        from django.utils.http import urlsafe_base64_encode
        import secrets
        import string

        # Validate request data
        external_user_data = request.data.get("external_user_data", {})
        role = request.data.get("role", "none")
        is_staff = request.data.get("is_staff", False)
        is_active = request.data.get("is_active", True)

        if not external_user_data or not external_user_data.get("email"):
            return Response(
                {"error": "External user data with email is required"},
                status=HTTP_400_BAD_REQUEST,
            )

        email = external_user_data.get("email").lower()

        # Check if user already exists
        if User.objects.filter(email=email).exists():
            return Response(
                {"error": "User with this email already exists"},
                status=HTTP_409_CONFLICT,
            )

        # Only allow staff/admin to set staff status
        if is_staff and not request.user.is_staff:
            is_staff = False

        try:
            # Generate secure random password
            alphabet = string.ascii_letters + string.digits + "!@#$%^&*"
            password = "".join(secrets.choice(alphabet) for _ in range(12))

            # Create user account
            user = User.objects.create_user(
                email=email,
                first_name=external_user_data.get("given_name", ""),
                last_name=external_user_data.get("surname", ""),
                role=role,
                is_staff=is_staff,
                is_active=is_active,
                password=password,
                employee_id=external_user_data.get("employee_id"),
                it_asset_id=external_user_data.get("id"),
            )

            # Generate password reset token for first login
            token = default_token_generator.make_token(user)
            uid = urlsafe_base64_encode(force_bytes(user.pk))

            # Prepare email context
            context = {
                "user": user,
                "inviter": request.user,
                "temporary_password": password,
                "reset_token": token,
                "uid": uid,
                "site_name": "Cannabis Management System",
                "protocol": "https" if request.is_secure() else "http",
                "domain": request.get_host(),
            }

            # Render email templates
            subject = f'Invitation to {context["site_name"]}'
            html_message = render_to_string("users/invitation_email.html", context)
            plain_message = strip_tags(html_message)

            # Send invitation email
            send_mail(
                subject=subject,
                message=plain_message,
                html_message=html_message,
                from_email=settings.DEFAULT_FROM_EMAIL,
                recipient_list=[email],
                fail_silently=False,
            )

            # Log the invitation
            settings.LOGGER.info(
                f"User invitation sent: {request.user} invited {email} with role {role}"
            )

            # Return created user data (without password)
            from .serializers import UserJWTObjectSerializer

            serializer = UserJWTObjectSerializer(user)

            return Response(
                {"message": "Invitation sent successfully", "user": serializer.data},
                status=HTTP_201_CREATED,
            )

        except Exception as e:
            settings.LOGGER.error(f"Failed to send invitation: {str(e)}")

            # Clean up user if created but email failed
            if "user" in locals():
                user.delete()

            return Response(
                {"error": "Failed to send invitation"},
                status=HTTP_500_INTERNAL_SERVER_ERROR,
            )


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
