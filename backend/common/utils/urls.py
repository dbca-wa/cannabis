"""URL helpers for building links to the frontend SPA."""

from django.conf import settings


def get_frontend_url(path: str = "") -> str:
    """Return an absolute URL to a frontend SPA route.

    ``settings.SITE_URL`` is the configured site host. In production it already
    includes the ``https://`` scheme; in local/dev it may be scheme-less
    (e.g. ``127.0.0.1:3000``). This normalises it so links embedded in emails
    are always absolute and clickable.

    Args:
        path: A path relative to the site root (leading slash optional).

    Returns:
        An absolute URL, e.g. ``http://127.0.0.1:3000/auth/reset-code``.
    """
    base = settings.SITE_URL.rstrip("/")
    if not base.startswith(("http://", "https://")):
        scheme = "http" if getattr(settings, "DEBUG", False) else "https"
        base = f"{scheme}://{base}"

    path = path.lstrip("/")
    return f"{base}/{path}" if path else base
