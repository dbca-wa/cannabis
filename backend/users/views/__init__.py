"""
Users views package.

Re-exports all views for backward compatibility with existing imports.
"""

from .auth import (
    CustomTokenObtainPairSerializer,
    CustomTokenObtainPairView,
    ForgotPasswordView,
    JWTLogoutView,
    PasswordUpdateView,
    PasswordValidationView,
    VerifyResetCodeView,
    WhoAmI,
)
from .crud import (
    UserCSVExportView,
    UserDetailView,
    UserExportView,
    UserListView,
)
from .invitations import (
    ExternalUserSearchView,
    InviteActivationView,
    InviteUserView,
    TestInviteEmailView,
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
    "PasswordUpdateView",
    # CRUD
    "UserListView",
    "UserDetailView",
    "UserExportView",
    "UserCSVExportView",
    # Invitations
    "ExternalUserSearchView",
    "InviteUserView",
    "InviteActivationView",
    "TestInviteEmailView",
    # Preferences
    "UserProfileView",
    "UserPreferencesView",
]
