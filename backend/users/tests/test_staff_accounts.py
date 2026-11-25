"""Staff accounts: linking former-botanist accounts, and provision_staff.

Names, emails and badge numbers here are made up.
"""

from datetime import timedelta
from io import StringIO
from unittest.mock import patch

import pytest
from django.contrib.auth import get_user_model
from django.core.management import call_command
from django.core.management.base import CommandError
from django.urls import reverse
from django.utils import timezone

from common.services.email_service import EmailSendError
from common.tests.factories import CaseFactory
from users.models import InviteRecord
from users.services.staff_accounts import StaffSpec, find_placeholder, provision_staff

User = get_user_model()
pytestmark = pytest.mark.django_db

SEND = "common.services.email_service.send_email_with_embedded_image"
DIRECTORY = "users.services.staff_accounts.fetch_directory_users"

PEOPLE = [
    {
        "email": "jo.marsh@example.gov.au",
        "given_name": "Jo",
        "surname": "Marsh",
        "id": 11,
        "employee_id": "E11",
    },
    {
        "email": "pat.lee@example.gov.au",
        "given_name": "Pat",
        "surname": "Lee",
        "id": 12,
        "employee_id": "E12",
    },
]


def _placeholder(given="Jo", last="Marsh", email="legacy.jo.marsh@example.gov.au"):
    """An account the legacy import makes for a former botanist."""
    user = User.objects.create(
        email=email,
        given_names=given,
        last_name=last,
        role=User.RoleChoices.BOTANIST,
        is_active=False,
        is_legacy=True,
    )
    user.set_unusable_password()
    user.save()
    return user


def _invite(
    inviter, email="jo.marsh@example.gov.au", role="botanist", given="Jo", last="Marsh"
):
    return InviteRecord.objects.create(
        email=email,
        invited_by=inviter,
        role=role,
        token=f"tok-{email}-{role}",
        expires_at=timezone.now() + timedelta(hours=24),
        external_user_data={
            "given_name": given,
            "surname": last,
            "id": 11,
            "employee_id": "E11",
        },
    )


def _accept(client, invite):
    return client.post(reverse("activate_invite", kwargs={"token": invite.token}))


class TestFindPlaceholder:
    def test_matches_the_name_in_any_order(self):
        placeholder = _placeholder()
        assert find_placeholder("Jo", "Marsh") == placeholder
        assert find_placeholder("MARSH,", "Jo") == placeholder

    def test_two_with_the_same_name_are_ambiguous(self):
        _placeholder(email="legacy.jo.marsh@example.gov.au")
        _placeholder(email="legacy.jo.marsh.2@example.gov.au")
        assert find_placeholder("Jo", "Marsh") is None

    def test_real_accounts_are_never_placeholders(self):
        real = _placeholder()
        real.set_password("x-Strong-Pass-1")
        real.save()
        assert find_placeholder("Jo", "Marsh") is None


class TestAcceptingAnInvitation:
    def test_a_botanist_takes_over_their_former_account_and_cases(
        self, api_client, admin_user
    ):
        placeholder = _placeholder()
        case = CaseFactory(approved_botanist=placeholder)
        before = User.objects.count()

        resp = _accept(api_client, _invite(admin_user))

        assert resp.status_code == 200
        assert User.objects.count() == before
        placeholder.refresh_from_db()
        assert placeholder.email == "jo.marsh@example.gov.au"
        assert placeholder.is_active and not placeholder.is_legacy
        assert placeholder.has_usable_password()
        case.refresh_from_db()
        assert case.approved_botanist_id == placeholder.pk

    def test_someone_invited_to_another_role_gets_a_new_account(
        self, api_client, admin_user
    ):
        placeholder = _placeholder()

        _accept(api_client, _invite(admin_user, role="finance"))

        placeholder.refresh_from_db()
        assert placeholder.is_legacy and not placeholder.is_active
        assert User.objects.get(email="jo.marsh@example.gov.au").pk != placeholder.pk

    def test_a_different_name_gets_a_new_account(self, api_client, admin_user):
        placeholder = _placeholder()

        _accept(
            api_client,
            _invite(
                admin_user, email="pat.lee@example.gov.au", given="Pat", last="Lee"
            ),
        )

        placeholder.refresh_from_db()
        assert placeholder.is_legacy
        assert User.objects.filter(
            email="pat.lee@example.gov.au", is_legacy=False
        ).exists()


class TestStaffSpec:
    def test_parses_role_and_flags(self):
        spec = StaffSpec.parse("Jo.Marsh@example.gov.au:botanist:admin,superuser")
        assert (spec.email, spec.role, spec.flags) == (
            "jo.marsh@example.gov.au",
            "botanist",
            ["admin", "superuser"],
        )

    @pytest.mark.parametrize(
        "text", ["jo.marsh", "jo@x.au:cook", "jo@x.au:finance:wizard", "a:b:c:d"]
    )
    def test_refuses_bad_entries(self, text):
        with pytest.raises(ValueError):
            StaffSpec.parse(text)


class TestProvisionStaff:
    @pytest.fixture(autouse=True)
    def directory(self):
        with patch(DIRECTORY, return_value=PEOPLE):
            yield

    def test_prepares_an_inactive_account_and_emails_the_invitation(self, admin_user):
        with patch(SEND) as send:
            [result] = provision_staff(
                [StaffSpec.parse("pat.lee@example.gov.au:finance:admin,superuser")],
                admin_user,
            )

        assert result.outcome == "invited"
        user = User.objects.get(email="pat.lee@example.gov.au")
        assert (user.given_names, user.last_name, user.role) == (
            "Pat",
            "Lee",
            "finance",
        )
        assert not user.is_active and user.is_staff and user.is_superuser
        assert not user.has_usable_password()
        assert send.call_count == 1
        assert InviteRecord.objects.filter(
            email="pat.lee@example.gov.au", is_used=False
        ).exists()

    def test_accepting_keeps_the_flags_and_activates_the_same_account(
        self, api_client, admin_user
    ):
        with patch(SEND):
            provision_staff(
                [StaffSpec.parse("pat.lee@example.gov.au:finance:admin,superuser")],
                admin_user,
            )
        account = User.objects.get(email="pat.lee@example.gov.au")
        invite = InviteRecord.objects.get(email="pat.lee@example.gov.au")

        assert (
            api_client.post(
                reverse("activate_invite", kwargs={"token": invite.token})
            ).status_code
            == 200
        )

        account.refresh_from_db()
        assert account.is_active and account.is_staff and account.is_superuser
        assert User.objects.filter(email="pat.lee@example.gov.au").count() == 1

    def test_a_botanist_is_linked_to_their_former_account(self, admin_user):
        placeholder = _placeholder()
        CaseFactory(approved_botanist=placeholder)

        with patch(SEND):
            [result] = provision_staff(
                [StaffSpec.parse("jo.marsh@example.gov.au:botanist")], admin_user
            )

        placeholder.refresh_from_db()
        assert (
            placeholder.email == "jo.marsh@example.gov.au" and not placeholder.is_legacy
        )
        assert "1 past cases" in result.detail

    def test_the_import_then_reuses_the_prepared_account(self, admin_user):
        from cases.legacy_import.resolvers import BotanistResolver

        with patch(SEND):
            provision_staff(
                [StaffSpec.parse("jo.marsh@example.gov.au:botanist")], admin_user
            )
        import_user = User.objects.create(
            email="legacy-import@system.invalid", is_active=False
        )

        resolved = BotanistResolver(import_user).resolve("MARSH, Jo")

        assert resolved.email == "jo.marsh@example.gov.au"

    def test_is_safe_to_run_again(self, admin_user, botanist_user):
        specs = [
            StaffSpec.parse(f"{botanist_user.email}:botanist"),
            StaffSpec.parse("pat.lee@example.gov.au:finance"),
        ]
        with patch(SEND) as send:
            first = provision_staff(specs, admin_user)
            second = provision_staff(specs, admin_user)

        assert [r.outcome for r in first] == ["already has an account", "invited"]
        assert [r.outcome for r in second] == [
            "already has an account",
            "already invited",
        ]
        assert send.call_count == 1

    def test_someone_not_in_the_directory_is_reported(self, admin_user):
        [result] = provision_staff(
            [StaffSpec.parse("nobody@example.gov.au:finance")], admin_user
        )
        assert result.outcome == "not in the DBCA directory"
        assert not User.objects.filter(email="nobody@example.gov.au").exists()

    def test_a_failed_email_leaves_no_invitation(self, admin_user):
        with (
            patch(SEND, side_effect=RuntimeError("smtp down")),
            pytest.raises(EmailSendError),
        ):
            provision_staff(
                [StaffSpec.parse("pat.lee@example.gov.au:finance")], admin_user
            )
        assert not InviteRecord.objects.filter(email="pat.lee@example.gov.au").exists()


class TestProvisionStaffCommand:
    @pytest.fixture(autouse=True)
    def directory(self):
        with patch(DIRECTORY, return_value=PEOPLE):
            yield

    def test_no_email_prints_the_link_instead(self, admin_user):
        out = StringIO()
        with patch(SEND) as send:
            call_command(
                "provision_staff",
                "pat.lee@example.gov.au:finance",
                "--no-email",
                stdout=out,
            )
        assert send.call_count == 0
        assert "/auth/activate-invite/" in out.getvalue()

    def test_dry_run_changes_nothing(self, admin_user):
        out = StringIO()
        with patch(SEND) as send:
            call_command(
                "provision_staff",
                "pat.lee@example.gov.au:finance",
                "--dry-run",
                stdout=out,
            )
        assert "Would be: invited" in out.getvalue()
        assert send.call_count == 0
        assert not User.objects.filter(email="pat.lee@example.gov.au").exists()
        assert not InviteRecord.objects.exists()

    def test_a_bad_entry_stops_before_anything_happens(self, admin_user):
        with pytest.raises(CommandError):
            call_command(
                "provision_staff",
                "pat.lee@example.gov.au:finance",
                "oops",
                stdout=StringIO(),
            )
        assert not User.objects.filter(email="pat.lee@example.gov.au").exists()


class TestWhenTheDirectoryCannotHelp:
    def test_the_typed_name_is_used_when_the_directory_is_down(self, admin_user):
        from users.services.staff_accounts import DirectoryUnavailable

        with (
            patch(
                "users.services.staff_accounts.find_directory_person",
                side_effect=DirectoryUnavailable("500"),
            ),
            patch(SEND),
        ):
            [result] = provision_staff(
                [StaffSpec.parse("pat.lee@example.gov.au:finance:admin:Pat Anne Lee")],
                admin_user,
            )

        assert result.outcome == "invited"
        assert "name as typed" in result.detail
        user = User.objects.get(email="pat.lee@example.gov.au")
        assert (user.given_names, user.last_name) == ("Pat Anne", "Lee")

    def test_the_directory_wins_over_a_typed_name(self, admin_user):
        with patch(DIRECTORY, return_value=PEOPLE), patch(SEND):
            provision_staff(
                [StaffSpec.parse("pat.lee@example.gov.au:finance::Patricia Lea")],
                admin_user,
            )
        user = User.objects.get(email="pat.lee@example.gov.au")
        assert (user.given_names, user.last_name, user.it_asset_id) == (
            "Pat",
            "Lee",
            12,
        )

    def test_without_a_name_nobody_is_invited_while_the_directory_is_down(
        self, admin_user
    ):
        from users.services.staff_accounts import DirectoryUnavailable

        with (
            patch(
                "users.services.staff_accounts.find_directory_person",
                side_effect=DirectoryUnavailable("500"),
            ),
            patch(SEND) as send,
        ):
            [result] = provision_staff(
                [StaffSpec.parse("pat.lee@example.gov.au:finance")], admin_user
            )

        assert result.outcome == "directory unavailable"
        assert send.call_count == 0
        assert not User.objects.filter(email="pat.lee@example.gov.au").exists()

    def test_the_name_part_is_parsed(self):
        spec = StaffSpec.parse("pat.lee@example.gov.au:finance:admin,superuser:Pat Lee")
        assert (spec.flags, spec.name) == (["admin", "superuser"], "Pat Lee")
        assert StaffSpec.parse("pat.lee@example.gov.au:finance::Pat Lee").flags == []
