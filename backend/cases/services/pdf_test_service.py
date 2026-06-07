"""Test PDF service — generates PDFs with hardcoded mock data for template previewing."""

from django.conf import settings
from django.template.loader import render_to_string

from .pdf_service import PDFService

CERTIFICATE_TEMPLATE = "pdf/certificate_template.html"
INVOICE_TEMPLATE = "pdf/invoice_template.html"


class TestPDFService:
    """Generates test PDFs with hardcoded mock data for template previewing."""

    @staticmethod
    def generate_test_certificate() -> bytes:
        """Generate a test certificate PDF with mock data."""
        context = TestPDFService._build_certificate_context()
        html = render_to_string(CERTIFICATE_TEMPLATE, context)
        return PDFService._html_to_pdf(html)

    @staticmethod
    def generate_test_invoice() -> bytes:
        """Generate a test invoice PDF with mock data."""
        context = TestPDFService._build_invoice_context()
        html = render_to_string(INVOICE_TEMPLATE, context)
        return PDFService._html_to_pdf(html)

    @staticmethod
    def _build_certificate_context() -> dict:
        """Build a complete mock context for the certificate template."""
        logo_path = settings.BASE_DIR / "staticfiles" / "images" / "BCSTransparent.png"
        return {
            "certificate_number": "TEST-00001",
            "police_reference_number": "POL-TEST-2025-001",
            "approved_botanist": "Dr. Jane Smith",
            "defendant": "John Alexander Doe",
            "quantity_of_bags": 3,
            "tag_numbers": "A001, A002, A003",
            "description": "green dried plant material",
            "police_officer": "Senior Constable M. Johnson",
            "receipt_date": "15 January 2025",
            "result": "The material examined is Cannabis sativa L.",
            "other_matters": "Nil",
            "certification_date": "22 January 2025",
            "logo_path": f"file://{logo_path}",
            "dbca_org_data": {
                "address": "Locked Bag 104",
                "city": "Bentley Delivery Centre",
                "state": "WA",
                "zip": "6983",
            },
        }

    @staticmethod
    def _build_invoice_context() -> dict:
        """Build a complete mock context for the invoice template."""
        logo_path = settings.BASE_DIR / "staticfiles" / "images" / "dbca_logo.png"
        logo_square = (
            settings.BASE_DIR / "staticfiles" / "images" / "dbca_logo_square.png"
        )
        return {
            "logo_path": f"file://{logo_path}",
            "logo_square": f"file://{logo_square}",
            "invoice_id": "TEST-INV-0001",
            "issue_date": "15 January 2025",
            "due_date": "14 February 2025",
            "police_name": "Senior Constable M. Johnson",
            "police_id": "SC-4521",
            "case_number": "POL-TEST-2025-001",
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
            "approved_botanist": "Dr. Jane Smith",
            "finance_officer": "Sarah Williams",
            "services": [
                {
                    "name": "Botanical Identification",
                    "description": "Identification of 3 drug movement bag(s)",
                    "quantity": 3,
                    "rate": 150.00,
                    "line_total": 450.00,
                },
                {
                    "name": "Certificate of Approved Botanist",
                    "description": "Generation of 1 certificate(s)",
                    "quantity": 1,
                    "rate": 75.00,
                    "line_total": 75.00,
                },
            ],
            "subtotal": 525.00,
            "tax_rate_percent": 10,
            "tax": 52.50,
            "total": 577.50,
        }
