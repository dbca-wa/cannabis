"""Tests for user management (admin CRUD) endpoints."""

import pytest
from django.urls import reverse
from rest_framework import status


@pytest.mark.django_db
def test_user_list_as_admin(admin_client, multiple_users):
    """GET user list as admin returns 200 with paginated results."""
    url = reverse("user_list")
    response = admin_client.get(url)

    assert response.status_code == status.HTTP_200_OK
    assert "results" in response.data
    # Admin + 3 multiple_users = at least 4 users
    assert len(response.data["results"]) >= 4


@pytest.mark.django_db
def test_user_list_as_regular_user(authenticated_client):
    """GET user list as regular user returns 200 (list is readable by authenticated users)."""
    url = reverse("user_list")
    response = authenticated_client.get(url)

    # UserListView allows GET for any authenticated user
    assert response.status_code == status.HTTP_200_OK


@pytest.mark.django_db
def test_user_create(admin_client):
    """POST user as admin returns 201 and user is persisted."""
    url = reverse("user_list")
    data = {
        "email": "newuser@example.com",
        "first_name": "New",
        "last_name": "User",
        "role": "none",
        "password": "SecurePass123!",
        "password_confirm": "SecurePass123!",
    }
    response = admin_client.post(url, data, format="json")

    assert response.status_code == status.HTTP_201_CREATED
    assert response.data["email"] == "newuser@example.com"


@pytest.mark.django_db
def test_user_update(admin_client, user):
    """PATCH user as admin returns 200 with fields modified."""
    url = reverse("user_detail", kwargs={"pk": user.pk})
    data = {"first_name": "Updated"}
    response = admin_client.patch(url, data, format="json")

    assert response.status_code == status.HTTP_200_OK
    user.refresh_from_db()
    assert user.first_name == "Updated"


@pytest.mark.django_db
def test_user_delete(admin_client, user):
    """DELETE user as admin returns 204 (soft delete)."""
    url = reverse("user_detail", kwargs={"pk": user.pk})
    response = admin_client.delete(url)

    assert response.status_code == status.HTTP_204_NO_CONTENT
    user.refresh_from_db()
    # Soft delete sets is_active to False
    assert user.is_active is False


@pytest.mark.django_db
def test_protected_endpoint_unauthenticated(api_client):
    """GET user list without auth returns 401."""
    url = reverse("user_list")
    response = api_client.get(url)

    assert response.status_code == status.HTTP_401_UNAUTHORIZED
