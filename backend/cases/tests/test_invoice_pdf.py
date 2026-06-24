"""Tests for invoice PDF context building and generation."""

from decimal import Decimal
from unittest.mock import patch

import pytest
from django.utils import timezone

from cases.models import (
    AdditionalInvoiceFee,
    Certificate,
    DrugBag,
    Invoice,
    Submission,
)
from cases.services.invoice_service import (
    build_invoice_context,
    generate_invoice,
    regenerate_invoice_pdf,
)
from common.models import SystemSettings
from police.models import PoliceOfficer, PoliceStation


@pytest.fixture
def system_settings(db):
    """Ensure SystemSettings singleton exists with known values."""
    obj = SystemSettings.load()
    obj.cost_per_bag = Decimal("11.00")
    obj.cost_per_certificate = Decimal("110.00")
    obj.cost_per_kilometer_fuel = Decimal("1.750")
    obj.cost_per_forensic_hour = Decimal("150.00")
    obj.call_out_fee = Decimal("200.00")
    obj.tax_percentage = Decimal("10.00")
    obj.save()
    return obj


@pytest.fixture
def full_submission(db, system_settings):
    """Create a submission with all related data for invoice testing."""
    from django.contrib.auth import get_user_model

    User = get_user_model()

    # Create users
    botanist = User.objects.create_user(
        email="botanist@test.com",
        password="testpass123",
        first_name="Jane",
        last_name="Botanist",
        role="botanist",
    )
    finance = User.objects.create_user(
        email="finance@test.com",
        password="testpass123",
        first_name="Bob",
        last_name="Finance",
        role="finance",
    )

    # Create police officer
    station = PoliceStation.objects.create(name="Perth Central", address="1 Main St")
    officer = PoliceOfficer.objects.create(
        first_name="Constable",
        last_name="Smith",
        badge_number="WA-5678",
        station=station,
    )

    # Create submission
    submission = Submission.objects.create(
        case_number="CASE-2024-001",
        received=timezone.now(),
        security_movement_envelope="ENV-001",
        approved_botanist=botanist,
        finance_officer=finance,
        submitting_officer=officer,
        phase=Submission.PhaseChoices.INVOICING,
    )

    # Create bags
    DrugBag.objects.create(
        submission=submission,
        seal_tag_numbers="TAG-001",
        content_type=DrugBag.ContentType.PLANT,
    )
    DrugBag.objects.create(
        submission=submission,
        seal_tag_numbers="TAG-002",
        content_type=DrugBag.ContentType.SEED,
    )

    # Create a certificate (so cert fee appears)
    Certificate.objects.create(
        submission=submission,
        certificate_number="CRT2024-TEST-001",
    )

    # Create additional fees
    AdditionalInvoiceFee.objects.create(
        submission=submission,
        claim_kind=AdditionalInvoiceFee.FeeChoices.FUEL,
        units=50,
        description="Travel to Perth Central",
    )

    return submission


@pytest.mark.django_db
class TestBuildInvoiceContext:
    """Tests for build_invoice_context function."""

    def test_context_contains_required_keys(self, full_submission, system_settings):
        """Context dict includes all keys expected by the template."""
        invoice = Invoice.objects.create(
            submission=full_submission,
            customer_number="CUST-001",
        )
        invoice.calculate_totals()
        invoice.save()

        context = build_invoice_context(full_submission, invoice)

        required_keys = [
            "logo_path",
            "logo_square",
            "invoice_id",
            "issue_date",
            "due_date",
            "police_name",
            "police_id",
            "case_number",
            "approved_botanist",
            "finance_officer",
            "services",
            "subtotal",
            "tax_rate_percent",
            "tax",
            "total",
            "dbca_org_data",
            "billed_to",
        ]
        for key in required_keys:
            assert key in context, f"Missing key: {key}"

    def test_officer_details_populated(self, full_submission, system_settings):
        """Police officer name and badge number are correctly mapped."""
        invoice = Invoice.objects.create(
            submission=full_submission,
            customer_number="CUST-001",
        )
        invoice.calculate_totals()
        invoice.save()

        context = build_invoice_context(full_submission, invoice)

        assert context["police_name"] == "Constable Smith"
        assert context["police_id"] == "CUST-001"
        assert context["case_number"] == "CASE-2024-001"

    def test_staff_names_populated(self, full_submission, system_settings):
        """Botanist and finance officer names are correctly mapped."""
        invoice = Invoice.objects.create(
            submission=full_submission,
            customer_number="CUST-001",
        )
        invoice.calculate_totals()
        invoice.save()

        context = build_invoice_context(full_submission, invoice)

        assert context["approved_botanist"] == "Jane Botanist"
        assert context["finance_officer"] == "Bob Finance"

    def test_services_include_bag_and_cert_fees(self, full_submission, system_settings):
        """Services list includes bag identification and certificate fees."""
        invoice = Invoice.objects.create(
            submission=full_submission,
            customer_number="CUST-001",
        )
        invoice.calculate_totals()
        invoice.save()

        context = build_invoice_context(full_submission, invoice)
        services = context["services"]

        # Should have bag fee, cert fee, and fuel fee = 3 items
        assert len(services) == 3

        # Bag identification
        bag_service = services[0]
        assert bag_service["name"] == "Botanical Identification"
        assert bag_service["quantity"] == 2
        assert bag_service["rate"] == 11.0
        assert bag_service["line_total"] == 22.0

        # Certificate fee
        cert_service = services[1]
        assert cert_service["name"] == "Certificate of Approved Botanist"
        assert cert_service["quantity"] == 1
        assert cert_service["rate"] == 110.0
        assert cert_service["line_total"] == 110.0

    def test_services_include_additional_fees(self, full_submission, system_settings):
        """Additional fees (fuel, forensic, call-out) appear in services."""
        invoice = Invoice.objects.create(
            submission=full_submission,
            customer_number="CUST-001",
        )
        invoice.calculate_totals()
        invoice.save()

        context = build_invoice_context(full_submission, invoice)
        services = context["services"]

        # Last service should be the fuel fee
        fuel_service = services[-1]
        assert fuel_service["name"] == "Fuel/Travel"
        assert fuel_service["description"] == "Travel to Perth Central"
        assert fuel_service["quantity"] == 50
        assert fuel_service["line_total"] == 87.5  # 50 * 1.75

    def test_totals_match_invoice(self, full_submission, system_settings):
        """Context totals match the calculated invoice totals."""
        invoice = Invoice.objects.create(
            submission=full_submission,
            customer_number="CUST-001",
        )
        invoice.calculate_totals()
        invoice.save()

        context = build_invoice_context(full_submission, invoice)

        assert context["subtotal"] == float(invoice.subtotal)
        assert context["tax"] == float(invoice.tax_amount)
        assert context["total"] == float(invoice.total)
        assert context["tax_rate_percent"] == 10.0

    def test_dates_formatted_correctly(self, full_submission, system_settings):
        """Issue and due dates are formatted as DD Month YYYY."""
        invoice = Invoice.objects.create(
            submission=full_submission,
            customer_number="CUST-001",
        )
        invoice.calculate_totals()
        invoice.save()

        context = build_invoice_context(full_submission, invoice)

        # Check format pattern (e.g. "01 January 2024")
        import re

        date_pattern = r"\d{2} \w+ \d{4}"
        assert re.match(date_pattern, context["issue_date"])
        assert re.match(date_pattern, context["due_date"])

    def test_handles_missing_officers_gracefully(self, db, system_settings):
        """Context handles None officers without raising errors."""
        submission = Submission.objects.create(
            case_number="CASE-EMPTY-001",
            received=timezone.now(),
            security_movement_envelope="ENV-002",
            phase=Submission.PhaseChoices.INVOICING,
        )
        invoice = Invoice.objects.create(
            submission=submission,
            customer_number="CUST-002",
        )

        context = build_invoice_context(submission, invoice)

        assert context["police_name"] == ""
        assert context["police_id"] == "CUST-002"
        assert context["approved_botanist"] == ""
        assert context["finance_officer"] == ""


@pytest.mark.django_db
class TestGenerateInvoice:
    """Tests for generate_invoice with PDF rendering."""

    @patch("cases.services.pdf_service.PDFService._html_to_pdf")
    def test_generate_invoice_stores_pdf(
        self, mock_html_to_pdf, full_submission, system_settings
    ):
        """generate_invoice renders PDF and stores it on the model."""
        # Return minimal valid PDF bytes
        mock_html_to_pdf.return_value = b"%PDF-1.4 fake pdf content"

        from django.contrib.auth import get_user_model

        User = get_user_model()
        user = User.objects.create_user(email="gen@test.com", password="testpass123")

        invoice = generate_invoice(full_submission, "CUST-GEN-001", user)

        assert invoice.pdf_file
        assert invoice.pdf_size == len(b"%PDF-1.4 fake pdf content")
        mock_html_to_pdf.assert_called_once()

    @patch("cases.services.pdf_service.PDFService._html_to_pdf")
    def test_generate_invoice_sets_timestamp(
        self, mock_html_to_pdf, full_submission, system_settings
    ):
        """generate_invoice sets invoices_generated_at on submission."""
        mock_html_to_pdf.return_value = b"%PDF-1.4 fake"

        from django.contrib.auth import get_user_model

        User = get_user_model()
        user = User.objects.create_user(email="gen2@test.com", password="testpass123")

        generate_invoice(full_submission, "CUST-GEN-002", user)
        full_submission.refresh_from_db()

        assert full_submission.invoices_generated_at is not None


@pytest.mark.django_db
class TestRegenerateInvoicePdf:
    """Tests for regenerate_invoice_pdf function."""

    @patch("cases.services.pdf_service.PDFService._html_to_pdf")
    def test_regenerate_replaces_pdf(
        self, mock_html_to_pdf, full_submission, system_settings
    ):
        """regenerate_invoice_pdf replaces the existing PDF file."""
        mock_html_to_pdf.return_value = b"%PDF-1.4 regenerated content"

        invoice = Invoice.objects.create(
            submission=full_submission,
            customer_number="CUST-REGEN-001",
        )
        invoice.calculate_totals()
        invoice.save()

        result = regenerate_invoice_pdf(invoice)

        assert result.pdf_file
        assert result.pdf_size == len(b"%PDF-1.4 regenerated content")
        mock_html_to_pdf.assert_called_once()
