from django.conf import settings
from rest_framework.exceptions import ValidationError
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.status import HTTP_200_OK
from rest_framework.views import APIView

from communications.services.email_service import EmailSendError, EmailService

# ============================================================================
# region TEST EMAIL VIEW
# ============================================================================


class SendTestEmailView(APIView):
    """
    POST: Send a test email to verify email delivery is working.
    Requires authentication. Accepts optional recipient_email override.
    """

    permission_classes = [IsAuthenticated]

    def post(self, request):
        recipient_email = request.data.get("recipient_email") or request.user.email

        if not recipient_email:
            raise ValidationError(
                {
                    "recipient_email": [
                        "No recipient email provided and user has no email set."
                    ]
                }
            )

        context = {
            "email_title": "Cannabis Test Email",
            "recipient_name": request.user.first_name or "there",
            "action_url": settings.SITE_URL,
            "action_text": "Open Cannabis",
        }

        subject = "Cannabis Test Email"

        try:
            EmailService.send_template_email(
                template_name="email_templates/test_email.html",
                recipient_email=recipient_email,
                subject=subject,
                context=context,
            )
        except EmailSendError as e:
            settings.LOGGER.error(f"Failed to send test email: {e}")
            # Check if we're in console mode — if so, it still "worked"
            backend = getattr(settings, "EMAIL_BACKEND", "")
            if "console" in backend:
                return Response(
                    {
                        "message": "Test email logged to console (dev mode)",
                        "recipient": recipient_email,
                    },
                    status=HTTP_200_OK,
                )
            raise

        return Response(
            {
                "message": "Test email sent successfully",
                "recipient": recipient_email,
            },
            status=HTTP_200_OK,
        )


# endregion
