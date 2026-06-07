"""Entity matching against database records using trigram similarity."""

import logging
import re

from django.contrib.postgres.search import TrigramSimilarity
from django.db.models import Value
from django.db.models.functions import Concat

from cases.ocr import MatchCandidate, MatchResult
from defendants.models import Defendant
from police.models import PoliceOfficer, PoliceStation

logger = logging.getLogger(__name__)

# Minimum similarity threshold for fuzzy matches
MIN_SIMILARITY = 0.2
MAX_CANDIDATES = 5


class EntityMatcher:
    """Matches OCR-extracted text against existing database records."""

    def match_officer(self, badge_number: str | None, name: str | None) -> MatchResult:
        """Match an officer by badge number (exact) or name (fuzzy).

        Tries exact badge number match first. Falls back to trigram
        similarity on the officer's full name if no badge match.
        Returns up to 5 candidates sorted by similarity descending.
        """
        # Exact badge match
        if badge_number:
            clean_badge = badge_number.strip().upper()
            exact = PoliceOfficer.objects.filter(
                badge_number__iexact=clean_badge
            ).first()
            if exact:
                return MatchResult(
                    candidates=[
                        MatchCandidate(
                            id=exact.id,
                            similarity=1.0,
                            display_data={
                                "badge_number": exact.badge_number,
                                "full_name": exact.full_name,
                                "station_name": (
                                    exact.station.name if exact.station else None
                                ),
                            },
                        )
                    ],
                    match_type="exact_badge",
                )

        # Fuzzy name fallback
        if name:
            clean_name = name.strip()
            # Remove "SURNAME, FirstName" comma format for better matching
            search_name = re.sub(r",\s*", " ", clean_name)

            officers = (
                PoliceOfficer.objects.annotate(
                    full=Concat("last_name", Value(" "), "first_name"),
                    similarity=TrigramSimilarity("full", search_name),
                )
                .filter(similarity__gte=MIN_SIMILARITY)
                .order_by("-similarity")[:MAX_CANDIDATES]
            )

            candidates = [
                MatchCandidate(
                    id=o.id,
                    similarity=round(o.similarity, 3),
                    display_data={
                        "badge_number": o.badge_number,
                        "full_name": o.full_name,
                        "station_name": (o.station.name if o.station else None),
                    },
                )
                for o in officers
            ]

            if candidates:
                return MatchResult(candidates=candidates, match_type="fuzzy_name")

        return MatchResult()

    def match_station(self, division_unit: str) -> MatchResult:
        """Match a police station by name using trigram similarity.

        Performs case-insensitive fuzzy matching against station names.
        Returns up to 5 candidates sorted by similarity descending.
        """
        if not division_unit or not division_unit.strip():
            return MatchResult()

        clean = division_unit.strip()
        stations = (
            PoliceStation.objects.annotate(
                similarity=TrigramSimilarity("name", clean),
            )
            .filter(similarity__gte=MIN_SIMILARITY)
            .order_by("-similarity")[:MAX_CANDIDATES]
        )

        candidates = [
            MatchCandidate(
                id=s.id,
                similarity=round(s.similarity, 3),
                display_data={"name": s.name},
            )
            for s in stations
        ]

        if candidates:
            return MatchResult(candidates=candidates, match_type="fuzzy_name")
        return MatchResult()

    def match_defendant(self, defendant_name: str) -> MatchResult:
        """Match a defendant by name using trigram similarity.

        Returns an empty result for "Unknown" or blank names.
        Otherwise performs fuzzy matching against first + last name
        and returns up to 5 candidates sorted by similarity descending.
        """
        if not defendant_name or not defendant_name.strip():
            return MatchResult()

        clean = defendant_name.strip()
        if clean.lower() == "unknown":
            return MatchResult()

        # Normalise "SURNAME, FirstName" to "FirstName SURNAME"
        parts = [p.strip() for p in clean.split(",", 1)]
        if len(parts) == 2:
            search_name = f"{parts[1]} {parts[0]}"
        else:
            search_name = clean

        defendants = (
            Defendant.objects.annotate(
                full=Concat("first_name", Value(" "), "last_name"),
                similarity=TrigramSimilarity("full", search_name),
            )
            .filter(similarity__gte=MIN_SIMILARITY)
            .order_by("-similarity")[:MAX_CANDIDATES]
        )

        candidates = [
            MatchCandidate(
                id=d.id,
                similarity=round(d.similarity, 3),
                display_data={
                    "first_name": d.first_name,
                    "last_name": d.last_name,
                    "full_name": d.full_name,
                },
            )
            for d in defendants
        ]

        if candidates:
            return MatchResult(candidates=candidates, match_type="fuzzy_name")
        return MatchResult()
