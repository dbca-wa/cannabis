"""Tests for submission draft views and services."""

import pytest
from django.contrib.auth import get_user_model
from django.urls import reverse
from rest_framework import status

from cases.models import SubmissionDraft

User = get_user_model()


@pytest.fixture
def existing_draft(db, user):
    """Create an existing draft for the user."""
    # Delete any auto-created draft first
    SubmissionDraft.objects.filter(user=user).delete()
    return SubmissionDraft.objects.create(
        user=user,
        data={"case_number": "DRAFT-001", "step1": "complete"},
        current_step=2,
    )


@pytest.mark.django_db
class TestSubmissionDraftView:
    """Tests for SubmissionDraftView (GET, PUT, DELETE)."""

    def test_get_draft_exists(self, authenticated_client, existing_draft, user):
        """GET draft when one exists returns draft data."""
        url = reverse("case_draft")
        response = authenticated_client.get(url)

        assert response.status_code == status.HTTP_200_OK
        assert response.data["data"] == {
            "case_number": "DRAFT-001",
            "step1": "complete",
        }
        assert response.data["current_step"] == 2

    def test_get_draft_not_exists(self, authenticated_client, user):
        """GET draft when none exists returns 404."""
        # Ensure no draft exists
        SubmissionDraft.objects.filter(user=user).delete()

        url = reverse("case_draft")
        response = authenticated_client.get(url)

        assert response.status_code == status.HTTP_404_NOT_FOUND

    def test_put_create_new_draft(self, authenticated_client, user):
        """PUT creates a new draft when none exists."""
        # Ensure no draft exists
        SubmissionDraft.objects.filter(user=user).delete()

        url = reverse("case_draft")
        data = {
            "data": {"case_number": "NEW-001", "officer": "Smith"},
            "current_step": 1,
        }
        response = authenticated_client.put(url, data, format="json")

        assert response.status_code == status.HTTP_200_OK
        assert response.data["current_step"] == 1

        draft = SubmissionDraft.objects.get(user=user)
        assert draft.data == {"case_number": "NEW-001", "officer": "Smith"}

    def test_put_update_existing_draft(
        self, authenticated_client, existing_draft, user
    ):
        """PUT updates an existing draft (upsert)."""
        url = reverse("case_draft")
        data = {
            "data": {"case_number": "UPDATED-001", "step2": "done"},
            "current_step": 3,
        }
        response = authenticated_client.put(url, data, format="json")

        assert response.status_code == status.HTTP_200_OK
        assert response.data["current_step"] == 3

        existing_draft.refresh_from_db()
        assert existing_draft.data == {"case_number": "UPDATED-001", "step2": "done"}
        assert existing_draft.current_step == 3

    def test_delete_draft(self, authenticated_client, existing_draft, user):
        """DELETE removes the user's draft."""
        url = reverse("case_draft")
        response = authenticated_client.delete(url)

        assert response.status_code == status.HTTP_204_NO_CONTENT
        assert not SubmissionDraft.objects.filter(user=user).exists()

    def test_delete_no_draft(self, authenticated_client, user):
        """DELETE when no draft exists still returns 204."""
        SubmissionDraft.objects.filter(user=user).delete()

        url = reverse("case_draft")
        response = authenticated_client.delete(url)

        assert response.status_code == status.HTTP_204_NO_CONTENT

    def test_draft_unauthenticated(self, api_client):
        """All draft endpoints require authentication."""
        url = reverse("case_draft")

        assert api_client.get(url).status_code == status.HTTP_401_UNAUTHORIZED
        assert (
            api_client.put(url, {}, format="json").status_code
            == status.HTTP_401_UNAUTHORIZED
        )
        assert api_client.delete(url).status_code == status.HTTP_401_UNAUTHORIZED
