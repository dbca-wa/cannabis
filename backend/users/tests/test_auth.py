"""Tests for authentication and password management views."""

from django.contrib.auth import get_user_model
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase
from rest_framework_simplejwt.tokens import RefreshToken

User = get_user_model()


class PasswordUpdateAPITestCase(APITestCase):
    """Test cases for password update API endpoint"""

    def setUp(self):
        """Set up test data"""
        self.user = User.objects.create_user(
            email="test@example.com",
            password="OldPassword123!",
            first_name="Test",
            last_name="User",
        )

        # Create JWT token for authentication
        refresh = RefreshToken.for_user(self.user)
        self.access_token = str(refresh.access_token)

        # Set up API client with authentication
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {self.access_token}")

        # URL for password update endpoint
        self.password_update_url = reverse("update_password")

    def test_password_update_success(self):
        """Test successful password update with valid current password"""
        data = {
            "current_password": "OldPassword123!",
            "new_password": "NewPassword456@",
            "confirm_password": "NewPassword456@",
            "is_first_time": False,
        }
        response = self.client.post(self.password_update_url, data)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("message", response.data)
        self.assertIn("password_last_changed", response.data)

        # Verify password was actually changed
        self.user.refresh_from_db()
        self.assertTrue(self.user.check_password("NewPassword456@"))
        self.assertIsNotNone(self.user.password_last_changed)

    def test_password_update_first_time(self):
        """Test first-time password update (no current password required)"""
        data = {
            "new_password": "FirstPassword789#",
            "confirm_password": "FirstPassword789#",
            "is_first_time": True,
        }
        response = self.client.post(self.password_update_url, data)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("message", response.data)

        # Verify password was changed
        self.user.refresh_from_db()
        self.assertTrue(self.user.check_password("FirstPassword789#"))

    def test_password_update_wrong_current_password(self):
        """Test password update with incorrect current password"""
        data = {
            "current_password": "WrongPassword123!",
            "new_password": "NewPassword456@",
            "confirm_password": "NewPassword456@",
            "is_first_time": False,
        }
        response = self.client.post(self.password_update_url, data)

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn(
            "The current password you entered is incorrect", response.data["detail"]
        )

    def test_password_update_passwords_dont_match(self):
        """Test password update when new passwords don't match"""
        data = {
            "current_password": "OldPassword123!",
            "new_password": "NewPassword456@",
            "confirm_password": "DifferentPassword789#",
            "is_first_time": False,
        }
        response = self.client.post(self.password_update_url, data)

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("The passwords you entered don't match", response.data["detail"])

    def test_password_update_weak_password(self):
        """Test password update with weak password"""
        data = {
            "current_password": "OldPassword123!",
            "new_password": "weak",
            "confirm_password": "weak",
            "is_first_time": False,
        }
        response = self.client.post(self.password_update_url, data)

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn(
            "Your password doesn't meet the security requirements",
            response.data["detail"],
        )
        self.assertIn("new_password", response.data)

    def test_password_update_missing_current_password(self):
        """Test password update without current password for existing user"""
        data = {
            "new_password": "NewPassword456@",
            "confirm_password": "NewPassword456@",
            "is_first_time": False,
        }
        response = self.client.post(self.password_update_url, data)

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn(
            "Current password is required",
            str(response.data.get("current_password", [])),
        )

    def test_password_update_missing_new_password(self):
        """Test password update without new password"""
        data = {
            "current_password": "OldPassword123!",
            "confirm_password": "NewPassword456@",
            "is_first_time": False,
        }
        response = self.client.post(self.password_update_url, data)

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn(
            "New password is required", str(response.data.get("new_password", []))
        )

    def test_password_update_unauthenticated(self):
        """Test password update without authentication"""
        self.client.credentials()  # Remove authentication
        data = {
            "current_password": "OldPassword123!",
            "new_password": "NewPassword456@",
            "confirm_password": "NewPassword456@",
            "is_first_time": False,
        }
        response = self.client.post(self.password_update_url, data)

        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)
