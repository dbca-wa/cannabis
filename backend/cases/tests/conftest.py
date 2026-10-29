"""Shared fixtures for the cases test suite."""

from unittest.mock import patch

import pytest


@pytest.fixture(autouse=True)
def _stub_pdf_merge(request):
    """Stub the combined-certificates merge used when a batch is packaged.

    Most tests stub PDF rendering, so the certificate "PDFs" they store are
    placeholder bytes that pdfunite would reject. Tests that exercise the real
    merge opt out with ``@pytest.mark.real_pdf_merge``.
    """
    if request.node.get_closest_marker("real_pdf_merge"):
        yield
        return
    with patch(
        "cases.services.pdf_service.PDFService.merge_pdfs",
        side_effect=lambda pdfs: b"".join(pdfs),
    ):
        yield
