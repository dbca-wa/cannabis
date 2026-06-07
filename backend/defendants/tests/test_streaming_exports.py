"""Tests for streaming export paths in defendant views."""

from unittest.mock import patch

import pytest
from django.db.models import Count
from django.urls import reverse
from rest_framework import status

from defendants.models import Defendant


@pytest.fixture
def defendants_for_stream(db):
    """Create defendants for streaming tests."""
    return [
        Defendant.objects.create(
            given_names=f"Stream{i}",
            last_name=f"Defendant{i}",
        )
        for i in range(5)
    ]


@pytest.mark.django_db
class TestDefendantExportStreamingPath:
    """Tests for defendant export streaming (mocked count > 1000)."""

    @patch("defendants.services.DefendantService.get_queryset")
    def test_csv_streaming_response(
        self, mock_get_qs, authenticated_client, defendants_for_stream
    ):
        """CSV export with >1000 records uses streaming response."""
        real_qs = Defendant.objects.annotate(cases_count=Count("cases")).all()
        mock_get_qs.return_value = real_qs

        with patch.object(type(real_qs), "count", return_value=1001):
            url = reverse("defendant_export")
            response = authenticated_client.get(url, {"export_format": "csv"})

            assert response.status_code == status.HTTP_200_OK
            assert response["Content-Type"] == "text/csv"
            content = b"".join(response.streaming_content).decode()
            assert "Given Names" in content

    @patch("defendants.services.DefendantService.get_queryset")
    def test_json_streaming_response(
        self, mock_get_qs, authenticated_client, defendants_for_stream
    ):
        """JSON export with >1000 records uses streaming response."""
        real_qs = Defendant.objects.annotate(cases_count=Count("cases")).all()
        mock_get_qs.return_value = real_qs

        with patch.object(type(real_qs), "count", return_value=1001):
            url = reverse("defendant_export")
            response = authenticated_client.get(url, {"export_format": "json"})

            assert response.status_code == status.HTTP_200_OK
            assert response["Content-Type"] == "application/json"
            content = b"".join(response.streaming_content).decode()
            assert '"count"' in content


@pytest.mark.django_db
class TestDefendantDetailView:
    """Tests for DefendantRetrieveUpdateDestroyView."""

    def test_get_defendant_detail(self, authenticated_client, defendants_for_stream):
        """GET defendant detail."""
        defendant = defendants_for_stream[0]
        url = reverse("defendant_detail", kwargs={"pk": defendant.pk})
        response = authenticated_client.get(url)

        assert response.status_code == status.HTTP_200_OK
        assert response.data["last_name"] == defendant.last_name

    def test_update_defendant(self, authenticated_client, defendants_for_stream):
        """PATCH defendant updates fields."""
        defendant = defendants_for_stream[0]
        url = reverse("defendant_detail", kwargs={"pk": defendant.pk})
        response = authenticated_client.patch(
            url, {"given_names": "Updated"}, format="json"
        )

        assert response.status_code == status.HTTP_200_OK
        defendant.refresh_from_db()
        assert defendant.given_names == "Updated"

    def test_delete_defendant_no_cases(
        self, authenticated_client, defendants_for_stream
    ):
        """DELETE defendant without cases succeeds."""
        defendant = defendants_for_stream[0]
        url = reverse("defendant_detail", kwargs={"pk": defendant.pk})
        response = authenticated_client.delete(url)

        assert response.status_code == status.HTTP_204_NO_CONTENT

    def test_create_defendant(self, authenticated_client):
        """POST creates a new defendant."""
        url = reverse("defendant_list")
        response = authenticated_client.post(
            url,
            {"given_names": "New", "last_name": "Defendant"},
            format="json",
        )

        assert response.status_code == status.HTTP_201_CREATED
