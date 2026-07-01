"""Tests for drug-bag tag uniqueness rules.

Key rule: a single bag may carry the same value for its original and new tag
(the Priority 3 form sometimes repeats it). That value is still unique across
bags — a different bag may not reuse it as either its original or new tag.
"""

import pytest
from django.urls import reverse

from common.tests.factories import CaseFactory, DrugBagFactory

pytestmark = pytest.mark.django_db


class TestBatchCreateTagRule:
    def test_same_original_and_new_allowed_for_one_bag(self, finance_client):
        case = CaseFactory()
        resp = finance_client.post(
            reverse("drugbag_batch_create", kwargs={"pk": case.pk}),
            {
                "bags": [
                    {
                        "seal_tag_numbers": "123",
                        "new_seal_tag_numbers": "123",
                        "content_type": "plant",
                    }
                ]
            },
            format="json",
        )
        assert resp.status_code == 201
        assert resp.data[0]["seal_tag_numbers"] == "123"
        assert resp.data[0]["new_seal_tag_numbers"] == "123"

    def test_new_tag_reusing_another_bags_tag_is_rejected(self, finance_client):
        # DB A: 123/123 (fine). DB B: 1234/123 — 123 belongs to A → rejected.
        case = CaseFactory()
        resp = finance_client.post(
            reverse("drugbag_batch_create", kwargs={"pk": case.pk}),
            {
                "bags": [
                    {
                        "seal_tag_numbers": "123",
                        "new_seal_tag_numbers": "123",
                        "content_type": "plant",
                    },
                    {
                        "seal_tag_numbers": "1234",
                        "new_seal_tag_numbers": "123",
                        "content_type": "plant",
                    },
                ]
            },
            format="json",
        )
        assert resp.status_code == 400

    def test_value_reused_as_original_and_new_across_bags_rejected(
        self, finance_client
    ):
        # 456 appears as A's new tag and B's original tag → collision.
        case = CaseFactory()
        resp = finance_client.post(
            reverse("drugbag_batch_create", kwargs={"pk": case.pk}),
            {
                "bags": [
                    {
                        "seal_tag_numbers": "123",
                        "new_seal_tag_numbers": "456",
                        "content_type": "plant",
                    },
                    {
                        "seal_tag_numbers": "456",
                        "new_seal_tag_numbers": "789",
                        "content_type": "plant",
                    },
                ]
            },
            format="json",
        )
        assert resp.status_code == 400

    def test_distinct_tags_allowed(self, finance_client):
        case = CaseFactory()
        resp = finance_client.post(
            reverse("drugbag_batch_create", kwargs={"pk": case.pk}),
            {
                "bags": [
                    {
                        "seal_tag_numbers": "T100",
                        "new_seal_tag_numbers": "T200",
                        "content_type": "plant",
                    },
                    {
                        "seal_tag_numbers": "T300",
                        "new_seal_tag_numbers": "",
                        "content_type": "plant",
                    },
                ]
            },
            format="json",
        )
        assert resp.status_code == 201
        assert len(resp.data) == 2


class TestSingleCreateTagRule:
    def test_same_original_and_new_allowed(self, finance_client):
        case = CaseFactory()
        resp = finance_client.post(
            reverse("drugbag_list", kwargs={"pk": case.pk}),
            {
                "submission": case.pk,
                "seal_tag_numbers": "555",
                "new_seal_tag_numbers": "555",
                "content_type": "plant",
            },
            format="json",
        )
        assert resp.status_code == 201

    def test_new_tag_colliding_with_existing_bag_rejected(self, finance_client):
        other_case = CaseFactory()
        DrugBagFactory(submission=other_case, seal_tag_numbers="999")
        case = CaseFactory()
        resp = finance_client.post(
            reverse("drugbag_list", kwargs={"pk": case.pk}),
            {
                "submission": case.pk,
                "seal_tag_numbers": "888",
                "new_seal_tag_numbers": "999",
                "content_type": "plant",
            },
            format="json",
        )
        assert resp.status_code == 400


class TestUpdateTagRule:
    def test_new_tag_equal_to_own_original_allowed(self, finance_client):
        case = CaseFactory()
        bag = DrugBagFactory(submission=case, seal_tag_numbers="777")
        resp = finance_client.patch(
            reverse("drugbag_detail", kwargs={"pk": bag.pk}),
            {"new_seal_tag_numbers": "777"},
            format="json",
        )
        assert resp.status_code == 200
        bag.refresh_from_db()
        assert bag.new_seal_tag_numbers == "777"
