"""Officer and defendant names read SURNAME, Given everywhere in the app."""

import pytest

from common.tests.factories import DefendantFactory, PoliceOfficerFactory

pytestmark = pytest.mark.django_db


@pytest.mark.parametrize(
    "factory, fallback",
    [(PoliceOfficerFactory, "Unknown Officer"), (DefendantFactory, "Unknown")],
    ids=["officer", "defendant"],
)
class TestFullName:
    def test_surname_first_in_capitals(self, factory, fallback):
        person = factory(last_name="O'Brien-Smith", given_names="Mary-Jane")
        assert person.full_name == "O'BRIEN-SMITH, Mary-Jane"

    def test_given_names_are_kept_as_entered(self, factory, fallback):
        person = factory(last_name="McKenzie", given_names="Van Minh")
        assert person.full_name == "MCKENZIE, Van Minh"

    def test_surname_only(self, factory, fallback):
        person = factory(last_name="Turner", given_names="")
        assert person.full_name == "TURNER"

    def test_surrounding_spaces_are_ignored(self, factory, fallback):
        person = factory(last_name=" Turner ", given_names=" Alex ")
        assert person.full_name == "TURNER, Alex"

    def test_no_name_falls_back(self, factory, fallback):
        person = factory.build(last_name="", given_names="")
        assert person.full_name == fallback


def test_an_officer_with_only_given_names_keeps_them():
    officer = PoliceOfficerFactory.build(last_name="", given_names="Alex")
    assert officer.full_name == "Alex"


def test_the_duplicate_defendant_message_names_them_surname_first(botanist_client):
    from django.urls import reverse

    DefendantFactory(last_name="Simpson", given_names="Bart")

    resp = botanist_client.post(
        reverse("defendant_list"),
        {"last_name": "Simpson", "given_names": "Bart"},
        format="json",
    )

    assert resp.status_code == 400
    assert "A defendant named 'SIMPSON, Bart' already exists." in str(resp.data)


def test_the_case_list_names_officers_surname_first(botanist_client):
    from django.urls import reverse

    from common.tests.factories import CaseFactory

    conveying = PoliceOfficerFactory(last_name="Turner", given_names="Alex")
    requesting = PoliceOfficerFactory(last_name="Hargreaves", given_names="Sam")
    CaseFactory(
        case_number="IR 9", submitting_officer=conveying, requesting_officer=requesting
    )

    resp = botanist_client.get(reverse("case_list"), {"search": "IR 9"})

    row = next(r for r in resp.data["results"] if r["case_number"] == "IR 9")
    assert row["submitting_officer_name"] == "TURNER, Alex"
    assert row["requesting_officer_name"] == "HARGREAVES, Sam"
