"""Tests for the case phase workflow (forward-only, no send-back)."""

from unittest.mock import patch

import pytest
from django.urls import reverse

from common.tests.factories import (
    BotanicalAssessmentFactory,
    CaseFactory,
    DrugBagFactory,
)

pytestmark = pytest.mark.django_db

# Certificate generation renders via PrinceXML (a `prince` subprocess). Stub it.
PDF = "cases.services.certificate_service.PDFService._html_to_pdf"


def _results(data):
    """Return the list of rows from a paginated or plain list response."""
    return data["results"] if isinstance(data, dict) else data


class TestAdvancePhase:
    def test_assessment_advances_to_unsigned(self, finance_client):
        case = CaseFactory(phase="assessment")
        resp = finance_client.post(
            reverse("case_workflow", kwargs={"pk": case.pk}),
            {"action": "advance_phase"},
            format="json",
        )
        assert resp.status_code == 200
        assert resp.data["new_phase"] == "unsigned_generation"

    def test_cannot_leave_unsigned_without_certificates(self, finance_client):
        case = CaseFactory(phase="unsigned_generation")
        resp = finance_client.post(
            reverse("case_workflow", kwargs={"pk": case.pk}),
            {"action": "advance_phase"},
            format="json",
        )
        assert resp.status_code == 400

    def test_cannot_advance_from_complete(self, finance_client):
        # A complete case is read-only for non-admins — the guard rejects the
        # workflow action with 403 before any phase logic runs.
        case = CaseFactory(phase="complete")
        resp = finance_client.post(
            reverse("case_workflow", kwargs={"pk": case.pk}),
            {"action": "advance_phase"},
            format="json",
        )
        assert resp.status_code == 403

    def test_admin_cannot_advance_past_complete(self, admin_client):
        # Admins bypass the read-only guard, but the workflow itself has no
        # phase beyond Complete, so advancing is still rejected (400).
        case = CaseFactory(phase="complete")
        resp = admin_client.post(
            reverse("case_workflow", kwargs={"pk": case.pk}),
            {"action": "advance_phase"},
            format="json",
        )
        assert resp.status_code == 400

    def test_send_back_is_not_a_valid_action(self, finance_client):
        case = CaseFactory(phase="unsigned_generation")
        resp = finance_client.post(
            reverse("case_workflow", kwargs={"pk": case.pk}),
            {"action": "send_back"},
            format="json",
        )
        assert resp.status_code == 400

    def test_requires_app_access(self, roleless_client):
        case = CaseFactory(phase="assessment")
        resp = roleless_client.post(
            reverse("case_workflow", kwargs={"pk": case.pk}),
            {"action": "advance_phase"},
            format="json",
        )
        assert resp.status_code == 403


class TestGenerateCertificateAction:
    def test_generate_moves_to_unsigned_and_creates_certificate(self, finance_client):
        case = CaseFactory(phase="assessment")
        bag = DrugBagFactory(submission=case)
        BotanicalAssessmentFactory(drug_bag=bag)

        with patch(PDF, return_value=b"%PDF-1.4 test"):
            resp = finance_client.post(
                reverse("case_workflow", kwargs={"pk": case.pk}),
                {"action": "generate_certificate"},
                format="json",
            )
        assert resp.status_code == 201
        assert len(resp.data["certificate_numbers"]) == 1
        case.refresh_from_db()
        assert case.phase == "unsigned_generation"


class TestPhaseHistory:
    def test_advance_is_recorded(self, finance_client):
        case = CaseFactory(phase="assessment")
        finance_client.post(
            reverse("case_workflow", kwargs={"pk": case.pk}),
            {"action": "advance_phase"},
            format="json",
        )
        resp = finance_client.get(reverse("case_phase_history", kwargs={"pk": case.pk}))
        assert resp.status_code == 200
        rows = _results(resp.data)
        assert any(
            r["to_phase"] == "unsigned_generation" and r["action"] == "advance"
            for r in rows
        )
