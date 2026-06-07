import logging

from django.core.cache import cache
from django.utils import timezone
from rest_framework import status
from rest_framework.exceptions import PermissionDenied
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

logger = logging.getLogger(__name__)


class SecurityMonitoringView(APIView):
    """
    GET: View current security status and rate limits (superuser only)
    """

    permission_classes = [IsAuthenticated]

    def get(self, request):
        """Get current security monitoring information"""
        if not request.user.is_superuser:
            logger.warning(
                f"Non-superuser {request.user.email} (ID: {request.user.id}) "
                f"attempted to access security monitoring"
            )
            raise PermissionDenied("Superuser access required.")

        try:
            # Get basic security metrics
            security_info = {
                "timestamp": timezone.now().isoformat(),
                "rate_limits": {
                    "password_reset": "5/hour per IP",
                    "password_reset_email": "10/hour per IP, 3/hour per target email",
                    "reset_code_verification": "20/hour per IP, 10/hour per email globally",
                },
                "brute_force_protection": {
                    "email_lockout_threshold": "5 failed attempts",
                    "email_lockout_duration": "1 hour",
                    "ip_lockout_threshold": "20 failed attempts",
                    "ip_lockout_duration": "2 hours",
                },
                "active_lockouts": {
                    "note": "Use management command 'manage_rate_limits --action status' for detailed lockout information"
                },
            }

            logger.info(
                f"Security monitoring accessed by {request.user.email} (ID: {request.user.id})"
            )

            return Response(security_info, status=status.HTTP_200_OK)

        except PermissionDenied:
            raise
        except Exception as e:
            logger.error(f"Failed to get security monitoring info: {str(e)}")
            raise


class ResetRateLimitsView(APIView):
    """
    POST: Reset rate limits by clearing cache (superuser only)
    """

    permission_classes = [IsAuthenticated]

    def post(self, request):
        # Require superuser for this operation
        if not request.user.is_superuser:
            logger.warning(
                f"Non-superuser {request.user.email} (ID: {request.user.id}) "
                f"attempted to reset rate limits"
            )
            raise PermissionDenied("Superuser privileges required.")

        try:
            cache.clear()
            logger.info(
                f"Rate limits reset by {request.user.email} (ID: {request.user.id})"
            )
            return Response(
                {
                    "message": "Rate limits have been reset successfully",
                    "cleared_by": request.user.email,
                    "timestamp": timezone.now().isoformat(),
                }
            )
        except Exception as e:
            logger.error(f"Failed to reset rate limits: {str(e)}")
            raise
