"""Delete practice data.

Practice rows are flagged ``is_practice=True`` and hidden from the live
application. This command removes them. With ``--expired`` it only removes data
for users whose one-day practice window has lapsed (safe for a scheduled job);
otherwise it removes all practice data. It reports by default and only deletes
with ``--confirm``.
"""

from django.core.management.base import BaseCommand

from cases.models import Batch, Case
from cases.services.practice_service import PracticeService
from defendants.models import Defendant
from police.models import PoliceOfficer, PoliceStation


class Command(BaseCommand):
    help = "Delete practice/demo data (all, or only expired sessions)."

    def add_arguments(self, parser):
        parser.add_argument(
            "--confirm",
            action="store_true",
            help="Actually delete. Without this flag the command only reports.",
        )
        parser.add_argument(
            "--expired",
            action="store_true",
            help="Only purge users whose practice window has lapsed.",
        )

    def handle(self, *args, **options):
        totals = {
            "cases": Case.all_objects.filter(is_practice=True).count(),
            "batches": Batch.all_objects.filter(is_practice=True).count(),
            "officers": PoliceOfficer.all_objects.filter(is_practice=True).count(),
            "stations": PoliceStation.all_objects.filter(is_practice=True).count(),
            "defendants": Defendant.all_objects.filter(is_practice=True).count(),
        }
        self.stdout.write(
            "Practice data: " + ", ".join(f"{v} {k}" for k, v in totals.items()) + "."
        )

        if not options["confirm"]:
            self.stdout.write(self.style.WARNING("Dry run — pass --confirm to delete."))
            return

        if options["expired"]:
            n = PracticeService.purge_expired()
            self.stdout.write(
                self.style.SUCCESS(f"Purged {n} lapsed practice session(s).")
            )
            return

        # Delete every practice row regardless of owner/mode state. Cases cascade
        # to their forms, bags, assessments and certificates.
        Batch.all_objects.filter(is_practice=True).delete()
        Case.all_objects.filter(is_practice=True).delete()
        PoliceOfficer.all_objects.filter(is_practice=True).delete()
        PoliceStation.all_objects.filter(is_practice=True).delete()
        Defendant.all_objects.filter(is_practice=True).delete()
        from users.models import UserPreferences

        UserPreferences.objects.filter(practice_mode=True).update(
            practice_mode=False, practice_mode_started_at=None
        )
        self.stdout.write(self.style.SUCCESS("All practice data deleted."))
