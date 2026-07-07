"""Unit tests for OCR police-reference extraction, detection, and routing.

Covers:
- _derive_police_reference strips trailing bag number
- _derive_police_reference returns None/0.0 for blank/missing items
- OcrService.process_upload returns case_match.matched=true on match
- OcrService.process_upload returns case_match.matched=false on no match
- Unreadable reference raises ValidationError
"""

from unittest.mock import MagicMock, patch

import pytest
from django.utils import timezone
from rest_framework.exceptions import ValidationError

from cases.models import Case
from cases.ocr import ExtractedField, ExtractedItem, ExtractionResult
from cases.ocr.parser import PoliceFormParser
from cases.services.ocr_service import OcrService

pytestmark = pytest.mark.django_db


class TestDerivePoliceReference:
    """Unit tests for PoliceFormParser._derive_police_reference."""

    def test_strips_trailing_bag_number(self):
        """'123456 7890 12345/6789' → '123456 7890 12345'."""
        parser = PoliceFormParser()
        items = [
            ExtractedItem(
                property_reference=ExtractedField(
                    value="123456 7890 12345/6789",
                    raw_text="123456 7890 12345/6789",
                    confidence=0.9,
                )
            )
        ]
        result = parser._derive_police_reference(items)
        assert result.value == "123456 7890 12345"
        assert result.confidence == 0.9

    def test_strips_bag_number_with_spaces_around_slash(self):
        """Handles whitespace around the slash separator."""
        parser = PoliceFormParser()
        items = [
            ExtractedItem(
                property_reference=ExtractedField(
                    value="123456 7890 12345 / 6789",
                    raw_text="123456 7890 12345 / 6789",
                    confidence=0.85,
                )
            )
        ]
        result = parser._derive_police_reference(items)
        assert result.value == "123456 7890 12345"

    def test_no_items_returns_empty_field(self):
        """No items → None value with 0.0 confidence."""
        parser = PoliceFormParser()
        result = parser._derive_police_reference([])
        assert result.value is None
        assert result.confidence == 0.0

    def test_blank_property_reference_returns_empty_field(self):
        """Item with blank property reference → None/0.0."""
        parser = PoliceFormParser()
        items = [
            ExtractedItem(
                property_reference=ExtractedField(
                    value="",
                    raw_text="",
                    confidence=0.0,
                )
            )
        ]
        result = parser._derive_police_reference(items)
        assert result.value is None
        assert result.confidence == 0.0

    def test_none_property_reference_returns_empty_field(self):
        """Item with None property reference → None/0.0."""
        parser = PoliceFormParser()
        items = [
            ExtractedItem(
                property_reference=ExtractedField(
                    value=None,
                    raw_text="",
                    confidence=0.0,
                )
            )
        ]
        result = parser._derive_police_reference(items)
        assert result.value is None
        assert result.confidence == 0.0

    def test_reference_without_bag_number_unchanged(self):
        """A reference without a slash is returned as-is."""
        parser = PoliceFormParser()
        items = [
            ExtractedItem(
                property_reference=ExtractedField(
                    value="123456 7890 12345",
                    raw_text="123456 7890 12345",
                    confidence=0.92,
                )
            )
        ]
        result = parser._derive_police_reference(items)
        assert result.value == "123456 7890 12345"


class TestOcrServiceCaseMatch:
    """OcrService.process_upload detects matching cases."""

    @patch("cases.ocr.client.TesseractOcrClient")
    @patch("cases.ocr.parser.PoliceFormParser")
    @patch("cases.ocr.matcher.EntityMatcher")
    def test_matched_true_when_case_exists(
        self, mock_matcher_cls, mock_parser_cls, mock_client_cls
    ):
        """Returns case_match.matched=true when a case has the reference."""
        case = Case.objects.create(
            case_number="123456 7890 12345",
            received=timezone.now(),
        )

        mock_client = MagicMock()
        mock_client.extract_text.return_value = "Date: 05-MAR-2025"
        mock_client.extract_with_confidence.return_value = []
        mock_client_cls.return_value = mock_client

        mock_parser = MagicMock()
        mock_parser.parse.return_value = ExtractionResult(
            police_reference=ExtractedField(
                value="123456 7890 12345",
                raw_text="123456 7890 12345",
                confidence=0.9,
            ),
        )
        mock_parser_cls.return_value = mock_parser

        from cases.ocr import MatchResult

        mock_matcher = MagicMock()
        mock_matcher.match_officer.return_value = MatchResult()
        mock_matcher.match_station.return_value = MatchResult()
        mock_matcher.match_defendant.return_value = MatchResult()
        mock_matcher_cls.return_value = mock_matcher

        result = OcrService.process_upload(b"fake-bytes", "image/png")

        assert result["case_match"]["matched"] is True
        assert result["case_match"]["case_id"] == case.pk
        assert result["case_match"]["case_number"] == case.case_number

    @patch("cases.ocr.client.TesseractOcrClient")
    @patch("cases.ocr.parser.PoliceFormParser")
    @patch("cases.ocr.matcher.EntityMatcher")
    def test_matched_false_when_no_case(
        self, mock_matcher_cls, mock_parser_cls, mock_client_cls
    ):
        """Returns case_match.matched=false when no case has the reference."""
        mock_client = MagicMock()
        mock_client.extract_text.return_value = "Date: 05-MAR-2025"
        mock_client.extract_with_confidence.return_value = []
        mock_client_cls.return_value = mock_client

        mock_parser = MagicMock()
        mock_parser.parse.return_value = ExtractionResult(
            police_reference=ExtractedField(
                value="999999 0000 99999",
                raw_text="999999 0000 99999",
                confidence=0.9,
            ),
        )
        mock_parser_cls.return_value = mock_parser

        from cases.ocr import MatchResult

        mock_matcher = MagicMock()
        mock_matcher.match_officer.return_value = MatchResult()
        mock_matcher.match_station.return_value = MatchResult()
        mock_matcher.match_defendant.return_value = MatchResult()
        mock_matcher_cls.return_value = mock_matcher

        result = OcrService.process_upload(b"fake-bytes", "image/png")

        assert result["case_match"]["matched"] is False
        assert result["case_match"]["case_id"] is None

    @patch("cases.ocr.client.TesseractOcrClient")
    @patch("cases.ocr.parser.PoliceFormParser")
    def test_unreadable_reference_raises_validation_error(
        self, mock_parser_cls, mock_client_cls
    ):
        """Empty police reference raises ValidationError."""
        mock_client = MagicMock()
        mock_client.extract_text.return_value = "Some OCR text"
        mock_client.extract_with_confidence.return_value = []
        mock_client_cls.return_value = mock_client

        mock_parser = MagicMock()
        mock_parser.parse.return_value = ExtractionResult(
            police_reference=ExtractedField(
                value=None,
                raw_text="",
                confidence=0.0,
            ),
        )
        mock_parser_cls.return_value = mock_parser

        with pytest.raises(ValidationError) as exc_info:
            OcrService.process_upload(b"fake-bytes", "image/png")

        assert "could not be read" in str(exc_info.value.detail)
