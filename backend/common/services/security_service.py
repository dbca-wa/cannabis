"""Service layer for security monitoring and rate limit management."""

import logging

from django.core.cache import cache
from django.utils import timezone

logger = logging.getLogger(__name__)


class SecurityService:
    """Business logic for security monitoring and rate limit operations."""

    @staticmethod
    def get_security_info():
        """Build and return the current security monitoring information.

        Returns:
            dict: Security metrics including rate limits and protection config.
        """
        return {
            "timestamp": timezone.now().isoformat(),
            "rate_limits": {
                "password_reset": "5/hour per IP",
                "password_reset_email": "10/hour per IP, 3/hour per target email",
                "reset_code_verification": (
                    "20/hour per IP, 10/hour per email globally"
                ),
            },
            "brute_force_protection": {
                "email_lockout_threshold": "5 failed attempts",
                "email_lockout_duration": "1 hour",
                "ip_lockout_threshold": "20 failed attempts",
                "ip_lockout_duration": "2 hours",
            },
            "active_lockouts": {
                "note": (
                    "Use management command 'manage_rate_limits --action status' "
                    "for detailed lockout information"
                ),
            },
        }

    @staticmethod
    def reset_rate_limits(user):
        """Clear the cache to reset all rate limits.

        Args:
            user: The user performing the reset (for logging).

        Returns:
            dict: Confirmation message with metadata.
        """
        cache.clear()
        logger.info(f"Rate limits reset by {user.email} (ID: {user.id})")
        return {
            "message": "Rate limits have been reset successfully",
            "cleared_by": user.email,
            "timestamp": timezone.now().isoformat(),
        }
