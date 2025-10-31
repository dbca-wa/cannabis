from django.shortcuts import render
from cannabis.backend.config.helpers import send_email_with_embedded_image
from cannabis.backend.emails.email_utils import get_cannabis_svg, get_encoded_image
from rest_framework.permissions import IsAuthenticated, AllowAny, IsAdminUser
from .mandrill_helper import send_mandrill_email
from rest_framework.response import Response
from django.conf import settings
import datetime, json, os, re, subprocess, time, tempfile, shutil

from rest_framework.status import (
    HTTP_200_OK,
    HTTP_201_CREATED,
    HTTP_202_ACCEPTED,
    HTTP_204_NO_CONTENT,
    HTTP_400_BAD_REQUEST,
    HTTP_401_UNAUTHORIZED,
    HTTP_404_NOT_FOUND,
    HTTP_500_INTERNAL_SERVER_ERROR,
    HTTP_502_BAD_GATEWAY,
    HTTP_503_SERVICE_UNAVAILABLE,
)


class TestCannabisMandrillEmail(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, req):
        # Extract and validate data
        first_name = req.data.get("first_name")
        last_name = req.data.get("last_name")
        email_address = req.data.get("email_address")
        inviter_first_name = req.data.get("inviter_first_name")
        inviter_last_name = req.data.get("inviter_last_name")
        inviter_email = req.data.get("inviter_email")
        invitation_link = req.data.get("invitation_link")
        proposed_role = req.data.get("proposed_role")

        # Validate required fields
        required_fields = {
            "first_name": first_name,
            "last_name": last_name,
            "email_address": email_address,
            "inviter_first_name": inviter_first_name,
            "inviter_last_name": inviter_last_name,
            "inviter_email": inviter_email,
            "invitation_link": invitation_link,
            "proposed_role": proposed_role,
        }

        missing_fields = [k for k, v in required_fields.items() if not v]
        if missing_fields:
            return Response(
                {"error": f"Missing required fields: {', '.join(missing_fields)}"},
                status=HTTP_400_BAD_REQUEST,
            )

        # Validate email domain
        # if not email_address.endswith("@dbca.wa.gov.au"):
        #     return Response(
        #         {"error": "Email must be a @dbca.wa.gov.au address"},
        #         status=HTTP_400_BAD_REQUEST,
        #     )

        settings.LOGGER.info(
            f"{req.user} is sending cannabis mandrill email to {email_address}"
        )

        # Prepare template context
        template_path = "email_templates/cannabis_invitation_email.html"
        template_context = {
            # Recipient info
            "first_name": first_name,
            "last_name": last_name,
            "email_address": email_address,
            # Inviter info
            "inviter_first_name": inviter_first_name,
            "inviter_last_name": inviter_last_name,
            "inviter_email": inviter_email,
            # Invitation details
            "invitation_link": invitation_link,
            "proposed_role": proposed_role,
            # System info
            "site_url": settings.SITE_URL,
            "current_year": datetime.datetime.now().year,
            # Encoded media (base64)
            "dbca_image_path": get_encoded_image(),
            "cannabis_svg": get_cannabis_svg(),
        }

        # Send email
        try:
            from django.template.loader import render_to_string

            template_content = render_to_string(template_path, template_context)
            send_email_with_embedded_image(
                recipient_email=[email_address],
                subject="Cannabis Invitation",
                html_content=template_content,
            )

            settings.LOGGER.info(
                f"Successfully sent invitation email to {email_address}"
            )

            return Response(
                {
                    "status": 202,
                    "message": f"Invitation email sent successfully to {email_address}",
                },
                status=HTTP_202_ACCEPTED,
            )

        except Exception as e:
            settings.LOGGER.error(f"Email sending error: {e}", exc_info=True)
            return Response(
                {
                    "status": 400,
                    "message": f"Failed to send email: {str(e)}",
                },
                status=HTTP_400_BAD_REQUEST,
            )
