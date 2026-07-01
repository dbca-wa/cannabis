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
