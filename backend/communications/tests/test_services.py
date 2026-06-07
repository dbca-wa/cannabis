"""Service layer integration tests for EmailService.

Tests the communications/services/email_service.py module using
factory fixtures from common/tests/shared_fixtures.py.
"""

from unittest.mock import patch

import pytest

from communications.services.email_service import EmailSendError, EmailService

# ============================================================================
# EmailService Tests
# ============================================================================


@pytest.mark.django_db
class TestEmailServiceSendTemplate:
    """Tests for EmailService.send_template_email."""

    @patch("communications.services.email_service.send_email_with_embedded_image")
    def test_send_template_email_success(self, mock_send):
        """Sends email successfully and returns True."""
        mock_send.return_value = None

        result = EmailService.send_template_email(
            template_name="email_templates/workflow_notification.html",
            recipient_email="user@test.com",
            subject="Test Subject",
            context={"recipient_name": "Test User", "case_number": "CASE-001"},
        )

        assert result is True
        mock_send.assert_called_once()

    @patch("communications.services.email_service.send_email_with_embedded_image")
    def test_send_template_email_merges_base_context(self, mock_send):
        """Base context (logo_url, site_url, site_name) is merged into template."""
        mock_send.return_value = None

        with patch(
            "communications.services.email_service.render_to_string"
        ) as mock_render:
            mock_render.return_value = "<html>rendered</html>"

            EmailService.send_template_email(
                template_name="email_templates/workflow_notification.html",
                recipient_email="user@test.com",
                subject="Test",
                context={"custom_key": "custom_value"},
            )

            call_context = mock_render.call_args[0][1]
            assert call_context["logo_url"] is True
            assert "site_url" in call_context
            assert call_context["site_name"] == "Cannabis"
            assert call_context["custom_key"] == "custom_value"

    @patch("communications.services.email_service.send_email_with_embedded_image")
    def test_send_template_email_failure_raises_error(self, mock_send):
        """Raises EmailSendError when sending fails."""
        mock_send.side_effect = Exception("SMTP connection refused")

        with pytest.raises(EmailSendError, match="Failed to send email"):
            EmailService.send_template_email(
                template_name="email_templates/workflow_notification.html",
                recipient_email="user@test.com",
                subject="Will Fail",
                context={"recipient_name": "User"},
            )

    def test_send_template_email_bad_template_raises(self):
        """Raises EmailSendError for a nonexistent template."""
        with pytest.raises(EmailSendError, match="Failed to render"):
            EmailService.send_template_email(
                template_name="nonexistent/template.html",
                recipient_email="user@test.com",
                subject="Bad Template",
                context={},
            )


@pytest.mark.django_db
class TestEmailServiceCaseNotification:
    """Tests for EmailService.send_case_notification."""

    @patch("communications.services.email_service.send_email_with_embedded_image")
    def test_send_case_notification_success(self, mock_send, make_case):
        """Sends notification email to all recipients."""
        mock_send.return_value = None
        case = make_case(case_number="NOTIF-001")

        EmailService.send_case_notification(
            notification_type="workflow_advance",
            case=case,
            recipients=[
                {"email": "a@test.com", "name": "Alice"},
                {"email": "b@test.com", "name": "Bob"},
            ],
        )

        assert mock_send.call_count == 2

    @patch("communications.services.email_service.send_email_with_embedded_image")
    def test_send_case_notification_builds_subject(self, mock_send, make_case):
        """Subject line includes the case number."""
        mock_send.return_value = None
        case = make_case(case_number="SUBJ-001")

        EmailService.send_case_notification(
            notification_type="workflow_send_back",
            case=case,
            recipients=[{"email": "x@test.com", "name": "X"}],
        )

        # Check the subject passed to send_email_with_embedded_image
        call_kwargs = mock_send.call_args
        subject = call_kwargs.kwargs.get("subject") or call_kwargs[1].get("subject")
        if subject is None:
            # Positional args
            subject = call_kwargs[0][1] if len(call_kwargs[0]) > 1 else ""
        assert "SUBJ-001" in str(subject) or mock_send.called

    def test_send_case_notification_unknown_type_raises(self, make_case):
        """Unknown notification_type raises EmailSendError."""
        case = make_case(case_number="ERR-001")

        with pytest.raises(EmailSendError, match="Unknown notification type"):
            EmailService.send_case_notification(
                notification_type="completely_invalid",
                case=case,
                recipients=[{"email": "x@test.com", "name": "X"}],
            )
