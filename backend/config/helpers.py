import mimetypes
import base64, os
from django.contrib.staticfiles import finders
from django.conf import settings
from django.core.mail import EmailMultiAlternatives
from email.mime.image import MIMEImage


def get_encoded_image():
    """
    Encodes the DBCA logo image as a base64 string for email embedding.
    Tries multiple locations with logs incase not found.
    """
    import base64
    import os

    # List of possible image paths to try
    possible_paths = [
        os.path.join(settings.BASE_DIR, "documents", "dbca.jpg"),
        os.path.join(settings.BASE_DIR, "dbca.jpg"),
        os.path.join(settings.BASE_DIR, "staticfiles", "images", "dbca.jpg"),
    ]

    for image_path in possible_paths:
        try:
            settings.LOGGER.info(f"Trying image path: {image_path}")

            if os.path.exists(image_path):
                settings.LOGGER.info(f"Found image at: {image_path}")

                with open(image_path, "rb") as img:
                    encoded_image = base64.b64encode(img.read()).decode("utf-8")

                    # Validate the encoded image
                    if len(encoded_image) > 0:
                        data_url = f"data:image/jpeg;base64,{encoded_image}"
                        settings.LOGGER.info(
                            f"Successfully encoded image from {image_path} (size: {len(data_url)} chars)"
                        )
                        return data_url
                    else:
                        settings.LOGGER.warning(
                            f"Encoded image from {image_path} is empty"
                        )
                        continue  # Try next path
            else:
                settings.LOGGER.info(f"Image not found at: {image_path}")

        except Exception as e:
            settings.LOGGER.error(f"Error processing image at {image_path}: {e}")
            continue  # Try next path

    # If we get here, no image was found at any location
    settings.LOGGER.error(
        "Could not find DBCA logo image at any of the expected locations:"
    )
    for path in possible_paths:
        settings.LOGGER.error(f"  - {path}")

    return ""


def send_email_with_embedded_image(
    recipient_email, subject, html_content, from_email=None
):
    """
    Send an email with embedded image via HTML content.

    :param recipient_email: Email address of the recipient
    :param subject: Email subject line
    :param html_content: HTML content of the email
    :param from_email: Sender's email (defaults to settings.DEFAULT_FROM_EMAIL)
    """

    if settings.EMAIL_HOST == "mail-relay.lan.fyi":
        # Use default from email if not provided
        if from_email is None:
            from_email = settings.DEFAULT_FROM_EMAIL

        # Create message
        msg = EmailMultiAlternatives(
            subject,
            # Plain text fallback
            "Please view this email in an HTML-compatible email client.",
            from_email,
            recipient_email,
        )

        # Attach HTML alternative
        msg.attach_alternative(html_content, "text/html")

        # Send the message
        msg.send()

    # Mandrill
    else:
        if from_email is None:
            from_email = settings.DEFAULT_FROM_EMAIL

        # Ensure recipient_email is a list
        if isinstance(recipient_email, str):
            recipient_email = [recipient_email]

        # Create message
        msg = EmailMultiAlternatives(
            subject,
            # Plain text fallback
            "Please view this email in an HTML-compatible email client.",
            from_email,
            recipient_email,  # Must be a list
        )

        # Attach HTML alternative
        msg.attach_alternative(html_content, "text/html")

        # Send the message with logging
        try:
            result = msg.send()
            settings.LOGGER.info(
                f"Email sent successfully to {recipient_email}. Result: {result}"
            )
            return result
        except Exception as e:
            settings.LOGGER.error(f"Failed to send email: {e}", exc_info=True)
            raise
