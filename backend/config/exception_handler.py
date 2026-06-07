"""
Custom exception handling for the API.

Ensures all error responses are JSON — never raw HTML, stack traces, or
Django's default error pages.
"""

import logging
import re
import traceback

from django.conf import settings
from django.http import JsonResponse
from rest_framework.response import Response
from rest_framework.views import exception_handler as default_exception_handler

logger = logging.getLogger(__name__)

# Regex to strip HTML tags from error messages that slip through.
_HTML_TAG_RE = re.compile(r"<[^>]+>")


def _strip_html(value):
    """Remove HTML tags from a string value."""
    if isinstance(value, str):
        return _HTML_TAG_RE.sub("", value).strip()
    return value


def _sanitise_data(data):
    """Recursively strip HTML from response data values."""
    if isinstance(data, dict):
        return {key: _sanitise_data(val) for key, val in data.items()}
    if isinstance(data, list):
        return [_sanitise_data(item) for item in data]
    return _strip_html(data)


def custom_exception_handler(exc, context):
    """
    DRF exception handler that guarantees JSON responses.

    1. Delegates to DRF's default handler first.
    2. If DRF can't handle it (returns None), returns a generic 500.
    3. Strips any HTML that may have leaked into error messages.
    4. Optionally includes debug info when DEBUG=True.
    """
    response = default_exception_handler(exc, context)

    if response is None:
        # Unhandled exception — log it and return a generic 500.
        logger.error(
            "Unhandled exception in %s: %s",
            context.get("view", "unknown view"),
            exc,
            exc_info=True,
        )
        data = {"detail": "An internal error occurred. Please try again later."}
        if settings.DEBUG:
            data["debug"] = {
                "exception": type(exc).__name__,
                "message": str(exc),
                "traceback": traceback.format_exc(),
            }
        return Response(data, status=500)

    # Sanitise the response data to strip any HTML that slipped through.
    response.data = _sanitise_data(response.data)

    # Include debug info for handled exceptions when DEBUG=True.
    if settings.DEBUG and isinstance(response.data, dict):
        response.data.setdefault(
            "debug",
            {
                "exception": type(exc).__name__,
                "message": str(exc),
            },
        )

    return response


def custom_404_handler(request, exception=None):
    """Django-level 404 handler — returns JSON instead of the HTML 404 page."""
    return JsonResponse({"detail": "Not found."}, status=404)


def custom_500_handler(request):
    """Django-level 500 handler — returns JSON instead of the HTML 500 page."""
    return JsonResponse(
        {"detail": "An internal error occurred. Please try again later."},
        status=500,
    )
