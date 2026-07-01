from django.urls import path
from rest_framework_simplejwt.views import TokenRefreshView

from . import views

urlpatterns = [
    # CRITICAL: Export endpoints FIRST to avoid conflicts
    path("export", views.UserExportView.as_view(), name="user_export"),
    # Authentication endpoints
    path("auth/login", views.CustomTokenObtainPairView.as_view(), name="login"),
    path("auth/refresh", TokenRefreshView.as_view(), name="token_refresh"),
    path("auth/logout", views.JWTLogoutView.as_view(), name="logout"),
    # Current user endpoints (self-management)
    path("whoami", views.WhoAmI.as_view(), name="whoami"),
    path("profile", views.UserProfileView.as_view(), name="profile"),
    path("preferences", views.UserPreferencesView.as_view(), name="preferences"),
    # External user search (for invitations)
    path(
        "external-search",
        views.ExternalUserSearchView.as_view(),
        name="external_user_search",
    ),
    # Password validation
    path(
        "validate-password",
        views.PasswordValidationView.as_view(),
        name="validate_password",
    ),
    # Password reset
    path(
        "auth/forgot-password",
        views.ForgotPasswordView.as_view(),
        name="forgot_password",
    ),
    path(
        "auth/verify-reset-code",
        views.VerifyResetCodeView.as_view(),
        name="verify_reset_code",
    ),
    # Password update
    path(
        "auth/update-password",
        views.PasswordUpdateView.as_view(),
        name="update_password",
    ),
    # User invitation
    path(
        "invite",
        views.InviteUserView.as_view(),
        name="invite_user",
    ),
    # Test invitation email (renders + sends a live invite without records)
    path(
        "auth/test-invite-email",
        views.TestInviteEmailView.as_view(),
        name="test_invite_email",
    ),
    # Invitation activation
    path(
        "auth/activate-invite/<str:token>",
        views.InviteActivationView.as_view(),
        name="activate_invite",
    ),
    # User management endpoints (admin/staff operations)
    path("list", views.UserListView.as_view(), name="user_list"),
    path("<int:pk>", views.UserDetailView.as_view(), name="user_detail"),
]
