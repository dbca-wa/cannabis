"""Only real police ranks can be recorded; "Unknown" is not one."""

import importlib

import pytest
from django.apps import apps as django_apps

from common.tests.factories import PoliceOfficerFactory
from police.models import PoliceOfficer

pytestmark = pytest.mark.django_db

migration = importlib.import_module("police.migrations.0007_remove_unknown_rank")


def test_unknown_is_not_a_rank_choice():
    assert "unknown" not in PoliceOfficer.SeniorityChoices.values
    assert "Unknown" not in PoliceOfficer.SeniorityChoices.labels


def test_the_migration_clears_stored_unknown_ranks():
    old = PoliceOfficerFactory()
    real = PoliceOfficerFactory(rank=PoliceOfficer.SeniorityChoices.SERGEANT)
    PoliceOfficer.objects.filter(pk=old.pk).update(rank="unknown")

    migration.clear_unknown_rank(django_apps, None)

    old.refresh_from_db()
    real.refresh_from_db()
    assert old.rank == PoliceOfficer.NO_RANK
    assert real.rank == PoliceOfficer.SeniorityChoices.SERGEANT


def test_an_officer_with_no_rank_is_not_sworn():
    assert not PoliceOfficerFactory(rank=PoliceOfficer.NO_RANK).is_sworn
    assert PoliceOfficerFactory(rank="sergeant").is_sworn


def test_the_api_refuses_unknown_as_a_rank(botanist_client):
    from django.urls import reverse

    resp = botanist_client.post(
        reverse("officer_list"),
        {"last_name": "Turner", "given_names": "Alex", "rank": "unknown"},
        format="json",
    )

    assert resp.status_code == 400
    assert "rank" in resp.data
