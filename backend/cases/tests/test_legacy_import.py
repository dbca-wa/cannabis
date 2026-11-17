"""Tests for persisting transformed legacy certificates and rolling them back."""

import json
from zoneinfo import ZoneInfo

import pytest
from django.core.management import call_command

from cases.legacy_import.importer import LegacyImporter
from cases.legacy_import.resolvers import IMPORT_USER_EMAIL, rank_choice
from cases.legacy_import.rollback import rollback_import
from cases.models import BotanicalAssessment, Case, Certificate, DrugBag, Priority3Form
from defendants.models import Defendant
from police.models import PoliceOfficer, PoliceStation
from users.models import User

pytestmark = pytest.mark.django_db

PERTH = ZoneInfo("Australia/Perth")

OFFICERS = {
    "submitting_officer": {
        "name": "Saffron Elford",
        "rank": "Unsworn Officer",
        "badge_id": "PD85862",
    },
    "requesting_officer": {
        "name": "Bexric Belby",
        "rank": "Sworn Officer",
        "badge_id": "PD48908",
    },
    "organisation": "Mirrabooka Police",
}


def certificate(number, case_key="D100", tags=("T4001",), **overrides):
    record = {
        "row_id": number,
        "cert_number": number,
        "case_key": case_key,
        "police_reference_number": case_key,
        "approved_botanist": "Nicholas Lander",
        "receipt_date": "2005-03-02",
        "cert_date": "2005-03-04",
        "date_notes": [],
        "extras": [],
        "defendants": [{"given_names": "Ulric Juniper", "last_name": "Kenmore"}],
        "police_officer": OFFICERS,
        "other_matters": json.dumps(
            {
                "other_matters": "Subsamples placed into Security Movement Envelope WW001."
            }
        ),
        "internal_comments": json.dumps({"internal_comments": None}),
        "result_basis": "certificate",
        "bags": [
            {
                "tag": tag,
                "new_tag": None,
                "content_type": "plant",
                "determination": "cannabis_sativa",
                "narrative": "I identified the plants as Cannabis sativa.",
            }
            for tag in tags
        ],
    }
    record.update(overrides)
    return record


def run(records, dry_run=False):
    return LegacyImporter(dry_run=dry_run).run(records)


class TestMapping:
    def test_case_form_bag_and_result_are_created(self):
        report = run([certificate(841)])
        case = Case.all_objects.get(case_number="D100")
        assert case.is_legacy and case.legacy_id == "LC841"
        form = case.forms.get()
        assert form.phase == "complete"
        assert form.legacy_certificate_number == "841"
        assert form.legacy_certified_date.isoformat() == "2005-03-04"
        assert form.security_movement_envelope == "WW001"
        bag = form.bags.get()
        assert bag.assessment.determination == "cannabis_sativa"
        assessed = bag.assessment.assessment_date.astimezone(PERTH)
        assert assessed.date().isoformat() == "2005-03-04"
        assert report.counts["cases failed"] == 0
        assert not Certificate.all_objects.exists()

    def test_received_is_perth_midnight(self):
        run([certificate(841)])
        received = Case.all_objects.get().received.astimezone(PERTH)
        assert received.date().isoformat() == "2005-03-02"
        assert (received.hour, received.minute) == (0, 0)

    def test_more_than_five_bags_split_into_forms_sharing_the_certificate_number(self):
        run([certificate(900, tags=tuple(f"T{n}" for n in range(2001, 2008)))])
        forms = Priority3Form.all_objects.order_by("pk")
        assert [f.bags.count() for f in forms] == [5, 2]
        assert {f.legacy_certificate_number for f in forms} == {"900"}
        assert all(f.additional_notes for f in forms)

    def test_one_case_keeps_each_certificates_own_data(self):
        first = certificate(1, "D200", tags=("T1",), receipt_date="2005-03-02")
        second = certificate(
            2,
            "D200",
            tags=("T2",),
            receipt_date="2005-04-01",
            cert_date="2005-04-02",
            other_matters=json.dumps({"other_matters": "Second note"}),
            approved_botanist="Kelly Shepherd",
        )
        second["bags"][0]["determination"] = "inconclusive"
        run([first, second])
        case = Case.all_objects.get(case_number="D200")
        assert case.forms.count() == 2
        notes = sorted(f.additional_notes for f in case.forms.all())
        assert notes[1].startswith("Subsamples") and notes[0] == "Second note"
        assert case.received.astimezone(PERTH).date().isoformat() == "2005-03-02"
        assert (
            "Certificate 2: approved botanist: Kelly Shepherd" in case.internal_comments
        )
        assert "Certificate 2: received 2005-04-01" in case.internal_comments
        results = {
            b.seal_tag_numbers: b.assessment.determination
            for b in DrugBag.all_objects.all()
        }
        assert results == {"T1": "cannabis_sativa", "T2": "inconclusive"}

    def test_dropped_source_columns_are_kept_in_internal_comments(self):
        record = certificate(
            5, extras=[{"label": "Location", "value": "12 Albavale Road"}]
        )
        run([record])
        assert Case.all_objects.get().internal_comments == "Location: 12 Albavale Road"

    def test_unknown_defendant_is_never_created(self):
        run(
            [
                certificate(
                    6, defendants=[{"given_names": "Unknown", "last_name": "Unknown"}]
                )
            ]
        )
        assert not Defendant.all_objects.exists()
        assert Case.all_objects.get().defendants.count() == 0

    def test_same_officer_in_both_roles_is_allowed(self):
        same = dict(OFFICERS)
        same["requesting_officer"] = dict(OFFICERS["submitting_officer"])
        report = run([certificate(7, police_officer=same)])
        case = Case.all_objects.get()
        assert case.requesting_officer_id == case.submitting_officer_id
        assert report.counts["cases failed"] == 0

    def test_role_labels_are_not_stored_as_ranks(self):
        run([certificate(8)])
        assert set(PoliceOfficer.all_objects.values_list("rank", flat=True)) == {""}
        assert rank_choice("Senior Constable") == "senior_constable"
        assert rank_choice("SP/C") == "other"
        assert rank_choice("Sworn") == ""
        assert rank_choice("Sworn Officer DOVANA") == ""

    def test_station_goes_to_the_requesting_officer_and_the_case(self):
        run([certificate(9)])
        case = Case.all_objects.get()
        assert case.station.name == "Mirrabooka Police"
        assert case.requesting_officer.station_id == case.station_id
        assert case.submitting_officer.station_id is None

    def test_uppercase_surnames_are_tidied(self):
        officers = {
            "submitting_officer": {
                "name": "Bexana GARFIELD",
                "rank": "Sworn Officer",
                "badge_id": "PD0322",
            },
            "requesting_officer": {"name": "", "rank": "", "badge_id": ""},
            "organisation": "",
        }
        run([certificate(10, police_officer=officers)])
        assert PoliceOfficer.all_objects.get().last_name == "Garfield"

    def test_same_badge_different_surname_is_not_merged(self):
        a = {
            "submitting_officer": {
                "name": "Magnus Belwick",
                "rank": "",
                "badge_id": "PD85004",
            }
        }
        b = {
            "submitting_officer": {
                "name": "Magnus Lanmore",
                "rank": "",
                "badge_id": "PD85004",
            }
        }
        run(
            [
                certificate(11, "D301", police_officer=a),
                certificate(12, "D302", police_officer=b),
            ]
        )
        assert PoliceOfficer.all_objects.filter(badge_number="PD85004").count() == 2


class TestBotanists:
    def test_existing_active_user_is_reused_not_changed(self):
        existing = User.objects.create(
            email="nick@dbca.wa.gov.au",
            given_names="Nicholas S",
            last_name="Lander",
            role="botanist",
            is_active=True,
        )
        run([certificate(1)])
        assert Case.all_objects.get().approved_botanist_id == existing.pk
        existing.refresh_from_db()
        assert existing.is_active and not existing.is_legacy

    def test_missing_botanist_is_created_inactive_and_legacy(self):
        run([certificate(1)])
        botanist = Case.all_objects.get().approved_botanist
        assert botanist.role == "botanist"
        assert not botanist.is_active and botanist.is_legacy
        assert not botanist.has_usable_password()


class TestRepeatsAndConflicts:
    def test_running_twice_changes_nothing(self):
        records = [certificate(1, tags=("T1", "T2")), certificate(2, "D400")]
        run(records)
        before = (
            Case.all_objects.count(),
            Priority3Form.all_objects.count(),
            DrugBag.all_objects.count(),
            PoliceOfficer.all_objects.count(),
            Defendant.all_objects.count(),
            User.objects.count(),
        )
        report = run(records)
        after = (
            Case.all_objects.count(),
            Priority3Form.all_objects.count(),
            DrugBag.all_objects.count(),
            PoliceOfficer.all_objects.count(),
            Defendant.all_objects.count(),
            User.objects.count(),
        )
        assert before == after
        assert report.counts["cases already imported"] == 2

    def test_dry_run_writes_nothing(self):
        report = run([certificate(1)], dry_run=True)
        assert report.counts["cases"] == 1
        assert not Case.all_objects.exists()
        assert not User.objects.filter(email=IMPORT_USER_EMAIL).exists()

    def test_case_number_used_by_an_app_case_is_reported_not_overwritten(self):
        Case.objects.create(case_number="D100", received="2026-01-01T00:00+08:00")
        report = run([certificate(1)])
        assert report.conflicts == ["D100"]
        assert Case.all_objects.count() == 1

    def test_a_failing_case_does_not_stop_the_others(self):
        bad = certificate(1, "D500", receipt_date=None)
        good = certificate(2, "D501")
        report = run([bad, good])
        assert [f["case"] for f in report.failed_cases] == ["D500"]
        assert Case.all_objects.filter(case_number="D501").exists()
        assert not Case.all_objects.filter(case_number="D500").exists()


class TestRollback:
    def test_removes_only_what_the_import_created(self):
        mine = PoliceOfficer.objects.create(
            badge_number="PD85862", given_names="Saffron", last_name="Elford"
        )
        station = PoliceStation.objects.create(name="Mirrabooka Police")
        run([certificate(1)])
        counts = rollback_import()
        assert counts["cases"] == 1
        assert not Case.all_objects.exists()
        assert PoliceOfficer.all_objects.filter(pk=mine.pk).exists()
        assert PoliceStation.all_objects.filter(pk=station.pk).exists()
        assert not PoliceOfficer.all_objects.filter(badge_number="PD48908").exists()
        assert not User.objects.filter(is_legacy=True).exists()

    def test_keeps_an_imported_officer_that_an_app_case_now_uses(self):
        run([certificate(1)])
        officer = PoliceOfficer.all_objects.get(badge_number="PD48908")
        Case.objects.create(
            case_number="APP-1",
            received="2026-01-01T00:00+08:00",
            requesting_officer=officer,
        )
        rollback_import()
        assert PoliceOfficer.all_objects.filter(pk=officer.pk).exists()
        assert not Case.all_objects.filter(is_legacy=True).exists()

    def test_dry_run_rollback_changes_nothing(self):
        run([certificate(1)])
        rollback_import(dry_run=True)
        assert Case.all_objects.filter(is_legacy=True).count() == 1

    def test_app_cases_are_never_removed(self):
        Case.objects.create(case_number="APP-2", received="2026-01-01T00:00+08:00")
        run([certificate(1)])
        rollback_import()
        assert Case.all_objects.filter(case_number="APP-2").exists()


class TestCommands:
    def _write(self, tmp_path, records):
        path = tmp_path / "cannabis_clean.json"
        path.write_text(json.dumps(records))
        (tmp_path / "cannabis_clean.manifest.json").write_text(
            json.dumps({"records": len(records)})
        )
        return path

    def test_load_is_a_dry_run_unless_committed(self, tmp_path):
        path = self._write(tmp_path, [certificate(1)])
        call_command("load_cannabis_data", file=str(path))
        assert not Case.all_objects.exists()
        call_command("load_cannabis_data", file=str(path), commit=True)
        assert Case.all_objects.filter(is_legacy=True).count() == 1

    def test_load_refuses_a_file_that_disagrees_with_its_manifest(self, tmp_path):
        path = self._write(tmp_path, [certificate(1)])
        (tmp_path / "cannabis_clean.manifest.json").write_text(
            json.dumps({"records": 99})
        )
        with pytest.raises(Exception, match="manifest"):
            call_command("load_cannabis_data", file=str(path), commit=True)

    def test_undo_command(self, tmp_path):
        path = self._write(tmp_path, [certificate(1)])
        call_command("load_cannabis_data", file=str(path), commit=True)
        call_command("undo_legacy_import")
        assert Case.all_objects.exists()
        call_command("undo_legacy_import", commit=True)
        assert not Case.all_objects.exists()


class TestAssessmentFields:
    def test_legacy_value_is_kept_for_unplaceable_results(self):
        record = certificate(1, tags=("T1", "T2"), result_basis="unsplit")
        for bag in record["bags"]:
            bag["determination"] = "mixed"
        report = run([record])
        assert report.unsplit_certificates == [1]
        assert set(
            BotanicalAssessment.all_objects.values_list("determination", flat=True)
        ) == {"mixed"}

    def test_blank_result_is_reported(self):
        record = certificate(1)
        record["bags"][0]["determination"] = "pending"
        assert run([record]).unassessed_certificates == [1]


class TestSourceRecords:
    def _with_source(self, number, **overrides):
        record = certificate(number, **overrides)
        record["source_row"] = {
            "Certificate Number": number,
            "Defendant": "KENMORE, Ulric",
        }
        return record

    def test_each_certificate_keeps_its_original_row(self):
        run([self._with_source(841), self._with_source(842, case_key="D100")])
        from cases.models import LegacySourceRecord

        records = LegacySourceRecord.objects.order_by("certificate_number")
        assert [r.certificate_number for r in records] == ["841", "842"]
        first = records[0]
        assert first.source_row == {
            "Certificate Number": 841,
            "Defendant": "KENMORE, Ulric",
        }
        assert first.transformed["cert_number"] == 841
        assert "source_row" not in first.transformed
        assert first.case.case_number == "D100"
        assert list(
            first.forms.values_list("legacy_certificate_number", flat=True)
        ) == ["841"]

    def test_record_survives_its_case_being_deleted_and_is_reattached(self):
        from cases.models import LegacySourceRecord

        run([self._with_source(900)])
        Case.all_objects.get().delete()
        orphan = LegacySourceRecord.objects.get()
        assert orphan.case is None
        run([self._with_source(900)])
        assert LegacySourceRecord.objects.count() == 1
        assert LegacySourceRecord.objects.get().case is not None

    def test_rollback_removes_source_records(self):
        from cases.models import LegacySourceRecord

        run([self._with_source(901)])
        assert rollback_import()["source records"] == 1
        assert not LegacySourceRecord.objects.exists()
