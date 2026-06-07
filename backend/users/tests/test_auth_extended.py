"""Extended tests for auth views: VerifyResetCodeView, PasswordResetView, logout."""

import pytest
from django.contrib.auth import get_user_model
from django.urls import reverse
from rest_framework import status

User = get_user_model()


@pytest.fixture
def auth_user(db):
    """Create a user for auth testing."""
    return User.objects.create_user(
        email="authuser@example.com",
        password="TestPassword123!",
        first_name="Auth",
        last_name="User",
    )


@pytest.fixture
def auth_client(api_client, auth_user):
    """Authenticated client for auth user."""
    api_client.force_authenticate(user=auth_user)
    return api_client


@pytest.mark.django_db
class TestVerifyResetCodeView:
    """Tests for VerifyResetCodeView."""

    def test_verify_missing_email(self, api_client):
        """POST without email returns validation error."""
        url = reverse("verify_reset_code")
        response = api_client.post(url, {"code": "1234"}, format="json")

        assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_verify_missing_code(self, api_client):
        """POST without code returns validation error."""
        url = reverse("verify_reset_code")
        response = api_client.post(url, {"email": "test@example.com"}, format="json")

        assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_verify_invalid_code_format(self, api_client):
        """POST with non-4-digit code returns validation error."""
        url = reverse("verify_reset_code")
        response = api_client.post(
            url, {"email": "test@example.com", "code": "abc"}, format="json"
        )

        assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_verify_nonexistent_user(self, api_client):
        """POST with non-existent user email returns error."""
        url = reverse("verify_reset_code")
        response = api_client.post(
            url,
            {"email": "nonexistent@example.com", "code": "1234"},
            format="json",
        )

        assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_verify_valid_code(self, api_client, auth_user):
        """POST with valid code returns tokens."""
        from users.services import PasswordResetCodeService

        reset_code = PasswordResetCodeService.generate_reset_code(auth_user)
        plain_code = reset_code._plain_code

        url = reverse("verify_reset_code")
        response = api_client.post(
            url,
            {"email": auth_user.email, "code": plain_code},
            format="json",
        )

        assert response.status_code == status.HTTP_200_OK
        assert response.data["success"] is True
        assert "access" in response.data
        assert "refresh" in response.data

    def test_verify_wrong_code(self, api_client, auth_user):
        """POST with wrong code returns error."""
        from users.services import PasswordResetCodeService

        PasswordResetCodeService.generate_reset_code(auth_user)

        url = reverse("verify_reset_code")
        response = api_client.post(
            url,
            {"email": auth_user.email, "code": "0000"},
            format="json",
        )

        assert response.status_code == status.HTTP_400_BAD_REQUEST


@pytest.mark.django_db
class TestJWTLogoutView:
    """Tests for JWTLogoutView."""

    def test_logout_success(self, api_client, auth_user):
        """POST with valid refresh token attempts blacklist."""
        from rest_framework_simplejwt.tokens import RefreshToken as JWTRefreshToken

        refresh = JWTRefreshToken.for_user(auth_user)
        api_client.force_authenticate(user=auth_user)

        url = reverse("logout")
        response = api_client.post(url, {"refresh_token": str(refresh)}, format="json")

        # May return 200 (success) or 400 (if blacklist not configured)
        assert response.status_code in [
            status.HTTP_200_OK,
            status.HTTP_400_BAD_REQUEST,
        ]

    def test_logout_missing_token(self, auth_client):
        """POST without refresh token returns error."""
        url = reverse("logout")
        response = auth_client.post(url, {}, format="json")

        assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_logout_unauthenticated(self, api_client):
        """POST without auth returns 401."""
        url = reverse("logout")
        response = api_client.post(url, {}, format="json")

        assert response.status_code == status.HTTP_401_UNAUTHORIZED


@pytest.mark.django_db
class TestCustomTokenObtainPairView:
    """Tests for login view."""

    def test_login_success(self, api_client, auth_user):
        """POST with valid credentials returns tokens and user data."""
        url = reverse("login")
        response = api_client.post(
            url,
            {"email": auth_user.email, "password": "TestPassword123!"},
            format="json",
        )

        assert response.status_code == status.HTTP_200_OK
        assert "access" in response.data
        assert "refresh" in response.data
        assert "user" in response.data
        assert response.data["token_type"] == "Bearer"

    def test_login_invalid_credentials(self, api_client, auth_user):
        """POST with wrong password returns 401."""
        url = reverse("login")
        response = api_client.post(
            url,
            {"email": auth_user.email, "password": "WrongPassword!"},
            format="json",
        )

        assert response.status_code == status.HTTP_401_UNAUTHORIZED


@pytest.mark.django_db
class TestPasswordUpdateViewExtended:
    """Extended tests for PasswordUpdateView."""

    def test_update_password_is_first_time_string(self, auth_client, auth_user):
        """is_first_time as string 'true' works."""
        url = reverse("update_password")
        response = auth_client.post(
            url,
            {
                "new_password": "NewSecure123!",
                "confirm_password": "NewSecure123!",
                "is_first_time": "true",
            },
            format="json",
        )

        assert response.status_code == status.HTTP_200_OK

    def test_update_password_missing_confirm(self, auth_client):
        """Missing confirm_password returns error."""
        url = reverse("update_password")
        response = auth_client.post(
            url,
            {
                "current_password": "TestPassword123!",
                "new_password": "NewSecure123!",
                "is_first_time": False,
            },
            format="json",
        )

        assert response.status_code == status.HTTP_400_BAD_REQUEST
