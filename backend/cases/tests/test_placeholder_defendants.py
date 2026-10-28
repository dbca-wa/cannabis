"""Placeholder defendants (named "Unknown") cannot be attached to a case."""

import pytest

from cases.serializers.create import CaseCreateSerializer
from cases.serializers.update import CaseUpdateSerializer
from common.tests.factories import CaseFactory, DefendantFactory

pytestmark = pytest.mark.django_db


def _placeholder():
    # Factories bypass serializer validation, standing in for a record created
    # before the rule existed (such as the one found in the 23/10 batch test).
    return DefendantFactory(given_names="Unknown", last_name="Unknown")


def test_create_rejects_a_placeholder_defendant():
    serializer = CaseCreateSerializer(
        data={
            "case_number": "PLACEHOLDER-1",
            "received": "2026-10-23",
            "defendants": [_placeholder().pk],
        }
    )
    assert not serializer.is_valid()
    assert "Defendant is unknown" in str(serializer.errors["defendants"])


def test_create_accepts_real_defendants():
    serializer = CaseCreateSerializer(
        data={
            "case_number": "PLACEHOLDER-2",
            "received": "2026-10-23",
            "defendants": [DefendantFactory().pk],
        }
    )
    assert serializer.is_valid(), serializer.errors


def test_update_rejects_newly_attached_placeholder():
    case = CaseFactory()
    serializer = CaseUpdateSerializer(
        case, data={"defendants": [_placeholder().pk]}, partial=True
    )
    assert not serializer.is_valid()
    assert "defendants" in serializer.errors


def test_update_keeps_a_placeholder_already_on_the_case():
    """An existing case holding one stays editable while it is cleaned up."""
    case = CaseFactory()
    placeholder = _placeholder()
    case.defendants.add(placeholder)
    real = DefendantFactory()

    serializer = CaseUpdateSerializer(
        case, data={"defendants": [placeholder.pk, real.pk]}, partial=True
    )
    assert serializer.is_valid(), serializer.errors


def test_update_can_remove_the_placeholder():
    case = CaseFactory()
    case.defendants.add(_placeholder())
    serializer = CaseUpdateSerializer(case, data={"defendants": []}, partial=True)
    assert serializer.is_valid(), serializer.errors
    serializer.save()
    assert not case.defendants.exists()
