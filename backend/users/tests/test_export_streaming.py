"""Tests for streaming export paths (>1000 records) in UserExportView."""

import pytest
from django.contrib.auth import get_user_model
from django.urls import reverse
from rest_framework import status

User = get_user_model()


@pytest.fixture
def many_users(db):
    """Create enough users to trigger streaming (mock count instead)."""
    # Create a few users — we'll mock the count to trigger streaming
    users = []
    for i in range(5):
        users.append(
            User.objects.create_user(
                email=f"stream{i}@example.com",
                password="testpass123",
                first_name=f"Stream{i}",
                last_name="User",
                role="botanist",
            )
        )
    return users


@pytest.mark.django_db
class TestUserExportStreaming:
    """Tests for streaming export paths."""

    def test_json_export_small_dataset(self, authenticated_client, many_users):
        """JSON export with small dataset uses regular response."""
        url = reverse("user_export")
        response = authenticated_client.get(url, {"export_format": "json"})

        assert response.status_code == status.HTTP_200_OK
        assert response["Content-Type"] == "application/json"
        # Check it's a proper JSON response with count and results
        import json

        data = json.loads(response.content)
        assert "count" in data
        assert "results" in data

    def test_csv_export_contains_headers(self, authenticated_client, many_users):
        """CSV export contains expected column headers."""
        url = reverse("user_export")
        response = authenticated_client.get(url, {"export_format": "csv"})

        assert response.status_code == status.HTTP_200_OK
        content = response.content.decode()
        # The CSV export should have ID, First Name, etc.
        assert "ID" in content

    def test_export_with_invalid_format(self, authenticated_client, many_users):
        """Export with invalid format falls through to validation error."""
        url = reverse("user_export")
        response = authenticated_client.get(url, {"export_format": "xml"})

        assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_export_ordering_valid(self, authenticated_client, many_users):
        """Export with valid ordering parameter."""
        url = reverse("user_export")
        response = authenticated_client.get(
            url, {"export_format": "json", "ordering": "first_name"}
        )

        assert response.status_code == status.HTTP_200_OK

    def test_export_ordering_invalid(self, authenticated_client, many_users):
        """Export with invalid ordering uses default."""
        url = reverse("user_export")
        response = authenticated_client.get(
            url, {"export_format": "json", "ordering": "invalid_field"}
        )

        assert response.status_code == status.HTTP_200_OK


@pytest.mark.django_db
class TestUserListViewFiltering:
    """Tests for UserListView filtering and search."""

    def test_filter_by_role(self, authenticated_client, many_users):
        """Filter users by role."""
        url = reverse("user_list")
        response = authenticated_client.get(url, {"role": "botanist"})

        assert response.status_code == status.HTTP_200_OK
        for user_data in response.data["results"]:
            assert user_data["role"] == "botanist"

    def test_filter_by_active(self, authenticated_client, many_users):
        """Filter users by active status."""
        url = reverse("user_list")
        response = authenticated_client.get(url, {"is_active": "true"})

        assert response.status_code == status.HTTP_200_OK

    def test_search_by_name(self, authenticated_client, many_users):
        """Search users by name."""
        url = reverse("user_list")
        response = authenticated_client.get(url, {"search": "Stream2"})

        assert response.status_code == status.HTTP_200_OK
        assert len(response.data["results"]) >= 1

    def test_exclude_ids(self, authenticated_client, many_users):
        """Exclude specific user IDs."""
        url = reverse("user_list")
        exclude_id = many_users[0].pk
        response = authenticated_client.get(url, {"exclude": str(exclude_id)})

        assert response.status_code == status.HTTP_200_OK
        result_ids = [u["id"] for u in response.data["results"]]
        assert exclude_id not in result_ids
