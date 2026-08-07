import json
import logging
import re

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


class APIRequestLoggingMiddleware:
    """
    Logs every API request under /api/v1/ with method, path, user info,
    and request body for mutation requests. Logs error response bodies
    on 4xx/5xx for debugging DRF validation failures.

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

        # Resolve user AFTER response — DRF authenticates during view processing
        user_info = "anonymous"
        if hasattr(request, "user") and request.user.is_authenticated:
            user_info = f"{request.user.email} (id={request.user.id})"

        # Log the request
        log_parts = [f"[API] {request.method} {request.path} by {user_info}"]
        if body_str:
            log_parts.append(f"body: {self._redact_body(body_str)}")
        self.logger.info(" | ".join(log_parts))

        # Log error responses with response body
        if response.status_code >= 400:
            try:
                response_body = response.content.decode("utf-8", errors="replace")[
                    :2000
                ]
                self.logger.warning(
                    f"[API] {response.status_code} {response.reason_phrase} | {response_body}"
                )
            except Exception:
                self.logger.warning(
                    f"[API] {response.status_code} {response.reason_phrase}"
                )

        return response


class SecurityHeadersMiddleware:
    """
    Adds security response headers to all responses:
    - Cache-Control: no-store for API responses (prevents caching sensitive data)
    - Content-Security-Policy: restrictive policy for the application
    - Referrer-Policy: strict-origin-when-cross-origin
    - Permissions-Policy: disables unused browser features

    X-Frame-Options, X-Content-Type-Options are handled by Django's SecurityMiddleware
    via settings (SECURE_CONTENT_TYPE_NOSNIFF, X_FRAME_OPTIONS).
    """

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request: HttpRequest) -> HttpResponse:
        response = self.get_response(request)

        # Cache-Control: no-store for all API responses containing sensitive data
        if request.path.startswith("/api/"):
            response["Cache-Control"] = "no-store, no-cache, must-revalidate"
            response["Pragma"] = "no-cache"

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
