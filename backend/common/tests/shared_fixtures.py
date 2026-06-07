"""
Common pytest fixtures for backend testing.

Provides shared fixtures that can be used across all test files.
This file is imported by the root conftest.py via pytest_plugins.
"""

import pytest
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient

User = get_user_model()


@pytest.fixture
def api_client():
    """
    Provide an unauthenticated API client for testing.

    Returns:
        APIClient: DRF API client instance
    """
    return APIClient()


@pytest.fixture
def user(db):
    """
    Provide a regular user.

    Returns:
        User: Regular user instance
    """
    return User.objects.create_user(
        email="test@example.com",
        password="testpass123",
        first_name="Test",
        last_name="User",
    )


@pytest.fixture
def superuser(db):
    """
    Provide a superuser.

    Returns:
        User: Superuser instance
    """
    return User.objects.create_superuser(
        email="admin@example.com",
        password="adminpass123",
        first_name="Admin",
        last_name="User",
    )


@pytest.fixture
def authenticated_client(api_client, user):
    """
    Provide an authenticated API client.

    Args:
        api_client: API client fixture
        user: User fixture

    Returns:
        APIClient: Authenticated API client
    """
    api_client.force_authenticate(user=user)
    return api_client


@pytest.fixture
def admin_client(api_client, superuser):
    """
    Provide an admin API client.

    Args:
        api_client: API client fixture
        superuser: Superuser fixture

    Returns:
        APIClient: Admin-authenticated API client
    """
    api_client.force_authenticate(user=superuser)
    return api_client


@pytest.fixture
def multiple_users(db):
    """
    Provide multiple test users.

    Returns:
        list[User]: List of 3 user instances
    """
    return [
        User.objects.create_user(
            email=f"user{i}@example.com",
            password="testpass123",
            first_name="User",
            last_name=f"{i}",
        )
        for i in range(1, 4)
    ]


# Module-scoped fixtures for read-only tests
# These fixtures are created once per module and shared across tests
# Use these for tests that only read data and don't modify it


@pytest.fixture(scope="module")
def module_user(django_db_setup, django_db_blocker):
    """
    Provide a module-scoped regular user for read-only tests.

    This fixture is created once per test module and shared across all tests.
    Use this for tests that only read user data and don't modify it.

    Returns:
        User: Regular user instance (shared across module)
    """
    with django_db_blocker.unblock():
        user, created = User.objects.get_or_create(
            email="module@example.com",
            defaults={
                "first_name": "Module",
                "last_name": "User",
            },
        )
        if created:
            user.set_password("testpass123")
            user.save()
        yield user


@pytest.fixture(scope="module")
def module_superuser(django_db_setup, django_db_blocker):
    """
    Provide a module-scoped superuser for read-only tests.

    This fixture is created once per test module and shared across all tests.
    Use this for tests that only read superuser data and don't modify it.

    Returns:
        User: Superuser instance (shared across module)
    """
    with django_db_blocker.unblock():
        user, created = User.objects.get_or_create(
            email="moduleadmin@example.com",
            defaults={
                "first_name": "Module",
                "last_name": "Admin",
                "is_superuser": True,
                "is_staff": True,
            },
        )
        if created:
            user.set_password("adminpass123")
            user.is_superuser = True
            user.is_staff = True
            user.save()
        yield user


@pytest.fixture(scope="module")
def module_staff_user(django_db_setup, django_db_blocker):
    """
    Provide a module-scoped staff user for read-only tests.

    This fixture is created once per test module and shared across all tests.
    Use this for tests that only read staff user data and don't modify it.

    Returns:
        User: Staff user instance (shared across module)
    """
    with django_db_blocker.unblock():
        user, created = User.objects.get_or_create(
            email="modulestaff@example.com",
            defaults={
                "first_name": "Module",
                "last_name": "Staff",
                "is_staff": True,
            },
        )
        if created:
            user.set_password("testpass123")
            user.is_staff = True
            user.save()
        yield user


# ---------------------------------------------------------------------------
# Factory fixtures — reusable factory functions for creating test instances
# ---------------------------------------------------------------------------


@pytest.fixture
def make_user(db):
    """
    Factory fixture for creating users with customisable fields.

    Usage:
        user = make_user()
        botanist = make_user(email="bot@test.com", role="botanist")
    """

    def _make_user(
        email="test@test.com", role="none", password="testpass123", **kwargs
    ):
        from django.contrib.auth import get_user_model

        User = get_user_model()
        defaults = {
            "first_name": kwargs.pop("first_name", "Test"),
            "last_name": kwargs.pop("last_name", "User"),
        }
        defaults.update(kwargs)
        return User.objects.create_user(
            email=email, password=password, role=role, **defaults
        )

    return _make_user


@pytest.fixture
def make_case(db):
    """
    Factory fixture for creating Case instances with sensible defaults.

    Usage:
        case = make_case()
        case = make_case(case_number="CASE-999", phase="data_entry")
    """

    def _make_case(case_number=None, **kwargs):
        from django.utils import timezone

        from cases.models import Case

        if case_number is None:
            import uuid

            case_number = f"TEST-{uuid.uuid4().hex[:6].upper()}"

        defaults = {
            "received": kwargs.pop("received", timezone.now()),
            "phase": kwargs.pop("phase", Case.PhaseChoices.ASSESSMENT),
            "security_movement_envelope": kwargs.pop(
                "security_movement_envelope", "ENV-001"
            ),
        }
        defaults.update(kwargs)
        return Case.objects.create(case_number=case_number, **defaults)

    return _make_case


@pytest.fixture
def make_certificate(db):
    """
    Factory fixture for creating Certificate instances.

    Usage:
        cert = make_certificate(case)
        cert = make_certificate(case, certificate_number="CRT-CUSTOM")
    """

    def _make_certificate(submission, certificate_number=None, **kwargs):
        from cases.models import Certificate

        if certificate_number is None:
            import uuid

            certificate_number = f"CRT-TEST-{uuid.uuid4().hex[:6].upper()}"

        return Certificate.objects.create(
            submission=submission,
            certificate_number=certificate_number,
            **kwargs,
        )

    return _make_certificate


@pytest.fixture
def make_invoice(db):
    """
    Factory fixture for creating Invoice instances.

    Usage:
        inv = make_invoice(case)
        inv = make_invoice(case, customer_number="CUST-999")
    """

    def _make_invoice(submission, invoice_number=None, **kwargs):
        from decimal import Decimal

        from cases.models import Invoice

        if invoice_number is None:
            import uuid

            invoice_number = f"INV-TEST-{uuid.uuid4().hex[:6].upper()}"

        defaults = {
            "customer_number": kwargs.pop("customer_number", "CUST-001"),
            "subtotal": kwargs.pop("subtotal", Decimal("100.00")),
            "tax_amount": kwargs.pop("tax_amount", Decimal("10.00")),
            "total": kwargs.pop("total", Decimal("110.00")),
        }
        defaults.update(kwargs)
        return Invoice.objects.create(
            submission=submission,
            invoice_number=invoice_number,
            **defaults,
        )

    return _make_invoice


@pytest.fixture
def make_drug_bag(db):
    """
    Factory fixture for creating DrugBag instances.

    Usage:
        bag = make_drug_bag(case)
        bag = make_drug_bag(case, seal_tag_numbers="TAG-999")
    """

    def _make_drug_bag(submission, seal_tag_numbers=None, **kwargs):
        from cases.models import DrugBag

        if seal_tag_numbers is None:
            import uuid

            seal_tag_numbers = f"TAG-{uuid.uuid4().hex[:6].upper()}"

        defaults = {
            "content_type": kwargs.pop("content_type", DrugBag.ContentType.PLANT),
        }
        defaults.update(kwargs)
        return DrugBag.objects.create(
            submission=submission,
            seal_tag_numbers=seal_tag_numbers,
            **defaults,
        )

    return _make_drug_bag


@pytest.fixture
def make_police_officer(db):
    """
    Factory fixture for creating PoliceOfficer instances.

    Usage:
        officer = make_police_officer()
        officer = make_police_officer(badge_number="B999", rank="sergeant")
    """

    def _make_police_officer(badge_number=None, **kwargs):
        from police.models import PoliceOfficer, PoliceStation

        if badge_number is None:
            import uuid

            badge_number = f"B-{uuid.uuid4().hex[:5].upper()}"

        station = kwargs.pop("station", None)
        if station is None:
            station = PoliceStation.objects.create(name="Test Station")

        defaults = {
            "first_name": kwargs.pop("first_name", "Test"),
            "last_name": kwargs.pop("last_name", "Officer"),
            "rank": kwargs.pop("rank", PoliceOfficer.SeniorityChoices.SENIOR_CONSTABLE),
        }
        defaults.update(kwargs)
        return PoliceOfficer.objects.create(
            badge_number=badge_number,
            station=station,
            **defaults,
        )

    return _make_police_officer


@pytest.fixture
def make_defendant(db):
    """
    Factory fixture for creating Defendant instances.

    Usage:
        defendant = make_defendant()
        defendant = make_defendant(given_names="Jane", last_name="Smith")
    """

    def _make_defendant(**kwargs):
        from defendants.models import Defendant

        defaults = {
            "given_names": kwargs.pop("given_names", "John"),
            "last_name": kwargs.pop("last_name", "Doe"),
        }
        defaults.update(kwargs)
        return Defendant.objects.create(**defaults)

    return _make_defendant


# ---------------------------------------------------------------------------
# Utility fixtures — mock files and images for testing
# ---------------------------------------------------------------------------


@pytest.fixture
def mock_file():
    """Provide a mock PDF file for testing with valid magic bytes."""
    from django.core.files.uploadedfile import SimpleUploadedFile

    # Minimal valid PDF content with proper magic bytes
    pdf_content = (
        b"%PDF-1.4\n%\xe2\xe3\xcf\xd3\n"
        b"1 0 obj\n<</Type/Catalog/Pages 2 0 R>>endobj\n"
        b"2 0 obj\n<</Type/Pages/Count 1/Kids[3 0 R]>>endobj\n"
        b"3 0 obj\n<</Type/Page/MediaBox[0 0 612 792]/Parent 2 0 R/Resources<<>>>>endobj\n"
        b"xref\n0 4\n"
        b"0000000000 65535 f\n"
        b"0000000015 00000 n\n"
        b"0000000068 00000 n\n"
        b"0000000127 00000 n\n"
        b"trailer\n<</Size 4/Root 1 0 R>>\n"
        b"startxref\n225\n%%EOF"
    )
    return SimpleUploadedFile(
        "test_file.pdf", pdf_content, content_type="application/pdf"
    )


@pytest.fixture
def mock_image():
    """Provide a mock image for testing."""
    from io import BytesIO

    from django.core.files.uploadedfile import SimpleUploadedFile
    from PIL import Image

    # Create a simple 10x10 red image
    image = Image.new("RGB", (10, 10), color="red")
    image_io = BytesIO()
    image.save(image_io, format="JPEG")
    image_io.seek(0)

    return SimpleUploadedFile(
        "test_image.jpg", image_io.read(), content_type="image/jpeg"
    )
