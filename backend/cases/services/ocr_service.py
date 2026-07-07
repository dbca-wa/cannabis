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
            A dict with 'extraction', 'matches', and 'case_match' keys.
            'case_match' reports whether an existing case has the extracted
            police reference ({"matched", "case_id", "case_number"}).

        Raises:
            ValidationError: If no structured data is extracted, or if the
                police reference could not be read from the form.
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

            # The police reference is required to detect and route to a case.
            # Trim to mirror the check-number comparison rule.
            raw_reference = extraction.police_reference.value
            police_reference = str(raw_reference).strip() if raw_reference else ""
            if not police_reference:
                raise ValidationError(
                    "The police reference could not be read from this form."
                )

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

            # Detect an existing case by police reference using the same
            # case-insensitive, trimmed comparison as the check-number endpoint.
            from cases.models import Case

            matched_case = Case.objects.filter(
                case_number__iexact=police_reference
            ).first()
            case_match = {
                "matched": matched_case is not None,
                "case_id": matched_case.pk if matched_case else None,
                "case_number": matched_case.case_number if matched_case else None,
            }

            return {
                "extraction": asdict(extraction),
                "matches": matches,
                "case_match": case_match,
            }

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
