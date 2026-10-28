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


class TestPlaceholderDefendants:
    """Defendants named "Unknown" are rejected and hidden from selection."""

    @pytest.mark.parametrize(
        "payload,field",
        [
            ({"given_names": "Unknown", "last_name": "Unknown"}, "last_name"),
            ({"given_names": "Jane", "last_name": " unknown "}, "last_name"),
            ({"given_names": "UNKNOWN", "last_name": "Doe"}, "given_names"),
        ],
    )
    def test_create_rejects_placeholder_names(self, finance_client, payload, field):
        resp = finance_client.post(reverse("defendant_list"), payload, format="json")
        assert resp.status_code == 400
        assert "Defendant is unknown" in str(resp.data[field])
        assert not Defendant.all_objects.filter(last_name__iexact="unknown").exists()

    def test_similar_real_names_are_allowed(self, finance_client):
        resp = finance_client.post(
            reverse("defendant_list"),
            {"given_names": "Unknownson", "last_name": "Doe"},
            format="json",
        )
        assert resp.status_code == 201

    def test_edit_rejects_renaming_to_unknown(self, finance_client):
        defendant = DefendantFactory(given_names="Jane", last_name="Doe")
        resp = finance_client.patch(
            reverse("defendant_detail", kwargs={"pk": defendant.pk}),
            {"last_name": "Unknown"},
            format="json",
        )
        assert resp.status_code == 400
        defendant.refresh_from_db()
        assert defendant.last_name == "Doe"

    def test_selectable_search_hides_placeholders(self, finance_client):
        placeholder = DefendantFactory(given_names="Unknown", last_name="Unknown")
        real = DefendantFactory(given_names="Jane", last_name="Doe")

        resp = finance_client.get(reverse("defendant_list"), {"selectable": "true"})
        ids = {row["id"] for row in resp.data["results"]}
        assert real.pk in ids
        assert placeholder.pk not in ids

    def test_defendants_page_still_lists_placeholders(self, finance_client):
        placeholder = DefendantFactory(given_names="Unknown", last_name="Unknown")
        resp = finance_client.get(reverse("defendant_list"), {"search": "unknown"})
        ids = {row["id"] for row in resp.data["results"]}
        assert placeholder.pk in ids
