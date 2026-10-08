"""Practice mode.

Practice mode is a per-user mode layered over the real workflow. Rows made in it
must stay invisible to the live application and to other users, and must never
consume real numbers. The data persists between sessions — turning the mode off
keeps it, so re-entering shows the user's existing work — and is only removed
when the user explicitly resets it. These tests pin down that isolation, the
mode toggle, and the persist/reset behaviour.
"""

import pytest
from django.utils import timezone

from cases.models import Batch, Case, Certificate, DrugBag, Priority3Form
from cases.services.practice_service import PracticeService
from common import practice
from common.models import SystemSettings
from defendants.models import Defendant
from police.models import PoliceOfficer, PoliceStation

pytestmark = pytest.mark.django_db


@pytest.fixture(autouse=True)
def _clear_practice_context():
    """Never leak the request-scoped practice context between tests."""
    yield
    practice.clear_context()


def _in_practice(user):
    """Enter practice mode for the user, both the stored flag and the request
    context the managers consult."""
    PracticeService.enable_for_user(user)
    practice.set_context(user, True)


def _real_mode():
    practice.clear_context()


def _make_practice_case(user, botanist=None):
    case = Case.objects.create(received=timezone.now(), approved_botanist=botanist)
    form = Priority3Form.objects.create(case=case)
    DrugBag.objects.create(form=form, seal_tag_numbers="T001")
    return case, form


class TestStampingAndOwnership:
    def test_rows_made_in_practice_mode_are_flagged_and_owned(self, botanist_user):
        _in_practice(botanist_user)
        case, form = _make_practice_case(botanist_user)
        assert case.is_practice and case.practice_owner_id == botanist_user.pk
        assert form.is_practice and form.practice_owner_id == botanist_user.pk
        _real_mode()

    def test_fake_officers_stations_defendants_are_flagged(self, botanist_user):
        _in_practice(botanist_user)
        station = PoliceStation.objects.create(name="Fake Station")
        officer = PoliceOfficer.objects.create(last_name="Fake", station=station)
        defendant = Defendant.objects.create(last_name="Fake")
        assert station.is_practice and officer.is_practice and defendant.is_practice
        _real_mode()


class TestIsolation:
    def test_user_sees_only_their_own_practice_data(self, botanist_user, finance_user):
        _in_practice(botanist_user)
        case, _ = _make_practice_case(botanist_user)
        assert Case.objects.filter(pk=case.pk).exists()

        # Another user in practice mode does not see it.
        practice.set_context(finance_user, True)
        assert not Case.objects.filter(pk=case.pk).exists()
        _real_mode()

    def test_real_mode_never_sees_practice_data(self, botanist_user):
        before = Case.objects.count()
        _in_practice(botanist_user)
        _make_practice_case(botanist_user)
        _real_mode()
        assert Case.objects.count() == before

    def test_fake_officer_hidden_from_real_lists(self, botanist_user):
        _in_practice(botanist_user)
        officer = PoliceOfficer.objects.create(last_name="Fake")
        _real_mode()
        assert not PoliceOfficer.objects.filter(pk=officer.pk).exists()
        assert PoliceOfficer.all_objects.filter(pk=officer.pk).exists()


class TestNumbering:
    def test_practice_numbers_use_their_own_namespace(self, botanist_user):
        _in_practice(botanist_user)
        case, form = _make_practice_case(botanist_user)
        cert = Certificate.objects.create(form=form)
        batch = Batch.objects.create()
        assert cert.certificate_number.startswith("PRACTICE-R")
        assert batch.batch_number.startswith("PRACTICE-BATCH")
        _real_mode()

    def test_practice_does_not_advance_live_counters(
        self, botanist_user, system_settings
    ):
        before = SystemSettings.load()
        cert_before, batch_before = before.certificate_counter, before.batch_counter
        _in_practice(botanist_user)
        _, form = _make_practice_case(botanist_user)
        Certificate.objects.create(form=form)
        Batch.objects.create()
        _real_mode()
        after = SystemSettings.load()
        assert after.certificate_counter == cert_before
        assert after.batch_counter == batch_before


class TestPersistenceAndReset:
    def test_practice_mode_does_not_expire_with_time(self, botanist_user):
        # There is no TTL any more: an old start time must not flip the mode off.
        PracticeService.enable_for_user(botanist_user)
        prefs = botanist_user.get_preferences
        prefs.practice_mode_started_at = timezone.now() - timezone.timedelta(days=30)
        prefs.save(update_fields=["practice_mode_started_at"])
        assert practice.is_in_practice_mode(botanist_user) is True

    def test_disable_keeps_the_users_practice_data(self, botanist_user):
        _in_practice(botanist_user)
        case, _ = _make_practice_case(botanist_user)
        officer = PoliceOfficer.objects.create(last_name="Fake")
        _real_mode()

        PracticeService.disable_for_user(botanist_user)

        # Mode is off, but the data is retained for next time.
        assert practice.is_in_practice_mode(botanist_user) is False
        assert Case.all_objects.filter(pk=case.pk).exists()
        assert PoliceOfficer.all_objects.filter(pk=officer.pk).exists()

    def test_reentering_practice_mode_shows_retained_data(self, botanist_user):
        _in_practice(botanist_user)
        case, _ = _make_practice_case(botanist_user)
        _real_mode()
        PracticeService.disable_for_user(botanist_user)

        # Re-enter: the earlier case is visible again, not an empty slate.
        _in_practice(botanist_user)
        assert Case.objects.filter(pk=case.pk).exists()
        _real_mode()

    def test_reset_clears_data_and_keeps_mode_on(self, botanist_user):
        _in_practice(botanist_user)
        case, _ = _make_practice_case(botanist_user)
        officer = PoliceOfficer.objects.create(last_name="Fake")
        _real_mode()

        PracticeService.reset_for_user(botanist_user)

        # Data gone, but still in practice mode (a fresh session).
        assert (
            Case.all_objects.filter(
                is_practice=True, practice_owner=botanist_user
            ).count()
            == 0
        )
        assert PoliceOfficer.all_objects.filter(pk=officer.pk).count() == 0
        assert practice.is_in_practice_mode(botanist_user) is True


class TestEntityCaseCounts:
    def test_real_officer_count_excludes_practice_cases(self, botanist_user):
        # A real officer attached to a practice case must not show that case.
        officer = PoliceOfficer.objects.create(last_name="Real")
        _in_practice(botanist_user)
        case, _ = _make_practice_case(botanist_user)
        case.submitting_officer = PoliceOfficer.all_objects.get(pk=officer.pk)
        case.save(update_fields=["submitting_officer"])
        _real_mode()

        from django.db.models import Count, Q

        annotated = (
            PoliceOfficer.objects.filter(pk=officer.pk)
            .annotate(c=Count("cases_made", filter=Q(cases_made__is_practice=False)))
            .first()
        )
        assert annotated.c == 0


class TestAttachingRealEntities:
    def test_practice_case_can_reference_a_real_officer(self, botanist_user):
        # The real officer exists only in real mode's manager, but a practice
        # user picking it from the dropdown must still be able to save the case.
        from cases.serializers import CaseCreateSerializer

        officer = PoliceOfficer.objects.create(last_name="RealOfficer")

        _in_practice(botanist_user)
        serializer = CaseCreateSerializer(
            data={
                "case_number": "PRACTICE-REAL-1",
                "received": timezone.now().isoformat(),
                "submitting_officer": officer.pk,
            }
        )
        assert serializer.is_valid(), serializer.errors
        case = serializer.save()
        assert case.is_practice is True
        assert case.submitting_officer_id == officer.pk
        _real_mode()

        # The real officer's case list still excludes this practice case.
        assert not officer.cases_made.filter(pk=case.pk).exists()


class TestFullWorkflowThroughMiddleware:
    """Drive the real workflow endpoints with a JWT bearer token so the
    PracticeModeMiddleware actually runs and sets the request context — the path
    the browser uses. force_authenticate bypasses middleware, so these cover the
    gap that let a created form 404 on the next read."""

    @staticmethod
    def _jwt_client(user):
        from rest_framework.test import APIClient
        from rest_framework_simplejwt.tokens import RefreshToken

        client = APIClient()
        token = str(RefreshToken.for_user(user).access_token)
        client.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")
        return client

    def test_add_form_is_immediately_readable_and_deletable(self, botanist_user):
        client = self._jwt_client(botanist_user)
        client.post("/api/v1/practice/mode")

        case = client.post(
            "/api/v1/cases/list",
            {"case_number": "PRACTICE-MW-1", "received": timezone.now().isoformat()},
            format="json",
        )
        assert case.status_code in (200, 201), case.data
        case_id = case.data["id"]

        # Add a form — it must be readable immediately afterwards.
        added = client.post(f"/api/v1/cases/{case_id}/forms", {}, format="json")
        assert added.status_code in (200, 201), added.data
        form_id = added.data["id"]

        got = client.get(f"/api/v1/cases/forms/{form_id}")
        assert got.status_code == 200, "a newly added practice form must be readable"

        # And it must be listed on the case.
        listed = client.get(f"/api/v1/cases/{case_id}/forms")
        assert any(f["id"] == form_id for f in listed.data)

        # A bag added to the practice form must save and be readable.
        bag = client.post(
            f"/api/v1/cases/{case_id}/bags",
            {"form": form_id, "seal_tag_numbers": "T99001"},
            format="json",
        )
        assert bag.status_code in (200, 201), bag.data
        bag_id = bag.data["id"]
        assert client.get(f"/api/v1/cases/{case_id}/bags").status_code == 200

        # And deletable, like any other form.
        assert client.delete(f"/api/v1/cases/bags/{bag_id}").status_code in (200, 204)
        deleted = client.delete(f"/api/v1/cases/forms/{form_id}")
        assert deleted.status_code in (200, 204), deleted.data


class TestModeEndpoints:
    def test_toggle_mode_on_and_off(self, botanist_client, botanist_user):
        on = botanist_client.post("/api/v1/practice/mode")
        assert on.status_code == 200
        assert on.data["practice_mode"] is True
        assert on.data["practice_mode_started_at"] is not None

        off = botanist_client.delete("/api/v1/practice/mode")
        assert off.status_code == 200
        assert off.data["practice_mode"] is False

    def test_reset_endpoint_clears_data_and_stays_in_practice(
        self, botanist_user
    ):
        from rest_framework.test import APIClient
        from rest_framework_simplejwt.tokens import RefreshToken

        client = APIClient()
        token = str(RefreshToken.for_user(botanist_user).access_token)
        client.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")

        client.post("/api/v1/practice/mode")
        created = client.post(
            "/api/v1/cases/list",
            {"case_number": "PRACTICE-RESET-1", "received": timezone.now().isoformat()},
            format="json",
        )
        assert created.status_code in (200, 201), created.data

        reset = client.post("/api/v1/practice/reset")
        assert reset.status_code == 200
        assert reset.data["practice_mode"] is True
        # The practice case is gone after reset.
        assert (
            Case.all_objects.filter(
                is_practice=True, practice_owner=botanist_user
            ).count()
            == 0
        )

    def test_restart_case_removes_only_that_case(self, botanist_user):
        from rest_framework.test import APIClient
        from rest_framework_simplejwt.tokens import RefreshToken

        client = APIClient()
        token = str(RefreshToken.for_user(botanist_user).access_token)
        client.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")
        client.post("/api/v1/practice/mode")

        a = client.post(
            "/api/v1/cases/list",
            {"case_number": "PRACTICE-A", "received": timezone.now().isoformat()},
            format="json",
        )
        b = client.post(
            "/api/v1/cases/list",
            {"case_number": "PRACTICE-B", "received": timezone.now().isoformat()},
            format="json",
        )
        assert a.status_code in (200, 201) and b.status_code in (200, 201)
        a_id, b_id = a.data["id"], b.data["id"]

        res = client.post(f"/api/v1/practice/reset-case/{a_id}")
        assert res.status_code == 200
        # Only case A is gone; B remains.
        assert not Case.all_objects.filter(pk=a_id).exists()
        assert Case.all_objects.filter(pk=b_id).exists()

    def test_restart_case_rejects_another_users_case(
        self, botanist_user, finance_user
    ):
        # A case owned by someone else must not be removable.
        _in_practice(finance_user)
        other, _ = _make_practice_case(finance_user)
        _real_mode()

        from rest_framework.test import APIClient
        from rest_framework_simplejwt.tokens import RefreshToken

        client = APIClient()
        token = str(RefreshToken.for_user(botanist_user).access_token)
        client.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")
        client.post("/api/v1/practice/mode")

        # botanist cannot see finance's case, so this is a 404 in their practice
        # scope, and the case survives.
        res = client.post(f"/api/v1/practice/reset-case/{other.pk}")
        assert res.status_code == 404
        assert Case.all_objects.filter(pk=other.pk).exists()
