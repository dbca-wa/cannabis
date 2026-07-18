"""Batch service — batching, cost summary, and ZIP packaging business logic.

A batch groups one or more eligible certificates (those whose form has reached
the Batching phase and that are not already in a batch). Creating a batch
snapshots the current rates, tallies the certificates and the drug bags their
forms cover, computes the cost breakdown, and produces a downloadable ZIP of all
certificate PDFs plus a cost-summary PDF.

Costing and batching are per certificate: a case's certificates may land in
different batches over time. A certificate's form advances to In Batch when the
certificate joins a batch, and is only marked Complete once a unique
invoice-raised number is recorded on the batch (a post-batching action on the
Batches page).
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

from ..models import Batch, Case, Certificate
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
    def _certificate_numbers(certificates):
        """Return the sorted list of the given certificates' numbers."""
        numbers = [c.certificate_number for c in certificates]
        return sorted(n for n in numbers if n)

    @staticmethod
    def _collapse_cert_ranges(numbers):
        """Collapse sequential R{nnnnnn} certificate numbers into ranges.

        Input: ["R000001", "R000002", "R000003", "R000005"]
        Output: ["R000001-R000003", "R000005"]
        """
        import re

        if len(numbers) <= 1:
            return numbers

        parsed = []
        non_r = []
        for n in numbers:
            match = re.match(r"^R(\d+)$", n)
            if match:
                parsed.append((n, int(match.group(1))))
            else:
                non_r.append(n)

        parsed.sort(key=lambda x: x[1])

        result = []
        range_start = None
        range_end = None

        for original, num in parsed:
            if range_start is None:
                range_start = (original, num)
                range_end = (original, num)
            elif num == range_end[1] + 1:
                range_end = (original, num)
            else:
                if range_start[1] == range_end[1]:
                    result.append(range_start[0])
                else:
                    result.append(f"{range_start[0]}-{range_end[0]}")
                range_start = (original, num)
                range_end = (original, num)

        if range_start:
            if range_start[1] == range_end[1]:
                result.append(range_start[0])
            else:
                result.append(f"{range_start[0]}-{range_end[0]}")

        return result + non_r

    @staticmethod
    def _certificate_number_range(certificates):
        """Build a comma-separated string of every certificate number given."""
        return ", ".join(BatchService._certificate_numbers(certificates))

    @staticmethod
    @transaction.atomic
    def create_batch(certificate_ids, user):
        """Create a batch from the given eligible certificate ids.

        Only certificates whose form is in the Batching phase and that are not
        already in a batch may be included. The certificates' forms advance to
        In Batch; they are only completed when an invoice-raised number is
        recorded (see record_invoice_raised).

        Raises:
            ValidationError: If no certificates are given, any are missing, or
                any are not eligible for batching.
        """
        if not certificate_ids:
            raise ValidationError(
                {"certificate_ids": ["Select at least one certificate."]}
            )

        certs = list(
            Certificate.objects.filter(pk__in=certificate_ids).select_related(
                "form", "form__case"
            )
        )
        found_ids = {c.pk for c in certs}
        missing = set(certificate_ids) - found_ids
        if missing:
            raise ValidationError(
                {"certificate_ids": [f"Certificates not found: {sorted(missing)}"]}
            )

        ineligible = [c.certificate_number for c in certs if not c.is_batch_eligible]
        if ineligible:
            raise ValidationError(
                {
                    "certificate_ids": [
                        "These certificates are not eligible for batching (must "
                        "be in the Batching phase and not already batched): "
                        f"{ineligible}"
                    ]
                }
            )

        settings_obj = SystemSettings.load()
        cert_rate = settings_obj.cost_per_certificate
        bag_rate = settings_obj.cost_per_bag
        tax_percentage = settings_obj.tax_percentage

        certificate_count = len(certs)
        bag_count = sum(c.form.bags.count() for c in certs)

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
            certificate_number_range=BatchService._certificate_number_range(certs),
            created_by=user,
        )

        # Attach each certificate to the batch and advance its form to In Batch.
        # Forms are only completed once an invoice-raised number is recorded.
        for cert in certs:
            cert.batch = batch
            cert.save(update_fields=["batch"])
            WorkflowService.advance_form(cert.form, user)

        BatchService.build_zip(batch)

        settings.LOGGER.info(
            f"User {user} created {batch.batch_number} with "
            f"{len(certs)} certificate(s)"
        )
        return batch

    @staticmethod
    def build_cost_summary_context(batch):
        certificates = list(
            batch.certificates.select_related("form", "form__case").prefetch_related(
                "form__bags"
            )
        )

        # Derive the distinct cases behind the batch's certificates, tallying
        # each case's contribution from only the certificates in this batch.
        case_rows = {}
        for cert in certificates:
            case = cert.form.case
            row = case_rows.setdefault(
                case.pk,
                {"case_number": case.case_number, "bags": 0, "certificates": 0},
            )
            row["bags"] += cert.form.bags.count()
            row["certificates"] += 1

        cases = sorted(case_rows.values(), key=lambda row: row["case_number"])

        return {
            "batch_number": batch.batch_number,
            "date_batched": batch.created_at.strftime("%d %B %Y"),
            "certificate_count": batch.certificate_count,
            "bag_count": batch.bag_count,
            "cert_rate": f"{batch.cert_rate:.2f}",
            "bag_rate": f"{batch.bag_rate:.2f}",
            "cert_cost": f"{batch.cert_cost:.2f}",
            "bag_cost": f"{batch.bag_cost:.2f}",
            "subtotal": f"{batch.subtotal:.2f}",
            "tax_percentage": float(batch.tax_percentage),
            "tax_amount": f"{batch.tax_amount:.2f}",
            "total": f"{batch.total:.2f}",
            "certificate_number_range": batch.certificate_number_range,
            "certificate_numbers": BatchService._collapse_cert_ranges(
                BatchService._certificate_numbers(certificates)
            ),
            "cases": cases,
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
            for cert in batch.certificates.all():
                pdf = cert.pdf_file
                if not pdf:
                    continue
                pdf.open("rb")
                data = pdf.read()
                pdf.close()
                archive.writestr(f"{cert.certificate_number}.pdf", data)

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
        """Record a unique invoice-raised number and complete the batch's forms.

        Advances each of the batch's certificates' forms from In Batch to
        Complete and stamps the form's completion time.

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

        certificates = list(batch.certificates.select_related("form").all())
        for cert in certificates:
            form = cert.form
            if form.phase == Case.PhaseChoices.COMPLETE:
                continue
            # Advance through to complete (in_batch → complete).
            while form.phase != Case.PhaseChoices.COMPLETE:
                WorkflowService.advance_form(form, user)
            form.completed_at = timezone.now()
            form.save(update_fields=["completed_at"])

        settings.LOGGER.info(
            f"User {user} recorded invoice {number} on {batch.batch_number}; "
            f"{len(certificates)} certificate(s) completed"
        )
        return batch

    @staticmethod
    @transaction.atomic
    def unset_invoice_raised(batch, user):
        """Clear the invoice-raised number and return the batch's forms to the
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

        certificates = list(batch.certificates.select_related("form").all())
        for cert in certificates:
            form = cert.form
            if form.phase == Case.PhaseChoices.COMPLETE:
                form.phase = Case.PhaseChoices.IN_BATCH
                form.completed_at = None
                form.last_actioned_by = user
                form.save(update_fields=["phase", "completed_at", "last_actioned_by"])

        settings.LOGGER.info(
            f"User {user} unset invoice {number} on {batch.batch_number}; "
            f"{len(certificates)} certificate(s) returned to in-batch"
        )
        return batch

    @staticmethod
    @transaction.atomic
    def delete_batch(batch, user):
        """Delete a batch, freeing its certificates and returning each form to
        the Batching phase."""
        certificates = list(batch.certificates.select_related("form").all())
        for cert in certificates:
            form = cert.form
            cert.batch = None
            cert.save(update_fields=["batch"])
            if form.phase in (
                Case.PhaseChoices.IN_BATCH,
                Case.PhaseChoices.COMPLETE,
            ):
                form.phase = Case.PhaseChoices.BATCHING
                form.completed_at = None
            form.last_actioned_by = user
            form.save(update_fields=["phase", "completed_at", "last_actioned_by"])

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
