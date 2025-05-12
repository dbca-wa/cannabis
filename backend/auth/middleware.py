from typing import Optional, Tuple, Any
from rest_framework.authentication import BaseAuthentication
from rest_framework.exceptions import AuthenticationFailed
from rest_framework.request import Request

from .utils import get_user_from_token


class JWTAuthentication(BaseAuthentication):
    """
    Custom JWT authentication for DRF

    This authenticator validates JWT tokens from the Authorization header
    and sets request.user and request.auth
    """

    def authenticate(self, request: Request) -> Optional[Tuple[Any, str]]:
        """
        Authenticate the request and return a tuple of (user, token)

        Args:
            request: The request to authenticate

        Returns:
            tuple: (user, token) if authentication succeeds, None otherwise
        """
        # Get Authorization header
        auth_header: Optional[str] = request.META.get("HTTP_AUTHORIZATION")

        if not auth_header:
            return None

        # Check if it's a Bearer token
        parts: list[str] = auth_header.split()
        if len(parts) != 2 or parts[0].lower() != "bearer":
            return None

        token: str = parts[1]

        # Verify token and get user
        user = get_user_from_token(token)
        if not user:
            raise AuthenticationFailed("Invalid token or user not found")

        # Return authenticated user and token
        return (user, token)
