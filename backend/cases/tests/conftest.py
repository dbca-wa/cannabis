"""Shared fixtures and factories for submissions tests.

pytest-django fixtures can be defined here and will be auto-discovered
by any test file in this directory.
"""

from decimal import Decimal

import pytest
from django.contrib.auth import get_user_model
from django.utils import timezone
from rest_framework.test import APIClient

from cases.models import (
    BotanicalAssessment,
    Certificate,
    DrugBag,
    Invoice,
    Submission,
)
from police.models import PoliceOfficer, PoliceStation

User = get_user_model()


@pytest.fixture
def api_client():
    """Return a DRF APIClient instance."""
    return APIClient()


@pytest.fixture
def police_station(db):
    """Create a test police station."""
    return PoliceStation.objects.create(name="Test Station", address="123 Test St")


@pytest.fixture
def police_officer(db, police_station):
    """Create a test police officer."""
    return PoliceOfficer.objects.create(
        first_name="Test",
        last_name="Officer",
        badge_number="12345",
        station=police_station,
    )


@pytest.fixture
def submission(db, police_officer):
    """Create a basic test submission in INVOICING phase."""
    return Submission.objects.create(
        case_number="TEST-001",
        received=timezone.now(),
        security_movement_envelope="ENV-001",
        requesting_officer=police_officer,
        phase=Submission.PhaseChoices.INVOICING,
    )


@pytest.fixture
def submission_data_entry(db, police_officer):
    """Create a test submission in DATA_ENTRY phase."""
    return Submission.objects.create(
        case_number="TEST-DE-001",
        received=timezone.now(),
        security_movement_envelope="ENV-DE-001",
        requesting_officer=police_officer,
        phase=Submission.PhaseChoices.DATA_ENTRY,
    )


@pytest.fixture
def drug_bag(db, submission):
    """Create a test drug bag linked to a submission."""
    return DrugBag.objects.create(
        submission=submission,
        seal_tag_numbers="TAG-001",
        content_type=DrugBag.ContentType.PLANT,
        gross_weight=Decimal("10.500"),
        net_weight=Decimal("8.200"),
    )


@pytest.fixture
def botanical_assessment(db, drug_bag):
    """Create a test botanical assessment linked to a drug bag."""
    return BotanicalAssessment.objects.create(
        drug_bag=drug_bag,
        determination=BotanicalAssessment.DeterminationChoices.CANNABIS_SATIVA,
        assessment_date=timezone.now(),
        botanist_notes="Test assessment notes",
    )


@pytest.fixture
def certificate(db, submission):
    """Create a test certificate linked to a submission."""
    return Certificate.objects.create(
        submission=submission,
        certificate_number="CRT2024-TEST-001",
    )


@pytest.fixture
def invoice(db, submission):
    """Create a test invoice linked to a submission."""
    return Invoice.objects.create(
        submission=submission,
        invoice_number="INV2024-TEST-001",
        customer_number="CUST-001",
        subtotal=Decimal("121.00"),
        tax_amount=Decimal("12.10"),
        total=Decimal("133.10"),
    )


@pytest.fixture
def finance_user(db):
    """Create a finance user."""
    return User.objects.create_user(
        email="finance@test.com",
        password="testpass123",
        first_name="Finance",
        last_name="Officer",
        role="finance",
    )


@pytest.fixture
def botanist_user(db):
    """Create a botanist user."""
    return User.objects.create_user(
        email="botanist@test.com",
        password="testpass123",
        first_name="Botanist",
        last_name="User",
        role="botanist",
    )
