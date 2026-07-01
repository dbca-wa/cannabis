"""Centralised email sending service.

This is the single path for the application's system emails (user invitations
and password resets). It renders a Django template and delegates delivery to
``config.helpers.send_email_with_embedded_image``, which attaches the logo as an
inline (CID) image and applies test-mode redirection
(``SystemSettings.email_testing_mode`` / ``email_test_user``).
"""

import logging
from datetime import datetime, timezone

from django.conf import settings
from django.template.loader import render_to_string

from config.helpers import send_email_with_embedded_image

logger = logging.getLogger(__name__)


class EmailSendError(Exception):
    """Raised when email delivery fails."""


class EmailService:
    """Centralised, template-driven email sender for system emails."""

    @staticmethod
    def _get_base_context() -> dict:
        """Base context merged into every email template.

        Provides the variables the shared ``emails/base_email.html`` layout
        needs: the inline-logo reference (CID attached by the sender), the site
        URL/name, and the current year for the footer.
        """
        return {
            # The sender attaches the logo as an inline image with this CID, so
            # templates reference it via src="cid:cannabis-logo".
            "cannabis_svg": "cid:cannabis-logo",
            "site_url": settings.SITE_URL,
            "site_name": "Cannabis",
            "current_year": datetime.now(timezone.utc).year,
        }

    @staticmethod
    def send_template_email(
        template_name: str,
        recipient_email: "list[str] | str",
        subject: str,
        context: dict,
        from_email: str = None,
    ) -> bool:
        """Render ``template_name`` and send it.

        Merges the base context with ``context``, renders the template, and
        delegates to ``send_email_with_embedded_image``.

        Raises:
            EmailSendError: When rendering or delivery fails.
        """
        full_context = {**EmailService._get_base_context(), **context}

        try:
            html_content = render_to_string(template_name, full_context)
        except Exception as e:
            logger.error(f"Failed to render email template '{template_name}': {e}")
            raise EmailSendError(
                f"Failed to render email template '{template_name}'."
            ) from e

        try:
            send_email_with_embedded_image(
                recipient_email=recipient_email,
                subject=subject,
                html_content=html_content,
                from_email=from_email,
            )
            return True
        except Exception as e:
            logger.error(f"Email send failed for '{subject}': {e}")
            raise EmailSendError("Failed to send email. Please try again.") from e
