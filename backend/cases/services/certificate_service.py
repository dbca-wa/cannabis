"""Certificate service — certificate CRUD and signing business logic.

Handles certificate generation, regeneration, signing validation,
and unlock operations.
"""

import base64
import hashlib

from django.conf import settings
from django.core.files.base import ContentFile
from django.core.files.storage import default_storage
from django.db import transaction
from django.template.loader import render_to_string
from django.utils import timezone
from rest_framework.exceptions import NotFound, PermissionDenied, ValidationError

from signatures.models import Signature, SignatureAuditLog

from ..models import Case, Certificate
from .pdf_service import PDFService

CERTIFICATE_TEMPLATE = "pdf/certificate_template.html"


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
            raise NotFound(f"Certificate with pk {pk} not found.")

    @staticmethod
    def get_submission_certificate(submission_id, certificate_id):
        """Retrieve a certificate scoped to a submission.

        Raises:
            NotFound: If the submission or certificate does not exist.
        """
        try:
            submission = Case.objects.get(pk=submission_id)
        except Case.DoesNotExist:
            raise NotFound("Case not found.")

        try:
            return submission.certificates.get(pk=certificate_id)
        except Certificate.DoesNotExist:
            raise NotFound("Certificate not found for this case.")

    @staticmethod
    def build_certificate_context(submission, certificate):
        """Build template context for certificate rendering.

        Maps Submission, DrugBag, BotanicalAssessment, and related model data
        to the variables expected by the certificate HTML template.

        Raises:
            ValidationError: If the submission has no bags or no assessments.
        """
        bags = submission.bags.select_related("assessment").all()

        if not bags.exists():
            raise ValidationError(
                "Cannot generate certificate: submission has no bags."
            )

        bags_with_assessments = [
            bag
            for bag in bags
            if hasattr(bag, "assessment") and bag.assessment is not None
        ]
        if not bags_with_assessments:
            raise ValidationError(
                "Cannot generate certificate: no bags have botanical assessments."
            )

        defendants = submission.defendants.all()

        tag_numbers = ", ".join(bag.seal_tag_numbers for bag in bags)
        descriptions = ", ".join(bag.get_content_type_display() for bag in bags)

        primary_assessment = bags_with_assessments[0].assessment

        if primary_assessment.assessment_date:
            primary_assessment.assessment_date.strftime("%d %B %Y")

        receipt_date = ""
        if submission.received:
            receipt_date = submission.received.strftime("%d %B %Y")

        defendant_display = (
            "; ".join(d.pdf_name for d in defendants)
            if defendants.exists()
            else "UNKNOWN"
        )

        def format_officer_legal(officer):
            """Format officer in legal certificate format: Rank BadgeNumber SURNAME, FirstName of Organisation"""
            if not officer:
                return "[Pending]"
            parts = []
            rank = (
                officer.get_rank_display()
                if hasattr(officer, "get_rank_display")
                else ""
            )
            if rank:
                parts.append(rank)
            if officer.badge_number:
                parts.append(officer.badge_number)
            if officer.last_name:
                parts.append(officer.last_name.upper())
            result = " ".join(parts)
            if officer.first_name:
                result += f", {officer.first_name}"
            if hasattr(officer, "station") and officer.station:
                result += f" of {officer.station.name}"
            return result.strip() or officer.full_name or "[Pending]"

        return {
            "certificate_number": certificate.certificate_number,
            "police_reference_number": submission.case_number,
            "approved_botanist": (
                submission.approved_botanist.full_name
                if submission.approved_botanist
                else ""
            ),
            "quantity_of_bags": bags.count(),
            "quantity_of_bags_words": CertificateService._number_to_words(bags.count()),
            "tag_numbers": tag_numbers,
            "new_tag_numbers": ", ".join(
                bag.new_seal_tag_numbers for bag in bags if bag.new_seal_tag_numbers
            )
            or "[Pending]",
            "description": descriptions,
            "defendant": defendant_display,
            "police_officer": format_officer_legal(submission.submitting_officer),
            "receiving_officer": format_officer_legal(submission.requesting_officer),
            "receipt_date": receipt_date,
            "species_name": (
                primary_assessment.get_determination_display()
                if primary_assessment.determination
                else "Unknown"
            ),
            "other_matters": submission.additional_notes or "None",
            "certification_date": "",  # Empty for unsigned — set during signing
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
    def validate_certificate_generation(submission):
        """Validate that a certificate can be generated for the given submission.

        Checks:
        - No locked certificate already exists.
        - No certificate already exists at all.

        Note: Signature check is NOT done here — that's for the signing step only.

        Raises:
            ValidationError: If generation is not permitted.
        """
        existing_cert = submission.certificates.first()
        if existing_cert and existing_cert.is_locked:
            raise ValidationError(
                "Certificate is locked after signing. The assigned botanist "
                "must unlock it before regenerating."
            )

        if submission.certificates.exists():
            raise ValidationError("Certificate already exists for this submission.")

    @staticmethod
    @transaction.atomic
    def generate_unsigned_certificate(submission, user):
        """Create an unsigned certificate record and render the PDF.

        Validates the submission, creates the Certificate record, builds the
        template context, renders the PDF, and stores it on the certificate.

        Returns:
            The newly created Certificate instance (with unsigned_pdf_file populated).

        Raises:
            ValidationError: If validation fails or data is incomplete.
        """
        CertificateService.validate_certificate_generation(submission)

        certificate = Certificate.objects.create(submission=submission)

        context = CertificateService.build_certificate_context(submission, certificate)
        html = render_to_string(CERTIFICATE_TEMPLATE, context)
        pdf_bytes = PDFService._html_to_pdf(html)

        filename = f"certificate_{certificate.certificate_number}.pdf"
        certificate.unsigned_pdf_file.save(filename, ContentFile(pdf_bytes), save=False)
        certificate.unsigned_pdf_size = len(pdf_bytes)
        certificate.save(update_fields=["unsigned_pdf_file", "unsigned_pdf_size"])

        submission.certificates_generated_at = timezone.now()
        submission.save(update_fields=["certificates_generated_at"])

        settings.LOGGER.info(
            f"User {user} generated unsigned certificate "
            f"{certificate.certificate_number}"
        )

        return certificate

    @staticmethod
    def regenerate_certificate_pdf(certificate):
        """Re-render and replace the stored PDF for an existing certificate.

        Returns:
            The updated Certificate instance.

        Raises:
            ValidationError: If the certificate is locked or data is incomplete.
        """
        if certificate.is_locked:
            raise ValidationError(
                "Certificate is locked after signing. "
                "The assigned botanist must unlock it before regenerating."
            )

        submission = certificate.submission

        context = CertificateService.build_certificate_context(submission, certificate)
        html = render_to_string(CERTIFICATE_TEMPLATE, context)
        pdf_bytes = PDFService._html_to_pdf(html)

        if certificate.unsigned_pdf_file:
            certificate.unsigned_pdf_file.delete(save=False)

        filename = f"certificate_{certificate.certificate_number}.pdf"
        certificate.unsigned_pdf_file.save(filename, ContentFile(pdf_bytes), save=False)
        certificate.unsigned_pdf_size = len(pdf_bytes)
        certificate.save(update_fields=["unsigned_pdf_file", "unsigned_pdf_size"])

        return certificate

    @staticmethod
    @transaction.atomic
    def unlock_certificate(certificate, user):
        """Unlock a certificate for unsigned PDF regeneration.

        Only the assigned botanist or admin/staff users may unlock.
        Clears signed PDF and resets signature tracking fields.

        Raises:
            PermissionDenied: If the user is not permitted to unlock.
            ValidationError: If the certificate is not locked.
        """
        submission = certificate.submission

        is_assigned_botanist = submission.approved_botanist_id == user.id
        is_staff_or_admin = user.is_staff or user.is_superuser
        if not (is_assigned_botanist or is_staff_or_admin):
            raise PermissionDenied(
                "Only the assigned botanist or staff may unlock this certificate."
            )

        if not certificate.is_locked:
            raise ValidationError("Certificate is not locked.")

        # Delete the signed PDF file from storage
        if certificate.signed_pdf_file:
            try:
                old_path = certificate.signed_pdf_file.path
                if default_storage.exists(old_path):
                    default_storage.delete(old_path)
            except Exception as e:
                settings.LOGGER.warning(f"Could not delete signed PDF file: {e}")

        # Reset lock and signature tracking fields
        certificate.is_locked = False
        certificate.signed_pdf_file = None
        certificate.signed_pdf_size = 0
        certificate.signature_embedded_at = None
        certificate.signed_by = None
        certificate.file_hash_at_signing = None
        certificate.signature_used_id = None
        certificate.unlocked_by = user
        certificate.save()

        SignatureAuditLog.objects.create(
            user=user,
            actor=user,
            action="unlock",
        )

        settings.LOGGER.info(
            f"User {user.email} unlocked certificate "
            f"{certificate.certificate_number} for case {submission.case_number}"
        )

        return certificate

    @staticmethod
    def validate_signing_permission(submission, user):
        """Validate that the user has permission to sign the certificate.

        The assigned botanist or admin/staff users may sign.

        Raises:
            PermissionDenied: If the user is not the assigned botanist or staff.
        """
        is_assigned_botanist = submission.approved_botanist_id == user.id
        is_staff_or_admin = user.is_staff or user.is_superuser
        if not (is_assigned_botanist or is_staff_or_admin):
            raise PermissionDenied(
                "Only the assigned botanist or staff may sign this certificate."
            )

    @staticmethod
    def get_verified_signature(user):
        """Retrieve and verify the integrity of a user's signature.

        Returns:
            A tuple of (Signature instance, base64 data URI string).

        Raises:
            ValidationError: If no signature exists or integrity check fails.
        """
        try:
            signature = Signature.objects.get(user=user)
        except Signature.DoesNotExist:
            raise ValidationError(
                "You must upload a signature before signing a certificate."
            )

        # Verify SHA-256 hash integrity of the stored signature file
        signature.image.open("rb")
        sha256 = hashlib.sha256()
        for chunk in signature.image.chunks():
            sha256.update(chunk)
        computed_hash = sha256.hexdigest()
        signature.image.seek(0)

        if computed_hash != signature.file_hash:
            SignatureAuditLog.objects.create(
                user=user,
                actor=user,
                action="integrity_failure",
                content_type=signature.content_type,
                file_size=signature.file_size,
                file_hash=signature.file_hash,
            )
            settings.LOGGER.error(
                f"Signature integrity failure for user {user.email}: "
                f"expected {signature.file_hash}, got {computed_hash}"
            )
            raise ValidationError("Signature file integrity check failed.")

        # Read and base64-encode the signature image
        image_bytes = signature.image.read()
        signature.image.seek(0)
        encoded = base64.b64encode(image_bytes).decode("utf-8")
        signature_data_uri = f"data:{signature.content_type};base64,{encoded}"

        return signature, signature_data_uri, computed_hash

    @staticmethod
    @transaction.atomic
    def record_signing(certificate, signature, computed_hash, pdf_output, user):
        """Record the signing of a certificate after PDF generation.

        Saves the signed PDF, updates signature tracking fields, locks the
        certificate, creates an audit log, and optionally advances the phase.

        Args:
            certificate: The Certificate instance.
            signature: The Signature record used.
            computed_hash: SHA-256 hash of the signature file.
            pdf_output: The signed PDF bytes.
            user: The user who signed.

        Returns:
            The updated Certificate instance.
        """

        submission = certificate.submission

        pdf_filename = f"signed_{certificate.certificate_number}.pdf"
        certificate.signed_pdf_file = ContentFile(pdf_output, name=pdf_filename)
        certificate.signed_pdf_size = len(pdf_output)
        certificate.signature_used_id = signature.id
        certificate.signature_embedded_at = timezone.now()
        certificate.signed_by = user
        certificate.file_hash_at_signing = computed_hash
        certificate.is_locked = True
        certificate.locked_at = timezone.now()
        certificate.save()

        SignatureAuditLog.objects.create(
            user=user,
            actor=user,
            action="sign",
            content_type=signature.content_type,
            file_size=signature.file_size,
            file_hash=computed_hash,
        )

        # Advance phase from Botanist Sign-Off to Invoice Generation
        if submission.phase == Case.PhaseChoices.BOTANIST_SIGNOFF:
            submission.phase = Case.PhaseChoices.INVOICING
            submission.save(update_fields=["phase"])

            settings.LOGGER.info(
                f"Case {submission.case_number} advanced from "
                f"botanist_signoff to invoicing after signing"
            )

            # Notify the assigned finance officer
            if submission.finance_officer_id:
                CertificateService._notify_finance_officer(submission, user)

        settings.LOGGER.info(
            f"User {user.email} signed certificate "
            f"{certificate.certificate_number} for case {submission.case_number}"
        )

        return certificate

    @staticmethod
    def _notify_finance_officer(submission, signing_user):
        """Send a notification to the assigned finance officer after signing."""
        from communications.models import Notification, NotificationTypes

        finance_officer = submission.finance_officer
        if not finance_officer:
            return

        try:
            prefs = finance_officer.preferences
            if not prefs.notify_phase_changes:
                return
        except Exception:
            return

        Notification.objects.create(
            recipient=finance_officer,
            actor=signing_user,
            notification_type=NotificationTypes.SUBMISSION_PHASE_CHANGED,
            title="Certificate Signed — Ready for Invoicing",
            message=(
                f"{signing_user.get_full_name()} has signed the certificate for "
                f"submission {submission.case_number}. "
                f"The submission has advanced to Invoice Generation."
            ),
            priority=Notification.PriorityLevels.NORMAL,
        )

    @staticmethod
    def sign_certificate(submission, certificate, user):
        """Full signing flow: validate, verify signature, render PDF, record.

        Orchestrates the complete certificate signing process by delegating
        to validate_signing_permission, get_verified_signature, rendering
        the signed template, and record_signing.

        Returns:
            The signed Certificate instance.
        """
        import os

        from django.template.loader import get_template

        CertificateService.validate_signing_permission(submission, user)
        signature, signature_data_uri, computed_hash = (
            CertificateService.get_verified_signature(user)
        )

        certificate_css_path = os.path.join(
            settings.BASE_DIR, "templates/pdf/styles/certificate_styles.css"
        )

        context = CertificateService.build_certificate_context(submission, certificate)
        context["certification_date"] = timezone.now().strftime("%d %B %Y")
        context["signature_image_data"] = signature_data_uri

        try:
            html_content = get_template(CERTIFICATE_TEMPLATE).render(context)
        except Exception as e:
            settings.LOGGER.error(f"Template rendering failed during signing: {e}")
            raise ValidationError("Failed to render certificate template.")

        extra_args = [f"--style={certificate_css_path}", "--javascript"]
        pdf_output = PDFService._html_to_pdf(html_content, extra_args=extra_args)

        return CertificateService.record_signing(
            certificate, signature, computed_hash, pdf_output, user
        )


# Backward-compatible function aliases for existing consumers
def build_certificate_context(submission, certificate):
    """Backward-compatible alias."""
    return CertificateService.build_certificate_context(submission, certificate)


def validate_certificate_generation(submission):
    """Backward-compatible alias."""
    return CertificateService.validate_certificate_generation(submission)


def generate_unsigned_certificate(submission, user):
    """Backward-compatible alias."""
    return CertificateService.generate_unsigned_certificate(submission, user)


def regenerate_certificate_pdf(certificate):
    """Backward-compatible alias."""
    return CertificateService.regenerate_certificate_pdf(certificate)
