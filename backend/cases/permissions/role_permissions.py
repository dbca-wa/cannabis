"""Role-based permission classes for the cases app."""

from rest_framework.permissions import BasePermission


class IsApprovedBotanist(BasePermission):
    """Allow access only to authenticated users with the Approved Botanist role."""

    message = "Only Approved Botanists can perform this action."

    def has_permission(self, request, view):
        return request.user.is_authenticated and request.user.role == "botanist"


class IsFinanceOfficer(BasePermission):
    """Allow access only to authenticated users with the Finance Officer role."""

    message = "Only Finance Officers can perform this action."

    def has_permission(self, request, view):
        return request.user.is_authenticated and request.user.role == "finance"


class IsStaffOrAdmin(BasePermission):
    """Allow access to staff members or superusers."""

    message = "Only staff or admin users can perform this action."

    def has_permission(self, request, view):
        return request.user.is_authenticated and (
            request.user.is_staff or request.user.is_superuser
        )


class IsBotanistOrStaff(BasePermission):
    """Allow access to Approved Botanists or staff members."""

    message = "Only Approved Botanists or staff can perform this action."

    def has_permission(self, request, view):
        return request.user.is_authenticated and (
            request.user.role == "botanist" or request.user.is_staff
        )
