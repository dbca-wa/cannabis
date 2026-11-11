"""Who may change a user's access: admin status, superuser, role and account.

A user may edit their own name through the user detail endpoint, but must not
be able to give themselves more access. Only administrators change roles and
access, only superusers grant superuser, and nobody changes their own admin
status (matching the promote/demote endpoint).
"""

import pytest
from django.urls import reverse

pytestmark = pytest.mark.django_db


def _patch(client, user, data):
    return client.patch(
        reverse("user_detail", kwargs={"pk": user.pk}), data, format="json"
    )


class TestSelfEditByNonAdmin:
    @pytest.mark.parametrize(
        "field, value",
        [
            ("is_superuser", True),
            ("is_staff", True),
            ("role", "finance"),
            ("is_active", False),
            ("is_legacy", True),
            ("email", "someone.else@dbca.wa.gov.au"),
        ],
    )
    def test_cannot_change_own_access(
        self, botanist_client, botanist_user, field, value
    ):
        before = getattr(botanist_user, field)
        resp = _patch(botanist_client, botanist_user, {field: value})

        assert resp.status_code == 403
        botanist_user.refresh_from_db()
        assert getattr(botanist_user, field) == before

    def test_can_still_change_own_name(self, botanist_client, botanist_user):
        resp = _patch(botanist_client, botanist_user, {"given_names": "Robin"})

        assert resp.status_code == 200
        botanist_user.refresh_from_db()
        assert botanist_user.given_names == "Robin"

    def test_sending_unchanged_values_is_not_refused(
        self, botanist_client, botanist_user
    ):
        resp = _patch(
            botanist_client,
            botanist_user,
            {
                "role": botanist_user.role,
                "is_staff": botanist_user.is_staff,
                "email": botanist_user.email,
            },
        )

        assert resp.status_code == 200


class TestAdminEdits:
    def test_staff_can_change_another_users_role(self, api_client, finance_user):
        from common.tests.factories import UserFactory

        staff = UserFactory(is_staff=True, role="botanist")
        api_client.force_authenticate(user=staff)

        resp = _patch(api_client, finance_user, {"role": "botanist"})

        assert resp.status_code == 200
        finance_user.refresh_from_db()
        assert finance_user.role == "botanist"

    def test_staff_cannot_grant_superuser(self, api_client, finance_user):
        from common.tests.factories import UserFactory

        staff = UserFactory(is_staff=True, role="botanist")
        api_client.force_authenticate(user=staff)

        resp = _patch(api_client, finance_user, {"is_superuser": True})

        assert resp.status_code == 403
        finance_user.refresh_from_db()
        assert finance_user.is_superuser is False

    def test_superuser_can_grant_superuser(self, admin_client, finance_user):
        resp = _patch(admin_client, finance_user, {"is_superuser": True})

        assert resp.status_code == 200
        finance_user.refresh_from_db()
        assert finance_user.is_superuser is True

    @pytest.mark.parametrize(
        "field, value",
        [("is_staff", False), ("is_superuser", False), ("is_active", False)],
    )
    def test_admin_cannot_change_own_access(
        self, admin_client, admin_user, field, value
    ):
        resp = _patch(admin_client, admin_user, {field: value})

        assert resp.status_code == 403
        admin_user.refresh_from_db()
        assert getattr(admin_user, field) is True
