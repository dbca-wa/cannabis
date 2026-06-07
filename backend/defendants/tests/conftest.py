"""Shared fixtures for defendants app tests."""

import pytest

from defendants.models import Defendant


@pytest.fixture
def defendant(db):
    """Provide a Defendant instance."""
    return Defendant.objects.create(
        given_names="John",
        last_name="Doe",
    )
