"""
User-related services including password validation and reset code management
"""
import re
import secrets
import logging
from typing import Dict, List, Tuple, Optional
from django.contrib.auth.hashers import make_password, check_password
from django.utils import timezone
from datetime import timedelta
from .models import User, PasswordResetCode
from .error_handlers import SecurityEventLogger

logger = logging.getLogger(__name__)


class PasswordValidator:
    """
    Password validation service with comprehensive security rules
    """
    
    # Password validation constants
    MIN_LENGTH = 10
    
    @staticmethod
    def validate_password(password: str) -> Tuple[bool, List[str]]:
        """
        Validate password against security requirements
        
        Args:
            password: The password to validate
            
        Returns:
            Tuple of (is_valid, list_of_errors)
        """
        errors = []
        
        # Check minimum length
        if len(password) < PasswordValidator.MIN_LENGTH:
            errors.append(f"Password must be at least {PasswordValidator.MIN_LENGTH} characters long")
        
        # Check for at least one letter
        if not re.search(r'[a-zA-Z]', password):
            errors.append("Password must contain at least one letter")
        
        # Check for at least one number
        if not re.search(r'\d', password):
            errors.append("Password must contain at least one number")
        
        # Check for at least one special character
        if not re.search(r'[!@#$%^&*(),.?":{}|<>]', password):
            errors.append("Password must contain at least one special character (!@#$%^&*(),.?\":{}|<>)")
        
        is_valid = len(errors) == 0
        return is_valid, errors
    
    @staticmethod
    def get_password_strength(password: str) -> Dict[str, any]:
        """
        Get detailed password strength information
        
        Args:
            password: The password to analyze
            
        Returns:
            Dictionary with strength details
        """
        is_valid, errors = PasswordValidator.validate_password(password)
        
        # Calculate strength score (0-100)
        score = 0
        criteria_met = 0
        total_criteria = 4
        
        # Length check (0-40 points)
        if len(password) >= PasswordValidator.MIN_LENGTH:
            score += 40
            criteria_met += 1
        elif len(password) >= 8:
            score += 20  # Partial credit for decent length
        
        # Letter check (0-20 points)
        if re.search(r'[a-zA-Z]', password):
            score += 20
            criteria_met += 1
        
        # Number check (0-20 points)
        if re.search(r'\d', password):
            score += 20
            criteria_met += 1
        
        # Special character check (0-20 points)
        if re.search(r'[!@#$%^&*(),.?":{}|<>]', password):
            score += 20
            criteria_met += 1
        
        # Determine strength level
        if score >= 100:
            strength_level = "strong"
        elif score >= 80:
            strength_level = "good"
        elif score >= 60:
            strength_level = "fair"
        elif score >= 40:
            strength_level = "weak"
        else:
            strength_level = "very_weak"
        
        return {
            "is_valid": is_valid,
            "errors": errors,
            "score": score,
            "strength_level": strength_level,
            "criteria_met": criteria_met,
            "total_criteria": total_criteria,
            "requirements": {
                "min_length": len(password) >= PasswordValidator.MIN_LENGTH,
                "has_letter": bool(re.search(r'[a-zA-Z]', password)),
                "has_number": bool(re.search(r'\d', password)),
                "has_special": bool(re.search(r'[!@#$%^&*(),.?":{}|<>]', password))
            }
        }


class PasswordResetCodeService:
    """
    Service for managing password reset codes with secure generation and validation
    """
    
    @staticmethod
    def generate_reset_code(user: User) -> PasswordResetCode:
        """
        Generate a new 4-digit password reset code for a user
        
        Args:
            user: The user requesting password reset
            
        Returns:
            PasswordResetCode instance
            
        Raises:
            ValueError: If user already has an active reset code
        """
        from django.db import transaction
        
        with transaction.atomic():
            # First, clean up any expired or used codes for this user
            expired_count = PasswordResetCode.objects.filter(
                user=user,
                expires_at__lt=timezone.now()
            ).delete()[0]
            
            used_count = PasswordResetCode.objects.filter(
                user=user,
                is_used=True
            ).delete()[0]
            
            if expired_count > 0 or used_count > 0:
                logger.info(f"Cleaned up {expired_count} expired and {used_count} used reset codes for user {user.email}")
            
            # Check if user already has an active reset code
            existing_code = PasswordResetCode.objects.filter(
                user=user,
                is_used=False,
                expires_at__gt=timezone.now()
            ).first()
            
            if existing_code:
                logger.warning(f"User {user.email} already has an active reset code (created: {existing_code.created_at}, expires: {existing_code.expires_at})")
                raise ValueError("User already has an active reset code")
        
            # Generate secure 4-digit code
            code = PasswordResetCodeService._generate_secure_code()
            
            # Hash the code for storage
            code_hash = make_password(code)
            
            # Create the reset code record
            reset_code = PasswordResetCode.objects.create(
                user=user,
                code_hash=code_hash,
                expires_at=timezone.now() + timedelta(hours=24)
            )
            
            # Store the plain code temporarily for email sending
            reset_code._plain_code = code
            
            # Log the code generation for security auditing
            SecurityEventLogger.log_reset_code_generated(
                email=user.email,
                code_prefix=code[:2] + "**"  # Only log first 2 digits for security
            )
            
            logger.info(f"Generated new reset code for user {user.email} (expires: {reset_code.expires_at})")
            
            return reset_code
    
    @staticmethod
    def verify_reset_code(user: User, code: str) -> Tuple[bool, Optional[PasswordResetCode], str]:
        """
        Verify a password reset code for a user
        
        Args:
            user: The user attempting to verify the code
            code: The 4-digit code to verify
            
        Returns:
            Tuple of (is_valid, reset_code_instance, error_message)
        """
        # Find the user's active reset code
        reset_code = PasswordResetCode.objects.filter(
            user=user,
            is_used=False
        ).order_by('-created_at').first()
        
        code_prefix = code[:2] + "**" if len(code) >= 2 else "**"
        
        if not reset_code:
            SecurityEventLogger.log_reset_code_verification_attempt(
                email=user.email,
                code_prefix=code_prefix,
                success=False,
                reason="No active reset code found"
            )
            return False, None, "No active reset code found"
        
        # Check if code is expired
        if reset_code.is_expired:
            SecurityEventLogger.log_reset_code_expired(
                email=user.email,
                code_prefix=code_prefix
            )
            return False, reset_code, "Reset code has expired"
        
        # Check if max attempts exceeded
        if reset_code.attempts >= reset_code.max_attempts:
            SecurityEventLogger.log_reset_code_brute_force_attempt(
                email=user.email,
                attempt_count=reset_code.attempts
            )
            return False, reset_code, "Maximum verification attempts exceeded"
        
        # Verify the code first, then handle attempts
        if check_password(code, reset_code.code_hash):
            # Code is correct - mark as used atomically to prevent race conditions
            from django.db import transaction
            with transaction.atomic():
                # Refresh from database to ensure we have the latest state
                reset_code.refresh_from_db()
                
                # Double-check that the code hasn't been used by another request
                if reset_code.is_used:
                    logger.warning(f"Reset code for {user.email} was already used (race condition detected)")
                    return False, reset_code, "Reset code has already been used"
                
                reset_code.is_used = True
                reset_code.used_at = timezone.now()
                reset_code.save(update_fields=['is_used', 'used_at'])
                
                logger.info(f"Reset code for {user.email} marked as used successfully")
            
            # Log successful verification (don't increment attempts for successful verification)
            SecurityEventLogger.log_reset_code_verification_attempt(
                email=user.email,
                code_prefix=code_prefix,
                success=True,
                attempt_count=reset_code.attempts  # Current attempts, not incremented
            )
            
            return True, reset_code, "Code verified successfully"
        else:
            # Code is incorrect - increment attempt counter atomically
            from django.db import transaction
            with transaction.atomic():
                # Refresh from database to get the latest attempt count
                reset_code.refresh_from_db()
                reset_code.attempts += 1
                reset_code.save(update_fields=['attempts'])
                
                logger.info(f"Incremented attempt count for {user.email} to {reset_code.attempts}/{reset_code.max_attempts}")
            
            # Log failed verification
            SecurityEventLogger.log_reset_code_verification_attempt(
                email=user.email,
                code_prefix=code_prefix,
                success=False,
                reason="Invalid reset code",
                attempt_count=reset_code.attempts
            )
            
            # Check if this was approaching brute force threshold
            if reset_code.attempts >= reset_code.max_attempts - 1:
                SecurityEventLogger.log_reset_code_brute_force_attempt(
                    email=user.email,
                    attempt_count=reset_code.attempts
                )
            
            return False, reset_code, "Invalid reset code"
    
    @staticmethod
    def cleanup_expired_codes() -> int:
        """
        Clean up expired and used reset codes across all users
        
        Returns:
            Number of codes cleaned up
        """
        # Delete expired codes
        expired_count = PasswordResetCode.objects.filter(
            expires_at__lt=timezone.now()
        ).delete()[0]
        
        # Delete used codes older than 7 days (keep recent ones for audit trail)
        old_used_count = PasswordResetCode.objects.filter(
            is_used=True,
            used_at__lt=timezone.now() - timedelta(days=7)
        ).delete()[0]
        
        total_cleaned = expired_count + old_used_count
        
        if total_cleaned > 0:
            logger.info(f"Cleaned up {expired_count} expired and {old_used_count} old used reset codes")
        
        return total_cleaned
    
    @staticmethod
    def invalidate_user_reset_codes(user: User) -> int:
        """
        Invalidate all active reset codes for a user
        
        Args:
            user: The user whose codes should be invalidated
            
        Returns:
            Number of codes invalidated
        """
        # Get the codes before invalidating them for logging
        codes_to_invalidate = PasswordResetCode.objects.filter(
            user=user,
            is_used=False
        )
        
        # Log each code invalidation
        for reset_code in codes_to_invalidate:
            SecurityEventLogger.log_reset_code_invalidated(
                email=user.email,
                code_prefix="****",  # Don't log actual code prefix for invalidated codes
                reason="User password changed or new code requested"
            )
        
        count = codes_to_invalidate.update(is_used=True, used_at=timezone.now())
        
        return count
    
    @staticmethod
    def cleanup_expired_codes() -> int:
        """
        Clean up expired reset codes from the database
        
        Returns:
            Number of codes cleaned up
        """
        expired_codes = PasswordResetCode.objects.filter(
            expires_at__lt=timezone.now(),
            is_used=False
        )
        count = expired_codes.count()
        expired_codes.delete()
        
        return count
    
    @staticmethod
    def _generate_secure_code() -> str:
        """
        Generate a cryptographically secure 4-digit code
        
        Returns:
            4-digit string code
        """
        # Use secrets module for cryptographically secure random generation
        # Generate a number between 0000 and 9999
        code_int = secrets.randbelow(10000)
        
        # Format as 4-digit string with leading zeros
        return f"{code_int:04d}"
    
    @staticmethod
    def get_user_reset_code_status(user: User) -> Dict[str, any]:
        """
        Get the current reset code status for a user
        
        Args:
            user: The user to check
            
        Returns:
            Dictionary with reset code status information
        """
        reset_code = PasswordResetCode.objects.filter(
            user=user,
            is_used=False
        ).order_by('-created_at').first()
        
        if not reset_code:
            return {
                "has_active_code": False,
                "code": None,
                "expires_at": None,
                "attempts": 0,
                "max_attempts": 3,
                "is_expired": False,
                "is_valid": False
            }
        
        return {
            "has_active_code": True,
            "code": reset_code,
            "expires_at": reset_code.expires_at,
            "attempts": reset_code.attempts,
            "max_attempts": reset_code.max_attempts,
            "is_expired": reset_code.is_expired,
            "is_valid": reset_code.is_valid
        }
    
    @staticmethod
    def validate_password_change_eligibility(user: User) -> Tuple[bool, str]:
        """
        Validate if user is eligible for password change based on recent changes
        
        Args:
            user: The user requesting password change
            
        Returns:
            Tuple of (is_eligible, reason)
        """
        # Check if user has changed password recently (within last hour)
        if user.password_last_changed:
            time_since_change = timezone.now() - user.password_last_changed
            if time_since_change < timedelta(hours=1):
                remaining_time = timedelta(hours=1) - time_since_change
                minutes_remaining = int(remaining_time.total_seconds() / 60)
                return False, f"Password was recently changed. Please wait {minutes_remaining} minutes before requesting another reset."
        
        return True, "User is eligible for password reset"
    
    @staticmethod
    def update_password_change_timestamp(user: User) -> None:
        """
        Update the password_last_changed timestamp for a user
        
        Args:
            user: The user whose password was changed
        """
        user.password_last_changed = timezone.now()
        user.save(update_fields=['password_last_changed'])
    
    @staticmethod
    def get_brute_force_protection_status(user: User) -> Dict[str, any]:
        """
        Get brute force protection status for a user
        
        Args:
            user: The user to check
            
        Returns:
            Dictionary with protection status information
        """
        reset_code = PasswordResetCode.objects.filter(
            user=user,
            is_used=False
        ).order_by('-created_at').first()
        
        if not reset_code:
            return {
                "is_protected": False,
                "attempts_made": 0,
                "max_attempts": 3,
                "attempts_remaining": 3,
                "is_locked": False
            }
        
        attempts_remaining = max(0, reset_code.max_attempts - reset_code.attempts)
        is_locked = reset_code.attempts >= reset_code.max_attempts
        
        return {
            "is_protected": True,
            "attempts_made": reset_code.attempts,
            "max_attempts": reset_code.max_attempts,
            "attempts_remaining": attempts_remaining,
            "is_locked": is_locked,
            "expires_at": reset_code.expires_at
        }