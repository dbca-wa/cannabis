#!/usr/bin/env python3
"""
Domain Logic for Approved Botanist
Handles standardization and validation of botanist names
"""

import json
import logging
import re
from difflib import SequenceMatcher
from pathlib import Path
from typing import Any, Optional

# Get the directory where this logic file is located
DOMAIN_PATH = Path(__file__).parent
STANDARDISATION_FILE = DOMAIN_PATH / "standardisation.json"


class ApprovedBotanistProcessor:
    """Handles approved botanist name processing and standardization"""

    def __init__(self):
        self.logger = logging.getLogger(__name__)
        self.standardisation_config = self._load_standardisation_config()

        # Build lookup dictionaries for fast processing
        self.variant_to_canonical = {}
        self.canonical_names = set()
        self._build_lookup_tables()

    def _load_standardisation_config(self) -> dict:
        """Load the standardisation configuration"""
        try:
            if STANDARDISATION_FILE.exists():
                with open(STANDARDISATION_FILE, "r") as f:
                    config = json.load(f)
                return config
            else:
                # Create default config if it doesn't exist
                default_config = self._create_default_config()
                self._save_standardisation_config(default_config)
                return default_config

        except Exception as e:
            self.logger.error(f"Error loading standardisation config: {str(e)}")
            return self._create_default_config()

    def _create_default_config(self) -> dict:
        """Create default standardisation configuration"""
        return {
            "source_column_name": "Approved Botanist",
            "sink_column_name": "approved_botanist",
            "bad_data_handling": {
                "strategy": "flag_and_preserve",
                "flag_value": "UNKNOWN_BOTANIST",
                "preserve_original": True,
                "log_level": "warn",
                "require_manual_review": True,
                "fuzzy_matching": {
                    "enabled": True,
                    "threshold": 0.8,
                    "log_matches": True,
                },
            },
            "entries": [
                {"canonical": "Alex Chapman", "variants": ["Alex R Chapman"]},
                {
                    "canonical": "Fang Chang Sha",
                    "variants": [
                        "Fang Chang Sha",
                        "Fang ChangSha",
                        "Fang Chang  Sha",
                        "Fang chang Sha",
                        "Fang Chang Sha'",
                        "Chang Sha Fang",
                        "Fang Chang sha",
                        "FANG CHANG SHA",
                        "FANG CHANG CHA",
                        "FANG CHANG Sha",
                    ],
                },
                {
                    "canonical": "John Huisman",
                    "variants": ["HUISMAN, John", "John Huisman"],
                },
                {"canonical": "Karina Knight", "variants": ["Karina Knight"]},
                {
                    "canonical": "Kelly Shepherd",
                    "variants": [
                        "SHEPHERD, Kelly",
                        "SHEPHERD, KELLY",
                        "SHEPHERD Kelly",
                        "Kelly Shepherd",
                    ],
                },
                {
                    "canonical": "Neville Marchant",
                    "variants": [
                        "Dr Neville G Marchant",
                        "Dr Neville  Marchant",
                        "Dr Neville Marchant",
                        "NEVILLE MARCHANT",
                        "DR NEVILLE MARCHANT",
                    ],
                },
                {
                    "canonical": "Nicholas Lander",
                    "variants": [
                        "Nicholas S Lander",
                        "Nicholas S. Lander",
                        "NICHOLAS S. LANDER",
                        "Nicholas S lander",
                        "NICHOLAS LANDER",
                        "Nicholas Lander",
                        "Nicholas lander",
                        "LANDER, Nicholas",
                        "LANDER,Nicholas",
                        "LANDER Nicholas",
                        "LANDER, nicholas",
                        "LANDER, Nocholas",
                        "Lander, Nicholas",
                        "LANDER. Nicholas",
                    ],
                },
                {
                    "canonical": "Raymond Cranfield",
                    "variants": [
                        "Raymond J Cranfield",
                        "Raymond C Cranfield",
                        "RAYMOND CRANFIELD",
                        "CRANFIELD RAY",
                        "Raymond Cranfield",
                        "RAY CRANFIELD",
                        "Ray Cranfield",
                        "CRANFIELD, Raymond",
                        "Cranfield, Raymond",
                        "CRANFIELD, Ray",
                        "CRANFIELD Raymond",
                        "CRANFIELD Ray",
                    ],
                },
                {"canonical": "Susan Patrick", "variants": ["Susan Patrick"]},
            ],
        }

    def _save_standardisation_config(self, config: dict):
        """Save standardisation configuration to file"""
        try:
            DOMAIN_PATH.mkdir(exist_ok=True)
            with open(STANDARDISATION_FILE, "w") as f:
                json.dump(config, f, indent=4)
        except Exception as e:
            self.logger.error(f"Error saving standardisation config: {str(e)}")

    def _build_lookup_tables(self):
        """Build fast lookup tables for variant matching"""
        self.variant_to_canonical = {}
        self.canonical_names = set()

        for entry in self.standardisation_config.get("entries", []):
            canonical = entry["canonical"]
            self.canonical_names.add(canonical)

            # Map canonical to itself
            self.variant_to_canonical[canonical.lower().strip()] = canonical

            # Map all variants to canonical
            for variant in entry.get("variants", []):
                normalized_variant = self._normalize_name(variant)
                self.variant_to_canonical[normalized_variant] = canonical

    def _normalize_name(self, name: str) -> str:
        """Normalize name for consistent matching"""
        if not isinstance(name, str):
            return str(name).lower().strip()

        # Convert to lowercase, strip whitespace
        normalized = name.lower().strip()

        # Remove extra spaces
        normalized = re.sub(r"\s+", " ", normalized)

        # Remove common punctuation that might cause issues
        normalized = re.sub(r"[,.]$", "", normalized)

        return normalized

    def _fuzzy_match(self, input_name: str, threshold: float = 0.8) -> Optional[str]:
        """Attempt fuzzy matching against known canonicals"""
        input_normalized = self._normalize_name(input_name)
        best_match = None
        best_score = 0

        # Check against all known variants first
        for variant, canonical in self.variant_to_canonical.items():
            score = SequenceMatcher(None, input_normalized, variant).ratio()
            if score > best_score and score >= threshold:
                best_score = score
                best_match = canonical

        # If no good variant match, check against canonicals
        if best_match is None:
            for canonical in self.canonical_names:
                canonical_normalized = self._normalize_name(canonical)
                score = SequenceMatcher(
                    None, input_normalized, canonical_normalized
                ).ratio()
                if score > best_score and score >= threshold:
                    best_score = score
                    best_match = canonical

        return best_match

    def _handle_unknown_name(
        self, input_name: str, row_id: int, transformation_logger
    ) -> str:
        """Handle names that don't match any known botanist"""
        bad_data_config = self.standardisation_config.get("bad_data_handling", {})
        strategy = bad_data_config.get("strategy", "flag_and_preserve")

        # Try fuzzy matching if enabled
        fuzzy_config = bad_data_config.get("fuzzy_matching", {})
        if fuzzy_config.get("enabled", False):
            fuzzy_match = self._fuzzy_match(
                input_name, fuzzy_config.get("threshold", 0.8)
            )

            if fuzzy_match:
                transformation_logger.log_transformation_issue(
                    domain_name="approved_botanist",
                    row_id=row_id,
                    column="approved_botanist",
                    original_value=input_name,
                    issue_type="fuzzy_match_applied",
                    action_taken=f"fuzzy_matched_to_{fuzzy_match}",
                    final_value=fuzzy_match,
                    requires_review=fuzzy_config.get("log_matches", True),
                )
                return fuzzy_match

        # Handle based on strategy
        if strategy == "flag_and_preserve":
            flag_value = bad_data_config.get("flag_value", "UNKNOWN_BOTANIST")
            final_value = (
                f"{flag_value}: {input_name}"
                if bad_data_config.get("preserve_original", True)
                else flag_value
            )
        elif strategy == "flag_and_replace":
            final_value = bad_data_config.get("flag_value", "UNKNOWN_BOTANIST")
        elif strategy == "skip_row":
            final_value = None
        else:
            final_value = f"UNKNOWN_BOTANIST: {input_name}"

        transformation_logger.log_transformation_issue(
            domain_name="approved_botanist",
            row_id=row_id,
            column="approved_botanist",
            original_value=input_name,
            issue_type="unknown_botanist",
            action_taken=strategy,
            final_value=final_value,
            requires_review=bad_data_config.get("require_manual_review", True),
        )

        return final_value

    def process_value(
        self, input_value: Any, row_id: int, transformation_logger
    ) -> str:
        """
        Main processing method called by ETL Transformer

        Args:
            input_value: The input botanist name
            row_id: Row identifier for logging
            transformation_logger: Logger instance for recording transformations

        Returns:
            Standardized botanist name
        """

        # Handle empty/null values
        if (
            input_value is None
            or input_value == ""
            or (isinstance(input_value, float) and input_value != input_value)
        ):  # NaN check
            return self.standardisation_config.get("bad_data_handling", {}).get(
                "empty_value", "EMPTY"
            )

        # Convert to string and clean
        name_str = str(input_value).strip()

        # Normalize for lookup
        normalized_name = self._normalize_name(name_str)

        # Try direct lookup first
        if normalized_name in self.variant_to_canonical:
            canonical_name = self.variant_to_canonical[normalized_name]

            # Log successful standardization if it's not already canonical
            if canonical_name != name_str:
                transformation_logger.log_transformation_issue(
                    domain_name="approved_botanist",
                    row_id=row_id,
                    column="approved_botanist",
                    original_value=name_str,
                    issue_type="standardization_applied",
                    action_taken="variant_to_canonical",
                    final_value=canonical_name,
                    requires_review=False,
                )

            return canonical_name

        # No direct match found - handle as unknown
        return self._handle_unknown_name(name_str, row_id, transformation_logger)

    def add_new_variant(self, canonical_name: str, variant_name: str) -> bool:
        """
        Add a new variant to an existing canonical name

        Args:
            canonical_name: The canonical form
            variant_name: New variant to add

        Returns:
            True if added successfully
        """
        try:
            # Find the entry for this canonical name
            for entry in self.standardisation_config["entries"]:
                if entry["canonical"] == canonical_name:
                    if variant_name not in entry["variants"]:
                        entry["variants"].append(variant_name)
                        self._save_standardisation_config(self.standardisation_config)
                        self._build_lookup_tables()  # Rebuild lookup tables
                        return True

            # Canonical name not found
            self.logger.warning(f"Canonical name '{canonical_name}' not found")
            return False

        except Exception as e:
            self.logger.error(f"Error adding variant: {str(e)}")
            return False

    def add_new_botanist(self, canonical_name: str, variants: list = None) -> bool:
        """
        Add a completely new botanist

        Args:
            canonical_name: The canonical form of the new botanist
            variants: List of variants (optional)

        Returns:
            True if added successfully
        """
        try:
            # Check if already exists
            if canonical_name in self.canonical_names:
                self.logger.warning(f"Botanist '{canonical_name}' already exists")
                return False

            new_entry = {
                "canonical": canonical_name,
                "variants": variants or [canonical_name],
            }

            self.standardisation_config["entries"].append(new_entry)
            self._save_standardisation_config(self.standardisation_config)
            self._build_lookup_tables()  # Rebuild lookup tables

            self.logger.info(f"Added new botanist: {canonical_name}")
            return True

        except Exception as e:
            self.logger.error(f"Error adding new botanist: {str(e)}")
            return False

    def get_statistics(self) -> dict:
        """Get statistics about the current standardisation rules"""
        total_entries = len(self.standardisation_config.get("entries", []))
        total_variants = sum(
            len(entry.get("variants", []))
            for entry in self.standardisation_config.get("entries", [])
        )

        return {
            "total_canonical_names": total_entries,
            "total_variants": total_variants,
            "average_variants_per_canonical": total_variants / max(total_entries, 1),
            "canonicals": list(self.canonical_names),
        }


# Global processor instance
_processor = None


def get_processor():
    """Get the global processor instance (singleton pattern)"""
    global _processor
    if _processor is None:
        _processor = ApprovedBotanistProcessor()
    return _processor


def process_value(input_value: Any, row_id: int, transformation_logger) -> str:
    """
    Main entry point called by ETL Transformer
    This is the function that the transformer will call
    """
    processor = get_processor()
    return processor.process_value(input_value, row_id, transformation_logger)


# Additional utility functions for external use
def add_variant(canonical_name: str, variant_name: str) -> bool:
    """Add a new variant to existing botanist"""
    processor = get_processor()
    return processor.add_new_variant(canonical_name, variant_name)


def add_botanist(canonical_name: str, variants: list = None) -> bool:
    """Add a new botanist"""
    processor = get_processor()
    return processor.add_new_botanist(canonical_name, variants)


def get_stats() -> dict:
    """Get standardisation statistics"""
    processor = get_processor()
    return processor.get_statistics()


if __name__ == "__main__":
    # Test the module
    print("Testing Approved Botanist Logic...")

    processor = get_processor()
    print(f"Loaded {len(processor.canonical_names)} canonical botanists")

    # Test cases
    test_cases = [
        "Nicholas Lander",  # Exact canonical
        "LANDER, Nicholas",  # Known variant
        "Dr Neville Marchant",  # Known variant
        "John Smith",  # Unknown - should trigger bad data handling
        "Nick Lander",  # Should trigger fuzzy matching
        "",  # Empty value
        None,  # Null value
    ]

    class MockLogger:
        def log_transformation_issue(self, **kwargs):
            print(f"LOG: {kwargs}")

    mock_logger = MockLogger()

    for i, test_case in enumerate(test_cases):
        result = process_value(test_case, i, mock_logger)
        print(f"'{test_case}' -> '{result}'")

    # Print statistics
    print("\nStatistics:")
    stats = get_stats()
    for key, value in stats.items():
        print(f"  {key}: {value}")
