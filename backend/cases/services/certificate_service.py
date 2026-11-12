"""Certificate service — per-form certificate generation business logic.

Each Priority 3 form produces exactly one certificate. Generating a form's
certificate either creates it (with a fresh, unique auto number) or re-renders
it in place (keeping its existing number), records the certification date,
stores the Section C "other matters" note against the certificate, and renders
the PDF. Generation never touches any other certificate on the case, and a
certificate that already belongs to a batch is frozen and cannot be altered.
"""

import dataclasses
import hashlib
import json

from django.conf import settings
from django.core.files.base import ContentFile
from django.db import transaction
from django.template.loader import render_to_string
from django.utils import timezone
from rest_framework.exceptions import NotFound, ValidationError

from common.logging import describe_user
from common.utils import join_with_and

from ..models import Case, Certificate
from . import certificate_wording as wording
from .pdf_service import PDFService
from .workflow_service import WorkflowService

CERTIFICATE_TEMPLATE = "pdf/certificate_template.html"
MAX_BAGS_PER_CERTIFICATE = 5

# Context keys left out of the content fingerprint: the certification date
# changes on every regeneration and the rest are fixed page furniture.
_UNFINGERPRINTED_KEYS = frozenset({"certification_date", "logo_path", "dbca_org_data"})

# Stands in for "use the certificate's own Section C note".
_OWN_NOTE = object()

# Stored for an older certificate that already differed from its case when
# fingerprints were first recorded. Never equal to a real fingerprint, so the
# certificate shows as out of date until it is regenerated or re-packaged.
UNVERIFIED_PRINT = "unverified"


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
    def printed_officers(case):
        """The officer text a certificate for this case prints now.

        Returns ``(conveying, requesting)``. The conveying (submitting) officer
        is named in Sections (a) and (b); the requesting officer is optional and
        appears only in Section (a), so it is None when the case has none.
        """
        conveying = wording.format_officer(
            wording.officer_facts(case.submitting_officer),
            role=wording.CONVEYING,
            print_station=case.print_conveying_station,
        )
        requesting = (
            wording.format_officer(
                wording.officer_facts(case.requesting_officer),
                role=wording.REQUESTING,
                print_station=case.print_requesting_station,
                print_rank=case.print_requesting_rank,
            )
            if case.requesting_officer
            else None
        )
        return conveying, requesting

    @staticmethod
    def _ordered_bags(form):
        """The form's bags in a stable order, with their assessments."""
        return list(form.bags.select_related("assessment").order_by("pk"))

    @staticmethod
    def _bag_results(bags):
        """``(original tag, determination)`` for each bag, None when unassessed."""
        return [
            (
                bag.seal_tag_numbers,
                (
                    bag.assessment.determination
                    if getattr(bag, "assessment", None) is not None
                    else None
                ),
            )
            for bag in bags
        ]

    @staticmethod
    def _female_flags(bags):
        """``(original tag, determination, female)`` for each assessed bag."""
        return [
            (
                bag.seal_tag_numbers,
                bag.assessment.determination if bag.assessment else None,
                bool(bag.contains_female_plants),
            )
            for bag in bags
        ]

    @staticmethod
    def needs_regeneration_reasons(certificate):
        """Why a generated, unbatched certificate no longer matches its case.

        Returns a list holding "wording" when it was generated with older
        certificate wording, "officers" when the officer text it would print
        now differs from what it printed, and "details" when anything else it
        prints has changed (for example the defendant or the police
        reference). Empty for a batched certificate (see needs_repackage) or
        one with no PDF yet.
        """
        if certificate.batch_id is not None or not certificate.pdf_file:
            return []
        reasons = []
        if certificate.wording_version < wording.CERTIFICATE_WORDING_VERSION:
            reasons.append("wording")
        conveying, requesting = CertificateService.printed_officers(
            certificate.form.case
        )
        if (conveying, requesting) != (
            certificate.printed_conveying_officer,
            certificate.printed_requesting_officer,
        ):
            reasons.append("officers")
        if not reasons and CertificateService._content_changed(certificate):
            reasons.append("details")
        return reasons

    @staticmethod
    def build_certificate_context(certificate, note=_OWN_NOTE):
        """Build the PDF template context for a certificate.

        The certificate's covered bags and owning case are reached through its
        form: the police reference is the case number, and the officers and
        defendants come from the case.

        Args:
            certificate: The certificate to build for.
            note: The Section C note to print. Defaults to the note stored on
                the certificate.

        Raises:
            ValidationError: If the form has no bags, or any bag has a result
                that cannot be printed (unassessed, pending or legacy).
        """
        case = certificate.form.case
        bags = CertificateService._ordered_bags(certificate.form)

        if not bags:
            raise ValidationError("Cannot generate certificate: no bags associated.")

        bag_results = CertificateService._bag_results(bags)
        CertificateService._raise_if_unprintable(bags)
        results = wording.summarise(bag_results)
        conveying_officer, requesting_officer = CertificateService.printed_officers(
            case
        )

        defendants = case.defendants.all()

        tag_numbers = join_with_and(bag.seal_tag_numbers for bag in bags)
        # Section B uses generic "item"/"items" instead of content type names
        section_b_description = "item" if len(bags) == 1 else "items"

        # Section A still uses the full content type descriptions
        unique_types = list(
            dict.fromkeys(bag.get_content_type_display() for bag in bags)
        )
        descriptions = join_with_and(unique_types)

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
            "new_tag_numbers": join_with_and(
                bag.new_seal_tag_numbers for bag in bags if bag.new_seal_tag_numbers
            )
            or "[Pending]",
            "description": descriptions,
            "section_b_description": section_b_description,
            "defendant": defendant_display,
            # The conveying officer physically delivered the samples and was
            # present at the examination, so they are named in both section (a)
            # (received from) and section (b) (handed back to).
            "conveying_officer": conveying_officer,
            # The requesting officer is optional and appears only in section (a),
            # as the officer the samples were conveyed on behalf of. None when
            # unset, so the template omits the clause rather than printing a
            # placeholder.
            "requesting_officer": requesting_officer,
            "receipt_date": receipt_date,
            # Section B's result sentence. Only section_b.italic is italicised.
            "section_b": results.section_b,
            # Section C: the automatic per-bag result lines and envelope
            # sentence, the botanist's own note, then the automatic female
            # plant sentence.
            "other_matters": wording.compose_section_c(
                results.bag_lines,
                certificate.additional_notes if note is _OWN_NOTE else note,
                wording.female_plant_line(CertificateService._female_flags(bags)),
                wording.sme_line(certificate.form.security_movement_envelope),
            )
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
    def _record_printed(certificate):
        """Note what the freshly rendered PDF printed, for staleness checks."""
        conveying, requesting = CertificateService.printed_officers(
            certificate.form.case
        )
        certificate.wording_version = wording.CERTIFICATE_WORDING_VERSION
        certificate.printed_conveying_officer = conveying
        certificate.printed_requesting_officer = requesting
        certificate.printed_fingerprint = CertificateService.content_fingerprint(
            certificate
        )

    @staticmethod
    def form_note(form):
        """The form's Section C note as a certificate stores it."""
        return (form.additional_notes or "").strip() or None

    @staticmethod
    def content_fingerprint(certificate, note=_OWN_NOTE):
        """A hash of everything the certificate prints, bar the date.

        Returns None when the certificate cannot be printed as things stand
        (for example a bag has lost its result), which never matches a stored
        fingerprint.
        """
        try:
            context = CertificateService.build_certificate_context(certificate, note)
        except ValidationError:
            return None
        return CertificateService.fingerprint_context(context)

    @staticmethod
    def fingerprint_context(context):
        """The fingerprint of a built certificate context."""
        printed = {
            key: value
            for key, value in context.items()
            if key not in _UNFINGERPRINTED_KEYS
        }
        printed["section_b"] = dataclasses.asdict(printed["section_b"])
        encoded = json.dumps(printed, sort_keys=True, default=str)
        return hashlib.sha256(encoded.encode("utf-8")).hexdigest()

    @staticmethod
    def _content_changed(certificate):
        """Whether the certificate would print differently now.

        Uses the form's current Section C note, as regenerating or
        re-packaging would. Never true for a certificate with no stored
        fingerprint: those were made before fingerprints were recorded,
        including every migrated certificate.
        """
        if not certificate.printed_fingerprint or not certificate.pdf_file:
            return False
        current = CertificateService.content_fingerprint(
            certificate, CertificateService.form_note(certificate.form)
        )
        return current != certificate.printed_fingerprint

    @staticmethod
    def _matched_print_when_recorded(certificate):
        """Whether an older certificate still matched its case by every check
        the app had before fingerprints: wording version, officer text, the
        Section C note, and no bag or result changed after it was made.
        """
        if certificate.wording_version != wording.CERTIFICATE_WORDING_VERSION:
            return False
        if CertificateService.printed_officers(certificate.form.case) != (
            certificate.printed_conveying_officer,
            certificate.printed_requesting_officer,
        ):
            return False
        own_note = (certificate.additional_notes or "").strip() or None
        if CertificateService.form_note(certificate.form) != own_note:
            return False
        made = certificate.updated_at
        for bag in certificate.form.bags.select_related("assessment"):
            assessment = getattr(bag, "assessment", None)
            if bag.updated_at > made or (assessment and assessment.updated_at > made):
                return False
        return True

    @staticmethod
    def record_existing_fingerprints():
        """Give certificates made before fingerprints were recorded a starting
        point, so later changes to their case are caught.

        A certificate that still matches its case gets the fingerprint of what
        it prints now. One that already differs gets a marker that never
        matches, so it shows as out of date (or its batch as needing a
        re-package). Finished, invoiced work is the exception: its current
        state is taken as the starting point rather than flagged, and only
        later changes are caught. Returns ``(matched, out_of_date)`` counts.
        """
        matched = out_of_date = 0
        pending = (
            Certificate.objects.filter(printed_fingerprint__isnull=True)
            .exclude(pdf_file="")
            .exclude(pdf_file__isnull=True)
            .select_related("form__case")
        )
        for certificate in pending.iterator():
            current = CertificateService.content_fingerprint(certificate)
            finished = certificate.form.phase == Case.PhaseChoices.COMPLETE
            if current and (
                finished or CertificateService._matched_print_when_recorded(certificate)
            ):
                fingerprint = current
                matched += 1
            else:
                fingerprint = UNVERIFIED_PRINT
                out_of_date += 1
            Certificate.objects.filter(pk=certificate.pk).update(
                printed_fingerprint=fingerprint
            )
        return matched, out_of_date

    @staticmethod
    def needs_repackage(certificate):
        """Whether a batched certificate no longer matches its case.

        Re-packaging the batch rebuilds the certificate from the case.
        """
        if certificate.batch_id is None:
            return False
        return CertificateService._content_changed(certificate)

    @staticmethod
    def _raise_if_unprintable(bags):
        """Refuse a certificate while any bag's result cannot be printed.

        Only the four approved results may print. A bag with no assessment or
        a pending one has not been assessed yet; a legacy result (kept for
        historical records) has no approved certificate wording.
        """
        for bag in bags:
            assessment = getattr(bag, "assessment", None)
            determination = assessment.determination if assessment else None
            if determination in wording.PRINTABLE_DETERMINATIONS:
                continue
            if determination in (None, "", "pending"):
                raise ValidationError("Every drug bag must be assessed first.")
            raise ValidationError(
                f"Bag {bag.seal_tag_numbers} has the result "
                f"{assessment.get_determination_display()}, which cannot be "
                "printed. Choose one of the four results first."
            )

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
        bags = CertificateService._ordered_bags(form)
        if not bags:
            raise ValidationError("This form has no drug bags; add at least one.")
        if len(bags) > MAX_BAGS_PER_CERTIFICATE:
            raise ValidationError(
                f"A form may cover at most {MAX_BAGS_PER_CERTIFICATE} drug bags."
            )
        CertificateService._raise_if_unprintable(bags)

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
        CertificateService._record_printed(certificate)

        # Save the form (and advance it) before the certificate so the
        # certificate's updated_at is the most recent timestamp. Staleness is
        # detected by comparing the form's updated_at against the certificate's;
        # saving the form last would bump its auto_now updated_at past the
        # certificate and make a freshly generated certificate look out of date.
        form.certificates_generated_at = timezone.now()
        if form.phase == Case.PhaseChoices.ASSESSMENT:
            WorkflowService.advance_form(form, user)
        form.save(update_fields=["certificates_generated_at"])

        certificate.save()

        verb = "generated" if existing is None else "regenerated"
        settings.LOGGER.info(
            f"{describe_user(user)} {verb} certificate "
            f"{certificate.certificate_number} ({certificate.pk}) "
            f"for form {form.pk} (case {form.case.case_number})"
        )

        return certificate

    @staticmethod
    def regenerate_certificate_pdf(certificate, user=None):
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
        CertificateService._record_printed(certificate)
        certificate.save(
            update_fields=[
                "pdf_file",
                "pdf_size",
                "wording_version",
                "printed_conveying_officer",
                "printed_requesting_officer",
                "printed_fingerprint",
            ]
        )

        settings.LOGGER.info(
            f"{describe_user(user)} regenerated certificate "
            f"{certificate.certificate_number} ({certificate.pk}) "
            f"for form {certificate.form_id} "
            f"(case {certificate.form.case.case_number})"
        )

        return certificate


# Backward-compatible function aliases for existing consumers
def build_certificate_context(certificate):
    """Backward-compatible alias."""
    return CertificateService.build_certificate_context(certificate)


def generate_certificate(form, user, section_c_note=None):
    """Backward-compatible alias."""
    return CertificateService.generate_certificate(form, user, section_c_note)


def regenerate_certificate_pdf(certificate, user=None):
    """Backward-compatible alias."""
    return CertificateService.regenerate_certificate_pdf(certificate, user)
