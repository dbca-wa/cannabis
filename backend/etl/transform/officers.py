"""Repairs for the parsed police officers of a legacy certificate.

The police officer domain reads the common layouts correctly but mishandles a
few older ones: a role word left in the name ("Officer Bexana GARFIELD"), a rank
split across the rank and name fields ("First" and "Class Constable Clementine"),
and a badge number written after the name that is not picked up. These
repairs are checked against the source text, so they only ever move words
between fields or add a badge the source states.
"""

import json
import re
from typing import Any, Dict, Tuple

BEHALF = re.compile(r"\s+on\s+be[a-z]*\s+of\s*[-:.]*\s*", re.IGNORECASE)
BADGE = re.compile(r"(?:\bPD\s*)?0*(\d{4,6})\b", re.IGNORECASE)
STATION_TAIL = re.compile(r"\s+of\s+.*$", re.IGNORECASE)

# Words that describe the officer's role or rank and are never part of a name.
ROLE_WORDS = {"officer", "officer-", "sworn", "unsworn", "conveying", "-"}
RANK_WORDS = {
    "constable": "Constable",
    "pc": "Police Constable",
    "p/c": "Police Constable",
}
# A rank the domain cut short, with what follows it in the name field.
PARTIAL_RANKS = {
    "first": ("class", "constable"),
    "senior": ("constable",),
    "police": ("constable",),
}


def _split_raw(raw: str) -> Tuple[str, str]:
    parts = BEHALF.split((raw or "").strip(), maxsplit=1)
    return parts[0], parts[1] if len(parts) > 1 else ""


def _badge_in(text: str) -> str:
    match = BADGE.search(STATION_TAIL.sub("", text))
    return f"PD{match.group(1)}" if match else ""


def _repair_one(officer: Dict[str, str], raw_part: str) -> Dict[str, str]:
    name_words = (officer.get("name") or "").split()
    rank = officer.get("rank") or ""

    while name_words and name_words[0].lower() in ROLE_WORDS:
        name_words.pop(0)

    follow = PARTIAL_RANKS.get(rank.lower())
    if follow and [w.lower() for w in name_words[: len(follow)]] == list(follow):
        rank = " ".join([rank] + name_words[: len(follow)])
        name_words = name_words[len(follow) :]

    if name_words and name_words[0].lower() in RANK_WORDS:
        if rank.lower() in ("", "sworn officer", "unsworn officer"):
            rank = RANK_WORDS[name_words[0].lower()]
        name_words = name_words[1:]

    badge = officer.get("badge_id") or (_badge_in(raw_part) if name_words else "")
    return {"name": " ".join(name_words), "rank": rank, "badge_id": badge}


def repair_officers(parsed: Any, raw_cell: str) -> Dict[str, Any]:
    """The officer data with the defects above repaired, as a plain dict."""
    if isinstance(parsed, str):
        parsed = json.loads(parsed)
    parsed = dict(parsed or {})
    parsed.pop("processing_notes", None)
    submitting_raw, requesting_raw = _split_raw(raw_cell)
    for key, raw_part in (
        ("submitting_officer", submitting_raw),
        ("requesting_officer", requesting_raw),
    ):
        officer = parsed.get(key) or {}
        if officer.get("name") or officer.get("badge_id"):
            parsed[key] = _repair_one(officer, raw_part)
    return parsed


def has_officer(parsed: Dict[str, Any]) -> bool:
    return any(
        (parsed.get(key) or {}).get("name") or (parsed.get(key) or {}).get("badge_id")
        for key in ("submitting_officer", "requesting_officer")
    )
