#!/usr/bin/env python3
"""
Domain Logic for Description
Handles standardization and validation of description text to tag arrays
"""

import json
import logging
import re
from difflib import SequenceMatcher
from pathlib import Path
from typing import Any, List

# Get the directory where this logic file is located
DOMAIN_PATH = Path(__file__).parent
STANDARDISATION_FILE = DOMAIN_PATH / "standardisation.json"


class DescriptionProcessor:
    """Handles description text processing and standardization to tag arrays"""

    def __init__(self):
        self.logger = logging.getLogger(__name__)
        self.standardisation_config = self._load_standardisation_config()

        # Build lookup dictionaries for fast processing
        self.variant_to_canonical = {}
        self.canonical_tags = set()
        self._build_lookup_tables()

    def _load_standardisation_config(self) -> dict:
        """Load the standardisation configuration"""
        try:
            if STANDARDISATION_FILE.exists():
                with open(STANDARDISATION_FILE, "r") as f:
                    config = json.load(f)
                return config
            else:
                self.logger.error(
                    f"Standardisation file not found: {STANDARDISATION_FILE}"
                )
                return self._create_default_config()

        except Exception as e:
            self.logger.error(f"Error loading standardisation config: {str(e)}")
            return self._create_default_config()

    def _create_default_config(self) -> dict:
        """Create default standardisation configuration"""
        return {
            "source_column_name": "Description",
            "sink_column_name": "description",
            "bad_data_handling": {
                "strategy": "flag_and_preserve",
                "flag_value": "UNKNOWN_DESCRIPTION",
                "preserve_original": True,
                "log_level": "warn",
                "require_manual_review": True,
                "fuzzy_matching": {
                    "enabled": False,
                    "threshold": 0.8,
                    "log_matches": False,
                },
            },
            "entries": [
                {"canonical": ["plant"], "variants": ["quantity of plant", "plant"]}
            ],
        }

    def _build_lookup_tables(self):
        """Build fast lookup tables for variant matching"""
        self.variant_to_canonical = {}
        self.canonical_tags = set()

        for entry in self.standardisation_config.get("entries", []):
            canonical_tags = entry["canonical"]

            # Track all unique tags
            for tag in canonical_tags:
                self.canonical_tags.add(tag)

            # Map all variants to canonical tag array
            for variant in entry.get("variants", []):
                normalized_variant = self._normalize_description(variant)
                self.variant_to_canonical[normalized_variant] = canonical_tags

    def _normalize_description(self, description: str) -> str:
        """Normalize description for consistent matching"""
        if not isinstance(description, str):
            return str(description).lower().strip()

        # Convert to lowercase, strip whitespace
        normalized = description.lower().strip()

        # Remove extra spaces
        normalized = re.sub(r"\s+", " ", normalized)

        # Remove trailing punctuation
        normalized = re.sub(r"[,.]$", "", normalized)

        return normalized

    def _fuzzy_match(self, input_description: str, threshold: float = 0.8) -> List[str]:
        """Attempt fuzzy matching against known variants"""
        input_normalized = self._normalize_description(input_description)
        best_match = None
        best_score = 0

        # Check against all known variants
        for variant, canonical_tags in self.variant_to_canonical.items():
            score = SequenceMatcher(None, input_normalized, variant).ratio()
            if score > best_score and score >= threshold:
                best_score = score
                best_match = canonical_tags

        return best_match

    def _handle_unknown_description(
        self, input_description: str, row_id: int, transformation_logger
    ) -> List[str]:
        """Handle descriptions that don't match any known pattern"""
        bad_data_config = self.standardisation_config.get("bad_data_handling", {})
        strategy = bad_data_config.get("strategy", "flag_and_preserve")

        # Try fuzzy matching if enabled
        fuzzy_config = bad_data_config.get("fuzzy_matching", {})
        if fuzzy_config.get("enabled", False):
            fuzzy_match = self._fuzzy_match(
                input_description, fuzzy_config.get("threshold", 0.8)
            )

            if fuzzy_match:
                transformation_logger.log_transformation_issue(
                    domain_name="description",
                    row_id=row_id,
                    column="description",
                    original_value=input_description,
                    issue_type="fuzzy_match_applied",
                    action_taken=f"fuzzy_matched_to_{fuzzy_match}",
                    final_value=fuzzy_match,
                    requires_review=fuzzy_config.get("log_matches", True),
                )
                return fuzzy_match

        # Handle based on strategy
        flag_value = bad_data_config.get("flag_value", "UNKNOWN_DESCRIPTION")

        if strategy == "flag_and_preserve":
            final_value = (
                [f"{flag_value}: {input_description}"]
                if bad_data_config.get("preserve_original", True)
                else [flag_value]
            )
        elif strategy == "flag_and_replace":
            final_value = [flag_value]
        elif strategy == "skip_row":
            final_value = []
        else:
            final_value = [f"UNKNOWN_DESCRIPTION: {input_description}"]

        transformation_logger.log_transformation_issue(
            domain_name="description",
            row_id=row_id,
            column="description",
            original_value=input_description,
            issue_type="unknown_description",
            action_taken=strategy,
            final_value=final_value,
            requires_review=bad_data_config.get("require_manual_review", True),
        )

        return final_value

    def process_value(
        self, input_value: Any, row_id: int, transformation_logger
    ) -> List[str]:
        """
        Main processing method called by ETL Transformer

        Args:
            input_value: The input description text
            row_id: Row identifier for logging
            transformation_logger: Logger instance for recording transformations

        Returns:
            List of standardized tag strings
        """

        # Handle empty/null values
        if (
            input_value is None
            or input_value == ""
            or (isinstance(input_value, float) and input_value != input_value)
        ):  # NaN check
            return ["unknown"]  # Return ["unknown"] for empty descriptions

        # Convert to string and clean
        description_str = str(input_value).strip()

        # Normalize for lookup
        normalized_description = self._normalize_description(description_str)

        # Try direct lookup first
        if normalized_description in self.variant_to_canonical:
            canonical_tags = self.variant_to_canonical[normalized_description]

            # Log successful standardization
            transformation_logger.log_transformation_issue(
                domain_name="description",
                row_id=row_id,
                column="description",
                original_value=description_str,
                issue_type="standardization_applied",
                action_taken="variant_to_canonical",
                final_value=canonical_tags,
                requires_review=False,
            )

            return canonical_tags.copy()  # Return a copy to avoid reference issues

        # No direct match found - handle as unknown
        return self._handle_unknown_description(
            description_str, row_id, transformation_logger
        )

    def add_new_variant(
        self, canonical_tags: List[str], variant_description: str
    ) -> bool:
        """
        Add a new variant to an existing canonical tag combination

        Args:
            canonical_tags: The canonical tag array
            variant_description: New variant to add

        Returns:
            True if added successfully
        """
        try:
            # Find the entry for this canonical tag combination
            for entry in self.standardisation_config["entries"]:
                if entry["canonical"] == canonical_tags:
                    if variant_description not in entry["variants"]:
                        entry["variants"].append(variant_description)
                        self._save_standardisation_config()
                        self._build_lookup_tables()  # Rebuild lookup tables
                        return True

            # Canonical tags not found
            self.logger.warning(f"Canonical tags '{canonical_tags}' not found")
            return False

        except Exception as e:
            self.logger.error(f"Error adding variant: {str(e)}")
            return False

    def add_new_description_mapping(
        self, canonical_tags: List[str], variants: List[str] = None
    ) -> bool:
        """
        Add a completely new description mapping

        Args:
            canonical_tags: The canonical tag array
            variants: List of variant descriptions (optional)

        Returns:
            True if added successfully
        """
        try:
            # Check if already exists
            for entry in self.standardisation_config["entries"]:
                if entry["canonical"] == canonical_tags:
                    self.logger.warning(
                        f"Tag combination '{canonical_tags}' already exists"
                    )
                    return False

            new_entry = {
                "canonical": canonical_tags,
                "variants": variants or [],
            }

            self.standardisation_config["entries"].append(new_entry)
            self._save_standardisation_config()
            self._build_lookup_tables()  # Rebuild lookup tables

            self.logger.info(f"Added new description mapping: {canonical_tags}")
            return True

        except Exception as e:
            self.logger.error(f"Error adding new description mapping: {str(e)}")
            return False

    def _save_standardisation_config(self):
        """Save standardisation configuration to file"""
        try:
            DOMAIN_PATH.mkdir(exist_ok=True)
            with open(STANDARDISATION_FILE, "w") as f:
                json.dump(self.standardisation_config, f, indent=4)
        except Exception as e:
            self.logger.error(f"Error saving standardisation config: {str(e)}")

    def get_statistics(self) -> dict:
        """Get statistics about the current standardisation rules"""
        total_entries = len(self.standardisation_config.get("entries", []))
        total_variants = sum(
            len(entry.get("variants", []))
            for entry in self.standardisation_config.get("entries", [])
        )

        # Count unique tag combinations
        tag_combinations = set()
        for entry in self.standardisation_config.get("entries", []):
            tag_combinations.add(tuple(sorted(entry["canonical"])))

        return {
            "total_tag_combinations": len(tag_combinations),
            "total_entries": total_entries,
            "total_variants": total_variants,
            "average_variants_per_entry": total_variants / max(total_entries, 1),
            "available_tags": sorted(list(self.canonical_tags)),
            "tag_combinations": [list(combo) for combo in tag_combinations],
        }


# Global processor instance
_processor = None


def get_processor():
    """Get the global processor instance (singleton pattern)"""
    global _processor
    if _processor is None:
        _processor = DescriptionProcessor()
    return _processor


def process_value(input_value: Any, row_id: int, transformation_logger) -> List[str]:
    """
    Main entry point called by ETL Transformer
    This is the function that the transformer will call
    """
    processor = get_processor()
    return processor.process_value(input_value, row_id, transformation_logger)


# Additional utility functions for external use
def add_variant(canonical_tags: List[str], variant_description: str) -> bool:
    """Add a new variant to existing tag combination"""
    processor = get_processor()
    return processor.add_new_variant(canonical_tags, variant_description)


def add_mapping(canonical_tags: List[str], variants: List[str] = None) -> bool:
    """Add a new description mapping"""
    processor = get_processor()
    return processor.add_new_description_mapping(canonical_tags, variants)


def get_stats() -> dict:
    """Get standardisation statistics"""
    processor = get_processor()
    return processor.get_statistics()


if __name__ == "__main__":
    # Test the module
    print("Testing Description Logic...")

    processor = get_processor()
    stats = processor.get_statistics()
    print(f"Loaded {stats['total_entries']} description mappings")
    print(f"Available tags: {stats['available_tags']}")

    # Test cases
    test_cases = [
        "quantity of plant",  # Should map to ["plant"]
        "quantity of plant and seed",  # Should map to ["plant", "seed"]
        "quantity of plants and rootballs",  # Should map to ["plant", "rootball"]
        "something completely unknown",  # Should trigger unknown handling
        "",  # Empty value
        None,  # Null value
    ]

    class MockLogger:
        def log_transformation_issue(self, **kwargs):
            print(f"LOG: {kwargs}")

    mock_logger = MockLogger()

    for i, test_case in enumerate(test_cases):
        result = process_value(test_case, i, mock_logger)
        print(f"'{test_case}' -> {result}")

    # Print statistics
    print("\nStatistics:")
    stats = get_stats()
    for key, value in stats.items():
        if key != "tag_combinations":  # Skip the long list for readability
            print(f"  {key}: {value}")
