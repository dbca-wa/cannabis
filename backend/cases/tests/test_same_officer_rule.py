"""One person cannot be both a case's conveying and requesting officer.

The rule applies to new cases and to changes made from now on. Older cases that
already name one officer in both roles (for example from the ETL) keep working.
"""

import pytest
from django.urls import reverse

from cases.validators import SAME_OFFICER_MESSAGE
from common.tests.factories import BotanistFactory, CaseFactory, PoliceOfficerFactory

pytestmark = pytest.mark.django_db


@pytest.fixture
def officers(db):
    return PoliceOfficerFactory(), PoliceOfficerFactory()


def _create(client, sub, req):
    return client.post(
        reverse("case_list"),
        {
            "case_number": "IR 777",
            "received": "2026-11-10",
            "submitting_officer": sub.pk,
            "requesting_officer": req.pk if req else None,
            "approved_botanist": BotanistFactory().pk,
            "defendants": [],
        },
        format="json",
    )


def _patch(client, case, data):
    return client.patch(
        reverse("case_detail", kwargs={"pk": case.pk}), data, format="json"
    )


class TestNewCases:
    def test_refuses_one_officer_in_both_roles(self, admin_client, officers):
        a, _ = officers
        resp = _create(admin_client, a, a)
        assert resp.status_code == 400
        assert resp.data["requesting_officer"] == [SAME_OFFICER_MESSAGE]

    def test_accepts_two_officers(self, admin_client, officers):
        a, b = officers
        assert _create(admin_client, a, b).status_code == 201

    def test_accepts_no_requesting_officer(self, admin_client, officers):
        a, _ = officers
        assert _create(admin_client, a, None).status_code == 201


class TestChanges:
    def test_refuses_making_the_requesting_officer_the_conveying_one(
        self, admin_client, officers
    ):
        a, b = officers
        case = CaseFactory(submitting_officer=a, requesting_officer=b)
        resp = _patch(admin_client, case, {"requesting_officer": a.pk})
        assert resp.status_code == 400
        case.refresh_from_db()
        assert case.requesting_officer_id == b.pk

    def test_refuses_making_the_conveying_officer_the_requesting_one(
        self, admin_client, officers
    ):
        a, b = officers
        case = CaseFactory(submitting_officer=a, requesting_officer=b)
        resp = _patch(admin_client, case, {"submitting_officer": b.pk})
        assert resp.status_code == 400


class TestLegacyCases:
    @pytest.fixture
    def legacy(self, officers):
        a, _ = officers
        return CaseFactory(submitting_officer=a, requesting_officer=a)

    def test_can_still_edit_other_details(self, admin_client, legacy):
        resp = _patch(admin_client, legacy, {"internal_comments": "Checked."})
        assert resp.status_code == 200

    def test_can_resend_the_same_officers(self, admin_client, legacy):
        a = legacy.submitting_officer
        resp = _patch(
            admin_client,
            legacy,
            {"submitting_officer": a.pk, "requesting_officer": a.pk},
        )
        assert resp.status_code == 200

    def test_can_fix_the_clash(self, admin_client, legacy, officers):
        _, b = officers
        resp = _patch(admin_client, legacy, {"requesting_officer": b.pk})
        assert resp.status_code == 200

    def test_cannot_move_the_clash_to_another_officer(
        self, admin_client, legacy, officers
    ):
        _, b = officers
        resp = _patch(
            admin_client,
            legacy,
            {"submitting_officer": b.pk, "requesting_officer": b.pk},
        )
        assert resp.status_code == 400


class TestMergingOfficers:
    def _merge(self, client, source, target):
        return client.post(
            reverse("officer_merge"),
            {"source_officer_id": source.pk, "target_officer_id": target.pk},
            format="json",
        )

    def test_merging_the_two_officers_on_a_case_is_refused(
        self, botanist_client, officers
    ):
        a, b = officers
        case = CaseFactory(submitting_officer=a, requesting_officer=b)

        response = self._merge(botanist_client, a, b)

        assert response.status_code == 400
        assert case.case_number in str(response.data)
        case.refresh_from_db()
        assert (case.submitting_officer_id, case.requesting_officer_id) == (a.pk, b.pk)

    def test_merging_officers_on_separate_cases_moves_them(
        self, botanist_client, officers
    ):
        a, b = officers
        conveying = CaseFactory(submitting_officer=a, requesting_officer=None)
        requesting = CaseFactory(
            submitting_officer=PoliceOfficerFactory(), requesting_officer=a
        )

        response = self._merge(botanist_client, a, b)

        assert response.status_code == 200
        conveying.refresh_from_db()
        requesting.refresh_from_db()
        assert conveying.submitting_officer_id == b.pk
        assert requesting.requesting_officer_id == b.pk

    def test_an_older_case_naming_the_duplicate_twice_moves_whole(
        self, botanist_client, officers
    ):
        a, b = officers
        legacy = CaseFactory(submitting_officer=a, requesting_officer=a)

        response = self._merge(botanist_client, a, b)

        assert response.status_code == 200
        legacy.refresh_from_db()
        assert (legacy.submitting_officer_id, legacy.requesting_officer_id) == (
            b.pk,
            b.pk,
        )
