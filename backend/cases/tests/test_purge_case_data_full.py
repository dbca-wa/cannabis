"""purge_case_data --full and --staff.

--full removes what legacy imports leave behind so the next import starts from
nothing; --staff then gives named people accounts and invites them. Names and
emails here are made up.
"""

from io import StringIO
from unittest.mock import patch

import pytest
from django.contrib.auth import get_user_model
from django.core.management import call_command

from cases.models import LegacyImportRun, LegacySourceRecord
from common.tests.factories import CaseFactory
from users.models import InviteRecord

User = get_user_model()
pytestmark = pytest.mark.django_db

SEND = "common.services.email_service.send_email_with_embedded_image"
DIRECTORY = "users.services.staff_accounts.fetch_directory_users"


def _user(email, role="botanist", legacy=False, superuser=False, active=True):
    return User.objects.create(
        email=email,
        given_names=email.split(".")[0].title(),
        last_name=email.split(".")[1].split("@")[0].title(),
        role=role,
        is_legacy=legacy,
        is_superuser=superuser,
        is_staff=superuser,
        is_active=active,
    )


@pytest.fixture
def leftovers(admin_user):
    """What an earlier import leaves: source rows, a run, its user and botanists."""
    case = CaseFactory(case_number="IR 1")
    LegacySourceRecord.objects.create(
        certificate_number="R1",
        source_table="Cannabis",
        source_row={},
        transformed={},
        case=case,
    )
    LegacyImportRun.objects.create(action="import", started_by=admin_user)
    return {
        "import_user": _user(
            "legacy-import@system.invalid", role="none", legacy=True, active=False
        ),
        # Made by the current import: inactive placeholder.
        "placeholder": _user(
            "legacy.jo.marsh@example.gov.au", legacy=True, active=False
        ),
        # Made by the earlier import: active, with a guessed real-looking email.
        "old_import": _user("alex.chan@example.gov.au", legacy=True),
        # Kept: a real botanist, a finance user, and a superuser flagged legacy.
        "real_botanist": _user("kim.shore@example.gov.au"),
        "finance": _user("pat.lee@example.gov.au", role="finance"),
        "legacy_superuser": _user(
            "ben.rich@example.gov.au", role="none", legacy=True, superuser=True
        ),
    }


class TestFull:
    def test_dry_run_lists_the_accounts_and_deletes_nothing(self, leftovers):
        out = StringIO()
        call_command("purge_case_data", "--full", stdout=out)

        assert "legacy.jo.marsh@example.gov.au" in out.getvalue()
        assert "alex.chan@example.gov.au" in out.getvalue()
        assert LegacySourceRecord.objects.count() == 1
        assert User.objects.filter(email="legacy.jo.marsh@example.gov.au").exists()

    def test_removes_import_leftovers_and_former_botanists_only(self, leftovers):
        call_command("purge_case_data", "--confirm", "--full", stdout=StringIO())

        assert LegacySourceRecord.objects.count() == 0
        assert LegacyImportRun.objects.count() == 0
        remaining = set(User.objects.values_list("email", flat=True))
        for gone in ("import_user", "placeholder", "old_import"):
            assert leftovers[gone].email not in remaining
        for kept in ("real_botanist", "finance", "legacy_superuser"):
            assert leftovers[kept].email in remaining

    def test_without_full_no_user_is_deleted(self, leftovers):
        before = User.objects.count()
        call_command("purge_case_data", "--confirm", stdout=StringIO())
        assert User.objects.count() == before
        assert LegacySourceRecord.objects.count() == 1


class TestStaff:
    PEOPLE = [
        {
            "email": "sam.vale@example.gov.au",
            "given_name": "Sam",
            "surname": "Vale",
            "id": 5,
        }
    ]

    def test_invites_the_named_people_after_clearing(self, admin_user):
        out = StringIO()
        with patch(DIRECTORY, return_value=self.PEOPLE), patch(SEND) as send:
            call_command(
                "purge_case_data",
                "--confirm",
                "--staff",
                "sam.vale@example.gov.au:finance",
                stdout=out,
            )

        assert "sam.vale@example.gov.au: invited" in out.getvalue()
        assert send.call_count == 1
        assert InviteRecord.objects.filter(email="sam.vale@example.gov.au").exists()

    def test_the_dry_run_previews_without_inviting(self, admin_user):
        out = StringIO()
        with patch(DIRECTORY, return_value=self.PEOPLE), patch(SEND) as send:
            call_command(
                "purge_case_data",
                "--staff",
                "sam.vale@example.gov.au:finance",
                stdout=out,
            )

        assert "Would be: invited" in out.getvalue()
        assert send.call_count == 0
        assert not InviteRecord.objects.exists()
        assert not User.objects.filter(email="sam.vale@example.gov.au").exists()

    def test_refuses_before_deleting_when_someone_cannot_be_given_an_account(
        self, admin_user
    ):
        from django.core.management.base import CommandError

        from users.services.staff_accounts import DirectoryUnavailable

        CaseFactory(case_number="IR 9")
        with patch(
            "users.services.staff_accounts.find_directory_person",
            side_effect=DirectoryUnavailable("500"),
        ):
            with pytest.raises(CommandError, match="Nothing was changed"):
                call_command(
                    "purge_case_data",
                    "--confirm",
                    "--staff",
                    "sam.vale@example.gov.au:finance",
                    stdout=StringIO(),
                )

        from cases.models import Case

        assert Case.all_objects.filter(case_number="IR 9").exists()
