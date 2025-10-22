from django.test import TestCase
from django.contrib.auth import get_user_model
from django.urls import reverse
from rest_framework.test import APITestCase
from rest_framework import status
from rest_framework_simplejwt.tokens import RefreshToken
from users.models import UserPreferences
from users.services import PasswordValidator

User = get_user_model()


class UserPreferencesAPITestCase(APITestCase):
    """Test cases for user preferences API endpoints"""

    def setUp(self):
        """Set up test data"""
        self.user = User.objects.create_user(
            email="test@example.com",
            password="testpass123",
            first_name="Test",
            last_name="User",
        )

        # Create JWT token for authentication
        refresh = RefreshToken.for_user(self.user)
        self.access_token = str(refresh.access_token)

        # Set up API client with authentication
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {self.access_token}")

        # URL for preferences endpoint
        self.preferences_url = reverse("preferences")

    def test_get_preferences_authenticated(self):
        """Test getting user preferences when authenticated"""
        response = self.client.get(self.preferences_url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("theme", response.data)
        self.assertIn("loader_style", response.data)
        self.assertIn("default_search_settings", response.data)
        self.assertIn("ui_preferences", response.data)

        # Check default values
        self.assertEqual(response.data["theme"], "system")
        self.assertEqual(response.data["loader_style"], "minimal")
        self.assertEqual(response.data["default_search_settings"], {})
        self.assertEqual(response.data["ui_preferences"], {})

    def test_get_preferences_unauthenticated(self):
        """Test getting preferences without authentication fails"""
        self.client.credentials()  # Remove authentication
        response = self.client.get(self.preferences_url)

        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_update_theme_preference(self):
        """Test updating theme preference"""
        data = {"theme": "dark"}
        response = self.client.patch(self.preferences_url, data)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["theme"], "dark")

        # Verify in database
        preferences = UserPreferences.objects.get(user=self.user)
        self.assertEqual(preferences.theme, "dark")

    def test_update_loader_style_preference(self):
        """Test updating loader style preference"""
        data = {"loader_style": "cook"}
        response = self.client.patch(self.preferences_url, data)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["loader_style"], "cook")

        # Verify in database
        preferences = UserPreferences.objects.get(user=self.user)
        self.assertEqual(preferences.loader_style, "cook")

    def test_update_search_settings(self):
        """Test updating default search settings"""
        search_settings = {"userKindFilter": "DBCA", "userSearchFilter": "test search"}
        data = {"default_search_settings": search_settings}
        response = self.client.patch(self.preferences_url, data, format="json")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["default_search_settings"], search_settings)

        # Verify in database
        preferences = UserPreferences.objects.get(user=self.user)
        self.assertEqual(preferences.default_search_settings, search_settings)

    def test_update_ui_preferences(self):
        """Test updating UI preferences"""
        ui_prefs = {"sidebarCollapsed": True, "dataViewMode": "grid"}
        data = {"ui_preferences": ui_prefs}
        response = self.client.patch(self.preferences_url, data, format="json")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["ui_preferences"], ui_prefs)

        # Verify in database
        preferences = UserPreferences.objects.get(user=self.user)
        self.assertEqual(preferences.ui_preferences, ui_prefs)

    def test_update_multiple_preferences(self):
        """Test updating multiple preferences at once"""
        data = {
            "theme": "light",
            "loader_style": "base",
            "default_search_settings": {"filter": "all"},
            "ui_preferences": {"mode": "compact"},
        }
        response = self.client.patch(self.preferences_url, data, format="json")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["theme"], "light")
        self.assertEqual(response.data["loader_style"], "base")
        self.assertEqual(response.data["default_search_settings"], {"filter": "all"})
        self.assertEqual(response.data["ui_preferences"], {"mode": "compact"})

    def test_invalid_theme_value(self):
        """Test updating with invalid theme value"""
        data = {"theme": "invalid_theme"}
        response = self.client.patch(self.preferences_url, data)

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("theme", response.data)

    def test_invalid_loader_style_value(self):
        """Test updating with invalid loader style value"""
        data = {"loader_style": "invalid_loader"}
        response = self.client.patch(self.preferences_url, data)

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("loader_style", response.data)

    def test_invalid_json_structure(self):
        """Test updating with invalid JSON structure for JSON fields"""
        data = {"default_search_settings": "not_a_dict"}
        response = self.client.patch(self.preferences_url, data)

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("default_search_settings", response.data)

    def test_preferences_are_user_specific(self):
        """Test that users can only access their own preferences"""
        # Create another user
        other_user = User.objects.create_user(
            email="other@example.com",
            password="otherpass123",
            first_name="Other",
            last_name="User",
        )

        # Update current user's preferences
        data = {"theme": "dark", "loader_style": "cook"}
        response = self.client.patch(self.preferences_url, data, format="json")
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        # Create token for other user
        other_refresh = RefreshToken.for_user(other_user)
        other_access_token = str(other_refresh.access_token)

        # Switch to other user's credentials
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {other_access_token}")

        # Get other user's preferences (should be defaults, not the updated ones)
        response = self.client.get(self.preferences_url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["theme"], "system")  # Default value
        self.assertEqual(response.data["loader_style"], "minimal")  # Default value

        # Verify original user still has their preferences
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {self.access_token}")
        response = self.client.get(self.preferences_url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["theme"], "dark")  # Updated value
        self.assertEqual(response.data["loader_style"], "cook")  # Updated value


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
            "is_first_time": False
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
            "is_first_time": True
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
            "is_first_time": False
        }
        response = self.client.post(self.password_update_url, data)

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("The current password you entered is incorrect", response.data["message"])

    def test_password_update_passwords_dont_match(self):
        """Test password update when new passwords don't match"""
        data = {
            "current_password": "OldPassword123!",
            "new_password": "NewPassword456@",
            "confirm_password": "DifferentPassword789#",
            "is_first_time": False
        }
        response = self.client.post(self.password_update_url, data)

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("The passwords you entered don't match", response.data["message"])

    def test_password_update_weak_password(self):
        """Test password update with weak password"""
        data = {
            "current_password": "OldPassword123!",
            "new_password": "weak",
            "confirm_password": "weak",
            "is_first_time": False
        }
        response = self.client.post(self.password_update_url, data)

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("Your password doesn't meet the security requirements", response.data["message"])
        self.assertIn("field_errors", response.data)

    def test_password_update_missing_current_password(self):
        """Test password update without current password for existing user"""
        data = {
            "new_password": "NewPassword456@",
            "confirm_password": "NewPassword456@",
            "is_first_time": False
        }
        response = self.client.post(self.password_update_url, data)

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("Current password is required", str(response.data.get("field_errors", {})))

    def test_password_update_missing_new_password(self):
        """Test password update without new password"""
        data = {
            "current_password": "OldPassword123!",
            "confirm_password": "NewPassword456@",
            "is_first_time": False
        }
        response = self.client.post(self.password_update_url, data)

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("New password is required", str(response.data.get("field_errors", {})))

    def test_password_update_unauthenticated(self):
        """Test password update without authentication"""
        self.client.credentials()  # Remove authentication
        data = {
            "current_password": "OldPassword123!",
            "new_password": "NewPassword456@",
            "confirm_password": "NewPassword456@",
            "is_first_time": False
        }
        response = self.client.post(self.password_update_url, data)

        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)


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
        self.assertTrue(any("Password must contain at least one special character" in error for error in errors))

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
