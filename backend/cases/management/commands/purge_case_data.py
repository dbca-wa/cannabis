"""Delete all case data for a clean slate.

Removes every case and everything that hangs off it — Priority 3 forms, drug
bags, assessments, certificates, batches, phase history and case drafts — then
deletes any police officer, police station or defendant left with no remaining
cases. Shared records still referenced by another case are kept.

By default users are never deleted. Two options extend the clean-up:

``--full`` also removes what earlier legacy imports left behind, so the next
import starts from nothing: the stored source rows, the import history and
any uploaded bundle, the import's own system user, and the accounts made for
former botanists (legacy botanist accounts that are not superusers).

``--staff email:role[:flags] ...`` then makes sure each listed person has an
account and emails their invitation, exactly as ``provision_staff`` does.

Destructive and irreversible. Reports by default; pass --confirm to delete.
"""

from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand
from django.db import transaction

from cases.models import (
    Batch,
    Case,
    CaseDraft,
    CasePhaseHistory,
    LegacyImportBundle,
    LegacyImportRun,
    LegacySourceRecord,
)
from common.models import SystemSettings
from defendants.models import Defendant
from police.models import PoliceOfficer, PoliceStation
from users.management.commands.provision_staff import (
    add_staff_arguments,
    check_staff_can_be_provisioned,
    run_provisioning,
)

User = get_user_model()

# The system user the legacy import records its rows against.
IMPORT_USER_EMAIL = "legacy-import@system.invalid"


class Command(BaseCommand):
    help = (
        "Delete all cases and their related data, plus any officer/station/"
        "defendant left orphaned. --full also clears legacy import leftovers; "
        "--staff then gives the named people accounts."
    )

    def add_arguments(self, parser):
        parser.add_argument(
            "--confirm",
            action="store_true",
            help="Actually delete. Without this flag the command only reports.",
        )
        parser.add_argument(
            "--reset-counters",
            action="store_true",
            help="Also reset the certificate and batch number counters to zero.",
        )
        parser.add_argument(
            "--full",
            action="store_true",
            help=(
                "Also remove legacy import leftovers: source rows, import history, "
                "bundles, the import user and former-botanist accounts."
            ),
        )
        parser.add_argument(
            "--staff",
            nargs="+",
            default=[],
            metavar="EMAIL:ROLE[:FLAGS]",
            help="After clearing, give these people accounts and invite them.",
        )
        add_staff_arguments(parser, positional=False)

    def handle(self, *args, **options):
        # all_objects so practice rows are included in the clean-up too.
        case_count = Case.all_objects.count()
        batch_count = Batch.all_objects.count()
        self.stdout.write(
            f"Cases: {case_count} (deletes their forms, bags, assessments, "
            f"certificates), batches: {batch_count}."
        )
        # Every case goes, so every officer, station and defendant is orphaned.
        self.stdout.write(
            f"Would delete {PoliceOfficer.all_objects.count()} officer(s), "
            f"{PoliceStation.all_objects.count()} station(s) and "
            f"{Defendant.all_objects.count()} defendant(s) left with no cases."
        )
        former_botanists = self._former_botanists()
        if options["full"]:
            self.stdout.write(
                f"Full: would delete {LegacySourceRecord.objects.count()} legacy "
                f"source record(s), {LegacyImportRun.objects.count()} import run(s), "
                f"{LegacyImportBundle.objects.count()} bundle(s), the import user, "
                f"and {former_botanists.count()} former-botanist account(s):"
            )
            for user in former_botanists:
                self.stdout.write(
                    f"    {user.given_names} {user.last_name} ({user.email})"
                )
        else:
            self.stdout.write(
                "Users are not deleted (pass --full for import leftovers)."
            )
        if options["staff"]:
            self.stdout.write(
                f"Then: accounts and invitations for {len(options['staff'])} person(s)."
            )

        if not options["confirm"]:
            if options["staff"]:
                self.stdout.write("Staff accounts (as things stand now):")
                run_provisioning(
                    self, options["staff"], options["invited_by"], False, dry_run=True
                )
            self.stdout.write(self.style.WARNING("Dry run — pass --confirm to delete."))
            return

        if options["staff"]:
            # Before deleting anything: everyone listed must be resolvable.
            check_staff_can_be_provisioned(options["staff"])

        with transaction.atomic():
            # Batches are not owned by the case, so clear them first. Deleting
            # cases cascades to forms, bags, assessments and certificates.
            Batch.all_objects.all().delete()
            CasePhaseHistory.objects.all().delete()
            CaseDraft.objects.all().delete()
            Case.all_objects.all().delete()
            # With the cases gone, remove the now-orphaned shared records.
            self._orphan_defendants().delete()
            self._orphan_officers().delete()
            self._orphan_stations().delete()
            if options["full"]:
                LegacySourceRecord.objects.all().delete()
                LegacyImportRun.objects.all().delete()
                LegacyImportBundle.objects.all().delete()
                self._former_botanists().delete()
                User.objects.filter(email=IMPORT_USER_EMAIL).delete()
            if options["reset_counters"]:
                settings_obj = SystemSettings.load()
                settings_obj.certificate_counter = 0
                settings_obj.batch_counter = 0
                settings_obj.save(
                    update_fields=["certificate_counter", "batch_counter"]
                )
        self.stdout.write(self.style.SUCCESS("Case data deleted."))
        if options["full"]:
            self.stdout.write(self.style.SUCCESS("Legacy import leftovers deleted."))
        if options["reset_counters"]:
            self.stdout.write(self.style.SUCCESS("Counters reset to zero."))

        if options["staff"]:
            self.stdout.write("Staff accounts:")
            run_provisioning(
                self,
                options["staff"],
                options["invited_by"],
                send_email=not options["no_email"],
                dry_run=False,
            )

    @staticmethod
    def _former_botanists():
        """Accounts made for former botanists: legacy botanists, never superusers.

        Covers the placeholders the current import makes and the accounts the
        earlier import made with guessed emails. Real staff are never legacy.
        """
        return User.objects.filter(
            is_legacy=True, role=User.RoleChoices.BOTANIST, is_superuser=False
        ).exclude(email=IMPORT_USER_EMAIL)

    @staticmethod
    def _orphan_officers():
        """Officers with no cases as submitting or requesting officer (any kind)."""
        return PoliceOfficer.all_objects.exclude(
            pk__in=Case.all_objects.exclude(submitting_officer=None).values(
                "submitting_officer"
            )
        ).exclude(
            pk__in=Case.all_objects.exclude(requesting_officer=None).values(
                "requesting_officer"
            )
        )

    @staticmethod
    def _orphan_stations():
        """Stations referenced by no case and with no officers still attached.

        Keeping a station that still has officers avoids stranding officers that
        survive the purge (their station FK would otherwise be nulled).
        """
        return (
            PoliceStation.all_objects.exclude(
                pk__in=Case.all_objects.exclude(station=None).values("station")
            )
            .filter(officers__isnull=True)
            .distinct()
        )

    @staticmethod
    def _orphan_defendants():
        """Defendants linked to no case."""
        return Defendant.all_objects.exclude(
            pk__in=Case.all_objects.values("defendants")
        )
