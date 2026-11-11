"""Merging officers, stations or defendants changes the cases that use them.

As when deleting with a replacement, only an administrator may change a
complete case, so a merge that would touch one is refused for anyone else and
nothing moves.
"""

import pytest
from django.urls import reverse
from rest_framework.test import APIClient

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


def _client(user):
    client = APIClient()
    client.force_authenticate(user=user)
    return client


def _complete(case):
    Priority3FormFactory(case=case, phase="complete")
    return case


def _merge_officers(client, source, target):
    return client.post(
        reverse("officer_merge"),
        {"source_officer_id": source.pk, "target_officer_id": target.pk},
        format="json",
    )


def _merge(client, name, primary, secondary):
    return client.post(
        reverse(name),
        {"primary_id": primary.pk, "secondary_ids": [secondary.pk]},
        format="json",
    )


class TestOfficers:
    def test_a_botanist_cannot_merge_away_an_officer_on_a_complete_case(
        self, botanist_user
    ):
        source, target = PoliceOfficerFactory(), PoliceOfficerFactory()
        case = _complete(CaseFactory(submitting_officer=source))

        resp = _merge_officers(_client(botanist_user), source, target)

        assert resp.status_code == 403
        assert case.case_number in str(resp.data)
        case.refresh_from_db()
        assert case.submitting_officer_id == source.pk
        assert PoliceOfficer.objects.filter(pk=source.pk).exists()

    def test_an_administrator_can(self, admin_user):
        source, target = PoliceOfficerFactory(), PoliceOfficerFactory()
        case = _complete(CaseFactory(submitting_officer=source))

        resp = _merge_officers(_client(admin_user), source, target)

        assert resp.status_code == 200
        case.refresh_from_db()
        assert case.submitting_officer_id == target.pk

    def test_cases_still_in_progress_merge_for_anyone(self, botanist_user):
        source, target = PoliceOfficerFactory(), PoliceOfficerFactory()
        case = CaseFactory(submitting_officer=source)
        Priority3FormFactory(case=case, phase="assessment")

        resp = _merge_officers(_client(botanist_user), source, target)

        assert resp.status_code == 200


class TestStations:
    def test_a_botanist_cannot_merge_away_a_station_on_a_complete_case(
        self, botanist_user
    ):
        primary, secondary = PoliceStationFactory(), PoliceStationFactory()
        case = _complete(CaseFactory(station=secondary))

        resp = _merge(_client(botanist_user), "station_merge", primary, secondary)

        assert resp.status_code == 403
        case.refresh_from_db()
        assert case.station_id == secondary.pk
        assert PoliceStation.objects.filter(pk=secondary.pk).exists()

    def test_an_administrator_can(self, admin_user):
        primary, secondary = PoliceStationFactory(), PoliceStationFactory()
        case = _complete(CaseFactory(station=secondary))
        officer = PoliceOfficerFactory(station=secondary)

        resp = _merge(_client(admin_user), "station_merge", primary, secondary)

        assert resp.status_code == 200
        assert resp.data["cases_reassigned"] == 1
        assert resp.data["officers_reassigned"] == 1
        case.refresh_from_db()
        officer.refresh_from_db()
        assert case.station_id == primary.pk
        assert officer.station_id == primary.pk

    def test_a_missing_station_is_reported(self, botanist_user):
        primary = PoliceStationFactory()

        resp = _client(botanist_user).post(
            reverse("station_merge"),
            {"primary_id": primary.pk, "secondary_ids": [999999]},
            format="json",
        )

        assert resp.status_code == 404


class TestDefendants:
    def test_a_botanist_cannot_merge_away_a_defendant_on_a_complete_case(
        self, botanist_user
    ):
        primary, secondary = DefendantFactory(), DefendantFactory()
        case = _complete(CaseFactory())
        case.defendants.add(secondary)

        resp = _merge(_client(botanist_user), "defendant_merge", primary, secondary)

        assert resp.status_code == 403
        assert list(case.defendants.values_list("pk", flat=True)) == [secondary.pk]
        assert Defendant.objects.filter(pk=secondary.pk).exists()

    def test_an_administrator_can(self, admin_user):
        primary, secondary = DefendantFactory(), DefendantFactory()
        case = _complete(CaseFactory())
        case.defendants.add(secondary)

        resp = _merge(_client(admin_user), "defendant_merge", primary, secondary)

        assert resp.status_code == 200
        assert list(case.defendants.values_list("pk", flat=True)) == [primary.pk]
