"""The audit_batch_eligibility command reports, and only repairs when asked."""

from io import StringIO

import pytest
from django.core.management import call_command

from cases.models import Case, CasePhaseHistory
from common.tests.factories import (
    BotanicalAssessmentFactory,
    CaseFactory,
    CertificateFactory,
    DrugBagFactory,
    Priority3FormFactory,
)

pytestmark = pytest.mark.django_db


def _mismatched_certificate(phase=Case.PhaseChoices.COMPLETE):
    """A certificate with no batch whose form has already passed batching."""
    case = CaseFactory()
    form = Priority3FormFactory(case=case, phase=phase)
    bag = DrugBagFactory(form=form)
    BotanicalAssessmentFactory(drug_bag=bag)
    form.completed_at = form.case.received
    form.save(update_fields=["completed_at"])
    return CertificateFactory(form=form)


def _run(*args):
    out = StringIO()
    call_command("audit_batch_eligibility", *args, stdout=out)
    return out.getvalue()


class TestReportMode:
    def test_reports_nothing_when_the_data_is_sound(self):
        case = CaseFactory()
        form = Priority3FormFactory(case=case, phase=Case.PhaseChoices.BATCHING)
        bag = DrugBagFactory(form=form)
        BotanicalAssessmentFactory(drug_bag=bag)
        CertificateFactory(form=form)

        assert "No mismatched records found" in _run()

    def test_lists_the_affected_certificate_and_case(self):
        certificate = _mismatched_certificate()

        output = _run()

        assert "Found 1 certificate" in output
        assert certificate.certificate_number in output
        assert certificate.form.case.case_number in output

    def test_reporting_leaves_the_records_untouched(self):
        certificate = _mismatched_certificate()

        _run()

        certificate.form.refresh_from_db()
        assert certificate.form.phase == Case.PhaseChoices.COMPLETE
        assert certificate.form.completed_at is not None
        assert not CasePhaseHistory.objects.filter(action="repair").exists()

    def test_finds_in_batch_forms_as_well_as_complete(self):
        _mismatched_certificate(phase=Case.PhaseChoices.IN_BATCH)

        assert "Found 1 certificate" in _run()


class TestRepairMode:
    def test_returns_the_form_to_batching_and_clears_completion(self):
        certificate = _mismatched_certificate()

        output = _run("--repair")

        certificate.form.refresh_from_db()
        assert certificate.form.phase == Case.PhaseChoices.BATCHING
        assert certificate.form.completed_at is None
        assert "Repaired 1 form" in output

    def test_records_the_correction_in_the_phase_history(self):
        certificate = _mismatched_certificate()

        _run("--repair")

        history = CasePhaseHistory.objects.get(form=certificate.form)
        assert history.action == "repair"
        assert history.from_phase == Case.PhaseChoices.COMPLETE
        assert history.to_phase == Case.PhaseChoices.BATCHING

    def test_the_certificate_becomes_batchable_again(self):
        certificate = _mismatched_certificate()
        assert certificate.is_batch_eligible is False

        _run("--repair")

        certificate.refresh_from_db()
        assert certificate.is_batch_eligible is True

    def test_repairs_every_affected_record(self):
        first = _mismatched_certificate()
        second = _mismatched_certificate(phase=Case.PhaseChoices.IN_BATCH)

        output = _run("--repair")

        first.form.refresh_from_db()
        second.form.refresh_from_db()
        assert first.form.phase == Case.PhaseChoices.BATCHING
        assert second.form.phase == Case.PhaseChoices.BATCHING
        assert "Repaired 2 form" in output

    def test_leaves_sound_records_alone(self):
        case = CaseFactory()
        sound = Priority3FormFactory(case=case, phase=Case.PhaseChoices.BATCHING)
        bag = DrugBagFactory(form=sound)
        BotanicalAssessmentFactory(drug_bag=bag)
        CertificateFactory(form=sound)

        _run("--repair")

        sound.refresh_from_db()
        assert sound.phase == Case.PhaseChoices.BATCHING
        assert not CasePhaseHistory.objects.filter(action="repair").exists()
