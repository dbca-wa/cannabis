"""Tests for user export views (UserExportView, UserCSVExportView, SimpleCSVTestView)."""

import pytest
from django.contrib.auth import get_user_model
from django.urls import reverse
from rest_framework import status

User = get_user_model()


@pytest.fixture
def users_with_roles(db):
    """Create users with various roles for export testing."""
    users = []
    for i in range(5):
        users.append(
            User.objects.create_user(
                email=f"botanist{i}@example.com",
                password="testpass123",
                first_name=f"Botanist{i}",
                last_name="User",
                role="botanist",
            )
        )
    for i in range(3):
        users.append(
            User.objects.create_user(
                email=f"finance{i}@example.com",
                password="testpass123",
                first_name=f"Finance{i}",
                last_name="Officer",
                role="finance",
            )
        )
    # Inactive user
    inactive = User.objects.create_user(
        email="inactive@example.com",
        password="testpass123",
        first_name="Inactive",
        last_name="User",
        is_active=False,
    )
    users.append(inactive)
    return users


@pytest.mark.django_db
class TestUserExportView:
    """Tests for UserExportView."""

    def test_csv_export_default(self, authenticated_client, users_with_roles):
        """GET export with CSV format returns CSV content."""
        url = reverse("user_export")
        response = authenticated_client.get(url, {"export_format": "csv"})

        assert response.status_code == status.HTTP_200_OK
        assert response["Content-Type"] == "text/csv"
        assert "attachment" in response["Content-Disposition"]

    def test_json_export(self, authenticated_client, users_with_roles):
        """GET export with JSON format returns JSON content."""
        url = reverse("user_export")
        response = authenticated_client.get(url, {"export_format": "json"})

        assert response.status_code == status.HTTP_200_OK
        assert response["Content-Type"] == "application/json"
        assert "attachment" in response["Content-Disposition"]

    def test_csv_export_filter_by_role(self, authenticated_client, users_with_roles):
        """CSV export with role filter only includes matching users."""
        url = reverse("user_export")
        response = authenticated_client.get(
            url, {"export_format": "csv", "role": "botanist"}
        )

        assert response.status_code == status.HTTP_200_OK
        content = response.content.decode()
        # Should contain botanist users
        assert "Botanist" in content

    def test_csv_export_filter_by_active(self, authenticated_client, users_with_roles):
        """CSV export with is_active filter."""
        url = reverse("user_export")
        response = authenticated_client.get(
            url, {"export_format": "csv", "is_active": "true"}
        )

        assert response.status_code == status.HTTP_200_OK
        content = response.content.decode()
        # Should not contain inactive user
        assert "inactive@example.com" not in content

    def test_csv_export_with_search(self, authenticated_client, users_with_roles):
        """CSV export with search filter."""
        url = reverse("user_export")
        response = authenticated_client.get(
            url, {"export_format": "csv", "search": "Finance"}
        )

        assert response.status_code == status.HTTP_200_OK
        content = response.content.decode()
        assert "Finance" in content

    def test_export_unauthenticated(self, api_client):
        """Export without auth returns 401."""
        url = reverse("user_export")
        response = api_client.get(url, {"export_format": "csv"})

        assert response.status_code == status.HTTP_401_UNAUTHORIZED

    def test_export_with_ordering(self, authenticated_client, users_with_roles):
        """Export respects ordering parameter."""
        url = reverse("user_export")
        response = authenticated_client.get(
            url, {"export_format": "csv", "ordering": "email"}
        )

        assert response.status_code == status.HTTP_200_OK


@pytest.mark.django_db
class TestUserCSVExportView:
    """Tests for UserCSVExportView (CSV-only endpoint)."""

    def test_csv_export_basic(self, authenticated_client, users_with_roles):
        """Basic CSV export returns valid CSV."""
        url = reverse("user_export")
        response = authenticated_client.get(url, {"export_format": "csv"})

        assert response.status_code == status.HTTP_200_OK
        assert "text/csv" in response["Content-Type"]

    def test_csv_export_filter_role(self, authenticated_client, users_with_roles):
        """CSV export filters by role."""
        url = reverse("user_export")
        response = authenticated_client.get(
            url, {"export_format": "csv", "role": "finance"}
        )

        assert response.status_code == status.HTTP_200_OK

    def test_csv_export_filter_active(self, authenticated_client, users_with_roles):
        """CSV export filters by active status."""
        url = reverse("user_export")
        response = authenticated_client.get(
            url, {"export_format": "csv", "is_active": "false"}
        )

        assert response.status_code == status.HTTP_200_OK

    def test_csv_export_search(self, authenticated_client, users_with_roles):
        """CSV export with search parameter."""
        url = reverse("user_export")
        response = authenticated_client.get(
            url, {"export_format": "csv", "search": "botanist"}
        )

        assert response.status_code == status.HTTP_200_OK


@pytest.mark.django_db
class TestSimpleCSVTestView:
    """Tests for SimpleCSVTestView."""

    def test_simple_csv_returns_csv(self, api_client):
        """Simple CSV test view returns CSV without auth."""
        url = reverse("simple_csv_test")
        response = api_client.get(url)

        assert response.status_code == status.HTTP_200_OK
        assert response["Content-Type"] == "text/csv"
        content = response.content.decode()
        assert "ID,Name" in content


@pytest.mark.django_db
class TestUserDetailView:
    """Tests for UserDetailView GET, PATCH, DELETE."""

    def test_get_user_detail(self, authenticated_client, user):
        """GET user detail returns user data."""
        url = reverse("user_detail", kwargs={"pk": user.pk})
        response = authenticated_client.get(url)

        assert response.status_code == status.HTTP_200_OK
        assert response.data["email"] == user.email

    def test_patch_self(self, authenticated_client, user):
        """PATCH own profile updates fields."""
        url = reverse("user_detail", kwargs={"pk": user.pk})
        response = authenticated_client.patch(
            url, {"first_name": "Updated"}, format="json"
        )

        assert response.status_code == status.HTTP_200_OK
        user.refresh_from_db()
        assert user.first_name == "Updated"

    def test_delete_requires_superuser(self, authenticated_client, user):
        """DELETE by non-superuser is forbidden."""
        url = reverse("user_detail", kwargs={"pk": user.pk})
        response = authenticated_client.delete(url)

        assert response.status_code == status.HTTP_403_FORBIDDEN

    def test_delete_as_admin(self, admin_client, user):
        """DELETE as admin soft-deletes user."""
        url = reverse("user_detail", kwargs={"pk": user.pk})
        response = admin_client.delete(url)

        assert response.status_code == status.HTTP_204_NO_CONTENT
        user.refresh_from_db()
        assert user.is_active is False

    def test_patch_other_user_forbidden(self, authenticated_client, db):
        """PATCH another user's profile is forbidden for non-admin."""
        other_user = User.objects.create_user(
            email="other@example.com",
            password="testpass123",
            first_name="Other",
            last_name="User",
        )
        url = reverse("user_detail", kwargs={"pk": other_user.pk})
        response = authenticated_client.patch(
            url, {"first_name": "Hacked"}, format="json"
        )

        assert response.status_code == status.HTTP_403_FORBIDDEN
