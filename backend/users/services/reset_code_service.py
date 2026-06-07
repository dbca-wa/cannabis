"""Password reset code management service with secure generation and validation."""

import logging
import secrets
from datetime import timedelta
from typing import Dict, Optional, Tuple

from django.contrib.auth.hashers import check_password, make_password
from django.utils import timezone

from ..error_handlers import SecurityEventLogger
from ..models import PasswordResetCode, User

logger = logging.getLogger(__name__)


class PasswordResetCodeService:
    """Service for managing password reset codes with secure generation and validation."""

    @staticmethod
    def generate_reset_code(user: User) -> PasswordResetCode:
        """
        Generate a new 4-digit password reset code for a user.

        Args:
            user: The user requesting password reset

        Returns:
            PasswordResetCode instance

        Raises:
            ValueError: If user already has an active reset code
        """
        from django.db import transaction

        with transaction.atomic():
            expired_count = PasswordResetCode.objects.filter(
                user=user, expires_at__lt=timezone.now()
            ).delete()[0]

            used_count = PasswordResetCode.objects.filter(
                user=user, is_used=True
            ).delete()[0]

            if expired_count > 0 or used_count > 0:
                logger.info(
                    f"Cleaned up {expired_count} expired and {used_count} "
                    f"used reset codes for user {user.email}"
                )

            existing_code = PasswordResetCode.objects.filter(
                user=user, is_used=False, expires_at__gt=timezone.now()
            ).first()

            if existing_code:
                logger.warning(
                    f"User {user.email} already has an active reset code "
                    f"(created: {existing_code.created_at}, expires: {existing_code.expires_at})"
                )
                raise ValueError("User already has an active reset code")

            code = PasswordResetCodeService._generate_secure_code()
            code_hash = make_password(code)

            reset_code = PasswordResetCode.objects.create(
                user=user,
                code_hash=code_hash,
                expires_at=timezone.now() + timedelta(hours=24),
            )

            reset_code._plain_code = code

            SecurityEventLogger.log_reset_code_generated(
                email=user.email, code_prefix=code[:2] + "**"
            )

            logger.info(
                f"Generated new reset code for user {user.email} "
                f"(expires: {reset_code.expires_at})"
            )

            return reset_code

    @staticmethod
    def verify_reset_code(
        user: User, code: str
    ) -> Tuple[bool, Optional[PasswordResetCode], str]:
        """
        Verify a password reset code for a user.

        Args:
            user: The user attempting to verify the code
            code: The 4-digit code to verify

        Returns:
            Tuple of (is_valid, reset_code_instance, error_message)
        """
        reset_code = (
            PasswordResetCode.objects.filter(user=user, is_used=False)
            .order_by("-created_at")
            .first()
        )

        code_prefix = code[:2] + "**" if len(code) >= 2 else "**"

        if not reset_code:
            SecurityEventLogger.log_reset_code_verification_attempt(
                email=user.email,
                code_prefix=code_prefix,
                success=False,
                reason="No active reset code found",
            )
            return False, None, "No active reset code found"

        if reset_code.is_expired:
            SecurityEventLogger.log_reset_code_expired(
                email=user.email, code_prefix=code_prefix
            )
            return False, reset_code, "Reset code has expired"

        if reset_code.attempts >= reset_code.max_attempts:
            SecurityEventLogger.log_reset_code_brute_force_attempt(
                email=user.email, attempt_count=reset_code.attempts
            )
            return False, reset_code, "Maximum verification attempts exceeded"

        if check_password(code, reset_code.code_hash):
            from django.db import transaction

            with transaction.atomic():
                reset_code.refresh_from_db()

                if reset_code.is_used:
                    logger.warning(
                        f"Reset code for {user.email} was already used "
                        "(race condition detected)"
                    )
                    return False, reset_code, "Reset code has already been used"

                reset_code.is_used = True
                reset_code.used_at = timezone.now()
                reset_code.save(update_fields=["is_used", "used_at"])

                logger.info(f"Reset code for {user.email} marked as used successfully")

            SecurityEventLogger.log_reset_code_verification_attempt(
                email=user.email,
                code_prefix=code_prefix,
                success=True,
                attempt_count=reset_code.attempts,
            )

            return True, reset_code, "Code verified successfully"
        else:
            from django.db import transaction

            with transaction.atomic():
                reset_code.refresh_from_db()
                reset_code.attempts += 1
                reset_code.save(update_fields=["attempts"])

                logger.info(
                    f"Incremented attempt count for {user.email} "
                    f"to {reset_code.attempts}/{reset_code.max_attempts}"
                )

            SecurityEventLogger.log_reset_code_verification_attempt(
                email=user.email,
                code_prefix=code_prefix,
                success=False,
                reason="Invalid reset code",
                attempt_count=reset_code.attempts,
            )

            if reset_code.attempts >= reset_code.max_attempts - 1:
                SecurityEventLogger.log_reset_code_brute_force_attempt(
                    email=user.email, attempt_count=reset_code.attempts
                )

            return False, reset_code, "Invalid reset code"

    @staticmethod
    def cleanup_expired_codes() -> int:
        """
        Clean up expired and used reset codes across all users.

        Returns:
            Number of codes cleaned up
        """
        expired_count = PasswordResetCode.objects.filter(
            expires_at__lt=timezone.now()
        ).delete()[0]

        old_used_count = PasswordResetCode.objects.filter(
            is_used=True, used_at__lt=timezone.now() - timedelta(days=7)
        ).delete()[0]

        total_cleaned = expired_count + old_used_count

        if total_cleaned > 0:
            logger.info(
                f"Cleaned up {expired_count} expired and "
                f"{old_used_count} old used reset codes"
            )

        return total_cleaned

    @staticmethod
    def invalidate_user_reset_codes(user: User) -> int:
        """
        Invalidate all active reset codes for a user.

        Args:
            user: The user whose codes should be invalidated

        Returns:
            Number of codes invalidated
        """
        codes_to_invalidate = PasswordResetCode.objects.filter(user=user, is_used=False)

        for reset_code in codes_to_invalidate:
            SecurityEventLogger.log_reset_code_invalidated(
                email=user.email,
                code_prefix="****",
                reason="User password changed or new code requested",
            )

        count = codes_to_invalidate.update(is_used=True, used_at=timezone.now())
        return count

    @staticmethod
    def _generate_secure_code() -> str:
        """
        Generate a cryptographically secure 4-digit code.

        Returns:
            4-digit string code
        """
        code_int = secrets.randbelow(10000)
        return f"{code_int:04d}"

    @staticmethod
    def get_user_reset_code_status(user: User) -> Dict:
        """
        Get the current reset code status for a user.

        Args:
            user: The user to check

        Returns:
            Dictionary with reset code status information
        """
        reset_code = (
            PasswordResetCode.objects.filter(user=user, is_used=False)
            .order_by("-created_at")
            .first()
        )

        if not reset_code:
            return {
                "has_active_code": False,
                "code": None,
                "expires_at": None,
                "attempts": 0,
                "max_attempts": 3,
                "is_expired": False,
                "is_valid": False,
            }

        return {
            "has_active_code": True,
            "code": reset_code,
            "expires_at": reset_code.expires_at,
            "attempts": reset_code.attempts,
            "max_attempts": reset_code.max_attempts,
            "is_expired": reset_code.is_expired,
            "is_valid": reset_code.is_valid,
        }

    @staticmethod
    def validate_password_change_eligibility(user: User) -> Tuple[bool, str]:
        """
        Validate if user is eligible for password change based on recent changes.

        Args:
            user: The user requesting password change

        Returns:
            Tuple of (is_eligible, reason)
        """
        if user.password_last_changed:
            time_since_change = timezone.now() - user.password_last_changed
            if time_since_change < timedelta(hours=1):
                remaining_time = timedelta(hours=1) - time_since_change
                minutes_remaining = int(remaining_time.total_seconds() / 60)
                return (
                    False,
                    f"Password was recently changed. Please wait "
                    f"{minutes_remaining} minutes before requesting another reset.",
                )

        return True, "User is eligible for password reset"

    @staticmethod
    def update_password_change_timestamp(user: User) -> None:
        """
        Update the password_last_changed timestamp for a user.

        Args:
            user: The user whose password was changed
        """
        user.password_last_changed = timezone.now()
        user.save(update_fields=["password_last_changed"])

    @staticmethod
    def get_brute_force_protection_status(user: User) -> Dict:
        """
        Get brute force protection status for a user.

        Args:
            user: The user to check

        Returns:
            Dictionary with protection status information
        """
        reset_code = (
            PasswordResetCode.objects.filter(user=user, is_used=False)
            .order_by("-created_at")
            .first()
        )

        if not reset_code:
            return {
                "is_protected": False,
                "attempts_made": 0,
                "max_attempts": 3,
                "attempts_remaining": 3,
                "is_locked": False,
            }

        attempts_remaining = max(0, reset_code.max_attempts - reset_code.attempts)
        is_locked = reset_code.attempts >= reset_code.max_attempts

        return {
            "is_protected": True,
            "attempts_made": reset_code.attempts,
            "max_attempts": reset_code.max_attempts,
            "attempts_remaining": attempts_remaining,
            "is_locked": is_locked,
            "expires_at": reset_code.expires_at,
        }
