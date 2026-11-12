"""Keep finished certificates current now Section C prints the envelope.

Section C now starts the botanist's note with "Subsamples placed into Security
Movement Envelope <number>." whenever the form has an envelope. A certificate
printed before that no longer matches its case. As with earlier wording
changes, finished (invoiced) work takes its current state as the starting
point: a complete certificate whose fingerprint matched its case before the
change gets the fingerprint of what it prints now, and any other difference it
already had still shows. Every other certificate is left alone, so it is
flagged for regeneration (or its batch for a re-package) and picks up the
sentence when rebuilt.

This uses the current certificate code, like 0044. If it cannot run on some
much older database, the certificates are left as they were.
"""

import logging

from django.db import migrations

logger = logging.getLogger(__name__)


def adopt_envelope_line(apps, schema_editor):
    try:
        from cases.models import Case, Certificate
        from cases.services.certificate_service import CertificateService

        adopted = 0
        certificates = (
            Certificate.objects.exclude(printed_fingerprint__isnull=True)
            .exclude(pdf_file="")
            .exclude(pdf_file__isnull=True)
            .select_related("form__case")
        )
        for certificate in certificates.iterator():
            form = certificate.form
            envelope = form.security_movement_envelope
            finished = form.phase == Case.PhaseChoices.COMPLETE
            if not finished or not (envelope or "").strip():
                continue
            form.security_movement_envelope = ""
            before = CertificateService.content_fingerprint(certificate)
            form.security_movement_envelope = envelope
            if before != certificate.printed_fingerprint:
                continue
            now = CertificateService.content_fingerprint(certificate)
            if now and now != before:
                Certificate.objects.filter(pk=certificate.pk).update(
                    printed_fingerprint=now
                )
                adopted += 1
    except Exception as exc:  # pragma: no cover - only on unusual databases
        logger.warning(f"Could not update certificate fingerprints: {exc}")
        return
    if adopted:
        logger.info(
            f"Updated fingerprints for {adopted} finished certificate(s) to "
            "include the envelope sentence"
        )


class Migration(migrations.Migration):

    dependencies = [
        ("submissions", "0045_legacy_envelopes_from_notes"),
    ]

    operations = [
        migrations.RunPython(adopt_envelope_line, migrations.RunPython.noop),
    ]
