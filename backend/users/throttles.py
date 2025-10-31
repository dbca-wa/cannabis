"""
Custom throttle classes for user authentication and password reset operations
"""
from rest_framework.throttling import UserRateThrottle, AnonRateThrottle
from django.core.cache import cache
from django.utils import timezone
from datetime import timedelta
import logging

logger = logging.getLogger(__name__)


class PasswordResetRateThrottle(AnonRateThrottle):
    """
    Rate throttle for password reset requests
    Limits password reset requests per IP address to prevent abuse
    """
    scope = 'password_reset'
    
    def get_cache_key(self, request, view):
        """
        Create cache key based on IP address for anonymous requests
        """
        if request.user.is_authenticated:
            # For authenticated users, use user ID
            ident = request.user.pk
        else:
            # For anonymous users, use IP address
            ident = self.get_ident(request)
        
        return self.cache_format % {
            'scope': self.scope,
            'ident': ident
        }


class ResetCodeVerificationThrottle(AnonRateThrottle):
    """
    Rate throttle for reset code verification attempts
    More restrictive than password reset requests to prevent brute force attacks
    """
    scope = 'reset_code_verification'
    
    def get_cache_key(self, request, view):
        """
        Create cache key based on IP address and email for verification attempts
        """
        email = request.data.get('email', '').strip().lower()
        ip_address = self.get_ident(request)
        
        # Create a combined key for IP + email to track attempts per email per IP
        return f"reset_code_verification:{ip_address}:{email}"
    
    def allow_request(self, request, view):
        """
        Override to implement custom logic for reset code verification
        """
        # First check the standard rate limit
        if not super().allow_request(request, view):
            return False
        
        # Additional check: limit attempts per email across all IPs
        email = request.data.get('email', '').strip().lower()
        if email:
            email_key = f"reset_code_verification_email:{email}"
            email_attempts = cache.get(email_key, 0)
            
            # Allow max 10 attempts per email per hour across all IPs
            if email_attempts >= 10:
                logger.warning(
                    f"Reset code verification rate limit exceeded for email: {email}",
                    extra={
                        'event_type': 'rate_limit_exceeded',
                        'email': email,
                        'attempts': email_attempts,
                        'limit_type': 'email_global'
                    }
                )
                return False
            
            # Increment email attempt counter
            cache.set(email_key, email_attempts + 1, 3600)  # 1 hour
        
        return True


class BruteForceProtectionThrottle:
    """
    Custom brute force protection for reset code verification
    Implements progressive delays and temporary lockouts
    """
    
    @staticmethod
    def check_brute_force_protection(email: str, ip_address: str) -> tuple[bool, str, int]:
        """
        Check if request should be blocked due to brute force protection
        
        Args:
            email: Email address being targeted
            ip_address: IP address making the request
            
        Returns:
            Tuple of (is_allowed, reason, wait_time_seconds)
        """
        # Check email-based lockout (across all IPs)
        email_lockout_key = f"reset_code_lockout_email:{email}"
        email_lockout = cache.get(email_lockout_key)
        
        if email_lockout:
            remaining_time = email_lockout.get('expires_at') - timezone.now().timestamp()
            if remaining_time > 0:
                return False, "Email temporarily locked due to too many failed attempts", int(remaining_time)
        
        # Check IP-based lockout
        ip_lockout_key = f"reset_code_lockout_ip:{ip_address}"
        ip_lockout = cache.get(ip_lockout_key)
        
        if ip_lockout:
            remaining_time = ip_lockout.get('expires_at') - timezone.now().timestamp()
            if remaining_time > 0:
                return False, "IP address temporarily locked due to too many failed attempts", int(remaining_time)
        
        return True, "", 0
    
    @staticmethod
    def record_failed_attempt(email: str, ip_address: str, attempt_count: int):
        """
        Record a failed verification attempt and apply progressive penalties
        
        Args:
            email: Email address being targeted
            ip_address: IP address making the request
            attempt_count: Current attempt count for this reset code
        """
        now = timezone.now()
        
        # Progressive lockout based on attempt count
        if attempt_count >= 5:
            # Lock email for 1 hour after 5 failed attempts
            lockout_duration = 3600  # 1 hour
            email_lockout_key = f"reset_code_lockout_email:{email}"
            cache.set(email_lockout_key, {
                'expires_at': now.timestamp() + lockout_duration,
                'attempt_count': attempt_count,
                'locked_at': now.isoformat()
            }, lockout_duration)
            
            logger.error(
                f"Email locked due to brute force attempts: {email}",
                extra={
                    'event_type': 'email_lockout',
                    'email': email,
                    'attempt_count': attempt_count,
                    'lockout_duration': lockout_duration
                }
            )
        
        # Track IP-based attempts
        ip_attempts_key = f"reset_code_attempts_ip:{ip_address}"
        ip_attempts = cache.get(ip_attempts_key, 0) + 1
        cache.set(ip_attempts_key, ip_attempts, 3600)  # Track for 1 hour
        
        # Lock IP after 20 failed attempts from same IP (across all emails)
        if ip_attempts >= 20:
            lockout_duration = 7200  # 2 hours
            ip_lockout_key = f"reset_code_lockout_ip:{ip_address}"
            cache.set(ip_lockout_key, {
                'expires_at': now.timestamp() + lockout_duration,
                'attempt_count': ip_attempts,
                'locked_at': now.isoformat()
            }, lockout_duration)
            
            logger.error(
                f"IP address locked due to brute force attempts: {ip_address}",
                extra={
                    'event_type': 'ip_lockout',
                    'ip_address': ip_address,
                    'attempt_count': ip_attempts,
                    'lockout_duration': lockout_duration
                }
            )
    
    @staticmethod
    def clear_failed_attempts(email: str, ip_address: str):
        """
        Clear failed attempt counters after successful verification
        
        Args:
            email: Email address that was successfully verified
            ip_address: IP address that made the successful request
        """
        # Clear email-specific counters
        email_attempts_key = f"reset_code_verification_email:{email}"
        cache.delete(email_attempts_key)
        
        # Don't clear IP counters completely, just reduce them
        # This prevents rapid switching between emails to reset counters
        ip_attempts_key = f"reset_code_attempts_ip:{ip_address}"
        current_attempts = cache.get(ip_attempts_key, 0)
        if current_attempts > 0:
            # Reduce by half but keep some history
            cache.set(ip_attempts_key, max(0, current_attempts // 2), 3600)


class PasswordResetEmailThrottle(AnonRateThrottle):
    """
    Specific throttle for password reset email sending
    Prevents spam and abuse of the email system
    """
    scope = 'password_reset_email'
    
    def get_cache_key(self, request, view):
        """
        Create cache key based on IP address for email sending
        """
        ip_address = self.get_ident(request)
        return f"password_reset_email:{ip_address}"
    
    def allow_request(self, request, view):
        """
        Check if email sending is allowed
        """
        # Check standard rate limit first
        if not super().allow_request(request, view):
            return False
        
        # Additional check: limit emails per specific email address
        email = request.data.get('email', '').strip().lower()
        if email:
            email_key = f"password_reset_email_target:{email}"
            email_count = cache.get(email_key, 0)
            
            # Allow max 3 password reset emails per email address per hour
            if email_count >= 3:
                logger.warning(
                    f"Password reset email rate limit exceeded for target: {email}",
                    extra={
                        'event_type': 'email_rate_limit_exceeded',
                        'target_email': email,
                        'count': email_count
                    }
                )
                return False
            
            # Increment counter
            cache.set(email_key, email_count + 1, 3600)  # 1 hour
        
        return True