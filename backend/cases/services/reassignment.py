"""Shared rules for deleting an officer, station or defendant that cases use.

A record that cases still name is never deleted on its own, because that would
leave those cases with missing data. The user is shown which cases use it and
chooses a replacement; the cases are moved to the replacement and the record is
then deleted. The police and defendant services own the details for their own
records and use these helpers for the parts they share.
"""

from rest_framework.exceptions import PermissionDenied, ValidationError

from ..models import Case
from ..permissions import is_admin

# How many case references to name in a message before summarising the rest.
_NAMED_IN_MESSAGE = 5


def case_references(cases):
    """Case references for a message, e.g. "IR 1, IR 2 and 3 more"."""
    numbers = [c.case_number or f"#{c.pk}" for c in cases]
    shown = ", ".join(numbers[:_NAMED_IN_MESSAGE])
    hidden = len(numbers) - _NAMED_IN_MESSAGE
    return f"{shown} and {hidden} more" if hidden > 0 else shown


def describe_case(case, roles):
    """One affected case as the delete dialog shows it."""
    status = case.derived_status
    return {
        "id": case.pk,
        "case_number": case.case_number,
        "roles": roles,
        "status": status,
        "status_display": Case.PhaseChoices(status).label,
        "is_complete": status == Case.PhaseChoices.COMPLETE,
    }


def require_replacement(name, cases, replacement, noun):
    """Refuse to delete a record that cases use when no replacement is given.

    Args:
        name: How the record is named in the message.
        cases: The cases that use it.
        replacement: The record chosen to take its place, or None.
        noun: "officer", "station" or "defendant".
    """
    if cases and replacement is None:
        count = len(cases)
        raise ValidationError(
            {
                "replacement": (
                    f"{name} is on {count} case{'s' if count != 1 else ''}. "
                    f"Choose another {noun} to put on "
                    f"{'them' if count != 1 else 'it'} before deleting."
                )
            }
        )


def ensure_cases_changeable(cases, user):
    """Only an administrator may change a complete case, as on the case page."""
    if is_admin(user):
        return
    complete = [c for c in cases if c.derived_status == Case.PhaseChoices.COMPLETE]
    if complete:
        raise PermissionDenied(
            f"Some of these cases are complete ({case_references(complete)}), "
            "so only an administrator can change them."
        )


def check_replacement(record, replacement, noun):
    """The replacement must be a different record."""
    if replacement is not None and replacement.pk == record.pk:
        raise ValidationError(
            {"replacement": f"Choose a different {noun} to replace this one with."}
        )


def replacement_from_request(request, queryset, noun):
    """The replacement named by the request's ``replacement`` query value.

    Returns None when none is given. The queryset is the model's default
    manager, so in practice mode only the user's practice records can be
    chosen, as everywhere else.
    """
    raw = request.query_params.get("replacement")
    if raw in (None, ""):
        return None
    try:
        return queryset.get(pk=int(raw))
    except (ValueError, TypeError, queryset.model.DoesNotExist):
        raise ValidationError(
            {"replacement": f"The {noun} chosen as a replacement was not found."}
        )
