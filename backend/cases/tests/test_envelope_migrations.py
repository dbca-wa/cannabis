"""The data migrations that came with printing the envelope in Section C."""

import importlib
from unittest.mock import patch

import pytest
from django.apps import apps

from cases.models import Batch, Priority3Form
from cases.services.certificate_service import CertificateService
from common.tests.factories import (
    BotanicalAssessmentFactory,
    CaseFactory,
    DrugBagFactory,
    PoliceOfficerFactory,
    Priority3FormFactory,
)

pytestmark = pytest.mark.django_db

legacy_envelopes = importlib.import_module(
    "cases.migrations.0045_legacy_envelopes_from_notes"
)
envelope_fingerprints = importlib.import_module(
    "cases.migrations.0046_fingerprints_for_envelope_line"
)

CERT_PDF = "cases.services.certificate_service.PDFService._html_to_pdf"


@pytest.fixture(autouse=True)
def _tmp_media(settings, tmp_path):
    settings.MEDIA_ROOT = str(tmp_path)


class TestLegacyEnvelopes:
    def _form(self, envelope, note, legacy=True):
        return Priority3FormFactory(
            case=CaseFactory(is_legacy=legacy),
            security_movement_envelope=envelope,
            additional_notes=note,
        )

    def _run(self, form):
        legacy_envelopes.replace_made_up_envelopes(apps, None)
        return Priority3Form.objects.get(pk=form.pk).security_movement_envelope

    def test_the_note_envelope_replaces_the_made_up_one(self):
        note = (
            "Bag T108582 contained female plants.\n"
            "Subsamples placed into Security Movement Envelope WW00537475."
        )
        form = self._form("SME-4562", note)

        assert self._run(form) == "WW00537475"
        assert Priority3Form.objects.get(pk=form.pk).additional_notes == note

    @pytest.mark.parametrize(
        "note",
        [
            None,
            "Subsamples transferred to Security Movement Envelope WW1.",
            "Subsamples placed into Security Movement Envelope WW1.\n"
            "Subsamples placed into Security Movement Envelope WW2.",
        ],
    )
    def test_a_made_up_envelope_is_cleared_otherwise(self, note):
        assert self._run(self._form("SME-4563", note)) == ""

    def test_real_envelopes_are_untouched(self):
        note = "Subsamples placed into Security Movement Envelope WW9."
        assert self._run(self._form("WW00510073", note)) == "WW00510073"
        assert self._run(self._form("SME-12", note, legacy=False)) == "SME-12"


def _generated(admin_user, envelope="WW00537475"):
    case = CaseFactory(submitting_officer=PoliceOfficerFactory())
    form = Priority3FormFactory(
        case=case, security_movement_envelope=envelope, additional_notes="Note"
    )
    BotanicalAssessmentFactory(drug_bag=DrugBagFactory(form=form))
    with patch(CERT_PDF, return_value=b"%PDF-1.4 test"):
        certificate = CertificateService.generate_certificate(form, admin_user)
    return form, certificate


def _printed_without_the_envelope_line(certificate):
    """Store the fingerprint the certificate had before the envelope line."""
    form = certificate.form
    envelope = form.security_movement_envelope
    form.security_movement_envelope = ""
    old = CertificateService.content_fingerprint(certificate)
    form.security_movement_envelope = envelope
    certificate.printed_fingerprint = old
    certificate.save(update_fields=["printed_fingerprint"])
    return old


class TestEnvelopeFingerprints:
    def test_finished_work_takes_its_current_state(self, admin_user):
        form, certificate = _generated(admin_user)
        certificate.batch = Batch.objects.create()
        certificate.save()
        form.phase = "complete"
        form.save()
        _printed_without_the_envelope_line(certificate)
        assert CertificateService.needs_repackage(certificate) is True

        envelope_fingerprints.adopt_envelope_line(apps, None)
        certificate.refresh_from_db()

        assert CertificateService.needs_repackage(certificate) is False

    def test_a_batch_still_in_progress_needs_a_repackage(self, admin_user):
        _, certificate = _generated(admin_user)
        certificate.batch = Batch.objects.create()
        certificate.save()
        old = _printed_without_the_envelope_line(certificate)

        envelope_fingerprints.adopt_envelope_line(apps, None)
        certificate.refresh_from_db()

        assert certificate.printed_fingerprint == old
        assert CertificateService.needs_repackage(certificate) is True

    def test_an_unbatched_one_is_flagged_for_regeneration(self, admin_user):
        _, certificate = _generated(admin_user)
        _printed_without_the_envelope_line(certificate)

        envelope_fingerprints.adopt_envelope_line(apps, None)
        certificate.refresh_from_db()

        assert CertificateService.needs_regeneration_reasons(certificate) == ["details"]

    def test_finished_work_that_already_differed_still_shows(self, admin_user):
        form, certificate = _generated(admin_user)
        certificate.batch = Batch.objects.create()
        certificate.save()
        form.phase = "complete"
        form.save()
        _printed_without_the_envelope_line(certificate)
        form.case.case_number = "CHANGED-1"
        form.case.save()

        envelope_fingerprints.adopt_envelope_line(apps, None)
        certificate.refresh_from_db()

        assert CertificateService.needs_repackage(certificate) is True
