"""Unit tests for the placeholder-defendant rules."""

import pytest

from common.tests.factories import DefendantFactory
from defendants.models import Defendant
from defendants.validators import (
    PLACEHOLDER_MESSAGE,
    is_placeholder_defendant,
    is_placeholder_name,
    placeholder_name_q,
    reject_new_placeholder_defendants,
)


@pytest.mark.parametrize("value", ["Unknown", "unknown", "UNKNOWN", "  Unknown  "])
def test_placeholder_names_are_detected(value):
    assert is_placeholder_name(value)


@pytest.mark.parametrize("value", [None, "", "   ", "Unknownson", "Jane", "Un known"])
def test_real_or_empty_names_are_not_placeholders(value):
    assert not is_placeholder_name(value)


@pytest.mark.django_db
class TestPlaceholderDefendant:
    def test_either_name_part_marks_the_defendant(self):
        assert is_placeholder_defendant(
            DefendantFactory(given_names="Unknown", last_name="Doe")
        )
        assert is_placeholder_defendant(
            DefendantFactory(given_names="Jane", last_name="Unknown")
        )
        assert not is_placeholder_defendant(
            DefendantFactory(given_names=None, last_name="Doe")
        )

    def test_query_matches_only_placeholders(self):
        both = DefendantFactory(given_names="Unknown", last_name="Unknown")
        given = DefendantFactory(given_names=" unknown ", last_name="Doe")
        last = DefendantFactory(given_names="Jane", last_name="UNKNOWN")
        real = DefendantFactory(given_names="Unknownson", last_name="Doe")
        no_given = DefendantFactory(given_names=None, last_name="Smith")

        matched = set(
            Defendant.all_objects.filter(placeholder_name_q()).values_list(
                "pk", flat=True
            )
        )
        assert matched == {both.pk, given.pk, last.pk}
        assert real.pk not in matched
        assert no_given.pk not in matched

    def test_reject_flags_a_new_placeholder(self):
        placeholder = DefendantFactory(given_names="Unknown", last_name="Unknown")
        real = DefendantFactory()
        assert (
            reject_new_placeholder_defendants([real, placeholder])
            == PLACEHOLDER_MESSAGE
        )

    def test_reject_allows_existing_placeholders_and_real_defendants(self):
        placeholder = DefendantFactory(given_names="Unknown", last_name="Unknown")
        real = DefendantFactory()
        assert reject_new_placeholder_defendants([real]) is None
        assert (
            reject_new_placeholder_defendants(
                [placeholder, real], existing_ids={placeholder.pk}
            )
            is None
        )
