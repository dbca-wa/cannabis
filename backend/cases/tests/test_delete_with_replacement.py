"""Deleting an officer, station or defendant that cases still use.

The record is never deleted on its own when cases use it: the user sees which
cases are affected and picks a replacement, the cases move to it, and then the
record is deleted. No case is left with a missing officer, station or
defendant.
"""

import pytest
from django.urls import reverse

from common.tests.factories import (
    CaseFactory,
    DefendantFactory,
    PoliceOfficerFactory,
    PoliceStationFactory,
    Priority3FormFactory,
)
from defendants.models import Defendant
from police.models import PoliceOfficer, PoliceStation

pytestmark = pytest.mark.django_db


def _delete(client, name, pk, replacement=None):
    url = reverse(name, kwargs={"pk": pk})
    if replacement is not None:
        url += f"?replacement={replacement}"
    return client.delete(url)


class TestOfficers:
    def test_an_unused_officer_is_deleted(self, botanist_client):
        officer = PoliceOfficerFactory()
        assert _delete(botanist_client, "officer_detail", officer.pk).status_code == 204
        assert not PoliceOfficer.objects.filter(pk=officer.pk).exists()

    def test_usage_lists_each_case_and_role(self, botanist_client):
        officer, other = PoliceOfficerFactory(), PoliceOfficerFactory()
        conveyed = CaseFactory(case_number="IR 1", submitting_officer=officer)
        requested = CaseFactory(
            case_number="IR 2", submitting_officer=other, requesting_officer=officer
        )

        resp = botanist_client.get(reverse("officer_usage", kwargs={"pk": officer.pk}))

        assert resp.status_code == 200
        rows = {row["id"]: row for row in resp.data["cases"]}
        assert rows[conveyed.pk]["roles"] == ["conveying"]
        assert rows[requested.pk]["roles"] == ["requesting"]
        assert rows[conveyed.pk]["case_number"] == "IR 1"

    def test_an_officer_in_use_needs_a_replacement(self, botanist_client):
        officer = PoliceOfficerFactory()
        case = CaseFactory(submitting_officer=officer)

        resp = _delete(botanist_client, "officer_detail", officer.pk)

        assert resp.status_code == 400
        assert "Choose another officer" in str(resp.data["replacement"])
        case.refresh_from_db()
        assert case.submitting_officer_id == officer.pk

    def test_cases_move_to_the_replacement(self, botanist_client):
        officer, replacement, other = (
            PoliceOfficerFactory(),
            PoliceOfficerFactory(),
            PoliceOfficerFactory(),
        )
        conveyed = CaseFactory(submitting_officer=officer)
        requested = CaseFactory(submitting_officer=other, requesting_officer=officer)

        resp = _delete(botanist_client, "officer_detail", officer.pk, replacement.pk)

        assert resp.status_code == 204
        conveyed.refresh_from_db()
        requested.refresh_from_db()
        assert conveyed.submitting_officer_id == replacement.pk
        assert requested.requesting_officer_id == replacement.pk
        assert requested.submitting_officer_id == other.pk
        assert not PoliceOfficer.objects.filter(pk=officer.pk).exists()

    def test_refuses_a_replacement_already_in_the_other_role(self, botanist_client):
        officer, replacement = PoliceOfficerFactory(), PoliceOfficerFactory()
        case = CaseFactory(
            case_number="IR 9",
            submitting_officer=officer,
            requesting_officer=replacement,
        )

        resp = _delete(botanist_client, "officer_detail", officer.pk, replacement.pk)

        assert resp.status_code == 400
        assert "IR 9" in str(resp.data["replacement"])
        case.refresh_from_db()
        assert case.submitting_officer_id == officer.pk

    def test_refuses_the_same_officer_as_replacement(self, botanist_client):
        officer = PoliceOfficerFactory()
        CaseFactory(submitting_officer=officer)
        resp = _delete(botanist_client, "officer_detail", officer.pk, officer.pk)
        assert resp.status_code == 400

    def test_refuses_an_unknown_replacement(self, botanist_client):
        officer = PoliceOfficerFactory()
        CaseFactory(submitting_officer=officer)
        resp = _delete(botanist_client, "officer_detail", officer.pk, 999999)
        assert resp.status_code == 400

    def test_complete_cases_need_an_administrator(self, botanist_user, admin_user):
        from rest_framework.test import APIClient

        officer, replacement = PoliceOfficerFactory(), PoliceOfficerFactory()
        case = CaseFactory(submitting_officer=officer)
        Priority3FormFactory(case=case, phase="complete")

        # Separate clients: the shared api_client fixture would make both the
        # same user.
        botanist = APIClient()
        botanist.force_authenticate(user=botanist_user)
        resp = _delete(botanist, "officer_detail", officer.pk, replacement.pk)
        assert resp.status_code == 403
        assert PoliceOfficer.objects.filter(pk=officer.pk).exists()

        admin = APIClient()
        admin.force_authenticate(user=admin_user)
        resp = _delete(admin, "officer_detail", officer.pk, replacement.pk)
        assert resp.status_code == 204
        case.refresh_from_db()
        assert case.submitting_officer_id == replacement.pk


class TestStations:
    def test_an_unused_station_is_deleted(self, botanist_client):
        station = PoliceStationFactory()
        assert _delete(botanist_client, "station_detail", station.pk).status_code == 204

    def test_a_station_with_officers_needs_a_replacement(self, botanist_client):
        station = PoliceStationFactory()
        PoliceOfficerFactory(station=station)

        resp = _delete(botanist_client, "station_detail", station.pk)

        assert resp.status_code == 400
        assert "1 officer" in str(resp.data["replacement"])
        assert PoliceStation.objects.filter(pk=station.pk).exists()

    def test_usage_lists_cases_and_officers(self, botanist_client):
        station = PoliceStationFactory()
        officer = PoliceOfficerFactory(station=station)
        case = CaseFactory(station=station)

        resp = botanist_client.get(reverse("station_usage", kwargs={"pk": station.pk}))

        assert [row["id"] for row in resp.data["cases"]] == [case.pk]
        assert [row["id"] for row in resp.data["officers"]] == [officer.pk]

    def test_cases_and_officers_move_to_the_replacement(self, botanist_client):
        station, replacement = PoliceStationFactory(), PoliceStationFactory()
        officer = PoliceOfficerFactory(station=station)
        case = CaseFactory(station=station)

        resp = _delete(botanist_client, "station_detail", station.pk, replacement.pk)

        assert resp.status_code == 204
        officer.refresh_from_db()
        case.refresh_from_db()
        assert officer.station_id == replacement.pk
        assert case.station_id == replacement.pk


class TestDefendants:
    def test_an_unused_defendant_is_deleted(self, botanist_client):
        defendant = DefendantFactory()
        resp = _delete(botanist_client, "defendant_detail", defendant.pk)
        assert resp.status_code == 204

    def test_a_defendant_in_use_needs_a_replacement(self, botanist_client):
        defendant = DefendantFactory()
        CaseFactory().defendants.add(defendant)

        resp = _delete(botanist_client, "defendant_detail", defendant.pk)

        assert resp.status_code == 400
        assert Defendant.objects.filter(pk=defendant.pk).exists()

    def test_cases_move_to_the_replacement(self, botanist_client):
        defendant, replacement, co_accused = (
            DefendantFactory(),
            DefendantFactory(),
            DefendantFactory(),
        )
        case = CaseFactory()
        case.defendants.add(defendant, co_accused)

        resp = _delete(
            botanist_client, "defendant_detail", defendant.pk, replacement.pk
        )

        assert resp.status_code == 204
        assert set(case.defendants.values_list("pk", flat=True)) == {
            replacement.pk,
            co_accused.pk,
        }

    def test_usage_lists_the_cases(self, botanist_client):
        defendant = DefendantFactory()
        case = CaseFactory(case_number="IR 5")
        case.defendants.add(defendant)

        resp = botanist_client.get(
            reverse("defendant_usage", kwargs={"pk": defendant.pk})
        )

        assert resp.data["cases"][0]["case_number"] == "IR 5"
