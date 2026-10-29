"""OCR defendant matching never suggests a placeholder ("Unknown") defendant."""

import pytest

from cases.ocr.matcher import EntityMatcher
from common.tests.factories import DefendantFactory

pytestmark = pytest.mark.django_db


def _candidate_ids(name):
    return {c.id for c in EntityMatcher().match_defendant(name).candidates}


def test_placeholder_defendants_are_not_suggested():
    placeholder = DefendantFactory(given_names="Jane", last_name="Unknown")
    real = DefendantFactory(given_names="Jane", last_name="Unknowne")

    ids = _candidate_ids("UNKNOWNE, Jane")

    assert real.pk in ids
    assert placeholder.pk not in ids


def test_unknown_name_on_the_form_returns_no_match():
    DefendantFactory(given_names="Unknown", last_name="Unknown")
    assert _candidate_ids("Unknown") == set()
