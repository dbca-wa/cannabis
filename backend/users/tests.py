from django.test import TestCase
from django.contrib.auth import get_user_model
from django.urls import reverse
from rest_framework.test import APITestCase
from rest_framework import status
from rest_framework_simplejwt.tokens import RefreshToken
from users.models import UserPreferences

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
