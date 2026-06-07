"""Extended tests for submission workflow and certificate views."""

from unittest.mock import Mock, patch

import pytest
from django.contrib.auth import get_user_model
from django.urls import reverse
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APIClient

from cases.models import BotanicalAssessment, Certificate, DrugBag, Submission
from police.models import PoliceOfficer, PoliceStation

User = get_user_model()


@pytest.fixture
def station(db):
    return PoliceStation.objects.create(name="Workflow Station", address="1 Test St")


@pytest.fixture
def officer(db, station):
    return PoliceOfficer.objects.create(
        first_name="Workflow",
        last_name="Officer",
        badge_number="WF001",
        station=station,
    )


@pytest.fixture
def data_entry_sub(db, officer):
    return Submission.objects.create(
        case_number="WF-DE-001",
        received=timezone.now(),
        security_movement_envelope="ENV-WF-001",
        requesting_officer=officer,
        phase=Submission.PhaseChoices.DATA_ENTRY,
    )


@pytest.fixture
def finance_sub(db, officer):
    return Submission.objects.create(
        case_number="WF-FA-001",
        received=timezone.now(),
        security_movement_envelope="ENV-WF-002",
        requesting_officer=officer,
        phase=Submission.PhaseChoices.INVOICING,
    )


@pytest.fixture
def documents_sub(db, officer):
    sub = Submission.objects.create(
        case_number="WF-DOC-001",
        received=timezone.now(),
        security_movement_envelope="ENV-WF-003",
        requesting_officer=officer,
        phase=Submission.PhaseChoices.UNSIGNED_GENERATION,
    )
    bag = DrugBag.objects.create(
        submission=sub,
        seal_tag_numbers="TAG-WF-001",
        content_type=DrugBag.ContentType.PLANT,
    )
    BotanicalAssessment.objects.create(
        drug_bag=bag,
        determination=BotanicalAssessment.DeterminationChoices.CANNABIS_SATIVA,
        assessment_date=timezone.now(),
        botanist_notes="Confirmed cannabis sativa.",
    )
    return sub


@pytest.fixture
def complete_sub(db, officer):
    return Submission.objects.create(
        case_number="WF-COMP-001",
        received=timezone.now(),
        security_movement_envelope="ENV-WF-004",
        requesting_officer=officer,
        phase=Submission.PhaseChoices.COMPLETE,
    )


@pytest.fixture
def finance_user(db):
    return User.objects.create_user(
        email="wf_finance@test.com",
        password="testpass123",
        first_name="Finance",
        last_name="WF",
        role="finance",
    )


@pytest.fixture
def botanist_user(db):
    return User.objects.create_user(
        email="wf_botanist@test.com",
        password="testpass123",
        first_name="Botanist",
        last_name="WF",
        role="botanist",
    )


@pytest.fixture
def finance_client(api_client, finance_user):
    api_client.force_authenticate(user=finance_user)
    return api_client


@pytest.fixture
def botanist_client(api_client, botanist_user):
    api_client.force_authenticate(user=botanist_user)
    return api_client


@pytest.mark.django_db
class TestSubmissionWorkflowView:
    """Tests for SubmissionWorkflowView."""

    def test_advance_phase(self, admin_client, data_entry_sub):
        """POST advance_phase moves submission to next phase."""
        url = reverse("case_workflow", kwargs={"pk": data_entry_sub.pk})
        response = admin_client.post(url, {"action": "advance_phase"}, format="json")

        assert response.status_code == status.HTTP_200_OK
        data_entry_sub.refresh_from_db()
        assert data_entry_sub.phase == Submission.PhaseChoices.UNSIGNED_GENERATION

    def test_advance_from_complete_fails(self, admin_client, complete_sub):
        """Cannot advance from COMPLETE phase."""
        url = reverse("case_workflow", kwargs={"pk": complete_sub.pk})
        response = admin_client.post(url, {"action": "advance_phase"}, format="json")

        assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_invalid_action(self, admin_client, data_entry_sub):
        """Invalid action returns 400."""
        url = reverse("case_workflow", kwargs={"pk": data_entry_sub.pk})
        response = admin_client.post(url, {"action": "invalid_action"}, format="json")

        assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_nonexistent_submission(self, admin_client):
        """Workflow on non-existent submission returns 404."""
        url = reverse("case_workflow", kwargs={"pk": 99999})
        response = admin_client.post(url, {"action": "advance_phase"}, format="json")

        assert response.status_code == status.HTTP_404_NOT_FOUND

    @patch("cases.services.pdf_service.subprocess.run")
    @patch("cases.services.pdf_service.render_to_string")
    def test_generate_invoice(
        self, mock_render, mock_subprocess, admin_client, finance_sub
    ):
        """POST generate_invoice creates an invoice."""
        mock_render.return_value = "<html>Invoice</html>"
        mock_subprocess.return_value = Mock(returncode=0, stderr="")

        url = reverse("case_workflow", kwargs={"pk": finance_sub.pk})
        with patch("builtins.open", create=True) as mock_open:
            mock_open.return_value.__enter__.return_value.read.return_value = (
                b"%PDF-1.4 fake content"
            )
            response = admin_client.post(
                url,
                {"action": "generate_invoice", "customer_number": "CUST-001"},
                format="json",
            )

        assert response.status_code == status.HTTP_201_CREATED

    def test_generate_invoice_no_customer(self, admin_client, finance_sub):
        """POST generate_invoice without customer_number fails."""
        url = reverse("case_workflow", kwargs={"pk": finance_sub.pk})
        response = admin_client.post(url, {"action": "generate_invoice"}, format="json")

        assert response.status_code == status.HTTP_400_BAD_REQUEST

    @patch("cases.services.pdf_service.subprocess.run")
    @patch("cases.services.pdf_service.render_to_string")
    def test_generate_certificate(
        self, mock_render, mock_subprocess, admin_client, documents_sub
    ):
        """POST generate_certificate creates a certificate."""
        mock_render.return_value = "<html>Certificate</html>"
        mock_subprocess.return_value = Mock(returncode=0, stderr="")

        url = reverse("case_workflow", kwargs={"pk": documents_sub.pk})
        with patch("builtins.open", create=True) as mock_open:
            mock_open.return_value.__enter__.return_value.read.return_value = (
                b"%PDF-1.4 fake content"
            )
            response = admin_client.post(
                url, {"action": "generate_certificate"}, format="json"
            )

        assert response.status_code == status.HTTP_201_CREATED
        assert "certificate_number" in response.data

    def test_generate_certificate_already_exists(self, admin_client, documents_sub):
        """POST generate_certificate when cert exists fails."""
        Certificate.objects.create(submission=documents_sub)

        url = reverse("case_workflow", kwargs={"pk": documents_sub.pk})
        response = admin_client.post(
            url, {"action": "generate_certificate"}, format="json"
        )

        assert response.status_code == status.HTTP_400_BAD_REQUEST


@pytest.mark.django_db
class TestSubmissionSendBackView:
    """Tests for SubmissionSendBackView."""

    def test_send_back_success(self, finance_client, finance_sub):
        """Finance user can send back from INVOICING."""
        url = reverse("case_send_back", kwargs={"pk": finance_sub.pk})
        response = finance_client.post(
            url,
            {
                "target_phase": Submission.PhaseChoices.DATA_ENTRY,
                "reason": "Needs corrections",
            },
            format="json",
        )

        assert response.status_code == status.HTTP_200_OK
        finance_sub.refresh_from_db()
        assert finance_sub.phase == Submission.PhaseChoices.DATA_ENTRY

    def test_send_back_any_role_can_send_back(self, botanist_client, finance_sub):
        """Any authenticated user can send back (only IsAuthenticated required)."""
        url = reverse("case_send_back", kwargs={"pk": finance_sub.pk})
        response = botanist_client.post(
            url,
            {
                "target_phase": Submission.PhaseChoices.DATA_ENTRY,
                "reason": "Reason",
            },
            format="json",
        )

        assert response.status_code == status.HTTP_200_OK

    def test_send_back_missing_reason(self, finance_client, finance_sub):
        """Send back without reason fails."""
        url = reverse("case_send_back", kwargs={"pk": finance_sub.pk})
        response = finance_client.post(
            url,
            {"target_phase": Submission.PhaseChoices.DATA_ENTRY},
            format="json",
        )

        assert response.status_code == status.HTTP_400_BAD_REQUEST


@pytest.mark.django_db
class TestCertificateViews:
    """Tests for certificate list and detail views."""

    def test_all_certificates_list(self, authenticated_client, documents_sub):
        """GET all certificates returns list."""
        Certificate.objects.create(submission=documents_sub)

        url = reverse("all_certificates_list")
        response = authenticated_client.get(url)

        assert response.status_code == status.HTTP_200_OK
        assert len(response.data["results"]) >= 1

    def test_certificates_list_for_submission(
        self, authenticated_client, documents_sub
    ):
        """GET certificates for a specific submission."""
        Certificate.objects.create(submission=documents_sub)

        url = reverse("certificate_list", kwargs={"pk": documents_sub.pk})
        response = authenticated_client.get(url)

        assert response.status_code == status.HTTP_200_OK

    def test_certificate_detail(self, authenticated_client, documents_sub):
        """GET certificate detail."""
        cert = Certificate.objects.create(submission=documents_sub)

        url = reverse("certificate_detail", kwargs={"pk": cert.pk})
        response = authenticated_client.get(url)

        assert response.status_code == status.HTTP_200_OK
        assert response.data["id"] == cert.pk

    def test_certificate_download_no_pdf(self, authenticated_client, documents_sub):
        """Download certificate without PDF returns 404."""
        cert = Certificate.objects.create(submission=documents_sub)

        url = reverse("certificate_download", kwargs={"pk": cert.pk})
        response = authenticated_client.get(url)

        assert response.status_code == status.HTTP_404_NOT_FOUND

    def test_all_certificates_search(self, authenticated_client, documents_sub):
        """Search certificates by number."""
        cert = Certificate.objects.create(submission=documents_sub)

        url = reverse("all_certificates_list")
        response = authenticated_client.get(
            url, {"search": cert.certificate_number[:5]}
        )

        assert response.status_code == status.HTTP_200_OK


@pytest.mark.django_db
class TestGenerateTestCertificateView:
    """Tests for GenerateTestCertificateView — generates test PDF with mock data."""

    @patch("cases.services.pdf_service.subprocess.run")
    @patch("cases.services.pdf_service.render_to_string")
    def test_generates_pdf_with_empty_body(
        self, mock_render, mock_subprocess, authenticated_client
    ):
        """POST generates a PDF using hardcoded mock data (no input required)."""
        mock_render.return_value = "<html>Test Certificate</html>"
        mock_subprocess.return_value = Mock(returncode=0, stderr="")

        url = reverse("test_certificate")
        with patch("builtins.open", create=True) as mock_open:
            mock_open.return_value.__enter__.return_value.read.return_value = (
                b"%PDF-1.4 fake content"
            )
            response = authenticated_client.post(url, {}, format="json")

        assert response.status_code == status.HTTP_200_OK
        assert response["Content-Type"] == "application/pdf"

    def test_requires_authentication(self, db):
        """Unauthenticated requests are rejected."""
        client = APIClient()
        url = reverse("test_certificate")
        response = client.post(url, {}, format="json")

        assert response.status_code in (
            status.HTTP_401_UNAUTHORIZED,
            status.HTTP_403_FORBIDDEN,
        )
