"""
Content Type Mapper

This module provides mapping functionality to convert description values from
cannabis_final.json to DrugBag ContentType choices. It handles multiple descriptions
per bag and provides fallback logic for unmapped descriptions.

Requirements: 4.7, 7.3
"""

from typing import List, Dict, Optional
import logging

logger = logging.getLogger(__name__)


class ContentTypeMapper:
    """
    Maps description values to DrugBag ContentType choices.

    Handles multiple descriptions per bag appropriately and implements
    fallback logic for unmapped descriptions.
    """

    # Mapping from description values to DrugBag.ContentType choices
    DESCRIPTION_TO_CONTENT_TYPE = {
        # Plant material variations
        "plant": "plant",
        "plant material": "plant_material",
        "cutting": "cutting",
        "stalk": "stalk",
        "stem": "stem",
        # Seed variations
        "seed": "seed",
        "seed material": "seed_material",
        "unknown seed": "unknown_seed",
        "seedling": "seedling",
        # Head and root variations
        "head": "head",
        "rootball": "rootball",
        # Poppy variations
        "poppy": "poppy",
        "poppy plant": "poppy_plant",
        "poppy capsule": "poppy_capsule",
        "poppy head": "poppy_head",
        "poppy seed": "poppy_seed",
        # Other substances
        "mushroom": "mushroom",
        "tablet": "tablet",
        # Unknown/uncertain
        "unknown": "unknown",
        "unsure": "unsure",
    }

    # Fallback content type for unmapped descriptions
    DEFAULT_CONTENT_TYPE = "plant_material"

    def __init__(self):
        """Initialize the content type mapper"""
        pass

    def map_description_to_content_type(self, description: str) -> str:
        """
        Map a single description to a DrugBag ContentType choice.

        Args:
            description: Description string from JSON data

        Returns:
            str: Mapped ContentType choice value
        """
        if not description:
            logger.warning("Empty description provided, using default content type")
            return self.DEFAULT_CONTENT_TYPE

        # Normalize description for mapping
        normalized_desc = description.lower().strip()

        # Direct mapping lookup
        content_type = self.DESCRIPTION_TO_CONTENT_TYPE.get(normalized_desc)

        if content_type:
            return content_type

        # Fallback logic for partial matches
        content_type = self._find_partial_match(normalized_desc)

        if content_type:
            return content_type

        # Log unmapped description for future reference
        logger.warning(
            f"Unmapped description '{description}', using default content type '{self.DEFAULT_CONTENT_TYPE}'"
        )
        return self.DEFAULT_CONTENT_TYPE

    def map_descriptions_to_content_types(self, descriptions: List[str]) -> List[str]:
        """
        Map multiple descriptions to ContentType choices.

        Args:
            descriptions: List of description strings from JSON data

        Returns:
            List[str]: List of mapped ContentType choice values
        """
        if not descriptions:
            logger.warning(
                "Empty descriptions list provided, using default content type"
            )
            return [self.DEFAULT_CONTENT_TYPE]

        content_types = []
        for description in descriptions:
            content_type = self.map_description_to_content_type(description)
            content_types.append(content_type)

        return content_types

    def get_primary_content_type(self, descriptions: List[str]) -> str:
        """
        Get the primary content type from multiple descriptions.

        Uses priority logic to determine the most appropriate content type
        when multiple descriptions are present.

        Args:
            descriptions: List of description strings from JSON data

        Returns:
            str: Primary ContentType choice value
        """
        if not descriptions:
            return self.DEFAULT_CONTENT_TYPE

        content_types = self.map_descriptions_to_content_types(descriptions)

        # Priority order for content types (most specific first)
        priority_order = [
            "cannabis_sativa",
            "cannabis_indica",
            "cannabis_hybrid",
            "poppy_plant",
            "poppy_head",
            "poppy_seed",
            "poppy_capsule",
            "poppy",
            "mushroom",
            "tablet",
            "plant",
            "head",
            "seed",
            "cutting",
            "stalk",
            "stem",
            "seedling",
            "rootball",
            "seed_material",
            "plant_material",
            "unknown_seed",
            "unknown",
            "unsure",
        ]

        # Find the highest priority content type
        for priority_type in priority_order:
            if priority_type in content_types:
                return priority_type

        # Fallback to first content type if no priority match
        return content_types[0] if content_types else self.DEFAULT_CONTENT_TYPE

    def handle_multiple_descriptions_per_bag(
        self, descriptions: List[str], quantity_of_bags: int
    ) -> List[Dict[str, str]]:
        """
        Handle multiple descriptions per bag by creating appropriate bag mappings.

        Args:
            descriptions: List of description strings from JSON data
            quantity_of_bags: Number of bags in the submission

        Returns:
            List[Dict]: List of bag mappings with content_type and description
        """
        if not descriptions:
            return [
                {
                    "content_type": self.DEFAULT_CONTENT_TYPE,
                    "description": "plant material",
                }
            ]

        bag_mappings = []

        # If we have the same number of descriptions as bags, map 1:1
        if len(descriptions) == quantity_of_bags:
            for description in descriptions:
                content_type = self.map_description_to_content_type(description)
                bag_mappings.append(
                    {"content_type": content_type, "description": description}
                )

        # If we have more descriptions than bags, use primary content type
        elif len(descriptions) > quantity_of_bags:
            primary_content_type = self.get_primary_content_type(descriptions)
            combined_description = ", ".join(descriptions)

            for _ in range(quantity_of_bags):
                bag_mappings.append(
                    {
                        "content_type": primary_content_type,
                        "description": combined_description,
                    }
                )

        # If we have fewer descriptions than bags, repeat the pattern
        else:
            for i in range(quantity_of_bags):
                description_index = i % len(descriptions)
                description = descriptions[description_index]
                content_type = self.map_description_to_content_type(description)

                bag_mappings.append(
                    {"content_type": content_type, "description": description}
                )

        return bag_mappings

    def _find_partial_match(self, normalized_desc: str) -> Optional[str]:
        """
        Find partial matches for unmapped descriptions.

        Args:
            normalized_desc: Normalized description string

        Returns:
            Optional[str]: Matched ContentType choice value or None
        """
        # Partial matching logic for common variations
        partial_matches = {
            "cannabis": "plant",
            "marijuana": "plant",
            "weed": "plant",
            "herb": "plant_material",
            "leaf": "plant_material",
            "flower": "head",
            "bud": "head",
            "root": "rootball",
            "branch": "stem",
            "twig": "stem",
            "pod": "seed",
            "capsule": "poppy_capsule",
            "pill": "tablet",
            "powder": "unknown",
            "resin": "unknown",
            "oil": "unknown",
        }

        for keyword, content_type in partial_matches.items():
            if keyword in normalized_desc:
                logger.info(
                    f"Partial match found for '{normalized_desc}': mapped to '{content_type}' via keyword '{keyword}'"
                )
                return content_type

        return None

    def get_unmapped_descriptions(self, descriptions: List[str]) -> List[str]:
        """
        Get list of descriptions that don't have direct mappings.

        Useful for identifying new description types that need to be added
        to the mapping dictionary.

        Args:
            descriptions: List of description strings to check

        Returns:
            List[str]: List of unmapped descriptions
        """
        unmapped = []

        for description in descriptions:
            normalized_desc = description.lower().strip()

            # Check direct mapping
            if normalized_desc not in self.DESCRIPTION_TO_CONTENT_TYPE:
                # Check partial matching
                if not self._find_partial_match(normalized_desc):
                    unmapped.append(description)

        return unmapped

    def validate_content_type_choices(self, content_types: List[str]) -> List[str]:
        """
        Validate that content types match available DrugBag.ContentType choices.

        Args:
            content_types: List of content type values to validate

        Returns:
            List[str]: List of validation errors (empty if all valid)
        """
        # Valid choices from DrugBag.ContentType
        valid_choices = {
            "plant",
            "plant_material",
            "cutting",
            "stalk",
            "stem",
            "seed",
            "seed_material",
            "unknown_seed",
            "seedling",
            "head",
            "rootball",
            "poppy",
            "poppy_plant",
            "poppy_capsule",
            "poppy_head",
            "poppy_seed",
            "mushroom",
            "tablet",
            "unknown",
            "unsure",
        }

        errors = []
        for content_type in content_types:
            if content_type not in valid_choices:
                errors.append(f"Invalid content type: '{content_type}'")

        return errors
