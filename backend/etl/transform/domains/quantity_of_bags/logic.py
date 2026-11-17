#!/usr/bin/env python3
"""
Domain Logic for Quantity of Bags
Converts word numbers to integers with validation
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


class QuantityBagsProcessor:
    """Handles quantity of bags processing and standardization"""

    def __init__(self):
        self.logger = logging.getLogger(__name__)
        self.standardisation_config = self._load_standardisation_config()

        # Build lookup dictionaries for fast processing
        self.variant_to_canonical = {}
        self.canonical_quantities = set()
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
                    "source_column_name": "Quantity of Bags",
                    "sink_column_name": "quantity_of_bags",
                    "bad_data_handling": {
                        "strategy": "flag_and_preserve",
                        "flag_value": "INVALID_QUANTITY",
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
        self.canonical_quantities = set()

        for entry in self.standardisation_config.get("entries", []):
            canonical = entry["canonical"]
            self.canonical_quantities.add(canonical)

            # Map all variants to canonical (including the canonical itself)
            for variant in entry.get("variants", []):
                normalized_variant = self._normalize_quantity(variant)
                self.variant_to_canonical[normalized_variant] = canonical

    def _normalize_quantity(self, quantity: str) -> str:
        """Normalize quantity string for consistent matching"""
        if not isinstance(quantity, str):
            return str(quantity).lower().strip()

        # Convert to lowercase, strip whitespace, normalize spaces
        normalized = quantity.lower().strip()
        normalized = re.sub(r"\s+", " ", normalized)

        return normalized

    def _extract_quantity_from_description(self, desc: str) -> Optional[int]:
        """Try to extract quantity from complex descriptions"""
        # Handle cases like "four (6 to 9, of 17 randomly selected from 174)"
        # Look for the first word that might be a quantity
        desc_lower = desc.lower().strip()

        # Split on common separators and take first part
        first_part = re.split(r"[\(\)\[\],]", desc_lower)[0].strip()

        # Try to find a number word at the beginning
        words = first_part.split()
        if len(words) > 0:
            first_word = words[0]
            normalized = self._normalize_quantity(first_word)
            if normalized in self.variant_to_canonical:
                return self.variant_to_canonical[normalized]

        # Try to find any recognizable number word in the description
        for word in words[:3]:  # Check first 3 words only
            normalized = self._normalize_quantity(word)
            if normalized in self.variant_to_canonical:
                return self.variant_to_canonical[normalized]

        return None

    def _fuzzy_match(
        self, input_quantity: str, threshold: float = 0.8
    ) -> Optional[int]:
        """Attempt fuzzy matching against known variants"""
        input_normalized = self._normalize_quantity(input_quantity)
        best_match = None
        best_score = 0

        # Check against all known variants
        for variant, canonical in self.variant_to_canonical.items():
            score = SequenceMatcher(None, input_normalized, variant).ratio()
            if score > best_score and score >= threshold:
                best_score = score
                best_match = canonical

        return best_match

    def _validate_quantity(self, quantity: int) -> bool:
        """Validate that quantity is within reasonable range"""
        validation_rules = self.standardisation_config.get("validation_rules", {})
        min_qty = validation_rules.get("min_quantity", 1)
        max_qty = validation_rules.get("max_quantity", 100)

        return min_qty <= quantity <= max_qty

    def _interactive_review(
        self, original_value: str, extracted_value: int, issue_type: str, row_id: int
    ) -> int:
        """Interactive review for problematic cases"""
        print("\n" + "=" * 60)
        print(f"QUANTITY REVIEW REQUIRED - Row {row_id}")
        print("=" * 60)
        print(f"Original value: '{original_value}'")
        print(f"Extracted value: {extracted_value}")
        print(f"Issue type: {issue_type}")

        print("\nOptions:")
        print(f"  [Enter] - Accept extracted value ({extracted_value})")
        print("  [number] - Use different number")
        print("  [a] - Add to standardisation (will ask for correct number)")
        print("  [s] - Skip this value (mark as unknown)")

        while True:
            response = input("\nYour choice: ").strip()

            if response == "":
                # Accept the extracted value
                return extracted_value
            elif response.isdigit():
                # Use different number
                new_value = int(response)
                if 1 <= new_value <= 100:
                    return new_value
                else:
                    print("Please enter a number between 1-100")
                    continue
            elif response.lower() == "a":
                # Add to standardisation with custom number
                print(f"\nWhat should '{original_value}' convert to?")
                while True:
                    std_response = input("Enter number (1-100): ").strip()
                    if std_response.isdigit():
                        std_value = int(std_response)
                        if 1 <= std_value <= 100:
                            self._add_to_standardisation(original_value, std_value)
                            return std_value
                        else:
                            print("Please enter a number between 1-100")
                    else:
                        print("Please enter a valid number")
            elif response.lower() == "s":
                # Skip this value
                return f"SKIPPED_BY_USER: {original_value}"
            else:
                print(
                    "Please press Enter, enter a number, 'a' to add to standardisation, or 's' to skip"
                )

    def _add_to_standardisation(self, original_value: str, canonical_value: int):
        """Add a new variant to the standardisation file"""
        try:
            # Find if canonical already exists
            entries = self.standardisation_config.get("entries", [])
            found_entry = None

            for entry in entries:
                if entry["canonical"] == canonical_value:
                    found_entry = entry
                    break

            if found_entry:
                # Add to existing entry
                if original_value not in found_entry["variants"]:
                    found_entry["variants"].append(original_value)
                    print(f"Added '{original_value}' as variant for {canonical_value}")
            else:
                # Create new entry
                new_entry = {
                    "canonical": canonical_value,
                    "variants": [str(canonical_value), original_value],
                }
                entries.append(new_entry)
                print(
                    f"Created new entry for {canonical_value} with variant '{original_value}'"
                )

            # Save updated config
            self._save_standardisation_config(self.standardisation_config)

            # Rebuild lookup tables
            self._build_lookup_tables()

        except Exception as e:
            print(f"Error adding to standardisation: {e}")

    def process_value(
        self, input_value: Any, row_id: int, transformation_logger
    ) -> int:
        """
        Main processing method called by ETL Transformer

        Args:
            input_value: The input quantity value
            row_id: Row identifier for logging
            transformation_logger: Logger instance for recording transformations

        Returns:
            Standardized quantity as integer
        """

        # Handle empty/null values
        if input_value is None or input_value == "" or str(input_value).strip() == "":
            transformation_logger.log_transformation_issue(
                domain_name="quantity_of_bags",
                row_id=row_id,
                column="Quantity of Bags",
                original_value=input_value,
                issue_type="missing_quantity",
                action_taken="flag_for_review",
                final_value="MISSING_QUANTITY",
                requires_review=True,
            )
            return "MISSING_QUANTITY"

        # Convert to string and clean
        quantity_str = str(input_value).strip()
        original_value = quantity_str

        # Try direct lookup first
        normalized_quantity = self._normalize_quantity(quantity_str)
        if normalized_quantity in self.variant_to_canonical:
            canonical_quantity = self.variant_to_canonical[normalized_quantity]

            # Validate the quantity
            if not self._validate_quantity(canonical_quantity):
                transformation_logger.log_transformation_issue(
                    domain_name="quantity_of_bags",
                    row_id=row_id,
                    column="Quantity of Bags",
                    original_value=original_value,
                    issue_type="quantity_out_of_range",
                    action_taken="flag_unusual_quantity",
                    final_value=f"UNUSUAL_QUANTITY: {canonical_quantity}",
                    requires_review=True,
                )
                return f"UNUSUAL_QUANTITY: {canonical_quantity}"

            # Log successful standardization if it changed
            if str(canonical_quantity) != original_value:
                transformation_logger.log_transformation_issue(
                    domain_name="quantity_of_bags",
                    row_id=row_id,
                    column="Quantity of Bags",
                    original_value=original_value,
                    issue_type="standardization_applied",
                    action_taken="word_to_number_conversion",
                    final_value=canonical_quantity,
                    requires_review=False,
                )
            else:
                # Log processing even if no change
                transformation_logger.log_transformation_issue(
                    domain_name="quantity_of_bags",
                    row_id=row_id,
                    column="Quantity of Bags",
                    original_value=original_value,
                    issue_type="already_standardized",
                    action_taken="no_change_needed",
                    final_value=canonical_quantity,
                    requires_review=False,
                )

            return canonical_quantity

        # Handle pure numeric values that might be out of normal range
        if quantity_str.isdigit():
            num_value = int(quantity_str)
            if not self._validate_quantity(num_value):
                # Interactive review for unusual numeric values
                final_value = self._interactive_review(
                    original_value, num_value, "numeric_out_of_range", row_id
                )

                transformation_logger.log_transformation_issue(
                    domain_name="quantity_of_bags",
                    row_id=row_id,
                    column="Quantity of Bags",
                    original_value=original_value,
                    issue_type="numeric_out_of_range_reviewed",
                    action_taken="interactive_review_completed",
                    final_value=final_value,
                    requires_review=False,
                )
                return final_value
            else:
                # Valid numeric value
                transformation_logger.log_transformation_issue(
                    domain_name="quantity_of_bags",
                    row_id=row_id,
                    column="Quantity of Bags",
                    original_value=original_value,
                    issue_type="numeric_value_processed",
                    action_taken="validated_numeric",
                    final_value=num_value,
                    requires_review=False,
                )
                return num_value

        # Try to extract from complex descriptions
        extracted_quantity = self._extract_quantity_from_description(quantity_str)
        if extracted_quantity is not None:
            # Interactive review for complex descriptions
            final_value = self._interactive_review(
                original_value, extracted_quantity, "complex_description", row_id
            )

            transformation_logger.log_transformation_issue(
                domain_name="quantity_of_bags",
                row_id=row_id,
                column="Quantity of Bags",
                original_value=original_value,
                issue_type="complex_description_reviewed",
                action_taken="interactive_review_completed",
                final_value=final_value,
                requires_review=False,
            )
            return final_value

        # Try fuzzy matching
        fuzzy_config = self.standardisation_config.get("bad_data_handling", {}).get(
            "fuzzy_matching", {}
        )
        if fuzzy_config.get("enabled", False):
            fuzzy_match = self._fuzzy_match(
                quantity_str, fuzzy_config.get("threshold", 0.8)
            )
            if fuzzy_match is not None:
                # Interactive review for fuzzy matches
                final_value = self._interactive_review(
                    original_value, fuzzy_match, "fuzzy_match", row_id
                )

                transformation_logger.log_transformation_issue(
                    domain_name="quantity_of_bags",
                    row_id=row_id,
                    column="Quantity of Bags",
                    original_value=original_value,
                    issue_type="fuzzy_match_reviewed",
                    action_taken="interactive_review_completed",
                    final_value=final_value,
                    requires_review=False,
                )
                return final_value

        # Handle completely unknown quantities
        print("\n" + "=" * 60)
        print(f"UNKNOWN QUANTITY - Row {row_id}")
        print("=" * 60)
        print(f"Original value: '{original_value}'")
        print("Could not parse this quantity automatically.")

        print("\nOptions:")
        print("  [number] - Enter the correct quantity")
        print("  [s] - Skip this value (mark as unknown)")

        while True:
            response = input("\nYour choice: ").strip()

            if response.isdigit():
                new_value = int(response)
                if 1 <= new_value <= 100:
                    # Ask if they want to add to standardisation
                    add_response = (
                        input(
                            f"Add '{original_value}' → {new_value} to standardisation? [y/N]: "
                        )
                        .strip()
                        .lower()
                    )
                    if add_response == "y":
                        self._add_to_standardisation(original_value, new_value)

                    transformation_logger.log_transformation_issue(
                        domain_name="quantity_of_bags",
                        row_id=row_id,
                        column="Quantity of Bags",
                        original_value=original_value,
                        issue_type="unknown_quantity_resolved",
                        action_taken="manual_input_provided",
                        final_value=new_value,
                        requires_review=False,
                    )
                    return new_value
                else:
                    print("Please enter a number between 1-100")
                    continue
            elif response.lower() == "s":
                transformation_logger.log_transformation_issue(
                    domain_name="quantity_of_bags",
                    row_id=row_id,
                    column="Quantity of Bags",
                    original_value=original_value,
                    issue_type="unknown_quantity_skipped",
                    action_taken="user_skipped",
                    final_value=f"UNKNOWN_QUANTITY: {quantity_str}",
                    requires_review=True,
                )
                return f"UNKNOWN_QUANTITY: {quantity_str}"
            else:
                print("Please enter a number or 's' to skip")
        """
        Main processing method called by ETL Transformer

        Args:
            input_value: The input quantity value
            row_id: Row identifier for logging
            transformation_logger: Logger instance for recording transformations

        Returns:
            Standardized quantity as integer
        """

        # Handle empty/null values
        if input_value is None or input_value == "" or str(input_value).strip() == "":
            transformation_logger.log_transformation_issue(
                domain_name="quantity_of_bags",
                row_id=row_id,
                column="Quantity of Bags",
                original_value=input_value,
                issue_type="missing_quantity",
                action_taken="flag_for_review",
                final_value="MISSING_QUANTITY",
                requires_review=True,
            )
            return "MISSING_QUANTITY"

        # Convert to string and clean
        quantity_str = str(input_value).strip()
        original_value = quantity_str

        # Try direct lookup first
        normalized_quantity = self._normalize_quantity(quantity_str)
        if normalized_quantity in self.variant_to_canonical:
            canonical_quantity = self.variant_to_canonical[normalized_quantity]

            # Validate the quantity
            if not self._validate_quantity(canonical_quantity):
                transformation_logger.log_transformation_issue(
                    domain_name="quantity_of_bags",
                    row_id=row_id,
                    column="Quantity of Bags",
                    original_value=original_value,
                    issue_type="quantity_out_of_range",
                    action_taken="flag_unusual_quantity",
                    final_value=f"UNUSUAL_QUANTITY: {canonical_quantity}",
                    requires_review=True,
                )
                return f"UNUSUAL_QUANTITY: {canonical_quantity}"

            # Log successful standardization if it changed
            if str(canonical_quantity) != original_value:
                transformation_logger.log_transformation_issue(
                    domain_name="quantity_of_bags",
                    row_id=row_id,
                    column="Quantity of Bags",
                    original_value=original_value,
                    issue_type="standardization_applied",
                    action_taken="word_to_number_conversion",
                    final_value=canonical_quantity,
                    requires_review=False,
                )
            else:
                # Log processing even if no change
                transformation_logger.log_transformation_issue(
                    domain_name="quantity_of_bags",
                    row_id=row_id,
                    column="Quantity of Bags",
                    original_value=original_value,
                    issue_type="already_standardized",
                    action_taken="no_change_needed",
                    final_value=canonical_quantity,
                    requires_review=False,
                )

            return canonical_quantity

        # Handle pure numeric values that might be out of normal range
        if quantity_str.isdigit():
            num_value = int(quantity_str)
            if not self._validate_quantity(num_value):
                transformation_logger.log_transformation_issue(
                    domain_name="quantity_of_bags",
                    row_id=row_id,
                    column="Quantity of Bags",
                    original_value=original_value,
                    issue_type="numeric_out_of_range",
                    action_taken="flag_unusual_numeric",
                    final_value=f"UNUSUAL_QUANTITY: {num_value}",
                    requires_review=True,
                )
                return f"UNUSUAL_QUANTITY: {num_value}"
            else:
                # Valid numeric value
                transformation_logger.log_transformation_issue(
                    domain_name="quantity_of_bags",
                    row_id=row_id,
                    column="Quantity of Bags",
                    original_value=original_value,
                    issue_type="numeric_value_processed",
                    action_taken="validated_numeric",
                    final_value=num_value,
                    requires_review=False,
                )
                return num_value

        # Try to extract from complex descriptions
        extracted_quantity = self._extract_quantity_from_description(quantity_str)
        if extracted_quantity is not None:
            transformation_logger.log_transformation_issue(
                domain_name="quantity_of_bags",
                row_id=row_id,
                column="Quantity of Bags",
                original_value=original_value,
                issue_type="extracted_from_description",
                action_taken="parsed_complex_description",
                final_value=extracted_quantity,
                requires_review=True,  # Flag for review since it's a complex case
            )
            return extracted_quantity

        # Try fuzzy matching
        fuzzy_config = self.standardisation_config.get("bad_data_handling", {}).get(
            "fuzzy_matching", {}
        )
        if fuzzy_config.get("enabled", False):
            fuzzy_match = self._fuzzy_match(
                quantity_str, fuzzy_config.get("threshold", 0.8)
            )
            if fuzzy_match is not None:
                transformation_logger.log_transformation_issue(
                    domain_name="quantity_of_bags",
                    row_id=row_id,
                    column="Quantity of Bags",
                    original_value=original_value,
                    issue_type="fuzzy_match_applied",
                    action_taken=f"fuzzy_matched_to_{fuzzy_match}",
                    final_value=fuzzy_match,
                    requires_review=True,
                )
                return fuzzy_match

        # Handle unknown quantities
        transformation_logger.log_transformation_issue(
            domain_name="quantity_of_bags",
            row_id=row_id,
            column="Quantity of Bags",
            original_value=original_value,
            issue_type="unknown_quantity_format",
            action_taken="flag_for_manual_review",
            final_value=f"UNKNOWN_QUANTITY: {quantity_str}",
            requires_review=True,
        )

        return f"UNKNOWN_QUANTITY: {quantity_str}"


# Global processor instance
_processor = None


def get_processor():
    """Get the global processor instance (singleton pattern)"""
    global _processor
    if _processor is None:
        _processor = QuantityBagsProcessor()
    return _processor


def process_value(input_value: Any, row_id: int, transformation_logger) -> int:
    """
    Main entry point called by ETL Transformer
    """
    processor = get_processor()
    return processor.process_value(input_value, row_id, transformation_logger)
