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
    HTTP_500_INTERNAL_SERVER_ERROR,
)

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

        # Search by name or email
        search = self.request.query_params.get("search")
        if search:
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


# endregion
