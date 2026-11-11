"""Spotting certificates that no longer match their case.

Each generated, regenerated or re-packaged certificate stores a hash of what it
printed. A batched certificate whose case has changed since is flagged for
re-packaging; an unbatched one gains the "details" regeneration reason.
Certificates with no stored hash (everything made before it was recorded,
including migrated certificates) are never flagged.
"""

from datetime import timedelta
from unittest.mock import patch

import pytest
from django.urls import reverse

from cases.models import Batch
from cases.services.batch_service import BatchService
from cases.services.certificate_service import CertificateService
from common.tests.factories import (
    BotanicalAssessmentFactory,
    CaseFactory,
    DefendantFactory,
    DrugBagFactory,
    PoliceOfficerFactory,
    Priority3FormFactory,
)

pytestmark = pytest.mark.django_db

CERT_PDF = "cases.services.certificate_service.PDFService._html_to_pdf"
BATCH_PDF = "cases.services.batch_service.PDFService._html_to_pdf"
MERGE = "cases.services.batch_service.PDFService.merge_pdfs"


@pytest.fixture(autouse=True)
def _tmp_media(settings, tmp_path):
    settings.MEDIA_ROOT = str(tmp_path)


def _generated(admin_user, note="Original note"):
    """A case with one generated certificate, rendering stubbed."""
    case = CaseFactory(submitting_officer=PoliceOfficerFactory())
    case.defendants.add(DefendantFactory(given_names="Alex", last_name="Brown"))
    form = Priority3FormFactory(case=case, additional_notes=note)
    BotanicalAssessmentFactory(drug_bag=DrugBagFactory(form=form))
    with patch(CERT_PDF, return_value=b"%PDF-1.4 test"):
        certificate = CertificateService.generate_certificate(form, admin_user)
    return case, form, certificate


def _batched(admin_user, **kwargs):
    case, form, certificate = _generated(admin_user, **kwargs)
    certificate.batch = Batch.objects.create()
    certificate.save()
    return case, form, certificate


def _repackage(batch):
    with (
        patch(CERT_PDF, return_value=b"%PDF-1.4 test"),
        patch(BATCH_PDF, return_value=b"%PDF-1.4 summary"),
        patch(MERGE, return_value=b"%PDF merged"),
    ):
        BatchService.rebuild_zip(batch)


def _swap_defendant(case):
    case.defendants.set([DefendantFactory(given_names="Chris", last_name="Green")])


class TestFingerprint:
    def test_generating_records_a_fingerprint(self, admin_user):
        _, _, certificate = _generated(admin_user)

        assert len(certificate.printed_fingerprint) == 64
        assert CertificateService.needs_regeneration_reasons(certificate) == []

    def test_the_certification_date_is_not_part_of_it(self, admin_user):
        _, _, certificate = _generated(admin_user)
        before = CertificateService.content_fingerprint(certificate)

        certificate.certified_date -= timedelta(days=3)

        assert CertificateService.content_fingerprint(certificate) == before

    def test_an_unprintable_certificate_has_none(self, admin_user):
        _, form, certificate = _generated(admin_user)
        bag = form.bags.get()
        bag.assessment.determination = "pending"
        bag.assessment.save()

        assert CertificateService.content_fingerprint(certificate) is None


class TestUnbatchedCertificates:
    def test_a_new_defendant_is_flagged(self, admin_user):
        case, _, certificate = _generated(admin_user)

        _swap_defendant(case)

        assert CertificateService.needs_regeneration_reasons(certificate) == ["details"]

    def test_a_new_police_reference_is_flagged(self, admin_user):
        case, _, certificate = _generated(admin_user)

        case.case_number = "IR 999999"
        case.save()
        certificate.refresh_from_db()

        assert CertificateService.needs_regeneration_reasons(certificate) == ["details"]

    def test_an_officer_change_keeps_its_own_reason(self, admin_user):
        case, _, certificate = _generated(admin_user)

        case.submitting_officer = PoliceOfficerFactory()
        case.save()
        certificate.refresh_from_db()

        assert CertificateService.needs_regeneration_reasons(certificate) == [
            "officers"
        ]

    def test_regenerating_clears_it(self, admin_user):
        case, form, certificate = _generated(admin_user)
        _swap_defendant(case)

        with patch(CERT_PDF, return_value=b"%PDF-1.4 test"):
            certificate = CertificateService.generate_certificate(form, admin_user)

        assert CertificateService.needs_regeneration_reasons(certificate) == []

    def test_a_certificate_without_a_fingerprint_is_not_flagged(self, admin_user):
        case, _, certificate = _generated(admin_user)
        certificate.printed_fingerprint = None
        certificate.save()

        _swap_defendant(case)

        assert CertificateService.needs_regeneration_reasons(certificate) == []


class TestBatchedCertificates:
    def test_a_fresh_batched_certificate_is_current(self, admin_user):
        _, _, certificate = _batched(admin_user)

        assert CertificateService.needs_repackage(certificate) is False

    @pytest.mark.parametrize(
        "change",
        ["defendant", "officer", "note", "result"],
    )
    def test_a_change_to_the_case_is_flagged(self, change, admin_user):
        case, form, certificate = _batched(admin_user)

        if change == "defendant":
            _swap_defendant(case)
        elif change == "officer":
            case.submitting_officer = PoliceOfficerFactory()
            case.save()
        elif change == "note":
            form.additional_notes = "Corrected note"
            form.save()
        else:
            assessment = form.bags.get().assessment
            assessment.determination = (
                "cannabis_sativa"
                if assessment.determination != "cannabis_sativa"
                else "not_cannabis"
            )
            assessment.save()
        certificate.refresh_from_db()

        assert CertificateService.needs_repackage(certificate) is True
        # Regeneration is not offered for a batched certificate.
        assert CertificateService.needs_regeneration_reasons(certificate) == []

    def test_repackaging_clears_it_and_prints_the_corrected_note(self, admin_user):
        case, form, certificate = _batched(admin_user)
        _swap_defendant(case)
        form.additional_notes = "Corrected note"
        form.save()

        _repackage(certificate.batch)
        certificate.refresh_from_db()

        assert certificate.additional_notes == "Corrected note"
        assert CertificateService.needs_repackage(certificate) is False

    def test_a_migrated_certificate_is_never_flagged(self, admin_user):
        case, _, certificate = _batched(admin_user)
        certificate.printed_fingerprint = None
        certificate.save()

        _swap_defendant(case)

        assert CertificateService.needs_repackage(certificate) is False

    def test_repackaging_a_migrated_batch_starts_tracking_it(self, admin_user):
        case, _, certificate = _batched(admin_user)
        certificate.printed_fingerprint = None
        certificate.save()

        _repackage(certificate.batch)
        certificate.refresh_from_db()
        _swap_defendant(case)

        assert certificate.printed_fingerprint
        assert CertificateService.needs_repackage(certificate) is True


class TestApi:
    def test_the_case_reports_a_batched_certificate_out_of_date(
        self, admin_user, finance_client
    ):
        case, _, _ = _batched(admin_user)
        _swap_defendant(case)

        response = finance_client.get(reverse("case_detail", kwargs={"pk": case.pk}))

        certificate = response.data["forms"][0]["certificate"]
        assert certificate["needs_repackage"] is True
        assert certificate["needs_regeneration"] is False

    def test_the_batch_lists_its_out_of_date_certificates(
        self, admin_user, finance_client
    ):
        case, _, certificate = _batched(admin_user)
        _, _, current = _generated(admin_user)
        current.batch = certificate.batch
        current.save()
        _swap_defendant(case)

        listed = finance_client.get(reverse("batch_list_create"))
        detail = finance_client.get(
            reverse("batch_detail", kwargs={"pk": certificate.batch_id})
        )

        row = next(b for b in listed.data if b["id"] == certificate.batch_id)
        assert row["out_of_date_certificates"] == [certificate.certificate_number]
        assert detail.data["out_of_date_certificates"] == [
            certificate.certificate_number
        ]


class TestRecordingExistingCertificates:
    """Certificates made before fingerprints get a starting point."""

    def _older(self, certificate, **changes):
        certificate.printed_fingerprint = None
        for field, value in changes.items():
            setattr(certificate, field, value)
        certificate.save()
        return certificate

    def test_one_that_still_matches_gets_its_fingerprint(self, admin_user):
        case, _, certificate = _generated(admin_user)
        expected = certificate.printed_fingerprint
        self._older(certificate)

        assert CertificateService.record_existing_fingerprints() == (1, 0)
        certificate.refresh_from_db()
        assert certificate.printed_fingerprint == expected

        # Later changes are now caught.
        _swap_defendant(case)
        assert CertificateService.needs_regeneration_reasons(certificate) == ["details"]

    def test_a_batched_one_with_older_wording_needs_a_repackage(self, admin_user):
        _, _, certificate = _batched(admin_user)
        self._older(certificate, wording_version=1)

        assert CertificateService.record_existing_fingerprints() == (0, 1)
        certificate.refresh_from_db()
        assert CertificateService.needs_repackage(certificate) is True

        _repackage(certificate.batch)
        certificate.refresh_from_db()
        assert CertificateService.needs_repackage(certificate) is False

    def test_invoiced_work_takes_its_current_state(self, admin_user):
        case, form, certificate = _batched(admin_user)
        form.phase = "complete"
        form.save()
        self._older(certificate, wording_version=1)

        assert CertificateService.record_existing_fingerprints() == (1, 0)
        certificate.refresh_from_db()
        assert CertificateService.needs_repackage(certificate) is False

        _swap_defendant(case)
        assert CertificateService.needs_repackage(certificate) is True

    def test_running_it_again_changes_nothing(self, admin_user):
        _, _, certificate = _generated(admin_user)
        self._older(certificate)
        CertificateService.record_existing_fingerprints()

        assert CertificateService.record_existing_fingerprints() == (0, 0)

    def test_the_management_command_reports_the_counts(self, admin_user):
        from io import StringIO

        from django.core.management import call_command

        _, _, certificate = _generated(admin_user)
        self._older(certificate)
        out = StringIO()

        call_command("record_certificate_fingerprints", stdout=out)

        assert "1 certificate(s) matched" in out.getvalue()
