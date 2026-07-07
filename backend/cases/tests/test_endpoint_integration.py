"""Integration tests for check-number, case creation, and batch endpoints.

Uses DRF APIClient with pytest.mark.django_db. Covers:
- GET check-number returns {exists: true, case: {id, case_number}} on match
- GET check-number returns {exists: false, case: null} on no match
- Case-insensitive matching (lowercase vs uppercase)
- Creating a case with a taken reference fails
- POST batches with {certificate_ids: [...]} creates a batch from eligible certs
"""

from unittest.mock import patch

import pytest
from django.urls import reverse
from django.utils import timezone

from cases.models import (
    BotanicalAssessment,
    Case,
    Certificate,
    DrugBag,
    Priority3Form,
)
from cases.services.certificate_service import CertificateService
from cases.services.workflow_service import WorkflowService

pytestmark = pytest.mark.django_db

PDF_PATCH = "cases.services.certificate_service.PDFService._html_to_pdf"
BATCH_PDF_PATCH = "cases.services.batch_service.PDFService._html_to_pdf"


@pytest.fixture(autouse=True)
def _tmp_media(settings, tmp_path):
    settings.MEDIA_ROOT = str(tmp_path)


def _make_user():
    from django.contrib.auth import get_user_model

    User = get_user_model()
    return User.objects.create_user(
        email="endpoint-test@test.com", password="x", role="finance"
    )


class TestCheckNumber:
    """GET /api/v1/cases/check-number?case_number=X."""

    def test_returns_exists_true_with_case_on_match(self, finance_client):
        case = Case.objects.create(case_number="CHECK-001", received=timezone.now())
        resp = finance_client.get(
            reverse("case_number_check"),
            {"case_number": "CHECK-001"},
        )
        assert resp.status_code == 200
        assert resp.data["exists"] is True
        assert resp.data["case"]["id"] == case.pk
        assert resp.data["case"]["case_number"] == "CHECK-001"

    def test_returns_exists_false_on_no_match(self, finance_client):
        resp = finance_client.get(
            reverse("case_number_check"),
            {"case_number": "NONEXISTENT-999"},
        )
        assert resp.status_code == 200
        assert resp.data["exists"] is False
        assert resp.data["case"] is None

    def test_case_insensitive_matching(self, finance_client):
        """Lowercase query matches an uppercase stored reference."""
        Case.objects.create(case_number="CANN12345", received=timezone.now())
        resp = finance_client.get(
            reverse("case_number_check"),
            {"case_number": "cann12345"},
        )
        assert resp.status_code == 200
        assert resp.data["exists"] is True
        assert resp.data["case"]["case_number"] == "CANN12345"

    def test_uppercase_query_matches_lowercase_stored(self, finance_client):
        """Uppercase query matches a lowercase stored reference."""
        Case.objects.create(case_number="lower-ref-001", received=timezone.now())
        resp = finance_client.get(
            reverse("case_number_check"),
            {"case_number": "LOWER-REF-001"},
        )
        assert resp.status_code == 200
        assert resp.data["exists"] is True

    def test_trimmed_matching(self, finance_client):
        """Whitespace-padded query still matches."""
        Case.objects.create(case_number="TRIM-001", received=timezone.now())
        resp = finance_client.get(
            reverse("case_number_check"),
            {"case_number": "  TRIM-001  "},
        )
        assert resp.status_code == 200
        assert resp.data["exists"] is True


class TestDuplicateReferenceCreation:
    """Creating a case with a taken reference fails."""

    def test_create_case_with_duplicate_reference_fails(self, finance_client):
        """POST to case list with an existing case_number is rejected."""
        Case.objects.create(case_number="DUP-REF-001", received=timezone.now())
        resp = finance_client.post(
            reverse("case_list"),
            {
                "case_number": "DUP-REF-001",
                "received": timezone.now().isoformat(),
            },
            format="json",
        )
        assert resp.status_code == 400


class TestBatchCreation:
    """POST /api/v1/cases/batches with certificate_ids."""

    def _make_eligible_cert(self, user):
        """Create an eligible certificate (form in batching phase)."""
        case = Case.objects.create(
            case_number=f"BATCH-{Certificate.objects.count() + 1:05d}",
            received=timezone.now(),
        )
        form = Priority3Form.objects.create(case=case)
        bag = DrugBag.objects.create(
            form=form,
            seal_tag_numbers=f"BT-{DrugBag.objects.count() + 1:05d}",
            content_type="plant",
        )
        BotanicalAssessment.objects.create(
            drug_bag=bag,
            determination="cannabis_sativa",
        )

        with patch(PDF_PATCH, return_value=b"%PDF-1.4 test"):
            cert = CertificateService.generate_certificate(form, user)

        form.refresh_from_db()
        if form.phase != Case.PhaseChoices.BATCHING:
            WorkflowService.advance_form(form, user)
            form.refresh_from_db()

        assert form.phase == Case.PhaseChoices.BATCHING
        return cert

    def test_batch_creation_with_certificate_ids(self, finance_client, system_settings):
        """POST with certificate_ids creates a batch from eligible certs."""
        user = _make_user()
        cert1 = self._make_eligible_cert(user)
        cert2 = self._make_eligible_cert(user)

        with patch(BATCH_PDF_PATCH, return_value=b"%PDF-1.4 test"):
            resp = finance_client.post(
                reverse("batch_list_create"),
                {"certificate_ids": [cert1.pk, cert2.pk]},
                format="json",
            )

        assert resp.status_code == 201
        assert resp.data["certificate_count"] == 2

    def test_batch_rejects_ineligible_certificate(
        self, finance_client, system_settings
    ):
        """A certificate not in batching phase is rejected."""
        case = Case.objects.create(
            case_number="BATCH-INELIG",
            received=timezone.now(),
        )
        form = Priority3Form.objects.create(case=case)
        bag = DrugBag.objects.create(
            form=form,
            seal_tag_numbers="INELIG-TAG",
            content_type="plant",
        )
        BotanicalAssessment.objects.create(
            drug_bag=bag,
            determination="cannabis_sativa",
        )

        user = _make_user()
        with patch(PDF_PATCH, return_value=b"%PDF-1.4 test"):
            cert = CertificateService.generate_certificate(form, user)

        # Form is in unsigned_generation, NOT batching
        form.refresh_from_db()
        assert form.phase != Case.PhaseChoices.BATCHING

        with patch(BATCH_PDF_PATCH, return_value=b"%PDF-1.4 test"):
            resp = finance_client.post(
                reverse("batch_list_create"),
                {"certificate_ids": [cert.pk]},
                format="json",
            )

        assert resp.status_code == 400
