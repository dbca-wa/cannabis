"""Data migration for the batching workflow refactor.

- Remaps existing case phases to the new 5-phase set.
- Links existing certificates to their case's bags (legacy single group).
- Copies the legacy unsigned PDF into the new pdf_file slot.
- Backfills certified_date.

This migration only moves data into the new shape; it is destructive in the
sense that removed phases collapse to "complete". It is written as
non-reversible because the original phase granularity cannot be reconstructed.
"""

from django.db import migrations
from django.utils import timezone

REMOVED_TO_COMPLETE = {"botanist_signoff", "invoicing", "send_emails"}


def forwards(apps, schema_editor):
    Case = apps.get_model("submissions", "Case")
    Certificate = apps.get_model("submissions", "Certificate")

    now = timezone.now()

    # 1. Remap phases
    for case in Case.objects.all().iterator():
        new_phase = case.phase
        if case.phase in REMOVED_TO_COMPLETE or case.phase == "complete":
            new_phase = "complete"
        elif case.phase == "unsigned_generation":
            if case.certificates.exists():
                new_phase = "batching"

        updates = []
        if new_phase != case.phase:
            case.phase = new_phase
            updates.append("phase")
        if new_phase == "complete" and not case.completed_at:
            case.completed_at = now
            updates.append("completed_at")
        if updates:
            case.save(update_fields=updates)

    # 2 & 3 & 4. Certificates: link bags, copy PDF, backfill certified_date
    for cert in Certificate.objects.all().iterator():
        if cert.bags.count() == 0:
            bag_ids = list(cert.submission.bags.values_list("id", flat=True))
            if bag_ids:
                cert.bags.set(bag_ids)

        updates = []
        if not cert.pdf_file and cert.unsigned_pdf_file:
            cert.pdf_file = cert.unsigned_pdf_file
            cert.pdf_size = cert.unsigned_pdf_size
            updates.extend(["pdf_file", "pdf_size"])

        if not cert.certified_date:
            source = cert.submission.certificates_generated_at or cert.created_at
            if source:
                cert.certified_date = source.date()
                updates.append("certified_date")

        if updates:
            cert.save(update_fields=updates)


def backwards(apps, schema_editor):
    # Phase granularity cannot be restored; this is a no-op reverse.
    pass


class Migration(migrations.Migration):

    dependencies = [
        ("submissions", "0019_case_last_actioned_by_certificate_bags_and_more"),
    ]

    operations = [
        migrations.RunPython(forwards, backwards),
    ]
