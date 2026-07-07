"""Certificate service — per-form certificate generation business logic.

Each Priority 3 form produces exactly one certificate. Generating a form's
certificate either creates it (with a fresh, unique auto number) or re-renders
it in place (keeping its existing number), records the certification date,
stores the Section C "other matters" note against the certificate, and renders
the PDF. Generation never touches any other certificate on the case, and a
certificate that already belongs to a batch is frozen and cannot be altered.
"""

from django.conf import settings
from django.core.files.base import ContentFile
from django.db import transaction
from django.template.loader import render_to_string
from django.utils import timezone
from rest_framework.exceptions import NotFound, ValidationError

from ..models import Case, Certificate
from .pdf_service import PDFService
from .workflow_service import WorkflowService

CERTIFICATE_TEMPLATE = "pdf/certificate_template.html"
MAX_BAGS_PER_CERTIFICATE = 5


class CertificateService:
    """Business logic for per-form certificate operations."""

    ONES = [
        "",
        "one",
        "two",
        "three",
        "four",
        "five",
        "six",
        "seven",
        "eight",
        "nine",
        "ten",
        "eleven",
        "twelve",
        "thirteen",
        "fourteen",
        "fifteen",
        "sixteen",
        "seventeen",
        "eighteen",
        "nineteen",
    ]
    TENS = [
        "",
        "",
        "twenty",
        "thirty",
        "forty",
        "fifty",
        "sixty",
        "seventy",
        "eighty",
        "ninety",
    ]

    @staticmethod
    def _number_to_words(n: int) -> str:
        """Convert an integer (0–99) to its English word form."""
        if n < 0:
            return str(n)
        if n < 20:
            return CertificateService.ONES[n]
        if n < 100:
            tens = CertificateService.TENS[n // 10]
            ones = CertificateService.ONES[n % 10]
            return f"{tens}-{ones}" if ones else tens
        return str(n)

    @staticmethod
    def get_certificate(pk):
        """Retrieve a certificate by primary key.

        Raises:
            NotFound: If the certificate does not exist.
        """
        try:
            return Certificate.objects.select_related("form", "form__case").get(pk=pk)
        except Certificate.DoesNotExist:
            raise NotFound("Certificate not found.")

    @staticmethod
    def get_certificate_for_case(case, certificate_id):
        """Retrieve a certificate scoped to a case, reached via its form.

        Raises:
            NotFound: If no such certificate belongs to the case.
        """
        try:
            return Certificate.objects.get(pk=certificate_id, form__case=case)
        except Certificate.DoesNotExist:
            raise NotFound("Certificate not found for this case.")

    @staticmethod
    def _format_officer_legal(officer):
        """Format officer as: Rank BadgeNumber SURNAME, FirstName of Organisation."""
        if not officer:
            return "[Pending]"
        parts = []
        rank = (
            officer.get_rank_display() if hasattr(officer, "get_rank_display") else ""
        )
        if rank and rank.lower() not in ("unknown", "other"):
            parts.append(rank)
        if officer.badge_number:
            parts.append(officer.badge_number)
        if officer.last_name:
            parts.append(officer.last_name.upper())
        result = " ".join(parts)
        if officer.given_names:
            result += f", {officer.given_names}"
        if hasattr(officer, "station") and officer.station:
            result += f" of {officer.station.name}"
        return result.strip() or officer.full_name or "[Pending]"

    @staticmethod
    def build_certificate_context(certificate):
        """Build the PDF template context for a certificate.

        The certificate's covered bags and owning case are reached through its
        form: the police reference is the case number, and the officers and
        defendants come from the case.

        Raises:
            ValidationError: If the form has no bags, or none of its bags have a
                botanical assessment.
        """
        case = certificate.form.case
        bags = list(certificate.form.bags.select_related("assessment").all())

        if not bags:
            raise ValidationError("Cannot generate certificate: no bags associated.")

        bags_with_assessments = [
            bag for bag in bags if getattr(bag, "assessment", None) is not None
        ]
        if not bags_with_assessments:
            raise ValidationError(
                "Cannot generate certificate: no bags have botanical assessments."
            )

        defendants = case.defendants.all()

        tag_numbers = ", ".join(bag.seal_tag_numbers for bag in bags)
        # Section B uses generic "item"/"items" instead of content type names
        section_b_description = "item" if len(bags) == 1 else "items"

        # Section A still uses the full content type descriptions
        unique_types = list(
            dict.fromkeys(bag.get_content_type_display() for bag in bags)
        )
        if len(unique_types) == 1:
            descriptions = unique_types[0]
        elif len(unique_types) == 2:
            descriptions = f"{unique_types[0]} and {unique_types[1]}"
        else:
            descriptions = ", ".join(unique_types[:-1]) + f" and {unique_types[-1]}"
        primary_assessment = bags_with_assessments[0].assessment

        receipt_date = ""
        if case.received:
            receipt_date = case.received.strftime("%d %B %Y")

        certification_date = ""
        if certificate.certified_date:
            certification_date = certificate.certified_date.strftime("%d %B %Y")

        defendant_display = (
            "; ".join(d.pdf_name for d in defendants)
            if defendants.exists()
            else "UNKNOWN"
        )

        return {
            "certificate_number": certificate.certificate_number,
            "police_reference_number": case.case_number,
            "approved_botanist": (
                case.approved_botanist.full_name if case.approved_botanist else ""
            ),
            "quantity_of_bags": len(bags),
            "quantity_of_bags_words": CertificateService._number_to_words(len(bags)),
            "tag_numbers": tag_numbers,
            "new_tag_numbers": ", ".join(
                bag.new_seal_tag_numbers for bag in bags if bag.new_seal_tag_numbers
            )
            or "[Pending]",
            "description": descriptions,
            "section_b_description": section_b_description,
            "defendant": defendant_display,
            "police_officer": CertificateService._format_officer_legal(
                case.submitting_officer
            ),
            "receiving_officer": CertificateService._format_officer_legal(
                case.requesting_officer or case.submitting_officer
            ),
            "receipt_date": receipt_date,
            "species_name": (
                primary_assessment.get_determination_display()
                if primary_assessment.determination
                else "Unknown"
            ),
            "other_matters": certificate.additional_notes or "None",
            "certification_date": certification_date,
            "logo_path": str(
                settings.BASE_DIR / "staticfiles" / "images" / "BCSTransparent.png"
            ),
            "dbca_org_data": {
                "address": "Locked Bag 104",
                "city": "Bentley Delivery Centre",
                "state": "WA",
                "zip": "6983",
            },
        }

    @staticmethod
    def _render_pdf(certificate):
        """Render a certificate's PDF bytes from its form's bags and case."""
        context = CertificateService.build_certificate_context(certificate)
        html = render_to_string(CERTIFICATE_TEMPLATE, context)
        return PDFService._html_to_pdf(html)

    @staticmethod
    @transaction.atomic
    def generate_certificate(form, user, section_c_note=None):
        """Generate (or re-render) the single certificate for one Priority 3 form.

        Creates the form's certificate with a fresh unique number when none
        exists, or re-renders the existing certificate in place while keeping
        its number. The certification date is set to today and the Section C
        "other matters" note, when supplied, is stored on the certificate.
        Generating this form's certificate never touches any other certificate
        on the case.

        Args:
            form: The Priority3Form to generate a certificate for.
            user: The user performing the action.
            section_c_note: Optional Section C "other matters" note. When None on
                a regeneration the existing note is preserved.

        Returns:
            The created or re-rendered Certificate instance.

        Raises:
            ValidationError: If the form has no drug bags, exceeds the bag cap,
                has an unassessed bag, or its certificate is already batched.
        """
        bags = list(form.bags.select_related("assessment").all())
        if not bags:
            raise ValidationError("This form has no drug bags; add at least one.")
        if len(bags) > MAX_BAGS_PER_CERTIFICATE:
            raise ValidationError(
                f"A form may cover at most {MAX_BAGS_PER_CERTIFICATE} drug bags."
            )
        if any(
            getattr(bag, "assessment", None) is None
            or bag.assessment.determination in (None, "pending")
            for bag in bags
        ):
            raise ValidationError("Every drug bag must be assessed first.")

        # Never alter a certificate that is already frozen inside a batch.
        existing = getattr(form, "certificate", None)
        if existing and existing.batch_id is not None:
            raise ValidationError("This form's certificate is batched and frozen.")

        today = timezone.now().date()
        # Use explicit section_c_note if provided; otherwise fall back to the
        # form's own additional_notes field (per-form Section C content).
        effective_note = (
            section_c_note
            if section_c_note is not None
            else (form.additional_notes or "")
        )

        if existing is None:
            certificate = Certificate.objects.create(
                form=form,
                certified_date=today,
                additional_notes=effective_note.strip() or None,
            )
        else:
            # Re-render the same certificate in place — keep its number.
            certificate = existing
            certificate.additional_notes = effective_note.strip() or None
            certificate.certified_date = today

        pdf_bytes = CertificateService._render_pdf(certificate)
        filename = f"certificate_{certificate.certificate_number}.pdf"
        if certificate.pdf_file:
            certificate.pdf_file.delete(save=False)
        certificate.pdf_file.save(filename, ContentFile(pdf_bytes), save=False)
        certificate.pdf_size = len(pdf_bytes)
        certificate.save()

        form.certificates_generated_at = timezone.now()
        if form.phase == Case.PhaseChoices.ASSESSMENT:
            WorkflowService.advance_form(form, user)
        form.save(update_fields=["certificates_generated_at"])

        settings.LOGGER.info(
            f"User {user} generated certificate {certificate.certificate_number} "
            f"for form {form.pk} (case {form.case.case_number})"
        )

        return certificate

    @staticmethod
    def regenerate_certificate_pdf(certificate):
        """Re-render and replace the stored PDF for an existing certificate.

        Raises:
            ValidationError: If the certificate already belongs to a batch.
        """
        if certificate.batch_id is not None:
            raise ValidationError(
                "Cannot regenerate a certificate that is already batched."
            )

        pdf_bytes = CertificateService._render_pdf(certificate)

        if certificate.pdf_file:
            certificate.pdf_file.delete(save=False)

        filename = f"certificate_{certificate.certificate_number}.pdf"
        certificate.pdf_file.save(filename, ContentFile(pdf_bytes), save=False)
        certificate.pdf_size = len(pdf_bytes)
        certificate.save(update_fields=["pdf_file", "pdf_size"])

        return certificate


# Backward-compatible function aliases for existing consumers
def build_certificate_context(certificate):
    """Backward-compatible alias."""
    return CertificateService.build_certificate_context(certificate)


def generate_certificate(form, user, section_c_note=None):
    """Backward-compatible alias."""
    return CertificateService.generate_certificate(form, user, section_c_note)


def regenerate_certificate_pdf(certificate):
    """Backward-compatible alias."""
    return CertificateService.regenerate_certificate_pdf(certificate)
