"""Tests for the legacy transform: tags, results, dates and officers.

The narratives below are copied from real certificates in the old system, so
each test pins behaviour that was checked against the source.
"""

from etl.transform.bags import (
    assign_content_types,
    build_bags,
    determine_bags,
    expand_tags,
    pair_new_tags,
)
from etl.transform.dates import resolve_dates
from etl.transform.officers import repair_officers


class TestExpandTags:
    def test_plain_list(self):
        assert expand_tags("T51111, T51112 & T51113") == ["T51111", "T51112", "T51113"]

    def test_hyphen_range_keeps_leading_zeros(self):
        assert expand_tags("T367926-44")[0] == "T367926"
        assert expand_tags("T367926-44")[-1] == "T367944"
        assert len(expand_tags("T367926-44")) == 19

    def test_chained_suffixes_list_consecutive_tags(self):
        assert expand_tags("T53951-2-3") == ["T53951", "T53952", "T53953"]

    def test_slash_is_two_tags_not_a_range(self):
        assert expand_tags("T53948/50") == ["T53948", "T53950"]

    def test_tag_glued_to_a_word_is_found(self):
        assert expand_tags("bag numbersT386152, T386154") == ["T386152", "T386154"]


class TestDetermineBags:
    def test_single_result_applies_to_every_bag(self):
        results, basis, _ = determine_bags(
            "I identified the plants as Cannabis sativa. The plants were resealed in "
            "new drug movement bags, tag numbers T1, T2.",
            ["T45001", "T45002"],
        )
        assert set(results.values()) == {"cannabis_sativa"}
        assert basis == "certificate"

    def test_named_bags_split_by_result(self):
        # Certificate 907: one cannabis bag, six too decomposed.
        narrative = (
            "I identified the plants in bag no. T52625 as Cannabis sativa. I was unable "
            "to identify the material in bag nos. T52621, T52622, T52623, T52624, "
            "T52626 & T52627 as the material was too decomposed. Seven subsamples were "
            "removed and sealed into bag no. B544906."
        )
        tags = ["T52621", "T52622", "T52623", "T52624", "T52625", "T52626", "T52627"]
        results, basis, _ = determine_bags(narrative, tags)
        assert basis == "named_bags"
        assert results["T52625"] == "cannabis_sativa"
        assert all(results[t] == "degraded" for t in tags if t != "T52625")

    def test_remaining_bags_take_the_unnamed_result(self):
        narrative = (
            "I could not identify the plants in bag number WW0366238 as Cannabis "
            "sativa. I identified the remaining plants as Cannabis sativa."
        )
        results, basis, _ = determine_bags(narrative, ["WW0366238", "T60457", "T60458"])
        assert basis == "named_and_rest"
        assert results == {
            "WW0366238": "inconclusive",
            "T60457": "cannabis_sativa",
            "T60458": "cannabis_sativa",
        }

    def test_unplaceable_mixed_result_is_flagged_not_guessed(self):
        narrative = (
            "I identified the plants as Cannabis sativa. I was unable to identify the "
            "root balls. The plants were resealed in three new bags."
        )
        results, basis, _ = determine_bags(narrative, ["T4001", "T4002"])
        assert basis == "unsplit"
        assert set(results.values()) == {"mixed"}

    def test_non_cannabis_findings(self):
        for text, expected in [
            ("I identified the poppy capsule as Papaver somniferum.", "not_cannabis"),
            (
                "The mushrooms were not a species of the genus Psilocybe.",
                "not_cannabis",
            ),
            ("These are not Cannabis sativa or Papaver Somniferum.", "not_cannabis"),
            (
                "The fungal material could not be identified as a species of the "
                "genus Psilocybe.",
                "inconclusive",
            ),
            (
                "I was unable to identify the seedlings as Cannabis sativa.",
                "inconclusive",
            ),
            (
                "I was unable to identify the plant specimens as the plant material "
                "was rotten.",
                "degraded",
            ),
        ]:
            results, _, _ = determine_bags(text, ["T4001"])
            assert results == {"T4001": expected}, text

    def test_missing_identification_stays_pending(self):
        results, _, _ = determine_bags(
            "The plants were sealed in new drug movement bag, tag number T4001.",
            ["T4001"],
        )
        assert results == {"T4001": "pending"}

    def test_unable_without_to_is_still_unable(self):
        results, _, _ = determine_bags(
            "I was unable identify the seeds as Poppy or Cannabis sativa.", ["T4001"]
        )
        assert results == {"T4001": "inconclusive"}


class TestContentTypesAndNewTags:
    def test_one_described_type_applies_to_all(self):
        assert assign_content_types(["plant"], ["A1", "A2"], {}) == {
            "A1": "plant",
            "A2": "plant",
        }

    def test_ambiguous_description_is_unsure_not_guessed(self):
        result = assign_content_types(["plant", "seed"], ["A1", "A2"], {})
        assert set(result.values()) == {"unsure"}

    def test_named_bag_type_resolves_the_rest(self):
        result = assign_content_types(["plant", "seed"], ["A1", "A2"], {"A1": "seed"})
        assert result == {"A1": "seed", "A2": "plant"}

    def test_vague_word_does_not_hide_the_concrete_type(self):
        assert assign_content_types(["plant", "unsure"], ["A1"], {}) == {"A1": "plant"}

    def test_new_tags_pair_only_when_counts_match_after_subsamples(self):
        narrative = (
            "I identified the plants as Cannabis sativa. One subsample was removed and "
            "sealed in drug movement bag no. B621422. The plants were resealed in a "
            "new drug movement bag, tag number T55791."
        )
        assert pair_new_tags(["T54727"], narrative, ["T55791", "B621422"]) == {
            "T54727": "T55791"
        }

    def test_new_tags_not_paired_when_counts_differ(self):
        assert pair_new_tags(["A1", "A2"], "text", ["N1"]) == {}


class TestBuildBags:
    def test_blank_tag_cell_makes_one_placeholder_bag(self):
        record = {"tag_numbers": [], "description": ["plant"], "result": {}}
        out = build_bags(record)
        assert [b["tag"] for b in out["bags"]] == ["UNKNOWN"]

    def test_repeated_tag_is_one_bag(self):
        record = {
            "tag_numbers": ["T1", "T1", "T2"],
            "description": ["plant"],
            "result": {},
        }
        assert [b["tag"] for b in build_bags(record)["bags"]] == ["T1", "T2"]


class TestDates:
    def _rows(self, *pairs):
        return [{"Receipt Date": r, "Certification Date": c} for r, c in pairs]

    def test_real_dates_pass_through(self):
        out = resolve_dates(self._rows(("2003-05-06", "2003-05-07")))
        assert out[0]["receipt_date"] == "2003-05-06"
        assert out[0]["cert_date"] == "2003-05-07"
        assert out[0]["date_notes"] == []

    def test_year_before_2000_is_replaced_and_noted(self):
        out = resolve_dates(
            self._rows(("2003-05-06", "2003-05-06"), ("1989-10-27", "1989-10-27"))
        )
        assert out[1]["receipt_date"] == "2003-05-06"
        assert out[1]["cert_date"] == "2003-05-06"
        assert len(out[1]["date_notes"]) == 2

    def test_implausible_receipt_takes_certification_date(self):
        out = resolve_dates(self._rows(("1951-05-31", "2006-05-31")))
        assert out[0]["receipt_date"] == "2006-05-31"

    def test_blank_certification_date_stays_blank(self):
        out = resolve_dates(self._rows(("2005-01-02", None)))
        assert out[0]["cert_date"] is None


class TestOfficerRepairs:
    def _officer(self, name, rank, badge=""):
        return {"name": name, "rank": rank, "badge_id": badge}

    def test_role_word_removed_from_name(self):
        parsed = {
            "submitting_officer": self._officer(
                "Officer Bexana GARFIELD", "Sworn Officer", "PD0322"
            ),
            "requesting_officer": self._officer("", ""),
        }
        out = repair_officers(parsed, "Sworn Officer Bexana GARFIELD 0322")
        assert out["submitting_officer"]["name"] == "Bexana GARFIELD"

    def test_split_rank_is_rejoined_and_badge_recovered(self):
        parsed = {
            "submitting_officer": self._officer(
                "Kencombe", "Senior Constable", "PD0643"
            ),
            "requesting_officer": self._officer("Class Constable Clementine", "First"),
        }
        raw = (
            "Senior Constable Kencombe 0643 on behalf of - First Class Constable "
            "Clementine 45212 of Manjimup"
        )
        out = repair_officers(parsed, raw)
        assert out["requesting_officer"] == {
            "name": "Clementine",
            "rank": "First Class Constable",
            "badge_id": "PD45212",
        }

    def test_good_records_are_untouched(self):
        parsed = {
            "submitting_officer": self._officer(
                "Saffron Elford", "Unsworn Officer", "PD85862"
            ),
            "requesting_officer": self._officer(
                "Bexric Belby", "Sworn Officer", "PD48908"
            ),
            "organisation": "",
        }
        raw = "Unsworn Officer PD85862 ELFORD, Saffron On behalf of - Sworn Officer PD48908 BELBY, Bexric"
        assert repair_officers(parsed, raw) == parsed
