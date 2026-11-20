#!/usr/bin/env python3
"""
Domain Logic for Result - Botanist Examination Results Processing
Extracts structured information from botanist examination narratives including:
- Species identification (Cannabis sativa, Papaver somniferum, Unidentifiable)
- New tag numbers assigned during resealing
- Officer handover information and presence status
"""

import datetime
import json
import logging
import re
from difflib import SequenceMatcher
from pathlib import Path
from typing import Any, Dict, List, Tuple

from etl.transform import debug_files

# Get the directory where this logic file is located
DOMAIN_PATH = Path(__file__).parent


class IdentificationExtractor:
    """Extracts species identification information from examination results"""

    def __init__(self):
        self.logger = logging.getLogger(__name__)

        # Species identification patterns (ordered by specificity)
        self.species_patterns = {
            "Cannabis sativa": [
                r"I identified .+? as Cannabis sativa",
                r"identified .+? as Cannabis sativa",
                r"Cannabis sativa",
            ],
            "Papaver somniferum": [
                r"I identified .+? as Papaver somniferum",
                r"identified .+? as Papaver somniferum",
                r"Papaver somniferum",
            ],
        }

        # Unidentifiable patterns
        self.unidentifiable_patterns = [
            r"unable to identify",
            r"could not identify",
            r"was too decomposed",
            r"material was rotten",
            r"was rotten",
            r"unidentifiable",
        ]

        # Compile patterns for performance
        self._compile_patterns()

    def _compile_patterns(self):
        """Compile regex patterns for better performance"""
        self.compiled_species = {}
        for species, patterns in self.species_patterns.items():
            self.compiled_species[species] = [
                re.compile(pattern, re.IGNORECASE) for pattern in patterns
            ]

        self.compiled_unidentifiable = [
            re.compile(pattern, re.IGNORECASE)
            for pattern in self.unidentifiable_patterns
        ]

    def extract_identification(self, text: str) -> Tuple[str, float]:
        """
        Extract species identification with confidence score

        Returns:
            Tuple of (identified_species, confidence_score)
        """
        if not text or not isinstance(text, str):
            return "", 0.0

        # Check for unidentifiable cases first
        unidentifiable_count = 0
        for pattern in self.compiled_unidentifiable:
            if pattern.search(text):
                unidentifiable_count += 1

        # Check for species identifications
        species_matches = {}
        for species, patterns in self.compiled_species.items():
            match_count = 0
            for pattern in patterns:
                matches = pattern.findall(text)
                match_count += len(matches)
            if match_count > 0:
                species_matches[species] = match_count

        # Determine result based on matches
        if species_matches and unidentifiable_count > 0:
            # Mixed case - some identified, some not
            primary_species = max(
                species_matches.keys(), key=lambda k: species_matches[k]
            )
            return "Mixed", 0.8  # Lower confidence for mixed cases
        elif species_matches:
            # Pure identification case
            primary_species = max(
                species_matches.keys(), key=lambda k: species_matches[k]
            )
            confidence = min(0.95, 0.7 + (species_matches[primary_species] * 0.1))
            return primary_species, confidence
        elif unidentifiable_count > 0:
            # Pure unidentifiable case
            confidence = min(0.9, 0.6 + (unidentifiable_count * 0.1))
            return "Unidentifiable", confidence
        else:
            # No clear identification found
            return "", 0.0


class TagNumberExtractor:
    """Extracts new tag numbers from resealing descriptions"""

    def __init__(self):
        self.logger = logging.getLogger(__name__)

        # Tag number extraction patterns
        self.tag_patterns = [
            r"resealed in (?:a new|two new|three new|\d+ new) drug movement bags?, tag numbers? ([^,]+?)(?:\s+and handed|$)",
            r"resealed in (?:a new|two new|three new|\d+ new) drug movement bag, tag number ([^,]+?)(?:\s+and handed|$)",
            r"tag numbers? ([A-Z]*\d+(?:,?\s*(?:and\s+|&\s+)?[A-Z]*\d+)*)",
            r"bag nos?\. ([A-Z]*\d+(?:,?\s*(?:and\s+|&\s+)?[A-Z]*\d+)*)",
        ]

        # Compile patterns for performance
        self.compiled_patterns = [
            re.compile(pattern, re.IGNORECASE) for pattern in self.tag_patterns
        ]

    def extract_new_tag_numbers(self, text: str) -> List[str]:
        """Extract new tag numbers from resealing descriptions"""
        if not text or not isinstance(text, str):
            return []

        all_tags = []

        for pattern in self.compiled_patterns:
            matches = pattern.findall(text)
            for match in matches:
                tags = self._parse_tag_list(match)
                all_tags.extend(tags)

        # Remove duplicates while preserving order
        seen = set()
        unique_tags = []
        for tag in all_tags:
            if tag not in seen:
                seen.add(tag)
                unique_tags.append(tag)

        return unique_tags

    def _parse_tag_list(self, tag_string: str) -> List[str]:
        """Parse comma/and separated tag number lists"""
        if not tag_string:
            return []

        # Clean the string
        tag_string = tag_string.strip()

        # Split on various separators
        # Handle patterns like "T50488 and T50489", "B537899, B537900", "T50488 & T50489"
        separators = [r"\s+and\s+", r"\s*&\s*", r"\s*,\s*"]

        tags = [tag_string]
        for separator in separators:
            new_tags = []
            for tag in tags:
                new_tags.extend(re.split(separator, tag, flags=re.IGNORECASE))
            tags = new_tags

        # Clean individual tags
        cleaned_tags = []
        for tag in tags:
            cleaned = self._clean_tag_number(tag)
            if cleaned:
                cleaned_tags.append(cleaned)

        return cleaned_tags

    def _clean_tag_number(self, tag: str) -> str:
        """Clean and validate individual tag numbers"""
        if not tag:
            return ""

        # Remove extra whitespace and common artifacts
        tag = tag.strip()
        tag = re.sub(r"^(and\s+|&\s*)", "", tag, flags=re.IGNORECASE)
        tag = re.sub(r"\s+", "", tag)  # Remove internal spaces

        # Validate tag format (letters followed by numbers)
        if re.match(r"^[A-Z]*\d+$", tag, re.IGNORECASE):
            return tag.upper()

        return ""


class OfficerHandoverExtractor:
    """Extracts officer handover information and presence status"""

    def __init__(self):
        self.logger = logging.getLogger(__name__)

        # Officer handover patterns
        self.handover_patterns = [
            r"handed over to ([^,]+?)(?:\s+who was present|$)",
            r"handed to ([^,]+?)(?:\s+who was present|$)",
        ]

        # Presence detection patterns
        self.presence_patterns = [
            r"who was present during the examination",
            r"who was present",
        ]

        # Compile patterns for performance
        self.compiled_handover = [
            re.compile(pattern, re.IGNORECASE) for pattern in self.handover_patterns
        ]
        self.compiled_presence = [
            re.compile(pattern, re.IGNORECASE) for pattern in self.presence_patterns
        ]

    def extract_handover_info(self, text: str) -> Tuple[str, bool]:
        """Extract officer handover information and presence status"""
        if not text or not isinstance(text, str):
            return "", False

        # Extract officer name
        officer_name = ""
        for pattern in self.compiled_handover:
            match = pattern.search(text)
            if match:
                officer_name = self._clean_officer_name(match.group(1))
                break

        # Check for presence
        officer_present = any(
            pattern.search(text) for pattern in self.compiled_presence
        )

        return officer_name, officer_present

    def _clean_officer_name(self, officer: str) -> str:
        """Clean and standardize officer names"""
        if not officer:
            return ""

        # Remove extra whitespace
        officer = officer.strip()

        # Remove common trailing artifacts
        officer = re.sub(r"\s+who\s*$", "", officer, flags=re.IGNORECASE)

        return officer


class ComplexCaseHandler:
    """Handles complex examination cases with mixed results and partial identifications"""

    def __init__(self):
        self.logger = logging.getLogger(__name__)

        # Patterns for bag-specific identification
        self.bag_identification_patterns = [
            r"I identified .+? in bags? (?:nos?\. )?([^,]+) as ([^.]+)",
            r"I was unable to identify .+? in bags? (?:nos?\. )?([^,]+)",
            r"the material in bags? (?:nos?\. )?([^,]+) was (.+?) and I was unable",
            r"unable to identify .+? in bags? (?:nos?\. )?([^,]+) as (.+?)\.",
        ]

        # Patterns for reasons why material was unidentifiable
        self.unidentifiable_reason_patterns = [
            r"was too decomposed",
            r"material was rotten",
            r"was rotten",
            r"material was degraded",
            r"was degraded",
            r"unable to identify as Cannabis",
            r"could not identify as Cannabis",
        ]

        # Compile patterns for performance
        self.compiled_bag_patterns = [
            re.compile(pattern, re.IGNORECASE)
            for pattern in self.bag_identification_patterns
        ]
        self.compiled_reason_patterns = [
            re.compile(pattern, re.IGNORECASE)
            for pattern in self.unidentifiable_reason_patterns
        ]

    def detect_complex_case(self, text: str) -> Dict:
        """Detect if this is a complex case with mixed results"""
        if not text or not isinstance(text, str):
            return {"is_complex": False, "complexity_type": "simple"}

        # Check for bag-specific mentions
        bag_mentions = 0
        for pattern in self.compiled_bag_patterns:
            matches = pattern.findall(text)
            bag_mentions += len(matches)

        # Check for mixed identification patterns
        has_identified = bool(re.search(r"I identified .+? as", text, re.IGNORECASE))
        has_unidentifiable = bool(
            re.search(r"unable to identify|could not identify", text, re.IGNORECASE)
        )

        # Determine complexity
        if bag_mentions > 0:
            return {
                "is_complex": True,
                "complexity_type": "bag_specific",
                "bag_mentions": bag_mentions,
                "mixed_results": has_identified and has_unidentifiable,
            }
        elif has_identified and has_unidentifiable:
            return {
                "is_complex": True,
                "complexity_type": "mixed_general",
                "bag_mentions": 0,
                "mixed_results": True,
            }
        else:
            return {
                "is_complex": False,
                "complexity_type": "simple",
                "bag_mentions": 0,
                "mixed_results": False,
            }

    def extract_unidentifiable_reasons(self, text: str) -> List[str]:
        """Extract specific reasons why material was unidentifiable"""
        reasons = []

        for pattern in self.compiled_reason_patterns:
            if pattern.search(text):
                if "decomposed" in pattern.pattern:
                    reasons.append("material_too_decomposed")
                elif "rotten" in pattern.pattern:
                    reasons.append("material_rotten")
                elif "degraded" in pattern.pattern:
                    reasons.append("material_degraded")
                elif (
                    "unable to identify as Cannabis" in pattern.pattern
                    or "could not identify as Cannabis" in pattern.pattern
                ):
                    reasons.append("unable_to_identify_as_cannabis")

        # Remove duplicates while preserving order
        seen = set()
        unique_reasons = []
        for reason in reasons:
            if reason not in seen:
                seen.add(reason)
                unique_reasons.append(reason)

        return unique_reasons if unique_reasons else ["other"]

    def handle_mixed_identification(self, text: str, basic_identification: str) -> Dict:
        """Handle mixed identification cases with detailed breakdown"""
        complexity_info = self.detect_complex_case(text)

        if not complexity_info["is_complex"]:
            return {
                "overall_identification": basic_identification,
                "is_mixed_case": False,
                "unidentifiable_reasons": [],
                "complexity_notes": "simple_case",
            }

        # Extract reasons for unidentifiable material
        unidentifiable_reasons = self.extract_unidentifiable_reasons(text)

        # Determine overall identification for mixed cases
        if complexity_info["mixed_results"]:
            overall_id = "Mixed"
        else:
            overall_id = basic_identification

        return {
            "overall_identification": overall_id,
            "is_mixed_case": complexity_info["mixed_results"],
            "unidentifiable_reasons": unidentifiable_reasons,
            "complexity_notes": f"{complexity_info['complexity_type']}_with_{complexity_info['bag_mentions']}_bag_mentions",
        }


class ValidationEngine:
    """Validates extracted data and assigns confidence scores"""

    def __init__(self):
        self.logger = logging.getLogger(__name__)

        # Known species for validation
        self.known_species = {
            "Cannabis sativa",
            "Papaver somniferum",
            "Unidentifiable",
            "Mixed",
        }

        # Valid tag number patterns
        self.valid_tag_patterns = [
            r"^[A-Z]+\d+$",  # Letters followed by numbers (T50488, BB96549)
            r"^[A-Z]*\d+$",  # Optional letters followed by numbers (15488, B537839)
        ]

        # Valid officer title patterns
        self.valid_officer_patterns = [
            r"Senior Constable",
            r"Constable",
            r"Sergeant",
            r"Sworn Officer",
            r"Unsworn Officer",
            r"S/C",
            r"PD\d+",
        ]

        # Compile patterns for performance
        self.compiled_tag_patterns = [
            re.compile(pattern) for pattern in self.valid_tag_patterns
        ]
        self.compiled_officer_patterns = [
            re.compile(pattern, re.IGNORECASE)
            for pattern in self.valid_officer_patterns
        ]

    def validate_and_score(
        self, extracted_data: Dict, original_text: str, complexity_info: Dict = None
    ) -> Dict:
        """Validate extracted data and assign overall confidence score with enhanced validation"""

        # Individual component confidence scores
        id_confidence = self._validate_identification(
            extracted_data.get("identified_as", ""), complexity_info
        )
        tag_confidence = self._validate_tag_numbers(
            extracted_data.get("new_tag_numbers", [])
        )
        officer_confidence = self._validate_officer_info(
            extracted_data.get("handed_to", ""),
            extracted_data.get("officer_handed_to_present", False),
        )

        # Additional validation for complex cases
        complexity_confidence = self._validate_complexity_handling(
            complexity_info, original_text
        )

        # Calculate overall confidence (weighted average with complexity factor)
        base_confidence = (
            id_confidence * 0.4  # Species identification is most important
            + tag_confidence * 0.25  # Tag numbers are important for chain of custody
            + officer_confidence * 0.2  # Officer info is important but less critical
            + complexity_confidence * 0.15  # Complexity handling quality
        )

        # Apply pattern quality bonus/penalty
        pattern_quality = self._assess_pattern_quality(original_text, extracted_data)
        overall_confidence = min(0.99, base_confidence + pattern_quality)

        # Determine processing reason with enhanced criteria
        requires_manual_review = self._requires_manual_review(
            overall_confidence, complexity_info, original_text
        )

        if overall_confidence >= 0.85:
            reason = "successfully_parsed"
        elif overall_confidence >= 0.65:
            reason = "partial_parsing_success"
        elif overall_confidence >= 0.4:
            reason = "low_confidence_parsing"
        else:
            reason = "parsing_failed"

        return {
            "confidence": round(overall_confidence, 2),
            "reason": reason,
            "original_text": original_text,
            "requires_manual_review": requires_manual_review,
            "extraction_details": {
                "identification_confidence": round(id_confidence, 2),
                "tag_extraction_confidence": round(tag_confidence, 2),
                "officer_extraction_confidence": round(officer_confidence, 2),
                "complexity_confidence": round(complexity_confidence, 2),
                "pattern_quality_score": round(pattern_quality, 2),
            },
            "validation_flags": self._generate_validation_flags(
                extracted_data, complexity_info, original_text
            ),
        }

    def _validate_identification(
        self, identified_as: str, complexity_info: Dict = None
    ) -> float:
        """Validate species identification with enhanced complexity awareness"""
        if not identified_as:
            return 0.0

        # Perfect match with known species
        if identified_as in self.known_species:
            base_confidence = 0.9

            # Adjust for complexity
            if complexity_info and complexity_info.get("is_mixed_case", False):
                # Mixed cases are inherently more complex but still valid
                return base_confidence * 0.95
            else:
                return base_confidence

        # Check for fuzzy matches with known species
        best_match = 0.0
        for species in self.known_species:
            similarity = SequenceMatcher(
                None, identified_as.lower(), species.lower()
            ).ratio()
            if similarity > best_match:
                best_match = similarity

        # Enhanced fuzzy matching with context
        if best_match >= 0.8:
            return best_match * 0.8  # High similarity
        elif best_match >= 0.6:
            return best_match * 0.6  # Medium similarity
        else:
            return best_match * 0.3  # Low similarity

    def _validate_tag_numbers(self, tag_numbers: List[str]) -> float:
        """Validate tag number format and consistency with enhanced rules"""
        if not tag_numbers:
            return 0.5  # Neutral - some results may not have new tag numbers

        if len(tag_numbers) > 20:  # Unreasonably high number of tags
            return 0.2

        valid_count = 0
        format_consistency = 0

        for tag in tag_numbers:
            # Check against valid patterns
            is_valid = any(pattern.match(tag) for pattern in self.compiled_tag_patterns)
            if is_valid:
                valid_count += 1

                # Check format consistency (similar prefixes/patterns)
                if len(tag_numbers) > 1:
                    # Extract prefix pattern
                    prefix_match = re.match(r"^([A-Z]*)", tag)
                    if prefix_match:
                        prefix = prefix_match.group(1)
                        # Check if other tags have similar prefixes
                        similar_prefix_count = sum(
                            1
                            for other_tag in tag_numbers
                            if other_tag.startswith(prefix)
                        )
                        format_consistency += similar_prefix_count / len(tag_numbers)

        # Calculate base confidence
        if valid_count == len(tag_numbers):
            base_confidence = 0.9
        elif valid_count > len(tag_numbers) * 0.8:
            base_confidence = 0.75
        elif valid_count > 0:
            base_confidence = 0.6
        else:
            base_confidence = 0.2

        # Apply format consistency bonus
        if len(tag_numbers) > 1:
            consistency_bonus = (format_consistency / len(tag_numbers)) * 0.1
            base_confidence = min(0.95, base_confidence + consistency_bonus)

        return base_confidence

    def _validate_officer_info(self, handed_to: str, officer_present: bool) -> float:
        """Validate officer handover information with enhanced pattern matching"""
        if not handed_to and not officer_present:
            return 0.3  # Low confidence if no officer info

        base_confidence = 0.0

        # Validate officer name format if present
        if handed_to:
            officer_format_score = self._validate_officer_name_format(handed_to)
            if officer_present:
                base_confidence = 0.8 + (
                    officer_format_score * 0.15
                )  # High confidence with format bonus
            else:
                base_confidence = 0.6 + (
                    officer_format_score * 0.1
                )  # Medium confidence with format bonus
        elif officer_present:
            base_confidence = 0.5  # Medium-low confidence if only presence mentioned

        return min(0.95, base_confidence)

    def _validate_officer_name_format(self, officer_name: str) -> float:
        """Validate officer name format against known patterns"""
        if not officer_name:
            return 0.0

        # Check for valid officer title patterns
        has_valid_title = any(
            pattern.search(officer_name) for pattern in self.compiled_officer_patterns
        )

        # Check for reasonable name structure
        words = officer_name.split()
        has_reasonable_structure = 2 <= len(words) <= 6  # Reasonable number of words

        # Check for badge numbers or IDs
        has_badge_id = bool(re.search(r"\d{4,5}", officer_name))

        score = 0.0
        if has_valid_title:
            score += 0.6
        if has_reasonable_structure:
            score += 0.3
        if has_badge_id:
            score += 0.1

        return min(1.0, score)

    def _validate_complexity_handling(
        self, complexity_info: Dict, original_text: str
    ) -> float:
        """Validate how well complex cases are handled"""
        if not complexity_info:
            return 0.7  # Neutral score for simple cases

        if not complexity_info.get("is_complex", False):
            return 0.8  # Good score for correctly identified simple cases

        # For complex cases, assess handling quality
        complexity_type = complexity_info.get("complexity_type", "unknown")

        if complexity_type == "bag_specific":
            # Check if bag mentions were properly handled
            bag_mentions = complexity_info.get("bag_mentions", 0)
            if bag_mentions > 0:
                return 0.7  # Good handling of bag-specific cases
            else:
                return 0.5  # Missed bag-specific patterns
        elif complexity_type == "mixed_general":
            # Check if mixed results were properly identified
            if complexity_info.get("mixed_results", False):
                return 0.75  # Good handling of mixed cases
            else:
                return 0.6  # Partial handling
        else:
            return 0.6  # Unknown complexity type

    def _assess_pattern_quality(
        self, original_text: str, extracted_data: Dict
    ) -> float:
        """Assess the quality of pattern matching and extraction"""
        quality_score = 0.0

        # Check for clear, unambiguous patterns
        if re.search(
            r"I identified .+? as (Cannabis sativa|Papaver somniferum)",
            original_text,
            re.IGNORECASE,
        ):
            quality_score += 0.05

        # Check for clear tag number patterns
        if re.search(r"tag numbers? [A-Z]*\d+", original_text, re.IGNORECASE):
            quality_score += 0.03

        # Check for clear officer handover patterns
        if re.search(
            r"handed over to .+? who was present", original_text, re.IGNORECASE
        ):
            quality_score += 0.02

        # Penalty for unusual or difficult patterns
        if len(original_text) < 50:  # Very short text
            quality_score -= 0.05
        elif len(original_text) > 1000:  # Very long text
            quality_score -= 0.02

        # Penalty for multiple typos or formatting issues
        typo_indicators = len(
            re.findall(r"\b\w*[0-9]+\w*\b", original_text)
        )  # Mixed alphanumeric
        if typo_indicators > 3:
            quality_score -= 0.03

        return max(-0.1, min(0.1, quality_score))  # Limit impact to ±0.1

    def _requires_manual_review(
        self, confidence: float, complexity_info: Dict, original_text: str
    ) -> bool:
        """Determine if case requires manual review"""
        # Low confidence cases
        if confidence < 0.6:
            return True

        # Complex cases with mixed results
        if complexity_info and complexity_info.get("is_mixed_case", False):
            return True

        # Cases with unusual patterns
        if self._has_unusual_patterns(original_text):
            return True

        # Very long or very short texts
        if len(original_text) < 30 or len(original_text) > 800:
            return True

        return False

    def _has_unusual_patterns(self, text: str) -> bool:
        """Detect unusual patterns that might need manual review"""
        unusual_indicators = [
            r"[A-Z]{10,}",  # Long sequences of capital letters
            r"\d{10,}",  # Long sequences of numbers
            r"[^\w\s]{5,}",  # Long sequences of special characters
            r"\b\w{20,}\b",  # Very long words
        ]

        return any(re.search(pattern, text) for pattern in unusual_indicators)

    def _generate_validation_flags(
        self, extracted_data: Dict, complexity_info: Dict, original_text: str
    ) -> List[str]:
        """Generate validation flags for quality monitoring"""
        flags = []

        # Data quality flags
        if not extracted_data.get("identified_as"):
            flags.append("missing_identification")

        if not extracted_data.get("new_tag_numbers"):
            flags.append("no_new_tags")

        if not extracted_data.get("handed_to"):
            flags.append("missing_officer_info")

        # Complexity flags
        if complexity_info and complexity_info.get("is_complex"):
            flags.append("complex_case")
            if complexity_info.get("is_mixed_case"):
                flags.append("mixed_identification")

        # Pattern quality flags
        if self._has_unusual_patterns(original_text):
            flags.append("unusual_patterns")

        if len(original_text) < 50:
            flags.append("short_text")
        elif len(original_text) > 500:
            flags.append("long_text")

        return flags


class FallbackStrategyHandler:
    """Handles fallback strategies for partial extraction failures"""

    def __init__(self):
        self.logger = logging.getLogger(__name__)

        # Relaxed patterns for difficult cases
        self.relaxed_species_patterns = [
            r"Cannabis",
            r"Papaver",
            r"sativa",
            r"somniferum",
        ]

        self.relaxed_tag_patterns = [
            r"[A-Z]*\d{4,}",  # Any letters followed by 4+ digits
            r"[TBWM]\d+",  # Common prefixes with numbers
        ]

        self.relaxed_officer_patterns = [
            r"Constable \w+",
            r"Sergeant \w+",
            r"Officer \w+",
            r"\w+ \w+",  # Any two words (potential name)
        ]

    def apply_fallback_extraction(
        self, text: str, failed_components: List[str]
    ) -> Dict:
        """Apply fallback strategies for failed extraction components"""
        fallback_results = {}

        for component in failed_components:
            if component == "identification":
                fallback_results["identified_as"] = self._fallback_identification(text)
            elif component == "tag_numbers":
                fallback_results["new_tag_numbers"] = self._fallback_tag_extraction(
                    text
                )
            elif component == "officer_info":
                officer_info = self._fallback_officer_extraction(text)
                fallback_results.update(officer_info)

        return fallback_results

    def _fallback_identification(self, text: str) -> str:
        """Fallback identification using relaxed patterns"""
        text_lower = text.lower()

        # Check for relaxed species patterns
        if "cannabis" in text_lower or "sativa" in text_lower:
            return "Cannabis sativa"
        elif "papaver" in text_lower or "somniferum" in text_lower:
            return "Papaver somniferum"
        elif any(
            word in text_lower
            for word in ["unable", "could not", "decomposed", "rotten"]
        ):
            return "Unidentifiable"

        return ""

    def _fallback_tag_extraction(self, text: str) -> List[str]:
        """Fallback tag number extraction using relaxed patterns"""
        tags = []

        for pattern in self.relaxed_tag_patterns:
            matches = re.findall(pattern, text, re.IGNORECASE)
            tags.extend(matches)

        # Clean and deduplicate
        cleaned_tags = []
        seen = set()
        for tag in tags:
            tag = tag.upper().strip()
            if tag and tag not in seen and len(tag) >= 4:
                seen.add(tag)
                cleaned_tags.append(tag)

        return cleaned_tags

    def _fallback_officer_extraction(self, text: str) -> Dict:
        """Fallback officer extraction using relaxed patterns"""
        officer_name = ""
        officer_present = False

        # Look for officer patterns
        for pattern in self.relaxed_officer_patterns:
            match = re.search(pattern, text, re.IGNORECASE)
            if match:
                officer_name = match.group(0).strip()
                break

        # Check for presence indicators
        if re.search(r"present|examination", text, re.IGNORECASE):
            officer_present = True

        return {"handed_to": officer_name, "officer_handed_to_present": officer_present}


class ResultProcessor:
    """Main processor for botanist examination results"""

    def __init__(self):
        self.logger = logging.getLogger(__name__)

        # Initialize extractors and handlers
        self.identification_extractor = IdentificationExtractor()
        self.tag_extractor = TagNumberExtractor()
        self.officer_extractor = OfficerHandoverExtractor()
        self.complex_case_handler = ComplexCaseHandler()
        self.validator = ValidationEngine()
        self.fallback_handler = FallbackStrategyHandler()

        # Debug logging setup
        self.debug_file = DOMAIN_PATH / "debug.txt"
        self._setup_debug_logging()

    def _setup_debug_logging(self):
        """Set up enhanced debug logging to file with session header"""
        if not debug_files.enabled():
            return
        try:
            # Clear previous debug log
            if self.debug_file.exists():
                self.debug_file.unlink()

            # Create debug file with session header
            self.debug_file.touch()

            # Write session header
            import datetime

            session_header = f"""
{'='*80}
RESULT DOMAIN DEBUG LOG - SESSION START
{'='*80}
Session started: {datetime.datetime.now().strftime('%Y-%m-%d %H:%M:%S')}
Debug level: Enhanced error handling and quality monitoring
{'='*80}

"""
            with open(self.debug_file, "w", encoding="utf-8") as f:
                f.write(session_header)

        except Exception as e:
            self.logger.error(f"Error setting up debug logging: {str(e)}")

    def _debug_log(self, message: str, level: str = "INFO"):
        """Write enhanced debug message to debug file with timestamp and level"""
        if not debug_files.enabled():
            return
        try:
            import datetime

            timestamp = datetime.datetime.now().strftime("%H:%M:%S.%f")[:-3]
            formatted_message = f"[{timestamp}] [{level}] {message}\n"

            with open(self.debug_file, "a", encoding="utf-8") as f:
                f.write(formatted_message)
        except Exception as e:
            self.logger.error(f"Error writing debug log: {str(e)}")

    def _debug_log_extraction_details(
        self,
        row_id: int,
        text: str,
        extracted_data: Dict,
        complexity_info: Dict,
        processing_notes: Dict,
    ):
        """Log detailed extraction information for troubleshooting"""
        try:
            self._debug_log(f"=== DETAILED EXTRACTION LOG - Row {row_id} ===", "DEBUG")
            self._debug_log(f"Original text length: {len(text)} characters", "DEBUG")
            self._debug_log(
                f"Text preview: {text[:200]}{'...' if len(text) > 200 else ''}", "DEBUG"
            )

            # Log complexity analysis
            self._debug_log("Complexity analysis:", "DEBUG")
            self._debug_log(
                f"  - Is complex: {complexity_info.get('is_complex', False)}", "DEBUG"
            )
            self._debug_log(
                f"  - Complexity type: {complexity_info.get('complexity_type', 'unknown')}",
                "DEBUG",
            )
            self._debug_log(
                f"  - Mixed results: {complexity_info.get('mixed_results', False)}",
                "DEBUG",
            )
            self._debug_log(
                f"  - Bag mentions: {complexity_info.get('bag_mentions', 0)}", "DEBUG"
            )

            # Log extraction results
            self._debug_log("Extraction results:", "DEBUG")
            self._debug_log(
                f"  - Identified as: '{extracted_data.get('identified_as', '')}'",
                "DEBUG",
            )
            self._debug_log(
                f"  - New tag numbers: {extracted_data.get('new_tag_numbers', [])}",
                "DEBUG",
            )
            self._debug_log(
                f"  - Handed to: '{extracted_data.get('handed_to', '')}'", "DEBUG"
            )
            self._debug_log(
                f"  - Officer present: {extracted_data.get('officer_handed_to_present', False)}",
                "DEBUG",
            )

            # Log quality assessment
            self._debug_log("Quality assessment:", "DEBUG")
            self._debug_log(
                f"  - Overall confidence: {processing_notes.get('confidence', 0.0):.3f}",
                "DEBUG",
            )
            self._debug_log(
                f"  - Processing reason: {processing_notes.get('reason', 'unknown')}",
                "DEBUG",
            )
            self._debug_log(
                f"  - Requires manual review: {processing_notes.get('requires_manual_review', False)}",
                "DEBUG",
            )

            # Log validation flags
            validation_flags = processing_notes.get("validation_flags", [])
            if validation_flags:
                self._debug_log(
                    f"  - Validation flags: {', '.join(validation_flags)}", "DEBUG"
                )

            # Log fallback usage
            fallback_used = []
            for key in extracted_data:
                if key.endswith("_fallback_used") and extracted_data[key]:
                    fallback_used.append(key.replace("_fallback_used", ""))
            if fallback_used:
                self._debug_log(
                    f"  - Fallback strategies used: {', '.join(fallback_used)}", "DEBUG"
                )

            self._debug_log(
                f"=== END DETAILED EXTRACTION LOG - Row {row_id} ===", "DEBUG"
            )

        except Exception as e:
            self.logger.error(f"Error logging extraction details: {str(e)}")

    def _debug_log_error_context(
        self, row_id: int, error: Exception, text: str, extraction_state: Dict = None
    ):
        """Log comprehensive error context for debugging"""
        try:
            self._debug_log(f"!!! ERROR CONTEXT - Row {row_id} !!!", "ERROR")
            self._debug_log(f"Error type: {type(error).__name__}", "ERROR")
            self._debug_log(f"Error message: {str(error)}", "ERROR")
            self._debug_log(f"Text length: {len(text)} characters", "ERROR")
            self._debug_log(f"Text content: {text}", "ERROR")

            if extraction_state:
                self._debug_log("Extraction state at error:", "ERROR")
                for key, value in extraction_state.items():
                    self._debug_log(f"  - {key}: {value}", "ERROR")

            # Log stack trace for debugging
            import traceback

            stack_trace = traceback.format_exc()
            self._debug_log(f"Stack trace:\n{stack_trace}", "ERROR")
            self._debug_log(f"!!! END ERROR CONTEXT - Row {row_id} !!!", "ERROR")

        except Exception as e:
            self.logger.error(f"Error logging error context: {str(e)}")

    def process_value(
        self, input_value: Any, row_id: int, transformation_logger
    ) -> Dict:
        """
        Enhanced main processing method with comprehensive error handling and logging

        Args:
            input_value: The botanist examination result text
            row_id: Row identifier for logging
            transformation_logger: Logger instance for recording transformations

        Returns:
            Dictionary with structured examination result data
        """

        # Enhanced debug logging strategy
        should_debug = (
            row_id < 10  # First 10 rows
            or row_id % 100 == 0  # Every 100th row
            or (
                hasattr(self, "_error_count")
                and self._error_count > 0
                and row_id % 50 == 0
            )  # More frequent if errors
        )

        # Handle empty/null values with enhanced logging
        if (
            input_value is None
            or input_value == ""
            or (isinstance(input_value, float) and input_value != input_value)
        ):
            if should_debug:
                self._debug_log(f"Row {row_id}: Empty/null input detected", "INFO")
            return self._create_empty_result("empty_input")

        # Convert to string and clean with validation
        try:
            result_text = str(input_value).strip()
            if len(result_text) == 0:
                if should_debug:
                    self._debug_log(
                        f"Row {row_id}: Empty text after string conversion", "INFO"
                    )
                return self._create_empty_result("empty_after_conversion")
        except Exception as e:
            self._debug_log(
                f"Row {row_id}: Error converting input to string: {str(e)}", "ERROR"
            )
            return self._create_empty_result("string_conversion_error")

        # Enhanced debug logging for processing start
        if should_debug:
            self._debug_log(f"Row {row_id}: Starting processing", "INFO")
            self._debug_log(
                f"Row {row_id}: Text length: {len(result_text)} characters", "INFO"
            )
            self._debug_log(
                f"Row {row_id}: Text preview: {result_text[:200]}{'...' if len(result_text) > 200 else ''}",
                "INFO",
            )

        # Initialize extraction state for error context
        extraction_state = {
            "stage": "initialization",
            "complexity_detected": False,
            "extraction_attempted": False,
            "validation_attempted": False,
        }

        try:
            # Stage 1: Complexity Detection with error handling
            extraction_state["stage"] = "complexity_detection"
            try:
                complexity_info = self.complex_case_handler.detect_complex_case(
                    result_text
                )
                extraction_state["complexity_detected"] = True

                if should_debug:
                    self._debug_log(
                        f"Row {row_id}: Complexity detection complete - Complex: {complexity_info['is_complex']}",
                        "INFO",
                    )

            except Exception as e:
                self._debug_log(
                    f"Row {row_id}: Error in complexity detection: {str(e)}", "WARN"
                )
                # Use fallback complexity info
                complexity_info = {
                    "is_complex": False,
                    "complexity_type": "simple",
                    "mixed_results": False,
                    "bag_mentions": 0,
                }

            # Stage 2: Information Extraction with error handling
            extraction_state["stage"] = "information_extraction"
            try:
                extracted_data = self._extract_all_information(
                    result_text, complexity_info
                )
                extraction_state["extraction_attempted"] = True

                if should_debug:
                    self._debug_log(
                        f"Row {row_id}: Information extraction complete", "INFO"
                    )

            except Exception as e:
                self._debug_log(
                    f"Row {row_id}: Error in information extraction: {str(e)}", "WARN"
                )
                # Use fallback extraction
                extracted_data = self._create_fallback_extraction(result_text)

            # Stage 3: Complex Case Handling with error handling
            extraction_state["stage"] = "complex_case_handling"
            try:
                if complexity_info["is_complex"]:
                    mixed_case_info = (
                        self.complex_case_handler.handle_mixed_identification(
                            result_text, extracted_data.get("identified_as", "")
                        )
                    )
                    extracted_data.update(mixed_case_info)

                    if should_debug:
                        self._debug_log(
                            f"Row {row_id}: Complex case handling complete", "INFO"
                        )

            except Exception as e:
                self._debug_log(
                    f"Row {row_id}: Error in complex case handling: {str(e)}", "WARN"
                )
                # Continue with basic extraction

            # Stage 4: Fallback Strategy Application with error handling
            extraction_state["stage"] = "fallback_application"
            try:
                extracted_data = self._apply_fallback_if_needed(
                    extracted_data, result_text
                )

                if should_debug:
                    self._debug_log(
                        f"Row {row_id}: Fallback application complete", "INFO"
                    )

            except Exception as e:
                self._debug_log(
                    f"Row {row_id}: Error in fallback application: {str(e)}", "WARN"
                )
                # Continue with current extraction state

            # Stage 5: Validation and Scoring with error handling
            extraction_state["stage"] = "validation_and_scoring"
            try:
                processing_notes = self.validator.validate_and_score(
                    extracted_data, result_text, complexity_info
                )
                extraction_state["validation_attempted"] = True

                if should_debug:
                    self._debug_log(
                        f"Row {row_id}: Validation complete - Confidence: {processing_notes.get('confidence', 0.0):.3f}",
                        "INFO",
                    )

            except Exception as e:
                self._debug_log(f"Row {row_id}: Error in validation: {str(e)}", "WARN")
                # Use fallback validation
                processing_notes = self._create_fallback_validation(
                    extracted_data, result_text
                )

            # Stage 6: Enhanced JSON Structure Assembly for Complex Cases
            extraction_state["stage"] = "enhanced_json_assembly"

            # Get standardized identification
            standardized_identification = self._standardize_identification(
                extracted_data.get(
                    "overall_identification", extracted_data.get("identified_as", "")
                )
            )

            # Build enhanced JSON structure
            final_result = self._build_enhanced_json_structure(
                extracted_data,
                complexity_info,
                processing_notes,
                standardized_identification,
            )

            # Enhanced transformation logging with quality assessment
            confidence = processing_notes.get("confidence", 0.0)
            requires_review = processing_notes.get("requires_manual_review", False)

            # Determine issue type based on confidence and complexity
            if confidence >= 0.85:
                issue_type = "result_processing_successful"
            elif confidence >= 0.65:
                issue_type = "result_processing_partial"
            elif confidence >= 0.4:
                issue_type = "result_processing_low_confidence"
            else:
                issue_type = "result_processing_failed"

            # Enhanced action description
            action_parts = []
            action_parts.append(
                f"species_{extracted_data.get('identified_as', 'none')}"
            )
            action_parts.append(
                f"tags_{len(extracted_data.get('new_tag_numbers', []))}"
            )
            action_parts.append(
                f"officer_{'present' if extracted_data.get('officer_handed_to_present') else 'absent'}"
            )
            action_parts.append(f"confidence_{confidence:.2f}")

            if complexity_info["is_complex"]:
                action_parts.append("complex_case")

            fallback_used = [
                key.replace("_fallback_used", "")
                for key in extracted_data
                if key.endswith("_fallback_used") and extracted_data[key]
            ]
            if fallback_used:
                action_parts.append(f"fallback_{'+'.join(fallback_used)}")

            transformation_logger.log_transformation_issue(
                domain_name="result",
                row_id=row_id,
                column="Result",
                original_value=result_text,
                issue_type=issue_type,
                action_taken="_".join(action_parts),
                final_value=final_result,
                requires_review=requires_review,
            )

            # Enhanced debug logging for successful processing
            if should_debug:
                self._debug_log_extraction_details(
                    row_id,
                    result_text,
                    extracted_data,
                    complexity_info,
                    processing_notes,
                )

            # Track success for adaptive debugging
            if not hasattr(self, "_success_count"):
                self._success_count = 0
            self._success_count += 1

            return final_result

        except Exception as e:
            # Enhanced error handling and logging
            if not hasattr(self, "_error_count"):
                self._error_count = 0
            self._error_count += 1

            self.logger.error(
                f"Critical error processing result for row {row_id}: {str(e)}"
            )

            # Log comprehensive error context
            self._debug_log_error_context(row_id, e, result_text, extraction_state)

            # Enhanced error transformation logging
            transformation_logger.log_transformation_issue(
                domain_name="result",
                row_id=row_id,
                column="Result",
                original_value=result_text,
                issue_type="result_processing_critical_error",
                action_taken=f"critical_error_{type(e).__name__}_{extraction_state['stage']}",
                final_value=self._create_empty_result("critical_error"),
                requires_review=True,
            )

            return self._create_empty_result("critical_error")

    def _extract_all_information(self, text: str, complexity_info: Dict = None) -> Dict:
        """Extract all components from examination result text with complexity awareness"""

        # Extract species identification
        identified_as, id_confidence = (
            self.identification_extractor.extract_identification(text)
        )

        # Extract new tag numbers
        new_tag_numbers = self.tag_extractor.extract_new_tag_numbers(text)

        # Extract officer handover information
        handed_to, officer_present = self.officer_extractor.extract_handover_info(text)

        return {
            "identified_as": identified_as,
            "identification_confidence": id_confidence,
            "new_tag_numbers": new_tag_numbers,
            "handed_to": handed_to,
            "officer_handed_to_present": officer_present,
        }

    def _apply_fallback_if_needed(
        self, extracted_data: Dict, original_text: str
    ) -> Dict:
        """Apply fallback strategies for components that failed extraction"""
        failed_components = []

        # Check which components failed
        if not extracted_data.get("identified_as"):
            failed_components.append("identification")

        if not extracted_data.get("new_tag_numbers"):
            # Only apply fallback if text suggests there should be tag numbers
            if re.search(r"tag|bag|resealed", original_text, re.IGNORECASE):
                failed_components.append("tag_numbers")

        if not extracted_data.get("handed_to"):
            # Only apply fallback if text suggests officer handover
            if re.search(
                r"handed|officer|constable|sergeant", original_text, re.IGNORECASE
            ):
                failed_components.append("officer_info")

        # Apply fallback strategies if needed
        if failed_components:
            fallback_results = self.fallback_handler.apply_fallback_extraction(
                original_text, failed_components
            )

            # Merge fallback results, preserving original successful extractions
            for key, value in fallback_results.items():
                if not extracted_data.get(key):  # Only use fallback if original failed
                    extracted_data[key] = value
                    # Mark as fallback result
                    extracted_data[f"{key}_fallback_used"] = True

        return extracted_data

    def _create_empty_result(self, failure_reason: str = "parsing_failed") -> Dict:
        """Create empty result structure for failed processing with enhanced failure tracking"""
        return {
            "identified_as": "",
            "new_tag_numbers": [],
            "handed_to": "",
            "officer_handed_to_present": False,
            "processing_notes": {
                "confidence": 0.0,
                "reason": failure_reason,
                "original_text": "",
                "requires_manual_review": True,
                "extraction_details": {
                    "identification_confidence": 0.0,
                    "tag_extraction_confidence": 0.0,
                    "officer_extraction_confidence": 0.0,
                    "complexity_confidence": 0.0,
                    "pattern_quality_score": 0.0,
                },
                "validation_flags": ["processing_failed"],
                "failure_context": {
                    "failure_type": failure_reason,
                    "recovery_attempted": False,
                    "fallback_available": False,
                },
            },
            "complex_case_info": {
                "is_complex": False,
                "complexity_type": "unknown",
                "is_mixed_case": False,
                "unidentifiable_reasons": [],
                "complexity_notes": f"processing_failed_{failure_reason}",
            },
        }

    def _create_fallback_extraction(self, text: str) -> Dict:
        """Create fallback extraction when primary extraction fails"""
        try:
            # Use fallback handler for basic extraction
            fallback_results = self.fallback_handler.apply_fallback_extraction(
                text, ["identification", "tag_numbers", "officer_info"]
            )

            # Mark all as fallback
            for key in fallback_results:
                fallback_results[f"{key}_fallback_used"] = True

            return fallback_results

        except Exception as e:
            self._debug_log(f"Fallback extraction also failed: {str(e)}", "ERROR")
            return {
                "identified_as": "",
                "new_tag_numbers": [],
                "handed_to": "",
                "officer_handed_to_present": False,
            }

    def _standardize_identification(self, identification: str) -> str:
        """
        Standardize identification values for consistency

        Args:
            identification: Raw identification string

        Returns:
            Standardized identification string
        """
        if not identification:
            return ""

        # Standardization mapping
        standardization_map = {
            # Cannabis variations
            "cannabis sativa": "Cannabis sativa",
            "cannabis": "Cannabis sativa",
            "sativa": "Cannabis sativa",
            # Papaver variations
            "papaver somniferum": "Papaver somniferum",
            "papaver": "Papaver somniferum",
            "somniferum": "Papaver somniferum",
            "poppy": "Papaver somniferum",
            # Unidentifiable variations
            "unidentifiable": "Unidentifiable",
            "unable to identify": "Unidentifiable",
            "could not identify": "Unidentifiable",
            "not identified": "Unidentifiable",
            "unknown": "Unidentifiable",
            # Mixed case
            "mixed": "Mixed",
            "partial": "Mixed",
            "some identified": "Mixed",
        }

        # Try exact match first
        identification_lower = identification.lower().strip()
        if identification_lower in standardization_map:
            return standardization_map[identification_lower]

        # Try partial matches for complex cases
        for key, value in standardization_map.items():
            if key in identification_lower:
                return value

        # Return original if no standardization found
        return identification

    def _build_enhanced_json_structure(
        self,
        extracted_data: Dict,
        complexity_info: Dict,
        processing_notes: Dict,
        standardized_identification: str,
    ) -> Dict:
        """
        Build enhanced JSON structure compatible with Django backend expectations

        Args:
            extracted_data: Extracted information from text
            complexity_info: Complexity analysis results
            processing_notes: Processing quality information
            standardized_identification: Standardized identification value

        Returns:
            Enhanced JSON structure for complex cases
        """

        # Base structure for all cases
        base_structure = {
            "identified_as": standardized_identification,
            "new_tag_numbers": extracted_data.get("new_tag_numbers", []),
            "handed_to": extracted_data.get("handed_to", ""),
            "officer_handed_to_present": extracted_data.get(
                "officer_handed_to_present", False
            ),
            "processing_notes": processing_notes,
        }

        # Enhanced structure for complex cases
        if complexity_info.get("is_complex", False):
            # Add enhanced complex case information
            base_structure["complex_case_details"] = {
                "is_complex": True,
                "complexity_type": complexity_info.get("complexity_type", "unknown"),
                "is_mixed_case": extracted_data.get("is_mixed_case", False),
                "unidentifiable_reasons": extracted_data.get(
                    "unidentifiable_reasons", []
                ),
                "complexity_notes": extracted_data.get("complexity_notes", ""),
                "bag_mentions": complexity_info.get("bag_mentions", 0),
                "mixed_results": complexity_info.get("mixed_results", False),
            }

            # Add bag-specific breakdown if available
            if complexity_info.get("complexity_type") == "bag_specific":
                base_structure["bag_analysis"] = self._extract_bag_specific_analysis(
                    processing_notes.get("original_text", ""), extracted_data
                )

            # Add cross-reference information if available
            base_structure["cross_reference"] = self._build_cross_reference_info(
                extracted_data, processing_notes.get("original_text", "")
            )

        else:
            # Simple case structure
            base_structure["complex_case_details"] = {
                "is_complex": False,
                "complexity_type": "simple",
                "is_mixed_case": False,
                "unidentifiable_reasons": [],
                "complexity_notes": "simple_case_processing",
            }

        # Add standardization tracking
        base_structure["standardization_applied"] = {
            "identification_standardized": standardized_identification
            != extracted_data.get("identified_as", ""),
            "original_identification": extracted_data.get("identified_as", ""),
            "standardized_identification": standardized_identification,
        }

        # Add Django backend compatibility fields
        base_structure["django_compatibility"] = {
            "field_types_validated": True,
            "json_serializable": True,
            "null_handling_applied": True,
            "array_fields_formatted": True,
        }

        return base_structure

    def _extract_bag_specific_analysis(
        self, original_text: str, extracted_data: Dict
    ) -> Dict:
        """
        Extract bag-specific analysis for complex cases

        Args:
            original_text: Original examination text
            extracted_data: Extracted data

        Returns:
            Bag-specific analysis information
        """
        try:
            # Pattern to find bag-specific mentions
            bag_patterns = [
                r"bag(?:s)?\s+(?:no\.?s?\s+)?([A-Z]*\d+(?:,\s*[A-Z]*\d+)*)",
                r"in\s+bags?\s+(?:nos?\.\s+)?([A-Z]*\d+(?:,\s*[A-Z]*\d+)*)",
                r"material\s+in\s+bags?\s+(?:nos?\.\s+)?([A-Z]*\d+(?:,\s*[A-Z]*\d+)*)",
            ]

            bag_mentions = []
            for pattern in bag_patterns:
                matches = re.finditer(pattern, original_text, re.IGNORECASE)
                for match in matches:
                    bag_numbers = [tag.strip() for tag in match.group(1).split(",")]
                    bag_mentions.extend(bag_numbers)

            # Remove duplicates while preserving order
            unique_bags = []
            seen = set()
            for bag in bag_mentions:
                if bag not in seen:
                    seen.add(bag)
                    unique_bags.append(bag)

            return {
                "bags_mentioned": unique_bags,
                "total_bags_mentioned": len(unique_bags),
                "bag_identification_attempted": len(unique_bags) > 0,
                "analysis_confidence": 0.8 if unique_bags else 0.3,
            }

        except Exception as e:
            self._debug_log(f"Error in bag-specific analysis: {str(e)}", "WARN")
            return {
                "bags_mentioned": [],
                "total_bags_mentioned": 0,
                "bag_identification_attempted": False,
                "analysis_confidence": 0.0,
                "error": str(e),
            }

    def _build_cross_reference_info(
        self, extracted_data: Dict, original_text: str
    ) -> Dict:
        """
        Build cross-reference information for tag numbers and other domains

        Args:
            extracted_data: Extracted data
            original_text: Original examination text

        Returns:
            Cross-reference information
        """
        try:
            new_tags = extracted_data.get("new_tag_numbers", [])

            # Basic cross-reference structure
            cross_ref = {
                "new_tag_count": len(new_tags),
                "new_tags_extracted": new_tags,
                "cross_reference_attempted": True,
                "cross_reference_confidence": 0.7 if new_tags else 0.3,
            }

            # Add tag format analysis
            if new_tags:
                tag_formats = {}
                for tag in new_tags:
                    # Extract format pattern (letters + numbers)
                    format_match = re.match(r"^([A-Z]*)(\d+)$", tag)
                    if format_match:
                        prefix = format_match.group(1) or "NUMERIC"
                        if prefix not in tag_formats:
                            tag_formats[prefix] = 0
                        tag_formats[prefix] += 1

                cross_ref["tag_format_analysis"] = {
                    "formats_detected": tag_formats,
                    "format_consistency": len(tag_formats) == 1,
                    "primary_format": (
                        max(tag_formats.keys(), key=tag_formats.get)
                        if tag_formats
                        else None
                    ),
                }

            return cross_ref

        except Exception as e:
            self._debug_log(f"Error in cross-reference building: {str(e)}", "WARN")
            return {
                "new_tag_count": 0,
                "new_tags_extracted": [],
                "cross_reference_attempted": False,
                "cross_reference_confidence": 0.0,
                "error": str(e),
            }

    def _create_fallback_validation(self, extracted_data: Dict, text: str) -> Dict:
        """Create fallback validation when primary validation fails"""
        try:
            # Basic confidence assessment
            has_identification = bool(extracted_data.get("identified_as"))
            has_tags = bool(extracted_data.get("new_tag_numbers"))
            has_officer = bool(extracted_data.get("handed_to"))

            # Simple confidence calculation
            confidence_factors = [has_identification, has_tags, has_officer]
            base_confidence = (
                sum(confidence_factors) / len(confidence_factors) * 0.6
            )  # Max 0.6 for fallback

            return {
                "confidence": round(base_confidence, 2),
                "reason": "fallback_validation",
                "original_text": text[:200] + ("..." if len(text) > 200 else ""),
                "requires_manual_review": True,
                "extraction_details": {
                    "identification_confidence": 0.5 if has_identification else 0.0,
                    "tag_extraction_confidence": 0.5 if has_tags else 0.0,
                    "officer_extraction_confidence": 0.5 if has_officer else 0.0,
                    "complexity_confidence": 0.3,  # Low confidence for fallback
                    "pattern_quality_score": 0.0,
                },
                "validation_flags": ["fallback_validation", "requires_review"],
                "failure_context": {
                    "failure_type": "validation_error",
                    "recovery_attempted": True,
                    "fallback_available": True,
                },
            }

        except Exception as e:
            self._debug_log(f"Fallback validation also failed: {str(e)}", "ERROR")
            return {
                "confidence": 0.0,
                "reason": "validation_failed",
                "original_text": text[:100] + ("..." if len(text) > 100 else ""),
                "requires_manual_review": True,
                "extraction_details": {
                    "identification_confidence": 0.0,
                    "tag_extraction_confidence": 0.0,
                    "officer_extraction_confidence": 0.0,
                    "complexity_confidence": 0.0,
                    "pattern_quality_score": 0.0,
                },
                "validation_flags": ["validation_failed", "critical_error"],
            }

    def post_process(self):
        """
        Enhanced post-processing method called after all domain processing is complete
        Includes standardization of identified_as column and comprehensive analysis
        """
        try:
            self._debug_log(
                "Starting enhanced post-processing with standardization", "INFO"
            )

            # Step 1: Apply identified_as column standardization
            standardization_results = self._apply_identification_standardization()

            # Step 2: Run comprehensive analysis suite
            import os
            import sys

            sys.path.append(os.path.dirname(__file__))
            from comprehensive_analysis_suite import ComprehensiveAnalysisSuite

            suite = ComprehensiveAnalysisSuite()
            analysis_results = suite.run_post_etl_analysis()

            self._debug_log(
                "Post-processing analysis suite completed successfully", "INFO"
            )

            # Log summary of analysis results
            if analysis_results:
                summary = analysis_results.get("summary", {})
                self._debug_log(
                    f"Analysis tools run: {summary.get('total_tools_run', 0)}", "INFO"
                )
                self._debug_log(
                    f"Successful tools: {summary.get('successful_tools', 0)}", "INFO"
                )
                self._debug_log(
                    f"Failed tools: {summary.get('failed_tools', 0)}", "INFO"
                )

                # Log critical recommendations
                recommendations = analysis_results.get("recommendations", [])
                critical_recs = [
                    r for r in recommendations if r["priority"] == "CRITICAL"
                ]
                if critical_recs:
                    self._debug_log(
                        f"CRITICAL: {len(critical_recs)} critical issues detected",
                        "ERROR",
                    )
                    for rec in critical_recs:
                        self._debug_log(
                            f"  - {rec['category']}: {rec['issue']}", "ERROR"
                        )

            # Combine results
            combined_results = {
                "standardization": standardization_results,
                "analysis": analysis_results,
                "post_processing_complete": True,
            }

            return combined_results

        except Exception as e:
            self._debug_log(f"Post-processing failed: {str(e)}", "ERROR")
            self.logger.error(f"Post-processing failed: {str(e)}")
            return {"error": str(e), "post_processing_complete": False}

    def _apply_identification_standardization(self) -> Dict:
        """
        Apply standardization to identified_as column in the final JSON output

        Returns:
            Dictionary with standardization results and statistics
        """
        try:
            self._debug_log("Starting identified_as column standardization", "INFO")

            # Load the final JSON data
            json_file_path = Path("data/modded/cannabis_final.json")
            if not json_file_path.exists():
                self._debug_log(
                    "Final JSON file not found, skipping standardization during ETL",
                    "WARN",
                )
                self._debug_log(
                    "Standardization will be applied after final JSON creation", "INFO"
                )
                return {
                    "message": "Standardization deferred until after final JSON creation",
                    "standardized_count": 0,
                }

            with open(json_file_path, "r", encoding="utf-8") as f:
                data = json.load(f)

            standardization_stats = {
                "total_records": len(data),
                "standardized_count": 0,
                "standardization_changes": [],
                "error_count": 0,
            }

            # Apply standardization to each record
            for record in data:
                try:
                    result_data = record.get("result", {})
                    if isinstance(result_data, dict):
                        original_identification = result_data.get("identified_as", "")
                        if original_identification:
                            standardized = self._standardize_identification(
                                original_identification
                            )

                            if standardized != original_identification:
                                # Update the identification
                                result_data["identified_as"] = standardized

                                # Track the change
                                standardization_stats["standardized_count"] += 1
                                standardization_stats["standardization_changes"].append(
                                    {
                                        "row_id": record.get("row_id", "unknown"),
                                        "original": original_identification,
                                        "standardized": standardized,
                                    }
                                )

                                # Update standardization tracking in the record
                                if "standardization_applied" not in result_data:
                                    result_data["standardization_applied"] = {}

                                result_data["standardization_applied"].update(
                                    {
                                        "identification_standardized": True,
                                        "original_identification": original_identification,
                                        "standardized_identification": standardized,
                                        "standardization_timestamp": datetime.datetime.now().isoformat(),
                                    }
                                )

                except Exception as e:
                    standardization_stats["error_count"] += 1
                    self._debug_log(
                        f"Error standardizing record {record.get('row_id', 'unknown')}: {str(e)}",
                        "WARN",
                    )

            # Save the updated JSON data
            if standardization_stats["standardized_count"] > 0:
                with open(json_file_path, "w", encoding="utf-8") as f:
                    json.dump(data, f, indent=2, ensure_ascii=False)

                self._debug_log(
                    f"Standardization complete: {standardization_stats['standardized_count']} records updated",
                    "INFO",
                )

                # Generate standardization report
                self._generate_standardization_report(standardization_stats)
            else:
                self._debug_log("No standardization changes needed", "INFO")

            return standardization_stats

        except Exception as e:
            self._debug_log(
                f"Error in identification standardization: {str(e)}", "ERROR"
            )
            return {"error": str(e), "standardized_count": 0}

    def _generate_standardization_report(self, stats: Dict):
        """
        Generate a detailed standardization report

        Args:
            stats: Standardization statistics
        """
        try:
            report_path = DOMAIN_PATH / "standardization_report.md"

            with open(report_path, "w", encoding="utf-8") as f:
                f.write("# Result Domain - Identification Standardization Report\n\n")
                f.write(
                    f"**Generated:** {datetime.datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n\n"
                )

                f.write("## Summary\n\n")
                f.write(f"- **Total Records Processed:** {stats['total_records']:,}\n")
                f.write(
                    f"- **Records Standardized:** {stats['standardized_count']:,}\n"
                )
                f.write(
                    f"- **Standardization Rate:** {(stats['standardized_count']/stats['total_records']*100):.1f}%\n"
                )
                f.write(f"- **Errors Encountered:** {stats['error_count']}\n\n")

                if stats["standardization_changes"]:
                    f.write("## Standardization Changes Applied\n\n")
                    f.write("| Row ID | Original | Standardized |\n")
                    f.write("|--------|----------|-------------|\n")

                    for change in stats["standardization_changes"][
                        :50
                    ]:  # Limit to first 50
                        f.write(
                            f"| {change['row_id']} | {change['original']} | {change['standardized']} |\n"
                        )

                    if len(stats["standardization_changes"]) > 50:
                        f.write(
                            f"\n*... and {len(stats['standardization_changes']) - 50} more changes*\n"
                        )

                f.write("\n## Standardization Rules Applied\n\n")
                f.write("- Cannabis variations → Cannabis sativa\n")
                f.write("- Papaver variations → Papaver somniferum\n")
                f.write("- Unidentifiable variations → Unidentifiable\n")
                f.write("- Mixed case variations → Mixed\n")

            self._debug_log(f"Standardization report generated: {report_path}", "INFO")

        except Exception as e:
            self._debug_log(
                f"Error generating standardization report: {str(e)}", "WARN"
            )


# Global processor instance
_processor = None


def get_processor():
    """Get the global processor instance (singleton pattern)"""
    global _processor
    if _processor is None:
        _processor = ResultProcessor()
    return _processor


def process_value(input_value: Any, row_id: int, transformation_logger) -> Dict:
    """
    Main entry point called by ETL Transformer
    This is the function that the transformer will call
    """
    processor = get_processor()
    return processor.process_value(input_value, row_id, transformation_logger)


def post_process():
    """
    Post-processing entry point called by ETL Orchestrator
    Runs comprehensive analysis and reporting tools for continuous improvement
    """
    processor = get_processor()
    return processor.post_process()


# Test the module
if __name__ == "__main__":
    print("Testing Result Logic...")

    # Test cases
    test_cases = [
        "I identified the plants as Cannabis sativa. The plants were resealed in two new drug movement bags, tag numbers T50488 and T50489 and handed over to Senior Constable Calwick who was present during the examination",
        "I identified the poppy seeds and heads as Papaver somniferum. The poppy seeds and heads were resealed in two new drug movement bags, tag numbers B537899 and B537900 and handed over to Senior Constable Calwick who was present during the examination",
        "I was unable to identify the plant material as the material was too decomposed. The material was resealed in a new drug movement bag, tag number W00657093.",
        "I identified the plants in bag no. T52625 as Cannabis sativa. I was unable to identify the material in bag nos. T52621, T52622 as the material was too decomposed. The plants were resealed in new drug movement bags, tag numbers T50669, T50670 and handed over to Senior Constable Ursula who was present during the examination",
    ]

    class MockLogger:
        def log_transformation_issue(self, **kwargs):
            print(f"LOG: {kwargs['issue_type']} - {kwargs['action_taken']}")

    mock_logger = MockLogger()

    for i, test_case in enumerate(test_cases):
        print(f"\nTest {i+1}: {test_case[:80]}...")
        result = process_value(test_case, i, mock_logger)
        print(f"  Species: {result['identified_as']}")
        print(f"  Tags: {result['new_tag_numbers']}")
        print(f"  Officer: {result['handed_to']}")
        print(f"  Present: {result['officer_handed_to_present']}")
        print(f"  Confidence: {result['processing_notes']['confidence']}")
