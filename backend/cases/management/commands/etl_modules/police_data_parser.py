"""
Police Data Parser

This module provides parsing functionality for police officer and station data
from cannabis_final.json. It handles name parsing, rank mapping, and organization
extraction for PoliceOfficer and PoliceStation model creation.
"""

import logging
import re
from dataclasses import dataclass
from typing import Any, Dict, List, Optional, Tuple

logger = logging.getLogger(__name__)


@dataclass
class ParsedOfficerData:
    """Structured data for parsed police officer information"""

    given_names: Optional[str] = None
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
        "unsworn": "unsworn_officer",
        "unsworn officer": "unsworn_officer",
        "sworn officer": "sworn_officer",
        "officer": "sworn_officer",
        "constable": "constable",
        "police constable": "police_constable",
        "detective": "detective",
        "first class constable": "first_class_constable",
        "senior constable": "senior_constable",
        "detective senior constable": "detective_senior_constable",
        "detective first class constable": "detective_first_class_constable",
        "senior detective": "senior_detective",
        "sergeant": "sergeant",
        "inspector": "inspector",
        # Common variations and abbreviations
        "prob constable": "police_constable",
        "prob. constable": "police_constable",
        "probationary constable": "police_constable",
        "probationary const": "police_constable",
        "first class const": "first_class_constable",
        "1st class constable": "first_class_constable",
        "senior const": "senior_constable",
        "snr constable": "senior_constable",
        "sr constable": "senior_constable",
        "detective snr constable": "detective_senior_constable",
        "detective sr constable": "detective_senior_constable",
        "det senior constable": "detective_senior_constable",
        "det snr constable": "detective_senior_constable",
        "det first class constable": "detective_first_class_constable",
        "det": "detective",
        "const": "constable",
        "pc": "police_constable",
        "spc": "senior_constable",
        "sgt": "sergeant",
        "cpl": "senior_constable",
    }

    # Common name prefixes and suffixes to handle
    NAME_PREFIXES = {"mr", "mrs", "ms", "miss", "dr", "prof", "rev"}
    NAME_SUFFIXES = {"jr", "sr", "ii", "iii", "iv"}

    # Rank-related prefixes that might appear in the name field
    # Ordered from longest to shortest for greedy matching
    RANK_PREFIXES_IN_NAME = [
        "detective senior constable",
        "detective first class constable",
        "senior constable",
        "first class constable",
        "class constable",
        "constable",
        "detective",
        "sergeant",
        "inspector",
        "officer",
        "s/c",
        "d/c",
        "s/sgt",
        "d/sgt",
        "snr",
        "sgt",
        "det",
    ]

    def __init__(self):
        """Initialize the police data parser"""

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

        Handles cases where rank information is split between the rank field
        and the name field (e.g. rank="Senior", name="Constable Marzo").

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

            # Extract badge number from trailing "Pd"/"PD" + digits in name
            # e.g., "Hull Andrea Pd" with badge "PD11983" or "Smith PD7322"
            pd_badge_match = re.search(r"\s+[Pp][Dd](\d+)$", name)
            if pd_badge_match and not badge_id:
                badge_id = f"PD{pd_badge_match.group(1)}"

            # Reconstitute rank from both fields if rank prefix is in name
            name, rank_str = self._extract_rank_from_name(name, rank_str)

            # Parse name into first and last name
            given_names, last_name = self._parse_officer_name(name)

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
                given_names=given_names,
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

    def _extract_rank_from_name(self, name: str, rank_str: str) -> Tuple[str, str]:
        """
        Extract rank prefix from name and combine with existing rank field.

        Handles patterns like:
        - name="Constable Lee", rank="First Class Constable" -> name="Lee", rank="First Class Constable"
        - name="Class Constable Randall", rank="First" -> name="Randall", rank="First Class Constable"
        - name="Constable Marzo", rank="Senior" -> name="Marzo", rank="Senior Constable"
        - name="Sgt Corkill", rank="Detective" -> name="Corkill", rank="Detective"

        Args:
            name: Officer name (may contain rank prefix)
            rank_str: Rank field value

        Returns:
            Tuple[str, str]: (cleaned_name, reconstituted_rank)
        """
        if not name:
            return name, rank_str

        name_lower = name.lower().strip()

        # Check if any rank prefix appears at the start of the name
        for prefix in self.RANK_PREFIXES_IN_NAME:
            if name_lower.startswith(prefix):
                # Verify there's actually a name after the prefix
                remainder = name[len(prefix) :].strip()
                if not remainder:
                    # The entire "name" is just a rank — don't strip it
                    break

                if rank_str:
                    # Check if the existing rank_str already maps to a valid rank
                    rank_normalized = rank_str.lower().strip()
                    rank_normalized_clean = re.sub(r"[.,]", "", rank_normalized)
                    existing_maps = (
                        rank_normalized_clean in self.RANK_MAPPING
                        or self._find_partial_rank_match(rank_normalized_clean)
                    )

                    if existing_maps:
                        # Rank field already has a valid rank — just strip prefix from name
                        logger.info(
                            f"Stripped rank prefix '{prefix}' from name, keeping rank='{rank_str}', name='{remainder}'"
                        )
                        return remainder, rank_str

                    # Try combining rank_str + prefix to form a valid rank
                    combined_rank = f"{rank_str} {prefix}".strip()
                    combined_normalized = combined_rank.lower()
                    combined_normalized = re.sub(r"[.,]", "", combined_normalized)
                    if (
                        combined_normalized in self.RANK_MAPPING
                        or self._find_partial_rank_match(combined_normalized)
                    ):
                        logger.info(
                            f"Reconstituted rank: '{rank_str}' + '{prefix}' -> '{combined_rank}', name='{remainder}'"
                        )
                        return remainder, combined_rank

                    # Neither worked — strip prefix and keep existing rank
                    logger.info(
                        f"Stripped rank prefix '{prefix}' from name (no valid combination), keeping rank='{rank_str}', name='{remainder}'"
                    )
                    return remainder, rank_str
                else:
                    # No rank field — use the prefix as the rank
                    logger.info(
                        f"Extracted rank '{prefix}' from name, name='{remainder}'"
                    )
                    return remainder, prefix

                break  # Only match the first (longest) prefix

        return name, rank_str

    def _parse_officer_name(self, name: str) -> Tuple[Optional[str], Optional[str]]:
        """
        Parse officer name into given_names and last_name fields.

        Handles various name formats including prefixes, suffixes, single names,
        comma-separated "SURNAME, GivenName" patterns, and trailing "Pd"/"PD"
        badge number leakage.

        Args:
            name: Full name string

        Returns:
            Tuple[Optional[str], Optional[str]]: (given_names, last_name)
        """
        if not name:
            return None, None

        # Clean and normalize the name
        name = name.strip()

        # Strip trailing "Pd" / "PD" optionally followed by digits (badge leakage)
        # e.g., "Hull Andrea Pd" or "Smith John PD12345"
        pd_match = re.search(r"\s+[Pp][Dd]\d*$", name)
        if pd_match:
            name = name[: pd_match.start()].strip()

        # Handle "SURNAME, GivenName" pattern (comma-separated)
        if "," in name:
            parts = name.split(",", 1)
            last_name = parts[0].strip()
            given_names = parts[1].strip() if len(parts) > 1 else None
            # If either part is empty after cleaning, fall through to normal parsing
            if last_name and given_names:
                return given_names, last_name

        # Remove common punctuation (except already handled commas)
        name = re.sub(r"[.]", "", name)

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
        # Keywords that indicate specific ranks (most specific first)
        rank_keywords = {
            "detective senior constable": "detective_senior_constable",
            "detective first class": "detective_first_class_constable",
            "senior detective": "senior_detective",
            "senior constable": "senior_constable",
            "first class constable": "first_class_constable",
            "police constable": "police_constable",
            "unsworn": "unsworn_officer",
            "sergeant": "sergeant",
            "inspector": "inspector",
            "detective": "detective",
            "senior": "senior_constable",
            "first class": "first_class_constable",
            "constable": "constable",
            "officer": "sworn_officer",
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

        if not officer_data.given_names and not officer_data.last_name:
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
