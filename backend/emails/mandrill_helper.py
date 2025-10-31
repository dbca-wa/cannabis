import mandrill
from django.conf import settings
from django.template.loader import render_to_string


class MandrillEmailService:
    """Service for sending emails via Mandrill API"""

    def __init__(self):
        if not settings.MANDRILL_API_KEY:
            raise ValueError("MANDRILL_API_KEY is not set in settings")
        self.client = mandrill.Mandrill(settings.MANDRILL_API_KEY)

    def send_template_email(
        self,
        to_email: str,
        to_name: str,
        subject: str,
        template_path: str,
        template_context: dict,
        from_email: str = None,
        from_name: str = "Science Projects Management System",
        tags: list = None,
        metadata: dict = None,
    ):
        """
        Send an email using a Django template via Mandrill

        Args:
            to_email: Recipient email address
            to_name: Recipient name
            subject: Email subject
            template_path: Path to Django HTML template
            template_context: Context dict for rendering template
            from_email: Sender email (defaults to DEFAULT_FROM_EMAIL)
            from_name: Sender name
            tags: List of tags for tracking (e.g., ['invitation', 'cannabis'])
            metadata: Dict of metadata for tracking
        """
        if from_email is None:
            from_email = settings.DEFAULT_FROM_EMAIL

        # Render the HTML template
        html_content = render_to_string(template_path, template_context)

        # Prepare the message
        message = {
            "html": html_content,
            "subject": subject,
            "from_email": from_email,
            "from_name": from_name,
            "to": [{"email": to_email, "name": to_name, "type": "to"}],
            "headers": {"Reply-To": from_email},
            "important": False,
            "track_opens": True,
            "track_clicks": True,
            "auto_text": True,
            "inline_css": True,
            "preserve_recipients": False,
            "view_content_link": False,
            "tags": tags or [],
            "metadata": metadata or {},
        }

        try:
            result = self.client.messages.send(message=message, **{"async": False})
            settings.LOGGER.info(f"Mandrill email sent to {to_email}: {result}")
            return result
        except mandrill.Error as e:
            settings.LOGGER.error(f"Mandrill error sending to {to_email}: {e}")
            raise


def send_mandrill_email(
    to_email: str,
    to_name: str,
    subject: str,
    template_path: str,
    template_context: dict,
    **kwargs,
):
    """
    Convenience function for sending Mandrill emails
    """
    service = MandrillEmailService()
    return service.send_template_email(
        to_email=to_email,
        to_name=to_name,
        subject=subject,
        template_path=template_path,
        template_context=template_context,
        **kwargs,
    )
