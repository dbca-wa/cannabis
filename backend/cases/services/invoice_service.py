"""Invoice service — invoice CRUD and generation business logic.

Handles invoice creation, PDF generation, regeneration, and context building.
"""

from datetime import timedelta

from django.conf import settings
from django.core.files.base import ContentFile
from django.db import transaction
from django.template.loader import render_to_string
from django.utils import timezone
from rest_framework.exceptions import NotFound, ValidationError

from common.models import SystemSettings

from ..models import Case, Invoice
from .pdf_service import PDFService


class InvoiceService:
    """Business logic for invoice operations."""

    @staticmethod
    def get_invoice(pk):
        """Retrieve an invoice by primary key.

        Raises:
            NotFound: If the invoice does not exist.
        """
        try:
            return Invoice.objects.select_related("submission").get(pk=pk)
        except Invoice.DoesNotExist:
            raise NotFound(f"Invoice with pk {pk} not found.")

    @staticmethod
    def get_submission_invoice(submission_id, invoice_id):
        """Retrieve an invoice scoped to a submission.

        Raises:
            NotFound: If the submission or invoice does not exist.
        """
        try:
            submission = Case.objects.get(pk=submission_id)
        except Case.DoesNotExist:
            raise NotFound("Case not found.")

        try:
            return submission.invoices.get(pk=invoice_id)
        except Invoice.DoesNotExist:
            raise NotFound("Invoice not found for this case.")

    @staticmethod
    def build_invoice_context(submission, invoice):
        """Build template context for the invoice PDF.

        Maps Submission, SystemSettings, and AdditionalInvoiceFee data to the
        variables expected by the invoice_template.html template.

        Returns:
            Dictionary of template context variables.
        """
        settings_obj = SystemSettings.load()
        bags = submission.bags.all()
        now = timezone.now()

        services = []

        # Bag identification fee (per bag)
        bag_count = bags.count()
        if bag_count > 0:
            services.append(
                {
                    "name": "Botanical Identification",
                    "description": (
                        f"Identification of {bag_count} drug movement bag(s)"
                    ),
                    "quantity": bag_count,
                    "rate": float(settings_obj.cost_per_bag),
                    "line_total": float(bag_count * settings_obj.cost_per_bag),
                }
            )

        # Certificate fee (per certificate)
        cert_count = submission.certificates.count()
        if cert_count > 0:
            services.append(
                {
                    "name": "Certificate of Approved Botanist",
                    "description": f"Generation of {cert_count} certificate(s)",
                    "quantity": cert_count,
                    "rate": float(settings_obj.cost_per_certificate),
                    "line_total": float(cert_count * settings_obj.cost_per_certificate),
                }
            )

        # Additional fees (fuel, call-out, forensic)
        for fee in submission.additional_fees.all():
            services.append(
                {
                    "name": fee.get_claim_kind_display(),
                    "description": fee.description or "",
                    "quantity": fee.units,
                    "rate": (
                        float(fee.calculated_cost / fee.units) if fee.units else 0
                    ),
                    "line_total": float(fee.calculated_cost),
                }
            )

        return {
            "logo_path": str(
                settings.BASE_DIR / "staticfiles" / "images" / "dbca_logo.png"
            ),
            "logo_square": str(
                settings.BASE_DIR / "staticfiles" / "images" / "dbca_logo_square.png"
            ),
            "invoice_id": invoice.invoice_number,
            "issue_date": now.strftime("%d %B %Y"),
            "due_date": (now + timedelta(days=30)).strftime("%d %B %Y"),
            "police_name": (
                submission.submitting_officer.full_name
                if submission.submitting_officer
                else ""
            ),
            "police_id": (
                submission.submitting_officer.badge_number
                if submission.submitting_officer
                else ""
            ),
            "case_number": submission.case_number,
            "approved_botanist": (
                submission.approved_botanist.full_name
                if submission.approved_botanist
                else ""
            ),
            "finance_officer": (
                submission.finance_officer.full_name
                if submission.finance_officer
                else ""
            ),
            "services": services,
            "subtotal": float(invoice.subtotal),
            "tax_rate_percent": float(settings_obj.tax_percentage),
            "tax": float(invoice.tax_amount),
            "total": float(invoice.total),
            "dbca_org_data": {
                "name": "Department of Biodiversity, Conservation and Attractions",
                "address": "Locked Bag 104",
                "city": "Bentley Delivery Centre",
                "state": "WA",
                "zip": "6983",
                "tax_id": "ABN 38 052 249 024",
                "phone": "(08) 9219 9000",
                "email": "enquiries@dbca.wa.gov.au",
            },
            "billed_to": {
                "name": "Western Australia Police Force",
                "address": "2 Adelaide Terrace",
                "city": "East Perth",
                "state": "WA",
                "zip": "6004",
                "phone": "(08) 9222 1111",
            },
        }

    @staticmethod
    @transaction.atomic
    def generate_invoice(submission, customer_number, user):
        """Generate an invoice for the given submission.

        Creates the Invoice record, calculates totals, renders the PDF from the
        invoice template, and stores the file on the model.

        Returns:
            The newly created Invoice instance (with PDF attached).

        Raises:
            ValidationError: If customer_number is not provided.
        """
        if not customer_number:
            raise ValidationError({"customer_number": ["This field is required."]})

        invoice = Invoice.objects.create(
            submission=submission,
            customer_number=customer_number,
        )

        context = InvoiceService.build_invoice_context(submission, invoice)
        html = render_to_string("pdf/invoice_template.html", context)
        pdf_bytes = PDFService._html_to_pdf(html)

        filename = f"invoice_{invoice.invoice_number}.pdf"
        invoice.pdf_file.save(filename, ContentFile(pdf_bytes), save=False)
        invoice.pdf_size = len(pdf_bytes)
        invoice.save(update_fields=["pdf_file", "pdf_size"])

        submission.invoices_generated_at = timezone.now()
        submission.save(update_fields=["invoices_generated_at"])

        settings.LOGGER.info(f"User {user} generated invoice {invoice.invoice_number}")

        return invoice

    @staticmethod
    def regenerate_invoice_pdf(invoice):
        """Re-render and replace the stored PDF for an existing invoice.

        Returns:
            The updated Invoice instance.
        """
        submission = invoice.submission
        context = InvoiceService.build_invoice_context(submission, invoice)
        html = render_to_string("pdf/invoice_template.html", context)
        pdf_bytes = PDFService._html_to_pdf(html)

        filename = f"invoice_{invoice.invoice_number}.pdf"
        invoice.pdf_file.save(filename, ContentFile(pdf_bytes), save=False)
        invoice.pdf_size = len(pdf_bytes)
        invoice.save(update_fields=["pdf_file", "pdf_size"])

        settings.LOGGER.info(f"Regenerated PDF for invoice {invoice.invoice_number}")

        return invoice


# Backward-compatible function aliases for existing consumers
def build_invoice_context(submission, invoice):
    """Backward-compatible alias."""
    return InvoiceService.build_invoice_context(submission, invoice)


def generate_invoice(submission, customer_number, user):
    """Backward-compatible alias."""
    return InvoiceService.generate_invoice(submission, customer_number, user)


def regenerate_invoice_pdf(invoice):
    """Backward-compatible alias."""
    return InvoiceService.regenerate_invoice_pdf(invoice)
