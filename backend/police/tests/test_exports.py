"""Tests for police officer and station export views."""

import pytest
from django.urls import reverse
from rest_framework import status

from police.models import PoliceOfficer, PoliceStation


@pytest.fixture
def multiple_stations(db):
    """Create multiple police stations for testing."""
    stations = []
    for i in range(5):
        stations.append(
            PoliceStation.objects.create(
                name=f"Station {i}",
                address=f"{i} Main Street",
                phone=f"041234567{i}",
            )
        )
    return stations


@pytest.fixture
def multiple_officers(db, multiple_stations):
    """Create multiple officers across stations."""
    officers = []
    ranks = [
        PoliceOfficer.SeniorityChoices.CONSTABLE,
        PoliceOfficer.SeniorityChoices.SENIOR_CONSTABLE,
        PoliceOfficer.SeniorityChoices.SERGEANT,
        PoliceOfficer.SeniorityChoices.DETECTIVE,
        PoliceOfficer.SeniorityChoices.INSPECTOR,
    ]
    for i in range(10):
        officers.append(
            PoliceOfficer.objects.create(
                badge_number=f"B{i:03d}",
                first_name=f"Officer{i}",
                last_name=f"Smith{i}",
                rank=ranks[i % len(ranks)],
                station=multiple_stations[i % len(multiple_stations)],
            )
        )
    return officers


@pytest.mark.django_db
class TestPoliceOfficerListView:
    """Tests for PoliceOfficerListView filtering."""

    def test_list_with_search(self, authenticated_client, multiple_officers):
        """GET officers with search filter."""
        url = reverse("officer_list")
        response = authenticated_client.get(url, {"search": "Smith3"})

        assert response.status_code == status.HTTP_200_OK
        assert len(response.data["results"]) >= 1

    def test_list_filter_by_station(
        self, authenticated_client, multiple_officers, multiple_stations
    ):
        """GET officers filtered by station."""
        url = reverse("officer_list")
        response = authenticated_client.get(url, {"station": multiple_stations[0].pk})

        assert response.status_code == status.HTTP_200_OK
        assert len(response.data["results"]) >= 1

    def test_list_filter_by_rank(self, authenticated_client, multiple_officers):
        """GET officers filtered by rank."""
        url = reverse("officer_list")
        response = authenticated_client.get(
            url, {"rank": PoliceOfficer.SeniorityChoices.SERGEANT}
        )

        assert response.status_code == status.HTTP_200_OK
        assert len(response.data["results"]) >= 1

    def test_list_ordering_by_rank(self, authenticated_client, multiple_officers):
        """GET officers ordered by rank seniority."""
        url = reverse("officer_list")
        response = authenticated_client.get(url, {"ordering": "-rank"})

        assert response.status_code == status.HTTP_200_OK

    def test_list_ordering_by_station(self, authenticated_client, multiple_officers):
        """GET officers ordered by station name."""
        url = reverse("officer_list")
        response = authenticated_client.get(url, {"ordering": "station"})

        assert response.status_code == status.HTTP_200_OK


@pytest.mark.django_db
class TestPoliceOfficerExportView:
    """Tests for PoliceOfficerExportView."""

    def test_csv_export(self, authenticated_client, multiple_officers):
        """GET export as CSV returns valid CSV."""
        url = reverse("officer_export")
        response = authenticated_client.get(url, {"export_format": "csv"})

        assert response.status_code == status.HTTP_200_OK
        assert response["Content-Type"] == "text/csv"
        content = response.content.decode()
        assert "Badge Number" in content
        assert "Station Name" in content

    def test_json_export(self, authenticated_client, multiple_officers):
        """GET export as JSON returns valid JSON."""
        url = reverse("officer_export")
        response = authenticated_client.get(url, {"export_format": "json"})

        assert response.status_code == status.HTTP_200_OK
        assert response["Content-Type"] == "application/json"

    def test_csv_export_with_search(self, authenticated_client, multiple_officers):
        """CSV export with search filter."""
        url = reverse("officer_export")
        response = authenticated_client.get(
            url, {"export_format": "csv", "search": "Smith1"}
        )

        assert response.status_code == status.HTTP_200_OK
        content = response.content.decode()
        assert "Smith1" in content

    def test_csv_export_with_station_filter(
        self, authenticated_client, multiple_officers, multiple_stations
    ):
        """CSV export filtered by station."""
        url = reverse("officer_export")
        response = authenticated_client.get(
            url, {"export_format": "csv", "station": str(multiple_stations[0].pk)}
        )

        assert response.status_code == status.HTTP_200_OK

    def test_csv_export_with_rank_filter(self, authenticated_client, multiple_officers):
        """CSV export filtered by rank."""
        url = reverse("officer_export")
        response = authenticated_client.get(
            url,
            {
                "export_format": "csv",
                "rank": PoliceOfficer.SeniorityChoices.CONSTABLE,
            },
        )

        assert response.status_code == status.HTTP_200_OK

    def test_export_invalid_format(self, authenticated_client, multiple_officers):
        """Export with invalid format returns 400."""
        url = reverse("officer_export")
        response = authenticated_client.get(url, {"export_format": "xml"})

        assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_export_unauthenticated(self, api_client):
        """Export without auth returns 401."""
        url = reverse("officer_export")
        response = api_client.get(url, {"export_format": "csv"})

        assert response.status_code == status.HTTP_401_UNAUTHORIZED


@pytest.mark.django_db
class TestPoliceStationListView:
    """Tests for PoliceStationListView filtering."""

    def test_list_with_search(self, authenticated_client, multiple_stations):
        """GET stations with search filter."""
        url = reverse("station_list")
        response = authenticated_client.get(url, {"search": "Station 2"})

        assert response.status_code == status.HTTP_200_OK
        assert len(response.data["results"]) >= 1

    def test_list_ordering(self, authenticated_client, multiple_stations):
        """GET stations with ordering."""
        url = reverse("station_list")
        response = authenticated_client.get(url, {"ordering": "-name"})

        assert response.status_code == status.HTTP_200_OK


@pytest.mark.django_db
class TestPoliceStationExportView:
    """Tests for PoliceStationExportView."""

    def test_csv_export(self, authenticated_client, multiple_stations):
        """GET export as CSV returns valid CSV."""
        url = reverse("station_export")
        response = authenticated_client.get(url, {"export_format": "csv"})

        assert response.status_code == status.HTTP_200_OK
        assert response["Content-Type"] == "text/csv"
        content = response.content.decode()
        assert "Name" in content
        assert "Address" in content

    def test_json_export(self, authenticated_client, multiple_stations):
        """GET export as JSON returns valid JSON."""
        url = reverse("station_export")
        response = authenticated_client.get(url, {"export_format": "json"})

        assert response.status_code == status.HTTP_200_OK
        assert response["Content-Type"] == "application/json"

    def test_csv_export_with_search(self, authenticated_client, multiple_stations):
        """CSV export with search filter."""
        url = reverse("station_export")
        response = authenticated_client.get(
            url, {"export_format": "csv", "search": "Station 1"}
        )

        assert response.status_code == status.HTTP_200_OK

    def test_export_invalid_format(self, authenticated_client, multiple_stations):
        """Export with invalid format returns 400."""
        url = reverse("station_export")
        response = authenticated_client.get(url, {"export_format": "xml"})

        assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_export_unauthenticated(self, api_client):
        """Export without auth returns 401."""
        url = reverse("station_export")
        response = api_client.get(url, {"export_format": "csv"})

        assert response.status_code == status.HTTP_401_UNAUTHORIZED
