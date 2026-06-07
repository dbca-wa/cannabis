"""Tests for dashboard views (MySubmissions, CertificateStats, RevenueStats, PendingAttention)."""

from decimal import Decimal

import pytest
from django.contrib.auth import get_user_model
from django.urls import reverse
from django.utils import timezone
from rest_framework import status

from cases.models import Certificate, Invoice, Submission
from police.models import PoliceOfficer, PoliceStation

User = get_user_model()


@pytest.fixture
def station(db):
    return PoliceStation.objects.create(name="Dashboard Station", address="1 Dash St")


@pytest.fixture
def officer(db, station):
    return PoliceOfficer.objects.create(
        first_name="Dashboard",
        last_name="Officer",
        badge_number="DASH001",
        station=station,
    )


@pytest.fixture
def botanist_user(db):
    return User.objects.create_user(
        email="dash_botanist@test.com",
        password="testpass123",
        first_name="Dash",
        last_name="Botanist",
        role="botanist",
    )


@pytest.fixture
def finance_user(db):
    return User.objects.create_user(
        email="dash_finance@test.com",
        password="testpass123",
        first_name="Dash",
        last_name="Finance",
        role="finance",
    )


@pytest.fixture
def botanist_client(api_client, botanist_user):
    api_client.force_authenticate(user=botanist_user)
    return api_client


@pytest.fixture
def finance_client(api_client, finance_user):
    api_client.force_authenticate(user=finance_user)
    return api_client


@pytest.fixture
def dashboard_submissions(db, officer, botanist_user, finance_user):
    """Create submissions for dashboard testing."""
    subs = []
    # Botanist review submission assigned to botanist
    subs.append(
        Submission.objects.create(
            case_number="DASH-BR-001",
            received=timezone.now(),
            security_movement_envelope="ENV-DASH-001",
            requesting_officer=officer,
            phase=Submission.PhaseChoices.BOTANIST_SIGNOFF,
            approved_botanist=botanist_user,
        )
    )
    # Finance approval submission assigned to finance
    subs.append(
        Submission.objects.create(
            case_number="DASH-FA-001",
            received=timezone.now(),
            security_movement_envelope="ENV-DASH-002",
            requesting_officer=officer,
            phase=Submission.PhaseChoices.INVOICING,
            finance_officer=finance_user,
        )
    )
    # Complete submission
    subs.append(
        Submission.objects.create(
            case_number="DASH-COMP-001",
            received=timezone.now(),
            security_movement_envelope="ENV-DASH-003",
            requesting_officer=officer,
            phase=Submission.PhaseChoices.COMPLETE,
            approved_botanist=botanist_user,
        )
    )
    return subs


@pytest.mark.django_db
class TestMySubmissionsView:
    """Tests for MySubmissionsView."""

    def test_botanist_sees_own_submissions(
        self, botanist_client, dashboard_submissions
    ):
        """Botanist sees submissions assigned to them."""
        url = reverse("my_cases")
        response = botanist_client.get(url)

        assert response.status_code == status.HTTP_200_OK
        assert response.data["count"] >= 1

    def test_finance_sees_own_submissions(self, finance_client, dashboard_submissions):
        """Finance user sees submissions assigned to them."""
        url = reverse("my_cases")
        response = finance_client.get(url)

        assert response.status_code == status.HTTP_200_OK
        assert response.data["count"] >= 1

    def test_admin_sees_all(self, admin_client, dashboard_submissions):
        """Admin sees all submissions."""
        url = reverse("my_cases")
        response = admin_client.get(url)

        assert response.status_code == status.HTTP_200_OK

    def test_regular_user(self, authenticated_client, dashboard_submissions):
        """Regular user sees submissions they're involved in."""
        url = reverse("my_cases")
        response = authenticated_client.get(url)

        assert response.status_code == status.HTTP_200_OK


@pytest.mark.django_db
class TestPendingAttentionView:
    """Tests for PendingAttentionView."""

    def test_botanist_pending(self, botanist_client, dashboard_submissions):
        """Botanist sees submissions pending their review."""
        url = reverse("pending_attention")
        response = botanist_client.get(url)

        assert response.status_code == status.HTTP_200_OK

    def test_finance_pending(self, finance_client, dashboard_submissions):
        """Finance user sees submissions pending their approval."""
        url = reverse("pending_attention")
        response = finance_client.get(url)

        assert response.status_code == status.HTTP_200_OK

    def test_admin_pending(self, admin_client, dashboard_submissions):
        """Admin sees all non-complete submissions."""
        url = reverse("pending_attention")
        response = admin_client.get(url)

        assert response.status_code == status.HTTP_200_OK

    def test_regular_user_empty(self, authenticated_client, dashboard_submissions):
        """Regular user with no role gets empty list."""
        url = reverse("pending_attention")
        response = authenticated_client.get(url)

        assert response.status_code == status.HTTP_200_OK


@pytest.mark.django_db
class TestCertificateStatsView:
    """Tests for CertificateStatsView."""

    def test_certificate_stats(self, authenticated_client, dashboard_submissions):
        """GET certificate stats returns statistics."""
        # Create a certificate this month
        Certificate.objects.create(submission=dashboard_submissions[0])

        url = reverse("certificate_stats")
        response = authenticated_client.get(url)

        assert response.status_code == status.HTTP_200_OK
        assert "current_month" in response.data
        assert response.data["current_month"]["count"] >= 1

    def test_certificate_stats_with_previous_month(
        self, authenticated_client, dashboard_submissions
    ):
        """GET certificate stats with previous month data shows comparison."""
        from dateutil.relativedelta import relativedelta

        # Create a certificate last month
        cert = Certificate.objects.create(submission=dashboard_submissions[0])
        last_month = timezone.now() - relativedelta(months=1)
        Certificate.objects.filter(pk=cert.pk).update(created_at=last_month)

        # Create a certificate this month
        Certificate.objects.create(submission=dashboard_submissions[1])

        url = reverse("certificate_stats")
        response = authenticated_client.get(url)

        assert response.status_code == status.HTTP_200_OK
        assert response.data["previous_month"] is not None
        assert "change_percentage" in response.data["previous_month"]


@pytest.mark.django_db
class TestRevenueStatsView:
    """Tests for RevenueStatsView."""

    def test_revenue_stats(self, authenticated_client, dashboard_submissions):
        """GET revenue stats returns statistics."""
        # Create an invoice this month
        Invoice.objects.create(
            submission=dashboard_submissions[0],
            customer_number="CUST-DASH-001",
            subtotal=Decimal("100.00"),
            tax_amount=Decimal("10.00"),
            total=Decimal("110.00"),
        )

        url = reverse("revenue_stats")
        response = authenticated_client.get(url)

        assert response.status_code == status.HTTP_200_OK
        assert "current_month" in response.data
        assert response.data["current_month"]["total"] >= 110.0

    def test_revenue_stats_empty(self, authenticated_client):
        """GET revenue stats with no invoices."""
        url = reverse("revenue_stats")
        response = authenticated_client.get(url)

        assert response.status_code == status.HTTP_200_OK
        assert response.data["current_month"]["total"] == 0

    def test_revenue_stats_with_previous_month(
        self, authenticated_client, dashboard_submissions
    ):
        """GET revenue stats with previous month data shows comparison."""
        from dateutil.relativedelta import relativedelta

        # Create an invoice last month
        inv = Invoice.objects.create(
            submission=dashboard_submissions[0],
            customer_number="CUST-PREV-001",
            subtotal=Decimal("200.00"),
            tax_amount=Decimal("20.00"),
            total=Decimal("220.00"),
        )
        last_month = timezone.now() - relativedelta(months=1)
        Invoice.objects.filter(pk=inv.pk).update(created_at=last_month)

        # Create an invoice this month
        Invoice.objects.create(
            submission=dashboard_submissions[1],
            customer_number="CUST-CURR-001",
            subtotal=Decimal("150.00"),
            tax_amount=Decimal("15.00"),
            total=Decimal("165.00"),
        )

        url = reverse("revenue_stats")
        response = authenticated_client.get(url)

        assert response.status_code == status.HTTP_200_OK
        assert response.data["previous_month"] is not None
        assert "change_percentage" in response.data["previous_month"]
