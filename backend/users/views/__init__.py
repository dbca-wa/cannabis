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
    AdminSendResetEmailView,
    UserCSVExportView,
    UserDetailView,
    UserExportView,
    UserListView,
)
from .invitations import (
    ExternalUserSearchView,
    InviteActivationView,
    InviteListView,
    InviteRevokeView,
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
    "AdminSendResetEmailView",
    "UserListView",
    "UserDetailView",
    "UserExportView",
    "UserCSVExportView",
    # Invitations
    "ExternalUserSearchView",
    "InviteUserView",
    "InviteActivationView",
    "InviteListView",
    "InviteRevokeView",
    "TestInviteEmailView",
    # Preferences
    "UserProfileView",
    "UserPreferencesView",
]
