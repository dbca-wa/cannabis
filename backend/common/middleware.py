import logging
import json
from django.utils.deprecation import MiddlewareMixin
from django.conf import settings
from django.http import HttpRequest, HttpResponse

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
        pass
        
        # Log admin route access attempts
        if request.path.startswith('/admin') or 'admin' in request.path.lower():
            user_info = "anonymous"
            if hasattr(request, 'user') and request.user.is_authenticated:
                user_info = f"{request.user.email} (ID: {request.user.id}, staff: {request.user.is_staff}, superuser: {request.user.is_superuser})"
            
            logger.info(
                f"[Security] Admin route access: {request.method} {request.path} "
                f"by {user_info} from {self.get_client_ip(request)}"
            )
    
    def process_response(self, request: HttpRequest, response: HttpResponse):
        """Log security-relevant responses"""
        
        # Log system settings access (now that auth is processed)
        if request.path.startswith('/api/v1/system/settings'):
            user_info = "anonymous"
            if hasattr(request, 'user') and request.user.is_authenticated:
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
            if hasattr(request, 'user') and request.user.is_authenticated:
                user_info = f"{request.user.email} (ID: {request.user.id})"
            
            logger.warning(
                f"[Security] Rate limit exceeded: {request.method} {request.path} "
                f"by {user_info} from {self.get_client_ip(request)}"
            )
        
        return response
    
    def get_client_ip(self, request: HttpRequest) -> str:
        """Get the client IP address from request"""
        x_forwarded_for = request.META.get('HTTP_X_FORWARDED_FOR')
        if x_forwarded_for:
            ip = x_forwarded_for.split(',')[0].strip()
        else:
            ip = request.META.get('REMOTE_ADDR', 'unknown')
        return ip


class CSRFSecurityMiddleware(MiddlewareMixin):
    """
    Enhanced CSRF security middleware for admin operations
    """
    
    def process_request(self, request: HttpRequest):
        """Enhanced CSRF checking for admin operations"""
        
        # Skip for GET requests
        if request.method == 'GET':
            return None
        
        # Enhanced logging for admin settings modifications
        if request.path.startswith('/api/v1/system/settings') and request.method in ['POST', 'PATCH', 'PUT']:
            csrf_token = request.META.get('HTTP_X_CSRFTOKEN')
            
            if not csrf_token:
                logger.warning(
                    f"[Security] Missing CSRF token for system settings modification: "
                    f"{request.method} {request.path} from {self.get_client_ip(request)}"
                )
            else:
                logger.info(
                    f"[Security] CSRF token present for system settings modification: "
                    f"{request.method} {request.path}"
                )
        
        return None
    
    def get_client_ip(self, request: HttpRequest) -> str:
        """Get the client IP address from request"""
        x_forwarded_for = request.META.get('HTTP_X_FORWARDED_FOR')
        if x_forwarded_for:
            ip = x_forwarded_for.split(',')[0].strip()
        else:
            ip = request.META.get('REMOTE_ADDR', 'unknown')
        return ip