"""Role-based permission classes for the users app."""

from rest_framework.permissions import BasePermission


class IsAdminUser(BasePermission):
    """Allow access only to superusers."""

    message = "Only administrators can perform this action."

    def has_permission(self, request, view):
        return request.user.is_authenticated and request.user.is_superuser


class IsStaffOrSuperuser(BasePermission):
    """Allow access to staff members or superusers."""

    message = "Only staff or admin users can perform this action."

    def has_permission(self, request, view):
        return request.user.is_authenticated and (
            request.user.is_staff or request.user.is_superuser
        )
