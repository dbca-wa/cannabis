"""Batch service — batching, cost summary, and ZIP packaging business logic.

A batch groups one or more eligible cases (those that have completed unsigned
certificate generation and are not already batched). Creating a batch snapshots
the current rates, tallies certificates and bags, computes the cost breakdown,
and produces a downloadable ZIP of all certificate PDFs plus a cost-summary PDF.

Cases are only marked Complete once a unique invoice-raised number is recorded
on the batch (a post-batching action on the Batches page).
"""

import io
import zipfile
from decimal import ROUND_HALF_UP, Decimal

from django.conf import settings
from django.core.files.base import ContentFile
from django.db import transaction
from django.template.loader import render_to_string
from django.utils import timezone
from rest_framework.exceptions import NotFound, ValidationError

from common.models import SystemSettings

from ..models import Batch, Case
from .pdf_service import PDFService
from .workflow_service import WorkflowService

COST_SUMMARY_TEMPLATE = "pdf/cost_summary_template.html"


class BatchService:
    """Business logic for batch operations."""

    @staticmethod
    def get_batch(pk):
        try:
            return Batch.objects.get(pk=pk)
        except Batch.DoesNotExist:
            raise NotFound("Batch not found.")

    @staticmethod
    def _money(value):
        return Decimal(value).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)

    @staticmethod
    def _certificate_numbers(cases):
        """Return the sorted list of all certificate numbers across the cases."""
        numbers = []
        for case in cases:
            numbers.extend(
                case.certificates.values_list("certificate_number", flat=True)
            )
        return sorted(n for n in numbers if n)

    @staticmethod
    def _certificate_number_range(cases):
        """Build a comma-separated string of every certificate number in the batch."""
        return ", ".join(BatchService._certificate_numbers(cases))

    @staticmethod
    @transaction.atomic
    def create_batch(case_ids, user):
        """Create a batch from the given eligible case ids.

        Cases remain in the Batching phase; they are only completed when an
        invoice-raised number is recorded (see record_invoice_raised).

        Raises:
            ValidationError: If no cases given or any case is ineligible.
        """
        if not case_ids:
            raise ValidationError({"case_ids": ["Select at least one case."]})

        cases = list(
            Case.objects.filter(pk__in=case_ids).prefetch_related(
                "certificates", "bags"
            )
        )
        found_ids = {c.pk for c in cases}
        missing = set(case_ids) - found_ids
        if missing:
            raise ValidationError({"case_ids": [f"Cases not found: {sorted(missing)}"]})

        ineligible = [c.case_number for c in cases if not c.is_batch_eligible]
        if ineligible:
            raise ValidationError(
                {
                    "case_ids": [
                        "These cases are not eligible for batching (must be in "
                        f"Batching and not already batched): {ineligible}"
                    ]
                }
            )

        settings_obj = SystemSettings.load()
        cert_rate = settings_obj.cost_per_certificate
        bag_rate = settings_obj.cost_per_bag
        tax_percentage = settings_obj.tax_percentage

        certificate_count = sum(c.certificates.count() for c in cases)
        bag_count = sum(c.bags.count() for c in cases)

        cert_cost = BatchService._money(certificate_count * cert_rate)
        bag_cost = BatchService._money(bag_count * bag_rate)
        subtotal = BatchService._money(cert_cost + bag_cost)
        tax_amount = BatchService._money(subtotal * tax_percentage / Decimal("100"))
        total = BatchService._money(subtotal + tax_amount)

        batch = Batch.objects.create(
            cert_rate=cert_rate,
            bag_rate=bag_rate,
            tax_percentage=tax_percentage,
            certificate_count=certificate_count,
            bag_count=bag_count,
            cert_cost=cert_cost,
            bag_cost=bag_cost,
            subtotal=subtotal,
            tax_amount=tax_amount,
            total=total,
            certificate_number_range=BatchService._certificate_number_range(cases),
            created_by=user,
        )

        # Attach each case to the batch and advance it to the In Batch phase.
        # Cases are only completed once an invoice-raised number is recorded.
        for case in cases:
            case.batch = batch
            case.save(update_fields=["batch"])
            WorkflowService.advance_case(case, user)

        BatchService.build_zip(batch)

        settings.LOGGER.info(
            f"User {user} created {batch.batch_number} with {len(cases)} case(s)"
        )
        return batch

    @staticmethod
    def build_cost_summary_context(batch):
        cases = list(batch.cases.all())
        return {
            "batch_number": batch.batch_number,
            "date_batched": batch.created_at.strftime("%d %B %Y"),
            "certificate_count": batch.certificate_count,
            "bag_count": batch.bag_count,
            "cert_rate": float(batch.cert_rate),
            "bag_rate": float(batch.bag_rate),
            "cert_cost": float(batch.cert_cost),
            "bag_cost": float(batch.bag_cost),
            "subtotal": float(batch.subtotal),
            "tax_percentage": float(batch.tax_percentage),
            "tax_amount": float(batch.tax_amount),
            "total": float(batch.total),
            "certificate_number_range": batch.certificate_number_range,
            "certificate_numbers": BatchService._certificate_numbers(cases),
            "cases": [
                {
                    "case_number": c.case_number,
                    "bags": c.bags.count(),
                    "certificates": c.certificates.count(),
                }
                for c in cases
            ],
            "dbca_org_data": {
                "name": "Department of Biodiversity, Conservation and Attractions",
                "address": "Locked Bag 104",
                "city": "Bentley Delivery Centre",
                "state": "WA",
                "zip": "6983",
            },
        }

    @staticmethod
    def build_zip(batch):
        """Build (or rebuild) the batch ZIP: certificate PDFs + cost summary."""
        context = BatchService.build_cost_summary_context(batch)
        summary_html = render_to_string(COST_SUMMARY_TEMPLATE, context)
        summary_pdf = PDFService._html_to_pdf(summary_html)

        buffer = io.BytesIO()
        with zipfile.ZipFile(buffer, "w", zipfile.ZIP_DEFLATED) as archive:
            archive.writestr(f"cost_summary_{batch.batch_number}.pdf", summary_pdf)
            for case in batch.cases.all().prefetch_related("certificates"):
                for cert in case.certificates.all():
                    pdf = cert.pdf_file
                    if not pdf:
                        continue
                    pdf.open("rb")
                    data = pdf.read()
                    pdf.close()
                    archive.writestr(
                        f"certificates/{cert.certificate_number}.pdf", data
                    )

        zip_bytes = buffer.getvalue()
        if batch.zip_file:
            batch.zip_file.delete(save=False)
        filename = f"{batch.batch_number}.zip"
        batch.zip_file.save(filename, ContentFile(zip_bytes), save=False)
        batch.zip_size = len(zip_bytes)
        batch.save(update_fields=["zip_file", "zip_size"])
        return batch

    @staticmethod
    def rebuild_zip(batch):
        """Public alias to regenerate the package for re-download."""
        return BatchService.build_zip(batch)

    @staticmethod
    @transaction.atomic
    def record_invoice_raised(batch, number, user):
        """Record a unique invoice-raised number and complete the batch's cases.

        Raises:
            ValidationError: If the number is blank or already used.
        """
        number = (number or "").strip()
        if not number:
            raise ValidationError(
                {"invoice_raised_number": ["This field is required."]}
            )

        clash = (
            Batch.objects.filter(invoice_raised_number=number)
            .exclude(pk=batch.pk)
            .exists()
        )
        if clash:
            raise ValidationError(
                {
                    "invoice_raised_number": [
                        "This invoice-raised number is already used by another batch."
                    ]
                }
            )

        batch.invoice_raised_number = number
        batch.invoice_raised_at = timezone.now()
        batch.save(update_fields=["invoice_raised_number", "invoice_raised_at"])

        for case in batch.cases.all():
            if case.phase == Case.PhaseChoices.COMPLETE:
                continue
            # Advance through to complete (in_batch → complete).
            new_phase = case.phase
            while new_phase != Case.PhaseChoices.COMPLETE:
                new_phase = WorkflowService.advance_case(case, user)
            case.completed_at = timezone.now()
            case.save(update_fields=["completed_at"])

        settings.LOGGER.info(
            f"User {user} recorded invoice {number} on {batch.batch_number}; "
            f"{batch.cases.count()} case(s) completed"
        )
        return batch

    @staticmethod
    @transaction.atomic
    def unset_invoice_raised(batch, user):
        """Clear the invoice-raised number and return the batch's cases to the
        In Batch phase.

        Raises:
            ValidationError: If no invoice-raised number is currently set.
        """
        if not batch.invoice_raised_number:
            raise ValidationError(
                {
                    "invoice_raised_number": [
                        "No invoice-raised number is set on this batch."
                    ]
                }
            )

        number = batch.invoice_raised_number
        batch.invoice_raised_number = None
        batch.invoice_raised_at = None
        batch.save(update_fields=["invoice_raised_number", "invoice_raised_at"])

        for case in batch.cases.all():
            if case.phase == Case.PhaseChoices.COMPLETE:
                case.phase = Case.PhaseChoices.IN_BATCH
                case.completed_at = None
                case.last_actioned_by = user
                case.save(update_fields=["phase", "completed_at", "last_actioned_by"])

        settings.LOGGER.info(
            f"User {user} unset invoice {number} on {batch.batch_number}; "
            f"{batch.cases.count()} case(s) returned to in-batch"
        )
        return batch

    @staticmethod
    @transaction.atomic
    def delete_batch(batch, user):
        """Delete a batch and return its cases to the Batching phase."""
        for case in batch.cases.all():
            case.batch = None
            if case.phase in (
                Case.PhaseChoices.IN_BATCH,
                Case.PhaseChoices.COMPLETE,
            ):
                case.phase = Case.PhaseChoices.BATCHING
                case.completed_at = None
            case.last_actioned_by = user
            case.save(
                update_fields=["batch", "phase", "completed_at", "last_actioned_by"]
            )

        if batch.zip_file:
            batch.zip_file.delete(save=False)

        number = batch.batch_number
        batch.delete()
        settings.LOGGER.info(f"User {user} deleted batch {number}")

    @staticmethod
    def export_rows(batches):
        """Return tabular rows (list of dicts) for batch export."""
        rows = []
        for b in batches:
            rows.append(
                {
                    "batch_number": b.batch_number,
                    "date": b.created_at.strftime("%Y-%m-%d"),
                    "certificates": b.certificate_count,
                    "cert_rate": str(b.cert_rate),
                    "cert_cost": str(b.cert_cost),
                    "bags": b.bag_count,
                    "bag_rate": str(b.bag_rate),
                    "bag_cost": str(b.bag_cost),
                    "tax_rate": str(b.tax_percentage),
                    "subtotal": str(b.subtotal),
                    "tax": str(b.tax_amount),
                    "total": str(b.total),
                    "certificate_numbers": b.certificate_number_range,
                    "invoice_raised": b.invoice_raised_number or "",
                }
            )
        return rows
