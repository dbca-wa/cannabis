"""Tests for notification endpoints."""

import pytest
from django.urls import reverse
from rest_framework import status


@pytest.mark.django_db
def test_notification_list(authenticated_client, notification):
    """GET notifications returns 200 with paginated data."""
    url = reverse("notification_list")
    response = authenticated_client.get(url)

    assert response.status_code == status.HTTP_200_OK
    # May be paginated or a list
    results = response.data.get("results", response.data)
    assert len(results) >= 1


@pytest.mark.django_db
def test_notification_mark_read(authenticated_client, notification):
    """POST mark-read returns 200 and notifications are updated."""
    url = reverse("notifications_mark_read")
    data = {
        "is_read": True,
        "notification_ids": [notification.pk],
    }
    response = authenticated_client.post(url, data, format="json")

    assert response.status_code == status.HTTP_200_OK
    assert response.data["updated_count"] >= 1

    notification.refresh_from_db()
    assert notification.is_read is True


@pytest.mark.django_db
def test_notification_stats(authenticated_client, notification):
    """GET stats returns 200 with unread count."""
    url = reverse("notification_stats")
    response = authenticated_client.get(url)

    assert response.status_code == status.HTTP_200_OK
    assert "unread" in response.data
    assert response.data["unread"] >= 1
    assert "total" in response.data
