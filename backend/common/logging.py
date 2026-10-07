"""Shared logging helpers.

Provides a single consistent way to render the acting user in action logs so
every call site reads identically.
"""


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
