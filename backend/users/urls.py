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
    # User invitation
    path(
        "invite/",
        views.InviteUserView.as_view(),
        name="invite_user",
    ),
    # User management endpoints (admin/staff operations)
    path("", views.UserListView.as_view(), name="user_list"),  # GET, POST
    path(
        "<int:pk>/", views.UserDetailView.as_view(), name="user_detail"
    ),  # GET, PUT, DELETE
]
