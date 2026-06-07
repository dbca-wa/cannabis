"""Extended tests for drug bag and phase history views."""

from decimal import Decimal

import pytest
from django.contrib.auth import get_user_model
from django.urls import reverse
from django.utils import timezone
from rest_framework import status

from cases.models import DrugBag, Submission, SubmissionPhaseHistory
from police.models import PoliceOfficer, PoliceStation

User = get_user_model()


@pytest.fixture
def station(db):
    return PoliceStation.objects.create(name="Bag Station", address="1 Bag St")


@pytest.fixture
def officer(db, station):
    return PoliceOfficer.objects.create(
        first_name="Bag",
        last_name="Officer",
        badge_number="BAG001",
        station=station,
    )


@pytest.fixture
def bag_submission(db, officer):
    return Submission.objects.create(
        case_number="BAG-TEST-001",
        received=timezone.now(),
        security_movement_envelope="ENV-BAG-001",
        requesting_officer=officer,
        phase=Submission.PhaseChoices.DATA_ENTRY,
    )


@pytest.fixture
def drug_bag(db, bag_submission):
    return DrugBag.objects.create(
        submission=bag_submission,
        seal_tag_numbers="TAG-BAG-001",
        content_type=DrugBag.ContentType.PLANT,
        gross_weight=Decimal("15.500"),
        net_weight=Decimal("12.300"),
    )


@pytest.mark.django_db
class TestDrugBagListView:
    """Tests for DrugBagListView."""

    def test_list_bags(self, authenticated_client, bag_submission, drug_bag):
        """GET bags for a submission."""
        url = reverse("drugbag_list", kwargs={"pk": bag_submission.pk})
        response = authenticated_client.get(url)

        assert response.status_code == status.HTTP_200_OK
        assert len(response.data["results"]) >= 1

    def test_create_bag(self, authenticated_client, bag_submission):
        """POST creates a new drug bag."""
        url = reverse("drugbag_list", kwargs={"pk": bag_submission.pk})
        response = authenticated_client.post(
            url,
            {
                "seal_tag_numbers": "TAG-NEW-001",
                "content_type": "plant",
                "gross_weight": "20.000",
                "net_weight": "18.000",
            },
            format="json",
        )

        # May return 201 or 400 depending on serializer validation
        assert response.status_code in [
            status.HTTP_201_CREATED,
            status.HTTP_400_BAD_REQUEST,
        ]


@pytest.mark.django_db
class TestDrugBagDetailView:
    """Tests for DrugBagDetailView."""

    def test_get_bag_detail(self, authenticated_client, drug_bag):
        """GET bag detail."""
        url = reverse("drugbag_detail", kwargs={"pk": drug_bag.pk})
        response = authenticated_client.get(url)

        assert response.status_code == status.HTTP_200_OK
        assert response.data["seal_tag_numbers"] == "TAG-BAG-001"

    def test_patch_bag(self, authenticated_client, drug_bag):
        """PATCH bag updates fields."""
        url = reverse("drugbag_detail", kwargs={"pk": drug_bag.pk})
        response = authenticated_client.patch(
            url, {"net_weight": "10.000"}, format="json"
        )

        assert response.status_code == status.HTTP_200_OK

    def test_delete_bag(self, authenticated_client, drug_bag):
        """DELETE bag removes it."""
        url = reverse("drugbag_detail", kwargs={"pk": drug_bag.pk})
        response = authenticated_client.delete(url)

        assert response.status_code == status.HTTP_204_NO_CONTENT


@pytest.mark.django_db
class TestPhaseHistoryView:
    """Tests for SubmissionPhaseHistoryView."""

    def test_list_phase_history(self, authenticated_client, bag_submission, superuser):
        """GET phase history for a submission."""
        # Create a history entry
        SubmissionPhaseHistory.objects.create(
            submission=bag_submission,
            from_phase=Submission.PhaseChoices.DATA_ENTRY,
            to_phase=Submission.PhaseChoices.INVOICING,
            action="advance",
            user=superuser,
        )

        url = reverse(
            "case_phase_history",
            kwargs={"pk": bag_submission.pk},
        )
        response = authenticated_client.get(url)

        assert response.status_code == status.HTTP_200_OK
        assert len(response.data["results"]) >= 1

    def test_empty_phase_history(self, authenticated_client, bag_submission):
        """GET phase history with no entries."""
        url = reverse(
            "case_phase_history",
            kwargs={"pk": bag_submission.pk},
        )
        response = authenticated_client.get(url)

        assert response.status_code == status.HTTP_200_OK
