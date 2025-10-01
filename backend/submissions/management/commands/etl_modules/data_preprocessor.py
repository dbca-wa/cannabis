"""
Data Preprocessor for Cannabis ETL System

This module handles preprocessing of cannabis JSON data to create unique entities
before row-by-row processing. This eliminates duplication and improves performance
by creating entities once and reusing them throughout the import process.
"""

import logging
from typing import Dict, List, Set, Optional, Tuple
from collections import defaultdict

from django.contrib.auth import get_user_model
from django.db import transaction

from police.models import PoliceOfficer, PoliceStation
from submissions.models import Defendant

User = get_user_model()
logger = logging.getLogger(__name__)


class DataPreprocessor:
    """
    Preprocesses cannabis JSON data to create unique entities before row processing.

    Handles deduplication and relationship establishment for:
    - Botanist User records
    - PoliceStation records
    - PoliceOfficer records
    - Defendant records
    """

    def __init__(self):
        self.stats = {
            "botanists_created": 0,
            "stations_created": 0,
            "officers_created": 0,
            "defendants_created": 0,
            "botanists_existing": 0,
            "stations_existing": 0,
            "officers_existing": 0,
            "defendants_existing": 0,
        }

    def preprocess_all_entities(self, json_records: List[Dict]) -> Dict[str, Dict]:
        """
        Preprocess all entity types from the JSON records.

        Args:
            json_records: List of cannabis JSON records

        Returns:
            Dictionary containing preprocessed entities by type
        """
        logger.info(f"Starting preprocessing of {len(json_records)} records")

        with transaction.atomic():
            preprocessed_data = {
                "botanists": self.preprocess_botanists(json_records),
                "stations": self.preprocess_police_stations(json_records),
                "officers": self.preprocess_police_officers(json_records),
                "defendants": self.preprocess_defendants(json_records),
            }

        self._log_preprocessing_stats()
        return preprocessed_data

    def preprocess_botanists(self, json_records: List[Dict]) -> Dict[str, User]:
        """
        Create unique botanist User records from approved_botanist values.

        Args:
            json_records: List of cannabis JSON records

        Returns:
            Dictionary mapping botanist names to User instances
        """
        logger.info("Preprocessing botanists...")

        # Extract unique botanist names
        botanist_names = set()
        for record in json_records:
            botanist_name = record.get("approved_botanist", "").strip()
            if botanist_name:
                botanist_names.add(botanist_name)

        logger.info(f"Found {len(botanist_names)} unique botanist names")

        botanists = {}
        for name in botanist_names:
            # Try to find existing user by name
            # Note: This assumes botanist names are stored in first_name + last_name
            name_parts = name.split(" ", 1)
            first_name = name_parts[0] if name_parts else name
            last_name = name_parts[1] if len(name_parts) > 1 else ""

            # Look for existing user
            existing_user = User.objects.filter(
                first_name__iexact=first_name,
                last_name__iexact=last_name,
                role="botanist",
            ).first()

            if existing_user:
                botanists[name] = existing_user
                self.stats["botanists_existing"] += 1
                logger.debug(f"Found existing botanist: {name}")
            else:
                # Create new botanist user
                # Generate email from name
                email_name = name.lower().replace(" ", ".")
                email = f"{email_name}@botanist.local"

                # Ensure unique email
                counter = 1
                base_email = email
                while User.objects.filter(email=email).exists():
                    email = f"{base_email.split('@')[0]}{counter}@botanist.local"
                    counter += 1

                user = User.objects.create(
                    email=email,
                    first_name=first_name,
                    last_name=last_name,
                    role="botanist",
                    is_active=True,
                )
                botanists[name] = user
                self.stats["botanists_created"] += 1
                logger.debug(f"Created new botanist: {name} ({email})")

        return botanists

    def preprocess_police_stations(
        self, json_records: List[Dict]
    ) -> Dict[str, PoliceStation]:
        """
        Create unique PoliceStation records from organisation values.

        Args:
            json_records: List of cannabis JSON records

        Returns:
            Dictionary mapping station names to PoliceStation instances
        """
        logger.info("Preprocessing police stations...")

        # Extract unique station names
        station_names = set()
        for record in json_records:
            police_officer = record.get("police_officer", {})
            if isinstance(police_officer, dict):
                organisation = police_officer.get("organisation", "").strip()
                if organisation:
                    station_names.add(organisation)

        logger.info(f"Found {len(station_names)} unique police station names")

        stations = {}
        for name in station_names:
            # Try to find existing station
            existing_station = PoliceStation.objects.filter(name__iexact=name).first()

            if existing_station:
                stations[name] = existing_station
                self.stats["stations_existing"] += 1
                logger.debug(f"Found existing station: {name}")
            else:
                # Create new station
                station = PoliceStation.objects.create(
                    name=name,
                    # Add default values for required fields if any
                )
                stations[name] = station
                self.stats["stations_created"] += 1
                logger.debug(f"Created new station: {name}")

        return stations

    def preprocess_police_officers(
        self, json_records: List[Dict]
    ) -> Dict[str, PoliceOfficer]:
        """
        Create unique PoliceOfficer records with proper deduplication.

        Args:
            json_records: List of cannabis JSON records

        Returns:
            Dictionary mapping officer keys to PoliceOfficer instances
        """
        logger.info("Preprocessing police officers...")

        # First, ensure stations are preprocessed
        stations = self.preprocess_police_stations(json_records)

        # Extract unique officer data
        officers_data = {}
        for record in json_records:
            police_officer = record.get("police_officer", {})
            if not isinstance(police_officer, dict):
                continue

            organisation = police_officer.get("organisation", "").strip()
            station = stations.get(organisation) if organisation else None

            # Process submitting officer
            submitting = police_officer.get("submitting_officer", {})
            if isinstance(submitting, dict) and submitting.get("name"):
                officer_key = self._create_officer_key(submitting, organisation)
                if officer_key not in officers_data:
                    officers_data[officer_key] = {
                        "name": submitting.get("name", "").strip(),
                        "rank": submitting.get("rank", "").strip(),
                        "badge_id": submitting.get("badge_id", "").strip(),
                        "station": station,
                        "organisation": organisation,
                    }

            # Process requesting officer
            requesting = police_officer.get("requesting_officer", {})
            if isinstance(requesting, dict) and requesting.get("name"):
                officer_key = self._create_officer_key(requesting, organisation)
                if officer_key not in officers_data:
                    officers_data[officer_key] = {
                        "name": requesting.get("name", "").strip(),
                        "rank": requesting.get("rank", "").strip(),
                        "badge_id": requesting.get("badge_id", "").strip(),
                        "station": station,
                        "organisation": organisation,
                    }

        logger.info(f"Found {len(officers_data)} unique police officers")

        # Create or find officer records
        officers = {}
        for officer_key, officer_data in officers_data.items():
            # Parse name
            first_name, last_name = self._parse_officer_name(officer_data["name"])

            # Try to find existing officer
            existing_officer = self._find_existing_officer(
                first_name, last_name, officer_data["badge_id"]
            )

            if existing_officer:
                officers[officer_key] = existing_officer
                self.stats["officers_existing"] += 1
                logger.debug(f"Found existing officer: {officer_data['name']}")
            else:
                # Create new officer
                officer = PoliceOfficer.objects.create(
                    first_name=first_name,
                    last_name=last_name,
                    rank=self._map_rank_to_seniority(officer_data["rank"]),
                    badge_number=officer_data["badge_id"] or None,
                    station=officer_data["station"],
                )
                officers[officer_key] = officer
                self.stats["officers_created"] += 1
                logger.debug(f"Created new officer: {officer_data['name']}")

        return officers

    def preprocess_defendants(self, json_records: List[Dict]) -> Dict[str, Defendant]:
        """
        Create unique Defendant records with proper name handling.

        Args:
            json_records: List of cannabis JSON records

        Returns:
            Dictionary mapping defendant keys to Defendant instances
        """
        logger.info("Preprocessing defendants...")

        # Extract unique defendant data
        defendants_data = {}
        for record in json_records:
            defendants_list = record.get("defendants", [])
            if not isinstance(defendants_list, list):
                continue

            for defendant in defendants_list:
                if not isinstance(defendant, dict):
                    continue

                given_names = defendant.get("given_names", "").strip()
                last_name = defendant.get("last_name", "").strip()

                if given_names or last_name:
                    defendant_key = f"{given_names}|{last_name}".lower()
                    if defendant_key not in defendants_data:
                        defendants_data[defendant_key] = {
                            "given_names": given_names,
                            "last_name": last_name,
                        }

        logger.info(f"Found {len(defendants_data)} unique defendants")

        # Create or find defendant records
        defendants = {}
        for defendant_key, defendant_data in defendants_data.items():
            # Try to find existing defendant
            existing_defendant = Defendant.objects.filter(
                first_name__iexact=defendant_data["given_names"],
                last_name__iexact=defendant_data["last_name"],
            ).first()

            if existing_defendant:
                defendants[defendant_key] = existing_defendant
                self.stats["defendants_existing"] += 1
                logger.debug(
                    f"Found existing defendant: {defendant_data['given_names']} {defendant_data['last_name']}"
                )
            else:
                # Create new defendant
                defendant = Defendant.objects.create(
                    first_name=defendant_data["given_names"] or None,
                    last_name=defendant_data["last_name"] or None,
                )
                defendants[defendant_key] = defendant
                self.stats["defendants_created"] += 1
                logger.debug(
                    f"Created new defendant: {defendant_data['given_names']} {defendant_data['last_name']}"
                )

        return defendants

    def _create_officer_key(self, officer_data: Dict, organisation: str) -> str:
        """Create a unique key for an officer based on available data."""
        name = officer_data.get("name", "").strip()
        badge_id = officer_data.get("badge_id", "").strip()
        rank = officer_data.get("rank", "").strip()

        # Use badge_id if available, otherwise use name + organisation + rank
        if badge_id:
            return f"badge:{badge_id}"
        else:
            return f"name:{name}|org:{organisation}|rank:{rank}".lower()

    def _parse_officer_name(self, full_name: str) -> Tuple[str, str]:
        """Parse officer full name into first and last name."""
        if not full_name:
            return "", ""

        # Handle common patterns like "Smith, John" or "John Smith"
        if "," in full_name:
            parts = full_name.split(",", 1)
            last_name = parts[0].strip()
            first_name = parts[1].strip() if len(parts) > 1 else ""
        else:
            parts = full_name.strip().split()
            if len(parts) == 1:
                first_name = ""
                last_name = parts[0]
            else:
                first_name = " ".join(parts[:-1])
                last_name = parts[-1]

        return first_name, last_name

    def _find_existing_officer(
        self, first_name: str, last_name: str, badge_id: str
    ) -> Optional[PoliceOfficer]:
        """Find existing officer by badge ID or name."""
        # Try badge ID first if available
        if badge_id:
            officer = PoliceOfficer.objects.filter(badge_number=badge_id).first()
            if officer:
                return officer

        # Try name match
        if first_name or last_name:
            officer = PoliceOfficer.objects.filter(
                first_name__iexact=first_name, last_name__iexact=last_name
            ).first()
            if officer:
                return officer

        return None

    def _map_rank_to_seniority(self, rank: str) -> str:
        """Map rank string to PoliceOfficer.SeniorityChoices values with smart parsing."""
        if not rank:
            return PoliceOfficer.SeniorityChoices.UNKNOWN

        rank_lower = rank.lower().strip()

        # Direct mappings for clean ranks
        direct_mappings = {
            "sworn officer": PoliceOfficer.SeniorityChoices.SWORN_OFFICER,
            "unsworn officer": PoliceOfficer.SeniorityChoices.UNSWORN_OFFICER,
            "senior constable": PoliceOfficer.SeniorityChoices.SENIOR_CONSTABLE,
            "detective": PoliceOfficer.SeniorityChoices.DETECTIVE,
            "police constable": PoliceOfficer.SeniorityChoices.POLICE_CONSTABLE,
            "first class constable": PoliceOfficer.SeniorityChoices.FIRST_CLASS_CONSTABLE,
            "sergeant": PoliceOfficer.SeniorityChoices.SERGEANT,
            "detective senior constable": PoliceOfficer.SeniorityChoices.DETECTIVE_SENIOR_CONSTABLE,
            "detective first class constable": PoliceOfficer.SeniorityChoices.DETECTIVE_FIRST_CLASS_CONSTABLE,
            "senior detective": PoliceOfficer.SeniorityChoices.SENIOR_DETECTIVE,
            "inspector": PoliceOfficer.SeniorityChoices.INSPECTOR,
            "constable": PoliceOfficer.SeniorityChoices.CONSTABLE,
        }

        # Try direct mapping first
        if rank_lower in direct_mappings:
            return direct_mappings[rank_lower]

        # Handle abbreviations
        abbreviation_mappings = {
            "sp/c": PoliceOfficer.SeniorityChoices.POLICE_CONSTABLE,  # Senior Police Constable
            "sp/pc": PoliceOfficer.SeniorityChoices.POLICE_CONSTABLE,  # Senior Police Constable
            "i/c": PoliceOfficer.SeniorityChoices.CONSTABLE,  # Inspector Constable -> Constable
        }

        if rank_lower in abbreviation_mappings:
            return abbreviation_mappings[rank_lower]

        # Smart parsing for malformed ranks with names mixed in
        # Examples: "Sworn Officer Shane" -> "Sworn Officer"
        #          "Conveying Officer Senior Constable Shane" -> "Senior Constable"
        #          "Sworn Officer First Class Constable" -> "First Class Constable"

        # Check for patterns in order of specificity
        if "detective senior constable" in rank_lower:
            return PoliceOfficer.SeniorityChoices.DETECTIVE_SENIOR_CONSTABLE
        elif "detective first class constable" in rank_lower:
            return PoliceOfficer.SeniorityChoices.DETECTIVE_FIRST_CLASS_CONSTABLE
        elif "senior constable" in rank_lower:
            return PoliceOfficer.SeniorityChoices.SENIOR_CONSTABLE
        elif "first class constable" in rank_lower:
            return PoliceOfficer.SeniorityChoices.FIRST_CLASS_CONSTABLE
        elif "police constable" in rank_lower:
            return PoliceOfficer.SeniorityChoices.POLICE_CONSTABLE
        elif "sworn officer" in rank_lower:
            return PoliceOfficer.SeniorityChoices.SWORN_OFFICER
        elif "unsworn officer" in rank_lower:
            return PoliceOfficer.SeniorityChoices.UNSWORN_OFFICER
        elif "detective" in rank_lower:
            return PoliceOfficer.SeniorityChoices.DETECTIVE
        elif "sergeant" in rank_lower:
            return PoliceOfficer.SeniorityChoices.SERGEANT
        elif "inspector" in rank_lower:
            return PoliceOfficer.SeniorityChoices.INSPECTOR
        elif "constable" in rank_lower:
            return PoliceOfficer.SeniorityChoices.CONSTABLE
        elif "sworn" in rank_lower:  # Handle "Sworn Brett", "Sworn Shane"
            return PoliceOfficer.SeniorityChoices.SWORN_OFFICER
        elif "senior" in rank_lower:
            return PoliceOfficer.SeniorityChoices.SENIOR_CONSTABLE
        elif "first" in rank_lower:
            return PoliceOfficer.SeniorityChoices.FIRST_CLASS_CONSTABLE
        else:
            # Data quality issues - names, abbreviations, etc.
            logger.debug(f"Mapping malformed rank '{rank}' to OTHER")
            return PoliceOfficer.SeniorityChoices.OTHER

    def _log_preprocessing_stats(self):
        """Log preprocessing statistics."""
        logger.info("Preprocessing completed:")
        logger.info(
            f"  Botanists: {self.stats['botanists_created']} created, {self.stats['botanists_existing']} existing"
        )
        logger.info(
            f"  Stations: {self.stats['stations_created']} created, {self.stats['stations_existing']} existing"
        )
        logger.info(
            f"  Officers: {self.stats['officers_created']} created, {self.stats['officers_existing']} existing"
        )
        logger.info(
            f"  Defendants: {self.stats['defendants_created']} created, {self.stats['defendants_existing']} existing"
        )

    def get_preprocessing_stats(self) -> Dict[str, int]:
        """Get preprocessing statistics."""
        return self.stats.copy()
