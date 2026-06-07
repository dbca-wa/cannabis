"""OCR service — orchestrates text extraction, parsing, and entity matching.

Delegates to TesseractOcrClient, PoliceFormParser, and EntityMatcher to
process uploaded police forms and extract structured data.
"""

from dataclasses import asdict

from django.conf import settings
from rest_framework.exceptions import APIException, ValidationError


class ServiceUnavailable(APIException):
    """502 Bad Gateway — external service dependency is missing or failed."""

    status_code = 502
    default_detail = "Service temporarily unavailable."
    default_code = "service_unavailable"


class OcrService:
    """Business logic for OCR processing of police forms."""

    @staticmethod
    def process_upload(file_bytes, content_type):
        """Run OCR pipeline: extract text, parse fields, match entities.

        Args:
            file_bytes: Raw bytes of the uploaded file.
            content_type: MIME type of the file.

        Returns:
            A dict with 'extraction' and 'matches' keys.

        Raises:
            ValidationError: If no structured data is extracted.
            ServiceUnavailable: If OCR dependencies are missing.
        """
        try:
            from cases.ocr.client import TesseractOcrClient
            from cases.ocr.matcher import EntityMatcher
            from cases.ocr.parser import PoliceFormParser

            client = TesseractOcrClient()
            ocr_text = client.extract_text(file_bytes, content_type)
            word_confidences = client.extract_with_confidence(file_bytes, content_type)

            if not ocr_text or not ocr_text.strip():
                raise ValidationError(
                    "No structured data could be extracted from this file."
                )

            parser = PoliceFormParser()
            extraction = parser.parse(ocr_text, word_confidences)

            matcher = EntityMatcher()
            matches = {
                "conveying_officer": asdict(
                    matcher.match_officer(
                        extraction.conveying_officer.badge_number.value,
                        extraction.conveying_officer.name.value,
                    )
                ),
                "on_behalf_of_officer": asdict(
                    matcher.match_officer(
                        extraction.on_behalf_of_officer.badge_number.value,
                        extraction.on_behalf_of_officer.name.value,
                    )
                ),
                "station": asdict(
                    matcher.match_station(extraction.division_unit.value or "")
                ),
                "defendant": asdict(
                    matcher.match_defendant(extraction.defendant_name.value or "")
                ),
            }

            return {"extraction": asdict(extraction), "matches": matches}

        except FileNotFoundError:
            settings.LOGGER.error("Tesseract binary not found", exc_info=True)
            raise ServiceUnavailable("OCR processing failed. Please try again later.")
        except (ValidationError, ServiceUnavailable):
            raise
        except Exception as e:
            error_msg = str(e)
            settings.LOGGER.error(f"OCR processing error: {error_msg}", exc_info=True)
            if "poppler" in error_msg.lower() or "pdfinfo" in error_msg.lower():
                raise ServiceUnavailable(
                    "PDF processing is not available. "
                    "Poppler is not installed on the server."
                )
            if "tesseract" in error_msg.lower():
                raise ServiceUnavailable(
                    "OCR processing is not available. "
                    "Tesseract is not installed on the server."
                )
            raise
