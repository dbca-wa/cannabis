"""Tests for DEBUG-only PDF template preview endpoints.

Verifies that the certificate and invoice preview endpoints render HTML
correctly when DEBUG=True, and are blocked when DEBUG=False.
"""

from decimal import Decimal

import pytest
from django.contrib.auth import get_user_model
from django.test import override_settings
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APIClient

from cases.models import (
    BotanicalAssessment,
    Certificate,
    DrugBag,
    Invoice,
    Submission,
)
from defendants.models import Defendant
from police.models import PoliceOfficer, PoliceStation

User = get_user_model()


@pytest.fixture
def authenticated_client(db):
    """Return an APIClient authenticated as a botanist user."""
    user = User.objects.create_user(
        email="preview@test.com",
        password="testpass123",
        first_name="Preview",
        last_name="Tester",
        role="botanist",
    )
    client = APIClient()
    client.force_authenticate(user=user)
    return client


@pytest.fixture
def station(db):
    return PoliceStation.objects.create(name="Perth Central", address="1 Main St")


@pytest.fixture
def officer(db, station):
    return PoliceOfficer.objects.create(
        first_name="John",
        last_name="Smith",
        badge_number="WA1234",
        station=station,
    )


@pytest.fixture
def preview_submission(db, officer):
    """Create a submission with bags and assessments suitable for preview."""
    botanist = User.objects.create_user(
        email="botanist-preview@test.com",
        password="testpass123",
        first_name="Jane",
        last_name="Botanist",
        role="botanist",
    )

    sub = Submission.objects.create(
        case_number="PREVIEW-001",
        received=timezone.make_aware(timezone.datetime(2024, 6, 1, 9, 0)),
        security_movement_envelope="SME-PREV-001",
        approved_botanist=botanist,
        submitting_officer=officer,
        internal_comments="Preview test data.",
        phase=Submission.PhaseChoices.UNSIGNED_GENERATION,
    )

    # Add a defendant
    defendant = Defendant.objects.create(given_names="Test", last_name="Defendant")
    sub.defendants.add(defendant)

    # Add a bag with assessment
    bag = DrugBag.objects.create(
        submission=sub,
        seal_tag_numbers="DMB-PREV-001",
        content_type=DrugBag.ContentType.PLANT,
    )
    BotanicalAssessment.objects.create(
        drug_bag=bag,
        determination=BotanicalAssessment.DeterminationChoices.CANNABIS_SATIVA,
        assessment_date=timezone.make_aware(timezone.datetime(2024, 6, 5, 14, 0)),
        botanist_notes="Plant material consistent with Cannabis sativa L.",
    )

    return sub


@pytest.mark.django_db
class TestCertificatePreview:
    """Tests for the certificate preview endpoint."""

    @override_settings(DEBUG=True)
    def test_returns_html_with_real_data(
        self, authenticated_client, preview_submission
    ):
        """Preview endpoint renders the certificate template as HTML."""
        url = f"/api/v1/test/certificate-preview/{preview_submission.pk}"
        response = authenticated_client.get(url)

        assert response.status_code == status.HTTP_200_OK
        assert response["Content-Type"] == "text/html"
        # The rendered HTML should contain data from the submission
        content = response.content.decode()
        assert "PREVIEW-001" in content or "PREVIEW" in content

    @override_settings(DEBUG=True)
    def test_uses_existing_certificate_if_available(
        self, authenticated_client, preview_submission
    ):
        """When a certificate exists, the preview uses its number."""
        Certificate.objects.create(
            submission=preview_submission,
            certificate_number="CRT-PREVIEW-001",
        )
        url = f"/api/v1/test/certificate-preview/{preview_submission.pk}"
        response = authenticated_client.get(url)

        assert response.status_code == status.HTTP_200_OK
        content = response.content.decode()
        assert "CRT-PREVIEW-001" in content

    @override_settings(DEBUG=False)
    def test_blocked_when_debug_false(self, authenticated_client, preview_submission):
        """Preview endpoint returns 403 when DEBUG is False."""
        url = f"/api/v1/test/certificate-preview/{preview_submission.pk}"
        response = authenticated_client.get(url)

        assert response.status_code == status.HTTP_403_FORBIDDEN

    @override_settings(DEBUG=True)
    def test_returns_404_for_nonexistent_submission(self, authenticated_client):
        """Returns 404 when submission ID does not exist."""
        url = "/api/v1/test/certificate-preview/99999"
        response = authenticated_client.get(url)

        assert response.status_code == status.HTTP_404_NOT_FOUND

    @override_settings(DEBUG=True)
    def test_requires_authentication(self, db, preview_submission):
        """Unauthenticated requests are rejected."""
        client = APIClient()
        url = f"/api/v1/test/certificate-preview/{preview_submission.pk}"
        response = client.get(url)

        assert response.status_code in (
            status.HTTP_401_UNAUTHORIZED,
            status.HTTP_403_FORBIDDEN,
        )


@pytest.mark.django_db
class TestInvoicePreview:
    """Tests for the invoice preview endpoint."""

    @override_settings(DEBUG=True)
    def test_returns_html_with_real_data(
        self, authenticated_client, preview_submission
    ):
        """Preview endpoint renders the invoice template as HTML."""
        url = f"/api/v1/test/invoice-preview/{preview_submission.pk}"
        response = authenticated_client.get(url)

        assert response.status_code == status.HTTP_200_OK
        assert response["Content-Type"] == "text/html"

    @override_settings(DEBUG=True)
    def test_uses_existing_invoice_if_available(
        self, authenticated_client, preview_submission
    ):
        """When an invoice exists, the preview uses its data."""
        Invoice.objects.create(
            submission=preview_submission,
            invoice_number="INV-PREVIEW-001",
            customer_number="CUST-001",
            subtotal=Decimal("100.00"),
            tax_amount=Decimal("10.00"),
            total=Decimal("110.00"),
        )
        url = f"/api/v1/test/invoice-preview/{preview_submission.pk}"
        response = authenticated_client.get(url)

        assert response.status_code == status.HTTP_200_OK
        content = response.content.decode()
        assert "INV-PREVIEW-001" in content

    @override_settings(DEBUG=False)
    def test_blocked_when_debug_false(self, authenticated_client, preview_submission):
        """Preview endpoint returns 403 when DEBUG is False."""
        url = f"/api/v1/test/invoice-preview/{preview_submission.pk}"
        response = authenticated_client.get(url)

        assert response.status_code == status.HTTP_403_FORBIDDEN

    @override_settings(DEBUG=True)
    def test_returns_404_for_nonexistent_submission(self, authenticated_client):
        """Returns 404 when submission ID does not exist."""
        url = "/api/v1/test/invoice-preview/99999"
        response = authenticated_client.get(url)

        assert response.status_code == status.HTTP_404_NOT_FOUND

    @override_settings(DEBUG=True)
    def test_requires_authentication(self, db, preview_submission):
        """Unauthenticated requests are rejected."""
        client = APIClient()
        url = f"/api/v1/test/invoice-preview/{preview_submission.pk}"
        response = client.get(url)

        assert response.status_code in (
            status.HTTP_401_UNAUTHORIZED,
            status.HTTP_403_FORBIDDEN,
        )
