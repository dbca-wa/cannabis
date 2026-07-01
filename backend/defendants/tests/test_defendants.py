"""Tests for defendant endpoints."""

import pytest
from django.urls import reverse

from common.tests.factories import DefendantFactory

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

    def test_detail(self, finance_client):
        defendant = DefendantFactory()
        resp = finance_client.get(
            reverse("defendant_detail", kwargs={"pk": defendant.pk})
        )
        assert resp.status_code == 200

    def test_requires_app_access(self, roleless_client):
        resp = roleless_client.get(reverse("defendant_list"))
        assert resp.status_code == 403
