"""Practice mode never changes real, shared data.

Settings, Section C templates, staff accounts and invitations have no practice
copy, so changing them while in practice mode is refused with a message that
says how to proceed. Reading them is still allowed.
"""

import secrets

import pytest
from django.urls import reverse

from cases.models import SectionCTemplate
from common.models import SystemSettings
from common.permissions import PRACTICE_MODE_BLOCKED

pytestmark = pytest.mark.django_db


@pytest.fixture
def practising_admin(admin_client, admin_user):
    prefs = admin_user.get_preferences
    prefs.practice_mode = True
    prefs.save(update_fields=["practice_mode"])
    return admin_client


@pytest.fixture
def template(db):
    return SectionCTemplate.objects.create(name="SME", content="Envelope {{sme}}.")


def _refused(resp):
    assert resp.status_code == 403
    assert str(resp.data["detail"]) == PRACTICE_MODE_BLOCKED


class TestSettings:
    def test_reading_is_allowed(self, practising_admin):
        assert practising_admin.get(reverse("system-settings")).status_code == 200

    def test_changing_is_refused(self, practising_admin):
        before = SystemSettings.load().certificate_counter
        resp = practising_admin.patch(
            reverse("system-settings"), {"certificate_counter": 5}, format="json"
        )
        _refused(resp)
        assert SystemSettings.load().certificate_counter == before

    def test_changing_is_allowed_outside_practice_mode(self, admin_client):
        resp = admin_client.patch(
            reverse("system-settings"), {"cost_per_bag": "12.00"}, format="json"
        )
        assert resp.status_code == 200


class TestTemplates:
    def test_listing_is_allowed(self, practising_admin, template):
        resp = practising_admin.get(reverse("section_c_template_list"))
        assert resp.status_code == 200

    def test_creating_is_refused(self, practising_admin):
        resp = practising_admin.post(
            reverse("section_c_template_list"),
            {"name": "New", "content": "Text"},
            format="json",
        )
        _refused(resp)
        assert not SectionCTemplate.objects.filter(name="New").exists()

    def test_editing_is_refused(self, practising_admin, template):
        resp = practising_admin.patch(
            reverse("section_c_template_detail", kwargs={"pk": template.pk}),
            {"content": "Changed"},
            format="json",
        )
        _refused(resp)
        template.refresh_from_db()
        assert template.content == "Envelope {{sme}}."

    def test_deleting_is_refused(self, practising_admin, template):
        resp = practising_admin.delete(
            reverse("section_c_template_detail", kwargs={"pk": template.pk})
        )
        _refused(resp)
        assert SectionCTemplate.objects.filter(pk=template.pk).exists()


class TestStaffAndInvitations:
    def test_editing_a_user_is_refused(self, practising_admin, finance_user):
        resp = practising_admin.patch(
            reverse("user_detail", kwargs={"pk": finance_user.pk}),
            {"given_names": "Changed"},
            format="json",
        )
        _refused(resp)

    def test_viewing_a_user_is_allowed(self, practising_admin, finance_user):
        resp = practising_admin.get(
            reverse("user_detail", kwargs={"pk": finance_user.pk})
        )
        assert resp.status_code == 200

    def test_deleting_a_user_is_refused(self, practising_admin, finance_user):
        resp = practising_admin.delete(
            reverse("user_detail", kwargs={"pk": finance_user.pk})
        )
        _refused(resp)

    def test_creating_a_user_is_refused(self, practising_admin):
        # Generated at runtime so no password literal sits in source control.
        password = secrets.token_urlsafe(16)
        resp = practising_admin.post(
            reverse("user_list"),
            {
                "email": "new.person@dbca.wa.gov.au",
                "password": password,
                "password_confirm": password,
            },
            format="json",
        )
        _refused(resp)

    def test_promoting_is_refused(self, practising_admin, finance_user):
        resp = practising_admin.patch(
            reverse("user_admin_status", kwargs={"pk": finance_user.pk}),
            {"action": "promote"},
            format="json",
        )
        _refused(resp)

    def test_sending_a_reset_email_is_refused(self, practising_admin, finance_user):
        resp = practising_admin.post(
            reverse("admin_send_reset_email", kwargs={"pk": finance_user.pk})
        )
        _refused(resp)

    def test_inviting_is_refused(self, practising_admin):
        resp = practising_admin.post(
            reverse("invite_user"),
            {"email": "new.person@dbca.wa.gov.au", "role": "finance"},
            format="json",
        )
        _refused(resp)

    def test_sending_a_test_invite_is_refused(self, practising_admin):
        resp = practising_admin.post(
            reverse("test_invite_email"),
            {"email": "someone@dbca.wa.gov.au", "role": "finance"},
            format="json",
        )
        _refused(resp)

    def test_revoking_an_invite_is_refused(self, practising_admin):
        resp = practising_admin.post(reverse("invite_revoke", kwargs={"pk": 1}))
        _refused(resp)

    def test_listing_invites_is_allowed(self, practising_admin):
        assert practising_admin.get(reverse("invite_list")).status_code == 200
