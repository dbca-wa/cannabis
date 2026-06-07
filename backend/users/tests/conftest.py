"""
Local conftest for users app tests.

Shared fixtures are defined in common/tests/shared_fixtures.py and imported
by the root conftest via pytest_plugins. This file contains user-app-specific
fixtures.
"""

import pytest
from django.contrib.auth import get_user_model

User = get_user_model()


@pytest.fixture
def botanist_user(db):
    """Create a botanist user for auth and permission tests."""
    return User.objects.create_user(
        email="botanist@test.com",
        password="testpass123",
        first_name="Botanist",
        last_name="User",
        role="botanist",
    )


@pytest.fixture
def finance_user(db):
    """Create a finance user for auth and permission tests."""
    return User.objects.create_user(
        email="finance@test.com",
        password="testpass123",
        first_name="Finance",
        last_name="Officer",
        role="finance",
    )
