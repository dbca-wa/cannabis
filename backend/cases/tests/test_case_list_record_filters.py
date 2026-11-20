"""The case list filtered to one officer, station or defendant.

These back the "View cases" buttons on the officer, station and defendant
records, so each must list exactly the cases that record's count covers.
"""

import pytest
from django.urls import reverse

from common.tests.factories import (
    CaseFactory,
    DefendantFactory,
    PoliceOfficerFactory,
    PoliceStationFactory,
)

pytestmark = pytest.mark.django_db


def _numbers(client, **params):
    resp = client.get(reverse("case_list"), params)
    assert resp.status_code == 200, resp.data
    return sorted(r["case_number"] for r in resp.data["results"])


def test_defendant_filter_lists_only_their_cases(botanist_client):
    bart, homer = DefendantFactory(), DefendantFactory()
    CaseFactory(case_number="IR 1").defendants.add(bart)
    CaseFactory(case_number="IR 2").defendants.add(bart, homer)
    CaseFactory(case_number="IR 3").defendants.add(homer)

    assert _numbers(botanist_client, defendant=bart.pk) == ["IR 1", "IR 2"]


def test_officer_filter_covers_both_roles(botanist_client):
    officer = PoliceOfficerFactory()
    CaseFactory(case_number="IR 1", submitting_officer=officer)
    CaseFactory(case_number="IR 2", requesting_officer=officer)
    CaseFactory(case_number="IR 3")

    assert _numbers(botanist_client, officer=officer.pk) == ["IR 1", "IR 2"]


def test_station_filter_lists_the_station_cases(botanist_client):
    station = PoliceStationFactory()
    CaseFactory(case_number="IR 1", station=station)
    CaseFactory(case_number="IR 2")

    assert _numbers(botanist_client, station=station.pk) == ["IR 1"]


@pytest.mark.parametrize("name", ["defendant", "officer", "station", "botanist"])
def test_a_mistyped_id_is_refused_clearly(botanist_client, name):
    resp = botanist_client.get(reverse("case_list"), {name: "abc"})

    assert resp.status_code == 400
    assert f"'abc' is not a valid {name} id." in str(resp.data[name])
