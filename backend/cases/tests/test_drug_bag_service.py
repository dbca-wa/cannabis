"""Service-layer tests for DrugBagService."""

import pytest
from django.utils import timezone
from rest_framework.exceptions import NotFound, ValidationError

from cases.models import BotanicalAssessment, DrugBag
from cases.services.drug_bag_service import DrugBagService


@pytest.mark.django_db
class TestDrugBagServiceGet:
    """Tests for retrieval helpers."""

    def test_get_drug_bag_success(self, drug_bag):
        result = DrugBagService.get_drug_bag(drug_bag.pk)
        assert result.pk == drug_bag.pk

    def test_get_drug_bag_not_found(self):
        with pytest.raises(NotFound):
            DrugBagService.get_drug_bag(999999)

    def test_get_submission_bags(self, drug_bag, submission):
        bags = DrugBagService.get_submission_bags(submission.pk)
        assert drug_bag in list(bags)

    def test_get_submission_bags_empty(self, submission_data_entry):
        bags = DrugBagService.get_submission_bags(submission_data_entry.pk)
        assert list(bags) == []


@pytest.mark.django_db
class TestDrugBagServiceAssessment:
    """Tests for assessment creation and update."""

    def test_validate_creation_passes_when_none(self, drug_bag, botanist_user):
        # Should not raise when no assessment exists
        DrugBagService.validate_assessment_creation(drug_bag, botanist_user)

    def test_validate_creation_raises_when_exists(
        self, botanical_assessment, drug_bag, botanist_user
    ):
        with pytest.raises(ValidationError):
            DrugBagService.validate_assessment_creation(drug_bag, botanist_user)

    def test_create_assessment_success(self, drug_bag, botanist_user):
        data = {
            "determination": BotanicalAssessment.DeterminationChoices.CANNABIS_SATIVA,
            "assessment_date": timezone.now(),
        }
        result = DrugBagService.create_assessment(drug_bag, data, botanist_user)
        assert result.pk is not None
        assert result.drug_bag_id == drug_bag.pk

    def test_create_assessment_duplicate_raises(
        self, botanical_assessment, drug_bag, botanist_user
    ):
        with pytest.raises(ValidationError):
            DrugBagService.create_assessment(drug_bag, {}, botanist_user)

    def test_update_auto_sets_date(self, botanical_assessment):
        botanical_assessment.assessment_date = None
        botanical_assessment.save()
        updated = DrugBagService.update_assessment_with_auto_date(
            botanical_assessment,
            {"determination": BotanicalAssessment.DeterminationChoices.CANNABIS_SATIVA},
        )
        assert updated.assessment_date is not None

    def test_update_preserves_existing_date(self, botanical_assessment):
        original = botanical_assessment.assessment_date
        updated = DrugBagService.update_assessment_with_auto_date(
            botanical_assessment, {"botanist_notes": "Updated"}
        )
        assert updated.assessment_date == original
        assert updated.botanist_notes == "Updated"

    def test_validate_update_permission_noop(self, botanist_user):
        # No restriction — should not raise
        DrugBagService.validate_assessment_update_permission(botanist_user)


@pytest.mark.django_db
class TestDrugBagServiceBatchCreate:
    """Tests for batch_create."""

    def test_batch_create_success(self, submission_data_entry, botanist_user):
        bags_data = [
            {
                "seal_tag_numbers": "BATCH-001",
                "content_type": DrugBag.ContentType.PLANT,
                "determination": BotanicalAssessment.DeterminationChoices.CANNABIS_SATIVA,
            },
            {
                "seal_tag_numbers": "BATCH-002",
                "content_type": DrugBag.ContentType.SEED,
                "determination": "pending",
            },
        ]
        result = DrugBagService.batch_create(
            submission_data_entry, bags_data, botanist_user
        )
        assert len(result) == 2

    def test_batch_create_duplicate_in_batch(
        self, submission_data_entry, botanist_user
    ):
        bags_data = [
            {"seal_tag_numbers": "DUP-001"},
            {"seal_tag_numbers": "DUP-001"},
        ]
        with pytest.raises(ValidationError):
            DrugBagService.batch_create(submission_data_entry, bags_data, botanist_user)

    def test_batch_create_global_conflict(
        self, submission_data_entry, drug_bag, botanist_user
    ):
        bags_data = [{"seal_tag_numbers": drug_bag.seal_tag_numbers}]
        with pytest.raises(ValidationError):
            DrugBagService.batch_create(submission_data_entry, bags_data, botanist_user)
