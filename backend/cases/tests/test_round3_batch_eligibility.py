"""Batch eligibility must reject a certificate whose own form is past batching.

A form at In Batch or Complete has already been through batching and cannot be
advanced again, so offering its certificate would fail partway through creating
the batch with a phase transition error.
"""

import pytest

from cases.models import Case
from cases.services.batch_service import BatchService
from common.tests.factories import (
    BotanicalAssessmentFactory,
    CaseFactory,
    CertificateFactory,
    DrugBagFactory,
    Priority3FormFactory,
)

pytestmark = pytest.mark.django_db


@pytest.fixture(autouse=True)
def _stub_pdf(monkeypatch):
    """Building a batch renders a cost-summary PDF through PrinceXML, which is
    not installed in CI. These tests are about eligibility, not PDF output, so
    stub the render to keep them independent of the binary."""
    monkeypatch.setattr(
        "cases.services.pdf_service.PDFService._html_to_pdf",
        staticmethod(lambda *args, **kwargs: b"%PDF-1.4 stub"),
    )


def _assessed_form(case, phase):
    """A form in the given phase holding one fully assessed bag."""
    form = Priority3FormFactory(case=case, phase=phase)
    bag = DrugBagFactory(form=form)
    BotanicalAssessmentFactory(drug_bag=bag)
    return form


class TestIsBatchEligible:
    def test_eligible_when_form_is_at_batching_and_unbatched(self):
        case = CaseFactory()
        form = _assessed_form(case, Case.PhaseChoices.BATCHING)
        certificate = CertificateFactory(form=form)

        assert certificate.is_batch_eligible is True

    def test_not_eligible_when_already_in_a_batch(self, admin_user):
        case = CaseFactory()
        form = _assessed_form(case, Case.PhaseChoices.BATCHING)
        certificate = CertificateFactory(form=form)

        batch = BatchService.create_batch([certificate.pk], admin_user)
        certificate.refresh_from_db()

        assert certificate.batch_id == batch.pk
        assert certificate.is_batch_eligible is False

    # The regression: an unbatched certificate whose form had already passed
    # batching used to report itself eligible.
    def test_not_eligible_when_own_form_is_in_batch_without_a_batch(self):
        case = CaseFactory()
        form = _assessed_form(case, Case.PhaseChoices.IN_BATCH)
        certificate = CertificateFactory(form=form)

        assert certificate.batch_id is None
        assert certificate.is_batch_eligible is False

    def test_not_eligible_when_own_form_is_complete_without_a_batch(self):
        case = CaseFactory()
        form = _assessed_form(case, Case.PhaseChoices.COMPLETE)
        certificate = CertificateFactory(form=form)

        assert certificate.batch_id is None
        assert certificate.is_batch_eligible is False

    def test_not_eligible_when_another_form_on_the_case_lags_behind(self):
        case = CaseFactory()
        ready = _assessed_form(case, Case.PhaseChoices.BATCHING)
        _assessed_form(case, Case.PhaseChoices.ASSESSMENT)
        certificate = CertificateFactory(form=ready)

        assert certificate.is_batch_eligible is False

    def test_eligible_when_sibling_forms_are_further_ahead(self):
        """A case part-way through batching over time still offers its remainder."""
        case = CaseFactory()
        _assessed_form(case, Case.PhaseChoices.COMPLETE)
        ready = _assessed_form(case, Case.PhaseChoices.BATCHING)
        certificate = CertificateFactory(form=ready)

        assert certificate.is_batch_eligible is True


class TestCreateBatchRejectsIneligible:
    def test_rejects_a_certificate_whose_form_is_complete(self, admin_user):
        case = CaseFactory()
        form = _assessed_form(case, Case.PhaseChoices.COMPLETE)
        certificate = CertificateFactory(form=form)

        from rest_framework.exceptions import ValidationError

        with pytest.raises(ValidationError):
            BatchService.create_batch([certificate.pk], admin_user)

    def test_rejects_the_whole_request_without_advancing_any_form(self, admin_user):
        """One ineligible certificate must not leave the others half-processed."""
        good_case = CaseFactory()
        good_form = _assessed_form(good_case, Case.PhaseChoices.BATCHING)
        good_cert = CertificateFactory(form=good_form)

        bad_case = CaseFactory()
        bad_form = _assessed_form(bad_case, Case.PhaseChoices.COMPLETE)
        bad_cert = CertificateFactory(form=bad_form)

        from rest_framework.exceptions import ValidationError

        with pytest.raises(ValidationError):
            BatchService.create_batch([good_cert.pk, bad_cert.pk], admin_user)

        good_cert.refresh_from_db()
        good_form.refresh_from_db()

        assert good_cert.batch_id is None
        assert good_form.phase == Case.PhaseChoices.BATCHING
