"""Tests for defendant endpoints."""

import pytest
from django.urls import reverse

from common.tests.factories import DefendantFactory
from defendants.models import Defendant

pytestmark = pytest.mark.django_db


class TestDefendants:
    def test_list(self, finance_client):
        DefendantFactory.create_batch(2)
        resp = finance_client.get(reverse("defendant_list"))
        assert resp.status_code == 200

    def test_create(self, finance_client):
        resp = finance_client.post(
            reverse("defendant_list"),
            {"last_name": "Doe", "given_names": "John"},
            format="json",
        )
        assert resp.status_code == 201

    def test_create_records_creator(self, finance_client, finance_user):
        resp = finance_client.post(
            reverse("defendant_list"),
            {"last_name": "Doe", "given_names": "Jane"},
            format="json",
        )
        assert resp.status_code == 201
        defendant = Defendant.objects.get(pk=resp.data["id"])
        assert defendant.created_by == finance_user
        assert defendant.updated_by == finance_user

    def test_update_records_editor(self, finance_client, finance_user):
        defendant = DefendantFactory()
        resp = finance_client.patch(
            reverse("defendant_detail", kwargs={"pk": defendant.pk}),
            {"given_names": "Renamed"},
            format="json",
        )
        assert resp.status_code == 200
        defendant.refresh_from_db()
        assert defendant.updated_by == finance_user
        assert defendant.created_by is None

    def test_detail(self, finance_client):
        defendant = DefendantFactory()
        resp = finance_client.get(
            reverse("defendant_detail", kwargs={"pk": defendant.pk})
        )
        assert resp.status_code == 200

    def test_requires_app_access(self, roleless_client):
        resp = roleless_client.get(reverse("defendant_list"))
        assert resp.status_code == 403
