"""Give named staff accounts and email their invitations.

Each person is given as ``email:role[:flags[:Name]]``, for example::

    python manage.py provision_staff \\
        john.huisman@dbca.wa.gov.au:botanist:admin,superuser \\
        sharon.griffiths@dbca.wa.gov.au:finance:admin

Roles are the app roles (botanist, finance, none). Flags: ``admin`` (app
administrator), ``superuser`` (Django admin), ``maintainer`` (legacy import).
Names come from the DBCA directory; add ``:Given Names Surname`` to an entry
so it still works when the directory is unavailable or does not list them.

People who can already sign in are left alone, and anyone with a pending
invitation is not invited twice, so the command is safe to run again. Names
come from the DBCA directory. A botanist whose name matches an account the
legacy import made for a former botanist gets that account, so their past
cases stay with them.

Run it before the legacy import on a new environment, so each botanist's
history attaches to their real account straight away.
"""

from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction

User = get_user_model()


def add_staff_arguments(parser, positional=True):
    """The arguments shared with purge_case_data --staff."""
    if positional:
        parser.add_argument(
            "staff",
            nargs="+",
            metavar="EMAIL:ROLE[:FLAGS]",
            help="A person to give an account, e.g. jane.doe@dbca.wa.gov.au:finance",
        )
    parser.add_argument(
        "--invited-by",
        metavar="EMAIL",
        help="Who the invitations come from (default: the first active maintainer).",
    )
    parser.add_argument(
        "--no-email",
        action="store_true",
        help="Do not email invitations; print each invitation link to pass on instead.",
    )


def parse_specs(specs_text):
    from users.services.staff_accounts import StaffSpec

    try:
        return [StaffSpec.parse(text) for text in specs_text]
    except ValueError as exc:
        raise CommandError(str(exc))


def check_staff_can_be_provisioned(specs_text):
    """Refuse up front if anyone listed could not be given an account.

    purge_case_data runs this before deleting, so a directory outage or a typo
    stops the whole command instead of leaving a cleared site with no accounts.
    """
    from users.services.staff_accounts import resolve_people

    specs = parse_specs(specs_text)
    need = [
        spec
        for spec in specs
        if not User.objects.filter(email__iexact=spec.email, is_active=True).exists()
    ]
    _, problems, _ = resolve_people(need)
    if problems:
        raise CommandError(
            "Nothing was changed. These people could not be given accounts:\n  "
            + "\n  ".join(problems)
        )


def run_provisioning(command, specs_text, invited_by_email, send_email, dry_run):
    """Parse, provision and report. Shared by both commands."""
    from users.services.staff_accounts import provision_staff

    specs = parse_specs(specs_text)

    if invited_by_email:
        inviter = User.objects.filter(
            email__iexact=invited_by_email, is_active=True
        ).first()
        if inviter is None:
            raise CommandError(
                f"No active user {invited_by_email} to send invitations from."
            )
    else:
        inviter = (
            User.objects.filter(is_active=True, is_maintainer=True)
            .order_by("pk")
            .first()
            or User.objects.filter(is_active=True, is_superuser=True)
            .order_by("pk")
            .first()
        )
        if inviter is None:
            raise CommandError("No active maintainer or superuser; pass --invited-by.")

    with transaction.atomic():
        results = provision_staff(specs, inviter, send_email=send_email and not dry_run)
        if dry_run:
            transaction.set_rollback(True)

    prefix = "Would be: " if dry_run else ""
    for result in results:
        line = f"  {result.email}: {prefix}{result.outcome}"
        if result.detail:
            line += f" ({result.detail})"
        style = (
            command.style.SUCCESS
            if result.outcome == "invited"
            else command.style.WARNING
        )
        if result.outcome == "already has an account":
            style = str
        command.stdout.write(style(line))
        if result.link and not send_email and not dry_run:
            command.stdout.write(f"    Invitation link (valid 24 hours): {result.link}")
    missing = [
        r.email
        for r in results
        if r.outcome in ("not in the DBCA directory", "directory unavailable")
    ]
    if missing:
        command.stdout.write(
            command.style.ERROR(
                "Not invited (add their name to the entry): " + ", ".join(missing)
            )
        )
    return results


class Command(BaseCommand):
    help = "Give named staff accounts and email their invitations."

    def add_arguments(self, parser):
        add_staff_arguments(parser)
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="Report what would happen without changing anything or sending email.",
        )

    def handle(self, *args, **options):
        self.stdout.write("Staff accounts:")
        run_provisioning(
            self,
            options["staff"],
            options["invited_by"],
            send_email=not options["no_email"],
            dry_run=options["dry_run"],
        )
