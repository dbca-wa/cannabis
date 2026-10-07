"""Drug bag service — drug bag and botanical assessment business logic.

Handles drug bag creation and the five-bag-per-form capacity rule. Botanical
assessment create/update is handled directly in the assessment views.
"""

from django.conf import settings
from django.db import transaction
from django.utils import timezone
from rest_framework.exceptions import NotFound, ValidationError

from common.logging import describe_user

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
            f"{describe_user(user)} created drug bag {bag.seal_tag_numbers} "
            f"({bag.pk}) for form {form.pk} on case {form.case.case_number}"
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
                contains_female_plants=entry.get("contains_female_plants", False),
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
            f"{describe_user(user)} batch-created {len(created_bags)} bags "
            f"for form {form.pk} on case {form.case.case_number}"
        )

        # Refresh to include nested assessment relations
        bag_ids = [bag.pk for bag in created_bags]
        return list(
            DrugBag.objects.filter(pk__in=bag_ids)
            .prefetch_related("assessment")
            .order_by("seal_tag_numbers")
        )
