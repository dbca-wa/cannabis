import json
import logging
import re

from django.http import HttpRequest, HttpResponse
from django.utils.deprecation import MiddlewareMixin

from common.logging import describe_user

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

        # System settings: successful reads are silent (reads never log on
        # success). Only a denied access is worth a line, as a real problem.
        if request.path.startswith("/api/v1/system/settings"):
            if response.status_code == 403:
                user_info = "anonymous"
                if hasattr(request, "user") and request.user.is_authenticated:
                    user_info = f"{request.user.email} (ID: {request.user.id})"
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


class APIRequestLoggingMiddleware:
    """
    Failure-only logger for API requests under /api/v1/.

    Successful (2xx) and redirect (3xx) responses are not logged — successful
    actions are logged once in the service layer. A client error (4xx) produces
    a single WARNING line with method, path, acting user, status, and the
    redacted request body for mutating methods. Server errors (5xx) are owned by
    the DRF exception handler and are not logged here.

    Sensitive fields (password, tokens) are redacted from logged bodies.
    """

    MUTATION_METHODS = {"POST", "PATCH", "PUT", "DELETE"}

    # Fields whose values must never appear in logs
    SENSITIVE_FIELDS = re.compile(
        r"(password|token|secret|access_token|refresh_token)", re.IGNORECASE
    )

    def __init__(self, get_response):
        self.get_response = get_response
        self.logger = logging.getLogger("api.request")

    def _redact_body(self, body_str: str) -> str:
        """Redact sensitive fields from a JSON request body string."""
        try:
            data = json.loads(body_str)
        except (json.JSONDecodeError, ValueError):
            # Not valid JSON — apply regex-based redaction as a fallback
            return self.SENSITIVE_FIELDS.sub(lambda m: m.group(0), body_str)

        if isinstance(data, dict):
            redacted = {
                k: "***REDACTED***" if self.SENSITIVE_FIELDS.search(k) else v
                for k, v in data.items()
            }
            return json.dumps(redacted, ensure_ascii=False)
        return body_str

    def __call__(self, request: HttpRequest) -> HttpResponse:
        if not request.path.startswith("/api/v1/"):
            return self.get_response(request)

        # Capture request body before processing (stream can only be read once)
        body_str = ""
        if request.method in self.MUTATION_METHODS:
            try:
                body = request.body.decode("utf-8", errors="replace")
                if body:
                    body_str = body[:2000] + (
                        "...(truncated)" if len(body) > 2000 else ""
                    )
            except Exception:  # nosec B110
                pass

        response = self.get_response(request)

        # Success paths are silent; the service layer owns success logging.
        # 5xx is owned by the DRF exception handler. Only 4xx is logged here.
        if not (400 <= response.status_code < 500):
            return response

        # Resolve user AFTER response — DRF authenticates during view processing
        user_info = describe_user(getattr(request, "user", None))

        log_parts = [
            f"[API] {response.status_code} {request.method} {request.path} "
            f"by {user_info}"
        ]
        if body_str:
            log_parts.append(f"body: {self._redact_body(body_str)}")
        self.logger.warning(" | ".join(log_parts))

        return response


class SecurityHeadersMiddleware:
    """
    Adds security response headers to all responses:
    - Cache-Control: no-store for API and generated-document responses
    - Content-Security-Policy: restrictive policy for the application
    - Referrer-Policy: strict-origin-when-cross-origin
    - Permissions-Policy: disables unused browser features

    X-Frame-Options, X-Content-Type-Options are handled by Django's SecurityMiddleware
    via settings (SECURE_CONTENT_TYPE_NOSNIFF, X_FRAME_OPTIONS).
    """

    # Paths whose responses must never be stored by a browser or intermediary.
    # /api/ carries case data; /files/ serves generated certificates and batch
    # packages, which are replaced in place at a stable URL when a certificate is
    # regenerated or a batch repackaged — a cached copy would show the superseded
    # document indefinitely.
    NO_STORE_PREFIXES = ("/api/", "/files/")

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request: HttpRequest) -> HttpResponse:
        response = self.get_response(request)

        if request.path.startswith(self.NO_STORE_PREFIXES):
            response["Cache-Control"] = "no-store, no-cache, must-revalidate"
            response["Pragma"] = "no-cache"
            # Django's static serve view sets Last-Modified, which licenses a
            # conditional request that could still yield a 304 for a replaced
            # document. Dropping it forces a full re-fetch.
            if "Last-Modified" in response:
                del response["Last-Modified"]

        # Content-Security-Policy — restrictive baseline
        # The frontend is a separate SPA, so the backend only serves JSON API
        # responses and the Django admin interface.
        if request.path.startswith("/admin"):
            # Django admin needs inline styles and scripts
            response["Content-Security-Policy"] = (
                "default-src 'self'; "
                "script-src 'self' 'unsafe-inline'; "
                "style-src 'self' 'unsafe-inline'; "
                "img-src 'self' data:; "
                "font-src 'self'; "
                "frame-ancestors 'none'"
            )
        else:
            # API responses — very restrictive
            response["Content-Security-Policy"] = (
                "default-src 'none'; frame-ancestors 'none'"
            )

        # Referrer-Policy
        response["Referrer-Policy"] = "strict-origin-when-cross-origin"

        # Permissions-Policy — disable unused browser features
        response["Permissions-Policy"] = (
            "camera=(), microphone=(), geolocation=(), payment=()"
        )

        return response


class PracticeModeMiddleware:
    """Set the request-scoped practice context from the authenticated user.

    Authentication is JWT, resolved by DRF during view dispatch rather than by
    Django's AuthenticationMiddleware, so this middleware resolves the JWT user
    itself for API requests. The context scopes which data the real queries
    return; it is never used for authorisation.

    Expired practice sessions are treated as off and their data purged lazily
    here, so a user who leaves and returns the next day starts clean.
    """

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        from common import practice

        user = self._resolve_user(request)
        in_practice = False
        if user is not None and getattr(user, "is_authenticated", False):
            in_practice = practice.is_in_practice_mode(user)
            practice.set_context(user, in_practice)
        try:
            return self.get_response(request)
        finally:
            practice.clear_context()

    @staticmethod
    def _resolve_user(request):
        if not request.path.startswith("/api/"):
            return None
        try:
            from rest_framework_simplejwt.authentication import JWTAuthentication

            result = JWTAuthentication().authenticate(request)
            return result[0] if result else None
        except Exception:
            return None
