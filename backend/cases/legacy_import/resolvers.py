"""Find or create the people and places a legacy case refers to.

Rules shared by every resolver:

* A record that existed before the import is reused, never changed.
* Only records the import created itself (stamped with the import user in
  ``created_by``) are matched by name alone or have blanks filled in. A same
  name across a pre-existing record and a legacy one is not assumed to be the
  same person.
* Everything the import creates is stamped with the import user, which is what
  lets ``rollback`` remove exactly those records.
"""

from collections import Counter
from difflib import SequenceMatcher
from typing import Dict, List, Optional, Tuple

from django.contrib.auth import get_user_model

from defendants.models import Defendant
from defendants.validators import is_placeholder_name
from police.models import PoliceOfficer, PoliceStation

from .names import normalise_badge, person_key, place_key, split_full_name

User = get_user_model()

IMPORT_USER_EMAIL = "legacy-import@system.invalid"

# How alike two spellings of a surname must be to count as the same person when
# their badge numbers agree ("Garby" and "Garfield" yes, "Belwick" and
# "Lanmore" no).
SURNAME_MATCH = 0.75

RANK_BY_TEXT = {
    "constable": PoliceOfficer.SeniorityChoices.CONSTABLE,
    "police constable": PoliceOfficer.SeniorityChoices.POLICE_CONSTABLE,
    "first class constable": PoliceOfficer.SeniorityChoices.FIRST_CLASS_CONSTABLE,
    "senior constable": PoliceOfficer.SeniorityChoices.SENIOR_CONSTABLE,
    "detective": PoliceOfficer.SeniorityChoices.DETECTIVE,
    "detective first class constable": (
        PoliceOfficer.SeniorityChoices.DETECTIVE_FIRST_CLASS_CONSTABLE
    ),
    "detective senior constable": (
        PoliceOfficer.SeniorityChoices.DETECTIVE_SENIOR_CONSTABLE
    ),
    "senior detective": PoliceOfficer.SeniorityChoices.SENIOR_DETECTIVE,
    "sergeant": PoliceOfficer.SeniorityChoices.SERGEANT,
    "inspector": PoliceOfficer.SeniorityChoices.INSPECTOR,
}
# "Sworn Officer" and "Unsworn Officer" describe the role on a certificate, not
# a rank, so they are stored as no rank.
NOT_RANKS = {"", "sworn officer", "unsworn officer"}


def rank_choice(rank_text: Optional[str]) -> str:
    text = (rank_text or "").strip().lower()
    if text in NOT_RANKS or text.split(" ", 1)[0] in ("sworn", "unsworn"):
        return PoliceOfficer.NO_RANK
    return RANK_BY_TEXT.get(text, PoliceOfficer.SeniorityChoices.OTHER)


def get_import_user():
    """The inactive system account every imported record is attributed to."""
    user, created = User.objects.get_or_create(
        email=IMPORT_USER_EMAIL,
        defaults={
            "given_names": "Legacy",
            "last_name": "Import",
            "role": User.RoleChoices.NONE,
            "is_active": False,
            "is_legacy": True,
        },
    )
    if created:
        user.set_unusable_password()
        user.save(update_fields=["password"])
    return user


class BotanistResolver:
    """Match a source botanist name to a user, or create an inactive legacy one."""

    def __init__(self, import_user) -> None:
        self.import_user = import_user
        self.stats: Counter = Counter()
        self._index: Dict[str, List] = {}
        for user in User.objects.exclude(pk=import_user.pk):
            self._index.setdefault(
                person_key(user.given_names, user.last_name), []
            ).append(user)

    def resolve(self, name: str):
        given, last = split_full_name(name)
        key = person_key(given, last)
        if not key:
            return None
        candidates = self._index.get(key, [])
        live = [u for u in candidates if u.is_active and not u.is_legacy]
        chosen = (live or candidates or [None])[0]
        if chosen is not None:
            self.stats["botanists reused"] += 1
            return chosen
        slug = ".".join(f"{given} {last}".lower().split())
        user = User.objects.create(
            email=f"legacy.{slug}@dbca.wa.gov.au",
            given_names=given or None,
            last_name=last or None,
            role=User.RoleChoices.BOTANIST,
            is_active=False,
            is_legacy=True,
        )
        user.set_unusable_password()
        user.save(update_fields=["password"])
        self._index.setdefault(key, []).append(user)
        self.stats["botanists created"] += 1
        return user


class StationResolver:
    def __init__(self, import_user) -> None:
        self.import_user = import_user
        self.stats: Counter = Counter()
        self._index = {place_key(s.name): s for s in PoliceStation.objects.all()}

    def resolve(self, name: Optional[str]) -> Optional[PoliceStation]:
        key = place_key(name)
        if not key:
            return None
        station = self._index.get(key)
        if station is not None:
            self.stats["stations reused"] += 1
            return station
        station = PoliceStation.objects.create(
            name=name.strip(), created_by=self.import_user
        )
        self._index[key] = station
        self.stats["stations created"] += 1
        return station


class OfficerResolver:
    def __init__(self, import_user) -> None:
        self.import_user = import_user
        self.stats: Counter = Counter()
        self._by_badge: Dict[str, List[PoliceOfficer]] = {}
        self._by_name: Dict[Tuple[str, str], List[PoliceOfficer]] = {}
        for officer in PoliceOfficer.objects.all():
            badge = normalise_badge(officer.badge_number)
            if badge:
                self._by_badge.setdefault(badge, []).append(officer)
            if officer.created_by_id == import_user.pk:
                self._index_name(officer)

    def _index_name(self, officer: PoliceOfficer) -> None:
        key = (
            (officer.given_names or "").casefold(),
            (officer.last_name or "").casefold(),
        )
        self._by_name.setdefault(key, []).append(officer)

    @staticmethod
    def _same_surname(officer: PoliceOfficer, last: str) -> bool:
        """True when either side has no surname or the two are spelled alike."""
        if not last or not officer.last_name:
            return True
        return (
            SequenceMatcher(None, officer.last_name.casefold(), last.casefold()).ratio()
            >= SURNAME_MATCH
        )

    def _is_ours(self, officer: PoliceOfficer) -> bool:
        return officer.created_by_id == self.import_user.pk

    def _fill_blanks(self, officer, given, last, badge, rank, station) -> None:
        changed = []
        for field, value in (
            ("given_names", given),
            ("last_name", last),
            ("badge_number", badge),
            ("rank", rank),
            ("station", station),
        ):
            if value and not getattr(officer, field):
                setattr(officer, field, value)
                changed.append(field)
        if changed:
            officer.save(update_fields=changed)

    def resolve(self, data: Dict, station: Optional[PoliceStation]):
        name = (data.get("name") or "").strip()
        badge = normalise_badge(data.get("badge_id"))
        if not name and not badge:
            return None
        given, last = split_full_name(name)
        rank = rank_choice(data.get("rank"))

        # The same badge under a different surname is recorded as written (for
        # example after a name change); the Merge tool can join them later.
        officer = next(
            (o for o in self._by_badge.get(badge, []) if self._same_surname(o, last)),
            None,
        )
        if officer is None and (given or last):
            for candidate in self._by_name.get((given.casefold(), last.casefold()), []):
                same_place = (
                    station is None
                    or candidate.station_id is None
                    or candidate.station_id == station.pk
                )
                no_badge_clash = not badge or not candidate.badge_number
                if same_place and no_badge_clash:
                    officer = candidate
                    break
        if officer is not None:
            self.stats["officers reused"] += 1
            if self._is_ours(officer):
                self._fill_blanks(officer, given, last, badge, rank, station)
                if badge and officer not in self._by_badge.setdefault(badge, []):
                    self._by_badge[badge].append(officer)
            return officer

        officer = PoliceOfficer.objects.create(
            badge_number=badge or None,
            given_names=given or None,
            last_name=last or None,
            rank=rank,
            station=station,
            created_by=self.import_user,
        )
        if badge:
            self._by_badge.setdefault(badge, []).append(officer)
        self._index_name(officer)
        self.stats["officers created"] += 1
        return officer


class DefendantResolver:
    def __init__(self, import_user) -> None:
        self.import_user = import_user
        self.stats: Counter = Counter()
        self._index: Dict[Tuple[str, str], Defendant] = {}
        for defendant in Defendant.objects.filter(created_by=import_user):
            self._index[self._key(defendant.given_names, defendant.last_name)] = (
                defendant
            )

    @staticmethod
    def _key(given: Optional[str], last: Optional[str]) -> Tuple[str, str]:
        return ((given or "").strip().casefold(), (last or "").strip().casefold())

    def resolve(self, given: Optional[str], last: Optional[str]):
        if not last and not given:
            return None
        if not last:
            given, last = None, given
        if is_placeholder_name(given) or is_placeholder_name(last):
            self.stats["placeholder defendants skipped"] += 1
            return None
        key = self._key(given, last)
        defendant = self._index.get(key)
        if defendant is not None:
            self.stats["defendants reused"] += 1
            return defendant
        defendant = Defendant.objects.create(
            given_names=given or None,
            last_name=last,
            created_by=self.import_user,
        )
        self._index[key] = defendant
        self.stats["defendants created"] += 1
        return defendant
