"""Give existing certificates a fingerprint so later changes are caught.

Certificates made before fingerprints were recorded had none, so changes to
their case (a defendant, the police reference, the botanist) were never
flagged. Each one that still matches its case gets the fingerprint of what it
prints now; one that already differs is marked so it shows as out of date.

This uses the current certificate code, which is safe when the migration first
runs. If it cannot run on some much older database, the certificates are left
as they were (never flagged) and ``record_certificate_fingerprints`` can be run
later instead.
"""

import logging

from django.db import migrations, transaction

logger = logging.getLogger(__name__)


def record_fingerprints(apps, schema_editor):
    # Nothing to do on a new database. This also keeps the migration from
    # reaching for the current models, whose later columns do not exist yet.
    if not apps.get_model("submissions", "Certificate").objects.exists():
        return
    try:
        from cases.services.certificate_service import CertificateService

        # A savepoint, so a failure here cannot abort the migration's transaction.
        with transaction.atomic():
            matched, out_of_date = CertificateService.record_existing_fingerprints()
    except Exception as exc:  # pragma: no cover - only on unusual databases
        logger.warning(
            "Could not record certificate fingerprints; run "
            f"record_certificate_fingerprints later: {exc}"
        )
        return
    if matched or out_of_date:
        logger.info(
            f"Recorded fingerprints for {matched} existing certificate(s); "
            f"{out_of_date} already differed from their case"
        )


class Migration(migrations.Migration):

    dependencies = [
        ("submissions", "0043_rename_certificates_state_label"),
    ]

    operations = [
        migrations.RunPython(record_fingerprints, migrations.RunPython.noop),
    ]
