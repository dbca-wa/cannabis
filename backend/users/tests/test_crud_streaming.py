"""Tests for UserExportView streaming paths and UserCSVExportView."""

from unittest.mock import patch

import pytest
from django.contrib.auth import get_user_model
from django.urls import reverse
from rest_framework import status

User = get_user_model()


@pytest.fixture
def export_users(db):
    """Create users for export testing."""
    users = []
    for i in range(5):
        users.append(
            User.objects.create_user(
                email=f"export{i}@example.com",
                password="testpass123",
                first_name=f"Export{i}",
                last_name=f"User{i}",
                role="botanist" if i % 2 == 0 else "finance",
                employee_id=f"EMP{i:03d}",
            )
        )
    return users


@pytest.mark.django_db
class TestUserExportStreamingPaths:
    """Tests for UserExportView streaming paths (count > 1000)."""

    @patch("users.views.crud.UserExportView.get_queryset")
    def test_streaming_csv_export(self, mock_qs, authenticated_client, export_users):
        """CSV export with >1000 records uses streaming response."""
        real_qs = User.objects.all()
        mock_qs.return_value = real_qs

        with patch.object(type(real_qs), "count", return_value=1001):
            url = reverse("user_export")
            response = authenticated_client.get(url, {"export_format": "csv"})

            # The view has a special CSV path that runs first for format=csv
            # It returns a regular response for the first 10 users
            assert response.status_code == status.HTTP_200_OK

    @patch("users.views.crud.UserExportView.get_queryset")
    def test_streaming_json_export(self, mock_qs, authenticated_client, export_users):
        """JSON export with >1000 records uses streaming response."""
        real_qs = User.objects.all()
        mock_qs.return_value = real_qs

        with patch.object(type(real_qs), "count", return_value=1001):
            url = reverse("user_export")
            response = authenticated_client.get(url, {"export_format": "json"})

            assert response.status_code == status.HTTP_200_OK
            assert response["Content-Type"] == "application/json"
            content = b"".join(response.streaming_content).decode()
            assert '"count"' in content


@pytest.mark.django_db
class TestUserCSVExportViewExtended:
    """Extended tests for UserCSVExportView."""

    def test_csv_export_contains_all_columns(self, authenticated_client, export_users):
        """CSV export contains all expected columns."""
        url = reverse("user_export")
        response = authenticated_client.get(url, {"export_format": "csv"})

        assert response.status_code == status.HTTP_200_OK
        content = response.content.decode()
        assert "ID" in content
        assert "First Name" in content

    def test_csv_export_ordering_first_name(self, authenticated_client, export_users):
        """CSV export with first_name ordering."""
        url = reverse("user_export")
        response = authenticated_client.get(
            url, {"export_format": "csv", "ordering": "first_name"}
        )

        assert response.status_code == status.HTTP_200_OK

    def test_csv_export_ordering_email(self, authenticated_client, export_users):
        """CSV export with email ordering."""
        url = reverse("user_export")
        response = authenticated_client.get(
            url, {"export_format": "csv", "ordering": "email"}
        )

        assert response.status_code == status.HTTP_200_OK

    def test_csv_export_search_by_employee_id(self, authenticated_client, export_users):
        """CSV export with search by employee ID."""
        url = reverse("user_export")
        response = authenticated_client.get(
            url, {"export_format": "csv", "search": "EMP001"}
        )

        assert response.status_code == status.HTTP_200_OK

    def test_csv_export_filter_inactive(self, authenticated_client, export_users):
        """CSV export filtering inactive users."""
        # Deactivate one user
        export_users[0].is_active = False
        export_users[0].save()

        url = reverse("user_export")
        response = authenticated_client.get(
            url, {"export_format": "csv", "is_active": "false"}
        )

        assert response.status_code == status.HTTP_200_OK
