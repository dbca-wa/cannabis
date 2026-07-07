"""Tests for case CRUD endpoints."""

import pytest
from django.urls import reverse

from common.tests.factories import CaseFactory, Priority3FormFactory

pytestmark = pytest.mark.django_db


class TestCaseList:
    def test_requires_app_access(self, roleless_client):
        resp = roleless_client.get(reverse("case_list"))
        assert resp.status_code == 403

    def test_lists_cases_paginated(self, finance_client):
        CaseFactory.create_batch(3)
        resp = finance_client.get(reverse("case_list"))
        assert resp.status_code == 200
        assert resp.data["count"] >= 3
        assert "results" in resp.data

    def test_filter_by_phase(self, finance_client):
        CaseFactory(phase="assessment")
        CaseFactory(phase="batching")
        resp = finance_client.get(reverse("case_list"), {"phase": "batching"})
        assert resp.status_code == 200
        assert all(c["phase"] == "batching" for c in resp.data["results"])


class TestCaseCreate:
    def test_create_case(self, finance_client):
        payload = {
            "case_number": "CANN-NEW-1",
            "received": "2026-01-01T09:00:00Z",
            "security_movement_envelope": "SME-1",
        }
        resp = finance_client.post(reverse("case_list"), payload, format="json")
        assert resp.status_code == 201
        assert resp.data["case_number"] == "CANN-NEW-1"

    def test_requires_case_number(self, finance_client):
        payload = {
            "received": "2026-01-01T09:00:00Z",
            "security_movement_envelope": "SME-1",
        }
        resp = finance_client.post(reverse("case_list"), payload, format="json")
        assert resp.status_code == 400

    def test_rejects_duplicate_case_number(self, finance_client):
        CaseFactory(case_number="CANN-DUP")
        payload = {
            "case_number": "CANN-DUP",
            "received": "2026-01-01T09:00:00Z",
            "security_movement_envelope": "SME-2",
        }
        resp = finance_client.post(reverse("case_list"), payload, format="json")
        assert resp.status_code == 400


class TestCaseDetail:
    def test_retrieve(self, finance_client):
        case = CaseFactory()
        resp = finance_client.get(reverse("case_detail", kwargs={"pk": case.pk}))
        assert resp.status_code == 200
        assert resp.data["id"] == case.pk

    def test_update(self, finance_client):
        case = CaseFactory()
        resp = finance_client.patch(
            reverse("case_detail", kwargs={"pk": case.pk}),
            {"internal_comments": "a note"},
            format="json",
        )
        assert resp.status_code == 200
        case.refresh_from_db()
        assert case.internal_comments == "a note"

    def test_delete(self, finance_client):
        case = CaseFactory()
        resp = finance_client.delete(reverse("case_detail", kwargs={"pk": case.pk}))
        assert resp.status_code == 204

    def test_complete_case_readonly_for_non_admin(self, finance_client):
        case = CaseFactory()
        Priority3FormFactory(case=case, phase="complete")
        resp = finance_client.patch(
            reverse("case_detail", kwargs={"pk": case.pk}),
            {"internal_comments": "edit"},
            format="json",
        )
        assert resp.status_code == 403

    def test_complete_case_editable_by_admin(self, admin_client):
        case = CaseFactory()
        Priority3FormFactory(case=case, phase="complete")
        resp = admin_client.patch(
            reverse("case_detail", kwargs={"pk": case.pk}),
            {"internal_comments": "admin edit"},
            format="json",
        )
        assert resp.status_code == 200
        case.refresh_from_db()
        assert case.internal_comments == "admin edit"


class TestCaseNumberCheck:
    def test_existing_number(self, finance_client):
        CaseFactory(case_number="CANN-CHK")
        resp = finance_client.get(
            reverse("case_number_check"), {"case_number": "CANN-CHK"}
        )
        assert resp.status_code == 200
        assert resp.data["exists"] is True

    def test_unused_number(self, finance_client):
        resp = finance_client.get(
            reverse("case_number_check"), {"case_number": "CANN-FREE"}
        )
        assert resp.status_code == 200
        assert resp.data["exists"] is False
