"""Certificate wording for every combination a form can produce.

These tests need no database: the wording module takes plain values. Every
ordered sequence of the four results for one to five bags is checked against
the rules John approved, every Section C composition case against the "None"
and ordering rules, and every officer option pairing against the officer rules.
"""

import itertools
import json

import pytest

from cases.management.commands import build_certificate_wording_fixture as fixture
from cases.services import certificate_wording as wording
from police.models import PoliceOfficer

S, N, D, I = (  # noqa: E741
    wording.CANNABIS,
    wording.NOT_CANNABIS,
    wording.DEGRADED,
    wording.INCONCLUSIVE,
)

ALL_SEQUENCES = [
    sequence
    for count in range(1, 6)
    for sequence in itertools.product(wording.PRINTABLE_DETERMINATIONS, repeat=count)
]


def _bags(sequence):
    return [(f"T{i + 1}", d) for i, d in enumerate(sequence)]


class TestEveryResultSequence:
    def test_there_are_1364_sequences(self):
        assert len(ALL_SEQUENCES) == 4 + 16 + 64 + 256 + 1024 == 1364

    @pytest.mark.parametrize(
        "sequence", ALL_SEQUENCES, ids=lambda s: "-".join(x[:3] for x in s)
    )
    def test_section_b_and_lines_follow_the_rules(self, sequence):
        bags = _bags(sequence)
        results = wording.summarise(bags)
        section_b = results.section_b
        number = "one" if len(sequence) == 1 else "many"

        if S in sequence:
            expected_key = S
            expected_listed = [(t, d) for t, d in bags if d != S]
        elif len(set(sequence)) == 1:
            expected_key = sequence[0]
            expected_listed = []
        else:
            expected_key = wording.MIXED_NOT_CANNABIS
            expected_listed = bags

        assert section_b.key == expected_key
        assert (section_b.prefix, section_b.italic, section_b.suffix) == (
            wording.SECTION_B_WORDING[expected_key][number]
        )
        assert results.bag_lines == tuple(
            f"Bag {t} {wording.BAG_LINE_PHRASES[d]}." for t, d in expected_listed
        )
        # A cannabis bag is never listed; the lines keep the bags' order.
        assert not any("Cannabis sativa" in line for line in results.bag_lines)
        # Only the species name is ever italicised.
        assert section_b.italic in ("", wording.SPECIES)
        assert ("Cannabis sativa" in section_b.text) == bool(section_b.italic)


class TestSectionBWording:
    @pytest.mark.parametrize(
        "sequence,text",
        [
            ((S,), "I identified the item as Cannabis sativa."),
            ((S, S), "I identified the items as Cannabis sativa."),
            ((S, I, N), "I identified the items as Cannabis sativa."),
            ((N,), "The item did not contain Cannabis."),
            ((N, N), "The items did not contain Cannabis."),
            ((D,), "The item was too degraded and could not be identified."),
            ((D, D, D), "The items were too degraded and could not be identified."),
            ((I,), "The item was inconclusive."),
            ((I, I), "The items were inconclusive."),
            ((N, I), "No item could be identified as Cannabis sativa."),
            ((N, N, I), "No item could be identified as Cannabis sativa."),
            ((N, D, I), "No item could be identified as Cannabis sativa."),
        ],
    )
    def test_reads_as_approved(self, sequence, text):
        assert wording.summarise(_bags(sequence)).section_b.text == text

    def test_johns_example_lines(self):
        results = wording.summarise(
            [("1000", S), ("1234", N), ("1245", D), ("9045", I)]
        )
        assert results.bag_lines == (
            "Bag 1234 did not contain Cannabis.",
            "Bag 1245 was too degraded and could not be identified.",
            "Bag 9045 was inconclusive.",
        )

    def test_mixed_non_cannabis_lists_every_bag(self):
        results = wording.summarise([("A", N), ("B", N), ("C", I)])
        assert results.bag_lines == (
            "Bag A did not contain Cannabis.",
            "Bag B did not contain Cannabis.",
            "Bag C was inconclusive.",
        )

    @pytest.mark.parametrize("value", [None, "pending", "mixed", "unidentifiable"])
    def test_refuses_unprintable_results(self, value):
        with pytest.raises(ValueError):
            wording.summarise([("T1", S), ("T2", value)])

    def test_refuses_no_bags(self):
        with pytest.raises(ValueError):
            wording.summarise([])

    @pytest.mark.parametrize(
        "value",
        [None, "", "pending", "mixed", "cannabis_indica", "cannabis_hybrid"]
        + ["papaver_somniferum", "unidentifiable"],
    )
    def test_unprintable_bags_finds_each_unprintable_result(self, value):
        bags = [("T1", S), ("T2", value), ("T3", I)]
        assert wording.unprintable_bags(bags) == [("T2", value)]

    def test_printable_bags_pass(self):
        assert wording.unprintable_bags(_bags((S, N, D, I))) == []


def _lines(count):
    return [wording.bag_line(f"T{i + 1}", N) for i in range(count)]


class TestSectionCComposition:
    @pytest.mark.parametrize("count", range(0, 6))
    @pytest.mark.parametrize("note", fixture.NOTE_VARIANTS)
    @pytest.mark.parametrize("female_line", fixture.FEMALE_LINES)
    @pytest.mark.parametrize("envelope", fixture.ENVELOPES)
    def test_every_line_count_with_every_note(self, count, note, female_line, envelope):
        lines = _lines(count)
        envelope_line = wording.sme_line(envelope)
        composed = wording.compose_section_c(lines, note, female_line, envelope_line)

        # Note lines the system does not write itself.
        note_lines = [
            line.strip()
            for line in (note or "").replace("\r\n", "\n").split("\n")
            if line.strip()
            and not wording.is_system_sentence(line)
            and not (envelope_line and wording.is_sme_sentence(line))
        ]
        if not lines and not envelope_line and not note_lines and not female_line:
            assert composed is None
            return
        assert composed is not None
        printed = composed.split("\n")
        # The bag result lines come first, in order, then the envelope line;
        # the female line is last.
        assert printed[: len(lines)] == lines
        if envelope_line:
            assert printed[len(lines)] == envelope_line
            lines = [*lines, envelope_line]
        middle = printed[len(lines) : len(printed) - (1 if female_line else 0)]
        if female_line:
            assert printed[-1] == female_line
        # Everything between is the botanist's own note, in its order, with no
        # system sentence left in it.
        assert [line for line in middle if line] == note_lines
        assert not any(wording.is_system_sentence(line) for line in middle if line)
        # Nothing prints twice, and no line carries stray spaces or "\r".
        non_blank = [line for line in printed if line]
        assert len({line.lower().rstrip(".") for line in non_blank}) == len(non_blank)
        assert all(line == line.strip() and "\r" not in line for line in printed)
        assert printed[0] and printed[-1]

    @pytest.mark.parametrize("note", [None, "", "   ", "\n\n", " \r\n "])
    def test_none_only_when_nothing_to_print(self, note):
        assert wording.compose_section_c([], note) is None
        assert wording.compose_section_c(_lines(1), note) == _lines(1)[0]

    def test_note_follows_the_automatic_lines(self):
        composed = wording.compose_section_c(
            ["Bag T2 was inconclusive."], "Subsamples placed into SME WW1."
        )
        assert composed == "Bag T2 was inconclusive.\nSubsamples placed into SME WW1."

    @pytest.mark.parametrize(
        "typed",
        [
            "Bag T2 was inconclusive.",
            "bag t2 was inconclusive",
            "  BAG T2 WAS INCONCLUSIVE.  ",
        ],
    )
    def test_a_typed_duplicate_prints_once(self, typed):
        composed = wording.compose_section_c(
            ["Bag T2 was inconclusive."], f"{typed}\nSME WW1."
        )
        assert composed == "Bag T2 was inconclusive.\nSME WW1."

    def test_stale_template_sentences_are_replaced(self):
        """A note left over from a template never contradicts the bags."""
        composed = wording.compose_section_c(
            ["Bag T2 did not contain Cannabis."],
            "SME WW1.\nBag T3 was inconclusive.\nAll bags contained female plants.",
            "Bag T1 contained female plants.",
        )
        assert composed == (
            "Bag T2 did not contain Cannabis.\nSME WW1.\n"
            "Bag T1 contained female plants."
        )

    @pytest.mark.parametrize(
        "kept",
        [
            "Bag T1 was inconclusive due to mould on the sample.",
            "Female plants were noted on arrival.",
            "Bags arrived damp.",
        ],
    )
    def test_other_bag_notes_are_kept(self, kept):
        assert wording.compose_section_c([], kept) == kept

    def test_interior_blank_lines_in_the_note_are_kept(self):
        composed = wording.compose_section_c([], "One.\n\nTwo.")
        assert composed == "One.\n\nTwo."


class TestEnvelopeLine:
    @pytest.mark.parametrize(
        "envelope,expected",
        [
            ("WW00564835", "WW00564835"),
            ("  WW1  ", "WW1"),
            ("WW1.", "WW1"),
        ],
    )
    def test_names_the_envelope(self, envelope, expected):
        assert wording.sme_line(envelope) == (
            f"Subsamples placed into Security Movement Envelope {expected}."
        )

    @pytest.mark.parametrize("envelope", [None, "", "   "])
    def test_none_without_an_envelope(self, envelope):
        assert wording.sme_line(envelope) is None

    def test_follows_the_bag_lines_and_replaces_a_note_copy(self):
        composed = wording.compose_section_c(
            ["Bag T2 was inconclusive."],
            "Subsamples placed into Security Movement Envelope WW1.\nHanded back.",
            "Bag T1 contained female plants.",
            wording.sme_line("WW9"),
        )
        assert composed == (
            "Bag T2 was inconclusive.\n"
            "Subsamples placed into Security Movement Envelope WW9.\n"
            "Handed back.\n"
            "Bag T1 contained female plants."
        )

    def test_a_note_copy_is_kept_when_the_form_has_no_envelope(self):
        note = "Subsamples placed into Security Movement Envelope WW1."
        assert wording.compose_section_c([], note, None, None) == note

    def test_other_envelope_wording_is_kept(self):
        composed = wording.compose_section_c(
            [],
            "Subsamples transferred to Security Movement Envelope WW1.",
            None,
            wording.sme_line("WW1"),
        )
        assert composed == (
            "Subsamples placed into Security Movement Envelope WW1.\n"
            "Subsamples transferred to Security Movement Envelope WW1."
        )

    @pytest.mark.parametrize(
        "note,expected",
        [
            (
                "Subsamples placed into Security Movement Envelope WW00537475.",
                "WW00537475",
            ),
            (
                "Bag T1 contained female plants.\n"
                "  subsamples placed into security movement envelope WW5  ",
                "WW5",
            ),
            (
                "Subsamples placed into Security Movement Envelope WW1.\n"
                "Subsamples placed into Security Movement Envelope WW1.",
                "WW1",
            ),
            (
                "Subsamples placed into Security Movement Envelope WW1.\n"
                "Subsamples placed into Security Movement Envelope WW2.",
                None,
            ),
            ("Subsamples transferred to Security Movement Envelope WW1.", None),
            (None, None),
        ],
    )
    def test_reads_the_envelope_from_a_note(self, note, expected):
        assert wording.sme_from_note(note) == expected


# No rank recorded (blank) first, then every rank choice.
RANKS = [PoliceOfficer.NO_RANK, *PoliceOfficer.SeniorityChoices.values]
RECORDED = [r for r in RANKS if r and r not in wording.UNRECORDED_RANKS]


def _officer(station="Midland Police Station", rank="senior_constable", **kwargs):
    values = {
        "badge_number": "PD17432",
        "last_name": "Barns",
        "given_names": "Tahlia",
        "rank": rank,
        "rank_display": PoliceOfficer.SeniorityChoices(rank).label if rank else "",
        "station_name": station,
    }
    values.update(kwargs)
    return wording.OfficerFacts(**values)


class TestOfficers:
    def test_ranks_and_placeholders(self):
        # "Sworn Officer" and "Unsworn Officer" are labels the certificate
        # prints by role, not ranks an officer can hold.
        assert "sworn_officer" not in RANKS
        assert "unsworn_officer" not in RANKS
        # Blank, unknown and other are not real ranks; ten are.
        assert len(RANKS) == 13
        assert len(RECORDED) == 10

    @pytest.mark.parametrize("rank", RANKS)
    @pytest.mark.parametrize("station", fixture.STATIONS)
    @pytest.mark.parametrize("print_station", [True, False])
    def test_conveying_is_always_unsworn(self, rank, station, print_station):
        text = wording.format_officer(
            _officer(station=station, rank=rank),
            role=wording.CONVEYING,
            print_station=print_station,
        )
        suffix = " of Midland Police Station" if station and print_station else ""
        assert text == f"Unsworn Officer PD17432 BARNS, Tahlia{suffix}"

    @pytest.mark.parametrize("rank", RANKS)
    @pytest.mark.parametrize("station", fixture.STATIONS)
    @pytest.mark.parametrize("print_station", [True, False])
    @pytest.mark.parametrize("print_rank", [True, False])
    def test_requesting_every_combination(
        self, rank, station, print_station, print_rank
    ):
        text = wording.format_officer(
            _officer(station=station, rank=rank),
            role=wording.REQUESTING,
            print_station=print_station,
            print_rank=print_rank,
        )
        label = (
            PoliceOfficer.SeniorityChoices(rank).label
            if print_rank and rank in RECORDED
            else "Sworn Officer"
        )
        suffix = " of Midland Police Station" if station and print_station else ""
        assert text == f"{label} PD17432 BARNS, Tahlia{suffix}"

    def test_senior_constable_example(self):
        text = wording.format_officer(
            _officer(station="Mandurah District Office"),
            role=wording.REQUESTING,
            print_station=True,
            print_rank=True,
        )
        assert (
            text == "Senior Constable PD17432 BARNS, Tahlia of Mandurah District Office"
        )

    @pytest.mark.parametrize(
        "missing,expected",
        [
            ({"badge_number": ""}, "Sworn Officer BARNS, Tahlia"),
            ({"given_names": ""}, "Sworn Officer PD17432 BARNS"),
            ({"last_name": ""}, "Sworn Officer PD17432, Tahlia"),
            (
                {"badge_number": "", "last_name": "", "given_names": ""},
                "Sworn Officer",
            ),
        ],
    )
    def test_missing_parts_are_left_out(self, missing, expected):
        text = wording.format_officer(
            _officer(station="", **missing),
            role=wording.REQUESTING,
            print_station=True,
        )
        assert text == expected

    def test_no_officer_is_pending(self):
        assert (
            wording.format_officer(None, role=wording.CONVEYING, print_station=True)
            == "[Pending]"
        )


FEMALE_STATES = [
    (determination, female)
    for determination in wording.PRINTABLE_DETERMINATIONS
    for female in (False, True)
]


class TestFemalePlantLine:
    def test_every_result_and_flag_for_one_to_five_bags(self):
        """37,448 sequences, checked against the rule written out directly."""
        checked = 0
        for count in range(1, 6):
            for sequence in itertools.product(FEMALE_STATES, repeat=count):
                bags = [(f"T{i + 1}", d, f) for i, (d, f) in enumerate(sequence)]
                tags = [t for t, d, f in bags if f and d == S]
                if not tags:
                    expected = None
                elif len(tags) == count and count > 1:
                    expected = "All bags contained female plants."
                elif len(tags) == 1:
                    expected = f"Bag {tags[0]} contained female plants."
                else:
                    expected = (
                        f"Bags {', '.join(tags[:-1])} and {tags[-1]} "
                        "contained female plants."
                    )
                assert wording.female_plant_line(bags) == expected, sequence
                checked += 1
        assert checked == 37448

    def test_a_single_female_bag_is_named(self):
        assert (
            wording.female_plant_line([("T1", S, True)])
            == "Bag T1 contained female plants."
        )

    @pytest.mark.parametrize("result", [N, D, I])
    def test_a_flag_on_a_non_cannabis_bag_is_ignored(self, result):
        assert (
            wording.female_plant_line([("T1", S, False), ("T2", result, True)]) is None
        )

    def test_the_line_is_a_system_sentence(self):
        assert wording.is_system_sentence("Bags T1 and T2 contained female plants.")
        assert wording.is_system_sentence("all bags contained female plants")


def test_shared_fixture_is_current():
    """The frontend checks its wording against this file, so it must match."""
    expected = fixture.render_fixture(fixture.build_fixture())
    actual = fixture.FIXTURE_PATH.read_text(encoding="utf-8")
    assert actual == expected, (
        "The certificate wording fixture is out of date. Run "
        "`poetry run python manage.py build_certificate_wording_fixture`."
    )
    data = json.loads(actual)
    assert (
        len(data["results"]),
        len(data["section_c"]),
        len(data["female"]),
        len(data["officers"]),
    ) == (1364, 360, 584, 420)
