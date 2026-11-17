"""
Format detection and classification for police officer data.

Detects whether officer data is in early format, later format,
single officer format, corrupted, or standardised values.
"""

import logging
import re
from dataclasses import dataclass, field
from typing import List

from .constants import OfficerFormat
from .rank_handler import StandardizationEngine


@dataclass
class FormatDetectionResult:
    """Container for format detection results with confidence scoring"""

    format_type: OfficerFormat
    confidence: float
    matched_patterns: List[str] = field(default_factory=list)
    fallback_attempted: bool = False
    detection_notes: List[str] = field(default_factory=list)


class FormatDetector:
    """Advanced format detection and classification system for police officer data"""

    def __init__(self, standardization_engine: StandardizationEngine):
        self.logger = logging.getLogger(__name__)
        self.standardization_engine = standardization_engine

        # Compile regex patterns for better performance
        self._compile_patterns()

    def _compile_patterns(self):
        """Compile all regex patterns for efficient matching"""

        # Early format patterns: "Senior Constable Name ID on behalf of - Rank Name of Organization"
        self.early_format_patterns = [
            # TYPO-TOLERANT PATTERNS ("On Behalf Variations")
            # Pattern for "bahalf" typo: "on bahalf of" (flexible)
            re.compile(
                r"^(Senior\s+Constable|Police\s+Constable|Detective|Sergeant|Constable|Acting\s+\w+)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\s+(\d+)\s+on\s+bahalf\s+of\s*-?\s*([A-Z/]+)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\s+of\s+(.+)$",
                re.IGNORECASE,
            ),
            # Pattern for "behlaf" typo: "on behlaf of" (flexible)
            re.compile(
                r"^(Senior\s+Constable|Police\s+Constable|Detective|Sergeant|Constable|Acting\s+\w+)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\s+(\d+)\s+on\s+behlaf\s+of\s*-?\s*([A-Z/]+)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\s+of\s+(.+)$",
                re.IGNORECASE,
            ),
            # Pattern for "behalf fo" typo: "on behalf fo"
            re.compile(
                r"^(Senior\s+Constable|Police\s+Constable|Detective|Sergeant|Constable|Acting\s+\w+)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\s+(\d+)\s+on\s+behalf\s+fo\s*-\s*([A-Z/]+)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\s+of\s+(.+)$",
                re.IGNORECASE,
            ),
            # Pattern for missing space: "onbehalf of"
            re.compile(
                r"^(Senior\s+Constable|Police\s+Constable|Detective|Sergeant|Constable|Acting\s+\w+)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\s+(\d+)\s+onbehalf\s+of\s*-\s*([A-Z/]+)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\s+of\s+(.+)$",
                re.IGNORECASE,
            ),
            # Pattern for extra spaces: "on  behalf  of" (multiple spaces)
            re.compile(
                r"^(Senior\s+Constable|Police\s+Constable|Detective|Sergeant|Constable|Acting\s+\w+)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\s+(\d+)\s+on\s+\s+behalf\s+\s+of\s*-\s*([A-Z/]+)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\s+of\s+(.+)$",
                re.IGNORECASE,
            ),
            # ORIGINAL PATTERNS (existing)
            re.compile(
                r"^(Senior\s+Constable|Police\s+Constable|Detective|Sergeant|Constable|Acting\s+\w+)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\s+(\d+)\s+on\s+behalf\s+of\s*-\s*([A-Z/]+)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\s+of\s+(.+)$",
                re.IGNORECASE,
            ),
            re.compile(
                r"^(Senior\s+Constable|Police\s+Constable|Detective|Sergeant|Constable)\s+([A-Z][a-z]+)\s+(\d+)\s+on\s+behalf\s+of\s*-\s*([A-Z/]+)\s+([A-Z][a-z]+)\s+of\s+(.+)$",
                re.IGNORECASE,
            ),
            re.compile(
                r"^([A-Z][a-z]+\s+[A-Z][a-z]+)\s+([A-Z][a-z]+)\s+(\d+)\s+on\s+behalf\s+of\s*-\s*([A-Z/]+)\s+([A-Z][a-z]+)\s+of\s+(.+)$",
                re.IGNORECASE,
            ),
        ]

        # Later format patterns: "Sworn Officer Name ID on behalf of Sworn Officer Name ID of Organization"
        self.later_format_patterns = [
            # TYPO-TOLERANT PATTERNS ("On Behalf Variations")
            # Pattern for "bahalf" typo: "on bahalf of"
            re.compile(
                r"^(Sworn|Unsworn)\s+Officer\s+([A-Z]+)\s+([A-Z]+)\s+(\d+|PD\d+)\s+on\s+bahalf\s+of\s+(Sworn|Unsworn)\s+Officer\s+([A-Z]+)\s+([A-Z]+)\s+(\d+|PD\d+)\s+of\s+(.+)$",
                re.IGNORECASE,
            ),
            # Pattern for "behlaf" typo: "on behlaf of"
            re.compile(
                r"^(Sworn|Unsworn)\s+Officer\s+([A-Z]+)\s+([A-Z]+)\s+(\d+|PD\d+)\s+on\s+behlaf\s+of\s+(Sworn|Unsworn)\s+Officer\s+([A-Z]+)\s+([A-Z]+)\s+(\d+|PD\d+)\s+of\s+(.+)$",
                re.IGNORECASE,
            ),
            # Pattern for "behalf fo" typo: "on behalf fo"
            re.compile(
                r"^(Sworn|Unsworn)\s+Officer\s+([A-Z]+)\s+([A-Z]+)\s+(\d+|PD\d+)\s+on\s+behalf\s+fo\s+(Sworn|Unsworn)\s+Officer\s+([A-Z]+)\s+([A-Z]+)\s+(\d+|PD\d+)\s+of\s+(.+)$",
                re.IGNORECASE,
            ),
            # Pattern for missing space: "onbehalf of"
            re.compile(
                r"^(Sworn|Unsworn)\s+Officer\s+([A-Z]+)\s+([A-Z]+)\s+(\d+|PD\d+)\s+onbehalf\s+of\s+(Sworn|Unsworn)\s+Officer\s+([A-Z]+)\s+([A-Z]+)\s+(\d+|PD\d+)\s+of\s+(.+)$",
                re.IGNORECASE,
            ),
            # Pattern for extra spaces: "on  behalf  of" (multiple spaces)
            re.compile(
                r"^(Sworn|Unsworn)\s+Officer\s+([A-Z]+)\s+([A-Z]+)\s+(\d+|PD\d+)\s+on\s+\s+behalf\s+\s+of\s+(Sworn|Unsworn)\s+Officer\s+([A-Z]+)\s+([A-Z]+)\s+(\d+|PD\d+)\s+of\s+(.+)$",
                re.IGNORECASE,
            ),
            # ORIGINAL PATTERNS (existing)
            # Standard format: "Sworn Officer FIRST LAST ID on behalf of Sworn Officer FIRST LAST ID of Organization"
            re.compile(
                r"^(Sworn|Unsworn)\s+Officer\s+([A-Z]+)\s+([A-Z]+)\s+(\d+|PD\d+)\s+on\s+behalf\s+of\s+(Sworn|Unsworn)\s+Officer\s+([A-Z]+)\s+([A-Z]+)\s+(\d+|PD\d+)\s+of\s+(.+)$",
                re.IGNORECASE,
            ),
            # TYPO-TOLERANT GENERAL PATTERNS (flexible matching)
            # "bahalf" typo - general pattern
            re.compile(
                r"^(Sworn|Unsworn)\s+Officer\s+(PD\d+)\s+([A-Z]+),?\s*([A-Z][a-z]+)?\s+on\s+bahalf\s+of\s+(Sworn|Unsworn)\s+Officer\s+(PD\d+)\s+([A-Z]+).*$",
                re.IGNORECASE,
            ),
            # "behlaf" typo in comma format
            re.compile(
                r"^(Sworn|Unsworn)\s+Officer\s+(PD\d+)\s+([A-Z]+),\s*([A-Z][a-z]+)\s+on\s+behlaf\s+of\s+(Sworn|Unsworn)\s+Officer\s+(PD\d+)\s+([A-Z]+),?\s*([A-Z][a-z]+)?.*$",
                re.IGNORECASE,
            ),
            # "behalf fo" typo in comma format
            re.compile(
                r"^(Sworn|Unsworn)\s+Officer\s+(PD\d+)\s+([A-Z]+),\s*([A-Z][a-z]+)\s+on\s+behalf\s+fo\s+(Sworn|Unsworn)\s+Officer\s+(PD\d+)\s+([A-Z]+),?\s*([A-Z][a-z]+)?.*$",
                re.IGNORECASE,
            ),
            # ORIGINAL COMMA-SEPARATED PATTERNS
            # Comma-separated format: "Sworn Officer PD12345, LAST, First on behalf of - Sworn Officer PD67890 LAST, First of Organization"
            re.compile(
                r"^(Sworn|Unsworn)\s+Officer\s+(PD\d+),\s*([A-Z]+),\s*([A-Z][a-z]+)\s+On\s+Behalf\s+of\s*-\s*(Sworn|Unsworn)\s+Officer\s+(PD\d+)\s+([A-Z]+),\s*([A-Z][a-z]+)\s+of\s+(.+)$",
                re.IGNORECASE,
            ),
            # Mixed format: "Sworn Officer Name ID on behalf of Sworn Officer Name ID of Organization" (flexible spacing)
            re.compile(
                r"^(Sworn|Unsworn)\s+Officer\s+([A-Z]+(?:\s+[A-Z]+)*)\s+(\d+|PD\d+)\s+on\s+behalf\s+of\s+(Sworn|Unsworn)\s+Officer\s+([A-Z]+(?:\s+[A-Z]+)*)\s+(\d+|PD\d+)\s+of\s+(.+)$",
                re.IGNORECASE,
            ),
            # Flexible comma format: handles various comma-separated name patterns
            re.compile(
                r"^(Sworn|Unsworn)\s+Officer\s+(PD\d+),?\s*([A-Z,\s]+)\s+[Oo]n\s+[Bb]ehalf\s+of\s*-?\s*(Sworn|Unsworn)\s+Officer\s+(PD\d+)\s+([A-Z,\s]+)\s+of\s+(.+)$",
                re.IGNORECASE,
            ),
        ]

        # Single officer patterns: "Rank Name ID" without "on behalf of"
        self.single_officer_patterns = [
            re.compile(
                r"^(Sworn|Unsworn)\s+Officer\s+([A-Z]+)\s+([A-Z]+)\s+(\d+|PD\d+)$",
                re.IGNORECASE,
            ),
            re.compile(
                r"^(Sworn|Unsworn)\s+Officer\s+(\d+|PD\d+)\s+([A-Z]+)$", re.IGNORECASE
            ),
            re.compile(
                r"^(Senior\s+Constable|Police\s+Constable|Detective|Sergeant|Constable)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\s+(\d+)$",
                re.IGNORECASE,
            ),
            re.compile(
                r"^([A-Z/]+)\s+([A-Z][a-z]+)\s+(\d+)$", re.IGNORECASE
            ),  # Abbreviated ranks
        ]

        # Corruption detection patterns
        self.corruption_patterns = [
            re.compile(r"^[A-Z]+\s+[A-Z]+\s+[A-Z]+$"),  # "DUNTON EDMUND RAYMOND"
            re.compile(r"^[A-Z]+\s+[A-Z]+$"),  # "SMITH JOHN"
            re.compile(r"^[A-Z-]+,\s*[A-Z\s]+$"),  # "HALMORE-HALFIELD, BEXLYN ROSALIND"
            re.compile(r"quantity\s+of", re.IGNORECASE),
            re.compile(r"\b(plant|seed|head|striking)\b", re.IGNORECASE),
        ]

        # Standardized value patterns
        self.standardized_patterns = [
            re.compile(r"^UNKNOWN$", re.IGNORECASE),
            re.compile(r"^INQ\s+CONT$", re.IGNORECASE),
            re.compile(r"^N/?A$", re.IGNORECASE),
            re.compile(r"^$"),  # Empty string
        ]

    def detect_format_with_confidence(self, text: str) -> FormatDetectionResult:
        """
        Detect format with confidence scoring and fallback detection
        Returns detailed detection result with confidence metrics
        """
        if not text or not text.strip():
            return FormatDetectionResult(
                format_type=OfficerFormat.UNKNOWN,
                confidence=1.0,
                detection_notes=["Empty or null input"],
            )

        text = text.strip()

        # Check standardized values first (highest confidence)
        standardized_result = self._detect_standardized_values(text)
        if standardized_result.confidence > 0.8:
            return standardized_result

        # Check corruption patterns (high confidence)
        corruption_result = self._detect_corruption_patterns(text)
        if corruption_result.confidence > 0.7:
            return corruption_result

        # Check format patterns with confidence scoring
        format_results = [
            self._detect_later_format(text),
            self._detect_early_format(text),
            self._detect_single_officer(text),
        ]

        # Find highest confidence result
        best_result = max(format_results, key=lambda x: x.confidence)

        # If confidence is too low, attempt fallback detection
        if best_result.confidence < 0.5:
            fallback_result = self._attempt_fallback_detection(text)
            if fallback_result.confidence > best_result.confidence:
                fallback_result.fallback_attempted = True
                return fallback_result

        return best_result

    def _detect_standardized_values(self, text: str) -> FormatDetectionResult:
        """Detect standardized values with high confidence"""
        for pattern in self.standardized_patterns:
            if pattern.match(text):
                return FormatDetectionResult(
                    format_type=OfficerFormat.STANDARDIZED,
                    confidence=0.95,
                    matched_patterns=[pattern.pattern],
                    detection_notes=[
                        f"Matched standardized pattern: {pattern.pattern}"
                    ],
                )

        return FormatDetectionResult(format_type=OfficerFormat.UNKNOWN, confidence=0.0)

    def _detect_corruption_patterns(self, text: str) -> FormatDetectionResult:
        """Detect corruption patterns with confidence scoring"""
        matched_patterns = []
        confidence = 0.0

        for pattern in self.corruption_patterns:
            if pattern.search(text):
                matched_patterns.append(pattern.pattern)
                confidence = max(confidence, 0.8)  # High confidence for corruption

        if matched_patterns:
            return FormatDetectionResult(
                format_type=OfficerFormat.CORRUPTED,
                confidence=confidence,
                matched_patterns=matched_patterns,
                detection_notes=[
                    f"Corruption detected: {len(matched_patterns)} patterns matched"
                ],
            )

        return FormatDetectionResult(format_type=OfficerFormat.UNKNOWN, confidence=0.0)

    def _detect_early_format(self, text: str) -> FormatDetectionResult:
        """Detect early format with confidence scoring (includes typo tolerance)"""
        text_lower = text.lower()
        # Check for "on behalf of" or common typos
        if not any(
            phrase in text_lower
            for phrase in [
                "on behalf of",
                "on bahalf of",
                "on behlaf of",
                "on behalf fo",
                "onbehalf of",
                "on  behalf  of",
            ]
        ):
            return FormatDetectionResult(
                format_type=OfficerFormat.UNKNOWN, confidence=0.0
            )

        matched_patterns = []
        confidence = 0.0

        for i, pattern in enumerate(self.early_format_patterns):
            match = pattern.match(text)
            if match:
                matched_patterns.append(pattern.pattern)
                # Higher confidence for more specific patterns
                pattern_confidence = 0.9 - (
                    i * 0.1
                )  # First pattern gets highest confidence
                confidence = max(confidence, pattern_confidence)

        if matched_patterns:
            return FormatDetectionResult(
                format_type=OfficerFormat.EARLY_FORMAT,
                confidence=confidence,
                matched_patterns=matched_patterns,
                detection_notes=[
                    f"Early format detected with {len(matched_patterns)} pattern matches"
                ],
            )

        # Fallback: if contains "on behalf of" but no specific pattern matches
        if "on behalf of" in text.lower() and not text.lower().startswith(
            ("sworn officer", "unsworn officer")
        ):
            return FormatDetectionResult(
                format_type=OfficerFormat.EARLY_FORMAT,
                confidence=0.4,
                detection_notes=[
                    "Fallback: contains 'on behalf of' without sworn officer prefix"
                ],
            )

        return FormatDetectionResult(format_type=OfficerFormat.UNKNOWN, confidence=0.0)

    def _detect_later_format(self, text: str) -> FormatDetectionResult:
        """Detect later format with confidence scoring (includes typo tolerance)"""
        text_lower = text.lower()
        # Check for "on behalf of" or common typos
        if not any(
            phrase in text_lower
            for phrase in [
                "on behalf of",
                "on bahalf of",
                "on behlaf of",
                "on behalf fo",
                "onbehalf of",
                "on  behalf  of",
            ]
        ):
            return FormatDetectionResult(
                format_type=OfficerFormat.UNKNOWN, confidence=0.0
            )

        matched_patterns = []
        confidence = 0.0

        for i, pattern in enumerate(self.later_format_patterns):
            match = pattern.match(text)
            if match:
                matched_patterns.append(pattern.pattern)
                # Higher confidence for more specific patterns
                pattern_confidence = 0.9 - (i * 0.1)
                confidence = max(confidence, pattern_confidence)

        if matched_patterns:
            return FormatDetectionResult(
                format_type=OfficerFormat.LATER_FORMAT,
                confidence=confidence,
                matched_patterns=matched_patterns,
                detection_notes=[
                    f"Later format detected with {len(matched_patterns)} pattern matches"
                ],
            )

        # Fallback: if starts with sworn/unsworn officer and contains "on behalf of"
        if (
            text.lower().startswith(("sworn officer", "unsworn officer"))
            and "on behalf of" in text.lower()
        ):
            return FormatDetectionResult(
                format_type=OfficerFormat.LATER_FORMAT,
                confidence=0.5,
                detection_notes=[
                    "Fallback: starts with sworn/unsworn officer and contains 'on behalf of'"
                ],
            )

        return FormatDetectionResult(format_type=OfficerFormat.UNKNOWN, confidence=0.0)

    def _detect_single_officer(self, text: str) -> FormatDetectionResult:
        """Detect single officer format with confidence scoring"""
        if "on behalf of" in text.lower():
            return FormatDetectionResult(
                format_type=OfficerFormat.UNKNOWN, confidence=0.0
            )

        matched_patterns = []
        confidence = 0.0

        for i, pattern in enumerate(self.single_officer_patterns):
            match = pattern.match(text)
            if match:
                matched_patterns.append(pattern.pattern)
                # Higher confidence for more specific patterns
                pattern_confidence = 0.8 - (i * 0.1)
                confidence = max(confidence, pattern_confidence)

        if matched_patterns:
            return FormatDetectionResult(
                format_type=OfficerFormat.SINGLE_OFFICER,
                confidence=confidence,
                matched_patterns=matched_patterns,
                detection_notes=[
                    f"Single officer detected with {len(matched_patterns)} pattern matches"
                ],
            )

        return FormatDetectionResult(format_type=OfficerFormat.UNKNOWN, confidence=0.0)

    def _attempt_fallback_detection(self, text: str) -> FormatDetectionResult:
        """Attempt fallback detection strategies for unrecognized patterns"""
        detection_notes = ["Attempting fallback detection"]

        # Strategy 1: Look for common rank keywords
        rank_keywords = ["constable", "sergeant", "detective", "officer", "inspector"]
        found_ranks = [keyword for keyword in rank_keywords if keyword in text.lower()]

        if found_ranks:
            detection_notes.append(f"Found rank keywords: {found_ranks}")

            # If has rank keywords but no "on behalf of", likely single officer
            if "on behalf of" not in text.lower():
                return FormatDetectionResult(
                    format_type=OfficerFormat.SINGLE_OFFICER,
                    confidence=0.3,
                    detection_notes=detection_notes
                    + ["Fallback: rank keywords without 'on behalf of'"],
                )
            else:
                # Has rank keywords and "on behalf of", try to determine format
                if any(keyword in text.lower() for keyword in ["sworn", "unsworn"]):
                    return FormatDetectionResult(
                        format_type=OfficerFormat.LATER_FORMAT,
                        confidence=0.3,
                        detection_notes=detection_notes
                        + ["Fallback: sworn/unsworn with 'on behalf of'"],
                    )
                else:
                    return FormatDetectionResult(
                        format_type=OfficerFormat.EARLY_FORMAT,
                        confidence=0.3,
                        detection_notes=detection_notes
                        + ["Fallback: traditional ranks with 'on behalf of'"],
                    )

        # Strategy 2: Look for numeric patterns (badge IDs)
        numeric_patterns = re.findall(r"\b\d{3,5}\b|PD\d+", text)
        if numeric_patterns:
            detection_notes.append(f"Found numeric patterns: {numeric_patterns}")
            return FormatDetectionResult(
                format_type=OfficerFormat.SINGLE_OFFICER,
                confidence=0.2,
                detection_notes=detection_notes
                + ["Fallback: numeric patterns suggest officer data"],
            )

        return FormatDetectionResult(
            format_type=OfficerFormat.UNKNOWN,
            confidence=0.0,
            detection_notes=detection_notes + ["All fallback strategies failed"],
        )
