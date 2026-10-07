"""Practice mode service.

Practice mode is a per-user, self-expiring mode layered over the real workflow.
This service owns turning the mode on and off, generating the fake brief the user
works to, allocating per-user PRACTICE- numbers, and purging a user's practice
data. The real workflow screens do the actual work; this service never
re-implements them.
"""

from __future__ import annotations

from django.db import transaction
from django.utils import timezone

from common.practice import current


class PracticeService:
    """Mode toggling, per-user PRACTICE- numbering and purging.

    The fake brief lives on the client (it drives the on-screen guide), so this
    service no longer generates one.
    """

    # ----- mode toggling -------------------------------------------------
    @staticmethod
    def enable_for_user(user):
        """Turn practice mode on for the user and start the one-day clock."""
        prefs = user.get_preferences
        prefs.practice_mode = True
        prefs.practice_mode_started_at = timezone.now()
        prefs.save(update_fields=["practice_mode", "practice_mode_started_at"])
        return prefs

    @staticmethod
    def disable_for_user(user):
        """Turn practice mode off, keeping the user's practice data intact.

        The data stays flagged ``is_practice`` and hidden from the live
        application, so re-entering practice mode shows the user's existing work
        instead of an empty slate. Use ``reset_for_user`` to clear it on demand.
        """
        prefs = user.get_preferences
        prefs.practice_mode = False
        prefs.save(update_fields=["practice_mode"])
        return prefs

    @staticmethod
    @transaction.atomic
    def reset_for_user(user):
        """Explicitly clear the user's practice data and start a fresh session.

        This is the only path that deletes practice data, and it is only reached
        when the user asks for a clean slate. Practice mode is left on with a new
        start time so the user keeps practising, now from scratch.
        """
        PracticeService.purge_for_user(user)
        prefs = user.get_preferences
        prefs.practice_mode = True
        prefs.practice_mode_started_at = timezone.now()
        prefs.save(update_fields=["practice_mode", "practice_mode_started_at"])
        return prefs

    # ----- numbering -----------------------------------------------------
    @staticmethod
    def next_certificate_number(user):
        """Allocate the user's next PRACTICE- certificate number."""
        from ..models import Certificate

        n = (
            Certificate.all_objects.filter(
                is_practice=True, practice_owner=user
            ).count()
            + 1
        )
        return f"PRACTICE-R{n:06d}"

    @staticmethod
    def next_batch_number(user):
        """Allocate the user's next PRACTICE- batch number."""
        from ..models import Batch

        n = Batch.all_objects.filter(is_practice=True, practice_owner=user).count() + 1
        return f"PRACTICE-BATCH{n:03d}"

    # ----- purging -------------------------------------------------------
    @staticmethod
    @transaction.atomic
    def purge_for_user(user):
        """Delete every practice row owned by the user across all models."""
        from defendants.models import Defendant
        from police.models import PoliceOfficer, PoliceStation

        from ..models import Batch, Case

        # Cases cascade to forms, bags, assessments and certificates. Batches,
        # officers, stations and defendants are owned independently.
        Batch.all_objects.filter(is_practice=True, practice_owner=user).delete()
        Case.all_objects.filter(is_practice=True, practice_owner=user).delete()
        PoliceOfficer.all_objects.filter(is_practice=True, practice_owner=user).delete()
        PoliceStation.all_objects.filter(is_practice=True, practice_owner=user).delete()
        Defendant.all_objects.filter(is_practice=True, practice_owner=user).delete()


def practice_stamp():
    """Fields to stamp onto a row created while in practice mode, else empty.

    Create paths call this and splat it into the row's kwargs/attributes so a row
    made in practice mode is flagged and owned by the current user, and a row made
    in real mode is untouched.
    """
    ctx = current()
    if ctx and ctx.in_practice:
        return {"is_practice": True, "practice_owner_id": ctx.user_id}
    return {}
