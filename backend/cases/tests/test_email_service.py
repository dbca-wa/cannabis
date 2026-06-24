"""Service-layer tests for EmailService.send_case_documents."""

from unittest.mock import patch

import pytest
from django.core.files.uploadedfile import SimpleUploadedFile
from django.utils import timezone
from rest_framework.exceptions import ValidationError

from cases.models import Case, Certificate, Invoice
from cases.services.email_service import EmailService
from common.models import SystemSettings


@pytest.fixture
def send_emails_case(db, police_officer):
    return Case.objects.create(
        case_number="EMAIL-001",
        received=timezone.now(),
        security_movement_envelope="ENV-EM-001",
        requesting_officer=police_officer,
        phase=Case.PhaseChoices.SEND_EMAILS,
    )


def _attach_cert(case):
    cert = Certificate.objects.create(submission=case, certificate_number="CRT-EM-001")
    cert.unsigned_pdf_file.save(
        "cert.pdf", SimpleUploadedFile("cert.pdf", b"%PDF-cert"), save=True
    )
    return cert


def _attach_invoice(case):
    inv = Invoice.objects.create(submission=case, invoice_number="INV-EM-001")
    inv.pdf_file.save("inv.pdf", SimpleUploadedFile("inv.pdf", b"%PDF-inv"), save=True)
    return inv


@pytest.mark.django_db
class TestEmailServiceValidation:
    """Validation-path tests."""

    def test_wrong_phase_raises(self, db, police_officer, botanist_user):
        case = Case.objects.create(
            case_number="EMAIL-WP",
            received=timezone.now(),
            security_movement_envelope="ENV-WP",
            requesting_officer=police_officer,
            phase=Case.PhaseChoices.INVOICING,
        )
        with pytest.raises(ValidationError):
            EmailService.send_case_documents(case, botanist_user)

    def test_missing_certificate_raises(self, send_emails_case, botanist_user):
        with pytest.raises(ValidationError):
            EmailService.send_case_documents(send_emails_case, botanist_user)

    def test_missing_invoice_raises(self, send_emails_case, botanist_user):
        _attach_cert(send_emails_case)
        with pytest.raises(ValidationError):
            EmailService.send_case_documents(send_emails_case, botanist_user)

    def test_no_recipient_configured_raises(self, send_emails_case, botanist_user):
        _attach_cert(send_emails_case)
        _attach_invoice(send_emails_case)
        settings_obj = SystemSettings.load()
        settings_obj.document_email_address = ""
        settings_obj.forward_certificate_emails_to = ""
        settings_obj.save()
        with pytest.raises(ValidationError):
            EmailService.send_case_documents(send_emails_case, botanist_user)


@pytest.mark.django_db
class TestEmailServiceSend:
    """Successful send path."""

    def test_send_uses_document_email_address(self, send_emails_case, botanist_user):
        _attach_cert(send_emails_case)
        _attach_invoice(send_emails_case)
        settings_obj = SystemSettings.load()
        settings_obj.document_email_address = "docs@example.com"
        settings_obj.save()

        with patch("cases.services.email_service.EmailMessage.send") as mock_send:
            result = EmailService.send_case_documents(send_emails_case, botanist_user)

        mock_send.assert_called_once()
        assert result["recipient"] == "docs@example.com"
        assert result["certificate_number"] == "CRT-EM-001"
        assert result["invoice_number"] == "INV-EM-001"

    def test_send_falls_back_to_forward_address(self, send_emails_case, botanist_user):
        _attach_cert(send_emails_case)
        _attach_invoice(send_emails_case)
        settings_obj = SystemSettings.load()
        settings_obj.document_email_address = ""
        settings_obj.forward_certificate_emails_to = "fallback@example.com"
        settings_obj.save()

        with patch("cases.services.email_service.EmailMessage.send") as mock_send:
            result = EmailService.send_case_documents(send_emails_case, botanist_user)

        mock_send.assert_called_once()
        assert result["recipient"] == "fallback@example.com"

    def test_send_advances_phase_to_complete(self, send_emails_case, botanist_user):
        _attach_cert(send_emails_case)
        _attach_invoice(send_emails_case)
        settings_obj = SystemSettings.load()
        settings_obj.document_email_address = "docs@example.com"
        settings_obj.save()

        with patch("cases.services.email_service.EmailMessage.send"):
            EmailService.send_case_documents(send_emails_case, botanist_user)

        send_emails_case.refresh_from_db()
        assert send_emails_case.phase == Case.PhaseChoices.COMPLETE
