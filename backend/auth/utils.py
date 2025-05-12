import os
import datetime
from typing import Optional, Any, Union, Dict
import jwt
from django.utils import timezone
from django.conf import settings
from django.contrib.auth import get_user_model

User = get_user_model()

# Get secret key from settings or environment
JWT_SECRET_KEY: str = settings.JWT_SECRET_KEY
# Default expiry time in hours
EXPIRY_HOURS: int = settings.JWT_EXPIRY_HOURS


def generate_token(user_id: int) -> str:
    """
    Generate a JWT token for the given user

    Args:
        user_id: User's ID

    Returns:
        str: Signed JWT token
    """
    payload: Dict[str, Any] = {
        "user_id": user_id,
        "exp": timezone.now() + datetime.timedelta(hours=EXPIRY_HOURS),
    }

    token: Union[str, bytes] = jwt.encode(payload, JWT_SECRET_KEY, algorithm="HS256")

    # In PyJWT 2.0.0+, encode returns a string instead of bytes (check in place if downgrade necessary)
    if isinstance(token, bytes):
        return token.decode("utf-8")

    return token


def verify_token(token: str) -> int:
    """
    Verify and decode a JWT token

    Args:
        token: JWT token to verify

    Returns:
        int: User ID from token

    Raises:
        jwt.PyJWTError: If token is invalid
    """
    try:
        payload: Dict[str, Any] = jwt.decode(
            token, JWT_SECRET_KEY, algorithms=["HS256"]
        )
        return payload["user_id"]
    except jwt.ExpiredSignatureError:
        raise jwt.PyJWTError("Token has expired")
    except jwt.InvalidTokenError:
        raise jwt.PyJWTError("Invalid token")


def get_user_from_token(token: str) -> Optional[Any]:
    """
    Get user from token

    Args:
        token: JWT token

    Returns:
        User: User object or None if not found
    """
    try:
        user_id: int = verify_token(token)
        return User.objects.select_related().get(id=user_id)
    except (jwt.PyJWTError, User.DoesNotExist):
        return None


def is_token_about_to_expire(token: str, threshold_minutes: int = 30) -> bool:
    """
    Check if a token is about to expire within the threshold time

    Args:
        token: JWT token to check
        threshold_minutes: Minutes before actual expiry to consider as "about to expire"

    Returns:
        bool: True if token will expire within threshold, False otherwise

    Raises:
        jwt.PyJWTError: If token is invalid
    """
    try:
        # Don't verify expiration here since we want to check if it's about to expire
        payload: Dict[str, Any] = jwt.decode(
            token, JWT_SECRET_KEY, algorithms=["HS256"], options={"verify_exp": False}
        )

        # Get expiration time from payload
        exp_timestamp = payload.get("exp")
        if not exp_timestamp:
            return True  # No expiration means it's invalid or already expired

        # Convert to datetime
        exp_datetime = datetime.datetime.fromtimestamp(
            exp_timestamp, tz=timezone.get_current_timezone()
        )

        # Check if it's about to expire
        time_until_expiry = exp_datetime - timezone.now()
        return time_until_expiry.total_seconds() < (threshold_minutes * 60)

    except jwt.InvalidTokenError:
        # Invalid token is considered expired
        return True
