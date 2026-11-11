"""A completed form's bags and results are read-only for non-administrators.

The case page already shows a completed form as read-only, and the form and
workflow endpoints refuse changes. The bag and assessment endpoints must refuse
them too, or the certificate in a finished batch could be changed underneath it.
"""

import pytest
from django.urls import reverse

from common.tests.factories import (
    BotanicalAssessmentFactory,
    DrugBagFactory,
    Priority3FormFactory,
)

pytestmark = pytest.mark.django_db

LOCKED = "This form's certificate is complete and can no longer be edited."


@pytest.fixture
def complete_bag(db):
    form = Priority3FormFactory(phase="complete")
    bag = DrugBagFactory(form=form, seal_tag_numbers="T1001")
    assessment = BotanicalAssessmentFactory(drug_bag=bag)
    return bag, assessment


def _refused(resp):
    assert resp.status_code == 403
    assert str(resp.data["detail"]) == LOCKED


class TestNonAdmin:
    def test_cannot_edit_a_bag(self, botanist_client, complete_bag):
        bag, _ = complete_bag
        resp = botanist_client.patch(
            reverse("drugbag_detail", kwargs={"pk": bag.pk}),
            {"seal_tag_numbers": "T9999"},
            format="json",
        )
        _refused(resp)
        bag.refresh_from_db()
        assert bag.seal_tag_numbers == "T1001"

    def test_cannot_delete_a_bag(self, botanist_client, complete_bag):
        bag, _ = complete_bag
        _refused(
            botanist_client.delete(reverse("drugbag_detail", kwargs={"pk": bag.pk}))
        )

    def test_cannot_change_a_result(self, botanist_client, complete_bag):
        _, assessment = complete_bag
        resp = botanist_client.patch(
            reverse("assessment_detail", kwargs={"pk": assessment.pk}),
            {"determination": "not_cannabis"},
            format="json",
        )
        _refused(resp)
        assessment.refresh_from_db()
        assert assessment.determination == "cannabis_sativa"

    def test_cannot_delete_a_result(self, botanist_client, complete_bag):
        _, assessment = complete_bag
        _refused(
            botanist_client.delete(
                reverse("assessment_detail", kwargs={"pk": assessment.pk})
            )
        )

    def test_cannot_add_bags(self, botanist_client, complete_bag):
        bag, _ = complete_bag
        resp = botanist_client.post(
            reverse("drugbag_batch_create", kwargs={"pk": bag.form.pk}),
            {"bags": [{"seal_tag_numbers": "T2002", "content_type": "plant"}]},
            format="json",
        )
        _refused(resp)

    def test_can_still_edit_a_bag_on_an_open_form(self, botanist_client):
        bag = DrugBagFactory(form=Priority3FormFactory(phase="assessment"))
        resp = botanist_client.patch(
            reverse("drugbag_detail", kwargs={"pk": bag.pk}),
            {"new_seal_tag_numbers": "N5000"},
            format="json",
        )
        assert resp.status_code == 200


class TestAdmin:
    def test_can_correct_a_completed_bag(self, admin_client, complete_bag):
        bag, _ = complete_bag
        resp = admin_client.patch(
            reverse("drugbag_detail", kwargs={"pk": bag.pk}),
            {"new_seal_tag_numbers": "N5000"},
            format="json",
        )
        assert resp.status_code == 200

    def test_can_correct_a_completed_result(self, admin_client, complete_bag):
        _, assessment = complete_bag
        resp = admin_client.patch(
            reverse("assessment_detail", kwargs={"pk": assessment.pk}),
            {"determination": "inconclusive"},
            format="json",
        )
        assert resp.status_code == 200
