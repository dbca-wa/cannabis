"""Extended tests for submission CRUD views (filtering, search, ordering)."""

import pytest
from django.contrib.auth import get_user_model
from django.urls import reverse
from django.utils import timezone
from rest_framework import status

from cases.models import Submission
from police.models import PoliceOfficer, PoliceStation

User = get_user_model()


@pytest.fixture
def station(db):
    return PoliceStation.objects.create(name="CRUD Station", address="1 CRUD St")


@pytest.fixture
def officer(db, station):
    return PoliceOfficer.objects.create(
        first_name="CRUD",
        last_name="Officer",
        badge_number="CRUD001",
        station=station,
    )


@pytest.fixture
def botanist(db):
    return User.objects.create_user(
        email="crud_botanist@test.com",
        password="testpass123",
        first_name="CRUD",
        last_name="Botanist",
        role="botanist",
    )


@pytest.fixture
def finance(db):
    return User.objects.create_user(
        email="crud_finance@test.com",
        password="testpass123",
        first_name="CRUD",
        last_name="Finance",
        role="finance",
    )


@pytest.fixture
def submissions_set(db, officer, botanist, finance):
    """Create a set of submissions in various phases."""
    subs = []
    phases = [
        Submission.PhaseChoices.CASE_CREATION,
        Submission.PhaseChoices.INVOICING,
        Submission.PhaseChoices.BOTANIST_SIGNOFF,
        Submission.PhaseChoices.UNSIGNED_GENERATION,
        Submission.PhaseChoices.COMPLETE,
    ]
    for i, phase in enumerate(phases):
        sub = Submission.objects.create(
            case_number=f"CRUD-{i:03d}",
            received=timezone.now(),
            security_movement_envelope=f"ENV-CRUD-{i:03d}",
            requesting_officer=officer,
            phase=phase,
            approved_botanist=botanist if i % 2 == 0 else None,
            finance_officer=finance if i % 2 == 1 else None,
        )
        subs.append(sub)
    return subs


@pytest.mark.django_db
class TestSubmissionListViewFiltering:
    """Tests for SubmissionListView filtering and search."""

    def test_list_all(self, authenticated_client, submissions_set):
        """GET all submissions."""
        url = reverse("case_list")
        response = authenticated_client.get(url)

        assert response.status_code == status.HTTP_200_OK
        assert len(response.data["results"]) >= 5

    def test_create_submission(self, authenticated_client, officer):
        """POST creates a new submission."""
        url = reverse("case_list")
        response = authenticated_client.post(
            url,
            {
                "case_number": "NEW-CREATE-001",
                "received": timezone.now().isoformat(),
                "security_movement_envelope": "ENV-NEW-001",
                "requesting_officer": officer.pk,
            },
            format="json",
        )

        assert response.status_code == status.HTTP_201_CREATED

    def test_create_submission_validation_error(self, authenticated_client, officer):
        """POST with missing required fields returns 400."""
        url = reverse("case_list")
        response = authenticated_client.post(
            url,
            {
                "case_number": "",
                "received": timezone.now().isoformat(),
                "security_movement_envelope": "",
            },
            format="json",
        )

        assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_filter_by_phase(self, authenticated_client, submissions_set):
        """Filter submissions by phase."""
        url = reverse("case_list")
        response = authenticated_client.get(
            url, {"phase": Submission.PhaseChoices.CASE_CREATION}
        )

        assert response.status_code == status.HTTP_200_OK
        for sub in response.data["results"]:
            assert sub["phase"] == Submission.PhaseChoices.CASE_CREATION

    def test_filter_by_botanist(self, authenticated_client, submissions_set, botanist):
        """Filter submissions by assigned botanist."""
        url = reverse("case_list")
        response = authenticated_client.get(url, {"botanist": botanist.pk})

        assert response.status_code == status.HTTP_200_OK
        assert len(response.data["results"]) >= 1

    def test_filter_by_finance(self, authenticated_client, submissions_set, finance):
        """Filter submissions by assigned finance officer."""
        url = reverse("case_list")
        response = authenticated_client.get(url, {"finance": finance.pk})

        assert response.status_code == status.HTTP_200_OK

    def test_search_by_case_number(self, authenticated_client, submissions_set):
        """Search submissions by case number."""
        url = reverse("case_list")
        response = authenticated_client.get(url, {"search": "CRUD-001"})

        assert response.status_code == status.HTTP_200_OK
        assert len(response.data["results"]) >= 1

    def test_ordering_by_case_number(self, authenticated_client, submissions_set):
        """Order submissions by case number."""
        url = reverse("case_list")
        response = authenticated_client.get(url, {"ordering": "case_number"})

        assert response.status_code == status.HTTP_200_OK

    def test_ordering_by_phase(self, authenticated_client, submissions_set):
        """Order submissions by phase."""
        url = reverse("case_list")
        response = authenticated_client.get(url, {"ordering": "phase"})

        assert response.status_code == status.HTTP_200_OK

    def test_ordering_by_botanist(self, authenticated_client, submissions_set):
        """Order submissions by botanist name."""
        url = reverse("case_list")
        response = authenticated_client.get(
            url, {"ordering": "approved_botanist__last_name"}
        )

        assert response.status_code == status.HTTP_200_OK

    def test_ordering_by_botanist_desc(self, authenticated_client, submissions_set):
        """Order submissions by botanist name descending."""
        url = reverse("case_list")
        response = authenticated_client.get(
            url, {"ordering": "-approved_botanist__last_name"}
        )

        assert response.status_code == status.HTTP_200_OK

    def test_ordering_by_finance(self, authenticated_client, submissions_set):
        """Order submissions by finance officer name."""
        url = reverse("case_list")
        response = authenticated_client.get(
            url, {"ordering": "finance_officer__last_name"}
        )

        assert response.status_code == status.HTTP_200_OK

    def test_ordering_by_requesting_officer(
        self, authenticated_client, submissions_set
    ):
        """Order submissions by requesting officer name."""
        url = reverse("case_list")
        response = authenticated_client.get(
            url, {"ordering": "requesting_officer__last_name"}
        )

        assert response.status_code == status.HTTP_200_OK

    def test_ordering_by_requesting_officer_desc(
        self, authenticated_client, submissions_set
    ):
        """Order submissions by requesting officer name descending."""
        url = reverse("case_list")
        response = authenticated_client.get(
            url, {"ordering": "-requesting_officer__last_name"}
        )

        assert response.status_code == status.HTTP_200_OK

    def test_filter_by_date_range(self, authenticated_client, submissions_set):
        """Filter submissions by date range."""
        url = reverse("case_list")
        response = authenticated_client.get(
            url,
            {
                "date_from": "2020-01-01",
                "date_to": "2030-12-31",
            },
        )

        assert response.status_code == status.HTTP_200_OK

    def test_filter_by_requesting_officer(
        self, authenticated_client, submissions_set, officer
    ):
        """Filter submissions by requesting officer."""
        url = reverse("case_list")
        response = authenticated_client.get(url, {"requesting_officer": officer.pk})

        assert response.status_code == status.HTTP_200_OK

    def test_full_serializer(self, authenticated_client, submissions_set):
        """GET with full=true uses full serializer."""
        url = reverse("case_list")
        response = authenticated_client.get(url, {"full": "true"})

        assert response.status_code == status.HTTP_200_OK


@pytest.mark.django_db
class TestSubmissionDetailViewExtended:
    """Extended tests for SubmissionDetailView."""

    def test_get_detail(self, authenticated_client, submissions_set):
        """GET submission detail."""
        sub = submissions_set[0]
        url = reverse("case_detail", kwargs={"pk": sub.pk})
        response = authenticated_client.get(url)

        assert response.status_code == status.HTTP_200_OK
        assert response.data["case_number"] == sub.case_number

    def test_patch_submission(self, authenticated_client, submissions_set):
        """PATCH submission updates fields."""
        sub = submissions_set[0]
        url = reverse("case_detail", kwargs={"pk": sub.pk})
        response = authenticated_client.patch(
            url, {"internal_comments": "Updated comment"}, format="json"
        )

        assert response.status_code == status.HTTP_200_OK

    def test_delete_submission(self, admin_client, submissions_set):
        """DELETE submission."""
        sub = submissions_set[0]
        url = reverse("case_detail", kwargs={"pk": sub.pk})
        response = admin_client.delete(url)

        assert response.status_code == status.HTTP_204_NO_CONTENT

    def test_list_unauthenticated(self, api_client):
        """GET without auth returns 401."""
        url = reverse("case_list")
        response = api_client.get(url)

        assert response.status_code == status.HTTP_401_UNAUTHORIZED
