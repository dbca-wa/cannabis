"""
Root conftest.py for backend tests.

Defines the shared fixtures (auto-discovered globally) and forces the test
environment to use a dummy cache backend (no Redis required, full isolation).

Shared test-data factories live in ``common/tests/factories.py`` and are imported
directly by the tests that need them.
"""

import os

import pytest

# Set as early as possible (at conftest import, before Django/cache setup) so
# config.cache_settings selects the dummy cache backend for tests.
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")
os.environ["PYTEST_RUNNING"] = "1"


def pytest_configure():
    """Force the dummy cache backend in case Django configured before the flag."""
    from django.conf import settings

    settings.CACHES = {
        "default": {
            "BACKEND": "django.core.cache.backends.dummy.DummyCache",
        }
    }


# ---------------------------------------------------------------------------
# API client
# ---------------------------------------------------------------------------
@pytest.fixture
def api_client():
    """Unauthenticated DRF API client."""
    from rest_framework.test import APIClient

    return APIClient()


# ---------------------------------------------------------------------------
# Role-based users
# ---------------------------------------------------------------------------
@pytest.fixture
def admin_user(db):
    """An admin (staff + superuser)."""
    from common.tests.factories import SuperuserFactory

    return SuperuserFactory()


@pytest.fixture
def botanist_user(db):
    """A user with the botanist role."""
    from common.tests.factories import BotanistFactory

    return BotanistFactory()


@pytest.fixture
def finance_user(db):
    """A user with the finance role."""
    from common.tests.factories import FinanceFactory

    return FinanceFactory()


@pytest.fixture
def roleless_user(db):
    """An active user with no role (no app access)."""
    from common.tests.factories import UserFactory

    return UserFactory()


# ---------------------------------------------------------------------------
# Authenticated clients (force_authenticate bypasses JWT for integration tests)
# ---------------------------------------------------------------------------
@pytest.fixture
def admin_client(api_client, admin_user):
    api_client.force_authenticate(user=admin_user)
    return api_client


@pytest.fixture
def botanist_client(api_client, botanist_user):
    api_client.force_authenticate(user=botanist_user)
    return api_client


@pytest.fixture
def finance_client(api_client, finance_user):
    api_client.force_authenticate(user=finance_user)
    return api_client


@pytest.fixture
def roleless_client(api_client, roleless_user):
    api_client.force_authenticate(user=roleless_user)
    return api_client


# ---------------------------------------------------------------------------
# System settings + uploads
# ---------------------------------------------------------------------------
@pytest.fixture
def system_settings(db):
    """The SystemSettings singleton with known rates for cost/batch tests."""
    from decimal import Decimal

    from common.models import SystemSettings

    settings_obj = SystemSettings.load()
    settings_obj.cost_per_certificate = Decimal("110.00")
    settings_obj.cost_per_bag = Decimal("11.00")
    settings_obj.tax_percentage = Decimal("10.00")
    settings_obj.save()
    return settings_obj


@pytest.fixture
def mock_pdf():
    """A minimal valid PDF upload."""
    from django.core.files.uploadedfile import SimpleUploadedFile

    pdf_content = (
        b"%PDF-1.4\n%\xe2\xe3\xcf\xd3\n1 0 obj\n<</Type/Catalog/Pages 2 0 R>>endobj\n"
        b"2 0 obj\n<</Type/Pages/Count 1/Kids[3 0 R]>>endobj\n"
        b"3 0 obj\n<</Type/Page/MediaBox[0 0 612 792]/Parent 2 0 R/Resources<<>>>>endobj\n"
        b"xref\n0 4\n0000000000 65535 f\ntrailer\n<</Size 4/Root 1 0 R>>\nstartxref\n225\n%%EOF"
    )
    return SimpleUploadedFile(
        "test_file.pdf", pdf_content, content_type="application/pdf"
    )
