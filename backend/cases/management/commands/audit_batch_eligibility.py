"""Report and repair certificates whose form phase does not match their batch.

A certificate's form should be in the Batching phase while the certificate has no
batch, and at In Batch or Complete only once it belongs to one. Records that
break that pairing cannot be batched: batching would try to advance a form that
has no next phase and fail with a phase transition error.

Historical data imported from the previous system is the expected source, since
those cases were completed outside this application's batching workflow.

Reports by default. Pass --repair to return the affected forms to the Batching
phase, which makes their certificates batchable again.
"""

from django.core.management.base import BaseCommand
from django.db import transaction

from ...models import Case, CasePhaseHistory, Certificate

# Phases that imply the certificate is already in a batch.
POST_BATCHING_PHASES = [
    Case.PhaseChoices.IN_BATCH,
    Case.PhaseChoices.COMPLETE,
]


class Command(BaseCommand):
    help = (
        "Report certificates with no batch whose form is at in_batch or "
        "complete. Use --repair to return those forms to the batching phase."
    )

    def add_arguments(self, parser):
        parser.add_argument(
            "--repair",
            action="store_true",
            help=(
                "Return the affected forms to the batching phase and clear "
                "their completion time. Without this flag the command only "
                "reports."
            ),
        )

    def handle(self, *args, **options):
        repair = options["repair"]

        affected = (
            Certificate.objects.filter(
                batch__isnull=True,
                form__phase__in=POST_BATCHING_PHASES,
            )
            .select_related("form", "form__case")
            .order_by("form__case__case_number", "form_id")
        )

        rows = list(affected)

        if not rows:
            self.stdout.write(
                self.style.SUCCESS(
                    "No mismatched records found — every unbatched certificate's "
                    "form is in the batching phase or earlier."
                )
            )
            return

        self.stdout.write(
            self.style.WARNING(
                f"Found {len(rows)} certificate(s) with no batch whose form has "
                f"already passed batching:"
            )
        )
        self.stdout.write("")
        self.stdout.write(f"{'CERTIFICATE':<16} {'CASE':<22} {'FORM':<8} {'PHASE':<12}")
        self.stdout.write("-" * 60)
        for certificate in rows:
            self.stdout.write(
                f"{certificate.certificate_number or '(none)':<16} "
                f"{certificate.form.case.case_number:<22} "
                f"{certificate.form_id:<8} "
                f"{certificate.form.phase:<12}"
            )
        self.stdout.write("")

        if not repair:
            self.stdout.write(
                "Reporting only. Re-run with --repair to return these forms to "
                "the batching phase."
            )
            return

        with transaction.atomic():
            for certificate in rows:
                form = certificate.form
                old_phase = form.phase
                form.phase = Case.PhaseChoices.BATCHING
                form.completed_at = None
                form.save(update_fields=["phase", "completed_at"])

                # Record the correction so the phase history explains why a form
                # moved backwards.
                CasePhaseHistory.objects.create(
                    submission=form.case,
                    form=form,
                    from_phase=old_phase,
                    to_phase=Case.PhaseChoices.BATCHING,
                    action="repair",
                    user=None,
                )

        self.stdout.write(
            self.style.SUCCESS(
                f"Repaired {len(rows)} form(s). Their certificates are now "
                f"eligible for batching."
            )
        )
