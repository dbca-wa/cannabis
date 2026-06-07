"""Tests for streaming export paths in police views (triggered when count > 1000)."""

from unittest.mock import patch

import pytest
from django.urls import reverse
from rest_framework import status

from police.models import PoliceOfficer, PoliceStation


@pytest.fixture
def stations_for_stream(db):
    """Create stations for streaming tests."""
    return [
        PoliceStation.objects.create(
            name=f"Stream Station {i}", address=f"{i} Stream St"
        )
        for i in range(3)
    ]


@pytest.fixture
def officers_for_stream(db, stations_for_stream):
    """Create officers for streaming tests."""
    return [
        PoliceOfficer.objects.create(
            badge_number=f"STR{i:03d}",
            first_name=f"Stream{i}",
            last_name=f"Officer{i}",
            rank=PoliceOfficer.SeniorityChoices.CONSTABLE,
            station=stations_for_stream[i % 3],
        )
        for i in range(5)
    ]


@pytest.mark.django_db
class TestOfficerExportStreamingPath:
    """Tests for officer export streaming (mocked count > 1000)."""

    @patch("police.views.officers.PoliceOfficerExportView.get_queryset")
    def test_csv_streaming_response(
        self, mock_qs, authenticated_client, officers_for_stream
    ):
        """CSV export with >1000 records uses streaming response."""
        # Create a mock queryset that reports count > 1000 but iterates over real data
        real_qs = PoliceOfficer.objects.select_related("station").all()
        mock_qs.return_value = real_qs

        # Patch the count to trigger streaming
        with patch.object(type(real_qs), "count", return_value=1001):
            url = reverse("officer_export")
            response = authenticated_client.get(url, {"export_format": "csv"})

            assert response.status_code == status.HTTP_200_OK
            assert response["Content-Type"] == "text/csv"
            # Streaming response - collect content
            content = b"".join(response.streaming_content).decode()
            assert "Badge Number" in content

    @patch("police.views.officers.PoliceOfficerExportView.get_queryset")
    def test_json_streaming_response(
        self, mock_qs, authenticated_client, officers_for_stream
    ):
        """JSON export with >1000 records uses streaming response."""
        real_qs = PoliceOfficer.objects.select_related("station").all()
        mock_qs.return_value = real_qs

        with patch.object(type(real_qs), "count", return_value=1001):
            url = reverse("officer_export")
            response = authenticated_client.get(url, {"export_format": "json"})

            assert response.status_code == status.HTTP_200_OK
            assert response["Content-Type"] == "application/json"
            content = b"".join(response.streaming_content).decode()
            assert '"count"' in content


@pytest.mark.django_db
class TestStationExportStreamingPath:
    """Tests for station export streaming (mocked count > 1000)."""

    @patch("police.views.stations.PoliceStationExportView.get_queryset")
    def test_csv_streaming_response(
        self, mock_qs, authenticated_client, stations_for_stream
    ):
        """CSV export with >1000 records uses streaming response."""
        from django.db.models import Count

        real_qs = PoliceStation.objects.annotate(officer_count=Count("officers")).all()
        mock_qs.return_value = real_qs

        with patch.object(type(real_qs), "count", return_value=1001):
            url = reverse("station_export")
            response = authenticated_client.get(url, {"export_format": "csv"})

            assert response.status_code == status.HTTP_200_OK
            assert response["Content-Type"] == "text/csv"
            content = b"".join(response.streaming_content).decode()
            assert "Name" in content

    @patch("police.views.stations.PoliceStationExportView.get_queryset")
    def test_json_streaming_response(
        self, mock_qs, authenticated_client, stations_for_stream
    ):
        """JSON export with >1000 records uses streaming response."""
        from django.db.models import Count

        real_qs = PoliceStation.objects.annotate(officer_count=Count("officers")).all()
        mock_qs.return_value = real_qs

        with patch.object(type(real_qs), "count", return_value=1001):
            url = reverse("station_export")
            response = authenticated_client.get(url, {"export_format": "json"})

            assert response.status_code == status.HTTP_200_OK
            assert response["Content-Type"] == "application/json"
            content = b"".join(response.streaming_content).decode()
            assert '"count"' in content


@pytest.mark.django_db
class TestOfficerListViewExtended:
    """Extended tests for PoliceOfficerListView filtering."""

    def test_filter_sworn_officers(self, authenticated_client, officers_for_stream):
        """Filter sworn officers."""
        url = reverse("officer_list")
        response = authenticated_client.get(url, {"is_sworn": "true"})

        assert response.status_code == status.HTTP_200_OK

    def test_filter_no_station(self, authenticated_client, db):
        """Filter officers without station."""
        PoliceOfficer.objects.create(
            badge_number="NOSTATION",
            first_name="No",
            last_name="Station",
            station=None,
        )
        url = reverse("officer_list")
        response = authenticated_client.get(url, {"no_station": "true"})

        assert response.status_code == status.HTTP_200_OK
        assert len(response.data["results"]) >= 1

    def test_filter_unknown_only(self, authenticated_client, db):
        """Filter unknown rank officers only."""
        PoliceOfficer.objects.create(
            badge_number="UNKNOWN1",
            first_name="Unknown",
            last_name="Rank",
            rank=PoliceOfficer.SeniorityChoices.UNKNOWN,
        )
        url = reverse("officer_list")
        response = authenticated_client.get(url, {"unknown_only": "true"})

        assert response.status_code == status.HTTP_200_OK

    def test_exclude_unknown(self, authenticated_client, officers_for_stream):
        """Exclude unknown rank officers."""
        url = reverse("officer_list")
        response = authenticated_client.get(url, {"include_unknown": "false"})

        assert response.status_code == status.HTTP_200_OK
