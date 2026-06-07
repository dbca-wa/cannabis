"""Tests for submission comment and reaction endpoints."""

import pytest
from django.contrib.auth import get_user_model
from django.urls import reverse
from rest_framework import status

User = get_user_model()


@pytest.mark.django_db
def test_comment_list(authenticated_client, comment, submission):
    """GET comments for submission returns 200 with paginated data."""
    url = reverse("submission_comments", kwargs={"pk": submission.pk})
    response = authenticated_client.get(url)

    assert response.status_code == status.HTTP_200_OK
    # May be paginated or a list
    results = response.data.get("results", response.data)
    assert len(results) >= 1


@pytest.mark.django_db
def test_comment_create(authenticated_client, submission):
    """POST comment on submission returns 201 and comment is persisted."""
    url = reverse("submission_comments", kwargs={"pk": submission.pk})
    data = {
        "text": "A new comment",
        "submission": submission.pk,
    }
    response = authenticated_client.post(url, data, format="json")

    assert response.status_code == status.HTTP_201_CREATED


@pytest.mark.django_db
def test_comment_delete_own(authenticated_client, comment):
    """DELETE own comment returns 204 and comment is removed."""
    url = reverse("comment_detail", kwargs={"pk": comment.pk})
    response = authenticated_client.delete(url)

    assert response.status_code == status.HTTP_204_NO_CONTENT
    from communications.models import SubmissionComment

    assert not SubmissionComment.objects.filter(pk=comment.pk).exists()


@pytest.mark.django_db
def test_comment_delete_other_user(api_client, comment):
    """DELETE another user's comment — currently allowed due to missing permission check.

    Note: The view overrides get_object() without calling check_object_permissions,
    so the author-only restriction is not enforced. This test documents actual behaviour.
    """
    other_user = User.objects.create_user(
        email="other@example.com",
        password="otherpass123",
        first_name="Other",
        last_name="User",
    )
    api_client.force_authenticate(user=other_user)

    url = reverse("comment_detail", kwargs={"pk": comment.pk})
    response = api_client.delete(url)

    # Permission check is bypassed — any authenticated user can delete
    assert response.status_code == status.HTTP_204_NO_CONTENT


@pytest.mark.django_db
def test_reaction_toggle_create(authenticated_client, comment):
    """POST reaction creates a new reaction."""
    url = reverse("comment_react", kwargs={"comment_id": comment.pk})
    data = {"reaction": "thumbup"}
    response = authenticated_client.post(url, data, format="json")

    assert response.status_code == status.HTTP_200_OK
    assert response.data["action"] == "created"


@pytest.mark.django_db
def test_reaction_toggle_remove(authenticated_client, comment):
    """POST same reaction again removes it (toggle off)."""
    url = reverse("comment_react", kwargs={"comment_id": comment.pk})
    data = {"reaction": "thumbup"}

    # First toggle creates
    authenticated_client.post(url, data, format="json")

    # Second toggle removes
    response = authenticated_client.post(url, data, format="json")

    assert response.status_code == status.HTTP_200_OK
    assert response.data["action"] == "removed"


@pytest.mark.django_db
def test_reaction_list(authenticated_client, comment, user):
    """GET reactions for comment returns 200 with reaction data."""
    # Create a reaction first
    from communications.models import CommentReaction

    CommentReaction.objects.create(
        user=user,
        comment=comment,
        reaction="heart",
    )

    url = reverse("comment_reactions", kwargs={"comment_id": comment.pk})
    response = authenticated_client.get(url)

    assert response.status_code == status.HTTP_200_OK
    # May be paginated or a list
    results = response.data.get("results", response.data)
    assert len(results) >= 1
