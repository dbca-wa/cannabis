import logging

from django.http import HttpRequest, HttpResponse
from django.utils.deprecation import MiddlewareMixin

logger = logging.getLogger(__name__)


class SecurityAuditMiddleware(MiddlewareMixin):
    """
    Middleware to log security-related events and API access
    """

    def __init__(self, get_response):
        self.get_response = get_response
        super().__init__(get_response)

    def process_request(self, request: HttpRequest):
        """Log security-relevant requests"""

        # Skip logging for system settings in process_request since auth hasn't been processed yet
        # We'll log in process_response instead where we have proper auth info

        # Log admin route access attempts
        if request.path.startswith("/admin") or "admin" in request.path.lower():
            user_info = "anonymous"
            if hasattr(request, "user") and request.user.is_authenticated:
                user_info = f"{request.user.email} (ID: {request.user.id}, staff: {request.user.is_staff}, superuser: {request.user.is_superuser})"

            logger.info(
                f"[Security] Admin route access: {request.method} {request.path} "
                f"by {user_info} from {self.get_client_ip(request)}"
            )

    def process_response(self, request: HttpRequest, response: HttpResponse):
        """Log security-relevant responses"""

        # Log system settings access (now that auth is processed)
        if request.path.startswith("/api/v1/system/settings"):
            user_info = "anonymous"
            if hasattr(request, "user") and request.user.is_authenticated:
                user_info = f"{request.user.email} (ID: {request.user.id})"

            if response.status_code == 200:
                logger.info(
                    f"[Security] System settings access successful: {request.method} {request.path} "
                    f"by {user_info} from {self.get_client_ip(request)}"
                )
            elif response.status_code == 403:
                logger.warning(
                    f"[Security] Access denied to system settings: {request.method} {request.path} "
                    f"by {user_info} from {self.get_client_ip(request)} - Status: {response.status_code}"
                )

        # Log rate limiting
        if response.status_code == 429:
            user_info = "anonymous"
            if hasattr(request, "user") and request.user.is_authenticated:
                user_info = f"{request.user.email} (ID: {request.user.id})"

            logger.warning(
                f"[Security] Rate limit exceeded: {request.method} {request.path} "
                f"by {user_info} from {self.get_client_ip(request)}"
            )

        return response

    def get_client_ip(self, request: HttpRequest) -> str:
        """Get the client IP address from request"""
        x_forwarded_for = request.META.get("HTTP_X_FORWARDED_FOR")
        if x_forwarded_for:
            ip = x_forwarded_for.split(",")[0].strip()
        else:
            ip = request.META.get("REMOTE_ADDR", "unknown")
        return ip


class AdminOnlyCsrfMiddleware:
    """
    Applies Django's CSRF protection only to /admin/ routes.
    All API routes use JWT authentication, making CSRF irrelevant.
    """

    def __init__(self, get_response):
        from django.middleware.csrf import CsrfViewMiddleware

        self.get_response = get_response
        self.csrf_middleware = CsrfViewMiddleware(get_response)

    def __call__(self, request: HttpRequest):
        if request.path.startswith("/admin/"):
            # Delegate to Django's built-in CSRF middleware for admin routes
            return self.csrf_middleware(request)
        return self.get_response(request)
