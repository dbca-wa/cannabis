"""Preview views — DEBUG-only HTML preview of PDF templates.

These endpoints render the certificate and invoice templates as raw HTML
in the browser, allowing developers to verify template output without
generating actual PDFs.
"""

from django.conf import settings
from django.http import HttpResponse
from django.shortcuts import get_object_or_404
from django.template.loader import render_to_string
from rest_framework.exceptions import PermissionDenied
from rest_framework.permissions import IsAuthenticated
from rest_framework.views import APIView

from ..models import Case
from ..services.certificate_service import build_certificate_context
from ..services.invoice_service import build_invoice_context


class CertificatePreviewView(APIView):
    """Render the certificate template as HTML for browser preview.

    DEBUG-only endpoint — returns 403 in non-debug environments.
    Uses real submission data to populate the template context.
    """

    permission_classes = [IsAuthenticated]

    def get(self, request, pk):
        if not settings.DEBUG:
            raise PermissionDenied(
                "Preview endpoints are only available in DEBUG mode."
            )

        submission = get_object_or_404(Case, pk=pk)

        # Use the existing certificate if one exists, otherwise create a temporary one
        certificate = submission.certificates.first()
        if certificate is None:
            # Build a temporary mock certificate for preview purposes
            certificate = _build_mock_certificate(submission)

        context = build_certificate_context(submission, certificate)
        html = render_to_string("pdf/certificate_template.html", context)
        return HttpResponse(html, content_type="text/html")


class InvoicePreviewView(APIView):
    """Render the invoice template as HTML for browser preview.

    DEBUG-only endpoint — returns 403 in non-debug environments.
    Uses real submission data to populate the template context.
    """

    permission_classes = [IsAuthenticated]

    def get(self, request, pk):
        if not settings.DEBUG:
            raise PermissionDenied(
                "Preview endpoints are only available in DEBUG mode."
            )

        submission = get_object_or_404(Case, pk=pk)

        # Use the existing invoice if one exists, otherwise create a temporary one
        invoice = submission.invoices.first()
        if invoice is None:
            invoice = _build_mock_invoice(submission)

        context = build_invoice_context(submission, invoice)
        html = render_to_string("pdf/invoice_template.html", context)
        return HttpResponse(html, content_type="text/html")


class _MockCertificate:
    """Lightweight stand-in for a Certificate when none exists yet."""

    def __init__(self, certificate_number):
        self.certificate_number = certificate_number


class _MockInvoice:
    """Lightweight stand-in for an Invoice when none exists yet."""

    def __init__(self, invoice_number, subtotal, tax_amount, total, customer_number=""):
        self.invoice_number = invoice_number
        self.subtotal = subtotal
        self.tax_amount = tax_amount
        self.total = total
        self.customer_number = customer_number


def _build_mock_certificate(submission):
    """Create a mock certificate object for preview rendering."""
    return _MockCertificate(certificate_number="PREVIEW-0000")


def _build_mock_invoice(submission):
    """Create a mock invoice with calculated totals for preview rendering."""
    from decimal import Decimal

    from common.models import SystemSettings

    settings_obj = SystemSettings.load()
    bags = submission.bags.all()
    bag_count = bags.count()
    cert_count = submission.certificates.count()

    bag_cost = bag_count * settings_obj.cost_per_bag
    cert_cost = cert_count * settings_obj.cost_per_certificate

    # Include additional fees
    additional = Decimal("0.00")
    for fee in submission.additional_fees.all():
        additional += fee.calculated_cost

    subtotal = bag_cost + cert_cost + additional
    tax_amount = subtotal * (settings_obj.tax_percentage / Decimal("100"))
    total = subtotal + tax_amount

    return _MockInvoice(
        invoice_number="PREVIEW-INV-0000",
        subtotal=subtotal,
        tax_amount=tax_amount,
        total=total,
    )
