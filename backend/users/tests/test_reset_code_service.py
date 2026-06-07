"""Tests for PasswordResetCodeService."""

from datetime import timedelta

import pytest
from django.contrib.auth import get_user_model
from django.utils import timezone

from users.models import PasswordResetCode
from users.services import PasswordResetCodeService, PasswordValidator

User = get_user_model()


@pytest.fixture
def reset_user(db):
    """Create a user for password reset testing."""
    return User.objects.create_user(
        email="reset@example.com",
        password="OldPassword123!",
        first_name="Reset",
        last_name="User",
    )


@pytest.fixture
def active_reset_code(db, reset_user):
    """Create an active reset code for the user."""
    from django.contrib.auth.hashers import make_password

    code = "1234"
    return PasswordResetCode.objects.create(
        user=reset_user,
        code_hash=make_password(code),
        expires_at=timezone.now() + timedelta(hours=24),
    )


@pytest.mark.django_db
class TestPasswordResetCodeService:
    """Tests for PasswordResetCodeService."""

    def test_generate_reset_code(self, reset_user):
        """generate_reset_code creates a new code for user."""
        reset_code = PasswordResetCodeService.generate_reset_code(reset_user)

        assert reset_code is not None
        assert reset_code.user == reset_user
        assert hasattr(reset_code, "_plain_code")
        assert len(reset_code._plain_code) == 4
        assert reset_code._plain_code.isdigit()

    def test_generate_reset_code_duplicate_raises(self, reset_user):
        """generate_reset_code raises ValueError if active code exists."""
        PasswordResetCodeService.generate_reset_code(reset_user)

        with pytest.raises(ValueError, match="already has an active reset code"):
            PasswordResetCodeService.generate_reset_code(reset_user)

    def test_verify_reset_code_valid(self, reset_user):
        """verify_reset_code returns True for correct code."""
        reset_code = PasswordResetCodeService.generate_reset_code(reset_user)
        plain_code = reset_code._plain_code

        is_valid, code_instance, message = PasswordResetCodeService.verify_reset_code(
            reset_user, plain_code
        )

        assert is_valid is True
        assert "verified" in message.lower()

    def test_verify_reset_code_invalid(self, reset_user):
        """verify_reset_code returns False for wrong code."""
        PasswordResetCodeService.generate_reset_code(reset_user)

        is_valid, code_instance, message = PasswordResetCodeService.verify_reset_code(
            reset_user, "0000"
        )

        assert is_valid is False
        assert "invalid" in message.lower()

    def test_verify_reset_code_expired(self, reset_user):
        """verify_reset_code returns False for expired code."""
        from django.contrib.auth.hashers import make_password

        PasswordResetCode.objects.create(
            user=reset_user,
            code_hash=make_password("5678"),
            expires_at=timezone.now() - timedelta(hours=1),
        )

        is_valid, code_instance, message = PasswordResetCodeService.verify_reset_code(
            reset_user, "5678"
        )

        assert is_valid is False
        assert "expired" in message.lower()

    def test_verify_reset_code_max_attempts(self, reset_user):
        """verify_reset_code returns False when max attempts exceeded."""
        from django.contrib.auth.hashers import make_password

        PasswordResetCode.objects.create(
            user=reset_user,
            code_hash=make_password("9999"),
            expires_at=timezone.now() + timedelta(hours=24),
            attempts=3,
            max_attempts=3,
        )

        is_valid, code_instance, message = PasswordResetCodeService.verify_reset_code(
            reset_user, "9999"
        )

        assert is_valid is False
        assert "maximum" in message.lower()

    def test_verify_no_active_code(self, reset_user):
        """verify_reset_code returns False when no active code exists."""
        is_valid, code_instance, message = PasswordResetCodeService.verify_reset_code(
            reset_user, "1234"
        )

        assert is_valid is False
        assert code_instance is None

    def test_cleanup_expired_codes(self, reset_user):
        """cleanup_expired_codes removes expired codes."""
        from django.contrib.auth.hashers import make_password

        # Create expired code
        PasswordResetCode.objects.create(
            user=reset_user,
            code_hash=make_password("1111"),
            expires_at=timezone.now() - timedelta(hours=48),
        )

        count = PasswordResetCodeService.cleanup_expired_codes()
        assert count >= 1

    def test_validate_password_change_eligibility_eligible(self, reset_user):
        """User without recent password change is eligible."""
        is_eligible, reason = (
            PasswordResetCodeService.validate_password_change_eligibility(reset_user)
        )

        assert is_eligible is True

    def test_validate_password_change_eligibility_recent_change(self, reset_user):
        """User with recent password change is not eligible."""
        reset_user.password_last_changed = timezone.now()
        reset_user.save()

        is_eligible, reason = (
            PasswordResetCodeService.validate_password_change_eligibility(reset_user)
        )

        assert is_eligible is False
        assert "recently changed" in reason.lower()


@pytest.mark.django_db
class TestPasswordValidatorExtended:
    """Extended tests for PasswordValidator."""

    def test_strength_fair_password(self):
        """Password with partial criteria gets fair rating."""
        # Has length and letters but no number or special
        strength = PasswordValidator.get_password_strength("abcdefghijk")

        assert strength["is_valid"] is False
        assert strength["criteria_met"] == 2  # length + letter

    def test_strength_good_password(self):
        """Password missing one criterion gets good rating."""
        # Has length, letters, numbers but no special char
        strength = PasswordValidator.get_password_strength("Password123")

        assert strength["is_valid"] is False
        assert strength["score"] == 80
        assert strength["strength_level"] == "good"

    def test_requirements_dict(self):
        """get_password_strength returns requirements breakdown."""
        strength = PasswordValidator.get_password_strength("StrongPass1!")

        assert strength["requirements"]["min_length"] is True
        assert strength["requirements"]["has_letter"] is True
        assert strength["requirements"]["has_number"] is True
        assert strength["requirements"]["has_special"] is True

    def test_all_numbers_no_letter(self):
        """Password with only numbers fails letter check."""
        is_valid, errors = PasswordValidator.validate_password("1234567890!")

        assert is_valid is False
        assert any("letter" in e for e in errors)
