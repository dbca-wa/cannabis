"""Shared fixtures for communications app tests."""

import pytest
from django.utils import timezone

from cases.models import Case
from communications.models import Notification, NotificationTypes, SubmissionComment
from police.models import PoliceStation


@pytest.fixture
def submission(db, user):
    """Provide a Case instance for comment tests."""
    station = PoliceStation.objects.create(name="Test Station")
    return Case.objects.create(
        case_number="CASE-001",
        received=timezone.now(),
        station=station,
        phase=Case.PhaseChoices.DATA_ENTRY,
    )


@pytest.fixture
def comment(db, user, submission):
    """Provide a SubmissionComment on the submission."""
    return SubmissionComment.objects.create(
        user=user,
        submission=submission,
        text="Test comment content",
    )


@pytest.fixture
def notification(db, user):
    """Provide a Notification for the user."""
    return Notification.objects.create(
        recipient=user,
        notification_type=NotificationTypes.COMMENT_ADDED,
        title="Test Notification",
        message="This is a test notification.",
        priority=Notification.PriorityLevels.NORMAL,
    )
