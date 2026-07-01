"""
JWT + SSO Authentication Service.

Reusable authentication module encapsulating JWT token generation,
refresh logic, and SSO validation. Designed to be portable across
Django REST Framework projects using SimpleJWT.

Usage in other Django projects:
    1. Install djangorestframework-simplejwt and djangorestframework
    2. Copy this module and configure SIMPLE_JWT in settings.py
    3. Import and use AuthService static methods in your views

Configuration (settings.py):
    SIMPLE_JWT = {
        "ACCESS_TOKEN_LIFETIME": timedelta(minutes=60),
        "REFRESH_TOKEN_LIFETIME": timedelta(days=7),
        "ROTATE_REFRESH_TOKENS": True,
        "BLACKLIST_AFTER_ROTATION": True,
        "UPDATE_LAST_LOGIN": True,
        "SIGNING_KEY": SECRET_KEY,
        "ALGORITHM": "HS256",
    }

    REST_FRAMEWORK = {
        "DEFAULT_AUTHENTICATION_CLASSES": [
            "rest_framework_simplejwt.authentication.JWTAuthentication",
        ],
    }
"""

import logging

from django.conf import settings
from django.contrib.auth import authenticate, get_user_model
from rest_framework.exceptions import AuthenticationFailed, ValidationError
from rest_framework_simplejwt.tokens import RefreshToken

logger = logging.getLogger(__name__)
User = get_user_model()


class AuthService:
    """
    Stateless authentication service for JWT + SSO workflows.

    All methods are static — no instance state is required.
    Raises DRF exceptions on failure for consistent error handling.
    """

    # ------------------------------------------------------------------
    # JWT Authentication
    # ------------------------------------------------------------------

    @staticmethod
    def authenticate_user(email: str, password: str) -> dict:
        """
        Authenticate a user by email/password and return JWT tokens.

        Returns a dict containing:
            - access: str (JWT access token)
            - refresh: str (JWT refresh token)
            - token_type: "Bearer"
            - expires_in: float (access token lifetime in seconds)
            - user: User instance

        Raises:
            AuthenticationFailed: If credentials are invalid or user inactive.
        """
        if not email or not password:
            raise ValidationError({"detail": "Email and password are required."})

        user = authenticate(username=email, password=password)

        if user is None:
            logger.warning(f"Failed login attempt for email: {email}")
            raise AuthenticationFailed("Invalid email or password.")

        if not user.is_active:
            logger.warning(f"Login attempt for inactive user: {email}")
            raise AuthenticationFailed("User account is disabled.")

        tokens = AuthService._generate_tokens(user)
        tokens["user"] = user
        return tokens

    @staticmethod
    def refresh_token(refresh_token_str: str) -> dict:
        """
        Validate a refresh token and return a new access token.

        If ROTATE_REFRESH_TOKENS is enabled in settings, a new
        refresh token is also returned and the old one is blacklisted.

        Returns a dict containing:
            - access: str (new JWT access token)
            - refresh: str (new refresh token, if rotation enabled)
            - token_type: "Bearer"
            - expires_in: float (access token lifetime in seconds)

        Raises:
            ValidationError: If the refresh token is invalid or expired.
        """
        if not refresh_token_str:
            raise ValidationError({"refresh_token": "Refresh token is required."})

        try:
            token = RefreshToken(refresh_token_str)
            access_token = token.access_token

            result = {
                "access": str(access_token),
                "token_type": "Bearer",
                "expires_in": settings.SIMPLE_JWT.get(
                    "ACCESS_TOKEN_LIFETIME"
                ).total_seconds(),
            }

            # If rotation is enabled, provide new refresh token
            if settings.SIMPLE_JWT.get("ROTATE_REFRESH_TOKENS", False):
                result["refresh"] = str(token)

            return result

        except Exception as e:
            logger.warning(f"Token refresh failed: {e}")
            raise ValidationError(
                {"refresh_token": "Invalid or expired refresh token."}
            )

    @staticmethod
    def logout(refresh_token_str: str) -> bool:
        """
        Blacklist a refresh token to invalidate the session.

        Returns True on success.

        Raises:
            ValidationError: If the refresh token is missing or invalid.
        """
        if not refresh_token_str:
            raise ValidationError({"refresh_token": "Refresh token is required."})

        try:
            token = RefreshToken(refresh_token_str)
            token.blacklist()
            return True
        except Exception as e:
            logger.warning(f"Logout failed: {e}")
            raise ValidationError(f"Logout failed: {str(e)}")

    # ------------------------------------------------------------------
    # SSO Validation
    # ------------------------------------------------------------------

    @staticmethod
    def validate_sso_token(token: str):
        """
        Validate an SSO token and return the associated user.

        This is a stub for SSO integration. Implement the validation
        logic specific to your SSO provider (e.g. DBCA Auth2, Azure AD,
        Okta, etc.).

        Typical implementation:
            1. Decode/verify the SSO token with provider's public key
            2. Extract user identity (email, name, groups)
            3. Look up or create the user in the local database
            4. Return the user instance

        Returns:
            User instance if token is valid.

        Raises:
            AuthenticationFailed: If the token is invalid or expired.
        """
        raise NotImplementedError(
            "SSO validation not configured. Implement validate_sso_token() "
            "with your SSO provider's token verification logic."
        )

    @staticmethod
    def get_or_create_sso_user(sso_data: dict):
        """
        Get or create a user from SSO identity data.

        This is a stub for SSO user provisioning. Implement with your
        SSO provider's user data structure.

        Args:
            sso_data: dict containing at minimum:
                - email: str
                - given_names: str (optional)
                - last_name: str (optional)
                - groups: list[str] (optional, for role mapping)

        Returns:
            Tuple of (user, created) where created is a boolean.

        Raises:
            ValidationError: If required SSO data is missing.
        """
        email = sso_data.get("email")
        if not email:
            raise ValidationError({"email": "SSO data must include an email address."})

        given_names = sso_data.get("given_names", "")
        last_name = sso_data.get("last_name", "")

        user, created = User.objects.get_or_create(
            email=email,
            defaults={
                "given_names": given_names,
                "last_name": last_name,
                "is_active": True,
            },
        )

        if not created:
            # Update user details from SSO if they've changed
            updated = False
            if given_names and user.given_names != given_names:
                user.given_names = given_names
                updated = True
            if last_name and user.last_name != last_name:
                user.last_name = last_name
                updated = True
            if updated:
                user.save(update_fields=["given_names", "last_name"])

        if created:
            logger.info(f"Created new user from SSO: {email}")

        return user, created

    # ------------------------------------------------------------------
    # Token Utilities
    # ------------------------------------------------------------------

    @staticmethod
    def generate_tokens_for_user(user) -> dict:
        """
        Generate JWT tokens for a given user instance.

        Useful after SSO validation, password reset, or invitation
        acceptance where the user is already verified.

        Returns a dict containing:
            - access: str (JWT access token)
            - refresh: str (JWT refresh token)
            - token_type: "Bearer"
            - expires_in: float (access token lifetime in seconds)
        """
        return AuthService._generate_tokens(user)

    @staticmethod
    def _generate_tokens(user) -> dict:
        """Internal helper to create token pair for a user."""
        refresh = RefreshToken.for_user(user)
        access_token = refresh.access_token

        return {
            "access": str(access_token),
            "refresh": str(refresh),
            "token_type": "Bearer",
            "expires_in": settings.SIMPLE_JWT.get(
                "ACCESS_TOKEN_LIFETIME"
            ).total_seconds(),
        }
