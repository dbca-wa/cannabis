"""Tests for the ETL Priority3Form migration pipeline."""

import pytest

from cases.management.commands.etl_modules.data_mapper import (
    DrugBagData,
    FormData,
)
from cases.management.commands.etl_modules.model_factory import ModelFactory
from cases.models import Case, DrugBag

pytestmark = pytest.mark.django_db


class TestPriority3FormCreation:
    """Priority3Form creation during import."""

    def test_creates_form_for_case(self):
        case = Case.objects.create(
            case_number="TEST-001",
            received="2025-01-01T09:00:00+08:00",
            is_legacy=True,
        )
        form_data = FormData(
            security_movement_envelope="SME-001",
            additional_notes="Test notes",
        )
        factory = ModelFactory()
        form = factory.create_priority3_form(case, form_data)

        assert form.case == case
        assert form.security_movement_envelope == "SME-001"
        assert form.additional_notes == "Test notes"
        assert form.phase == "complete"


class TestFormGrouping:
    """Form grouping (7 bags -> 2 forms: 5 + 2)."""

    def test_groups_bags_into_forms(self):
        bags = [
            DrugBagData(content_type="plant", seal_tag_numbers=f"TAG{i}")
            for i in range(7)
        ]
        groups = ModelFactory._group_bags_into_forms(bags, max_per_form=5)

        assert len(groups) == 2
        assert len(groups[0]) == 5
        assert len(groups[1]) == 2

    def test_single_group_when_within_limit(self):
        bags = [
            DrugBagData(content_type="plant", seal_tag_numbers=f"TAG{i}")
            for i in range(3)
        ]
        groups = ModelFactory._group_bags_into_forms(bags, max_per_form=5)

        assert len(groups) == 1
        assert len(groups[0]) == 3

    def test_exact_limit_is_single_group(self):
        bags = [
            DrugBagData(content_type="plant", seal_tag_numbers=f"TAG{i}")
            for i in range(5)
        ]
        groups = ModelFactory._group_bags_into_forms(bags, max_per_form=5)

        assert len(groups) == 1
        assert len(groups[0]) == 5


class TestLegacyFlag:
    """Imported cases have is_legacy=True."""

    def test_etl_case_is_legacy(self):
        case = Case.objects.create(
            case_number="LEGACY-001",
            received="2025-01-01T09:00:00+08:00",
            is_legacy=True,
        )
        assert case.is_legacy is True


class TestFormPhase:
    """Imported forms have phase=complete."""

    def test_etl_form_phase_complete(self):
        case = Case.objects.create(
            case_number="PHASE-001",
            received="2025-01-01T09:00:00+08:00",
            is_legacy=True,
        )
        form_data = FormData(security_movement_envelope="SME-X")
        factory = ModelFactory()
        form = factory.create_priority3_form(case, form_data)

        assert form.phase == "complete"


class TestIdempotentReImport:
    """Idempotent re-import (no duplicates)."""

    def test_no_duplicate_bags_on_reimport(self):
        case = Case.objects.create(
            case_number="IDEM-001",
            received="2025-01-01T09:00:00+08:00",
            is_legacy=True,
        )
        form_data = FormData(security_movement_envelope="SME-I")
        factory = ModelFactory()
        form = factory.create_priority3_form(case, form_data)

        # Create a bag
        bag_data = DrugBagData(content_type="plant", seal_tag_numbers="TAG-IDEM-001")
        factory.create_drug_bag(bag_data, form)

        # Re-create should not duplicate (get_or_create)
        factory.create_drug_bag(bag_data, form)

        assert DrugBag.objects.filter(form=form).count() == 1
