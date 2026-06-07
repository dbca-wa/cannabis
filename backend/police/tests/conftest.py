"""Shared fixtures for police app tests."""

import pytest

from police.models import PoliceOfficer, PoliceStation


@pytest.fixture
def police_station(db):
    """Provide a PoliceStation instance."""
    return PoliceStation.objects.create(
        name="Central Police Station",
        address="123 Main Street",
        phone="0412345678",
    )


@pytest.fixture
def police_officer(db, police_station):
    """Provide a PoliceOfficer linked to a station."""
    return PoliceOfficer.objects.create(
        badge_number="B001",
        first_name="John",
        last_name="Smith",
        rank=PoliceOfficer.SeniorityChoices.SENIOR_CONSTABLE,
        station=police_station,
    )
