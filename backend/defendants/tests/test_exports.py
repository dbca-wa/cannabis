"""Tests for defendant export and filtering views."""

import pytest
from django.urls import reverse
from rest_framework import status

from defendants.models import Defendant


@pytest.fixture
def multiple_defendants(db):
    """Create multiple defendants for testing."""
    defendants = []
    for i in range(8):
        defendants.append(
            Defendant.objects.create(
                given_names=f"Defendant{i}",
                last_name=f"Surname{i}",
            )
        )
    return defendants


@pytest.mark.django_db
class TestDefendantListView:
    """Tests for DefendantListCreateView filtering."""

    def test_list_with_search(self, authenticated_client, multiple_defendants):
        """GET defendants with search filter."""
        url = reverse("defendant_list")
        response = authenticated_client.get(url, {"search": "Surname3"})

        assert response.status_code == status.HTTP_200_OK
        assert len(response.data["results"]) >= 1

    def test_list_ordering_by_name(self, authenticated_client, multiple_defendants):
        """GET defendants ordered by given names."""
        url = reverse("defendant_list")
        response = authenticated_client.get(url, {"ordering": "given_names"})

        assert response.status_code == status.HTTP_200_OK

    def test_list_ordering_by_cases_count(
        self, authenticated_client, multiple_defendants
    ):
        """GET defendants ordered by cases count."""
        url = reverse("defendant_list")
        response = authenticated_client.get(url, {"ordering": "-cases_count"})

        assert response.status_code == status.HTTP_200_OK

    def test_list_unauthenticated(self, api_client):
        """GET without auth returns 401."""
        url = reverse("defendant_list")
        response = api_client.get(url)

        assert response.status_code == status.HTTP_401_UNAUTHORIZED


@pytest.mark.django_db
class TestDefendantExportView:
    """Tests for DefendantExportView."""

    def test_csv_export(self, authenticated_client, multiple_defendants):
        """GET export as CSV returns valid CSV."""
        url = reverse("defendant_export")
        response = authenticated_client.get(url, {"export_format": "csv"})

        assert response.status_code == status.HTTP_200_OK
        assert response["Content-Type"] == "text/csv"
        content = response.content.decode()
        assert "Given Names" in content
        assert "Last Name" in content
        assert "Cases Count" in content

    def test_json_export(self, authenticated_client, multiple_defendants):
        """GET export as JSON returns valid JSON."""
        url = reverse("defendant_export")
        response = authenticated_client.get(url, {"export_format": "json"})

        assert response.status_code == status.HTTP_200_OK
        assert response["Content-Type"] == "application/json"

    def test_csv_export_with_search(self, authenticated_client, multiple_defendants):
        """CSV export with search filter."""
        url = reverse("defendant_export")
        response = authenticated_client.get(
            url, {"export_format": "csv", "search": "Surname5"}
        )

        assert response.status_code == status.HTTP_200_OK
        content = response.content.decode()
        assert "Surname5" in content

    def test_csv_export_with_ordering(self, authenticated_client, multiple_defendants):
        """CSV export with ordering."""
        url = reverse("defendant_export")
        response = authenticated_client.get(
            url, {"export_format": "csv", "ordering": "-last_name"}
        )

        assert response.status_code == status.HTTP_200_OK

    def test_export_invalid_format(self, authenticated_client, multiple_defendants):
        """Export with invalid format returns 400."""
        url = reverse("defendant_export")
        response = authenticated_client.get(url, {"export_format": "xml"})

        assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_export_unauthenticated(self, api_client):
        """Export without auth returns 401."""
        url = reverse("defendant_export")
        response = api_client.get(url, {"export_format": "csv"})

        assert response.status_code == status.HTTP_401_UNAUTHORIZED
