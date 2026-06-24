"""Tests for certificate PDF generation — context building and rendering.

Verifies that build_certificate_context correctly maps model data to template
variables, and that generate_unsigned_certificate produces a valid PDF.
"""

from unittest.mock import patch

import pytest
from django.contrib.auth import get_user_model
from django.core.files.uploadedfile import SimpleUploadedFile
from django.utils import timezone
from rest_framework.exceptions import ValidationError

from cases.models import (
    BotanicalAssessment,
    Certificate,
    DrugBag,
    Submission,
)
from cases.services.certificate_service import (
    build_certificate_context,
    generate_unsigned_certificate,
    regenerate_certificate_pdf,
)
from defendants.models import Defendant
from police.models import PoliceOfficer, PoliceStation
from signatures.models import Signature

User = get_user_model()


@pytest.fixture
def botanist(db):
    """Create a botanist user with a signature on file."""
    user = User.objects.create_user(
        email="botanist@dbca.wa.gov.au",
        password="testpass123",
        first_name="Jane",
        last_name="Botanist",
        role="botanist",
    )
    Signature.objects.create(
        user=user,
        image=SimpleUploadedFile("sig.png", b"\x89PNG\r\n\x1a\n" + b"\x00" * 50),
        content_type="image/png",
        file_size=58,
        file_hash="a" * 64,
    )
    return user


@pytest.fixture
def station(db):
    return PoliceStation.objects.create(name="Perth Central", address="1 Main St")


@pytest.fixture
def officer(db, station):
    return PoliceOfficer.objects.create(
        first_name="John",
        last_name="Smith",
        badge_number="WA1234",
        station=station,
    )


@pytest.fixture
def full_submission(db, botanist, officer):
    """Create a submission with bags, assessments, and defendants — mimics ETL data."""
    sub = Submission.objects.create(
        case_number="IR12345678",
        received=timezone.make_aware(timezone.datetime(2024, 3, 15, 10, 0)),
        security_movement_envelope="SME-001",
        approved_botanist=botanist,
        submitting_officer=officer,
        internal_comments="Sample stored in freezer.",
        additional_notes="Sample stored in freezer.",
        phase=Submission.PhaseChoices.UNSIGNED_GENERATION,
    )

    # Add defendants
    d1 = Defendant.objects.create(given_names="James", last_name="Wilson")
    d2 = Defendant.objects.create(given_names="Sarah", last_name="Connor")
    sub.defendants.add(d1, d2)

    # Add bags with assessments
    bag1 = DrugBag.objects.create(
        submission=sub,
        seal_tag_numbers="DMB-100001",
        content_type=DrugBag.ContentType.PLANT,
    )
    BotanicalAssessment.objects.create(
        drug_bag=bag1,
        determination=BotanicalAssessment.DeterminationChoices.CANNABIS_SATIVA,
        assessment_date=timezone.make_aware(timezone.datetime(2024, 3, 20, 14, 30)),
        botanist_notes=(
            "The material consists of dried plant fragments including leaves "
            "and flowering heads consistent with Cannabis sativa L."
        ),
    )

    bag2 = DrugBag.objects.create(
        submission=sub,
        seal_tag_numbers="DMB-100002",
        content_type=DrugBag.ContentType.SEED,
    )
    BotanicalAssessment.objects.create(
        drug_bag=bag2,
        determination=BotanicalAssessment.DeterminationChoices.CANNABIS_SATIVA,
        assessment_date=timezone.make_aware(timezone.datetime(2024, 3, 20, 14, 30)),
        botanist_notes="Seeds consistent with Cannabis sativa L.",
    )

    return sub


@pytest.mark.django_db
class TestBuildCertificateContext:
    """Tests for build_certificate_context."""

    def test_context_contains_all_template_variables(self, full_submission):
        """Context dict includes every variable the template expects."""
        cert = Certificate.objects.create(submission=full_submission)
        context = build_certificate_context(full_submission, cert)

        expected_keys = {
            "certificate_number",
            "police_reference_number",
            "approved_botanist",
            "quantity_of_bags",
            "quantity_of_bags_words",
            "tag_numbers",
            "description",
            "defendant",
            "police_officer",
            "receipt_date",
            "species_name",
            "other_matters",
            "certification_date",
            "logo_path",
            "dbca_org_data",
        }
        assert expected_keys == set(context.keys())

    def test_context_values_are_correct(self, full_submission):
        """Context values map correctly from model data."""
        cert = Certificate.objects.create(submission=full_submission)
        context = build_certificate_context(full_submission, cert)

        assert context["certificate_number"] == cert.certificate_number
        assert context["police_reference_number"] == "IR12345678"
        assert context["approved_botanist"] == "Jane Botanist"
        assert context["quantity_of_bags"] == 2
        assert "DMB-100001" in context["tag_numbers"]
        assert "DMB-100002" in context["tag_numbers"]
        assert "Plant Material" in context["description"]
        assert "Seed" in context["description"]
        assert "Wilson, James" in context["defendant"]
        assert "Connor, Sarah" in context["defendant"]
        assert context["police_officer"] == "John Smith"
        assert context["receipt_date"] == "15 March 2024"
        assert "Cannabis sativa" in context["species_name"]
        assert context["other_matters"] == "Sample stored in freezer."
        assert context["certification_date"] == "20 March 2024"
        assert context["dbca_org_data"]["state"] == "WA"

    def test_raises_when_no_bags(self, db, botanist, officer):
        """Raises ValidationError when submission has no bags."""
        sub = Submission.objects.create(
            case_number="EMPTY-001",
            received=timezone.now(),
            approved_botanist=botanist,
            submitting_officer=officer,
        )
        cert = Certificate.objects.create(submission=sub)

        with pytest.raises(ValidationError, match="no bags"):
            build_certificate_context(sub, cert)

    def test_raises_when_no_assessments(self, db, botanist, officer):
        """Raises ValidationError when bags have no assessments."""
        sub = Submission.objects.create(
            case_number="NOASSESS-001",
            received=timezone.now(),
            approved_botanist=botanist,
            submitting_officer=officer,
        )
        DrugBag.objects.create(
            submission=sub,
            seal_tag_numbers="TAG-999",
            content_type=DrugBag.ContentType.PLANT,
        )
        cert = Certificate.objects.create(submission=sub)

        with pytest.raises(ValidationError, match="no bags have botanical assessments"):
            build_certificate_context(sub, cert)

    def test_nil_for_empty_internal_comments(self, full_submission):
        """other_matters defaults to 'None' when additional_notes is empty."""
        full_submission.additional_notes = ""
        full_submission.save(update_fields=["additional_notes"])

        cert = Certificate.objects.create(submission=full_submission)
        context = build_certificate_context(full_submission, cert)

        assert context["other_matters"] == "None"


@pytest.mark.django_db
class TestGenerateUnsignedCertificate:
    """Tests for generate_unsigned_certificate with PDF rendering."""

    @patch("cases.services.pdf_service.PDFService._html_to_pdf")
    def test_generates_pdf_and_stores_on_certificate(
        self, mock_html_to_pdf, full_submission, botanist
    ):
        """generate_unsigned_certificate renders PDF and stores it."""
        # Return fake PDF bytes (valid PDF magic bytes)
        fake_pdf = b"%PDF-1.4 fake content for testing"
        mock_html_to_pdf.return_value = fake_pdf

        cert = generate_unsigned_certificate(full_submission, botanist)

        assert cert.unsigned_pdf_file is not None
        assert cert.unsigned_pdf_file.name != ""
        assert cert.unsigned_pdf_size == len(fake_pdf)
        mock_html_to_pdf.assert_called_once()

    @patch("cases.services.pdf_service.PDFService._html_to_pdf")
    def test_pdf_starts_with_pdf_magic_bytes(
        self, mock_html_to_pdf, full_submission, botanist
    ):
        """The stored PDF content starts with %PDF- magic bytes."""
        fake_pdf = b"%PDF-1.4\n%\xe2\xe3\xcf\xd3\nfake pdf body"
        mock_html_to_pdf.return_value = fake_pdf

        cert = generate_unsigned_certificate(full_submission, botanist)

        cert.unsigned_pdf_file.seek(0)
        content = cert.unsigned_pdf_file.read()
        assert content.startswith(b"%PDF-")


@pytest.mark.django_db
class TestRegenerateCertificatePdf:
    """Tests for regenerate_certificate_pdf."""

    @patch("cases.services.pdf_service.PDFService._html_to_pdf")
    def test_regenerates_pdf_successfully(self, mock_html_to_pdf, full_submission):
        """Regenerate replaces the stored PDF with fresh content."""
        cert = Certificate.objects.create(submission=full_submission)
        # Simulate an existing PDF
        cert.unsigned_pdf_file.save(
            "old.pdf", SimpleUploadedFile("old.pdf", b"%PDF-old"), save=True
        )

        new_pdf = b"%PDF-1.4 regenerated content"
        mock_html_to_pdf.return_value = new_pdf

        updated = regenerate_certificate_pdf(cert)

        assert updated.unsigned_pdf_size == len(new_pdf)
        updated.unsigned_pdf_file.seek(0)
        assert updated.unsigned_pdf_file.read() == new_pdf

    def test_raises_when_locked(self, full_submission):
        """Raises ValidationError when certificate is locked."""
        cert = Certificate.objects.create(submission=full_submission, is_locked=True)

        with pytest.raises(ValidationError, match="locked"):
            regenerate_certificate_pdf(cert)
