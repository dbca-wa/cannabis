"""Rendered certificate checks: officer wording and the page layout.

The wording tests render the HTML template from a real certificate context, so
they run everywhere. The layout tests render a real PDF with PrinceXML and
rasterise it with poppler, so they skip where either tool is missing.
"""

import re
import shutil
import subprocess

import pytest
from django.template.loader import render_to_string

from cases.services import pdf_test_service
from cases.services.certificate_service import CERTIFICATE_TEMPLATE, CertificateService
from cases.services.pdf_service import PDFService
from common.tests.factories import (
    BotanicalAssessmentFactory,
    CaseFactory,
    CertificateFactory,
    DrugBagFactory,
    PoliceOfficerFactory,
    PoliceStationFactory,
    Priority3FormFactory,
)

A4_HEIGHT_PT = 841.89
A4_WIDTH_PT = 595.28
# Tolerance for comparing whitespace gaps, in points (~0.7 mm)
GAP_TOLERANCE_PT = 2.0

needs_renderers = pytest.mark.skipif(
    not (
        shutil.which("prince") and shutil.which("pdftoppm") and shutil.which("pdfinfo")
    ),
    reason="PrinceXML and poppler-utils are required to render and measure PDFs",
)


def _rendered_html(case):
    form = Priority3FormFactory(case=case)
    bag = DrugBagFactory(form=form)
    BotanicalAssessmentFactory(drug_bag=bag)
    certificate = CertificateFactory(form=form)
    context = CertificateService.build_certificate_context(certificate)
    return re.sub(r"\s+", " ", render_to_string(CERTIFICATE_TEMPLATE, context))


@pytest.mark.django_db
class TestOfficerWording:
    def test_conveying_station_is_absent_from_both_sections(self):
        conveying = PoliceOfficerFactory(
            badge_number="PD56359",
            last_name="Rinaldi",
            given_names="Jade",
            station=PoliceStationFactory(name="Midland Drug Receival Unit"),
        )
        html = _rendered_html(CaseFactory(submitting_officer=conveying))

        assert "Midland Drug Receival Unit" not in html
        # Named in section (a) as received from, and in (b) as handed back to
        assert html.count("Unsworn Officer PD56359 RINALDI, Jade") == 2

    def test_requesting_station_still_appears(self):
        requesting = PoliceOfficerFactory(
            badge_number="PD17432",
            last_name="Barns",
            given_names="Tahlia",
            station=PoliceStationFactory(name="Mandurah District Office"),
        )
        html = _rendered_html(
            CaseFactory(
                submitting_officer=PoliceOfficerFactory(), requesting_officer=requesting
            )
        )
        assert (
            "on behalf of Sworn Officer PD17432 BARNS, Tahlia of Mandurah District "
            "Office" in html
        )


def _measure(pdf_bytes, tmp_path):
    """Return page count and the blank gaps (pt) on each side of the inked area."""
    from PIL import Image

    pdf = tmp_path / "certificate.pdf"
    pdf.write_bytes(pdf_bytes)
    info = subprocess.run(
        ["pdfinfo", str(pdf)], capture_output=True, text=True, check=True
    ).stdout
    pages = int(re.search(r"^Pages:\s+(\d+)", info, re.M).group(1))

    subprocess.run(
        ["pdftoppm", "-r", "100", "-png", "-singlefile", str(pdf), str(tmp_path / "p")],
        check=True,
    )
    image = Image.open(tmp_path / "p.png").convert("L")
    width, height = image.size
    pixels = image.load()

    def inked(x, y):
        return pixels[x, y] < 235

    rows = [y for y in range(height) if any(inked(x, y) for x in range(0, width, 2))]
    cols = [x for x in range(width) if any(inked(x, y) for y in range(0, height, 2))]
    y_pt, x_pt = A4_HEIGHT_PT / height, A4_WIDTH_PT / width
    return pages, {
        "top": rows[0] * y_pt,
        "bottom": (height - 1 - rows[-1]) * y_pt,
        "left": cols[0] * x_pt,
        "right": (width - 1 - cols[-1]) * x_pt,
    }


def _sample_context(**overrides):
    # Imported via the module so pytest does not collect "TestPDFService"
    context = pdf_test_service.TestPDFService._build_certificate_context()
    context.update(overrides)
    return context


LAYOUT_CASES = {
    "typical": {},
    "five_bags_long_notes": {
        "quantity_of_bags": 5,
        "quantity_of_bags_words": "five",
        "tag_numbers": "T107381, T107390, T107391, T107392 and T107393",
        "new_tag_numbers": "T119009, T119010, T119011, T119012 and T119013",
        "other_matters": "Line one.\nLine two.\nLine three.\nLine four.",
    },
}


@needs_renderers
@pytest.mark.parametrize("overrides", LAYOUT_CASES.values(), ids=LAYOUT_CASES.keys())
def test_signature_block_sits_on_the_bottom_margin(overrides, tmp_path):
    """The gap below the signature block and address equals the gap above the
    header, and the certificate stays on a single page."""
    html = render_to_string(CERTIFICATE_TEMPLATE, _sample_context(**overrides))
    pages, gaps = _measure(PDFService._html_to_pdf(html), tmp_path)

    assert pages == 1
    assert abs(gaps["bottom"] - gaps["top"]) <= GAP_TOLERANCE_PT, gaps
    assert abs(gaps["left"] - gaps["right"]) <= GAP_TOLERANCE_PT, gaps
