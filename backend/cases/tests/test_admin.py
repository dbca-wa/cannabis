"""Tests for cases admin views."""

import pytest
from django.contrib.admin.sites import AdminSite
from django.contrib.auth import get_user_model
from django.test import RequestFactory
from django.utils import timezone

from cases.admin import (
    CaseAdmin,
)
from cases.models import Case
from police.models import PoliceOfficer, PoliceStation

User = get_user_model()


@pytest.fixture
def admin_site():
    return AdminSite()


@pytest.fixture
def station(db):
    return PoliceStation.objects.create(name="Admin Station", address="1 Admin St")


@pytest.fixture
def officer(db, station):
    return PoliceOfficer.objects.create(
        first_name="Admin",
        last_name="Officer",
        badge_number="ADM001",
        station=station,
    )


@pytest.fixture
def admin_case(db, officer):
    return Case.objects.create(
        case_number="ADM-TEST-001",
        received=timezone.now(),
        security_movement_envelope="ENV-ADM-001",
        requesting_officer=officer,
        phase=Case.PhaseChoices.CASE_CREATION,
    )


@pytest.mark.django_db
class TestCaseAdmin:
    """Tests for CaseAdmin."""

    def test_admin_list_display(self, admin_site, admin_case):
        """CaseAdmin can list cases."""
        admin = CaseAdmin(Case, admin_site)
        assert admin.list_display is not None

    def test_admin_queryset(self, admin_site, admin_case):
        """CaseAdmin queryset works."""
        admin = CaseAdmin(Case, admin_site)
        factory = RequestFactory()
        request = factory.get("/admin/cases/case/")
        request.user = User.objects.create_superuser(
            email="admin_test@test.com", password="testpass123"
        )
        qs = admin.get_queryset(request)
        assert qs.count() >= 1
