"""Practice mode service.

Practice mode is a per-user, self-expiring mode layered over the real workflow.
This service owns turning the mode on and off, generating the fake brief the user
works to, allocating per-user PRACTICE- numbers, and purging a user's practice
data. The real workflow screens do the actual work; this service never
re-implements them.
"""

from __future__ import annotations

from django.conf import settings
from django.db import transaction
from django.utils import timezone

from common.logging import describe_user
from common.practice import current


class PracticeService:
    """Mode toggling, per-user PRACTICE- numbering and purging.

    The fake brief lives on the client (it drives the on-screen guide), so this
    service no longer generates one.
    """

    # ----- mode toggling -------------------------------------------------
    @staticmethod
    def enable_for_user(user):
        """Turn practice mode on for the user and record when the session began."""
        prefs = user.get_preferences
        prefs.practice_mode = True
        prefs.practice_mode_started_at = timezone.now()
        prefs.save(update_fields=["practice_mode", "practice_mode_started_at"])
        settings.LOGGER.info(f"{describe_user(user)} entered practice mode")
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
        settings.LOGGER.info(f"{describe_user(user)} left practice mode")
        return prefs

    @staticmethod
    @transaction.atomic
    def reset_for_user(user):
        """Explicitly clear the user's practice data and start a fresh session.

        This is the only path that deletes all of a user's practice data, and it
        is only reached when the user asks for a clean slate. Practice mode is
        left on with a new start time so the user keeps practising, now from
        scratch.
        """
        PracticeService.purge_for_user(user)
        prefs = user.get_preferences
        prefs.practice_mode = True
        prefs.practice_mode_started_at = timezone.now()
        prefs.save(update_fields=["practice_mode", "practice_mode_started_at"])
        settings.LOGGER.info(
            f"{describe_user(user)} reset their practice data and started a "
            f"fresh practice session"
        )
        return prefs

    @staticmethod
    @transaction.atomic
    def reset_case_for_user(user, case):
        """Delete a single practice case (and its cascades) for the user.

        The restart control on the guide removes just the case the user is
        working on so they can start that one over, leaving any other practice
        data untouched. Only the user's own practice cases can be removed.
        """
        if not case.is_practice or case.practice_owner_id != user.pk:
            from rest_framework.exceptions import PermissionDenied

            raise PermissionDenied("That case is not your practice case.")

        case_number = case.case_number
        case_id = case.pk
        forms = case.forms.count()
        from ..models import Certificate

        certs = Certificate.all_objects.filter(form__case=case).count()
        # Deleting the case cascades to its forms, bags, assessments and
        # certificates (and frees any batch via the certificate FK on_delete).
        case.delete()
        settings.LOGGER.info(
            f"{describe_user(user)} restarted practice case {case_number} "
            f"({case_id}); removed {forms} form(s) and {certs} certificate(s)"
        )

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

        def _owned(model):
            return model.all_objects.filter(is_practice=True, practice_owner=user)

        # Cases cascade to forms, bags, assessments and certificates. Batches,
        # officers, stations and defendants are owned independently.
        counts = {
            "batch": _owned(Batch).count(),
            "case": _owned(Case).count(),
            "officer": _owned(PoliceOfficer).count(),
            "station": _owned(PoliceStation).count(),
            "defendant": _owned(Defendant).count(),
        }
        _owned(Batch).delete()
        _owned(Case).delete()
        _owned(PoliceOfficer).delete()
        _owned(PoliceStation).delete()
        _owned(Defendant).delete()
        settings.LOGGER.info(
            f"{describe_user(user)} practice data purged: "
            + ", ".join(f"{n} {k}(s)" for k, n in counts.items())
        )


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
