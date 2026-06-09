"""Test PDF service — generates PDFs with hardcoded mock data for template previewing."""

from django.conf import settings
from django.template.loader import render_to_string

from .pdf_service import PDFService

CERTIFICATE_TEMPLATE = "pdf/certificate_template.html"
CERTIFICATE_TEMPLATE_APTOS = "pdf/certificate_template_aptos.html"
CERTIFICATE_TEMPLATE_SEMI_APTOS = "pdf/certificate_template_semi_aptos.html"
INVOICE_TEMPLATE = "pdf/invoice_template.html"


class TestPDFService:
    """Generates test PDFs with hardcoded mock data for template previewing."""

    VARIANT_MAP = {
        "base": CERTIFICATE_TEMPLATE,
        "aptos": CERTIFICATE_TEMPLATE_APTOS,
        "semi_aptos": CERTIFICATE_TEMPLATE_SEMI_APTOS,
    }

    @staticmethod
    def generate_test_certificate(variant: str = "base") -> bytes:
        """Generate a test certificate PDF for the specified template variant."""
        template = TestPDFService.VARIANT_MAP.get(variant, CERTIFICATE_TEMPLATE)
        context = TestPDFService._build_certificate_context()
        html = render_to_string(template, context)
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
            "certificate_number": "5555",
            "police_reference_number": "POL-2026-SOC-001",
            "approved_botanist": "Dr. Jane Smith",
            "defendant": "UNKNOWN",
            "quantity_of_bags": 2,
            "quantity_of_bags_words": "two",
            "tag_numbers": "T107381, T107390",
            "new_tag_numbers": "T119009, T119010",
            "receiving_officer": "Unsworn Officer NEUTRON, Jimmy",
            "description": "quantity of plant",
            "police_officer": "Unsworn Officer PD9999 NEUTRON, Jimmy on behalf of Sworn Officer PD9998 LIGHTYEAR, Buzz of Serious and Organised Crime Divisional Office",
            "receipt_date": "20 March 2026",
            "species_name": "Cannabis sativa",
            "other_matters": "Subsamples placed into Security Movement Envelope WW00999999",
            "certification_date": "28 March 2026",
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
