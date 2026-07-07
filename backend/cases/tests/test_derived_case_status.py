"""Unit tests for Case.derived_status and Case.bag_count.

Covers:
- Empty case returns "assessment"
- All forms complete returns "complete"
- Mixed phases returns the least-advanced non-complete phase
- bag_count counts bags across all forms correctly
"""

import pytest
from django.utils import timezone

from cases.models import Case, DrugBag, Priority3Form

pytestmark = pytest.mark.django_db


def _make_case(suffix):
    return Case.objects.create(
        case_number=f"STATUS-{suffix}",
        received=timezone.now(),
    )


class TestDerivedStatus:
    """Case.derived_status aggregates phases from its forms."""

    def test_empty_case_returns_assessment(self):
        """A case with no forms reports assessment."""
        case = _make_case("EMPTY")
        assert case.derived_status == Case.PhaseChoices.ASSESSMENT

    def test_all_forms_complete_returns_complete(self):
        """When every form is complete the case is complete."""
        case = _make_case("ALLCOMPLETE")
        Priority3Form.objects.create(case=case, phase=Case.PhaseChoices.COMPLETE)
        Priority3Form.objects.create(case=case, phase=Case.PhaseChoices.COMPLETE)
        assert case.derived_status == Case.PhaseChoices.COMPLETE

    def test_mixed_phases_returns_least_advanced(self):
        """The least-advanced non-complete phase is reported."""
        case = _make_case("MIXED")
        Priority3Form.objects.create(case=case, phase=Case.PhaseChoices.COMPLETE)
        Priority3Form.objects.create(case=case, phase=Case.PhaseChoices.BATCHING)
        Priority3Form.objects.create(case=case, phase=Case.PhaseChoices.ASSESSMENT)
        assert case.derived_status == Case.PhaseChoices.ASSESSMENT

    def test_single_non_complete_form(self):
        """A single form in unsigned_generation reports that phase."""
        case = _make_case("SINGLE")
        Priority3Form.objects.create(
            case=case, phase=Case.PhaseChoices.UNSIGNED_GENERATION
        )
        assert case.derived_status == Case.PhaseChoices.UNSIGNED_GENERATION

    def test_two_non_complete_in_different_phases(self):
        """Between batching and in_batch, batching is least-advanced."""
        case = _make_case("TWO")
        Priority3Form.objects.create(case=case, phase=Case.PhaseChoices.IN_BATCH)
        Priority3Form.objects.create(case=case, phase=Case.PhaseChoices.BATCHING)
        assert case.derived_status == Case.PhaseChoices.BATCHING


class TestBagCount:
    """Case.bag_count counts bags across all of a case's forms."""

    def test_no_forms_no_bags(self):
        case = _make_case("NOBAGS")
        assert case.bag_count == 0

    def test_single_form_multiple_bags(self):
        case = _make_case("SINGLE-BAGS")
        form = Priority3Form.objects.create(case=case)
        DrugBag.objects.create(form=form, seal_tag_numbers="T1", content_type="plant")
        DrugBag.objects.create(form=form, seal_tag_numbers="T2", content_type="plant")
        DrugBag.objects.create(form=form, seal_tag_numbers="T3", content_type="plant")
        assert case.bag_count == 3

    def test_multiple_forms(self):
        case = _make_case("MULTI-BAGS")
        form1 = Priority3Form.objects.create(case=case)
        form2 = Priority3Form.objects.create(case=case)
        DrugBag.objects.create(form=form1, seal_tag_numbers="A1", content_type="plant")
        DrugBag.objects.create(form=form1, seal_tag_numbers="A2", content_type="plant")
        DrugBag.objects.create(form=form2, seal_tag_numbers="B1", content_type="plant")
        assert case.bag_count == 3

    def test_bags_from_other_case_not_counted(self):
        """bag_count only returns bags for this case, not others."""
        case1 = _make_case("BAG-CASE1")
        case2 = _make_case("BAG-CASE2")
        form1 = Priority3Form.objects.create(case=case1)
        form2 = Priority3Form.objects.create(case=case2)
        DrugBag.objects.create(form=form1, seal_tag_numbers="X1", content_type="plant")
        DrugBag.objects.create(form=form2, seal_tag_numbers="X2", content_type="plant")
        assert case1.bag_count == 1
        assert case2.bag_count == 1
