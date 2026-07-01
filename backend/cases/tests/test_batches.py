"""Tests for batch creation, invoice-raised completion, download, and delete."""

from unittest.mock import patch

import pytest
from django.urls import reverse

from common.tests.factories import CaseFactory, CertificateFactory, DrugBagFactory

pytestmark = pytest.mark.django_db

# build_zip renders a cost-summary PDF via PrinceXML — stub the renderer.
PDF = "cases.services.batch_service.PDFService._html_to_pdf"


@pytest.fixture(autouse=True)
def _tmp_media(settings, tmp_path):
    settings.MEDIA_ROOT = str(tmp_path)


def _eligible_case(certs=1, bags=2):
    """A batching-phase case (eligible) with the given certs and bags."""
    case = CaseFactory(phase="batching")
    for _ in range(bags):
        DrugBagFactory(submission=case)
    for _ in range(certs):
        CertificateFactory(submission=case)
    return case


def _create_batch(client, case):
    with patch(PDF, return_value=b"%PDF-1.4 test"):
        return client.post(
            reverse("batch_list_create"), {"case_ids": [case.pk]}, format="json"
        )


class TestBatchCreate:
    def test_snapshots_rates_and_moves_cases_to_in_batch(
        self, finance_client, system_settings
    ):
        case = _eligible_case(certs=1, bags=2)
        resp = _create_batch(finance_client, case)
        assert resp.status_code == 201
        assert resp.data["certificate_count"] == 1
        assert resp.data["bag_count"] == 2
        assert float(resp.data["cert_rate"]) == 110.0
        assert float(resp.data["total"]) == 145.2  # (110 + 22) * 1.10
        case.refresh_from_db()
        assert case.phase == "in_batch"
        assert case.batch_id is not None

    def test_rejects_ineligible_case(self, finance_client, system_settings):
        case = CaseFactory(phase="assessment")  # not in batching
        resp = _create_batch(finance_client, case)
        assert resp.status_code == 400

    def test_one_batch_per_case(self, finance_client, system_settings):
        case = _eligible_case()
        _create_batch(finance_client, case)
        # The case is now in_batch + attached → no longer eligible.
        resp = _create_batch(finance_client, case)
        assert resp.status_code == 400

    def test_requires_app_access(self, roleless_client):
        resp = roleless_client.post(
            reverse("batch_list_create"), {"case_ids": []}, format="json"
        )
        assert resp.status_code == 403


class TestBatchListAndDetail:
    def test_list_is_non_paginated(self, finance_client, system_settings):
        _create_batch(finance_client, _eligible_case())
        resp = finance_client.get(reverse("batch_list_create"))
        assert resp.status_code == 200
        assert isinstance(resp.data, list)
        assert len(resp.data) >= 1

    def test_detail_has_cost_breakdown(self, finance_client, system_settings):
        created = _create_batch(finance_client, _eligible_case(certs=1, bags=2))
        resp = finance_client.get(
            reverse("batch_detail", kwargs={"pk": created.data["id"]})
        )
        assert resp.status_code == 200
        for key in ("cert_cost", "bag_cost", "subtotal", "tax_amount", "total"):
            assert key in resp.data


class TestInvoiceRaised:
    def _batch_id(self, client, case):
        return _create_batch(client, case).data["id"]

    def test_record_completes_cases(self, finance_client, system_settings):
        case = _eligible_case()
        bid = self._batch_id(finance_client, case)
        resp = finance_client.post(
            reverse("batch_invoice_raised", kwargs={"pk": bid}),
            {"invoice_raised_number": "INV-100"},
            format="json",
        )
        assert resp.status_code == 200
        case.refresh_from_db()
        assert case.phase == "complete"

    def test_duplicate_number_rejected(self, finance_client, system_settings):
        bid1 = self._batch_id(finance_client, _eligible_case())
        bid2 = self._batch_id(finance_client, _eligible_case())
        finance_client.post(
            reverse("batch_invoice_raised", kwargs={"pk": bid1}),
            {"invoice_raised_number": "INV-DUP"},
            format="json",
        )
        resp = finance_client.post(
            reverse("batch_invoice_raised", kwargs={"pk": bid2}),
            {"invoice_raised_number": "INV-DUP"},
            format="json",
        )
        assert resp.status_code == 400

    def test_unset_reverts_to_in_batch(self, finance_client, system_settings):
        case = _eligible_case()
        bid = self._batch_id(finance_client, case)
        finance_client.post(
            reverse("batch_invoice_raised", kwargs={"pk": bid}),
            {"invoice_raised_number": "INV-200"},
            format="json",
        )
        resp = finance_client.delete(
            reverse("batch_invoice_raised", kwargs={"pk": bid})
        )
        assert resp.status_code == 200
        case.refresh_from_db()
        assert case.phase == "in_batch"


class TestBatchDeleteAndDownload:
    def test_delete_frees_cases(self, finance_client, system_settings):
        case = _eligible_case()
        bid = _create_batch(finance_client, case).data["id"]
        resp = finance_client.delete(reverse("batch_detail", kwargs={"pk": bid}))
        assert resp.status_code == 204
        case.refresh_from_db()
        assert case.phase == "batching"
        assert case.batch_id is None

    def test_download_returns_zip(self, finance_client, system_settings):
        bid = _create_batch(finance_client, _eligible_case()).data["id"]
        with patch(PDF, return_value=b"%PDF-1.4 test"):
            resp = finance_client.get(reverse("batch_download", kwargs={"pk": bid}))
        assert resp.status_code == 200
        assert resp["Content-Type"] == "application/zip"

    def test_export_csv(self, finance_client, system_settings):
        _create_batch(finance_client, _eligible_case())
        resp = finance_client.get(reverse("batch_export"))
        assert resp.status_code == 200
        assert "text/csv" in resp["Content-Type"]
