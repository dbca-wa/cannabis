"""Service layer integration tests for cases app.

Tests WorkflowService, CertificateService, and PDFService using
factory fixtures from common/tests/shared_fixtures.py.
"""

from unittest.mock import patch

import pytest
from django.utils import timezone
from rest_framework.exceptions import NotFound, ValidationError

from cases.models import (
    BotanicalAssessment,
    Case,
    CasePhaseHistory,
    Certificate,
    DrugBag,
)
from cases.services.certificate_service import CertificateService
from cases.services.pdf_service import PDFService
from cases.services.workflow_service import WorkflowService

# ============================================================================
# WorkflowService Tests
# ============================================================================


@pytest.mark.django_db
class TestWorkflowServiceAdvance:
    """Tests for WorkflowService.advance_case."""

    def test_advance_from_assessment_to_data_entry(self, make_case, make_user):
        """Advancing from assessment moves to data_entry."""
        user = make_user(email="wf1@test.com", role="finance")
        case = make_case(phase=Case.PhaseChoices.ASSESSMENT)

        result = WorkflowService.advance_case(case, user)

        assert result == Case.PhaseChoices.DATA_ENTRY
        case.refresh_from_db()
        assert case.phase == Case.PhaseChoices.DATA_ENTRY

    def test_advance_creates_phase_history(self, make_case, make_user):
        """Advancing creates a CasePhaseHistory audit record."""
        user = make_user(email="wf2@test.com", role="finance")
        case = make_case(phase=Case.PhaseChoices.DATA_ENTRY)

        WorkflowService.advance_case(case, user)

        history = CasePhaseHistory.objects.filter(submission=case).first()
        assert history is not None
        assert history.from_phase == Case.PhaseChoices.DATA_ENTRY
        assert history.to_phase == Case.PhaseChoices.UNSIGNED_GENERATION
        assert history.action == "advance"
        assert history.user == user

    def test_advance_from_complete_raises(self, make_case, make_user):
        """Cannot advance from the complete phase."""
        user = make_user(email="wf3@test.com", role="finance")
        case = make_case(phase=Case.PhaseChoices.COMPLETE)

        with pytest.raises(ValidationError):
            WorkflowService.advance_case(case, user)

    def test_advance_full_sequence(self, make_case, make_user):
        """Advancing through all phases reaches complete."""
        user = make_user(email="wf4@test.com", role="finance")
        case = make_case(phase=Case.PhaseChoices.ASSESSMENT)

        expected_sequence = [
            Case.PhaseChoices.DATA_ENTRY,
            Case.PhaseChoices.UNSIGNED_GENERATION,
            Case.PhaseChoices.BOTANIST_SIGNOFF,
            Case.PhaseChoices.INVOICING,
            Case.PhaseChoices.SEND_EMAILS,
            Case.PhaseChoices.COMPLETE,
        ]

        for expected_phase in expected_sequence:
            result = WorkflowService.advance_case(case, user)
            assert result == expected_phase


@pytest.mark.django_db
class TestWorkflowServiceSendBack:
    """Tests for WorkflowService.send_back_case."""

    def test_send_back_to_earlier_phase(self, make_case, make_user):
        """Send back moves case to specified earlier phase."""
        user = make_user(email="sb1@test.com", role="finance")
        case = make_case(phase=Case.PhaseChoices.BOTANIST_SIGNOFF)

        result = WorkflowService.send_back_case(
            case, Case.PhaseChoices.DATA_ENTRY, "Data incomplete", user
        )

        assert result["new_phase"] == Case.PhaseChoices.DATA_ENTRY
        case.refresh_from_db()
        assert case.phase == Case.PhaseChoices.DATA_ENTRY

    def test_send_back_requires_reason(self, make_case, make_user):
        """Send back without reason raises ValidationError."""
        user = make_user(email="sb2@test.com", role="finance")
        case = make_case(phase=Case.PhaseChoices.INVOICING)

        with pytest.raises(ValidationError):
            WorkflowService.send_back_case(case, Case.PhaseChoices.DATA_ENTRY, "", user)

    def test_send_back_cannot_go_forward(self, make_case, make_user):
        """Send back to a later phase raises ValidationError."""
        user = make_user(email="sb3@test.com", role="finance")
        case = make_case(phase=Case.PhaseChoices.DATA_ENTRY)

        with pytest.raises(ValidationError):
            WorkflowService.send_back_case(
                case, Case.PhaseChoices.INVOICING, "Wrong direction", user
            )

    def test_send_back_creates_history_with_reason(self, make_case, make_user):
        """Send back creates phase history with reason recorded."""
        user = make_user(email="sb4@test.com", role="finance")
        case = make_case(phase=Case.PhaseChoices.UNSIGNED_GENERATION)

        WorkflowService.send_back_case(
            case, Case.PhaseChoices.ASSESSMENT, "Needs re-assessment", user
        )

        history = CasePhaseHistory.objects.filter(submission=case).first()
        assert history.action == "send_back"
        assert history.reason == "Needs re-assessment"


# ============================================================================
# CertificateService Tests
# ============================================================================


@pytest.mark.django_db
class TestCertificateService:
    """Tests for CertificateService CRUD and signing context."""

    def test_get_certificate_success(self, make_case, make_certificate):
        """Retrieves certificate by pk."""
        case = make_case(case_number="CERT-001")
        cert = make_certificate(case)

        result = CertificateService.get_certificate(cert.pk)
        assert result.pk == cert.pk

    def test_get_certificate_not_found(self):
        """Raises NotFound for nonexistent certificate."""
        with pytest.raises(NotFound):
            CertificateService.get_certificate(pk=99999)

    def test_validate_no_existing_certificate(self, make_case):
        """Validation passes when no certificate exists."""
        case = make_case(case_number="CERT-002")
        # Should not raise
        CertificateService.validate_certificate_generation(case)

    def test_validate_rejects_existing_certificate(self, make_case, make_certificate):
        """Validation fails when certificate already exists."""
        case = make_case(case_number="CERT-003")
        make_certificate(case)

        with pytest.raises(ValidationError, match="already exists"):
            CertificateService.validate_certificate_generation(case)

    def test_build_certificate_context_includes_required_fields(self, make_case):
        """Context building returns all template-required fields."""
        case = make_case(case_number="CERT-004")
        bag = DrugBag.objects.create(
            submission=case,
            seal_tag_numbers="TAG-CTX-001",
            content_type=DrugBag.ContentType.PLANT,
        )
        BotanicalAssessment.objects.create(
            drug_bag=bag,
            determination=BotanicalAssessment.DeterminationChoices.CANNABIS_SATIVA,
            assessment_date=timezone.now(),
            botanist_notes="Confirmed cannabis sativa.",
        )
        cert = Certificate.objects.create(submission=case)

        context = CertificateService.build_certificate_context(case, cert)

        assert "certificate_number" in context
        assert "police_reference_number" in context
        assert "tag_numbers" in context
        assert "quantity_of_bags" in context
        assert context["police_reference_number"] == "CERT-004"
        assert context["quantity_of_bags"] == 1


# ============================================================================
# PDFService Tests
# ============================================================================


@pytest.mark.django_db
class TestPDFService:
    """Tests for PDFService context building and error handling."""

    def test_html_to_pdf_success(self):
        """_html_to_pdf returns bytes when subprocess succeeds."""
        with patch("cases.services.pdf_service.subprocess.run") as mock_run:
            mock_run.return_value.returncode = 0
            # Create a mock temp file read
            with patch("builtins.open", create=True) as mock_open:
                mock_open.return_value.__enter__ = lambda s: s
                mock_open.return_value.__exit__ = lambda s, *a: None
                mock_open.return_value.read = lambda: b"%PDF-1.4 mock"

                with patch("os.path.exists", return_value=True), patch("os.unlink"):
                    result = PDFService._html_to_pdf("<html>test</html>")

            assert result == b"%PDF-1.4 mock"

    def test_html_to_pdf_nonzero_exit_raises(self):
        """_html_to_pdf raises ValidationError on non-zero exit code."""
        with patch("cases.services.pdf_service.subprocess.run") as mock_run:
            mock_run.return_value.returncode = 1
            mock_run.return_value.stderr = "prince error"

            with patch("os.path.exists", return_value=False):
                with pytest.raises(ValidationError, match="PDF generation failed"):
                    PDFService._html_to_pdf("<html>bad</html>")

    def test_html_to_pdf_timeout_raises(self):
        """_html_to_pdf raises ValidationError on subprocess timeout."""
        import subprocess

        with patch("cases.services.pdf_service.subprocess.run") as mock_run:
            mock_run.side_effect = subprocess.TimeoutExpired(cmd="prince", timeout=300)

            with patch("os.path.exists", return_value=False):
                with pytest.raises(ValidationError, match="timed out"):
                    PDFService._html_to_pdf("<html>slow</html>")

    def test_html_to_pdf_missing_binary_raises(self):
        """_html_to_pdf raises ValidationError when prince binary not found."""
        with patch("cases.services.pdf_service.subprocess.run") as mock_run:
            mock_run.side_effect = FileNotFoundError("prince not found")

            with patch("os.path.exists", return_value=False):
                with pytest.raises(ValidationError, match="unavailable"):
                    PDFService._html_to_pdf("<html>nope</html>")

    def test_build_certificate_context_delegates(self, make_case):
        """_build_certificate_context calls CertificateService and adds file:// prefix."""
        case = make_case(case_number="PDF-001")
        bag = DrugBag.objects.create(
            submission=case,
            seal_tag_numbers="TAG-PDF-001",
            content_type=DrugBag.ContentType.PLANT,
        )
        BotanicalAssessment.objects.create(
            drug_bag=bag,
            determination=BotanicalAssessment.DeterminationChoices.CANNABIS_SATIVA,
            assessment_date=timezone.now(),
            botanist_notes="Test notes.",
        )
        Certificate.objects.create(submission=case)

        context = PDFService._build_certificate_context(case)

        assert "certificate_number" in context
        assert context["logo_path"].startswith("file://")
