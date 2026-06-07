"""
Users views package.

Re-exports all views for backward compatibility with existing imports.
"""

from .auth import (
    CustomTokenObtainPairSerializer,
    CustomTokenObtainPairView,
    ForgotPasswordView,
    JWTLogoutView,
    PasswordResetView,
    PasswordUpdateView,
    PasswordValidationView,
    VerifyResetCodeView,
    WhoAmI,
)
from .crud import (
    SimpleCSVTestView,
    UserCSVExportView,
    UserDetailView,
    UserExportView,
    UserListView,
)
from .invitations import (
    ExternalUserSearchView,
    InviteActivationView,
    InviteUserView,
)
from .preferences import (
    UserPreferencesView,
    UserProfileView,
)

__all__ = [
    # Auth
    "CustomTokenObtainPairSerializer",
    "CustomTokenObtainPairView",
    "JWTLogoutView",
    "WhoAmI",
    "PasswordValidationView",
    "ForgotPasswordView",
    "VerifyResetCodeView",
    "PasswordResetView",
    "PasswordUpdateView",
    # CRUD
    "UserListView",
    "UserDetailView",
    "UserExportView",
    "UserCSVExportView",
    "SimpleCSVTestView",
    # Invitations
    "ExternalUserSearchView",
    "InviteUserView",
    "InviteActivationView",
    # Preferences
    "UserProfileView",
    "UserPreferencesView",
]
