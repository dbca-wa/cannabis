"""Keep finished certificates current after the Section C reorder.

Section C now prints the botanist's note first, then the bag result lines,
the female plant sentence and the envelope sentence last. Bags that share a
result now share one line ("Bags T1 and T3 were inconclusive."). A
certificate printed before that no longer matches its case.

As with earlier wording changes, finished (invoiced) work takes its current
state as the starting point: a complete certificate whose fingerprint matched
its case under the previous Section C rules gets the fingerprint of what it
prints now, and any other difference it already had still shows. Every other
certificate is left alone, so it is flagged for regeneration (or its batch for
a re-package) and picks up the new Section C when rebuilt.

The previous rules are copied here so this keeps working when the live
wording code changes again. Like 0044 and 0046 it otherwise uses the current
certificate code; if it cannot run on some much older database, the
certificates are left as they were.
"""

import logging
import re

from django.db import migrations

logger = logging.getLogger(__name__)

CANNABIS = "cannabis_sativa"

# Section C as it printed before this change: one line per bag, singular.
PREVIOUS_BAG_PHRASES = {
    "not_cannabis": "did not contain Cannabis",
    "degraded": "was too degraded and could not be identified",
    "inconclusive": "was inconclusive",
}
FEMALE_PHRASE = "contained female plants"
PREVIOUS_SYSTEM_SENTENCE = re.compile(
    r"^(?:bags? \S.* (?:"
    + "|".join(re.escape(p.lower()) for p in PREVIOUS_BAG_PHRASES.values())
    + "|"
    + re.escape(FEMALE_PHRASE)
    + r")|all bags "
    + re.escape(FEMALE_PHRASE)
    + r")$"
)


def _comparable(line):
    text = line.strip().lower()
    return text[:-1] if text.endswith(".") else text


def _previous_bag_lines(bag_results):
    results = [d for _, d in bag_results]
    if CANNABIS in results:
        listed = [(t, d) for t, d in bag_results if d != CANNABIS]
    elif len(set(results)) == 1:
        listed = []
    else:
        listed = list(bag_results)
    return [f"Bag {t} {PREVIOUS_BAG_PHRASES[d]}." for t, d in listed]


def _previous_section_c(bag_lines, note, female_line, envelope_line, is_sme):
    """Bag lines, envelope, note, then female line, as before this change."""
    note_lines = [
        line.strip()
        for line in (note or "").replace("\r\n", "\n").replace("\r", "\n").split("\n")
    ]
    kept = [
        line
        for line in note_lines
        if not PREVIOUS_SYSTEM_SENTENCE.match(_comparable(line))
        and not (envelope_line and is_sme(line))
    ]
    while kept and not kept[0]:
        kept.pop(0)
    while kept and not kept[-1]:
        kept.pop()
    lines = (
        bag_lines
        + ([envelope_line] if envelope_line else [])
        + kept
        + ([female_line] if female_line else [])
    )
    return "\n".join(lines) if lines else None


def adopt_section_c_order(apps, schema_editor):
    try:
        from rest_framework.exceptions import ValidationError

        from cases.models import Case, Certificate
        from cases.services import certificate_wording as wording
        from cases.services.certificate_service import CertificateService

        adopted = 0
        certificates = (
            Certificate.objects.filter(form__phase=Case.PhaseChoices.COMPLETE)
            .exclude(printed_fingerprint__isnull=True)
            .exclude(pdf_file="")
            .exclude(pdf_file__isnull=True)
            .select_related("form__case")
        )
        for certificate in certificates.iterator():
            try:
                context = CertificateService.build_certificate_context(certificate)
            except ValidationError:
                continue
            form = certificate.form
            bags = CertificateService._ordered_bags(form)
            previous = dict(context)
            previous["other_matters"] = (
                _previous_section_c(
                    _previous_bag_lines(CertificateService._bag_results(bags)),
                    certificate.additional_notes,
                    wording.female_plant_line(CertificateService._female_flags(bags)),
                    wording.sme_line(form.security_movement_envelope),
                    wording.is_sme_sentence,
                )
                or "None"
            )
            before = CertificateService.fingerprint_context(previous)
            if before != certificate.printed_fingerprint:
                continue
            now = CertificateService.fingerprint_context(context)
            if now != before:
                Certificate.objects.filter(pk=certificate.pk).update(
                    printed_fingerprint=now
                )
                adopted += 1
    except Exception as exc:  # pragma: no cover - only on unusual databases
        logger.warning(f"Could not update certificate fingerprints: {exc}")
        return
    if adopted:
        logger.info(
            f"Updated fingerprints for {adopted} finished certificate(s) to the "
            "new Section C order"
        )


class Migration(migrations.Migration):

    dependencies = [
        ("submissions", "0046_fingerprints_for_envelope_line"),
    ]

    operations = [
        migrations.RunPython(adopt_section_c_order, migrations.RunPython.noop),
    ]
