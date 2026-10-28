"""Tests for PDFService.merge_pdfs (poppler's pdfunite)."""

import shutil
import subprocess
from unittest.mock import patch

import pytest
from rest_framework.exceptions import ValidationError

from cases.services.pdf_service import PDFService

# These tests exercise PDFService.merge_pdfs itself, not the suite-wide stub.
pytestmark = pytest.mark.real_pdf_merge

needs_poppler = pytest.mark.skipif(
    not shutil.which("pdfunite") or not shutil.which("pdfinfo"),
    reason="poppler-utils is not installed",
)


def _blank_pdf(pages=1):
    """A minimal valid PDF with the given number of blank A4 pages."""
    objects = ["<< /Type /Catalog /Pages 2 0 R >>"]
    kids = " ".join(f"{3 + i} 0 R" for i in range(pages))
    objects.append(f"<< /Type /Pages /Kids [{kids}] /Count {pages} >>")
    for _ in range(pages):
        objects.append("<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] >>")

    out = b"%PDF-1.4\n"
    offsets = []
    for number, body in enumerate(objects, start=1):
        offsets.append(len(out))
        out += f"{number} 0 obj\n{body}\nendobj\n".encode()
    xref = len(out)
    out += f"xref\n0 {len(objects) + 1}\n0000000000 65535 f \n".encode()
    for offset in offsets:
        out += f"{offset:010d} 00000 n \n".encode()
    out += (
        f"trailer\n<< /Size {len(objects) + 1} /Root 1 0 R >>\n"
        f"startxref\n{xref}\n%%EOF\n"
    ).encode()
    return out


def _page_count(pdf_bytes, tmp_path):
    path = tmp_path / "out.pdf"
    path.write_bytes(pdf_bytes)
    info = subprocess.run(
        ["pdfinfo", str(path)], capture_output=True, text=True, check=True
    ).stdout
    line = next(row for row in info.splitlines() if row.startswith("Pages:"))
    return int(line.split()[1])


def test_merge_rejects_an_empty_list():
    with pytest.raises(ValidationError):
        PDFService.merge_pdfs([])


def test_single_pdf_is_returned_unchanged():
    with patch("cases.services.pdf_service.subprocess.run") as run:
        assert PDFService.merge_pdfs([b"%PDF solo"]) == b"%PDF solo"
    run.assert_not_called()


def test_missing_binary_raises_validation_error():
    with patch(
        "cases.services.pdf_service.subprocess.run", side_effect=FileNotFoundError
    ):
        with pytest.raises(ValidationError):
            PDFService.merge_pdfs([b"%PDF a", b"%PDF b"])


def test_failed_merge_raises_validation_error():
    failed = subprocess.CompletedProcess(args=[], returncode=1, stderr="bad pdf")
    with patch("cases.services.pdf_service.subprocess.run", return_value=failed):
        with pytest.raises(ValidationError):
            PDFService.merge_pdfs([b"%PDF a", b"%PDF b"])


@needs_poppler
def test_merges_every_page_in_order(tmp_path):
    merged = PDFService.merge_pdfs([_blank_pdf(1), _blank_pdf(2), _blank_pdf(1)])
    assert merged.startswith(b"%PDF")
    assert _page_count(merged, tmp_path) == 4


def test_timeout_raises_validation_error():
    with patch(
        "cases.services.pdf_service.subprocess.run",
        side_effect=subprocess.TimeoutExpired(cmd="pdfunite", timeout=120),
    ):
        with pytest.raises(ValidationError):
            PDFService.merge_pdfs([b"%PDF a", b"%PDF b"])


def test_inputs_are_passed_to_pdfunite_in_order():
    """pdfunite receives one temp file per input, in the given order."""
    seen = []

    def fake_run(cmd, **kwargs):
        *inputs, output = cmd[1:]
        seen.extend(open(path, "rb").read() for path in inputs)
        with open(output, "wb") as f:
            f.write(b"%PDF merged")
        return subprocess.CompletedProcess(args=cmd, returncode=0, stderr="")

    with patch("cases.services.pdf_service.subprocess.run", side_effect=fake_run):
        merged = PDFService.merge_pdfs([b"%PDF one", b"%PDF two", b"%PDF three"])

    assert merged == b"%PDF merged"
    assert seen == [b"%PDF one", b"%PDF two", b"%PDF three"]
