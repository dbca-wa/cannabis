"""Certificate wording: Section B, the automatic Section C lines and officers.

Every sentence the certificate prints from structured data lives here, so the
wording can be read, changed and tested in one place. Nothing in this module
touches the database: callers pass plain values in, which lets the tests cover
every combination a form can produce.

The live preview mirrors this module in
``frontend/src/features/cases/utils/certificateWording.ts``. The fixture written
by ``manage.py build_certificate_wording_fixture`` holds the expected output for
every combination, and both test suites check their code against it, so the
two cannot drift apart unnoticed.
"""

import re
from dataclasses import dataclass
from typing import Optional, Sequence

from common.utils import join_with_and

# Bump whenever printed wording changes. Certificates generated with an older
# version are flagged as needing regeneration.
CERTIFICATE_WORDING_VERSION = 2

CANNABIS = "cannabis_sativa"
NOT_CANNABIS = "not_cannabis"
DEGRADED = "degraded"
INCONCLUSIVE = "inconclusive"

# The only results that may print on a certificate.
PRINTABLE_DETERMINATIONS = (CANNABIS, NOT_CANNABIS, DEGRADED, INCONCLUSIVE)

SPECIES = "Cannabis sativa"

# Section C line for each bag Section B does not describe: "Bag <tag> <phrase>."
BAG_LINE_PHRASES = {
    NOT_CANNABIS: "did not contain Cannabis",
    DEGRADED: "was too degraded and could not be identified",
    INCONCLUSIVE: "was inconclusive",
}

FEMALE_PHRASE = "contained female plants"
ALL_FEMALE_LINE = f"All bags {FEMALE_PHRASE}."

# Sentences the system writes into Section C, compared lower-case without a
# trailing full stop. A note line matching one is superseded (see
# compose_section_c).
SYSTEM_SENTENCE = re.compile(
    r"^(?:bags? \S.* (?:"
    + "|".join(re.escape(phrase.lower()) for phrase in BAG_LINE_PHRASES.values())
    + "|"
    + re.escape(FEMALE_PHRASE)
    + r")|all bags "
    + re.escape(FEMALE_PHRASE)
    + r")$"
)

MIXED_NOT_CANNABIS = "mixed_not_cannabis"

# Section B wording as (prefix, italic, suffix), for one bag and for several.
# Only the species name is italicised.
SECTION_B_WORDING = {
    CANNABIS: {
        "one": ("I identified the item as ", SPECIES, "."),
        "many": ("I identified the items as ", SPECIES, "."),
    },
    NOT_CANNABIS: {
        "one": ("The item did not contain Cannabis.", "", ""),
        "many": ("The items did not contain Cannabis.", "", ""),
    },
    DEGRADED: {
        "one": ("The item was too degraded and could not be identified.", "", ""),
        "many": ("The items were too degraded and could not be identified.", "", ""),
    },
    INCONCLUSIVE: {
        "one": ("The item was inconclusive.", "", ""),
        "many": ("The items were inconclusive.", "", ""),
    },
    MIXED_NOT_CANNABIS: {
        "one": ("No item could be identified as ", SPECIES, "."),
        "many": ("No item could be identified as ", SPECIES, "."),
    },
}

CONVEYING = "conveying"
REQUESTING = "requesting"
UNSWORN_LABEL = "Unsworn Officer"
SWORN_LABEL = "Sworn Officer"

# Rank values that are not a real police rank, so they never replace the label.
UNRECORDED_RANKS = frozenset({"unknown", "other", "sworn_officer", "unsworn_officer"})

PENDING = "[Pending]"


@dataclass(frozen=True)
class SectionB:
    """The Section B result sentence, split so only ``italic`` is italicised."""

    key: str
    prefix: str
    italic: str
    suffix: str

    @property
    def text(self) -> str:
        return f"{self.prefix}{self.italic}{self.suffix}"


@dataclass(frozen=True)
class Results:
    section_b: SectionB
    bag_lines: tuple[str, ...]


@dataclass(frozen=True)
class OfficerFacts:
    """The officer details the certificate prints, as plain values."""

    badge_number: str = ""
    last_name: str = ""
    given_names: str = ""
    rank: str = ""
    rank_display: str = ""
    station_name: str = ""


def bag_line(tag: str, determination: str) -> str:
    """The Section C line for one bag, e.g. "Bag T1234 was inconclusive."."""
    return f"Bag {tag} {BAG_LINE_PHRASES[determination]}."


def summarise(bags: Sequence[tuple[str, str]]) -> Results:
    """Work out Section B and the automatic Section C lines for a form.

    Args:
        bags: ``(original tag, determination)`` for each bag, in form order.
            Every determination must be printable; see ``unprintable_bags``.

    Rules:
        - Any Cannabis sativa bag: the cannabis sentence, and a line for every
          other bag.
        - No cannabis, one shared result: that result's sentence, no lines.
        - No cannabis, differing results: "No item could be identified as
          Cannabis sativa.", and a line for every bag.
    """
    if not bags:
        raise ValueError("A certificate needs at least one bag.")
    unknown = [d for _, d in bags if d not in PRINTABLE_DETERMINATIONS]
    if unknown:
        raise ValueError(f"Unprintable results: {unknown}")

    results = [determination for _, determination in bags]
    if CANNABIS in results:
        key = CANNABIS
        listed = [(tag, d) for tag, d in bags if d != CANNABIS]
    elif len(set(results)) == 1:
        key = results[0]
        listed = []
    else:
        key = MIXED_NOT_CANNABIS
        listed = list(bags)

    number = "one" if len(bags) == 1 else "many"
    prefix, italic, suffix = SECTION_B_WORDING[key][number]
    return Results(
        section_b=SectionB(key=key, prefix=prefix, italic=italic, suffix=suffix),
        bag_lines=tuple(bag_line(tag, d) for tag, d in listed),
    )


def female_plant_line(bags: Sequence[tuple[str, str, bool]]) -> Optional[str]:
    """The Section C female plant sentence for a form, or None.

    Args:
        bags: ``(original tag, determination, contains female plants)`` for
            each bag, in form order. Only Cannabis sativa bags count.

    Reads "All bags contained female plants." when every bag on a form of two
    or more does; otherwise names them, e.g. "Bags T1 and T3 contained female
    plants." or "Bag T2 contained female plants.".
    """
    tags = [
        tag
        for tag, determination, female in bags
        if female and determination == CANNABIS
    ]
    if not tags:
        return None
    if len(tags) == len(bags) and len(bags) > 1:
        return ALL_FEMALE_LINE
    label = "Bag" if len(tags) == 1 else "Bags"
    return f"{label} {join_with_and(tags)} {FEMALE_PHRASE}."


def _comparable(line: str) -> str:
    text = line.strip().lower()
    return text[:-1] if text.endswith(".") else text


def is_system_sentence(line: str) -> bool:
    """True for a bag result or female plant sentence the system writes.

    Such a sentence typed into the note, or left there by a template, is
    always superseded by the one worked out from the current bags, so a stale
    copy can never contradict the certificate.
    """
    return bool(SYSTEM_SENTENCE.match(_comparable(line)))


def compose_section_c(
    bag_lines: Sequence[str],
    note: Optional[str],
    female_line: Optional[str] = None,
) -> Optional[str]:
    """Join the automatic lines and the botanist's note for Section C.

    Order: the bag result lines, then the botanist's note, then the female
    plant sentence. Any note line that is itself a bag result or female plant
    sentence (ignoring case, surrounding spaces and a trailing full stop) is
    dropped, because the system writes those from the current bags. Returns
    None when there is nothing to print, which the template shows as "None".
    """
    note_lines = [
        line.strip()
        for line in (note or "").replace("\r\n", "\n").replace("\r", "\n").split("\n")
    ]
    while note_lines and not note_lines[0]:
        note_lines.pop(0)
    while note_lines and not note_lines[-1]:
        note_lines.pop()

    kept = [line for line in note_lines if not is_system_sentence(line)]
    while kept and not kept[0]:
        kept.pop(0)
    while kept and not kept[-1]:
        kept.pop()

    lines = list(bag_lines) + kept + ([female_line] if female_line else [])
    return "\n".join(lines) if lines else None


def has_recorded_rank(rank: str) -> bool:
    """True when the rank is a real police rank rather than a placeholder."""
    return bool(rank) and rank not in UNRECORDED_RANKS


def format_officer(
    officer: Optional[OfficerFacts],
    *,
    role: str,
    print_station: bool,
    print_rank: bool = False,
) -> str:
    """Format an officer as the certificate names them.

    ``<label> <badge> <SURNAME>, <Given names>[ of <station>]``

    The conveying officer is always "Unsworn Officer". The requesting officer is
    "Sworn Officer", or their rank when ``print_rank`` is set and they have one
    on record. The station is added only when ``print_station`` is set and the
    officer has one. Missing parts are left out.
    """
    if officer is None:
        return PENDING
    if role == CONVEYING:
        label = UNSWORN_LABEL
    elif role == REQUESTING:
        label = (
            officer.rank_display
            if print_rank and has_recorded_rank(officer.rank) and officer.rank_display
            else SWORN_LABEL
        )
    else:
        raise ValueError(f"Unknown officer role: {role}")

    parts = [label]
    if officer.badge_number:
        parts.append(officer.badge_number)
    if officer.last_name:
        parts.append(officer.last_name.upper())
    text = " ".join(parts)
    if officer.given_names:
        text += f", {officer.given_names}"
    if print_station and officer.station_name:
        text += f" of {officer.station_name}"
    return text


def officer_facts(officer) -> Optional[OfficerFacts]:
    """Read the printed details from a PoliceOfficer, or None for no officer."""
    if officer is None:
        return None
    station = getattr(officer, "station", None)
    return OfficerFacts(
        badge_number=officer.badge_number or "",
        last_name=officer.last_name or "",
        given_names=officer.given_names or "",
        rank=officer.rank or "",
        rank_display=officer.get_rank_display() if officer.rank else "",
        station_name=station.name if station else "",
    )


def unprintable_bags(bags: Sequence[tuple[str, Optional[str]]]) -> list:
    """The ``(tag, determination)`` pairs whose result cannot be printed.

    Covers bags with no assessment (``None``), pending assessments and results
    kept only for legacy records.
    """
    return [(tag, d) for tag, d in bags if d not in PRINTABLE_DETERMINATIONS]
