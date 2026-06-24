"""Email service — handles sending completed case documents.

Sends certificate and invoice PDFs to the configured email address,
then advances the case phase to complete.
"""

import logging

from django.core.mail import EmailMessage
from rest_framework.exceptions import ValidationError

from common.models import SystemSettings

from .workflow_service import WorkflowService

logger = logging.getLogger(__name__)


class EmailService:
    """Business logic for sending case documents via email."""

    @staticmethod
    def send_case_documents(case, user):
        """Send certificate and invoice PDFs for a case to the configured recipient.

        Resolves the recipient email address from SystemSettings:
        1. Uses document_email_address if set
        2. Falls back to forward_certificate_emails_to

        On successful send, advances the case phase to complete.

        Args:
            case: The Case instance (must be in send_emails phase).
            user: The user triggering the send.

        Returns:
            dict with send status details.

        Raises:
            ValidationError: If documents are missing or case is in wrong phase.
        """
        from ..models import Case

        if case.phase != Case.PhaseChoices.SEND_EMAILS:
            raise ValidationError(
                "Case must be in the 'send_emails' phase to send documents."
            )

        # Get latest certificate with a file
        certificate = (
            case.certificates.filter(unsigned_pdf_file__isnull=False)
            .exclude(unsigned_pdf_file="")
            .order_by("-created_at")
            .first()
        )
        if not certificate:
            raise ValidationError(
                "No certificate PDF found for this case. "
                "Generate a certificate before sending documents."
            )

        # Get latest invoice with a file
        invoice = (
            case.invoices.filter(pdf_file__isnull=False)
            .exclude(pdf_file="")
            .order_by("-created_at")
            .first()
        )
        if not invoice:
            raise ValidationError(
                "No invoice PDF found for this case. "
                "Generate an invoice before sending documents."
            )

        # Resolve recipient address
        settings = SystemSettings.load()
        recipient = (
            settings.document_email_address
            if settings.document_email_address
            else settings.forward_certificate_emails_to
        )

        if not recipient:
            raise ValidationError(
                "No recipient email address configured. "
                "Set a document email address in System Settings."
            )

        # Build and send email
        subject = f"Case {case.case_number} — Certificate and Invoice"
        body = (
            f"Please find attached the certificate and invoice "
            f"for case {case.case_number}."
        )

        email = EmailMessage(
            subject=subject,
            body=body,
            to=[recipient],
        )

        # Attach certificate PDF
        cert_file = certificate.signed_pdf_file or certificate.unsigned_pdf_file
        email.attach(
            f"certificate_{certificate.certificate_number}.pdf",
            cert_file.read(),
            "application/pdf",
        )

        # Attach invoice PDF
        email.attach(
            f"invoice_{invoice.invoice_number}.pdf",
            invoice.pdf_file.read(),
            "application/pdf",
        )

        email.send(fail_silently=False)

        logger.info(
            f"Sent documents for case {case.case_number} to {recipient} "
            f"(triggered by {user})"
        )

        # Advance phase to complete
        WorkflowService.advance_case(case, user)

        return {
            "message": f"Documents sent to {recipient}",
            "recipient": recipient,
            "certificate_number": certificate.certificate_number,
            "invoice_number": invoice.invoice_number,
        }
