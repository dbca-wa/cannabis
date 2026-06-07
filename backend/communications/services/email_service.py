"""Centralised email sending service."""

import logging

from django.conf import settings
from django.template.loader import render_to_string

from config.helpers import send_email_with_embedded_image

logger = logging.getLogger(__name__)


class EmailSendError(Exception):
    """Raised when email delivery fails."""


class EmailService:
    """Centralised email sending service.

    Provides a template-driven interface for sending HTML emails.
    Delegates actual sending to config.helpers.send_email_with_embedded_image.
    """

    # Maps notification types to their email template paths
    NOTIFICATION_TEMPLATES = {
        "workflow_advance": "email_templates/workflow_notification.html",
        "workflow_send_back": "email_templates/workflow_notification.html",
        "case_assigned": "email_templates/workflow_notification.html",
        "certificate_signed": "email_templates/certificate_signed.html",
        "invoice_generated": "email_templates/invoice_generated.html",
    }

    @staticmethod
    def _get_base_context() -> dict:
        """Base context merged into every email template.

        Provides standard variables available to all email templates:
        - logo_url: truthy flag (actual image attached via CID)
        - site_url: the application URL
        - site_name: application display name
        """
        return {
            "logo_url": True,
            "site_url": settings.SITE_URL,
            "site_name": "Cannabis",
        }

    @staticmethod
    def send_template_email(
        template_name: str,
        recipient_email: list[str] | str,
        subject: str,
        context: dict,
        from_email: str = None,
    ) -> bool:
        """Send an HTML email using a Django template.

        Merges base context with provided context, renders the template,
        and delegates to send_email_with_embedded_image for delivery.

        Args:
            template_name: Path to the Django template (relative to templates/).
            recipient_email: Single email or list of email addresses.
            subject: Email subject line.
            context: Template context variables (merged with base context).
            from_email: Optional sender address (defaults to settings.DEFAULT_FROM_EMAIL).

        Returns:
            True on successful send.

        Raises:
            EmailSendError: When email delivery fails.
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

    @staticmethod
    def send_case_notification(
        notification_type: str,
        case,
        recipients: list[dict],
        context: dict = None,
    ):
        """Send case workflow notification emails.

        Maps notification_type to the appropriate template, builds context
        from the case object, and sends to each recipient.

        Args:
            notification_type: Key into NOTIFICATION_TEMPLATES
                (e.g. "workflow_advance", "workflow_send_back", "case_assigned").
            case: The Case model instance.
            recipients: List of dicts with at least {"email": str, "name": str}.
            context: Optional extra context to merge into the template.

        Raises:
            EmailSendError: When any email delivery fails.
        """
        template_name = EmailService.NOTIFICATION_TEMPLATES.get(notification_type)
        if not template_name:
            logger.error(f"Unknown notification type: '{notification_type}'")
            raise EmailSendError(f"Unknown notification type: '{notification_type}'")

        base_case_context = {
            "case_number": getattr(case, "case_number", str(case.pk)),
            "phase_display": getattr(case, "get_phase_display", lambda: case.phase)(),
            "action_url": f"{settings.SITE_URL}/cases/{case.pk}",
            "action_text": "View Submission",
        }

        extra = context or {}

        for recipient in recipients:
            recipient_context = {
                **base_case_context,
                **extra,
                "recipient_name": recipient.get("name", ""),
            }

            subject = EmailService._build_notification_subject(notification_type, case)

            try:
                EmailService.send_template_email(
                    template_name=template_name,
                    recipient_email=recipient["email"],
                    subject=subject,
                    context=recipient_context,
                )
            except EmailSendError:
                # Re-raise as-is; already logged in send_template_email
                raise
            except Exception as e:
                logger.error(
                    f"Unexpected error sending {notification_type} "
                    f"notification to {recipient.get('email')}: {e}"
                )
                raise EmailSendError("Failed to send notification email.") from e

    @staticmethod
    def _build_notification_subject(notification_type: str, case) -> str:
        """Build an appropriate subject line for a case notification."""
        case_number = getattr(case, "case_number", str(case.pk))
        subjects = {
            "workflow_advance": f"Submission {case_number} — Action Required",
            "workflow_send_back": f"Submission {case_number} — Sent Back",
            "case_assigned": f"Submission {case_number} — Assigned to You",
            "certificate_signed": f"Submission {case_number} — Certificate Signed",
            "invoice_generated": f"Submission {case_number} — Invoice Generated",
        }
        return subjects.get(
            notification_type,
            f"Submission {case_number} — Notification",
        )
