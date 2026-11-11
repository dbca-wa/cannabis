"""Common permissions."""

from rest_framework.permissions import SAFE_METHODS, BasePermission

from common.practice import is_in_practice_mode

PRACTICE_MODE_BLOCKED = (
    "You are in practice mode, and this would change real data that everyone "
    "uses. Leave practice mode to make this change."
)


class NotInPracticeMode(BasePermission):
    """Refuse changes to shared, real data while the user is in practice mode.

    Practice mode isolates cases, forms, bags, certificates, batches, officers,
    stations and defendants. Some data has no practice copy: system settings,
    Section C templates, staff accounts and invitations. A change to those is
    real and affects everyone, which practice mode promises never happens, so
    it is refused until the user leaves practice mode. Reading is allowed.
    """

    message = PRACTICE_MODE_BLOCKED

    def has_permission(self, request, view):
        if request.method in SAFE_METHODS:
            return True
        return not is_in_practice_mode(request.user)


__all__: list[str] = ["NotInPracticeMode", "PRACTICE_MODE_BLOCKED"]
