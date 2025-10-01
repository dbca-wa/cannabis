"""
Cannabis Data Mapper

This module provides mapping functions to convert JSON data from cannabis_final.json
to Django model field data structures. It handles data type conversions, field
exclusions, and data validation.

Requirements: 4.5, 7.4
"""

from datetime import datetime
from typing import Dict, List, Optional, Any, Union
from dataclasses import dataclass
from decimal import Decimal
import logging

from .content_type_mapper import ContentTypeMapper
from .police_data_parser import PoliceDataParser

# Import models for choice validation
from submissions.models import BotanicalAssessment

logger = logging.getLogger(__name__)


# Data classes for structured mapping results
@dataclass
class SubmissionData:
    """Structured data for Submission model creation"""

    legacy_id: str
    case_number: str
    received: datetime
    approved_botanist: Optional[str] = None
    internal_comments: Optional[str] = None
    security_movement_envelope: Optional[str] = None


@dataclass
class PoliceOfficerData:
    """Structured data for PoliceOfficer model creation"""

    first_name: Optional[str] = None
    last_name: Optional[str] = None
    rank: str = "unknown"
    badge_number: Optional[str] = None
    station_name: Optional[str] = None


@dataclass
class DefendantData:
    """Structured data for Defendant model creation"""

    first_name: Optional[str] = None
    last_name: Optional[str] = None


@dataclass
class DrugBagData:
    """Structured data for DrugBag model creation"""

    content_type: str
    seal_tag_numbers: str
    new_seal_tag_numbers: Optional[str] = None
    property_reference: Optional[str] = None
    gross_weight: Optional[Decimal] = None
    net_weight: Optional[Decimal] = None


@dataclass
class BotanicalAssessmentData:
    """Structured data for BotanicalAssessment model creation"""

    determination: Optional[str] = None
    assessment_date: Optional[datetime] = None
    botanist_notes: Optional[str] = None


class CannabisDataMapper:
    """
    Maps JSON data from cannabis_final.json to Django model field structures.

    Handles data type conversions, field exclusions for debugging fields,
    and provides structured data objects for model creation.
    """

    # Fields to exclude from processing (debugging/processing artifacts)
    EXCLUDED_FIELDS = {
        "complex_case_details",
        "standardization_applied",
        "django_compatibility",
        "processing_notes",
        "temporal_info",
        "validation_flags",
        "extraction_details",
    }

    def __init__(self):
        """Initialize the data mapper"""
        self.content_type_mapper = ContentTypeMapper()
        self.police_parser = PoliceDataParser()

    def map_submission_data(self, json_record: Dict[str, Any]) -> SubmissionData:
        """
        Map JSON record to Submission model data structure.

        Args:
            json_record: Complete JSON record from cannabis_final.json

        Returns:
            SubmissionData: Structured data for Submission model creation

        Raises:
            ValueError: If required fields are missing or invalid
        """
        try:
            # Extract required fields
            legacy_id = str(json_record.get("row_id", ""))
            if not legacy_id:
                raise ValueError("Missing required field: row_id")

            # Get cert_number for security movement envelope
            cert_number = json_record.get("cert_number")
            if not cert_number:
                raise ValueError("Missing required field: cert_number")

            # Use police reference number as case number
            case_number = json_record.get("police_reference_number", "")
            if not case_number:
                # Fallback to cert_number if police_reference_number is missing
                case_number = f"CRT-{cert_number}"

            # Parse received date from receipt_date (now a string)
            received_str = json_record.get("receipt_date")
            if not received_str:
                raise ValueError("Missing required field: receipt_date")

            received = self._parse_date(received_str)

            # Optional fields
            approved_botanist = json_record.get("approved_botanist")

            # Generate security movement envelope from cert_number
            security_movement_envelope = f"SME-{cert_number}"

            # Get internal comments (now simplified)
            internal_comments = self._get_internal_comments(json_record)

            return SubmissionData(
                legacy_id=legacy_id,
                case_number=case_number,
                received=received,
                approved_botanist=approved_botanist,
                internal_comments=internal_comments,
                security_movement_envelope=security_movement_envelope,
            )

        except Exception as e:
            logger.error(
                f"Error mapping submission data for row_id {json_record.get('row_id')}: {e}"
            )
            raise

    def map_police_officer_data(
        self, police_officer_json: Dict[str, Any]
    ) -> tuple[PoliceOfficerData, PoliceOfficerData]:
        """
        Map JSON police officer data to PoliceOfficer model data structures.

        Args:
            police_officer_json: Complete police_officer section from JSON record

        Returns:
            tuple[PoliceOfficerData, PoliceOfficerData]: (submitting_officer, requesting_officer)
        """
        try:
            # Parse both officers using the police data parser
            submitting_parsed, requesting_parsed = (
                self.police_parser.parse_police_officer_data(police_officer_json)
            )

            # Convert to PoliceOfficerData structures
            submitting_officer = PoliceOfficerData(
                first_name=submitting_parsed.first_name,
                last_name=submitting_parsed.last_name,
                rank=submitting_parsed.rank,
                badge_number=submitting_parsed.badge_number,
                station_name=submitting_parsed.station_name,
            )

            requesting_officer = PoliceOfficerData(
                first_name=requesting_parsed.first_name,
                last_name=requesting_parsed.last_name,
                rank=requesting_parsed.rank,
                badge_number=requesting_parsed.badge_number,
                station_name=requesting_parsed.station_name,
            )

            return submitting_officer, requesting_officer

        except Exception as e:
            logger.error(f"Error mapping police officer data: {e}")
            raise

    def map_defendant_data(
        self, defendants_json: List[Dict[str, Any]]
    ) -> List[DefendantData]:
        """
        Map JSON defendants array to list of Defendant model data structures.

        Args:
            defendants_json: List of defendant JSON objects

        Returns:
            List[DefendantData]: List of structured data for Defendant model creation
        """
        defendants = []

        for defendant_json in defendants_json:
            try:
                given_names = defendant_json.get("given_names", "").strip()
                last_name = defendant_json.get("last_name", "").strip()

                # Skip empty defendants
                if not given_names and not last_name:
                    continue

                defendants.append(
                    DefendantData(
                        first_name=given_names if given_names else None,
                        last_name=last_name if last_name else None,
                    )
                )

            except Exception as e:
                logger.warning(f"Error mapping defendant data: {e}")
                continue

        return defendants

    def map_drug_bag_data(self, json_record: Dict[str, Any]) -> DrugBagData:
        """
        Map JSON record to single DrugBag model data structure.

        Creates one DrugBag per submission with comma-separated tag numbers and descriptions.
        This approach treats all tags and descriptions as belonging to one submission bag.

        Args:
            json_record: Complete JSON record from cannabis_final.json

        Returns:
            DrugBagData: Single structured data for DrugBag model creation
        """
        try:
            # Get array data
            tag_numbers = json_record.get("tag_numbers", [])
            descriptions = json_record.get("description", [])
            property_reference = json_record.get("police_reference_number", "")

            # Get new tag numbers from result section
            result_section = json_record.get("result", {})
            new_tag_numbers = result_section.get("new_tag_numbers", [])

            # Combine all tag numbers into comma-separated string
            seal_tag_numbers = ", ".join(tag_numbers) if tag_numbers else "UNKNOWN"

            # Combine all new tag numbers into comma-separated string
            new_seal_tag_numbers = (
                ", ".join(new_tag_numbers) if new_tag_numbers else None
            )

            # Determine primary content type from first description, or use default
            if descriptions:
                primary_description = descriptions[0]
                content_type = self.content_type_mapper.map_description_to_content_type(
                    primary_description
                )
            else:
                content_type = "plant"  # Default fallback

            logger.debug(
                f"Mapped single drug bag: tags={seal_tag_numbers}, "
                f"new_tags={new_seal_tag_numbers}, content_type={content_type}, "
                f"descriptions={descriptions}"
            )

            return DrugBagData(
                content_type=content_type,
                seal_tag_numbers=seal_tag_numbers,
                new_seal_tag_numbers=new_seal_tag_numbers,
                property_reference=property_reference,
            )

        except Exception as e:
            logger.error(
                f"Error mapping drug bag data for row_id {json_record.get('row_id')}: {e}"
            )
            raise

    def map_botanical_assessment_data(
        self, result_json: Dict[str, Any], cert_date_str: str
    ) -> BotanicalAssessmentData:
        """
        Map JSON result data to BotanicalAssessment model data structure.

        Maps result.identified_as to determination field, extracts botanist_notes
        from result.botanist_notes, parses assessment_date from cert_date string.

        Args:
            result_json: Result section from JSON record
            cert_date_str: Cert_date string from JSON record

        Returns:
            BotanicalAssessmentData: Structured data for BotanicalAssessment model creation
        """
        try:
            # Map result.identified_as to determination field
            identified_as = result_json.get("identified_as", "").strip()
            determination = self._map_identification_to_determination(identified_as)

            # Parse assessment_date from cert_date string
            assessment_date = None
            if cert_date_str:
                assessment_date = self._parse_date(cert_date_str)

            # Extract botanist_notes (now directly available)
            botanist_notes = result_json.get("botanist_notes")
            if botanist_notes:
                botanist_notes = (
                    botanist_notes.strip() if botanist_notes.strip() else None
                )

            logger.debug(
                f"Mapped botanical assessment: determination={determination}, "
                f"assessment_date={assessment_date}, "
                f"botanist_notes={'present' if botanist_notes else 'none'}"
            )

            return BotanicalAssessmentData(
                determination=determination,
                assessment_date=assessment_date,
                botanist_notes=botanist_notes,
            )

        except Exception as e:
            logger.error(f"Error mapping botanical assessment data: {e}")
            raise

    def _parse_date(self, date_str: str) -> datetime:
        """
        Parse standardized date string to datetime object.

        Args:
            date_str: Date string in YYYY-MM-DD format

        Returns:
            datetime: Parsed datetime object

        Raises:
            ValueError: If date string is invalid
        """
        try:
            return datetime.strptime(date_str, "%Y-%m-%d")
        except ValueError as e:
            raise ValueError(f"Invalid date format '{date_str}': {e}")

    def _map_identification_to_determination(self, identified_as: str) -> Optional[str]:
        """
        Map identification string to BotanicalAssessment.DeterminationChoices value.

        Maps result.identified_as to determination field with comprehensive mapping logic.
        Updated to handle specific botanical identifications found in cannabis data.

        Args:
            identified_as: Identification string from result data

        Returns:
            str: Mapped determination choice value or None
        """
        if not identified_as:
            return BotanicalAssessment.DeterminationChoices.PENDING

        identified_lower = identified_as.lower().strip()

        # Exact matches for specific identifications found in data
        if identified_as == "Cannabis sativa":
            return BotanicalAssessment.DeterminationChoices.CANNABIS_SATIVA
        elif identified_as == "Mixed":
            return BotanicalAssessment.DeterminationChoices.MIXED
        elif identified_as == "Papaver somniferum":
            return BotanicalAssessment.DeterminationChoices.PAPAVER_SOMNIFERUM
        elif identified_as == "Unidentifiable":
            return BotanicalAssessment.DeterminationChoices.UNIDENTIFIABLE

        # Fallback pattern matching for variations
        if "cannabis sativa" in identified_lower:
            return BotanicalAssessment.DeterminationChoices.CANNABIS_SATIVA
        elif "cannabis indica" in identified_lower:
            return BotanicalAssessment.DeterminationChoices.CANNABIS_INDICA
        elif "cannabis" in identified_lower and (
            "hybrid" in identified_lower or "mix" in identified_lower
        ):
            return BotanicalAssessment.DeterminationChoices.CANNABIS_HYBRID
        elif "mixed" in identified_lower:
            return BotanicalAssessment.DeterminationChoices.MIXED
        elif "cannabis" in identified_lower:
            return (
                BotanicalAssessment.DeterminationChoices.CANNABIS_SATIVA
            )  # Default cannabis type
        elif "papaver somniferum" in identified_lower or "papaver" in identified_lower:
            return BotanicalAssessment.DeterminationChoices.PAPAVER_SOMNIFERUM
        elif "unidentifiable" in identified_lower:
            return BotanicalAssessment.DeterminationChoices.UNIDENTIFIABLE
        elif "degraded" in identified_lower:
            return BotanicalAssessment.DeterminationChoices.DEGRADED
        elif any(
            word in identified_lower
            for word in ["not cannabis", "non-cannabis", "poppy"]
        ):
            return BotanicalAssessment.DeterminationChoices.NOT_CANNABIS
        elif any(
            word in identified_lower for word in ["inconclusive", "unsure", "uncertain"]
        ):
            return BotanicalAssessment.DeterminationChoices.INCONCLUSIVE
        else:
            # Log unknown identification for future reference
            logger.warning(
                f"Unknown identification '{identified_as}', mapping to 'inconclusive'"
            )
            return BotanicalAssessment.DeterminationChoices.INCONCLUSIVE

    def _get_internal_comments(self, json_record: Dict[str, Any]) -> Optional[str]:
        """
        Get internal comments from simplified JSON structure.

        Args:
            json_record: Complete JSON record from cannabis_clean.json

        Returns:
            str: Combined internal comments or None if no comments found
        """
        comments = []

        # Get other_matters (now a string)
        other_matters = json_record.get("other_matters")
        if other_matters and other_matters.strip():
            comments.append(f"Other Matters: {other_matters.strip()}")

        # Get internal_comments (now a string)
        internal_comments = json_record.get("internal_comments")
        if internal_comments and internal_comments.strip():
            comments.append(f"Internal Comments: {internal_comments.strip()}")

        return "\n\n".join(comments) if comments else None

    def exclude_debugging_fields(self, json_record: Dict[str, Any]) -> Dict[str, Any]:
        """
        Remove debugging and processing fields from JSON record.

        Args:
            json_record: Original JSON record

        Returns:
            Dict: Cleaned JSON record with debugging fields removed
        """
        cleaned_record = {}

        for key, value in json_record.items():
            if key not in self.EXCLUDED_FIELDS:
                if isinstance(value, dict):
                    # Recursively clean nested dictionaries
                    cleaned_value = {}
                    for nested_key, nested_value in value.items():
                        if nested_key not in self.EXCLUDED_FIELDS:
                            cleaned_value[nested_key] = nested_value
                    cleaned_record[key] = cleaned_value
                else:
                    cleaned_record[key] = value

        return cleaned_record
