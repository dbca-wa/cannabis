"""A name typed exactly as the app shows it (SURNAME, Given) finds the record."""

import pytest
from django.urls import reverse

from common.tests.factories import (
    CaseFactory,
    DefendantFactory,
    PoliceOfficerFactory,
)

pytestmark = pytest.mark.django_db


def _results(resp):
    data = resp.data
    return data["results"] if isinstance(data, dict) and "results" in data else data


@pytest.mark.parametrize("query", ["WINCHESTER, Dean", "Winchester", "Dean Winchester"])
def test_officer_search_accepts_the_displayed_name(botanist_client, query):
    officer = PoliceOfficerFactory(last_name="Winchester", given_names="Dean")
    PoliceOfficerFactory(last_name="Turner", given_names="Alex")

    resp = botanist_client.get(reverse("officer_list"), {"search": query})

    assert resp.status_code == 200
    assert officer.pk in [r["id"] for r in _results(resp)]


@pytest.mark.parametrize("query", ["SIMPSON, Bart", "Simpson"])
def test_defendant_search_accepts_the_displayed_name(botanist_client, query):
    defendant = DefendantFactory(last_name="Simpson", given_names="Bart")

    resp = botanist_client.get(reverse("defendant_list"), {"search": query})

    assert resp.status_code == 200
    assert defendant.pk in [r["id"] for r in _results(resp)]


def test_case_search_accepts_an_officers_displayed_name(botanist_client):
    officer = PoliceOfficerFactory(last_name="Winchester", given_names="Dean")
    CaseFactory(case_number="IR 77", submitting_officer=officer)

    resp = botanist_client.get(reverse("case_list"), {"search": "WINCHESTER, Dean"})

    assert resp.status_code == 200
    assert "IR 77" in [r["case_number"] for r in _results(resp)]
