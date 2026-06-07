"""Tests for user services (password validation, etc.)."""

from django.test import TestCase

from users.services import PasswordValidator


class PasswordValidatorTestCase(TestCase):
    """Test cases for password validation service"""

    def test_valid_password(self):
        """Test validation of a strong password"""
        password = "StrongPassword123!"
        is_valid, errors = PasswordValidator.validate_password(password)

        self.assertTrue(is_valid)
        self.assertEqual(len(errors), 0)

    def test_password_too_short(self):
        """Test validation of password that's too short"""
        password = "Short1!"
        is_valid, errors = PasswordValidator.validate_password(password)

        self.assertFalse(is_valid)
        self.assertIn("Password must be at least 10 characters long", errors)

    def test_password_no_letter(self):
        """Test validation of password without letters"""
        password = "1234567890!"
        is_valid, errors = PasswordValidator.validate_password(password)

        self.assertFalse(is_valid)
        self.assertIn("Password must contain at least one letter", errors)

    def test_password_no_number(self):
        """Test validation of password without numbers"""
        password = "PasswordOnly!"
        is_valid, errors = PasswordValidator.validate_password(password)

        self.assertFalse(is_valid)
        self.assertIn("Password must contain at least one number", errors)

    def test_password_no_special_char(self):
        """Test validation of password without special characters"""
        password = "Password123"
        is_valid, errors = PasswordValidator.validate_password(password)

        self.assertFalse(is_valid)
        self.assertTrue(
            any(
                "Password must contain at least one special character" in error
                for error in errors
            )
        )

    def test_password_strength_calculation(self):
        """Test password strength calculation"""
        # Strong password
        strong_password = "VeryStrongPassword123!"
        strength_info = PasswordValidator.get_password_strength(strong_password)

        self.assertTrue(strength_info["is_valid"])
        self.assertEqual(strength_info["score"], 100)
        self.assertEqual(strength_info["strength_level"], "strong")
        self.assertEqual(strength_info["criteria_met"], 4)

        # Weak password
        weak_password = "weak"
        strength_info = PasswordValidator.get_password_strength(weak_password)

        self.assertFalse(strength_info["is_valid"])
        self.assertLess(strength_info["score"], 100)
        self.assertEqual(strength_info["strength_level"], "very_weak")
