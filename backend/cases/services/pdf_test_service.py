"""Test PDF service — generates PDFs with hardcoded mock data for template previewing."""

from django.conf import settings
from django.template.loader import render_to_string

from .pdf_service import PDFService

CERTIFICATE_TEMPLATE = "pdf/certificate_template.html"


class TestPDFService:
    """Generates test PDFs with hardcoded mock data for template previewing."""

    @staticmethod
    def generate_test_certificate(variant: str = "base") -> bytes:
        """Generate a test certificate PDF."""
        context = TestPDFService._build_certificate_context()
        html = render_to_string(CERTIFICATE_TEMPLATE, context)
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
