"""Rules for placeholder defendant names.

An unknown defendant is recorded by leaving the case's defendant list empty
(the "Defendant is unknown" button), which the certificate prints as
"UNKNOWN". A defendant record literally named "Unknown" prints as a real name
("UNKNOWN, Unknown"), so such records are rejected and hidden from selection.
"""

from django.db.models import Q

PLACEHOLDER_NAMES = frozenset({"unknown"})

PLACEHOLDER_MESSAGE = (
    'Use the "Defendant is unknown" button instead of adding a defendant '
    "named Unknown."
)

_PLACEHOLDER_REGEX = r"^\s*(" + "|".join(sorted(PLACEHOLDER_NAMES)) + r")\s*$"


def is_placeholder_name(value):
    """True when a name part is a placeholder such as "Unknown"."""
    return bool(value) and value.strip().casefold() in PLACEHOLDER_NAMES


def is_placeholder_defendant(defendant):
    """True when either of the defendant's names is a placeholder."""
    return is_placeholder_name(defendant.given_names) or is_placeholder_name(
        defendant.last_name
    )


def placeholder_name_q():
    """Q matching defendants with a placeholder given name or last name."""
    return Q(given_names__iregex=_PLACEHOLDER_REGEX) | Q(
        last_name__iregex=_PLACEHOLDER_REGEX
    )


def reject_new_placeholder_defendants(defendants, existing_ids=()):
    """Return a validation message if a newly attached defendant is a placeholder.

    Defendants already on the case (``existing_ids``) are allowed, so a case
    that already holds one can still be edited.
    """
    existing = set(existing_ids)
    for defendant in defendants:
        if defendant.pk not in existing and is_placeholder_defendant(defendant):
            return PLACEHOLDER_MESSAGE
    return None
