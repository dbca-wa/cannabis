#!/usr/bin/env python3
"""
Domain Logic for Police Reference Number
Handles standardization and validation of police reference numbers
"""

import json
import logging
import re
from pathlib import Path
from typing import Any

# Get the directory where this logic file is located
DOMAIN_PATH = Path(__file__).parent
STANDARDISATION_FILE = DOMAIN_PATH / "standardisation.json"


class PoliceReferenceProcessor:
    """Handles police reference number processing and standardization"""

    def __init__(self):
        self.logger = logging.getLogger(__name__)
        self.standardisation_config = self._load_standardisation_config()

        # Build lookup dictionaries for fast processing
        self.variant_to_canonical = {}
        self.canonical_references = set()
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
                default_config = {
                    "source_column_name": "Police Reference Number",
                    "sink_column_name": "police_reference_number",
                    "bad_data_handling": {
                        "strategy": "flag_and_preserve",
                        "flag_value": "UNKNOWN_REF_FORMAT",
                        "preserve_original": True,
                        "require_manual_review": True,
                    },
                    "entries": [],
                }
                self._save_standardisation_config(default_config)
                return default_config

        except Exception as e:
            self.logger.error(f"Error loading standardisation config: {str(e)}")
            return {"entries": []}

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
        self.canonical_references = set()

        for entry in self.standardisation_config.get("entries", []):
            canonical = entry["canonical"]
            self.canonical_references.add(canonical)

            # Map canonical to itself
            self.variant_to_canonical[canonical.upper().strip()] = canonical

            # Map all variants to canonical
            for variant in entry.get("variants", []):
                normalized_variant = variant.upper().strip()
                self.variant_to_canonical[normalized_variant] = canonical

    def _standardize_format(self, ref_str: str) -> str:
        """Apply format-based standardization rules"""

        # Handle scientific notation - convert to string
        if "E+" in ref_str.upper() or "e+" in ref_str:
            try:
                float_val = float(ref_str)
                return str(int(float_val))
            except (ValueError, OverflowError):
                return ref_str

        # Handle simple letter-number format - make uppercase
        if re.match(r"^[A-Za-z]\d+$", ref_str):
            return ref_str.upper()

        # For all other formats, preserve as-is (including space-separated numbers)
        return ref_str

    def process_value(
        self, input_value: Any, row_id: int, transformation_logger
    ) -> str:
        """
        Main processing method called by ETL Transformer

        Args:
            input_value: The input police reference number
            row_id: Row identifier for logging
            transformation_logger: Logger instance for recording transformations

        Returns:
            Standardized police reference number as string
        """

        # Handle empty/null values
        if input_value is None or input_value == "" or str(input_value).strip() == "":
            transformation_logger.log_transformation_issue(
                domain_name="police_reference_number",
                row_id=row_id,
                column="Police Reference Number",
                original_value=input_value,
                issue_type="missing_reference_number",
                action_taken="flag_for_review",
                final_value="EMPTY_REF_NUMBER",
                requires_review=True,
            )
            return "EMPTY_REF_NUMBER"

        # Convert to string and clean
        ref_str = str(input_value).strip()
        original_value = ref_str

        # Try direct lookup first for known variants
        lookup_key = ref_str.upper().strip()
        if lookup_key in self.variant_to_canonical:
            canonical_ref = self.variant_to_canonical[lookup_key]

            # Log successful standardization if it changed
            if canonical_ref != ref_str:
                transformation_logger.log_transformation_issue(
                    domain_name="police_reference_number",
                    row_id=row_id,
                    column="Police Reference Number",
                    original_value=original_value,
                    issue_type="standardization_applied",
                    action_taken="variant_to_canonical",
                    final_value=canonical_ref,
                    requires_review=False,
                )
                return canonical_ref

        # Apply format standardization
        standardized_ref = self._standardize_format(ref_str)

        # Log the processing result
        if standardized_ref != original_value:
            transformation_logger.log_transformation_issue(
                domain_name="police_reference_number",
                row_id=row_id,
                column="Police Reference Number",
                original_value=original_value,
                issue_type="format_standardization",
                action_taken="applied_format_rules",
                final_value=standardized_ref,
                requires_review=False,
            )
        else:
            # Log that we processed it even if no change
            transformation_logger.log_transformation_issue(
                domain_name="police_reference_number",
                row_id=row_id,
                column="Police Reference Number",
                original_value=original_value,
                issue_type="processed_successfully",
                action_taken="no_change_needed",
                final_value=standardized_ref,
                requires_review=False,
            )

        return standardized_ref


# Global processor instance
_processor = None


def get_processor():
    """Get the global processor instance (singleton pattern)"""
    global _processor
    if _processor is None:
        _processor = PoliceReferenceProcessor()
    return _processor


def process_value(input_value: Any, row_id: int, transformation_logger) -> str:
    """
    Main entry point called by ETL Transformer
    """
    processor = get_processor()
    return processor.process_value(input_value, row_id, transformation_logger)
