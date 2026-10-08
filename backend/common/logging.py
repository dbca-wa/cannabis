"""Shared logging helpers.

Provides a single consistent way to render the acting user in action logs so
every call site reads identically, and a single-line reader for page/record
views so an operator can trace what a user looked at without per-API noise.
"""

from django.conf import settings


def describe_user(user) -> str:
    """Render an acting user for logs as ``Full Name (email, id=N)``.

    Falls back to ``anonymous`` for unauthenticated users and degrades
    gracefully when the name or email is unavailable, never printing ``None``.
    """
    if user is None or not getattr(user, "is_authenticated", False):
        return "anonymous"
    name = getattr(user, "full_name", None) or "Unknown"
    email = getattr(user, "email", None) or "no-email"
    return f"{name} ({email}, id={user.pk})"


def log_read(user, description: str) -> None:
    """Emit one INFO line recording a page or record view.

    ``description`` is the past-tense phrase after the acting user, e.g.
    ``"viewed the officers list"`` or ``"viewed officer Jane Doe (5600)"``.
    This is the single read-audit entry point: exactly one line per page the
    user opens, never one per supporting API call. Reads never log at WARNING
    or ERROR — those are reserved for genuine failures.
    """
    settings.LOGGER.info(f"{describe_user(user)} {description}")
