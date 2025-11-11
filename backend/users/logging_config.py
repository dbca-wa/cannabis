"""
Enhanced logging configuration for the user invitation system
"""
import logging
import json
from datetime import datetime
from typing import Dict, Any, Optional
from django.conf import settings

class SecurityEventFormatter(logging.Formatter):
    """Custom formatter for security events with structured logging"""
    
    def format(self, record):
        # Create base log entry
        log_entry = {
            'timestamp': datetime.utcnow().isoformat() + 'Z',
            'level': record.levelname,
            'logger': record.name,
            'message': record.getMessage(),
        }
        
        # Add extra fields if present
        if hasattr(record, 'event_type'):
            log_entry['event_type'] = record.event_type
        
        if hasattr(record, 'severity'):
            log_entry['severity'] = record.severity
            
        if hasattr(record, 'email'):
            log_entry['email'] = record.email
            
        if hasattr(record, 'inviter_email'):
            log_entry['inviter_email'] = record.inviter_email
            
        if hasattr(record, 'invited_email'):
            log_entry['invited_email'] = record.invited_email
            
        if hasattr(record, 'role'):
            log_entry['role'] = record.role
            
        if hasattr(record, 'token_prefix'):
            log_entry['token_prefix'] = record.token_prefix
            
        if hasattr(record, 'reason'):
            log_entry['reason'] = record.reason
            
        if hasattr(record, 'user_exists'):
            log_entry['user_exists'] = record.user_exists
            
        if hasattr(record, 'is_first_time'):
            log_entry['is_first_time'] = record.is_first_time
            
        if hasattr(record, 'code_prefix'):
            log_entry['code_prefix'] = record.code_prefix
            
        if hasattr(record, 'success'):
            log_entry['success'] = record.success
            
        if hasattr(record, 'attempt_count'):
            log_entry['attempt_count'] = record.attempt_count
            
        if hasattr(record, 'ip_address'):
            log_entry['ip_address'] = record.ip_address
        
        # Add request information if available
        if hasattr(record, 'request'):
            request = record.request
            log_entry['request'] = {
                'method': getattr(request, 'method', None),
                'path': getattr(request, 'path', None),
                'user_agent': request.META.get('HTTP_USER_AGENT', None) if hasattr(request, 'META') else None,
                'ip_address': self._get_client_ip(request) if hasattr(request, 'META') else None,
            }
        
        # Add user information if available
        if hasattr(record, 'user_id'):
            log_entry['user_id'] = record.user_id
            
        # Add error information if present
        if record.exc_info:
            log_entry['exception'] = self.formatException(record.exc_info)
        
        return json.dumps(log_entry, ensure_ascii=False)
    
    def _get_client_ip(self, request):
        """Extract client IP address from request"""
        x_forwarded_for = request.META.get('HTTP_X_FORWARDED_FOR')
        if x_forwarded_for:
            ip = x_forwarded_for.split(',')[0]
        else:
            ip = request.META.get('REMOTE_ADDR')
        return ip


class EnhancedLogger:
    """Enhanced logger with security event tracking"""
    
    def __init__(self, name: str):
        self.logger = logging.getLogger(name)
        
    def log_security_event(
        self,
        event_type: str,
        message: str,
        level: str = "info",
        **kwargs
    ):
        """Log a security event with structured data"""
        extra = {
            'event_type': event_type,
            'severity': kwargs.get('severity', 'info'),
            **kwargs
        }
        
        log_method = getattr(self.logger, level.lower(), self.logger.info)
        log_method(message, extra=extra)
    
    def log_invitation_sent(
        self,
        inviter_email: str,
        invited_email: str,
        role: str,
        token_prefix: str,
        request=None
    ):
        """Log successful invitation sending"""
        self.log_security_event(
            event_type="invitation_sent",
            message=f"Invitation sent from {inviter_email} to {invited_email} with role {role}",
            level="info",
            inviter_email=inviter_email,
            invited_email=invited_email,
            role=role,
            token_prefix=token_prefix,
            request=request
        )
    
    def log_invitation_activation_success(
        self,
        email: str,
        inviter_email: str,
        request=None
    ):
        """Log successful invitation activation"""
        self.log_security_event(
            event_type="invitation_activated",
            message=f"Invitation activated successfully for {email}",
            level="info",
            email=email,
            inviter_email=inviter_email,
            request=request
        )
    
    def log_invitation_activation_failed(
        self,
        email: str,
        reason: str,
        token_prefix: str,
        request=None
    ):
        """Log failed invitation activation"""
        self.log_security_event(
            event_type="invitation_activation_failed",
            message=f"Invitation activation failed for {email}: {reason}",
            level="warning",
            severity="warning",
            email=email,
            reason=reason,
            token_prefix=token_prefix,
            request=request
        )
    
    def log_password_reset_requested(
        self,
        email: str,
        user_exists: bool,
        request=None
    ):
        """Log password reset request"""
        self.log_security_event(
            event_type="password_reset_requested",
            message=f"Password reset requested for {email}",
            level="info",
            email=email,
            user_exists=user_exists,
            request=request
        )
    
    def log_reset_code_generated(
        self,
        email: str,
        code_prefix: str,
        request=None
    ):
        """Log reset code generation"""
        self.log_security_event(
            event_type="reset_code_generated",
            message=f"Password reset code generated for {email}",
            level="info",
            email=email,
            code_prefix=code_prefix,
            request=request
        )
    
    def log_reset_code_verification_attempt(
        self,
        email: str,
        code_prefix: str,
        success: bool,
        reason: str = None,
        attempt_count: int = None,
        request=None
    ):
        """Log reset code verification attempt"""
        status = "success" if success else "failed"
        message = f"Reset code verification {status} for {email}"
        if reason:
            message += f": {reason}"
        
        self.log_security_event(
            event_type="reset_code_verification",
            message=message,
            level="info" if success else "warning",
            severity="info" if success else "warning",
            email=email,
            code_prefix=code_prefix,
            success=success,
            reason=reason,
            attempt_count=attempt_count,
            request=request
        )
    
    def log_reset_code_expired(
        self,
        email: str,
        code_prefix: str,
        request=None
    ):
        """Log expired reset code usage attempt"""
        self.log_security_event(
            event_type="reset_code_expired",
            message=f"Expired reset code used for {email}",
            level="warning",
            severity="warning",
            email=email,
            code_prefix=code_prefix,
            request=request
        )
    
    def log_reset_code_brute_force_attempt(
        self,
        email: str,
        attempt_count: int,
        ip_address: str = None,
        request=None
    ):
        """Log potential brute force attempt on reset codes"""
        self.log_security_event(
            event_type="reset_code_brute_force",
            message=f"Potential brute force attack detected for {email} - {attempt_count} failed attempts",
            level="error",
            severity="high",
            email=email,
            attempt_count=attempt_count,
            ip_address=ip_address,
            request=request
        )
    
    def log_reset_code_invalidated(
        self,
        email: str,
        code_prefix: str,
        reason: str,
        request=None
    ):
        """Log reset code invalidation"""
        self.log_security_event(
            event_type="reset_code_invalidated",
            message=f"Reset code invalidated for {email}: {reason}",
            level="info",
            email=email,
            code_prefix=code_prefix,
            reason=reason,
            request=request
        )
    
    def log_password_reset_failed(
        self,
        email: str,
        reason: str,
        token_prefix: str,
        request=None
    ):
        """Log failed password reset"""
        self.log_security_event(
            event_type="password_reset_failed",
            message=f"Password reset failed for {email}: {reason}",
            level="warning",
            severity="warning",
            email=email,
            reason=reason,
            token_prefix=token_prefix,
            request=request
        )
    
    def log_password_update_success(
        self,
        email: str,
        is_first_time: bool,
        request=None
    ):
        """Log successful password update"""
        self.log_security_event(
            event_type="password_updated",
            message=f"Password updated successfully for {email} (first_time: {is_first_time})",
            level="info",
            email=email,
            is_first_time=is_first_time,
            request=request
        )
    
    def log_password_update_failed(
        self,
        email: str,
        reason: str,
        request=None
    ):
        """Log failed password update"""
        self.log_security_event(
            event_type="password_update_failed",
            message=f"Password update failed for {email}: {reason}",
            level="warning",
            severity="warning",
            email=email,
            reason=reason,
            request=request
        )
    
    def log_authentication_failed(
        self,
        email: str,
        reason: str,
        request=None
    ):
        """Log authentication failure"""
        self.log_security_event(
            event_type="authentication_failed",
            message=f"Authentication failed for {email}: {reason}",
            level="warning",
            severity="warning",
            email=email,
            reason=reason,
            request=request
        )


def setup_security_logging():
    """Setup security logging configuration"""
    
    # Create security logger
    security_logger = logging.getLogger('security')
    security_logger.setLevel(logging.INFO)
    
    # Create file handler for security events
    if hasattr(settings, 'SECURITY_LOG_FILE'):
        security_handler = logging.FileHandler(settings.SECURITY_LOG_FILE)
        security_handler.setLevel(logging.INFO)
        security_handler.setFormatter(SecurityEventFormatter())
        security_logger.addHandler(security_handler)
    
    # Create console handler for development
    if settings.DEBUG:
        console_handler = logging.StreamHandler()
        console_handler.setLevel(logging.INFO)
        console_handler.setFormatter(SecurityEventFormatter())
        security_logger.addHandler(console_handler)
    
    return security_logger


# Create enhanced logger instance
security_logger = EnhancedLogger('security')

# Export convenience functions
def log_invitation_sent(inviter_email: str, invited_email: str, role: str, token_prefix: str, request=None):
    security_logger.log_invitation_sent(inviter_email, invited_email, role, token_prefix, request)

def log_invitation_activation_success(email: str, inviter_email: str, request=None):
    security_logger.log_invitation_activation_success(email, inviter_email, request)

def log_invitation_activation_failed(email: str, reason: str, token_prefix: str, request=None):
    security_logger.log_invitation_activation_failed(email, reason, token_prefix, request)

def log_password_reset_requested(email: str, user_exists: bool, request=None):
    security_logger.log_password_reset_requested(email, user_exists, request)

def log_password_reset_failed(email: str, reason: str, token_prefix: str, request=None):
    security_logger.log_password_reset_failed(email, reason, token_prefix, request)

def log_password_update_success(email: str, is_first_time: bool, request=None):
    security_logger.log_password_update_success(email, is_first_time, request)

def log_password_update_failed(email: str, reason: str, request=None):
    security_logger.log_password_update_failed(email, reason, request)

def log_authentication_failed(email: str, reason: str, request=None):
    security_logger.log_authentication_failed(email, reason, request)

def log_reset_code_generated(email: str, code_prefix: str, request=None):
    security_logger.log_reset_code_generated(email, code_prefix, request)

def log_reset_code_verification_attempt(email: str, code_prefix: str, success: bool, reason: str = None, attempt_count: int = None, request=None):
    security_logger.log_reset_code_verification_attempt(email, code_prefix, success, reason, attempt_count, request)

def log_reset_code_expired(email: str, code_prefix: str, request=None):
    security_logger.log_reset_code_expired(email, code_prefix, request)

def log_reset_code_brute_force_attempt(email: str, attempt_count: int, ip_address: str = None, request=None):
    security_logger.log_reset_code_brute_force_attempt(email, attempt_count, ip_address, request)

def log_reset_code_invalidated(email: str, code_prefix: str, reason: str, request=None):
    security_logger.log_reset_code_invalidated(email, code_prefix, reason, request)