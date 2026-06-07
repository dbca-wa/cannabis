"""Users permissions."""

from .role_permissions import IsAdminUser, IsStaffOrSuperuser

__all__ = [
    "IsAdminUser",
    "IsStaffOrSuperuser",
]
