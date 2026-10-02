"""The purge_case_data command.

Deletes all cases and their related data, then removes any officer, station or
defendant left with no remaining cases. Shared records referenced by another
case survive, and users are never deleted. These tests pin that behaviour down
and prove the dry run touches nothing.
"""

import pytest
from django.core.management import call_command

from cases.models import Batch, Case, Certificate, DrugBag, Priority3Form
from common.tests.factories import (
    BotanicalAssessmentFactory,
    CaseFactory,
    CertificateFactory,
    DefendantFactory,
    DrugBagFactory,
    PoliceOfficerFactory,
    PoliceStationFactory,
    Priority3FormFactory,
    UserFactory,
)
from defendants.models import Defendant
from police.models import PoliceOfficer, PoliceStation
from users.models import User

pytestmark = pytest.mark.django_db


def _case_with(officer=None, station=None, defendant=None):
    case = CaseFactory(submitting_officer=officer, station=station)
    if defendant:
        case.defendants.add(defendant)
    form = Priority3FormFactory(case=case)
    bag = DrugBagFactory(form=form)
    BotanicalAssessmentFactory(drug_bag=bag)
    CertificateFactory(form=form)
    return case


class TestPurgeCaseData:
    def test_dry_run_deletes_nothing(self):
        _case_with(
            officer=PoliceOfficerFactory(),
            station=PoliceStationFactory(),
            defendant=DefendantFactory(),
        )
        before = Case.all_objects.count()
        call_command("purge_case_data")  # no --confirm
        assert Case.all_objects.count() == before

    def test_confirm_deletes_all_cases_and_children(self):
        _case_with()
        call_command("purge_case_data", "--confirm")
        assert Case.all_objects.count() == 0
        assert Priority3Form.all_objects.count() == 0
        assert DrugBag.all_objects.count() == 0
        assert Certificate.all_objects.count() == 0

    def test_deletes_batches(self):
        Batch.objects.create()
        call_command("purge_case_data", "--confirm")
        assert Batch.all_objects.count() == 0

    def test_orphaned_entities_are_removed(self):
        officer = PoliceOfficerFactory(station=None)
        station = PoliceStationFactory()
        defendant = DefendantFactory()
        _case_with(officer=officer, station=station, defendant=defendant)

        call_command("purge_case_data", "--confirm")

        assert not PoliceOfficer.all_objects.filter(pk=officer.pk).exists()
        assert not PoliceStation.all_objects.filter(pk=station.pk).exists()
        assert not Defendant.all_objects.filter(pk=defendant.pk).exists()

    def test_users_and_botanists_are_never_deleted(self):
        # A full purge orphans every officer/station/defendant (no case survives),
        # so they are all removed — but users, including botanists on cases, are
        # the hard guarantee and must always survive.
        user = UserFactory()
        botanist = UserFactory()
        _case_with()
        CaseFactory(approved_botanist=botanist)

        call_command("purge_case_data", "--confirm")

        assert User.objects.filter(pk=user.pk).exists()
        assert User.objects.filter(pk=botanist.pk).exists()

    def test_dry_run_reports_what_would_be_deleted(self, capsys):
        _case_with(officer=PoliceOfficerFactory(station=None))
        # A spare officer referenced by no case.
        PoliceOfficerFactory(station=None)

        call_command("purge_case_data")
        out = capsys.readouterr().out
        # A full purge orphans every officer, so both are reported for deletion.
        assert "Would delete 2 officer(s)" in out

    def test_reset_counters(self, system_settings):
        from common.models import SystemSettings

        settings_obj = SystemSettings.load()
        settings_obj.certificate_counter = 42
        settings_obj.batch_counter = 7
        settings_obj.save()

        call_command("purge_case_data", "--confirm", "--reset-counters")

        settings_obj = SystemSettings.load()
        assert settings_obj.certificate_counter == 0
        assert settings_obj.batch_counter == 0

    def test_counters_untouched_without_flag(self, system_settings):
        from common.models import SystemSettings

        settings_obj = SystemSettings.load()
        settings_obj.certificate_counter = 42
        settings_obj.save()

        call_command("purge_case_data", "--confirm")

        assert SystemSettings.load().certificate_counter == 42
