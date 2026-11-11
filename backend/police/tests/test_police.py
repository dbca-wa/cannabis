"""Tests for police station and officer endpoints."""

import pytest
from django.urls import reverse

from common.tests.factories import PoliceOfficerFactory, PoliceStationFactory

pytestmark = pytest.mark.django_db


class TestPoliceStations:
    def test_list(self, finance_client):
        PoliceStationFactory.create_batch(2)
        resp = finance_client.get(reverse("station_list"))
        assert resp.status_code == 200

    def test_create(self, finance_client):
        resp = finance_client.post(
            reverse("station_list"), {"name": "New Station"}, format="json"
        )
        assert resp.status_code == 201
        assert resp.data["name"] == "New Station"

    def test_detail(self, finance_client):
        station = PoliceStationFactory()
        resp = finance_client.get(reverse("station_detail", kwargs={"pk": station.pk}))
        assert resp.status_code == 200

    def test_requires_app_access(self, roleless_client):
        resp = roleless_client.get(reverse("station_list"))
        assert resp.status_code == 403


class TestPoliceOfficers:
    def test_list(self, finance_client):
        PoliceOfficerFactory.create_batch(2)
        resp = finance_client.get(reverse("officer_list"))
        assert resp.status_code == 200

    def test_create(self, finance_client):
        station = PoliceStationFactory()
        resp = finance_client.post(
            reverse("officer_list"),
            {
                "last_name": "Smith",
                "given_names": "Sam",
                "badge_number": "PD99999",
                "station": station.pk,
            },
            format="json",
        )
        assert resp.status_code == 201

    def test_detail(self, finance_client):
        officer = PoliceOfficerFactory()
        resp = finance_client.get(reverse("officer_detail", kwargs={"pk": officer.pk}))
        assert resp.status_code == 200

    def test_requires_app_access(self, roleless_client):
        resp = roleless_client.get(reverse("officer_list"))
        assert resp.status_code == 403


class TestDuplicateOfficerMessage:
    """The duplicate-officer error reads as a plain sentence."""

    def test_names_the_station(self, admin_client):
        from django.urls import reverse

        from police.models import PoliceStation

        station = PoliceStation.objects.create(name="Fremantle")
        data = {
            "last_name": "Turner",
            "given_names": "Alex",
            "rank": "constable",
            "station": station.pk,
        }
        assert (
            admin_client.post(reverse("officer_list"), data, format="json").status_code
            == 201
        )
        resp = admin_client.post(reverse("officer_list"), data, format="json")

        assert resp.status_code == 400
        assert resp.data["last_name"] == [
            "An officer named 'Alex Turner' already exists at Fremantle."
        ]

    def test_says_when_there_is_no_station(self, admin_client):
        from django.urls import reverse

        data = {"last_name": "Turner", "given_names": "Alex", "rank": "constable"}
        admin_client.post(reverse("officer_list"), data, format="json")
        resp = admin_client.post(reverse("officer_list"), data, format="json")

        assert resp.status_code == 400
        assert resp.data["last_name"] == [
            "An officer named 'Alex Turner' with no station already exists."
        ]
