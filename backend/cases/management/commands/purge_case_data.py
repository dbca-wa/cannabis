"""Delete all case data for a clean slate before testing.

Removes every case and everything that hangs off it — Priority 3 forms, drug
bags, assessments, certificates, batches, phase history and case drafts — then
deletes any police officer, police station or defendant left with no remaining
cases. Shared records that are still referenced by another case are kept, and
users (including botanists) are never deleted.

Destructive and irreversible. Reports by default; pass --confirm to delete.
"""

from django.core.management.base import BaseCommand
from django.db import transaction

from cases.models import Batch, Case, CaseDraft, CasePhaseHistory
from common.models import SystemSettings
from defendants.models import Defendant
from police.models import PoliceOfficer, PoliceStation


class Command(BaseCommand):
    help = (
        "Delete all cases and their related data, plus any officer/station/"
        "defendant left orphaned. Users are never deleted."
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

    def handle(self, *args, **options):
        # all_objects so practice rows are included in the clean-up too.
        case_count = Case.all_objects.count()
        batch_count = Batch.all_objects.count()

        # The command deletes every case, so count how many officers/stations/
        # defendants would be orphaned once no case remains — i.e. what will
        # actually be deleted — rather than how many are orphaned right now.
        officers_to_delete = self._orphans_after_full_purge_officers()
        stations_to_delete = self._orphans_after_full_purge_stations()
        defendants_to_delete = self._orphans_after_full_purge_defendants()

        self.stdout.write(
            f"Cases: {case_count} (deletes their forms, bags, assessments, "
            f"certificates), batches: {batch_count}."
        )
        self.stdout.write(
            f"Would delete {officers_to_delete} officer(s), "
            f"{stations_to_delete} station(s) and {defendants_to_delete} "
            "defendant(s) left with no cases. Users are never deleted."
        )

        if not options["confirm"]:
            self.stdout.write(self.style.WARNING("Dry run — pass --confirm to delete."))
            return

        with transaction.atomic():
            # Batches are not owned by the case, so clear them first. Deleting
            # cases cascades to forms, bags, assessments and certificates.
            Batch.all_objects.all().delete()
            CasePhaseHistory.objects.all().delete()
            CaseDraft.objects.all().delete()
            Case.all_objects.all().delete()

            # With the cases gone, remove the now-orphaned shared records. Re-run
            # the orphan queries after deletion so they reflect the final state.
            self._orphan_defendants().delete()
            self._orphan_officers().delete()
            self._orphan_stations().delete()

            if options["reset_counters"]:
                settings_obj = SystemSettings.load()
                settings_obj.certificate_counter = 0
                settings_obj.batch_counter = 0
                settings_obj.save(
                    update_fields=["certificate_counter", "batch_counter"]
                )

        self.stdout.write(self.style.SUCCESS("Case data deleted."))
        if options["reset_counters"]:
            self.stdout.write(self.style.SUCCESS("Counters reset to zero."))

    @staticmethod
    def _orphans_after_full_purge_officers():
        """Officers left with no case once every case is deleted — all of them,
        since no case survives a full purge to reference any officer."""
        return PoliceOfficer.all_objects.count()

    @staticmethod
    def _orphans_after_full_purge_defendants():
        return Defendant.all_objects.count()

    @staticmethod
    def _orphans_after_full_purge_stations():
        """Stations deleted once no case and no officer references them. The
        purge removes all officers first, so every station becomes deletable."""
        return PoliceStation.all_objects.count()

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
        survive the purge (their station FK would otherwise be nulled)."""
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
