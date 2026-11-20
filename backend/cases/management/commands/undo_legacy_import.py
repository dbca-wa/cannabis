"""Remove everything a legacy import created.

python manage.py undo_legacy_import            # shows what would be removed
python manage.py undo_legacy_import --commit   # removes it
"""

from django.core.management.base import BaseCommand

from cases.legacy_import.rollback import rollback_import


class Command(BaseCommand):
    help = "Remove the cases, people and places created by the legacy import"

    def add_arguments(self, parser):
        parser.add_argument(
            "--commit",
            action="store_true",
            help="Delete for real. Without it nothing is changed.",
        )

    def handle(self, *args, **options):
        commit = options["commit"]
        counts = rollback_import(dry_run=not commit)
        verb = "Removed" if commit else "Would remove"
        if not counts:
            self.stdout.write("No legacy import found.")
            return
        for label, value in counts.items():
            self.stdout.write(f"  {verb} {value} {label}")
