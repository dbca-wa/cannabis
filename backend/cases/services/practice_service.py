"""Practice mode service.

Practice mode is a per-user, self-expiring mode layered over the real workflow.
This service owns turning the mode on and off, generating the fake brief the user
works to, allocating per-user PRACTICE- numbers, and purging a user's practice
data. The real workflow screens do the actual work; this service never
re-implements them.
"""

from __future__ import annotations

import secrets

from django.db import transaction
from django.utils import timezone

from common.practice import current

# Only these determinations are used going forward.
_DETERMINATIONS = ["cannabis_sativa", "degraded", "inconclusive", "not_cannabis"]
_CONTENT_TYPES = ["plant_material", "plant", "seed", "cutting"]
_RANKS = [
    ("sworn_officer", "Sworn Officer"),
    ("senior_constable", "Senior Constable"),
    ("sergeant", "Sergeant"),
]
_FIRST_NAMES = ["Alex", "Jordan", "Sam", "Taylor", "Morgan", "Riley"]
_LAST_NAMES = ["Turner", "Hughes", "Patel", "Nguyen", "Fletcher", "Davies"]
_STATIONS = ["Fremantle", "Joondalup", "Mandurah", "Midland", "Cannington"]


def _randint(low, high):
    """Inclusive random integer using secrets (demo data, not security use)."""
    return low + secrets.randbelow(high - low + 1)


class PracticeService:
    """Mode toggling, brief generation, numbering and purging."""

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
    @transaction.atomic
    def disable_for_user(user):
        """Turn practice mode off and delete all of the user's practice data."""
        prefs = user.get_preferences
        prefs.practice_mode = False
        prefs.practice_mode_started_at = None
        prefs.save(update_fields=["practice_mode", "practice_mode_started_at"])
        PracticeService.purge_for_user(user)
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

    # ----- brief ---------------------------------------------------------
    @staticmethod
    def generate_brief():
        """A fake Priority 3 brief for the user to enter. Nothing is real."""
        rank_value, rank_label = secrets.choice(_RANKS)
        station = secrets.choice(_STATIONS)
        officer = {
            "rank": rank_value,
            "rank_display": rank_label,
            "badge_number": f"PD{_randint(10000, 69999)}",
            "given_names": secrets.choice(_FIRST_NAMES),
            "last_name": secrets.choice(_LAST_NAMES),
            "station": station,
        }
        defendant = {
            "given_names": secrets.choice(_FIRST_NAMES),
            "last_name": secrets.choice(_LAST_NAMES),
        }
        botanist = {
            "given_names": secrets.choice(_FIRST_NAMES),
            "last_name": secrets.choice(_LAST_NAMES),
        }

        envelope = f"SME{_randint(1000, 9999)}" if secrets.randbelow(2) else ""
        tag_seed = _randint(10000, 80000)
        bags = []
        for _ in range(_randint(1, 3)):
            tag_seed += 1
            bags.append(
                {
                    "original_seal": f"T{tag_seed:05d}",
                    "new_seal": f"N{tag_seed:05d}",
                    "content_type": secrets.choice(_CONTENT_TYPES),
                    "determination": secrets.choice(_DETERMINATIONS),
                    "female_plants": bool(secrets.randbelow(2)),
                }
            )

        return {
            "case_number": f"PRACTICE-{_randint(100000, 999999)}",
            "officer": officer,
            "station": station,
            "defendant": defendant,
            "botanist": botanist,
            "security_movement_envelope": envelope,
            "bags": bags,
        }

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

    @staticmethod
    def purge_expired():
        """Sweep practice data for every user whose session has lapsed."""
        from common.practice import PRACTICE_TTL
        from users.models import UserPreferences

        cutoff = timezone.now() - PRACTICE_TTL
        lapsed = UserPreferences.objects.filter(
            practice_mode=True, practice_mode_started_at__lt=cutoff
        ).select_related("user")
        count = 0
        for prefs in lapsed:
            PracticeService.disable_for_user(prefs.user)
            count += 1
        return count


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
