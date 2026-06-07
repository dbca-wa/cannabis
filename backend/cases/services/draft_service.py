"""Draft service — draft CRUD operations.

Extracted from submissions/views/drafts.py.
"""

from ..models import SubmissionDraft


def get_user_draft(user):
    """Retrieve the user's current draft.

    Args:
        user: The authenticated User instance.

    Returns:
        The SubmissionDraft instance.

    Raises:
        SubmissionDraft.DoesNotExist: If no draft exists for this user.
    """
    return SubmissionDraft.objects.get(user=user)


def upsert_user_draft(user, data, current_step=0):
    """Create or update the user's draft (upsert).

    Args:
        user: The authenticated User instance.
        data: The wizard state data (dict) to store.
        current_step: The current wizard step number.

    Returns:
        The created or updated SubmissionDraft instance.
    """
    draft, _ = SubmissionDraft.objects.update_or_create(
        user=user,
        defaults={
            "data": data,
            "current_step": current_step,
        },
    )
    return draft


def delete_user_draft(user):
    """Delete the user's draft if it exists.

    Args:
        user: The authenticated User instance.

    Returns:
        The number of drafts deleted (0 or 1).
    """
    deleted_count, _ = SubmissionDraft.objects.filter(user=user).delete()
    return deleted_count
