"""Compare the imported legacy data with what the old system's table says it must be.

    poetry run python -m etl.verify.oracle          # writes etl/data/modded/expected.json
    python manage.py reconcile_legacy_import        # compares it with the database

Every difference is listed by certificate. A difference passes only if it is
listed, with a reason, in the exceptions file. The command exits non-zero when
any difference is unexplained. The same checks run from the Settings page.
"""

import json
import sys
from pathlib import Path

from django.conf import settings
from django.core.management.base import BaseCommand, CommandError

from cases.legacy_import.reconcile import Reconciler


class Command(BaseCommand):
    help = "Reconcile the imported legacy data against the independent expectations"

    def add_arguments(self, parser):
        parser.add_argument("--expected", default="etl/data/modded/expected.json")
        # Kept with the data (gitignored): it names police reference numbers.
        parser.add_argument("--exceptions", default="etl/data/verify/exceptions.json")
        parser.add_argument(
            "--source",
            default="etl/data/raw/Cannabis2000_mdb.json",
            help="Access export",
        )
        parser.add_argument("--report", help="Write the full result to this JSON file")

    def _read(self, value, required=True):
        path = Path(value)
        path = path if path.is_absolute() else Path(settings.BASE_DIR) / path
        if not path.exists():
            if required:
                raise CommandError(f"{path} not found")
            return None
        return json.loads(path.read_text(encoding="utf-8"))

    def handle(self, *args, **options):
        expected = self._read(options["expected"])
        exceptions = self._read(options["exceptions"], required=False) or []
        source_rows = self._read(options["source"])["rows"]

        result = Reconciler(expected, exceptions, source_rows).run()
        unexplained = result["unexplained"]
        by_check = result["unexplained_by_check"]

        self.stdout.write("Reconciliation of legacy import")
        for check, count in result["checked"].items():
            self.stdout.write(
                f"  {check:<28} checked {count:>6}  unexplained {by_check.get(check, 0):>5}"
            )
        self.stdout.write(
            f"{len(unexplained)} unexplained difference(s); "
            f"{result['explained']} explained by the exceptions list"
        )
        for failure in unexplained[:40]:
            self.stdout.write(
                f"  [{failure['check']}] {failure['id']}: {failure['detail']}"
            )
        if len(unexplained) > 40:
            self.stdout.write(f"  ... and {len(unexplained) - 40} more (see --report)")
        if options["report"]:
            Path(options["report"]).write_text(
                json.dumps(result, indent=1), encoding="utf-8"
            )
        if unexplained:
            sys.exit(1)
