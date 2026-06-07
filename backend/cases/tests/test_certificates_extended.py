"""Extended tests for certificate views — covering listing, detail, and create paths."""

import pytest
from django.contrib.auth import get_user_model
from django.urls import reverse
from django.utils import timezone
from rest_framework import status

from cases.models import Certificate, Submission
from police.models import PoliceOfficer, PoliceStation

User = get_user_model()


@pytest.fixture
def station(db):
    return PoliceStation.objects.create(name="Cert Station", address="1 Cert St")


@pytest.fixture
def officer(db, station):
    return PoliceOfficer.objects.create(
        first_name="Cert",
        last_name="Officer",
        badge_number="CERT001",
        station=station,
    )


@pytest.fixture
def cert_submission(db, officer):
    return Submission.objects.create(
        case_number="CERT-TEST-001",
        received=timezone.now(),
        security_movement_envelope="ENV-CERT-001",
        requesting_officer=officer,
        phase=Submission.PhaseChoices.UNSIGNED_GENERATION,
    )


@pytest.fixture
def cert_submission_2(db, officer):
    return Submission.objects.create(
        case_number="CERT-TEST-002",
        received=timezone.now(),
        security_movement_envelope="ENV-CERT-002",
        requesting_officer=officer,
        phase=Submission.PhaseChoices.BOTANIST_SIGNOFF,
    )


@pytest.fixture
def certificate(db, cert_submission):
    return Certificate.objects.create(submission=cert_submission)


@pytest.fixture
def multiple_certificates(db, cert_submission, cert_submission_2):
    """Create multiple certificates."""
    certs = [
        Certificate.objects.create(submission=cert_submission),
        Certificate.objects.create(submission=cert_submission_2),
    ]
    return certs


@pytest.mark.django_db
class TestAllCertificatesListView:
    """Tests for AllCertificatesListView."""

    def test_list_all_certificates(self, authenticated_client, multiple_certificates):
        """GET all certificates returns paginated list."""
        url = reverse("all_certificates_list")
        response = authenticated_client.get(url)

        assert response.status_code == status.HTTP_200_OK
        assert response.data["count"] >= 2

    def test_search_by_certificate_number(
        self, authenticated_client, multiple_certificates
    ):
        """Search certificates by certificate number."""
        cert = multiple_certificates[0]
        url = reverse("all_certificates_list")
        response = authenticated_client.get(url, {"search": cert.certificate_number})

        assert response.status_code == status.HTTP_200_OK
        assert response.data["count"] >= 1

    def test_search_by_case_number(self, authenticated_client, multiple_certificates):
        """Search certificates by submission case number."""
        url = reverse("all_certificates_list")
        response = authenticated_client.get(url, {"search": "CERT-TEST-001"})

        assert response.status_code == status.HTTP_200_OK

    def test_filter_by_submission(
        self, authenticated_client, multiple_certificates, cert_submission
    ):
        """Filter certificates by submission ID."""
        url = reverse("all_certificates_list")
        response = authenticated_client.get(url, {"submission": cert_submission.pk})

        assert response.status_code == status.HTTP_200_OK
        assert response.data["count"] >= 1


@pytest.mark.django_db
class TestCertificateListView:
    """Tests for CertificateListView (scoped to submission)."""

    def test_list_certificates_for_submission(
        self, authenticated_client, cert_submission, certificate
    ):
        """GET certificates for a specific submission."""
        url = reverse("certificate_list", kwargs={"pk": cert_submission.pk})
        response = authenticated_client.get(url)

        assert response.status_code == status.HTTP_200_OK
        assert len(response.data["results"]) >= 1

    def test_create_certificate(self, authenticated_client, cert_submission_2):
        """POST creates a new certificate for submission."""
        url = reverse("certificate_list", kwargs={"pk": cert_submission_2.pk})
        response = authenticated_client.post(url, {}, format="json")

        assert response.status_code == status.HTTP_201_CREATED
        assert Certificate.objects.filter(submission=cert_submission_2).exists()


@pytest.mark.django_db
class TestCertificateDetailView:
    """Tests for CertificateDetailView."""

    def test_get_certificate_detail(self, authenticated_client, certificate):
        """GET certificate detail returns full data."""
        url = reverse("certificate_detail", kwargs={"pk": certificate.pk})
        response = authenticated_client.get(url)

        assert response.status_code == status.HTTP_200_OK
        assert response.data["certificate_number"] == certificate.certificate_number

    def test_patch_certificate(self, authenticated_client, certificate):
        """PATCH certificate updates fields."""
        url = reverse("certificate_detail", kwargs={"pk": certificate.pk})
        response = authenticated_client.patch(url, {"is_locked": False}, format="json")

        assert response.status_code == status.HTTP_200_OK

    def test_delete_certificate(self, authenticated_client, certificate):
        """DELETE certificate removes it."""
        url = reverse("certificate_detail", kwargs={"pk": certificate.pk})
        response = authenticated_client.delete(url)

        assert response.status_code == status.HTTP_204_NO_CONTENT
        assert not Certificate.objects.filter(pk=certificate.pk).exists()


@pytest.mark.django_db
class TestCertificateDownloadView:
    """Tests for CertificateDownloadView."""

    def test_download_no_pdf(self, authenticated_client, certificate):
        """Download certificate without PDF returns 404."""
        url = reverse("certificate_download", kwargs={"pk": certificate.pk})
        response = authenticated_client.get(url)

        assert response.status_code == status.HTTP_404_NOT_FOUND

    def test_download_nonexistent_certificate(self, authenticated_client):
        """Download non-existent certificate returns 404."""
        url = reverse("certificate_download", kwargs={"pk": 99999})
        response = authenticated_client.get(url)

        assert response.status_code == status.HTTP_404_NOT_FOUND
