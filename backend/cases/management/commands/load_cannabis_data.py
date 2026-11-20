"""Import the historical certificates as legacy cases.

    python manage.py load_cannabis_data --file /tmp/cannabis_clean.json            # dry run
    python manage.py load_cannabis_data --file /tmp/cannabis_clean.json --commit   # write

The input is the certificate-level JSON written by ``etl/run_transform.py``.
Without ``--commit`` the whole import runs inside a transaction that is rolled
back, so the counts shown are exactly what a real run would create.
Re-running on data already imported changes nothing.
"""

import json
import logging
import sys
from pathlib import Path

from django.conf import settings
from django.core.management.base import BaseCommand, CommandError

from cases.legacy_import.importer import LegacyImporter

logger = logging.getLogger(__name__)

DEFAULT_FILE = "etl/data/modded/cannabis_clean.json"


class Command(BaseCommand):
    help = "Import historical certificates from the transformed JSON as legacy cases"

    def add_arguments(self, parser):
        parser.add_argument("--file", default=DEFAULT_FILE, help="Transformed JSON")
        parser.add_argument(
            "--commit",
            action="store_true",
            help="Write to the database. Without it the import is a dry run.",
        )
        parser.add_argument(
            "--report", help="Write the full import report to this JSON file"
        )
        parser.add_argument(
            "--limit",
            type=int,
            help="Import only the first N certificates (testing)",
        )

    def handle(self, *args, **options):
        path = Path(options["file"])
        if not path.is_absolute():
            path = Path(settings.BASE_DIR) / path
        if not path.exists():
            raise CommandError(f"File not found: {path}")
        with open(path, encoding="utf-8") as handle:
            records = json.load(handle)
        if not isinstance(records, list) or not records:
            raise CommandError("The file holds no certificate records")
        manifest_path = path.with_name(path.stem + ".manifest.json")
        if manifest_path.exists():
            with open(manifest_path, encoding="utf-8") as handle:
                expected = json.load(handle).get("records")
            if expected != len(records):
                raise CommandError(
                    f"{path.name} has {len(records)} records but its manifest "
                    f"says {expected}; run the transform again"
                )
        if options["limit"]:
            records = records[: options["limit"]]

        commit = options["commit"]
        mode = "COMMIT" if commit else "DRY RUN (nothing is written)"
        self.stdout.write(f"Legacy import: {len(records)} certificates, {mode}")

        report = LegacyImporter(dry_run=not commit).run(records)

        for label, value in sorted(report.counts.items()):
            self.stdout.write(f"  {label}: {value}")
        for label, items in (
            (
                "certificates needing a person to check the bag results",
                report.unsplit_certificates,
            ),
            (
                "certificates whose source result is blank",
                report.unassessed_certificates,
            ),
            ("case numbers already used by cases made in the app", report.conflicts),
        ):
            if items:
                self.stdout.write(self.style.WARNING(f"  {label}: {len(items)}"))
        for failure in report.failed_cases:
            self.stderr.write(f"  FAILED {failure['case']}: {failure['error']}")

        if options["report"]:
            with open(options["report"], "w", encoding="utf-8") as handle:
                json.dump(report.to_dict(), handle, indent=2)
        logger.info(
            "Legacy import %s: %s cases, %s forms, %s bags, %s failed",
            "committed" if commit else "dry run",
            report.counts["cases"],
            report.counts["forms"],
            report.counts["bags"],
            report.counts["cases failed"],
        )
        if report.failed_cases or report.conflicts:
            sys.exit(1)
