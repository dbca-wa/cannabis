"""Tests for OcrService error-handling branches."""

from unittest.mock import patch

import pytest
from rest_framework.exceptions import ValidationError

from cases.services.ocr_service import OcrService, ServiceUnavailable


@pytest.mark.django_db
class TestOcrServiceErrors:
    """Error-path tests — exercise the exception handling without Tesseract."""

    def test_empty_text_raises_validation(self):
        with patch("cases.ocr.client.TesseractOcrClient") as MockClient:
            instance = MockClient.return_value
            instance.extract_text.return_value = "   "
            instance.extract_with_confidence.return_value = []
            with pytest.raises(ValidationError):
                OcrService.process_upload(b"data", "image/png")

    def test_file_not_found_raises_service_unavailable(self):
        with patch("cases.ocr.client.TesseractOcrClient") as MockClient:
            instance = MockClient.return_value
            instance.extract_text.side_effect = FileNotFoundError("no tesseract")
            with pytest.raises(ServiceUnavailable):
                OcrService.process_upload(b"data", "image/png")

    def test_poppler_error_raises_service_unavailable(self):
        with patch("cases.ocr.client.TesseractOcrClient") as MockClient:
            instance = MockClient.return_value
            instance.extract_text.side_effect = Exception("pdfinfo poppler missing")
            with pytest.raises(ServiceUnavailable):
                OcrService.process_upload(b"data", "application/pdf")

    def test_tesseract_error_raises_service_unavailable(self):
        with patch("cases.ocr.client.TesseractOcrClient") as MockClient:
            instance = MockClient.return_value
            instance.extract_text.side_effect = Exception("tesseract not found")
            with pytest.raises(ServiceUnavailable):
                OcrService.process_upload(b"data", "image/png")

    def test_generic_error_reraised(self):
        with patch("cases.ocr.client.TesseractOcrClient") as MockClient:
            instance = MockClient.return_value
            instance.extract_text.side_effect = RuntimeError("unexpected boom")
            with pytest.raises(RuntimeError):
                OcrService.process_upload(b"data", "image/png")
