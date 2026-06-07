import os

from django.conf import settings


def get_logo_url():
    """Returns the public URL for the cannabis email logo image."""
    return f"{settings.SITE_URL}/static/images/cannabis_email.png"


def send_email_with_embedded_image(
    recipient_email, subject, html_content, from_email=None
):
    """
    Send an email with CID-attached inline images.

    All emails pass through this function, which:
    1. Checks SystemSettings for testing mode (redirects recipients when active)
    2. Deduplicates mass emails in testing mode (test user receives one per subject)
    3. Attaches the cannabis logo as a CID inline image so templates can use src="cid:cannabis-logo"

    :param recipient_email: Email address of the recipient (string or list)
    :param subject: Email subject line
    :param html_content: HTML content of the email
    :param from_email: Sender's email (defaults to settings.DEFAULT_FROM_EMAIL)
    """
    from email.mime.image import MIMEImage

    # Track test mode state for final logging
    is_test_mode = False
    test_mode_user = None
    original_recipients = None

    # Check testing mode before sending
    try:
        from common.models import SystemSettings

        system_settings = SystemSettings.load()
        if (
            system_settings
            and system_settings.email_testing_mode
            and system_settings.email_test_user
        ):
            is_test_mode = True
            test_email = system_settings.email_test_user.email
            test_mode_user = (
                f"{system_settings.email_test_user.first_name} "
                f"{system_settings.email_test_user.last_name} "
                f"({test_email})"
            )
            original_recipients = recipient_email
            recipient_email = [test_email]

            # Deduplicate: skip if we already sent this subject to the test user recently
            import hashlib

            from django.core.cache import cache

            safe_subject = hashlib.md5(
                subject.encode(), usedforsecurity=False
            ).hexdigest()
            dedup_key = f"test_email_dedup_{safe_subject}"
            if cache.get(dedup_key):
                settings.LOGGER.info(
                    f"[TEST MODE] Skipping duplicate email '{subject}' "
                    f"(original: {original_recipients}, test user: {test_mode_user})"
                )
                return
            cache.set(dedup_key, True, timeout=30)  # 30-second dedup window

            subject = f"[TEST] {subject}"
            # Add test mode banner to the HTML content
            original_str = (
                ", ".join(original_recipients)
                if isinstance(original_recipients, list)
                else original_recipients
            )
            test_banner = (
                '<table width="100%" cellpadding="0" cellspacing="0" border="0" '
                'style="margin-bottom:24px;">'
                "<tr><td>"
                '<div style="'
                "background:#1e293b;"
                "border-radius:8px;"
                "border-bottom:4px solid #f59e0b;"
                "padding:20px 24px;"
                "font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;"
                '">'
                '<table cellpadding="0" cellspacing="0" border="0" width="100%">'
                "<tr>"
                '<td style="vertical-align:top;width:24px;padding-right:14px;">'
                '<span style="font-size:20px;line-height:1;color:#f59e0b;">&#9888;</span>'
                "</td>"
                '<td style="vertical-align:top;">'
                '<span style="'
                "display:inline-block;"
                "background:#f59e0b;"
                "color:#1e293b;"
                "font-size:10px;"
                "font-weight:800;"
                "letter-spacing:1px;"
                "text-transform:uppercase;"
                "padding:2px 8px;"
                "border-radius:3px;"
                "margin-bottom:8px;"
                '">'
                "Test Mode"
                "</span>"
                '<p style="'
                "color:#f1f5f9;"
                "font-size:14px;"
                "font-weight:500;"
                "line-height:22px;"
                "margin:8px 0 0 0;"
                '">'
                'This email was <strong style="color:#fbbf24;">redirected</strong> '
                "and not delivered to the original recipient."
                "</p>"
                "</td>"
                "</tr>"
                "</table>"
                '<div style="border-top:1px solid #334155;margin:14px 0 12px 0;"></div>'
                '<table cellpadding="0" cellspacing="0" border="0" width="100%" '
                'style="font-size:13px;line-height:20px;">'
                "<tr>"
                '<td style="color:#64748b;padding:3px 0;width:130px;vertical-align:top;">'
                "Original recipient</td>"
                '<td style="color:#e2e8f0;padding:3px 0;font-weight:600;">'
                f"{original_str}</td>"
                "</tr>"
                "<tr>"
                '<td style="color:#64748b;padding:3px 0;width:130px;vertical-align:top;">'
                "Delivered to</td>"
                '<td style="color:#e2e8f0;padding:3px 0;font-weight:600;">'
                f"{test_email}</td>"
                "</tr>"
                "</table>"
                "</div>"
                "</td></tr>"
                "</table>"
            )
            # Insert banner after <body> tag or at the start of content
            if "<body" in html_content:
                html_content = html_content.replace("<body>", f"<body>{test_banner}", 1)
                # Handle body with attributes (e.g. <body style="...">)
                if test_banner not in html_content:
                    body_start = html_content.find("<body")
                    if body_start != -1:
                        body_close = html_content.find(">", body_start)
                        if body_close != -1:
                            html_content = (
                                html_content[: body_close + 1]
                                + test_banner
                                + html_content[body_close + 1 :]
                            )
            else:
                html_content = test_banner + html_content
            settings.LOGGER.info(
                f"[TEST MODE] Redirecting '{subject}' — "
                f"original: {', '.join(original_recipients) if isinstance(original_recipients, list) else original_recipients} "
                f"→ test user: {test_mode_user}"
            )
    except Exception as e:
        settings.LOGGER.error(f"Error checking email testing mode: {e}")

    # Use default from email if not provided
    if from_email is None:
        from_email = settings.DEFAULT_FROM_EMAIL

    # Build the email with correct MIME nesting for CID images.
    #
    # The correct structure for HTML emails with inline images is:
    #   multipart/related (root)
    #     ├── multipart/alternative
    #     │     ├── text/plain
    #     │     └── text/html
    #     └── image/png (CID attachment)
    import smtplib
    from email.mime.multipart import MIMEMultipart
    from email.mime.text import MIMEText

    # Root: multipart/related
    msg_root = MIMEMultipart("related")
    msg_root["Subject"] = subject
    msg_root["From"] = from_email
    msg_root["To"] = (
        ", ".join(recipient_email)
        if isinstance(recipient_email, list)
        else recipient_email
    )
    msg_root.preamble = "This is a multi-part message in MIME format."

    # Alternative part: contains plain text and HTML
    msg_alternative = MIMEMultipart("alternative")
    msg_root.attach(msg_alternative)

    # Plain text fallback
    msg_text = MIMEText(
        "Please view this email in an HTML-compatible email client.",
        "plain",
        "utf-8",
    )
    msg_alternative.attach(msg_text)

    # HTML content
    msg_html = MIMEText(html_content, "html", "utf-8")
    msg_alternative.attach(msg_html)

    # Attach the cannabis logo as an inline CID image (sibling of alternative part)
    logo_path = os.path.join(
        settings.BASE_DIR, "staticfiles", "images", "cannabis_email.png"
    )
    if os.path.exists(logo_path):
        with open(logo_path, "rb") as f:
            logo_img = MIMEImage(f.read(), _subtype="png")
            logo_img.add_header("Content-ID", "<cannabis-logo>")
            logo_img.add_header(
                "Content-Disposition", "inline", filename="cannabis_email.png"
            )
            msg_root.attach(logo_img)
    else:
        settings.LOGGER.warning(f"Cannabis logo not found at {logo_path}")

    # Send via SMTP directly (bypasses Django's email backend abstraction
    # to ensure the MIME structure is preserved exactly as built).
    # In console mode (local dev), log instead of sending.
    try:
        backend = getattr(settings, "EMAIL_BACKEND", "")
        is_console = "console" in backend

        if is_console:
            settings.LOGGER.info(
                f"[CONSOLE MODE] Would send email: Subject='{subject}', "
                f"To={msg_root['To']}"
            )
        else:
            email_host = getattr(settings, "EMAIL_HOST", "mail-relay.lan.fyi")
            email_port = getattr(settings, "EMAIL_PORT", 587)

            with smtplib.SMTP(email_host, email_port) as smtp:
                smtp.send_message(msg_root)
    except Exception as e:
        settings.LOGGER.error(f"Failed to send email via SMTP: {e}", exc_info=True)
        raise

    # Summary log
    backend = getattr(settings, "EMAIL_BACKEND", "")
    is_console = "console" in backend
    recipients_str = (
        ", ".join(recipient_email)
        if isinstance(recipient_email, list)
        else recipient_email
    )

    if is_console and is_test_mode:
        settings.LOGGER.info(
            f"[CONSOLE + TEST MODE] Email rendered to terminal (not sent). "
            f"Subject: '{subject}' | "
            f"Original recipient: {', '.join(original_recipients) if isinstance(original_recipients, list) else original_recipients} | "
            f"Redirected to test user: {test_mode_user}"
        )
    elif is_console:
        settings.LOGGER.info(
            f"[CONSOLE] Email rendered to terminal (not sent). "
            f"Subject: '{subject}' | Recipient: {recipients_str}"
        )
    elif is_test_mode:
        settings.LOGGER.info(
            f"[TEST MODE] Email SENT to test user {test_mode_user} "
            f"(original recipient: {', '.join(original_recipients) if isinstance(original_recipients, list) else original_recipients}). "
            f"Subject: '{subject}'"
        )
    else:
        settings.LOGGER.info(
            f"[LIVE] Email sent. Subject: '{subject}' | Recipient: {recipients_str}"
        )
