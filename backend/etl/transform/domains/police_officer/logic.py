#!/usr/bin/env python3
"""
Domain Logic for Police Officer Processing - Orchestrator

This module is the main entry point for the police officer domain.
It orchestrates format detection, parsing, standardisation, and post-processing
by delegating to specialised sub-modules.

Sub-modules:
    - constants.py: Shared enums, dataclasses, and path constants
    - rank_handler.py: Rank standardisation engine (abbreviation expansion, seniority)
    - format_detector.py: Format detection and classification
    - organisation_handler.py: Data quality analysis and organisation handling
    - parser.py: Officer string parsing (early, later, single formats)
"""

import json
import logging
import re
from pathlib import Path

from etl.transform import debug_files
from etl.transform.lazy_pandas import is_missing, pd  # noqa: F401

# Import rank/name correction system
try:
    from .corrections.apply_corrections import apply_rank_name_corrections
except ImportError:
    # Fallback for direct execution
    import sys
    from pathlib import Path  # noqa: F811

    corrections_path = Path(__file__).parent / "corrections"
    sys.path.insert(0, str(corrections_path))
    from apply_corrections import apply_rank_name_corrections

from typing import Any, Dict, List, Optional

# Import from sub-modules
from .constants import (
    DEBUG_FILE,
    DOMAIN_PATH,
    OfficerFormat,
)
from .organisation_handler import DataQualityAnalyzer
from .parser import (
    EarlyFormatParser,
    ErrorAnalyzer,
    LaterFormatParser,
    ParsedOfficerData,
    SingleOfficerParser,
)
from .rank_handler import StandardizationEngine


class PoliceOfficerProcessor:
    """Main processor for Police Officer domain - Standardization and Corruption Handling"""

    def __init__(self):
        self.logger = logging.getLogger(__name__)
        self.analyzer = DataQualityAnalyzer()
        self.standardization_engine = StandardizationEngine()
        self.error_analyzer = ErrorAnalyzer()

        # Initialize parsers
        self.early_parser = EarlyFormatParser(self.standardization_engine)
        self.later_parser = LaterFormatParser(self.standardization_engine)
        self.single_parser = SingleOfficerParser(self.standardization_engine)

        # Load manual corrections
        self.manual_corrections = self._load_manual_corrections()

        self._clear_debug_file()

    def _clear_debug_file(self):
        """Clear the debug file"""
        if not debug_files.enabled():
            return
        try:
            with open(DEBUG_FILE, "w") as f:
                f.write("POLICE OFFICER PROCESSING DEBUG LOG\n")
                f.write("=" * 50 + "\n\n")
        except Exception as e:
            self.logger.error(f"Could not create debug file: {str(e)}")

    def _debug_log(self, message: str):
        """Write debug message to file"""
        if not debug_files.enabled():
            return
        try:
            with open(DEBUG_FILE, "a") as f:
                f.write(message + "\n")
        except Exception as e:
            self.logger.error(f"Could not write to debug file: {str(e)}")

    def _load_manual_corrections(self) -> Dict:
        """Load manual corrections from JSON file"""
        manual_corrections_file = DOMAIN_PATH / "manual_review_corrections.json"
        try:
            if manual_corrections_file.exists():
                with open(manual_corrections_file, "r") as f:
                    return json.load(f)
        except Exception as e:
            self.logger.warning(f"Could not load manual corrections: {str(e)}")
        return {"manual_corrections": {"corrections": [], "flagged_for_review": []}}

    def _check_manual_corrections(self, text: str) -> Optional[str]:
        """Check if text has a manual correction available"""
        corrections = self.manual_corrections.get("manual_corrections", {}).get(
            "corrections", []
        )
        for correction in corrections:
            if correction.get("original_value", "").strip().lower() == text.lower():
                return json.dumps(correction.get("corrected_structure", {}))
        return None

    def process_value(self, value: Any, row_id: int, logger) -> str:
        """
        Process a single Police Officer value with comprehensive error handling and fallback strategies
        Returns JSON string with structured officer data
        """
        self._debug_log(f"Row {row_id}: Processing value: '{value}'")

        # Handle empty/null values
        if not value or not str(value).strip():
            self._debug_log(f"Row {row_id}: Empty value, returning empty structure")
            result = self._generate_empty_structure("empty_value")
            # Log transformation for ETL system
            if logger:
                logger.log_transformation_issue(
                    domain_name="police_officer",
                    row_id=row_id,
                    column="police_officer",
                    original_value="",
                    issue_type="empty_value",
                    action_taken="empty_structure_generated",
                    final_value=result,
                    requires_review=False,
                )
            return result

        text = str(value).strip()
        original_value = text

        try:
            # Check for manual corrections first
            manual_correction = self._check_manual_corrections(text)
            if manual_correction:
                self._debug_log(f"Row {row_id}: Manual correction applied")
                if logger:
                    logger.log_transformation_issue(
                        domain_name="police_officer",
                        row_id=row_id,
                        column="police_officer",
                        original_value=original_value,
                        issue_type="manual_correction_applied",
                        action_taken="manual_correction_used",
                        final_value=manual_correction,
                        requires_review=False,
                    )
                return manual_correction

            # Check for standardized values (UNKNOWN, INQ CONT, etc.)
            standardized_result = (
                self.standardization_engine.standardize_unknown_values(text)
            )
            if standardized_result is None:
                self._debug_log(
                    f"Row {row_id}: Standardized value detected, returning empty structure"
                )
                result = self._generate_empty_structure("standardized_value")
                # Log transformation for ETL system
                if logger:
                    logger.log_transformation_issue(
                        domain_name="police_officer",
                        row_id=row_id,
                        column="police_officer",
                        original_value=original_value,
                        issue_type="standardized_value",
                        action_taken="empty_structure_generated",
                        final_value=result,
                        requires_review=False,
                    )
                return result

            # Check for data corruption
            is_corrupted, corruption_type = (
                self.standardization_engine.detect_and_flag_corruption(text)
            )
            if is_corrupted:
                self._debug_log(
                    f"Row {row_id}: Corruption detected - {corruption_type}"
                )
                result = self._generate_empty_structure(f"corrupted_{corruption_type}")
                # Log transformation for ETL system
                if logger:
                    logger.log_transformation_issue(
                        domain_name="police_officer",
                        row_id=row_id,
                        column="police_officer",
                        original_value=original_value,
                        issue_type=f"corrupted_{corruption_type}",
                        action_taken="empty_structure_generated",
                        final_value=result,
                        requires_review=True,
                    )
                return result

            # Attempt parsing with proper pattern matching - no fallback dependencies
            return self._process_with_proper_pattern_matching(
                text, row_id, logger, original_value
            )

        except Exception as e:
            self.logger.error(f"Error processing row {row_id}: {str(e)}")
            self._debug_log(f"Row {row_id}: Processing error - {str(e)}")
            result = self._generate_empty_structure("processing_error")
            # Log transformation for ETL system
            if logger:
                logger.log_transformation_issue(
                    domain_name="police_officer",
                    row_id=row_id,
                    column="police_officer",
                    original_value=original_value,
                    final_value=result,
                    issue_type="processing_error",
                    action_taken="error_handling",
                    requires_review=True,
                )
            return result

    def _process_with_proper_pattern_matching(
        self, text: str, row_id: int, logger, original_value: str
    ) -> str:
        """
        Process with proper pattern matching - no fallback dependencies
        Either parse correctly with a specific pattern or fail explicitly
        """
        # Strategy 1: Try all parsers systematically - no fallback dependencies
        # Each parser should either succeed with proper pattern matching or fail explicitly

        parsers_to_try = [
            (self.early_parser, "early_format"),
            (self.later_parser, "later_format"),
            (self.single_parser, "single_officer"),
        ]

        for parser, format_name in parsers_to_try:
            try:
                parsed_data = parser.parse(text, row_id)
                if (
                    parsed_data
                    and parsed_data.processing_notes.get("reason")
                    == "successfully_parsed"
                ):
                    # Success with proper pattern matching
                    result = parsed_data.to_json()
                    self._debug_log(
                        f"Row {row_id}: Successfully parsed with {format_name} parser"
                    )

                    if logger:
                        logger.log_transformation_issue(
                            domain_name="police_officer",
                            row_id=row_id,
                            column="police_officer",
                            original_value=original_value,
                            final_value=result,
                            issue_type="successful_parsing",
                            action_taken=f"parsed_as_{format_name}",
                            requires_review=False,
                        )
                    return result

            except Exception as e:
                self._debug_log(f"Row {row_id}: {format_name} parser failed - {str(e)}")
                continue

        # Strategy 2: Handle standardized values (UNKNOWN, INQ CONT, etc.)
        if self.standardization_engine.is_standardized_value(text):
            result = self._generate_empty_structure("standardized_value")
            self._debug_log(f"Row {row_id}: Processed as standardized value")

            if logger:
                logger.log_transformation_issue(
                    domain_name="police_officer",
                    row_id=row_id,
                    column="police_officer",
                    original_value=original_value,
                    final_value=result,
                    issue_type="standardized_value",
                    action_taken="processed_as_standardized",
                    requires_review=False,
                )
            return result

        # Strategy 3: Handle corrupted data (defendant names, etc.)
        if self.standardization_engine.detect_corruption(text):
            result = self._generate_empty_structure("corrupted_data")
            self._debug_log(f"Row {row_id}: Detected as corrupted data")

            if logger:
                logger.log_transformation_issue(
                    domain_name="police_officer",
                    row_id=row_id,
                    column="police_officer",
                    original_value=original_value,
                    final_value=result,
                    issue_type="corrupted_data",
                    action_taken="detected_as_corruption",
                    requires_review=False,
                )
            return result

        # Strategy 4: Explicit failure - no pattern matched
        # This is better than poor-quality fallback parsing
        self._debug_log(f"Row {row_id}: No pattern matched - explicit parsing failure")

        result = self._generate_empty_structure("parsing_failed")

        if logger:
            logger.log_transformation_issue(
                domain_name="police_officer",
                row_id=row_id,
                column="police_officer",
                original_value=original_value,
                final_value=result,
                issue_type="parsing_failed",
                action_taken="no_pattern_matched",
                requires_review=True,
            )

        return result

    def _attempt_format_specific_parsing(
        self, text: str, format_type: OfficerFormat, row_id: int
    ) -> Optional[ParsedOfficerData]:
        """Attempt parsing with the detected format"""

        if format_type == OfficerFormat.EARLY_FORMAT:
            return self.early_parser.parse(text, row_id)
        elif format_type == OfficerFormat.LATER_FORMAT:
            return self.later_parser.parse(text, row_id)
        elif format_type == OfficerFormat.SINGLE_OFFICER:
            return self.single_parser.parse(text, row_id)
        elif format_type == OfficerFormat.CORRUPTED:
            return None  # Will trigger fallback
        elif format_type == OfficerFormat.STANDARDIZED:
            return None  # Will trigger fallback
        else:
            return None  # Unknown format, will trigger fallback

    def _attempt_alternative_format_detection(
        self, text: str, row_id: int
    ) -> Optional[str]:
        """Try alternative format detection strategies"""

        # Strategy: Force try each parser regardless of format detection
        parsers_to_try = [
            (self.early_parser, "early_format"),
            (self.later_parser, "later_format"),
            (self.single_parser, "single_officer"),
        ]

        for parser, format_name in parsers_to_try:
            try:
                parsed_data = parser.parse(text, row_id)
                if (
                    parsed_data
                    and parsed_data.processing_notes.get("reason")
                    == "successfully_parsed"
                ):
                    self._debug_log(
                        f"Row {row_id}: Alternative success with {format_name} parser"
                    )
                    # Update processing notes to indicate alternative detection
                    parsed_data.processing_notes["alternative_detection"] = True
                    parsed_data.processing_notes["original_format_detected"] = (
                        format_name
                    )
                    return parsed_data.to_json()
            except Exception as e:
                self._debug_log(
                    f"Row {row_id}: Alternative {format_name} parser failed - {str(e)}"
                )
                continue

        return None

    def _attempt_partial_parsing(self, text: str, row_id: int) -> Optional[str]:
        """Attempt to extract partial information from unparseable entries"""

        partial_data = ParsedOfficerData()
        extraction_success = False

        # Try to extract badge numbers
        badge_matches = re.findall(r"\b(?:PD)?(\d{3,5})\b", text)
        if badge_matches:
            # Assume first badge number is submitting officer
            partial_data.submitting_officer.badge_id = (
                f"PD{badge_matches[0]}"
                if badge_matches[0].isdigit()
                else badge_matches[0]
            )
            extraction_success = True

        # Try to extract rank information
        rank_patterns = [
            r"\b(Senior\s+Constable|Police\s+Constable|Detective|Sergeant|Constable)\b",
            r"\b(Sworn\s+Officer|Unsworn\s+Officer)\b",
            r"\b([A-Z]/[A-Z]|S/C|PC|Det|Sgt)\b",
        ]

        for pattern in rank_patterns:
            rank_match = re.search(pattern, text, re.IGNORECASE)
            if rank_match:
                rank = self.standardization_engine.expand_rank_abbreviations(
                    rank_match.group(1)
                )
                partial_data.submitting_officer.rank = rank
                extraction_success = True
                break

        # Try to extract names (capitalized words that aren't ranks or organizations)
        exclude_words = {
            "senior",
            "constable",
            "police",
            "detective",
            "sergeant",
            "sworn",
            "unsworn",
            "officer",
            "behalf",
            "detectives",
            "district",
            "office",
        }
        name_candidates = re.findall(r"\b[A-Z][a-z]+\b", text)
        potential_names = [
            name for name in name_candidates if name.lower() not in exclude_words
        ]

        if potential_names:
            # Take first 2 potential names as officer name
            partial_data.submitting_officer.name = " ".join(potential_names[:2])
            extraction_success = True

        # Try to extract organization
        if "of" in text.lower():
            of_parts = text.lower().split("of")
            if len(of_parts) > 1:
                potential_org = of_parts[-1].strip()
                # Clean up organization name
                org_words = potential_org.split()[:4]  # Take first 4 words
                if org_words:
                    partial_data.organisation = " ".join(org_words).title()
                    extraction_success = True

        if extraction_success:
            partial_data.processing_notes = {
                "reason": "partial_parsing_success",
                "format_detected": "partial_extraction",
                "confidence": self._calculate_partial_confidence(partial_data),
                "extracted_components": self._list_extracted_components(partial_data),
            }

            self._debug_log(
                f"Row {row_id}: Partial extraction successful - {partial_data.processing_notes['extracted_components']}"
            )
            return partial_data.to_json()

        return None

    def _calculate_partial_confidence(self, partial_data: ParsedOfficerData) -> float:
        """Calculate confidence score for partial parsing results"""
        confidence = 0.0

        if partial_data.submitting_officer.badge_id:
            confidence += 0.4
        if partial_data.submitting_officer.rank:
            confidence += 0.3
        if partial_data.submitting_officer.name:
            confidence += 0.2
        if partial_data.organisation:
            confidence += 0.1

        return confidence

    def _list_extracted_components(self, partial_data: ParsedOfficerData) -> List[str]:
        """List successfully extracted components"""
        components = []

        if partial_data.submitting_officer.badge_id:
            components.append("badge_id")
        if partial_data.submitting_officer.rank:
            components.append("rank")
        if partial_data.submitting_officer.name:
            components.append("name")
        if partial_data.organisation:
            components.append("organisation")

        return components

    def _generate_empty_structure(self, reason: str = "unknown") -> str:
        """
        Generate empty officer structure for corrupted or missing data
        Returns JSON string with empty officer data
        For Django consistency, all entries use 'successfully_parsed' status
        """
        empty_structure = {
            "submitting_officer": {"name": "", "rank": "", "badge_id": ""},
            "requesting_officer": {"name": "", "rank": "", "badge_id": ""},
            "organisation": "",
            "processing_notes": {
                "reason": "successfully_parsed",
                "format_detected": "empty",
                "original_reason": reason,  # Keep original reason for debugging
            },
        }

        return json.dumps(empty_structure)

    def _generate_empty_structure_with_attempts(
        self, reason: str, parsing_attempts: List[str]
    ) -> str:
        """
        Generate empty officer structure with detailed parsing attempt information
        Returns JSON string with empty officer data and attempt details
        For Django consistency, all entries use 'successfully_parsed' status
        """
        empty_structure = {
            "submitting_officer": {"name": "", "rank": "", "badge_id": ""},
            "requesting_officer": {"name": "", "rank": "", "badge_id": ""},
            "organisation": "",
            "processing_notes": {
                "reason": "successfully_parsed",
                "format_detected": "empty",
                "original_reason": reason,  # Keep original reason for debugging
                "parsing_attempts": parsing_attempts,
                "confidence": 0.0,
            },
        }

        return json.dumps(empty_structure)

    def analyze_processing_results(self, csv_file_path: str = None) -> Dict[str, Any]:
        """
        Analyze the 8_police_officer.csv file to identify patterns of failures and issues
        This runs every time to understand what needs fixing
        """
        if csv_file_path is None:
            csv_file_path = "data/modded/8_police_officer.csv"

        self.logger.info(
            "Starting comprehensive analysis of police officer processing results"
        )
        return self.error_analyzer.analyze_processing_results(csv_file_path)

    def test_standardization(self, test_cases: List[str]) -> Dict[str, Dict]:
        """
        Test standardization engine with various cases
        Returns results for debugging and validation
        """
        results = {}

        for case in test_cases:
            # Get detailed format detection
            detection_result = self.analyzer._detect_format_with_details(case)

            result = {
                "original": case,
                "standardized_unknown": self.standardization_engine.standardize_unknown_values(
                    case
                ),
                "corruption_check": self.standardization_engine.detect_and_flag_corruption(
                    case
                ),
                "format_detected": detection_result.format_type.value,
                "detection_confidence": detection_result.confidence,
                "matched_patterns": detection_result.matched_patterns,
                "detection_notes": detection_result.detection_notes,
                "fallback_attempted": detection_result.fallback_attempted,
            }

            # Test rank extraction and standardization
            ranks = self.analyzer._extract_ranks(case, detection_result.format_type)
            result["ranks_extracted"] = ranks

            # Test organization extraction and standardization
            org = self.analyzer._extract_organization(
                case, detection_result.format_type
            )
            result["organization_extracted"] = org

            results[case] = result

        return results

    def test_format_detection(self, test_cases: List[str]) -> Dict[str, Dict]:
        """
        Test format detection system with confidence scoring
        Returns detailed results for validation and debugging
        """
        results = {}

        for case in test_cases:
            detection_result = self.analyzer._detect_format_with_details(case)

            results[case] = {
                "format_type": detection_result.format_type.value,
                "confidence": detection_result.confidence,
                "matched_patterns": detection_result.matched_patterns,
                "detection_notes": detection_result.detection_notes,
                "fallback_attempted": detection_result.fallback_attempted,
            }

        return results

    def test_early_format_parser(self) -> Dict[str, Dict]:
        """
        Test early format parser against manual validation samples
        Returns comparison between parser output and expected results
        """
        # Load manual validation samples
        try:
            with open(DOMAIN_PATH / "manual_validation_samples.json", "r") as f:
                validation_data = json.load(f)
        except Exception as e:
            self.logger.error(f"Could not load validation samples: {str(e)}")
            return {"error": f"Could not load validation samples: {str(e)}"}

        results = {}
        early_samples = validation_data.get("format_samples", {}).get("early", [])

        for sample in early_samples:
            original_text = sample["original_text"]
            expected_structure = sample.get("expected_structure", {})
            row_id = sample["row_id"]

            # Parse with early format parser
            parsed_data = self.early_parser.parse(original_text, row_id)
            parser_output = json.loads(parsed_data.to_json())

            # Compare results
            comparison = {
                "original_text": original_text,
                "expected": expected_structure,
                "parser_output": parser_output,
                "matches": self._compare_structures(expected_structure, parser_output),
                "parsing_success": parsed_data.processing_notes.get("reason")
                == "successfully_parsed",
            }

            results[f"row_{row_id}"] = comparison

        return results

    def test_later_format_parser(self) -> Dict[str, Dict]:
        """
        Test later format parser against manual validation samples
        Returns comparison between parser output and expected results
        """
        # Load manual validation samples
        try:
            with open(DOMAIN_PATH / "manual_validation_samples.json", "r") as f:
                validation_data = json.load(f)
        except Exception as e:
            self.logger.error(f"Could not load validation samples: {str(e)}")
            return {"error": f"Could not load validation samples: {str(e)}"}

        results = {}
        later_samples = validation_data.get("format_samples", {}).get("later", [])

        for sample in later_samples:
            original_text = sample["original_text"]
            expected_structure = sample.get("expected_structure", {})
            row_id = sample["row_id"]

            # Parse with later format parser
            parsed_data = self.later_parser.parse(original_text, row_id)
            parser_output = json.loads(parsed_data.to_json())

            # Compare results
            comparison = {
                "original_text": original_text,
                "expected": expected_structure,
                "parser_output": parser_output,
                "matches": self._compare_structures(expected_structure, parser_output),
                "parsing_success": parsed_data.processing_notes.get("reason")
                == "successfully_parsed",
            }

            results[f"row_{row_id}"] = comparison

        return results

    def test_single_officer_parser(self) -> Dict[str, Dict]:
        """
        Test single officer parser against manual validation samples
        Returns comparison between parser output and expected results
        """
        # Load manual validation samples
        try:
            with open(DOMAIN_PATH / "manual_validation_samples.json", "r") as f:
                validation_data = json.load(f)
        except Exception as e:
            self.logger.error(f"Could not load validation samples: {str(e)}")
            return {"error": f"Could not load validation samples: {str(e)}"}

        results = {}

        # Test single officer samples
        single_samples = validation_data.get("format_samples", {}).get("single", [])
        for sample in single_samples:
            original_text = sample["original_text"]
            expected_structure = sample.get("expected_structure", {})
            row_id = sample["row_id"]

            # Parse with single officer parser
            parsed_data = self.single_parser.parse(original_text, row_id)
            parser_output = json.loads(parsed_data.to_json())

            # Compare results
            comparison = {
                "original_text": original_text,
                "expected": expected_structure,
                "parser_output": parser_output,
                "matches": self._compare_structures(expected_structure, parser_output),
                "parsing_success": parsed_data.processing_notes.get("reason")
                == "successfully_parsed",
            }

            results[f"row_{row_id}"] = comparison

        # Test random samples that are detected as single officer format
        random_samples = validation_data.get("random_samples", [])
        for sample in random_samples:
            if sample.get("detected_format") == "single":
                original_text = sample["original_text"]
                expected_structure = sample.get("expected_structure", {})
                row_id = sample["row_id"]

                # Parse with single officer parser
                parsed_data = self.single_parser.parse(original_text, row_id)
                parser_output = json.loads(parsed_data.to_json())

                # Compare results
                comparison = {
                    "original_text": original_text,
                    "expected": expected_structure,
                    "parser_output": parser_output,
                    "matches": self._compare_structures(
                        expected_structure, parser_output
                    ),
                    "parsing_success": parsed_data.processing_notes.get("reason")
                    == "successfully_parsed",
                }

                results[f"random_row_{row_id}"] = comparison

        return results

    def _compare_structures(self, expected: Dict, actual: Dict) -> Dict[str, bool]:
        """Compare expected and actual parsed structures"""
        matches = {}

        # Compare submitting officer
        exp_sub = expected.get("submitting_officer", {})
        act_sub = actual.get("submitting_officer", {})
        matches["submitting_name"] = (
            exp_sub.get("name", "").lower() == act_sub.get("name", "").lower()
        )
        matches["submitting_rank"] = (
            exp_sub.get("rank", "").lower() == act_sub.get("rank", "").lower()
        )
        matches["submitting_badge"] = exp_sub.get("badge_id", "") == act_sub.get(
            "badge_id", ""
        )

        # Compare requesting officer
        exp_req = expected.get("requesting_officer", {})
        act_req = actual.get("requesting_officer", {})
        matches["requesting_name"] = (
            exp_req.get("name", "").lower() == act_req.get("name", "").lower()
        )
        matches["requesting_rank"] = (
            exp_req.get("rank", "").lower() == act_req.get("rank", "").lower()
        )
        matches["requesting_badge"] = exp_req.get("badge_id", "") == act_req.get(
            "badge_id", ""
        )

        # Compare organization (more flexible matching)
        exp_org = expected.get("organisation", "").lower()
        act_org = actual.get("organisation", "").lower()
        matches["organisation"] = (
            exp_org in act_org or act_org in exp_org or exp_org == act_org
        )

        # Overall match
        matches["overall"] = all(matches.values())

        return matches

    @classmethod
    def analyze_police_officer_data(cls):
        """Class method to run comprehensive data analysis"""
        processor = cls()
        return processor.analyzer.analyze_police_officer_data()

    @classmethod
    def generate_standardization_mappings(cls):
        """Class method to generate standardization mappings"""
        processor = cls()
        return processor.analyzer.generate_standardization_mappings()

    def apply_submitting_officer_standardization(
        self, csv_file_path: str = None
    ) -> Dict[str, Any]:
        """
        Apply submitting officer standardization rules to processed data.
        This is a post-processing step that runs after main ETL processing.

        Returns:
            Dict with standardization results and statistics
        """
        if csv_file_path is None:
            csv_file_path = "data/modded/8_police_officer.csv"

        standardization_file = (
            DOMAIN_PATH / "analysis" / "submitting_officer_standardization.json"
        )

        # Check if standardization rules exist and are ready
        if not standardization_file.exists():
            self.logger.warning(
                "Submitting officer standardization rules not found - skipping standardization"
            )
            return {"status": "skipped", "reason": "no_rules_file"}

        try:
            with open(standardization_file, "r") as f:
                rules = json.load(f)

            # Check if rules are ready for implementation
            if not rules.get("metadata", {}).get("ready", False):
                self.logger.warning(
                    "Submitting officer standardization rules not ready - skipping standardization"
                )
                return {"status": "skipped", "reason": "rules_not_ready"}

            consolidation_rules = rules.get("badge_id_consolidations", {})
            if not consolidation_rules:
                self.logger.warning(
                    "No consolidation rules found - skipping standardization"
                )
                return {"status": "skipped", "reason": "no_consolidation_rules"}

            # Load the processed data
            df = pd.read_csv(csv_file_path)

            # Track standardization statistics
            stats = {
                "total_entries": len(df),
                "entries_processed": 0,
                "entries_standardized": 0,
                "officers_standardized": 0,
                "standardization_details": {},
            }

            self.logger.info(
                f"Applying submitting officer standardization to {len(df)} entries..."
            )

            # Process each row
            for idx, row in df.iterrows():
                if pd.notna(row["processed_value"]):
                    try:
                        parsed = json.loads(row["processed_value"])
                        stats["entries_processed"] += 1

                        # Only standardize successfully parsed entries with submitting officer data
                        if parsed.get("processing_notes", {}).get(
                            "reason"
                        ) == "successfully_parsed" and parsed.get(
                            "submitting_officer", {}
                        ).get(
                            "badge_id"
                        ):

                            submitting = parsed["submitting_officer"]
                            badge_id = submitting.get("badge_id", "").strip()

                            # Check if this badge ID has standardization rules
                            if badge_id in consolidation_rules:
                                rule = consolidation_rules[badge_id]

                                # Only apply if rule is ready
                                if rule.get("ready", False):
                                    original_name = submitting.get("name", "")
                                    original_rank = submitting.get("rank", "")

                                    # Apply standardization
                                    standardized_name = rule["standardized_name"]
                                    standardized_rank = rule["standardized_rank"]

                                    # Check if standardization is needed
                                    if (
                                        original_name != standardized_name
                                        or original_rank != standardized_rank
                                    ):

                                        # Update the parsed data
                                        parsed["submitting_officer"][
                                            "name"
                                        ] = standardized_name
                                        parsed["submitting_officer"][
                                            "rank"
                                        ] = standardized_rank

                                        # Add standardization note
                                        if (
                                            "standardization_applied"
                                            not in parsed["processing_notes"]
                                        ):
                                            parsed["processing_notes"][
                                                "standardization_applied"
                                            ] = {
                                                "submitting_officer": {
                                                    "original_name": original_name,
                                                    "original_rank": original_rank,
                                                    "standardized_name": standardized_name,
                                                    "standardized_rank": standardized_rank,
                                                }
                                            }

                                        # Update the CSV data
                                        df.at[idx, "processed_value"] = json.dumps(
                                            parsed
                                        )

                                        stats["entries_standardized"] += 1

                                        # Track standardization details
                                        if (
                                            badge_id
                                            not in stats["standardization_details"]
                                        ):
                                            stats["standardization_details"][
                                                badge_id
                                            ] = {
                                                "standardized_name": standardized_name,
                                                "standardized_rank": standardized_rank,
                                                "entries_affected": 0,
                                            }
                                        stats["standardization_details"][badge_id][
                                            "entries_affected"
                                        ] += 1

                    except json.JSONDecodeError:
                        continue

            # Count unique officers standardized
            stats["officers_standardized"] = len(stats["standardization_details"])

            # Save the updated data back to CSV
            df.to_csv(csv_file_path, index=False)

            # Generate standardization report
            self._generate_standardization_report(stats, rules)

            self.logger.info("Submitting officer standardization complete:")
            self.logger.info(
                f"  - {stats['entries_standardized']} entries standardized"
            )
            self.logger.info(
                f"  - {stats['officers_standardized']} officers standardized"
            )

            return {"status": "completed", "statistics": stats}

        except Exception as e:
            self.logger.error(
                f"Error during submitting officer standardization: {str(e)}"
            )
            return {"status": "error", "error": str(e)}

    def _generate_standardization_report(self, stats: Dict, rules: Dict) -> None:
        """Generate a report of the standardization process"""
        report_path = DOMAIN_PATH / "analysis" / "standardization_application_report.md"

        try:
            with open(report_path, "w") as f:
                f.write("# Submitting Officer Standardization Application Report\n\n")
                f.write(
                    f"**Date**: {pd.Timestamp.now().strftime('%Y-%m-%d %H:%M:%S')}\n"
                )
                f.write("**Status**: Completed Successfully\n\n")

                f.write("## Summary Statistics\n\n")
                f.write(f"- **Total Entries**: {stats['total_entries']:,}\n")
                f.write(f"- **Entries Processed**: {stats['entries_processed']:,}\n")
                f.write(
                    f"- **Entries Standardized**: {stats['entries_standardized']:,}\n"
                )
                f.write(
                    f"- **Officers Standardized**: {stats['officers_standardized']}\n"
                )
                f.write(
                    f"- **Standardization Rate**: {(stats['entries_standardized']/stats['entries_processed']*100):.1f}%\n\n"
                )

                f.write("## Standardization Details\n\n")

                # Sort by entries affected (highest impact first)
                sorted_details = sorted(
                    stats["standardization_details"].items(),
                    key=lambda x: x[1]["entries_affected"],
                    reverse=True,
                )

                for badge_id, details in sorted_details:
                    f.write(f"### {badge_id}\n")
                    f.write(
                        f"- **Standardized Name**: {details['standardized_name']}\n"
                    )
                    f.write(
                        f"- **Standardized Rank**: {details['standardized_rank']}\n"
                    )
                    f.write(
                        f"- **Entries Affected**: {details['entries_affected']:,}\n\n"
                    )

                f.write("## Implementation Notes\n\n")
                f.write(
                    "- Standardization applied only to successfully parsed entries\n"
                )
                f.write(
                    "- Original values preserved in processing_notes for audit trail\n"
                )
                f.write("- Only rules marked as 'ready: true' were applied\n")
                f.write(
                    "- Standardization details added to processing_notes for transparency\n"
                )

        except Exception as e:
            self.logger.error(f"Error generating standardization report: {str(e)}")

    def apply_requesting_officer_standardization(
        self, csv_file_path: str = None
    ) -> Dict[str, Any]:
        """
        Apply requesting officer standardization rules to processed data.
        This is a post-processing step that runs after main ETL processing.

        Returns:
            Dict with standardization results and statistics
        """
        if csv_file_path is None:
            csv_file_path = "data/modded/8_police_officer.csv"

        standardization_file = (
            DOMAIN_PATH / "analysis" / "requesting_officer_standardization.json"
        )

        # Check if standardization rules exist and are ready
        if not standardization_file.exists():
            self.logger.warning(
                "Requesting officer standardization rules not found - skipping standardization"
            )
            return {"status": "skipped", "reason": "no_rules_file"}

        try:
            with open(standardization_file, "r") as f:
                rules = json.load(f)

            # Check if rules are ready for implementation
            if not rules.get("metadata", {}).get("ready", False):
                self.logger.warning(
                    "Requesting officer standardization rules not ready - skipping standardization"
                )
                return {"status": "skipped", "reason": "rules_not_ready"}

            consolidation_rules = rules.get("badge_id_consolidations", {})
            if not consolidation_rules:
                self.logger.warning(
                    "No consolidation rules found - skipping standardization"
                )
                return {"status": "skipped", "reason": "no_consolidation_rules"}

            # Load the processed data
            df = pd.read_csv(csv_file_path)

            # Track standardization statistics
            stats = {
                "total_entries": len(df),
                "entries_processed": 0,
                "entries_standardized": 0,
                "officers_standardized": 0,
                "badge_ids_removed": 0,
                "standardization_details": {},
            }

            self.logger.info(
                f"Applying requesting officer standardization to {len(df)} entries..."
            )

            # Process each row
            for idx, row in df.iterrows():
                if pd.notna(row["processed_value"]):
                    try:
                        parsed = json.loads(row["processed_value"])
                        stats["entries_processed"] += 1

                        # Only standardize successfully parsed entries with requesting officer data
                        if parsed.get("processing_notes", {}).get(
                            "reason"
                        ) == "successfully_parsed" and parsed.get(
                            "requesting_officer", {}
                        ).get(
                            "name"
                        ):

                            requesting = parsed["requesting_officer"]
                            badge_id = requesting.get("badge_id", "").strip()
                            requesting.get("name", "").strip()

                            # Handle special case for PD47286 - remove badge ID
                            if badge_id == "PD47286":
                                parsed["requesting_officer"]["badge_id"] = ""

                                # Add note about badge ID removal
                                if (
                                    "standardization_applied"
                                    not in parsed["processing_notes"]
                                ):
                                    parsed["processing_notes"][
                                        "standardization_applied"
                                    ] = {}

                                parsed["processing_notes"]["standardization_applied"][
                                    "requesting_officer"
                                ] = {
                                    "badge_id_removed": True,
                                    "reason": "conflicting_names_for_badge_id",
                                    "original_badge_id": "PD47286",
                                }

                                # Update the CSV data
                                df.at[idx, "processed_value"] = json.dumps(parsed)
                                stats["badge_ids_removed"] += 1
                                continue

                            # Check if this badge ID has standardization rules
                            if badge_id and badge_id in consolidation_rules:
                                rule = consolidation_rules[badge_id]

                                # Only apply if rule is ready
                                if rule.get("ready", False):
                                    original_name = requesting.get("name", "")
                                    original_rank = requesting.get("rank", "")

                                    # Apply standardization
                                    standardized_name = rule["standardized_name"]
                                    standardized_rank = rule["standardized_rank"]

                                    # Check if standardization is needed
                                    if (
                                        original_name != standardized_name
                                        or original_rank != standardized_rank
                                    ):

                                        # Update the parsed data
                                        parsed["requesting_officer"][
                                            "name"
                                        ] = standardized_name
                                        parsed["requesting_officer"][
                                            "rank"
                                        ] = standardized_rank

                                        # Add standardization note
                                        if (
                                            "standardization_applied"
                                            not in parsed["processing_notes"]
                                        ):
                                            parsed["processing_notes"][
                                                "standardization_applied"
                                            ] = {}

                                        parsed["processing_notes"][
                                            "standardization_applied"
                                        ]["requesting_officer"] = {
                                            "original_name": original_name,
                                            "original_rank": original_rank,
                                            "standardized_name": standardized_name,
                                            "standardized_rank": standardized_rank,
                                        }

                                        # Update the CSV data
                                        df.at[idx, "processed_value"] = json.dumps(
                                            parsed
                                        )

                                        stats["entries_standardized"] += 1

                                        # Track standardization details
                                        if (
                                            badge_id
                                            not in stats["standardization_details"]
                                        ):
                                            stats["standardization_details"][
                                                badge_id
                                            ] = {
                                                "standardized_name": standardized_name,
                                                "standardized_rank": standardized_rank,
                                                "entries_affected": 0,
                                            }
                                        stats["standardization_details"][badge_id][
                                            "entries_affected"
                                        ] += 1

                    except json.JSONDecodeError:
                        continue

            # Count unique officers standardized
            stats["officers_standardized"] = len(stats["standardization_details"])

            # Save the updated data back to CSV
            df.to_csv(csv_file_path, index=False)

            # Generate standardization report
            self._generate_requesting_officer_standardization_report(stats, rules)

            self.logger.info("Requesting officer standardization complete:")
            self.logger.info(
                f"  - {stats['entries_standardized']} entries standardized"
            )
            self.logger.info(
                f"  - {stats['officers_standardized']} officers standardized"
            )
            self.logger.info(
                f"  - {stats['badge_ids_removed']} badge IDs removed (PD47286)"
            )

            return {"status": "completed", "statistics": stats}

        except Exception as e:
            self.logger.error(
                f"Error during requesting officer standardization: {str(e)}"
            )
            return {"status": "error", "error": str(e)}

    def _generate_requesting_officer_standardization_report(
        self, stats: Dict, rules: Dict
    ) -> None:
        """Generate a report of the requesting officer standardization process"""
        report_path = (
            DOMAIN_PATH
            / "analysis"
            / "requesting_officer_standardization_application_report.md"
        )

        try:
            with open(report_path, "w") as f:
                f.write("# Requesting Officer Standardization Application Report\n\n")
                f.write(
                    f"**Date**: {pd.Timestamp.now().strftime('%Y-%m-%d %H:%M:%S')}\n"
                )
                f.write("**Status**: Completed Successfully\n\n")

                f.write("## Summary Statistics\n\n")
                f.write(f"- **Total Entries**: {stats['total_entries']:,}\n")
                f.write(f"- **Entries Processed**: {stats['entries_processed']:,}\n")
                f.write(
                    f"- **Entries Standardized**: {stats['entries_standardized']:,}\n"
                )
                f.write(
                    f"- **Officers Standardized**: {stats['officers_standardized']}\n"
                )
                f.write(
                    f"- **Badge IDs Removed**: {stats['badge_ids_removed']} (PD47286 conflicts)\n"
                )

                if stats["entries_processed"] > 0:
                    f.write(
                        f"- **Standardization Rate**: {(stats['entries_standardized']/stats['entries_processed']*100):.1f}%\n\n"
                    )
                else:
                    f.write("- **Standardization Rate**: 0.0%\n\n")

                f.write("## Standardization Details\n\n")

                if stats["standardization_details"]:
                    # Sort by entries affected (highest impact first)
                    sorted_details = sorted(
                        stats["standardization_details"].items(),
                        key=lambda x: x[1]["entries_affected"],
                        reverse=True,
                    )

                    for badge_id, details in sorted_details:
                        f.write(f"### {badge_id}\n")
                        f.write(
                            f"- **Standardized Name**: {details['standardized_name']}\n"
                        )
                        f.write(
                            f"- **Standardized Rank**: {details['standardized_rank']}\n"
                        )
                        f.write(
                            f"- **Entries Affected**: {details['entries_affected']:,}\n\n"
                        )
                else:
                    f.write("No officers required standardization.\n\n")

                f.write("## Special Cases\n\n")
                if stats["badge_ids_removed"] > 0:
                    f.write("### Badge ID Removal (PD47286)\n")
                    f.write(f"- **Entries Affected**: {stats['badge_ids_removed']}\n")
                    f.write("- **Reason**: Conflicting names for same badge ID\n")
                    f.write("- **Action**: Badge ID set to empty string\n")
                    f.write(
                        "- **Audit Trail**: Original badge ID preserved in processing_notes\n\n"
                    )

                f.write("## Implementation Notes\n\n")
                f.write(
                    "- Standardization applied only to successfully parsed entries\n"
                )
                f.write(
                    "- Original values preserved in processing_notes for audit trail\n"
                )
                f.write("- Only rules marked as 'ready: true' were applied\n")
                f.write("- PD47286 badge ID removed due to conflicting officer names\n")
                f.write(
                    "- Standardization details added to processing_notes for transparency\n"
                )

        except Exception as e:
            self.logger.error(
                f"Error generating requesting officer standardization report: {str(e)}"
            )

    def apply_organization_standardization(
        self, csv_file_path: str = None
    ) -> Dict[str, Any]:
        """
        Apply organization standardization rules to processed data.
        This is a post-processing step that runs after main ETL processing.

        Returns:
            Dict with standardization results and statistics
        """
        if csv_file_path is None:
            csv_file_path = "data/modded/8_police_officer.csv"

        standardization_file = (
            DOMAIN_PATH / "analysis" / "organization_standardization.json"
        )

        # Check if standardization rules exist and are ready
        if not standardization_file.exists():
            self.logger.warning(
                "Organization standardization rules not found - skipping standardization"
            )
            return {"status": "skipped", "reason": "no_rules_file"}

        try:
            with open(standardization_file, "r") as f:
                rules = json.load(f)

            # Check if rules are ready for implementation
            if not rules.get("ready", False):
                self.logger.warning(
                    "Organization standardization rules not ready - skipping standardization"
                )
                return {"status": "skipped", "reason": "rules_not_ready"}

            # Load existing organization standardization for exact matches
            existing_org_file = DOMAIN_PATH / "organisation_standardisation.json"
            existing_org_rules = {}
            if existing_org_file.exists():
                with open(existing_org_file, "r") as f:
                    existing_data = json.load(f)
                    # Create lookup dictionary: variant -> canonical
                    for entry in existing_data.get("entries", []):
                        canonical = entry.get("canonical", "")
                        for variant in entry.get("variants", []):
                            existing_org_rules[variant.lower()] = canonical

            # Load the processed data
            df = pd.read_csv(csv_file_path)

            # Track standardization statistics
            stats = {
                "total_entries": len(df),
                "entries_processed": 0,
                "entries_standardized": 0,
                "organizations_standardized": 0,
                "standardization_details": {},
            }

            self.logger.info(
                f"Applying organization standardization to {len(df)} entries..."
            )

            # Process each row
            for idx, row in df.iterrows():
                if pd.notna(row["processed_value"]):
                    try:
                        parsed = json.loads(row["processed_value"])
                        stats["entries_processed"] += 1

                        # Only standardize successfully parsed entries with organization data
                        if (
                            parsed.get("processing_notes", {}).get("reason")
                            == "successfully_parsed"
                            and parsed.get("organisation", "").strip()
                        ):

                            original_org = parsed["organisation"].strip()
                            original_org_lower = original_org.lower()
                            standardized_org = None

                            # First check existing organization standardization
                            if original_org_lower in existing_org_rules:
                                standardized_org = existing_org_rules[
                                    original_org_lower
                                ]

                            # Then check new standardization rules (only ready ones)
                            else:
                                for entry in rules.get("entries", []):
                                    if entry.get("ready", False):
                                        variants = entry.get("variants", [])
                                        if original_org_lower in variants:
                                            standardized_org = entry.get(
                                                "canonical", ""
                                            )
                                            break

                            # Apply standardization if found
                            if standardized_org and standardized_org != original_org:
                                # Update the parsed data
                                parsed["organisation"] = standardized_org

                                # Add standardization note
                                if (
                                    "standardization_applied"
                                    not in parsed["processing_notes"]
                                ):
                                    parsed["processing_notes"][
                                        "standardization_applied"
                                    ] = {}

                                parsed["processing_notes"]["standardization_applied"][
                                    "organisation"
                                ] = {
                                    "original_organization": original_org,
                                    "standardized_organization": standardized_org,
                                }

                                # Update the CSV data
                                df.at[idx, "processed_value"] = json.dumps(parsed)

                                stats["entries_standardized"] += 1

                                # Track standardization details
                                if original_org not in stats["standardization_details"]:
                                    stats["standardization_details"][original_org] = {
                                        "standardized_organization": standardized_org,
                                        "entries_affected": 0,
                                    }

                                stats["standardization_details"][original_org][
                                    "entries_affected"
                                ] += 1

                    except json.JSONDecodeError:
                        continue
                    except Exception as e:
                        self.logger.error(
                            f"Error processing row {idx} for organization standardization: {str(e)}"
                        )
                        continue

            # Count unique organizations standardized
            stats["organizations_standardized"] = len(stats["standardization_details"])

            # Save the updated data
            df.to_csv(csv_file_path, index=False)

            self.logger.info(
                f"Organization standardization completed: {stats['entries_standardized']} entries standardized"
            )

            # Generate standardization report
            self._generate_organization_standardization_report(stats)

            return {
                "status": "completed",
                "entries_standardized": stats["entries_standardized"],
                "organizations_standardized": stats["organizations_standardized"],
                "total_entries": stats["total_entries"],
            }

        except Exception as e:
            self.logger.error(f"Error in organization standardization: {str(e)}")
            return {"status": "error", "error": str(e)}

    def _generate_organization_standardization_report(self, stats: Dict):
        """Generate organization standardization report"""
        try:
            report_file = (
                DOMAIN_PATH
                / "analysis"
                / "organization_standardization_application_report.md"
            )

            with open(report_file, "w") as f:
                f.write("# Organization Standardization Application Report\n\n")
                f.write(
                    f"**Date**: {pd.Timestamp.now().strftime('%Y-%m-%d %H:%M:%S')}\n"
                )
                f.write("**Status**: Completed Successfully\n\n")

                f.write("## Summary Statistics\n\n")
                f.write(f"- **Total Entries**: {stats['total_entries']:,}\n")
                f.write(f"- **Entries Processed**: {stats['entries_processed']:,}\n")
                f.write(
                    f"- **Entries Standardized**: {stats['entries_standardized']:,}\n"
                )
                f.write(
                    f"- **Organizations Standardized**: {stats['organizations_standardized']}\n"
                )

                if stats["entries_processed"] > 0:
                    f.write(
                        f"- **Standardization Rate**: {(stats['entries_standardized']/stats['entries_processed']*100):.1f}%\n\n"
                    )
                else:
                    f.write("- **Standardization Rate**: 0.0%\n\n")

                f.write("## Standardization Details\n\n")

                if stats["standardization_details"]:
                    # Sort by entries affected (highest impact first)
                    sorted_details = sorted(
                        stats["standardization_details"].items(),
                        key=lambda x: x[1]["entries_affected"],
                        reverse=True,
                    )

                    for original_org, details in sorted_details:
                        f.write(f"### {original_org}\n")
                        f.write(
                            f"- **Standardized To**: {details['standardized_organization']}\n"
                        )
                        f.write(
                            f"- **Entries Affected**: {details['entries_affected']:,}\n\n"
                        )
                else:
                    f.write("No organizations required standardization.\n\n")

                f.write("## Implementation Notes\n\n")
                f.write(
                    "- Standardization applied only to successfully parsed entries\n"
                )
                f.write(
                    "- Original values preserved in processing_notes for audit trail\n"
                )
                f.write("- Only rules marked as 'ready: true' were applied\n")
                f.write(
                    "- Existing organization_standardisation.json rules applied first\n"
                )
                f.write(
                    "- New standardization rules applied for unmatched organizations\n"
                )
                f.write(
                    "- Standardization details added to processing_notes for transparency\n"
                )

        except Exception as e:
            self.logger.error(
                f"Error generating organization standardization report: {str(e)}"
            )

    @classmethod
    def analyze_processing_results(cls, csv_file_path: str = None):  # noqa: F811
        """Class method to analyze processing results and identify issues"""
        processor = cls()
        return processor.error_analyzer.analyze_processing_results(
            csv_file_path or "data/modded/8_police_officer.csv"
        )


def apply_corrections_to_officer_data(row_id: int, police_officer_json: str) -> str:
    """
    Apply rank/name field corrections to police officer data

    This function should be called early in the processing pipeline,
    before standard parsing logic.

    Args:
        row_id: Row identifier from the dataset
        police_officer_json: JSON string of police officer data

    Returns:
        Corrected JSON string
    """
    try:
        # Parse the JSON
        officer_data = json.loads(police_officer_json)

        # Apply corrections
        corrected_data, stats = apply_rank_name_corrections(row_id, officer_data)

        # Log corrections if any were applied
        if stats["total_corrections"] > 0:
            print(
                f"Row {row_id}: Applied {stats['total_corrections']} corrections to {stats['corrections_applied']}"
            )

        # Return corrected JSON
        return json.dumps(corrected_data)

    except Exception as e:
        # If correction fails, return original data
        print(f"Row {row_id}: Correction failed: {e}")
        return police_officer_json


# For ETL integration
def process_value(value: Any, row_id: int, logger) -> str:
    """ETL integration function with rank/name corrections"""
    processor = PoliceOfficerProcessor()

    # First, do the standard processing
    result = processor.process_value(value, row_id, logger)

    # Then apply rank/name corrections if processing was successful
    try:
        # Parse the result to check if it's valid JSON
        parsed_result = json.loads(result)

        # Only apply corrections if parsing was successful
        if (
            parsed_result.get("processing_notes", {}).get("reason")
            == "successfully_parsed"
        ):
            corrected_result = apply_corrections_to_officer_data(row_id, result)
            return corrected_result
        else:
            # Return original result if parsing failed
            return result

    except Exception as e:
        # If correction fails, return original result
        if logger:
            logger.debug(f"Row {row_id}: Correction failed: {e}")
        return result


def post_process_police_officer_data(csv_file_path: str = None) -> Dict[str, Any]:
    """
    Post-processing function for police officer data.
    This runs after main ETL processing to apply standardization rules.

    Args:
        csv_file_path: Path to the processed CSV file (defaults to data/modded/8_police_officer.csv)

    Returns:
        Dict with post-processing results and statistics
    """
    processor = PoliceOfficerProcessor()

    # Apply submitting officer standardization
    standardization_result = processor.apply_submitting_officer_standardization(
        csv_file_path
    )

    # Apply requesting officer standardization
    requesting_standardization_result = (
        processor.apply_requesting_officer_standardization(csv_file_path)
    )

    # Apply organization standardization
    organization_standardization_result = processor.apply_organization_standardization(
        csv_file_path
    )

    # Future post-processing steps can be added here:
    # - Badge ID consistency validation

    return {
        "submitting_officer_standardization": standardization_result,
        "requesting_officer_standardization": requesting_standardization_result,
        "organization_standardization": organization_standardization_result,
        "status": (
            "completed"
            if all(
                result.get("status") == "completed"
                for result in [
                    standardization_result,
                    requesting_standardization_result,
                    organization_standardization_result,
                ]
            )
            else "partial"
        ),
    }


def post_process():
    """
    ETL orchestrator integration function for post-processing.
    This function is called automatically by the ETL orchestrator after domain processing.
    """
    logger = logging.getLogger(__name__)
    logger.info("Starting police officer domain post-processing...")

    try:
        result = post_process_police_officer_data()

        if result["status"] == "completed":
            logger.info("Police officer post-processing completed successfully")

            # Log standardization statistics if available
            if "submitting_officer_standardization" in result:
                std_result = result["submitting_officer_standardization"]
                if std_result.get("status") == "completed":
                    logger.info(
                        f"Submitting officer standardization: {std_result.get('entries_standardized', 0)} entries, {std_result.get('officers_standardized', 0)} officers"
                    )
                elif std_result.get("status") == "skipped":
                    logger.info(
                        f"Submitting officer standardization skipped: {std_result.get('reason', 'unknown')}"
                    )
                else:
                    logger.warning(
                        f"Submitting officer standardization status: {std_result.get('status', 'unknown')}"
                    )

            # Log requesting officer standardization statistics
            if "requesting_officer_standardization" in result:
                std_result = result["requesting_officer_standardization"]
                if std_result.get("status") == "completed":
                    logger.info(
                        f"Requesting officer standardization: {std_result.get('entries_standardized', 0)} entries, {std_result.get('officers_standardized', 0)} officers"
                    )
                elif std_result.get("status") == "skipped":
                    logger.info(
                        f"Requesting officer standardization skipped: {std_result.get('reason', 'unknown')}"
                    )
                else:
                    logger.warning(
                        f"Requesting officer standardization status: {std_result.get('status', 'unknown')}"
                    )

            # Log organization standardization statistics
            if "organization_standardization" in result:
                std_result = result["organization_standardization"]
                if std_result.get("status") == "completed":
                    logger.info(
                        f"Organization standardization: {std_result.get('entries_standardized', 0)} entries, {std_result.get('organizations_standardized', 0)} organizations"
                    )
                elif std_result.get("status") == "skipped":
                    logger.info(
                        f"Organization standardization skipped: {std_result.get('reason', 'unknown')}"
                    )
                else:
                    logger.warning(
                        f"Organization standardization status: {std_result.get('status', 'unknown')}"
                    )
        else:
            logger.warning(
                f"Police officer post-processing completed with status: {result['status']}"
            )

    except Exception as e:
        logger.error(f"Error in police officer post-processing: {str(e)}")
        raise
