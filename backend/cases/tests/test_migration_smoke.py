"""Migration smoke test — model graph round-trips on a fresh database.

Asserts the reshaped models load and round-trip a Case → Priority3Form →
DrugBag → BotanicalAssessment → Certificate graph. Running this test on the
test database implicitly confirms migrations apply cleanly (pytest-django
runs all migrations before tests execute).
"""

import pytest
from django.utils import timezone

from cases.models import (
    BotanicalAssessment,
    Case,
    Certificate,
    DrugBag,
    Priority3Form,
)
from common.models import SystemSettings

pytestmark = pytest.mark.django_db


class TestModelGraphRoundTrip:
    """Create the full model graph and read it back."""

    def test_case_form_bag_assessment_certificate_round_trip(self):
        """Full graph: Case → Form → Bag → Assessment; Form → Certificate."""
        SystemSettings.load()

        case = Case.objects.create(
            case_number="SMOKE-001",
            received=timezone.now(),
        )

        form = Priority3Form.objects.create(
            case=case,
            security_movement_envelope="WW ABC123",
            phase=Case.PhaseChoices.ASSESSMENT,
        )

        bag = DrugBag.objects.create(
            form=form,
            seal_tag_numbers="SMK-TAG-001",
            content_type="plant",
            property_reference="123456 7890 12345",
        )

        assessment = BotanicalAssessment.objects.create(
            drug_bag=bag,
            determination="cannabis_sativa",
            assessment_date=timezone.now(),
        )

        cert = Certificate.objects.create(
            form=form,
            certified_date=timezone.now().date(),
            additional_notes="Smoke test notes",
        )

        # Read back and verify relationships
        case.refresh_from_db()
        assert case.forms.count() == 1

        form.refresh_from_db()
        assert form.bags.count() == 1
        assert form.case == case

        bag.refresh_from_db()
        assert bag.form == form
        assert bag.security_movement_envelope == "WW ABC123"
        assert hasattr(bag, "assessment")
        assert bag.assessment == assessment

        assessment.refresh_from_db()
        assert assessment.drug_bag == bag
        assert assessment.is_cannabis is True

        cert.refresh_from_db()
        assert cert.form == form
        assert cert.case == case
        assert cert.bags.count() == 1
        assert cert.certificate_number  # auto-generated

    def test_multiple_forms_per_case(self):
        """A case can hold multiple forms, each with its own bags."""
        case = Case.objects.create(
            case_number="SMOKE-002",
            received=timezone.now(),
        )

        form1 = Priority3Form.objects.create(case=case)
        form2 = Priority3Form.objects.create(case=case)

        DrugBag.objects.create(
            form=form1, seal_tag_numbers="S2-A", content_type="plant"
        )
        DrugBag.objects.create(
            form=form2, seal_tag_numbers="S2-B", content_type="plant"
        )
        DrugBag.objects.create(
            form=form2, seal_tag_numbers="S2-C", content_type="plant"
        )

        assert case.forms.count() == 2
        assert form1.bags.count() == 1
        assert form2.bags.count() == 2
        assert case.bag_count == 3
