"""Certificate service — certificate generation business logic.

Handles grouping drug bags into certificates (max 5 bags each), generating one
final certificate PDF per group (with the certification date, no digital
signature), and regenerating certificate PDFs in place before batching.
"""

from django.conf import settings
from django.core.files.base import ContentFile
from django.db import transaction
from django.template.loader import render_to_string
from django.utils import timezone
from rest_framework.exceptions import NotFound, ValidationError

from ..models import Case, CasePhaseHistory, Certificate
from .pdf_service import PDFService

CERTIFICATE_TEMPLATE = "pdf/certificate_template.html"
MAX_BAGS_PER_CERTIFICATE = 5


class CertificateService:
    """Business logic for certificate operations."""

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
            return Certificate.objects.select_related("submission").get(pk=pk)
        except Certificate.DoesNotExist:
            raise NotFound("Certificate not found.")

    @staticmethod
    def get_certificate_for_case(submission, certificate_id):
        """Retrieve a certificate scoped to a case."""
        try:
            return submission.certificates.get(pk=certificate_id)
        except Certificate.DoesNotExist:
            raise NotFound("Certificate not found for this case.")

    @staticmethod
    def group_bags_for_certificates(submission, groups=None):
        """Resolve and validate the bag grouping for certificate generation.

        Args:
            submission: The Case instance.
            groups: Optional list of lists of drug-bag ids. When provided, each
                group must have 1–5 bags, every bag must belong to exactly one
                group, and the union must equal the case's bag set.

        Returns:
            A list of lists of DrugBag instances.

        Raises:
            ValidationError: If the case has no bags or the grouping is invalid.
        """
        bag_qs = list(submission.bags.all().order_by("id"))
        if not bag_qs:
            raise ValidationError(
                "Cannot generate certificates: case has no drug bags."
            )

        bags_by_id = {bag.id: bag for bag in bag_qs}

        if groups is None:
            # Auto-group into sequential chunks of up to five bags
            return [
                bag_qs[i : i + MAX_BAGS_PER_CERTIFICATE]
                for i in range(0, len(bag_qs), MAX_BAGS_PER_CERTIFICATE)
            ]

        if not isinstance(groups, list) or not groups:
            raise ValidationError("groups must be a non-empty list of bag id lists.")

        seen = set()
        resolved = []
        for index, group in enumerate(groups):
            if not isinstance(group, list) or not (
                1 <= len(group) <= MAX_BAGS_PER_CERTIFICATE
            ):
                raise ValidationError(
                    f"Group {index + 1} must contain between 1 and "
                    f"{MAX_BAGS_PER_CERTIFICATE} bags."
                )
            resolved_group = []
            for bag_id in group:
                if bag_id in seen:
                    raise ValidationError(
                        f"Bag {bag_id} appears in more than one group."
                    )
                if bag_id not in bags_by_id:
                    raise ValidationError(f"Bag {bag_id} does not belong to this case.")
                seen.add(bag_id)
                resolved_group.append(bags_by_id[bag_id])
            resolved.append(resolved_group)

        if seen != set(bags_by_id.keys()):
            raise ValidationError(
                "Every drug bag on the case must belong to exactly one group."
            )

        return resolved

    @staticmethod
    def _format_officer_legal(officer):
        """Format officer as: Rank BadgeNumber SURNAME, FirstName of Organisation."""
        if not officer:
            return "[Pending]"
        parts = []
        rank = (
            officer.get_rank_display() if hasattr(officer, "get_rank_display") else ""
        )
        if rank and rank.lower() != "unknown":
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
    def build_certificate_context(submission, certificate):
        """Build template context for a certificate, using its own bag group.

        Raises:
            ValidationError: If the certificate's bags have no assessments.
        """
        bags = list(certificate.bags.select_related("assessment").all())

        if not bags:
            # Legacy certificates may not have an explicit group — fall back to
            # all bags on the case so historic data still renders.
            bags = list(submission.bags.select_related("assessment").all())

        if not bags:
            raise ValidationError("Cannot generate certificate: no bags associated.")

        bags_with_assessments = [
            bag for bag in bags if getattr(bag, "assessment", None) is not None
        ]
        if not bags_with_assessments:
            raise ValidationError(
                "Cannot generate certificate: no bags have botanical assessments."
            )

        defendants = submission.defendants.all()

        tag_numbers = ", ".join(bag.seal_tag_numbers for bag in bags)
        descriptions = ", ".join(bag.get_content_type_display() for bag in bags)
        primary_assessment = bags_with_assessments[0].assessment

        receipt_date = ""
        if submission.received:
            receipt_date = submission.received.strftime("%d %B %Y")

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
            "police_reference_number": submission.case_number,
            "approved_botanist": (
                submission.approved_botanist.full_name
                if submission.approved_botanist
                else ""
            ),
            "quantity_of_bags": len(bags),
            "quantity_of_bags_words": CertificateService._number_to_words(len(bags)),
            "tag_numbers": tag_numbers,
            "new_tag_numbers": ", ".join(
                bag.new_seal_tag_numbers for bag in bags if bag.new_seal_tag_numbers
            )
            or "[Pending]",
            "description": descriptions,
            "defendant": defendant_display,
            "police_officer": CertificateService._format_officer_legal(
                submission.submitting_officer
            ),
            "receiving_officer": CertificateService._format_officer_legal(
                submission.requesting_officer or submission.submitting_officer
            ),
            "receipt_date": receipt_date,
            "species_name": (
                primary_assessment.get_determination_display()
                if primary_assessment.determination
                else "Unknown"
            ),
            "other_matters": certificate.additional_notes
            or submission.additional_notes
            or "None",
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
    def _render_pdf(submission, certificate):
        context = CertificateService.build_certificate_context(submission, certificate)
        html = render_to_string(CERTIFICATE_TEMPLATE, context)
        return PDFService._html_to_pdf(html)

    @staticmethod
    @transaction.atomic
    def generate_certificates(submission, user, groups=None, group_notes=None):
        """Generate one certificate (and PDF) per bag group for the case.

        Removes any existing (un-batched) certificates first so regeneration
        with new groupings is clean. When ``group_notes`` is provided it is
        aligned by index with the groups and stored as each certificate's
        Section C notes.

        Returns:
            A list of created Certificate instances.

        Raises:
            ValidationError: If grouping is invalid or assessments are missing.
        """
        if submission.batch_id is not None:
            raise ValidationError(
                "Cannot regenerate certificates for a case that is already batched."
            )

        resolved_groups = CertificateService.group_bags_for_certificates(
            submission, groups
        )

        # Clear out previous certificates (they have no signed/locked state now)
        for existing in submission.certificates.all():
            if existing.pdf_file:
                existing.pdf_file.delete(save=False)
            existing.delete()

        today = timezone.now().date()
        created = []
        for index, group in enumerate(resolved_groups):
            note = ""
            if isinstance(group_notes, list) and index < len(group_notes):
                note = (group_notes[index] or "").strip()
            certificate = Certificate.objects.create(
                submission=submission,
                certified_date=today,
                additional_notes=note or None,
            )
            certificate.bags.set(group)

            pdf_bytes = CertificateService._render_pdf(submission, certificate)
            filename = f"certificate_{certificate.certificate_number}.pdf"
            certificate.pdf_file.save(filename, ContentFile(pdf_bytes), save=False)
            certificate.pdf_size = len(pdf_bytes)
            certificate.save(update_fields=["pdf_file", "pdf_size"])
            created.append(certificate)

        submission.certificates_generated_at = timezone.now()
        submission.save(update_fields=["certificates_generated_at"])

        # Generating certificates completes the assessment stage — move the case
        # into unsigned_generation so the workflow reflects that certificates now
        # exist (the wizard may have skipped the assessment "Continue" step).
        if submission.phase == Case.PhaseChoices.ASSESSMENT:
            old_phase = submission.phase
            submission.phase = Case.PhaseChoices.UNSIGNED_GENERATION
            submission.save(update_fields=["phase"])
            CasePhaseHistory.objects.create(
                submission=submission,
                from_phase=old_phase,
                to_phase=submission.phase,
                action="advance",
                user=user,
            )

        settings.LOGGER.info(
            f"User {user} generated {len(created)} certificate(s) "
            f"for case {submission.case_number}"
        )

        return created

    @staticmethod
    def regenerate_certificate_pdf(certificate):
        """Re-render and replace the stored PDF for an existing certificate.

        Raises:
            ValidationError: If the case is already batched.
        """
        submission = certificate.submission
        if submission.batch_id is not None:
            raise ValidationError(
                "Cannot regenerate a certificate for a case that is already batched."
            )

        pdf_bytes = CertificateService._render_pdf(submission, certificate)

        if certificate.pdf_file:
            certificate.pdf_file.delete(save=False)

        filename = f"certificate_{certificate.certificate_number}.pdf"
        certificate.pdf_file.save(filename, ContentFile(pdf_bytes), save=False)
        certificate.pdf_size = len(pdf_bytes)
        certificate.save(update_fields=["pdf_file", "pdf_size"])

        return certificate


# Backward-compatible function aliases for existing consumers
def build_certificate_context(submission, certificate):
    """Backward-compatible alias."""
    return CertificateService.build_certificate_context(submission, certificate)


def generate_certificates(submission, user, groups=None, group_notes=None):
    """Backward-compatible alias."""
    return CertificateService.generate_certificates(
        submission, user, groups, group_notes
    )


def regenerate_certificate_pdf(certificate):
    """Backward-compatible alias."""
    return CertificateService.regenerate_certificate_pdf(certificate)
