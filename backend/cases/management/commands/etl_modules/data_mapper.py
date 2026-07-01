"""
Cannabis Data Mapper

Maps JSON data from cannabis_clean.json to Django model field data structures.
Handles JSON-unwrapping of nested string fields, data type conversions, field
exclusions, and provides structured data objects for model creation.
"""

import json
import logging
from dataclasses import dataclass
from datetime import datetime
from decimal import Decimal
from typing import Any, Dict, List, Optional
from zoneinfo import ZoneInfo

from cases.models import BotanicalAssessment

from .content_type_mapper import ContentTypeMapper
from .police_data_parser import PoliceDataParser

logger = logging.getLogger(__name__)

# Historical data originates from Perth, WA
PERTH_TZ = ZoneInfo("Australia/Perth")


@dataclass
class SubmissionData:
    """Structured data for Case (Submission) model creation."""

    legacy_id: str
    case_number: str
    received: datetime
    approved_botanist: Optional[str] = None
    internal_comments: Optional[str] = None
    additional_notes: Optional[str] = None
    security_movement_envelope: Optional[str] = None
    station_name: Optional[str] = None


@dataclass
class PoliceOfficerData:
    """Structured data for PoliceOfficer model creation."""

    given_names: Optional[str] = None
    last_name: Optional[str] = None
    rank: str = "unknown"
    badge_number: Optional[str] = None
    station_name: Optional[str] = None


@dataclass
class DefendantData:
    """Structured data for Defendant model creation."""

    given_names: Optional[str] = None
    last_name: Optional[str] = None


@dataclass
class DrugBagData:
    """Structured data for DrugBag model creation."""

    content_type: str
    seal_tag_numbers: str
    new_seal_tag_numbers: Optional[str] = None
    property_reference: Optional[str] = None
    gross_weight: Optional[Decimal] = None
    net_weight: Optional[Decimal] = None


@dataclass
class BotanicalAssessmentData:
    """Structured data for BotanicalAssessment model creation."""

    determination: Optional[str] = None
    assessment_date: Optional[datetime] = None
    botanist_notes: Optional[str] = None


class CannabisDataMapper:
    """
    Maps JSON data from cannabis_clean.json to Django model field structures.

    The source JSON has several fields stored as JSON-encoded strings (not plain
    values or dicts). This mapper unwraps them before mapping.
    """

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
        self.content_type_mapper = ContentTypeMapper()
        self.police_parser = PoliceDataParser()

    # ------------------------------------------------------------------
    # JSON unwrapping helpers
    # ------------------------------------------------------------------

    @staticmethod
    def _unwrap_json_field(value: Any, key: str) -> Any:
        """Parse a JSON-encoded string and extract the inner value by key.

        Many source fields arrive as '{"key": "actual value"}' or '{"key": null}'.
        This extracts the inner value, returning None for null or missing.
        """
        if value is None:
            return None
        if isinstance(value, str):
            stripped = value.strip()
            if stripped.startswith("{"):
                try:
                    parsed = json.loads(stripped)
                    inner = parsed.get(key)
                    # Treat empty strings as None
                    if isinstance(inner, str) and not inner.strip():
                        return None
                    return inner
                except (json.JSONDecodeError, AttributeError):
                    # Not valid JSON — treat as plain text
                    return value if value.strip() else None
            # Plain string (not JSON-wrapped)
            return value.strip() if value.strip() else None
        # Already a native type (dict, list, etc.)
        return value

    @staticmethod
    def _parse_json_string(value: Any) -> Any:
        """Parse a JSON-encoded string into its native Python type."""
        if isinstance(value, str):
            stripped = value.strip()
            if stripped.startswith("{") or stripped.startswith("["):
                try:
                    return json.loads(stripped)
                except json.JSONDecodeError:
                    return value
        return value

    # ------------------------------------------------------------------
    # Main mapping methods
    # ------------------------------------------------------------------

    def map_submission_data(self, json_record: Dict[str, Any]) -> SubmissionData:
        """Map a JSON record to SubmissionData."""
        try:
            legacy_id = str(json_record.get("row_id", ""))
            if not legacy_id:
                raise ValueError("Missing required field: row_id")

            cert_number = json_record.get("cert_number")
            if not cert_number:
                raise ValueError("Missing required field: cert_number")

            # Case number from police reference (with cert fallback)
            case_number = json_record.get("police_reference_number", "")
            if not case_number:
                case_number = f"CRT-{cert_number}"

            # Unwrap receipt_date (JSON string → standardized_date)
            receipt_raw = json_record.get("receipt_date")
            if not receipt_raw:
                raise ValueError("Missing required field: receipt_date")
            standardized_date = self._unwrap_json_field(
                receipt_raw, "standardized_date"
            )
            if not standardized_date:
                raise ValueError(
                    f"Could not extract standardized_date from receipt_date: {receipt_raw[:100]}"
                )
            received = self._parse_date(standardized_date)

            # Optional botanist
            approved_botanist = json_record.get("approved_botanist")

            # Security movement envelope
            security_movement_envelope = f"SME-{cert_number}"

            # Unwrap comments into their correct slots
            additional_notes = self._get_additional_notes(json_record)
            internal_comments = self._get_internal_comments(json_record)

            # Extract station from police_officer organisation
            station_name = self._get_station_name(json_record)

            return SubmissionData(
                legacy_id=legacy_id,
                case_number=case_number,
                received=received,
                approved_botanist=approved_botanist,
                internal_comments=internal_comments,
                additional_notes=additional_notes,
                security_movement_envelope=security_movement_envelope,
                station_name=station_name,
            )
        except Exception as e:
            logger.error(
                f"Error mapping submission data for row_id {json_record.get('row_id')}: {e}"
            )
            raise

    def map_police_officer_data(self, police_officer_json: Any) -> tuple:
        """Map police officer data (may be a JSON string) to officer dataclasses."""
        try:
            # Unwrap if it's a JSON string
            if isinstance(police_officer_json, str):
                police_officer_json = self._parse_json_string(police_officer_json)
            if not isinstance(police_officer_json, dict):
                police_officer_json = {}

            submitting_parsed, requesting_parsed = (
                self.police_parser.parse_police_officer_data(police_officer_json)
            )

            submitting_officer = PoliceOfficerData(
                given_names=submitting_parsed.given_names,
                last_name=submitting_parsed.last_name,
                rank=submitting_parsed.rank,
                badge_number=submitting_parsed.badge_number,
                station_name=submitting_parsed.station_name,
            )

            requesting_officer = PoliceOfficerData(
                given_names=requesting_parsed.given_names,
                last_name=requesting_parsed.last_name,
                rank=requesting_parsed.rank,
                badge_number=requesting_parsed.badge_number,
                station_name=requesting_parsed.station_name,
            )

            return submitting_officer, requesting_officer
        except Exception as e:
            logger.error(f"Error mapping police officer data: {e}")
            raise

    def map_defendant_data(self, defendants_json: Any) -> List[DefendantData]:
        """Map defendants array to DefendantData list.

        The source field may be a native list or a JSON-encoded string.
        """
        # Unwrap if the defendants field is a JSON string
        if isinstance(defendants_json, str):
            try:
                defendants_json = json.loads(defendants_json)
            except json.JSONDecodeError:
                logger.warning(
                    f"Could not parse defendants string: {defendants_json[:100]}"
                )
                return []

        if not isinstance(defendants_json, list):
            return []

        defendants = []
        for defendant_json in defendants_json:
            try:
                # Handle case where individual entries might be strings
                if isinstance(defendant_json, str):
                    try:
                        defendant_json = json.loads(defendant_json)
                    except json.JSONDecodeError:
                        continue

                if not isinstance(defendant_json, dict):
                    continue

                given_names = defendant_json.get("given_names", "").strip()
                last_name = defendant_json.get("last_name", "").strip()
                if not given_names and not last_name:
                    continue
                defendants.append(
                    DefendantData(
                        given_names=given_names if given_names else None,
                        last_name=last_name if last_name else None,
                    )
                )
            except Exception as e:
                logger.warning(f"Error mapping defendant data: {e}")
                continue
        return defendants

    def map_drug_bags_data(self, json_record: Dict[str, Any]) -> List[DrugBagData]:
        """Map JSON record to a list of DrugBagData (one per physical bag).

        Creates one DrugBag per tag number entry rather than one per case.
        """
        try:
            tag_numbers = json_record.get("tag_numbers", [])
            descriptions = json_record.get("description", [])
            property_reference = json_record.get("police_reference_number", "")

            result_section = json_record.get("result", {})
            new_tag_numbers = result_section.get("new_tag_numbers", [])

            if not tag_numbers:
                # Fallback: create one bag with UNKNOWN tag
                content_type = "plant"
                if descriptions:
                    content_type = (
                        self.content_type_mapper.map_description_to_content_type(
                            descriptions[0]
                        )
                    )
                return [
                    DrugBagData(
                        content_type=content_type,
                        seal_tag_numbers="UNKNOWN",
                        property_reference=property_reference,
                    )
                ]

            bags = []
            for i, tag in enumerate(tag_numbers):
                # Map content type — cycle through descriptions if shorter
                if descriptions:
                    desc_index = i % len(descriptions)
                    content_type = (
                        self.content_type_mapper.map_description_to_content_type(
                            descriptions[desc_index]
                        )
                    )
                else:
                    content_type = "plant"

                # Map new seal tag from the parallel result array
                new_tag = None
                if i < len(new_tag_numbers):
                    new_tag = new_tag_numbers[i]

                bags.append(
                    DrugBagData(
                        content_type=content_type,
                        seal_tag_numbers=tag,
                        new_seal_tag_numbers=new_tag,
                        property_reference=property_reference,
                    )
                )

            return bags
        except Exception as e:
            logger.error(
                f"Error mapping drug bags for row_id {json_record.get('row_id')}: {e}"
            )
            raise

    def map_botanical_assessment_data(
        self, result_json: Dict[str, Any], cert_date_raw: Any
    ) -> BotanicalAssessmentData:
        """Map result data to BotanicalAssessmentData."""
        try:
            identified_as = result_json.get("identified_as", "").strip()
            determination = self._map_identification_to_determination(identified_as)

            # Unwrap cert_date (JSON string → standardized_date)
            assessment_date = None
            cert_date_str = self._unwrap_json_field(cert_date_raw, "standardized_date")
            if cert_date_str:
                assessment_date = self._parse_date(cert_date_str)

            # Botanist notes from the original result text
            processing_notes = result_json.get("processing_notes", {})
            botanist_notes = None
            if isinstance(processing_notes, dict):
                original_text = processing_notes.get("original_text", "")
                if original_text and original_text.strip():
                    botanist_notes = original_text.strip()

            return BotanicalAssessmentData(
                determination=determination,
                assessment_date=assessment_date,
                botanist_notes=botanist_notes,
            )
        except Exception as e:
            logger.error(f"Error mapping botanical assessment data: {e}")
            raise

    # ------------------------------------------------------------------
    # Private helpers
    # ------------------------------------------------------------------

    def _get_additional_notes(self, json_record: Dict[str, Any]) -> Optional[str]:
        """Extract Section C 'other matters' content → Case.additional_notes."""
        raw = json_record.get("other_matters")
        value = self._unwrap_json_field(raw, "other_matters")
        if value and isinstance(value, str) and value.strip():
            return value.strip()
        return None

    def _get_internal_comments(self, json_record: Dict[str, Any]) -> Optional[str]:
        """Extract private internal comments → Case.internal_comments."""
        raw = json_record.get("internal_comments")
        value = self._unwrap_json_field(raw, "internal_comments")
        if value and isinstance(value, str) and value.strip():
            return value.strip()
        return None

    def _get_station_name(self, json_record: Dict[str, Any]) -> Optional[str]:
        """Extract organisation/station from the police_officer JSON."""
        raw = json_record.get("police_officer")
        parsed = self._parse_json_string(raw) if isinstance(raw, str) else raw
        if isinstance(parsed, dict):
            org = parsed.get("organisation", "")
            if org and org.strip():
                return org.strip()
        return None

    def _parse_date(self, date_str: str) -> datetime:
        """Parse YYYY-MM-DD date string and localise to Perth, WA timezone."""
        try:
            naive = datetime.strptime(date_str, "%Y-%m-%d")
            return naive.replace(tzinfo=PERTH_TZ)
        except ValueError as e:
            raise ValueError(f"Invalid date format '{date_str}': {e}")

    def _map_identification_to_determination(self, identified_as: str) -> Optional[str]:
        """Map identification string to BotanicalAssessment.DeterminationChoices."""
        if not identified_as:
            return BotanicalAssessment.DeterminationChoices.PENDING

        identified_lower = identified_as.lower().strip()

        # Exact matches
        exact = {
            "cannabis sativa": BotanicalAssessment.DeterminationChoices.CANNABIS_SATIVA,
            "mixed": BotanicalAssessment.DeterminationChoices.MIXED,
            "papaver somniferum": BotanicalAssessment.DeterminationChoices.PAPAVER_SOMNIFERUM,
            "unidentifiable": BotanicalAssessment.DeterminationChoices.UNIDENTIFIABLE,
        }
        if identified_lower in exact:
            return exact[identified_lower]

        # Pattern matching
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
            return BotanicalAssessment.DeterminationChoices.CANNABIS_SATIVA
        elif "papaver" in identified_lower:
            return BotanicalAssessment.DeterminationChoices.PAPAVER_SOMNIFERUM
        elif "unidentifiable" in identified_lower:
            return BotanicalAssessment.DeterminationChoices.UNIDENTIFIABLE
        elif "degraded" in identified_lower:
            return BotanicalAssessment.DeterminationChoices.DEGRADED
        elif any(
            w in identified_lower for w in ["not cannabis", "non-cannabis", "poppy"]
        ):
            return BotanicalAssessment.DeterminationChoices.NOT_CANNABIS
        elif any(
            w in identified_lower for w in ["inconclusive", "unsure", "uncertain"]
        ):
            return BotanicalAssessment.DeterminationChoices.INCONCLUSIVE
        else:
            logger.warning(
                f"Unknown identification '{identified_as}', mapping to 'inconclusive'"
            )
            return BotanicalAssessment.DeterminationChoices.INCONCLUSIVE

    def exclude_debugging_fields(self, json_record: Dict[str, Any]) -> Dict[str, Any]:
        """Remove debugging/processing fields from JSON record."""
        cleaned = {}
        for key, value in json_record.items():
            if key not in self.EXCLUDED_FIELDS:
                if isinstance(value, dict):
                    cleaned_value = {
                        k: v for k, v in value.items() if k not in self.EXCLUDED_FIELDS
                    }
                    cleaned[key] = cleaned_value
                else:
                    cleaned[key] = value
        return cleaned
