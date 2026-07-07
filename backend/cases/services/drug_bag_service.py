"""Drug bag service — drug bag and botanical assessment business logic.

Handles drug bag CRUD operations and botanical assessment creation/update logic.
"""

from django.conf import settings
from django.db import transaction
from django.utils import timezone
from rest_framework.exceptions import NotFound, ValidationError

from ..models import BotanicalAssessment, DrugBag, Priority3Form


class DrugBagService:
    """Business logic for drug bag and botanical assessment operations."""

    @staticmethod
    def get_drug_bag(pk):
        """Retrieve a drug bag by primary key.

        Raises:
            NotFound: If the drug bag does not exist.
        """
        try:
            return (
                DrugBag.objects.select_related("form", "form__case")
                .prefetch_related("assessment")
                .get(pk=pk)
            )
        except DrugBag.DoesNotExist:
            raise NotFound(f"Drug bag with pk {pk} not found.")

    @staticmethod
    def get_case_bags(case_id):
        """Retrieve all drug bags for a case, across all of its forms.

        Returns:
            QuerySet of DrugBag instances ordered by seal_tag_numbers.
        """
        return (
            DrugBag.objects.filter(form__case_id=case_id)
            .prefetch_related("assessment")
            .order_by("seal_tag_numbers")
        )

    @staticmethod
    def validate_assessment_creation(drug_bag, user):
        """Validate that a botanical assessment can be created for the drug bag.

        Checks:
        - The drug bag does not already have an assessment.

        Raises:
            ValidationError: If an assessment already exists.
        """
        if BotanicalAssessment.objects.filter(drug_bag=drug_bag).exists():
            raise ValidationError("Assessment already exists for this drug bag.")

    @staticmethod
    def create_assessment(drug_bag, data, user):
        """Create a botanical assessment for a drug bag.

        Validates that no assessment already exists, then creates the record.

        Args:
            drug_bag: The DrugBag instance.
            data: Validated assessment data dict.
            user: The user creating the assessment.

        Returns:
            The newly created BotanicalAssessment instance.

        Raises:
            ValidationError: If assessment already exists.
        """
        DrugBagService.validate_assessment_creation(drug_bag, user)

        assessment = BotanicalAssessment.objects.create(drug_bag=drug_bag, **data)

        settings.LOGGER.info(
            f"User {user} created assessment for bag " f"{drug_bag.seal_tag_numbers}"
        )

        return assessment

    @staticmethod
    def validate_assessment_update_permission(user):
        """Validate that the user can update botanical assessments.

        Any authenticated user with a role can update assessments.
        """
        # No role restriction — IsAuthenticated on the view is sufficient

    @staticmethod
    def update_assessment_with_auto_date(assessment, validated_data):
        """Update an assessment, auto-setting assessment_date if determination is set.

        If the determination field is being set for the first time and
        assessment_date is not already set, auto-populate it with now().

        Args:
            assessment: The BotanicalAssessment instance.
            validated_data: The validated data to apply.

        Returns:
            The updated BotanicalAssessment instance.
        """
        if validated_data.get("determination") and not assessment.assessment_date:
            validated_data["assessment_date"] = timezone.now()

        for key, value in validated_data.items():
            setattr(assessment, key, value)
        assessment.save()

        return assessment

    @staticmethod
    def _ensure_form_capacity(form, additional):
        """Reject the write when a form cannot hold `additional` more bags.

        A Priority 3 form holds at most five drug bags. When the requested bags
        would push the form beyond that limit the whole request is rejected, so
        no bags are silently dropped and the caller learns nothing was recorded.

        Raises:
            ValidationError: If the form's remaining capacity is too small.
        """
        current = form.bags.count()
        if current + additional > Priority3Form.MAX_BAGS:
            remaining = max(Priority3Form.MAX_BAGS - current, 0)
            raise ValidationError(
                f"A Priority 3 form may hold at most {Priority3Form.MAX_BAGS} "
                f"drug bags. This form already has {current}, so it can take "
                f"{remaining} more."
            )

    @staticmethod
    def create_bag(form, data, user):
        """Create a single drug bag on a form, enforcing the five-bag cap.

        Args:
            form: The Priority3Form the bag attaches to.
            data: Validated bag fields (content_type, seal tags, weights, ...).
            user: The user creating the bag.

        Returns:
            The newly created DrugBag instance.

        Raises:
            ValidationError: If the form already holds five bags.
        """
        DrugBagService._ensure_form_capacity(form, 1)

        fields = {key: value for key, value in data.items() if key != "form"}
        bag = DrugBag.objects.create(form=form, **fields)

        settings.LOGGER.info(
            f"User {user} created drug bag {bag.seal_tag_numbers} "
            f"for form {form.pk} on case {form.case.case_number}"
        )

        return bag

    @staticmethod
    @transaction.atomic
    def batch_create(form, bags_data, user):
        """Create multiple bags with assessments on a form in one transaction.

        The form holds at most five drug bags. When the requested bags would not
        all fit, the batch is rejected outright rather than partially recorded.

        Tag-uniqueness validation (within the batch and against existing bags)
        is handled by DrugBagBatchCreateSerializer before this runs.

        Args:
            form: The Priority3Form the bags attach to.
            bags_data: List of dicts with keys: seal_tag_numbers,
                       new_seal_tag_numbers, content_type, determination,
                       assessment_date.
            user: The user performing the creation.

        Returns:
            List of created DrugBag instances (with nested assessment).

        Raises:
            ValidationError: If the form cannot hold all of the requested bags.
        """
        DrugBagService._ensure_form_capacity(form, len(bags_data))

        created_bags = []
        for entry in bags_data:
            bag = DrugBag.objects.create(
                form=form,
                seal_tag_numbers=entry["seal_tag_numbers"],
                new_seal_tag_numbers=entry.get("new_seal_tag_numbers") or "",
                content_type=entry.get("content_type", DrugBag.ContentType.PLANT),
            )

            determination = entry.get("determination")
            if determination and determination != "pending":
                BotanicalAssessment.objects.create(
                    drug_bag=bag,
                    determination=determination,
                    assessment_date=entry.get("assessment_date") or timezone.now(),
                )

            created_bags.append(bag)

        settings.LOGGER.info(
            f"User {user} batch-created {len(created_bags)} bags "
            f"for form {form.pk} on case {form.case.case_number}"
        )

        # Refresh to include nested assessment relations
        bag_ids = [bag.pk for bag in created_bags]
        return list(
            DrugBag.objects.filter(pk__in=bag_ids)
            .prefetch_related("assessment")
            .order_by("seal_tag_numbers")
        )
