"""Write the certificate wording fixture shared by the backend and frontend tests.

The fixture holds the expected certificate text for every combination a form
can produce: every ordered sequence of the four results for one to five bags,
every Section C composition case and every pairing of officer options. The
Python tests check the fixture is current; the frontend tests check the live
preview's TypeScript wording against every entry.

Run after any wording change:

    poetry run python manage.py build_certificate_wording_fixture
"""

import itertools
import json
from dataclasses import asdict
from pathlib import Path

from django.core.management.base import BaseCommand

from cases.services import certificate_wording as wording
from police.models import PoliceOfficer

FIXTURE_PATH = (
    Path(__file__).resolve().parents[2]
    / "tests"
    / "fixtures"
    / "certificate_wording.json"
)

MAX_BAGS = 5

# Section C note variants, each combined with 0 to 5 automatic lines.
NOTE_VARIANTS = (
    None,
    "",
    "   ",
    "Subsamples placed into Security Movement Envelope WW00564835.",
    "Line one.\nLine two.",
    "Line one.\r\nLine two.\r\n",
    "  bag T1 did not contain cannabis  \n\nBags T2 and T3 contained female plants.",
    # A stale template note: both sentences are superseded by the current bags.
    "Subsamples placed into Security Movement Envelope WW1.\n"
    "Bag T9 was inconclusive.\nAll bags contained female plants.",
    # Similar but not system sentences, so they are kept.
    "Bag T1 was inconclusive due to mould on the sample.\n"
    "Female plants were noted on arrival.",
    # An envelope in other words is kept; one in the system's words, in any
    # case, is superseded only when the form has an envelope.
    "Subsamples transferred to Security Movement Envelope WW3.\n"
    "subsamples placed into security movement envelope ww4",
    # A grouped result line is a system sentence too, so it is superseded.
    "Bags T1 and T2 were inconclusive.\nKept note.",
)

# The automatic female plant sentence, absent or present.
FEMALE_LINES = (None, "Bag T1 contained female plants.")

# The form's security movement envelope: none, a plain value, and one with
# stray spaces.
ENVELOPES = (None, "WW00564835", "  WW2  ")

# Female plant cases cover every result and flag for one to three bags.
FEMALE_MAX_BAGS = 3

STATIONS = ("", "Midland Police Station")


def result_cases():
    """Every ordered result sequence for one to five bags."""
    cases = []
    for count in range(1, MAX_BAGS + 1):
        for sequence in itertools.product(
            wording.PRINTABLE_DETERMINATIONS, repeat=count
        ):
            bags = [(f"T{i + 1}", d) for i, d in enumerate(sequence)]
            results = wording.summarise(bags)
            section_b = results.section_b
            cases.append(
                {
                    "bags": list(sequence),
                    "section_b": {
                        "key": section_b.key,
                        "prefix": section_b.prefix,
                        "italic": section_b.italic,
                        "suffix": section_b.suffix,
                    },
                    "bag_lines": list(results.bag_lines),
                }
            )
    return cases


def section_c_cases():
    """Every count of automatic lines combined with every note variant."""
    cases = []
    for count in range(0, MAX_BAGS + 1):
        lines = [
            wording.bag_line(f"T{i + 1}", wording.NOT_CANNABIS) for i in range(count)
        ]
        for note, female_line, envelope in itertools.product(
            NOTE_VARIANTS, FEMALE_LINES, ENVELOPES
        ):
            cases.append(
                {
                    "bag_lines": lines,
                    "note": note,
                    "female_line": female_line,
                    "envelope": envelope,
                    "expected": wording.compose_section_c(
                        lines, note, female_line, wording.sme_line(envelope)
                    ),
                }
            )
    return cases


def female_cases():
    """Every result and female flag sequence for one to three bags."""
    states = [
        (determination, female)
        for determination in wording.PRINTABLE_DETERMINATIONS
        for female in (False, True)
    ]
    cases = []
    for count in range(1, FEMALE_MAX_BAGS + 1):
        for sequence in itertools.product(states, repeat=count):
            bags = [(f"T{i + 1}", d, f) for i, (d, f) in enumerate(sequence)]
            cases.append(
                {
                    "bags": [[d, f] for d, f in sequence],
                    "expected": wording.female_plant_line(bags),
                }
            )
    return cases


# Every rank an officer can hold, starting with none recorded (blank).
RANKS = [PoliceOfficer.NO_RANK, *PoliceOfficer.SeniorityChoices.values]


def _rank_display(rank):
    return PoliceOfficer.SeniorityChoices(rank).label if rank else ""


def _facts(station, rank):
    return wording.OfficerFacts(
        badge_number="PD17432",
        last_name="Barns",
        given_names="Tahlia",
        rank=rank,
        rank_display=_rank_display(rank),
        station_name=station,
    )


def _facts_dict(facts):
    return None if facts is None else asdict(facts)


def officer_cases():
    """Every pairing of conveying and requesting officer options.

    Conveying: station on record or not, by station option on or off. The
    conveying officer holds a real rank so the tests prove it is never printed.
    Requesting: no officer, or every combination of station on record, station
    option, each rank, and rank option.
    """
    conveying_options = [
        (_facts(station, "senior_constable"), print_station)
        for station in STATIONS
        for print_station in (True, False)
    ]
    requesting_options = [(None, True, False)] + [
        (_facts(station, rank), print_station, print_rank)
        for station in STATIONS
        for print_station in (True, False)
        for rank in RANKS
        for print_rank in (True, False)
    ]
    cases = []
    for conveying, conveying_station in conveying_options:
        for requesting, requesting_station, requesting_rank in requesting_options:
            cases.append(
                {
                    "conveying": _facts_dict(conveying),
                    "print_conveying_station": conveying_station,
                    "requesting": _facts_dict(requesting),
                    "print_requesting_station": requesting_station,
                    "print_requesting_rank": requesting_rank,
                    "expected_conveying": wording.format_officer(
                        conveying,
                        role=wording.CONVEYING,
                        print_station=conveying_station,
                    ),
                    "expected_requesting": (
                        wording.format_officer(
                            requesting,
                            role=wording.REQUESTING,
                            print_station=requesting_station,
                            print_rank=requesting_rank,
                        )
                        if requesting
                        else None
                    ),
                }
            )
    return cases


def build_fixture():
    return {
        "wording_version": wording.CERTIFICATE_WORDING_VERSION,
        "results": result_cases(),
        "section_c": section_c_cases(),
        "female": female_cases(),
        "officers": officer_cases(),
    }


def render_fixture(fixture):
    """Serialise with one entry per line so wording changes diff readably."""
    out = ["{", f'"wording_version": {fixture["wording_version"]},']
    keys = ["results", "section_c", "female", "officers"]
    for index, key in enumerate(keys):
        entries = fixture[key]
        out.append(f'"{key}": [')
        for i, entry in enumerate(entries):
            comma = "," if i < len(entries) - 1 else ""
            out.append(json.dumps(entry, ensure_ascii=False, sort_keys=True) + comma)
        out.append("]" + ("," if index < len(keys) - 1 else ""))
    out.append("}")
    return "\n".join(out) + "\n"


class Command(BaseCommand):
    help = (
        "Write the certificate wording fixture used by the backend and frontend tests."
    )

    def handle(self, *args, **options):
        fixture = build_fixture()
        FIXTURE_PATH.parent.mkdir(parents=True, exist_ok=True)
        FIXTURE_PATH.write_text(render_fixture(fixture), encoding="utf-8")
        counts = ", ".join(
            f"{len(fixture[k])} {k}"
            for k in ("results", "section_c", "female", "officers")
        )
        self.stdout.write(f"Wrote {FIXTURE_PATH} ({counts})")
