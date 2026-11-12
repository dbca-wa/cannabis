"""Rendered certificate Section B and Section C for every result combination.

The template is rendered for every ordered result sequence of one to five bags.
Database-backed tests then check the real context builder, the generation
guard, and real PDFs read back with pdftotext.
"""

import html as html_lib
import itertools
import re
import shutil
import subprocess

import pytest
from django.template.loader import render_to_string
from rest_framework.exceptions import ValidationError

from cases.models import DrugBag
from cases.services import certificate_wording as wording
from cases.services import pdf_test_service
from cases.services.certificate_service import CERTIFICATE_TEMPLATE, CertificateService
from common.tests.factories import (
    BotanicalAssessmentFactory,
    CaseFactory,
    CertificateFactory,
    DrugBagFactory,
    PoliceOfficerFactory,
    Priority3FormFactory,
)

S, N, D, I = (  # noqa: E741
    wording.CANNABIS,
    wording.NOT_CANNABIS,
    wording.DEGRADED,
    wording.INCONCLUSIVE,
)

ALL_SEQUENCES = [
    sequence
    for count in range(1, 6)
    for sequence in itertools.product(wording.PRINTABLE_DETERMINATIONS, repeat=count)
]

NOTE = "Subsamples placed into Security Movement Envelope WW1 & <co>."

SECTION_B = re.compile(r'green-border">\s*(.*?)\s*<br>', re.S)
SECTION_C = re.compile(r'yellow-border">\s*(.*?)\s*</div>', re.S)


def _sections(html):
    """Section B's result sentence and Section C's lines from rendered HTML."""
    section_b = SECTION_B.search(html).group(1)
    section_c = SECTION_C.search(html).group(1)
    return section_b, [line.strip() for line in section_c.split("<br>")]


def _render_sequence(sequence, note):
    bags = [(f"T{i + 1}", d) for i, d in enumerate(sequence)]
    results = wording.summarise(bags)
    context = pdf_test_service.TestPDFService._build_certificate_context()
    context["section_b"] = results.section_b
    context["other_matters"] = (
        wording.compose_section_c(results.bag_lines, note) or "None"
    )
    return results, render_to_string(CERTIFICATE_TEMPLATE, context)


@pytest.mark.parametrize("note", [None, NOTE], ids=["no-note", "note"])
@pytest.mark.parametrize(
    "sequence", ALL_SEQUENCES, ids=lambda s: "-".join(x[:3] for x in s)
)
def test_every_sequence_renders_as_approved(sequence, note):
    results, html = _render_sequence(sequence, note)
    section_b, section_c = _sections(html)
    expected_b = results.section_b

    if expected_b.italic:
        assert section_b == (
            f"{expected_b.prefix}<em>{expected_b.italic}</em>{expected_b.suffix}"
        )
    else:
        assert section_b == expected_b.prefix
        assert "<em>" not in section_b
    assert html.count("<em>Cannabis sativa</em>") == (1 if expected_b.italic else 0)

    expected_c = list(results.bag_lines) + ([html_lib.escape(note)] if note else [])
    assert section_c == (expected_c or ["None"])


def _form_with(results, case=None, note=None, envelope=""):
    """A form whose bags have the given results, in order, tagged T1..Tn."""
    form = Priority3FormFactory(
        case=case or CaseFactory(submitting_officer=PoliceOfficerFactory()),
        additional_notes=note,
        security_movement_envelope=envelope,
    )
    for i, result in enumerate(results):
        bag = DrugBagFactory(form=form, seal_tag_numbers=f"T{i + 1}")
        if result is not None:
            BotanicalAssessmentFactory(drug_bag=bag, determination=result)
    return form


# One form per Section B row, with one bag and with five bags.
ROWS = {
    "one-cannabis": (S,),
    "one-not-cannabis": (N,),
    "one-degraded": (D,),
    "one-inconclusive": (I,),
    "five-cannabis": (S, S, S, S, S),
    "five-mixed-cannabis": (S, N, D, I, S),
    "five-not-cannabis": (N, N, N, N, N),
    "five-degraded": (D, D, D, D, D),
    "five-inconclusive": (I, I, I, I, I),
    "five-mixed-not-cannabis": (N, N, I, D, N),
}


@pytest.mark.django_db
class TestContextFromTheDatabase:
    @pytest.mark.parametrize("results", ROWS.values(), ids=ROWS.keys())
    def test_context_matches_the_wording_module(self, results):
        form = _form_with(results, note="SME WW1.")
        certificate = CertificateFactory(form=form, additional_notes="SME WW1.")

        context = CertificateService.build_certificate_context(certificate)

        expected = wording.summarise([(f"T{i + 1}", r) for i, r in enumerate(results)])
        assert context["section_b"] == expected.section_b
        assert context["other_matters"] == "\n".join(
            list(expected.bag_lines) + ["SME WW1."]
        )

    def test_bags_print_in_the_order_they_were_added(self):
        form = _form_with((N, S, I))
        certificate = CertificateFactory(form=form)

        context = CertificateService.build_certificate_context(certificate)

        assert context["tag_numbers"] == "T1, T2 and T3"
        assert context["other_matters"] == (
            "Bag T1 did not contain Cannabis.\nBag T3 was inconclusive."
        )

    def test_female_plants_print_after_the_note(self):
        form = _form_with((S, I, S), note="SME WW1.\nAll bags contained female plants.")
        bags = list(DrugBag.objects.filter(form=form).order_by("pk"))
        for bag in (bags[0], bags[1]):
            bag.contains_female_plants = True
            bag.save()
        certificate = CertificateFactory(
            form=form, additional_notes="SME WW1.\nAll bags contained female plants."
        )

        context = CertificateService.build_certificate_context(certificate)

        # T2 is inconclusive, so its flag is ignored; the stale template line
        # in the note is replaced by the sentence from the current bags.
        assert context["other_matters"] == (
            "Bag T2 was inconclusive.\nSME WW1.\nBag T1 contained female plants."
        )

    def test_empty_section_c_prints_none(self):
        certificate = CertificateFactory(form=_form_with((S, S)))

        context = CertificateService.build_certificate_context(certificate)

        assert context["other_matters"] == "None"

    def test_the_envelope_prints_after_the_bag_lines(self):
        """The form's envelope is written in by itself, replacing any copy a
        template left in the note, even one naming an older envelope."""
        note = "Subsamples placed into Security Movement Envelope WW1.\nHanded back."
        form = _form_with((S, I), note=note, envelope="WW00537475")
        DrugBag.objects.filter(form=form, seal_tag_numbers="T1").update(
            contains_female_plants=True
        )
        certificate = CertificateFactory(form=form, additional_notes=note)

        context = CertificateService.build_certificate_context(certificate)

        assert context["other_matters"] == (
            "Bag T2 was inconclusive.\n"
            "Subsamples placed into Security Movement Envelope WW00537475.\n"
            "Handed back.\n"
            "Bag T1 contained female plants."
        )

    def test_the_envelope_alone_fills_section_c(self):
        certificate = CertificateFactory(form=_form_with((S,), envelope="WW5"))

        context = CertificateService.build_certificate_context(certificate)

        assert context["other_matters"] == (
            "Subsamples placed into Security Movement Envelope WW5."
        )


LEGACY_RESULTS = [
    ("mixed", "Mixed"),
    ("cannabis_indica", "Cannabis indica"),
    ("cannabis_hybrid", "Cannabis (hybrid)"),
    ("papaver_somniferum", "Papaver somniferum"),
    ("unidentifiable", "Unidentifiable"),
]


@pytest.mark.django_db
class TestGenerationGuard:
    @pytest.mark.parametrize("value,label", LEGACY_RESULTS)
    def test_legacy_result_is_refused_naming_the_bag(self, value, label, admin_user):
        form = _form_with((S, value))

        with pytest.raises(ValidationError) as error:
            CertificateService.generate_certificate(form, admin_user)

        assert str(error.value.detail[0]) == (
            f"Bag T2 has the result {label}, which cannot be printed. "
            "Choose one of the four results first."
        )

    @pytest.mark.parametrize("value", ["pending", None])
    def test_unassessed_bag_is_refused(self, value, admin_user):
        form = _form_with((S, value))

        with pytest.raises(ValidationError) as error:
            CertificateService.generate_certificate(form, admin_user)

        assert "Every drug bag must be assessed first." in str(error.value.detail[0])


needs_prince = pytest.mark.skipif(
    not (shutil.which("prince") and shutil.which("pdftotext")),
    reason="PrinceXML and pdftotext are required to render and read PDFs",
)


def _pdf_text(pdf_bytes, tmp_path):
    pdf = tmp_path / "certificate.pdf"
    pdf.write_bytes(pdf_bytes)
    text = subprocess.run(
        ["pdftotext", "-layout", str(pdf), "-"],
        capture_output=True,
        text=True,
        check=True,
    ).stdout
    return re.sub(r"\s+", " ", text)


@needs_prince
@pytest.mark.django_db
@pytest.mark.parametrize("results", ROWS.values(), ids=ROWS.keys())
def test_real_pdf_prints_section_b_and_c(results, tmp_path):
    form = _form_with(results)
    certificate = CertificateFactory(form=form)

    text = _pdf_text(CertificateService._render_pdf(certificate), tmp_path)

    expected = wording.summarise([(f"T{i + 1}", r) for i, r in enumerate(results)])
    assert expected.section_b.text in text
    for line in expected.bag_lines:
        assert line in text
    if not expected.bag_lines:
        assert "should be noted: None" in text


@needs_prince
@pytest.mark.django_db
def test_real_pdf_prints_the_envelope(tmp_path):
    certificate = CertificateFactory(form=_form_with((S, N), envelope="WW00537475"))

    text = _pdf_text(CertificateService._render_pdf(certificate), tmp_path)

    assert (
        "Bag T2 did not contain Cannabis. "
        "Subsamples placed into Security Movement Envelope WW00537475."
    ) in text
