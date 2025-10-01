"""
Police Data Parser

This module provides parsing functionality for police officer and station data
from cannabis_final.json. It handles name parsing, rank mapping, and organization
extraction for PoliceOfficer and PoliceStation model creation.

Requirements: 4.1
"""

from typing import Dict, List, Optional, Tuple, Any
from dataclasses import dataclass
import logging
import re

logger = logging.getLogger(__name__)


@dataclass
class ParsedOfficerData:
    """Structured data for parsed police officer information"""

    first_name: Optional[str] = None
    last_name: Optional[str] = None
    rank: str = "unknown"
    badge_number: Optional[str] = None
    station_name: Optional[str] = None
    is_valid: bool = True
    parsing_notes: Optional[str] = None


class PoliceDataParser:
    """
    Parses police officer and station data from JSON records.

    Handles name parsing, rank mapping to SeniorityChoices enum values,
    and organization name extraction for PoliceStation creation.
    """

    # Mapping from JSON rank strings to PoliceOfficer.SeniorityChoices values
    RANK_MAPPING = {
        # Direct mappings
        "unknown": "unknown",
        "unsworn": "unsworn",
        "officer": "officer",
        "probationary constable": "probationary_constable",
        "constable": "constable",
        "detective": "detective",
        "first class constable": "first_class_constable",
        "senior constable": "senior_constable",
        "detective senior constable": "detective_senior_constable",
        "conveying officer": "conveying_officer",
        # Common variations and abbreviations
        "prob constable": "probationary_constable",
        "prob. constable": "probationary_constable",
        "probationary const": "probationary_constable",
        "first class const": "first_class_constable",
        "1st class constable": "first_class_constable",
        "senior const": "senior_constable",
        "snr constable": "senior_constable",
        "sr constable": "senior_constable",
        "detective snr constable": "detective_senior_constable",
        "detective sr constable": "detective_senior_constable",
        "det senior constable": "detective_senior_constable",
        "det snr constable": "detective_senior_constable",
        "det": "detective",
        "const": "constable",
        "pc": "constable",  # Police Constable
        "spc": "senior_constable",  # Senior Police Constable
        # Additional common ranks that might appear
        "sergeant": "senior_constable",  # Map to closest equivalent
        "sgt": "senior_constable",
        "corporal": "senior_constable",
        "cpl": "senior_constable",
    }

    # Common name prefixes and suffixes to handle
    NAME_PREFIXES = {"mr", "mrs", "ms", "miss", "dr", "prof", "rev"}
    NAME_SUFFIXES = {"jr", "sr", "ii", "iii", "iv"}

    def __init__(self):
        """Initialize the police data parser"""
        pass

    def parse_police_officer_data(
        self, police_officer_json: Dict[str, Any]
    ) -> Tuple[ParsedOfficerData, ParsedOfficerData]:
        """
        Parse complete police officer JSON data into submitting and requesting officer data.

        Args:
            police_officer_json: Complete police_officer section from JSON record

        Returns:
            Tuple[ParsedOfficerData, ParsedOfficerData]: (submitting_officer, requesting_officer)
        """
        try:
            # Extract organization name
            organization = police_officer_json.get("organisation", "").strip()
            station_name = (
                self._parse_organization_name(organization) if organization else None
            )

            # Parse submitting officer
            submitting_data = police_officer_json.get("submitting_officer", {})
            submitting_officer = self._parse_single_officer(
                submitting_data, station_name
            )

            # Parse requesting officer
            requesting_data = police_officer_json.get("requesting_officer", {})
            requesting_officer = self._parse_single_officer(
                requesting_data, station_name
            )

            return submitting_officer, requesting_officer

        except Exception as e:
            logger.error(f"Error parsing police officer data: {e}")
            # Return empty officer data with error notes
            error_officer = ParsedOfficerData(
                is_valid=False, parsing_notes=f"Parsing error: {e}"
            )
            return error_officer, error_officer

    def _parse_single_officer(
        self, officer_json: Dict[str, Any], station_name: Optional[str] = None
    ) -> ParsedOfficerData:
        """
        Parse a single officer's data (submitting or requesting).

        Args:
            officer_json: Officer JSON data
            station_name: Optional station name from organization

        Returns:
            ParsedOfficerData: Parsed officer data
        """
        try:
            # Extract basic fields
            name = officer_json.get("name", "").strip()
            rank_str = officer_json.get("rank", "").strip()
            badge_id = officer_json.get("badge_id", "").strip()

            # Parse name into first and last name
            first_name, last_name = self._parse_officer_name(name)

            # Map rank to seniority choice
            rank = self._map_rank_to_seniority(rank_str)

            # Clean badge number
            badge_number = badge_id if badge_id else None

            # Determine if officer data is valid
            is_valid = bool(name or rank_str or badge_id)

            parsing_notes = None
            if not is_valid:
                parsing_notes = "Empty officer data"
            elif not name:
                parsing_notes = "Missing officer name"

            return ParsedOfficerData(
                first_name=first_name,
                last_name=last_name,
                rank=rank,
                badge_number=badge_number,
                station_name=station_name,
                is_valid=is_valid,
                parsing_notes=parsing_notes,
            )

        except Exception as e:
            logger.error(f"Error parsing single officer data: {e}")
            return ParsedOfficerData(
                is_valid=False, parsing_notes=f"Parsing error: {e}"
            )

    def _parse_officer_name(self, name: str) -> Tuple[Optional[str], Optional[str]]:
        """
        Parse officer name into first_name and last_name fields.

        Handles various name formats including prefixes, suffixes, and single names.

        Args:
            name: Full name string

        Returns:
            Tuple[Optional[str], Optional[str]]: (first_name, last_name)
        """
        if not name:
            return None, None

        # Clean and normalize the name
        name = name.strip()

        # Remove common punctuation
        name = re.sub(r"[,.]", "", name)

        # Split into parts
        parts = name.split()

        if not parts:
            return None, None

        # Handle single name
        if len(parts) == 1:
            # Single name - treat as last name (common in police records)
            return None, parts[0]

        # Filter out prefixes and suffixes
        filtered_parts = []
        for part in parts:
            part_lower = part.lower()
            if (
                part_lower not in self.NAME_PREFIXES
                and part_lower not in self.NAME_SUFFIXES
            ):
                filtered_parts.append(part)

        if not filtered_parts:
            # All parts were prefixes/suffixes - use original
            filtered_parts = parts

        # Handle filtered parts
        if len(filtered_parts) == 1:
            return None, filtered_parts[0]
        elif len(filtered_parts) == 2:
            return filtered_parts[0], filtered_parts[1]
        else:
            # Multiple names - first is first name, rest combined as last name
            return filtered_parts[0], " ".join(filtered_parts[1:])

    def _map_rank_to_seniority(self, rank_str: str) -> str:
        """
        Map rank string to PoliceOfficer.SeniorityChoices enum values.

        Args:
            rank_str: Rank string from JSON data

        Returns:
            str: Mapped seniority choice value
        """
        if not rank_str:
            return "unknown"

        # Normalize rank string
        rank_normalized = rank_str.lower().strip()

        # Remove common punctuation
        rank_normalized = re.sub(r"[.,]", "", rank_normalized)

        # Direct lookup
        mapped_rank = self.RANK_MAPPING.get(rank_normalized)

        if mapped_rank:
            return mapped_rank

        # Partial matching for complex rank strings
        mapped_rank = self._find_partial_rank_match(rank_normalized)

        if mapped_rank:
            return mapped_rank

        # Log unmapped rank for future reference
        logger.warning(f"Unmapped rank '{rank_str}', using 'unknown'")
        return "unknown"

    def _find_partial_rank_match(self, rank_normalized: str) -> Optional[str]:
        """
        Find partial matches for complex rank strings.

        Args:
            rank_normalized: Normalized rank string

        Returns:
            Optional[str]: Matched seniority choice or None
        """
        # Keywords that indicate specific ranks
        rank_keywords = {
            "detective": "detective",
            "senior": "senior_constable",
            "first class": "first_class_constable",
            "probationary": "probationary_constable",
            "conveying": "conveying_officer",
            "constable": "constable",
            "officer": "officer",
            "sergeant": "senior_constable",
            "corporal": "senior_constable",
        }

        # Check for keyword matches (order matters - most specific first)
        for keyword, rank_value in rank_keywords.items():
            if keyword in rank_normalized:
                logger.info(
                    f"Partial rank match: '{rank_normalized}' -> '{rank_value}' via keyword '{keyword}'"
                )
                return rank_value

        return None

    def _parse_organization_name(self, organization: str) -> Optional[str]:
        """
        Extract organization names for PoliceStation creation.

        Cleans and normalizes organization names from the JSON data.

        Args:
            organization: Organization string from JSON data

        Returns:
            Optional[str]: Cleaned organization name or None
        """
        if not organization:
            return None

        # Clean the organization name
        org_name = organization.strip()

        # Remove common suffixes that don't add value
        suffixes_to_remove = [" Police Station", " Police", " Dept", " Department"]

        for suffix in suffixes_to_remove:
            if org_name.endswith(suffix):
                org_name = org_name[: -len(suffix)].strip()

        # Ensure we still have a meaningful name
        if len(org_name) < 2:
            return organization  # Return original if cleaning made it too short

        return org_name

    def validate_officer_data(self, officer_data: ParsedOfficerData) -> List[str]:
        """
        Validate parsed officer data and return list of validation issues.

        Args:
            officer_data: Parsed officer data to validate

        Returns:
            List[str]: List of validation issues (empty if valid)
        """
        issues = []

        if not officer_data.is_valid:
            issues.append("Officer data marked as invalid")

        if not officer_data.first_name and not officer_data.last_name:
            issues.append("Missing both first and last name")

        if (
            officer_data.rank == "unknown"
            and officer_data.parsing_notes != "Empty officer data"
        ):
            issues.append("Could not determine officer rank")

        if officer_data.badge_number and len(officer_data.badge_number) > 20:
            issues.append("Badge number exceeds maximum length")

        return issues

    def get_unmapped_ranks(self, ranks: List[str]) -> List[str]:
        """
        Get list of ranks that don't have direct mappings.

        Useful for identifying new rank types that need to be added
        to the mapping dictionary.

        Args:
            ranks: List of rank strings to check

        Returns:
            List[str]: List of unmapped ranks
        """
        unmapped = []

        for rank in ranks:
            if not rank:
                continue

            rank_normalized = rank.lower().strip()
            rank_normalized = re.sub(r"[.,]", "", rank_normalized)

            # Check direct mapping
            if rank_normalized not in self.RANK_MAPPING:
                # Check partial matching
                if not self._find_partial_rank_match(rank_normalized):
                    unmapped.append(rank)

        return unmapped
