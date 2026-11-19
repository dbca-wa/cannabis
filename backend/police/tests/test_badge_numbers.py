"""Badge numbers belong to one officer, whether adding or editing."""

import pytest
from django.urls import reverse

from common.tests.factories import PoliceOfficerFactory, PoliceStationFactory
from police.models import PoliceOfficer

pytestmark = pytest.mark.django_db


def _create(client, **data):
    body = {"last_name": "Different", "given_names": "Person", "rank": ""}
    body.update(data)
    return client.post(reverse("officer_list"), body, format="json")


def test_adding_an_officer_with_a_badge_already_in_use_is_refused(botanist_client):
    station = PoliceStationFactory(name="Kensington")
    PoliceOfficerFactory(
        last_name="Turner", given_names="Alex", badge_number="PD88001", station=station
    )

    resp = _create(botanist_client, badge_number="PD88001")

    assert resp.status_code == 400
    assert (
        "Badge number PD88001 already belongs to TURNER, Alex (Kensington). "
        "Search for them instead of adding them again."
    ) in str(resp.data["badge_number"])
    assert PoliceOfficer.objects.filter(badge_number="PD88001").count() == 1


def test_the_badge_check_ignores_case_and_spaces(botanist_client):
    PoliceOfficerFactory(badge_number="PD88001", station=None)

    resp = _create(botanist_client, badge_number=" pd88001 ")

    assert resp.status_code == 400
    assert "badge_number" in resp.data


def test_officers_without_a_badge_can_be_added(botanist_client):
    PoliceOfficerFactory(badge_number="", station=None)

    resp = _create(botanist_client, badge_number="")

    assert resp.status_code == 201


def test_editing_an_officer_onto_a_badge_in_use_is_refused(botanist_client):
    PoliceOfficerFactory(badge_number="PD88001")
    officer = PoliceOfficerFactory(badge_number="PD88002")

    resp = botanist_client.patch(
        reverse("officer_detail", kwargs={"pk": officer.pk}),
        {"badge_number": "PD88001"},
        format="json",
    )

    assert resp.status_code == 400
    assert "already belongs to" in str(resp.data["badge_number"])


def test_the_edit_message_points_to_merge(botanist_client):
    PoliceOfficerFactory(badge_number="PD88001", station=None)
    officer = PoliceOfficerFactory(badge_number="PD88002")

    resp = botanist_client.patch(
        reverse("officer_detail", kwargs={"pk": officer.pk}),
        {"badge_number": "PD88001"},
        format="json",
    )

    assert "merge the two records on the Officers page" in str(
        resp.data["badge_number"]
    )


def test_an_older_record_sharing_its_badge_can_still_be_edited(botanist_client):
    # Older imported records can already share a badge with a duplicate.
    PoliceOfficerFactory(badge_number="PD50004")
    officer = PoliceOfficerFactory(badge_number="PD50004", given_names="Jade")

    resp = botanist_client.patch(
        reverse("officer_detail", kwargs={"pk": officer.pk}),
        {"badge_number": "PD50004", "given_names": "Jaden"},
        format="json",
    )

    assert resp.status_code == 200


def test_an_officer_keeps_their_own_badge_when_edited(botanist_client):
    officer = PoliceOfficerFactory(badge_number="PD88001")

    resp = botanist_client.patch(
        reverse("officer_detail", kwargs={"pk": officer.pk}),
        {"badge_number": "PD88001", "given_names": "Alexander"},
        format="json",
    )

    assert resp.status_code == 200
