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


def is_admin(user) -> bool:
    """True for staff members or superusers."""
    return bool(
        getattr(user, "is_authenticated", False)
        and (user.is_staff or user.is_superuser)
    )


def ensure_case_editable(case, user) -> None:
    """Guard against edits to a fully-complete case.

    A case whose derived status is Complete (every form complete) is read-only
    for everyone except admins (staff/superuser). This keeps a finished case's
    base data frozen for non-admins; individual form edits are guarded
    separately by ensure_form_editable.

    Raises:
        PermissionDenied: If the case is complete and the user is not an admin.
    """
    from rest_framework.exceptions import PermissionDenied

    # Imported here to avoid a circular import at module load.
    from ..models import Case

    if case.derived_status == Case.PhaseChoices.COMPLETE and not is_admin(user):
        raise PermissionDenied("This case is complete and can no longer be edited.")


def ensure_form_editable(form, user) -> None:
    """Guard against edits to a completed Priority 3 form.

    A form whose certificate is complete (the Complete phase) is read-only for
    everyone except admins (staff/superuser). This keeps completed certificates
    frozen for non-admin users while still allowing new forms to be added to the
    same case.

    Raises:
        PermissionDenied: If the form is complete and the user is not an admin.
    """
    from rest_framework.exceptions import PermissionDenied

    # Imported here to avoid a circular import at module load.
    from ..models import Case

    if form.phase == Case.PhaseChoices.COMPLETE and not is_admin(user):
        raise PermissionDenied(
            "This form's certificate is complete and can no longer be edited."
        )
