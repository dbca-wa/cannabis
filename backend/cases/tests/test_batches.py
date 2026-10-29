"""Tests for batch creation, invoice-raised completion, download, and delete."""

from unittest.mock import patch

import pytest
from django.urls import reverse

from common.tests.factories import (
    CaseFactory,
    CertificateFactory,
    DrugBagFactory,
    Priority3FormFactory,
)

pytestmark = pytest.mark.django_db

# build_zip renders a cost-summary PDF via PrinceXML — stub the renderer.
PDF = "cases.services.batch_service.PDFService._html_to_pdf"


@pytest.fixture(autouse=True)
def _tmp_media(settings, tmp_path):
    settings.MEDIA_ROOT = str(tmp_path)


def _eligible_certificate(bags=2):
    """A certificate on a batching-phase form, eligible for batching."""
    case = CaseFactory()
    form = Priority3FormFactory(case=case, phase="batching")
    for _ in range(bags):
        DrugBagFactory(form=form)
    cert = CertificateFactory(form=form)
    return cert


def _create_batch(client, cert):
    with patch(PDF, return_value=b"%PDF-1.4 test"):
        return client.post(
            reverse("batch_list_create"),
            {"certificate_ids": [cert.pk]},
            format="json",
        )


class TestBatchCreate:
    def test_snapshots_rates_and_moves_forms_to_in_batch(
        self, finance_client, system_settings
    ):
        cert = _eligible_certificate(bags=2)
        resp = _create_batch(finance_client, cert)
        assert resp.status_code == 201
        assert resp.data["certificate_count"] == 1
        assert resp.data["bag_count"] == 2
        assert float(resp.data["cert_rate"]) == 110.0
        assert float(resp.data["total"]) == 145.2  # (110 + 22) * 1.10
        cert.form.refresh_from_db()
        assert cert.form.phase == "in_batch"

    def test_rejects_ineligible_certificate(self, finance_client, system_settings):
        # A certificate on an assessment-phase form is not eligible.
        case = CaseFactory()
        form = Priority3FormFactory(case=case, phase="assessment")
        cert = CertificateFactory(form=form)
        resp = finance_client.post(
            reverse("batch_list_create"),
            {"certificate_ids": [cert.pk]},
            format="json",
        )
        assert resp.status_code == 400

    def test_one_batch_per_certificate(self, finance_client, system_settings):
        cert = _eligible_certificate()
        _create_batch(finance_client, cert)
        # The certificate is now in a batch → no longer eligible.
        resp = finance_client.post(
            reverse("batch_list_create"),
            {"certificate_ids": [cert.pk]},
            format="json",
        )
        assert resp.status_code == 400

    def test_requires_app_access(self, roleless_client):
        resp = roleless_client.post(
            reverse("batch_list_create"), {"certificate_ids": []}, format="json"
        )
        assert resp.status_code == 403


class TestBatchListAndDetail:
    def test_list_is_non_paginated(self, finance_client, system_settings):
        _create_batch(finance_client, _eligible_certificate())
        resp = finance_client.get(reverse("batch_list_create"))
        assert resp.status_code == 200
        assert isinstance(resp.data, list)
        assert len(resp.data) >= 1

    def test_detail_has_cost_breakdown(self, finance_client, system_settings):
        created = _create_batch(finance_client, _eligible_certificate(bags=2))
        resp = finance_client.get(
            reverse("batch_detail", kwargs={"pk": created.data["id"]})
        )
        assert resp.status_code == 200
        for key in ("cert_cost", "bag_cost", "subtotal", "tax_amount", "total"):
            assert key in resp.data


class TestInvoiceRaised:
    def _batch_id(self, client, cert):
        return _create_batch(client, cert).data["id"]

    def test_record_completes_forms(self, finance_client, system_settings):
        cert = _eligible_certificate()
        bid = self._batch_id(finance_client, cert)
        resp = finance_client.post(
            reverse("batch_invoice_raised", kwargs={"pk": bid}),
            {"invoice_raised_number": "INV-100"},
            format="json",
        )
        assert resp.status_code == 200
        cert.form.refresh_from_db()
        assert cert.form.phase == "complete"

    def test_duplicate_number_rejected(self, finance_client, system_settings):
        bid1 = self._batch_id(finance_client, _eligible_certificate())
        bid2 = self._batch_id(finance_client, _eligible_certificate())
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
        cert = _eligible_certificate()
        bid = self._batch_id(finance_client, cert)
        finance_client.post(
            reverse("batch_invoice_raised", kwargs={"pk": bid}),
            {"invoice_raised_number": "INV-200"},
            format="json",
        )
        resp = finance_client.delete(
            reverse("batch_invoice_raised", kwargs={"pk": bid})
        )
        assert resp.status_code == 200
        cert.form.refresh_from_db()
        assert cert.form.phase == "in_batch"


class TestBatchDeleteAndDownload:
    def test_delete_frees_forms(self, finance_client, system_settings):
        cert = _eligible_certificate()
        bid = _create_batch(finance_client, cert).data["id"]
        resp = finance_client.delete(reverse("batch_detail", kwargs={"pk": bid}))
        assert resp.status_code == 204
        cert.form.refresh_from_db()
        assert cert.form.phase == "batching"
        cert.refresh_from_db()
        assert cert.batch_id is None

    def test_download_returns_zip(self, finance_client, system_settings):
        bid = _create_batch(finance_client, _eligible_certificate()).data["id"]
        with patch(PDF, return_value=b"%PDF-1.4 test"):
            resp = finance_client.get(reverse("batch_download", kwargs={"pk": bid}))
        assert resp.status_code == 200
        assert resp["Content-Type"] == "application/zip"

    def test_export_csv(self, finance_client, system_settings):
        _create_batch(finance_client, _eligible_certificate())
        resp = finance_client.get(reverse("batch_export"))
        assert resp.status_code == 200
        assert "text/csv" in resp["Content-Type"]


MERGE = "cases.services.batch_service.PDFService.merge_pdfs"


def _with_pdf(cert, content):
    """Store a PDF on the certificate, as certificate generation does."""
    from django.core.files.base import ContentFile

    cert.pdf_file.save(
        f"certificate_{cert.certificate_number}.pdf", ContentFile(content)
    )
    return cert


def _zip_names(batch):
    import zipfile

    batch.zip_file.open("rb")
    try:
        with zipfile.ZipFile(batch.zip_file) as archive:
            return {name: archive.read(name) for name in archive.namelist()}
    finally:
        batch.zip_file.close()


class TestCombinedCertificatesPdf:
    def _batch(self, finance_client, certs):
        from cases.models import Batch

        with patch(PDF, return_value=b"%PDF-1.4 summary"):
            resp = finance_client.post(
                reverse("batch_list_create"),
                {"certificate_ids": [c.pk for c in certs]},
                format="json",
            )
        assert resp.status_code == 201, resp.data
        return Batch.objects.get(pk=resp.data["id"])

    def test_zip_includes_combined_pdf_in_certificate_order(
        self, finance_client, system_settings
    ):
        first = _with_pdf(_eligible_certificate(), b"%PDF first")
        second = _with_pdf(_eligible_certificate(), b"%PDF second")
        ordered = sorted([first, second], key=lambda c: c.certificate_number)

        with patch(MERGE, return_value=b"%PDF merged") as merge:
            batch = self._batch(finance_client, [second, first])

        expected = [b"%PDF first", b"%PDF second"]
        if ordered[0] is second:
            expected.reverse()
        merge.assert_called_once_with(expected)

        files = _zip_names(batch)
        combined = f"all_certificates_{batch.batch_number}.pdf"
        assert files[combined] == b"%PDF merged"
        assert f"cost_summary_{batch.batch_number}.pdf" in files
        assert f"{first.certificate_number}.pdf" in files
        assert f"{second.certificate_number}.pdf" in files

    def test_combined_pdf_omitted_without_stored_pdfs(
        self, finance_client, system_settings
    ):
        with patch(MERGE) as merge:
            batch = self._batch(finance_client, [_eligible_certificate()])
        merge.assert_not_called()
        names = _zip_names(batch)
        assert not any(n.startswith("all_certificates_") for n in names)

    def test_merge_failure_fails_the_package_build(
        self, finance_client, system_settings
    ):
        from rest_framework.exceptions import ValidationError

        cert = _with_pdf(_eligible_certificate(), b"%PDF only")
        with (
            patch(PDF, return_value=b"%PDF-1.4 summary"),
            patch(MERGE, side_effect=ValidationError("Combining failed.")),
        ):
            resp = finance_client.post(
                reverse("batch_list_create"),
                {"certificate_ids": [cert.pk]},
                format="json",
            )
        assert resp.status_code == 400
        cert.refresh_from_db()
        assert cert.batch_id is None


class TestRepackageCombinedPdf:
    def test_repackage_rebuilds_the_combined_pdf(self, finance_client, system_settings):
        """Re-package regenerates every certificate PDF, then re-merges them."""
        from cases.models import Batch

        cert = _with_pdf(_eligible_certificate(), b"%PDF original")
        bid = _create_batch(finance_client, cert).data["id"]

        regenerated = b"%PDF regenerated"
        with (
            patch(PDF, return_value=b"%PDF-1.4 summary"),
            patch(
                "cases.services.certificate_service.CertificateService._render_pdf",
                return_value=regenerated,
            ),
            patch(MERGE, side_effect=lambda pdfs: b"MERGED:" + b"|".join(pdfs)) as m,
        ):
            resp = finance_client.post(reverse("batch_repackage", kwargs={"pk": bid}))
        assert resp.status_code == 200, resp.data
        m.assert_called_once_with([regenerated])

        batch = Batch.objects.get(pk=bid)
        files = _zip_names(batch)
        assert files[f"all_certificates_{batch.batch_number}.pdf"] == (
            b"MERGED:" + regenerated
        )
        assert files[f"{cert.certificate_number}.pdf"] == regenerated
