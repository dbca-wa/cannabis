from django.urls import path
from rest_framework_simplejwt.views import TokenRefreshView
from . import views

urlpatterns = [
    # CRITICAL: Export endpoints FIRST to avoid conflicts
    path("export/", views.UserExportView.as_view(), name="user_export"),
    path("test-export/", views.UserExportView.as_view(), name="user_test_export"),
    path("debug-export/", views.UserExportView.as_view(), name="user_debug_export"),
    path("simple-csv/", views.SimpleCSVTestView.as_view(), name="simple_csv_test"),
    # Authentication endpoints
    path("auth/login/", views.CustomTokenObtainPairView.as_view(), name="login"),
    path("auth/refresh/", TokenRefreshView.as_view(), name="token_refresh"),
    path("auth/logout/", views.JWTLogoutView.as_view(), name="logout"),
    # Current user endpoints (self-management)
    path("whoami/", views.WhoAmI.as_view(), name="whoami"),  # Quick auth check
    path(
        "profile/", views.UserProfileView.as_view(), name="profile"
    ),  # Full profile with preferences
    path(
        "preferences/", views.UserPreferencesView.as_view(), name="preferences"
    ),  # Dedicated preferences endpoint
    # External user search (for invitations)
    path(
        "external-search/",
        views.ExternalUserSearchView.as_view(),
        name="external_user_search",
    ),
    # Password validation
    path(
        "validate-password/",
        views.PasswordValidationView.as_view(),
        name="validate_password",
    ),
    # Password reset
    path(
        "auth/forgot-password/",
        views.ForgotPasswordView.as_view(),
        name="forgot_password",
    ),
    path(
        "auth/reset-password/<str:token>/",
        views.PasswordResetView.as_view(),
        name="reset_password",
    ),
    # Password update
    path(
        "auth/update-password/",
        views.PasswordUpdateView.as_view(),
        name="update_password",
    ),
    # User invitation
    path(
        "invite/",
        views.InviteUserView.as_view(),
        name="invite_user",
    ),
    # Invitation activation
    path(
        "auth/activate-invite/<str:token>/",
        views.InviteActivationView.as_view(),
        name="activate_invite",
    ),
    # User management endpoints (admin/staff operations)
    path("", views.UserListView.as_view(), name="user_list"),  # GET, POST
    path(
        "<int:pk>/", views.UserDetailView.as_view(), name="user_detail"
    ),  # GET, PUT, DELETE
]
