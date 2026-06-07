"""Communications services."""

from .email_service import EmailSendError, EmailService

__all__ = [
    "EmailService",
    "EmailSendError",
]
