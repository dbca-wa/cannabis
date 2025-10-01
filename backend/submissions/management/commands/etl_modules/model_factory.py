"""
Cannabis Model Factory

This module provides factory functions to create and update Django model instances
from the mapped cannabis data. It handles get_or_create logic, deduplication,
and referential integrity maintenance.

Requirements: 4.6, 6.1, 6.2, 4.1, 4.2
"""

import logging
from typing import List, Optional, Tuple
from django.db import transaction, IntegrityError, DatabaseError
from django.core.exceptions import ValidationError
from django.contrib.auth import get_user_model

from submissions.models import (
    Submission,
    Defendant,
    DrugBag,
    BotanicalAssessment,
    Certificate,
)
from police.models import PoliceOfficer, PoliceStation
from .data_mapper import (
    SubmissionData,
    PoliceOfficerData,
    DefendantData,
    DrugBagData,
    BotanicalAssessmentData,
)
from .error_handler import ErrorHandler

logger = logging.getLogger(__name__)
User = get_user_model()


class ModelFactory:
    """
    Factory class for creating and updating Django model instances from cannabis data.

    Handles deduplication, referential integrity, and audit trail preservation.
    Integrates with ErrorHandler for comprehensive error handling and recovery.
    """

    def __init__(
        self,
        preprocessed_data: Optional[dict] = None,
        error_handler: Optional[ErrorHandler] = None,
    ):
        """
        Initialize the model factory with preprocessed entity data

        Args:
            preprocessed_data: Dictionary containing preprocessed entities (botanists, stations, officers, defendants)
            error_handler: Optional ErrorHandler instance for error management
        """
        self.preprocessed_data = preprocessed_data or {}
        self.error_handler = error_handler or ErrorHandler()

    def create_or_update_submission(
        self,
        data: SubmissionData,
        submitting_officer: Optional[PoliceOfficer] = None,
        requesting_officer: Optional[PoliceOfficer] = None,
        defendants: Optional[List[Defendant]] = None,
    ) -> Optional[Submission]:
        """
        Create or update a Submission record using legacy_id as unique identifier.
        Includes comprehensive error handling with retry logic and validation.

        Args:
            data: SubmissionData containing submission information
            submitting_officer: Optional PoliceOfficer instance
            requesting_officer: Optional PoliceOfficer instance
            defendants: Optional list of Defendant instances

        Returns:
            Optional[Submission]: Created or updated submission instance, or None if failed
        """
        record_id = data.legacy_id or "unknown"
        retry_count = 0
        max_retries = 3

        while retry_count <= max_retries:
            savepoint_id = self.error_handler.create_rollback_point()

            try:
                # Validate required fields
                if not data.legacy_id:
                    raise ValidationError(
                        "legacy_id is required for submission creation"
                    )
                if not data.case_number:
                    raise ValidationError(
                        "case_number is required for submission creation"
                    )
                if not data.received:
                    raise ValidationError(
                        "received date is required for submission creation"
                    )

                # Look up approved botanist by name if provided
                approved_botanist = None
                if data.approved_botanist:
                    try:
                        approved_botanist = User.objects.get(
                            first_name__icontains=data.approved_botanist.split()[0],
                            role="botanist",
                        )
                    except User.DoesNotExist:
                        logger.warning(f"Botanist '{data.approved_botanist}' not found")
                    except User.MultipleObjectsReturned:
                        # Try exact match
                        try:
                            full_name_parts = data.approved_botanist.split()
                            if len(full_name_parts) >= 2:
                                approved_botanist = User.objects.get(
                                    first_name__iexact=full_name_parts[0],
                                    last_name__iexact=" ".join(full_name_parts[1:]),
                                    role="botanist",
                                )
                        except User.DoesNotExist:
                            logger.warning(
                                f"Multiple botanists found for '{data.approved_botanist}', using none"
                            )

                # Get or create submission using legacy_id
                with transaction.atomic():
                    submission, created = Submission.objects.get_or_create(
                        legacy_id=data.legacy_id,
                        defaults={
                            "case_number": data.case_number,
                            "received": data.received,
                            "approved_botanist": approved_botanist,
                            "submitting_officer": submitting_officer,
                            "requesting_officer": requesting_officer,
                            "internal_comments": data.internal_comments,
                            "security_movement_envelope": data.security_movement_envelope
                            or f"SME-{data.legacy_id}",
                            "phase": Submission.PhaseChoices.COMPLETE,  # Historical data is complete
                        },
                    )

                    if not created:
                        # Update existing submission
                        submission.case_number = data.case_number
                        submission.received = data.received
                        submission.approved_botanist = approved_botanist
                        submission.submitting_officer = submitting_officer
                        submission.requesting_officer = requesting_officer
                        if data.internal_comments:
                            submission.internal_comments = data.internal_comments
                        if data.security_movement_envelope:
                            submission.security_movement_envelope = (
                                data.security_movement_envelope
                            )
                        submission.save()

                    # Link defendants if provided
                    if defendants:
                        submission.defendants.set(defendants)

                # Commit the savepoint if successful
                if savepoint_id:
                    self.error_handler.commit_rollback_point(savepoint_id)

                action = "Created" if created else "Updated"
                logger.info(
                    f"{action} submission {submission.case_number} (legacy_id: {data.legacy_id})"
                )

                return submission

            except ValidationError as e:
                # Handle validation errors
                if savepoint_id:
                    self.error_handler.rollback_to_point(savepoint_id)

                should_continue = self.error_handler.handle_validation_error(
                    record_id,
                    e,
                    context={
                        "model": "Submission",
                        "data": data.__dict__,
                        "retry_count": retry_count,
                    },
                )

                if not should_continue:
                    return None
                break  # Don't retry validation errors

            except IntegrityError as e:
                # Handle integrity constraint violations
                if savepoint_id:
                    self.error_handler.rollback_to_point(savepoint_id)

                should_continue = self.error_handler.handle_integrity_error(
                    record_id,
                    e,
                    context={
                        "model": "Submission",
                        "field": "legacy_id",
                        "value": data.legacy_id,
                    },
                )

                if not should_continue:
                    return None
                break  # Don't retry integrity errors

            except DatabaseError as e:
                # Handle database errors with retry logic
                if savepoint_id:
                    self.error_handler.rollback_to_point(savepoint_id)

                should_retry, should_continue = (
                    self.error_handler.handle_database_error(
                        record_id,
                        e,
                        operation="create_submission",
                        retry_count=retry_count,
                    )
                )

                if should_retry:
                    retry_count += 1
                    continue
                elif not should_continue:
                    return None
                else:
                    break

            except Exception as e:
                # Handle unexpected errors
                if savepoint_id:
                    self.error_handler.rollback_to_point(savepoint_id)

                should_continue = self.error_handler.handle_validation_error(
                    record_id,
                    e,
                    context={
                        "model": "Submission",
                        "unexpected_error": True,
                        "retry_count": retry_count,
                    },
                )

                if not should_continue:
                    return None
                break

        logger.error(
            f"Failed to create/update submission after {max_retries} retries: {record_id}"
        )
        return None

    def create_or_update_police_officer(
        self, data: PoliceOfficerData
    ) -> Optional[PoliceOfficer]:
        """
        Create or update a PoliceOfficer record with deduplication.

        Args:
            data: PoliceOfficerData containing officer information

        Returns:
            PoliceOfficer: Created or updated officer instance, or None if data is insufficient
        """
        try:
            # Skip if no meaningful data
            if not data.first_name and not data.last_name and not data.badge_number:
                logger.debug("Skipping officer creation - insufficient data")
                return None

            # Create or get police station if provided
            station = None
            if data.station_name:
                station = self.create_or_update_police_station(data.station_name)

            # Map rank to SeniorityChoices
            rank = self._map_rank_to_seniority(data.rank)

            # Try to find existing officer by badge number first
            officer = None
            if data.badge_number:
                try:
                    officer = PoliceOfficer.objects.get(badge_number=data.badge_number)
                    # Update existing officer
                    if data.first_name:
                        officer.first_name = data.first_name
                    if data.last_name:
                        officer.last_name = data.last_name
                    officer.rank = rank
                    if station:
                        officer.station = station
                    officer.save()
                    logger.debug(
                        f"Updated officer {officer.full_name} (badge: {data.badge_number})"
                    )
                    return officer
                except PoliceOfficer.DoesNotExist:
                    pass

            # Try to find by name if no badge number match
            if data.first_name and data.last_name:
                try:
                    officer = PoliceOfficer.objects.get(
                        first_name__iexact=data.first_name,
                        last_name__iexact=data.last_name,
                    )
                    # Update existing officer
                    if data.badge_number:
                        officer.badge_number = data.badge_number
                    officer.rank = rank
                    if station:
                        officer.station = station
                    officer.save()
                    logger.debug(f"Updated officer {officer.full_name} by name")
                    return officer
                except PoliceOfficer.DoesNotExist:
                    pass
                except PoliceOfficer.MultipleObjectsReturned:
                    # Multiple officers with same name, create new one
                    logger.warning(
                        f"Multiple officers found with name {data.first_name} {data.last_name}"
                    )

            # Create new officer
            officer = PoliceOfficer.objects.create(
                badge_number=data.badge_number,
                first_name=data.first_name,
                last_name=data.last_name,
                rank=rank,
                station=station,
            )

            logger.debug(f"Created new officer {officer.full_name}")
            return officer

        except Exception as e:
            logger.error(f"Error creating/updating police officer: {e}")
            raise

    def create_or_update_police_station(self, name: str) -> Optional[PoliceStation]:
        """
        Create or update a PoliceStation record by name.

        Args:
            name: Station name

        Returns:
            PoliceStation: Created or updated station instance, or None if name is empty
        """
        try:
            if not name or not name.strip():
                return None

            name = name.strip()

            # Get or create station
            station, created = PoliceStation.objects.get_or_create(
                name__iexact=name, defaults={"name": name}
            )

            action = "Created" if created else "Found existing"
            logger.debug(f"{action} police station: {name}")

            return station

        except Exception as e:
            logger.error(f"Error creating/updating police station '{name}': {e}")
            raise

    def create_or_update_defendant(self, data: DefendantData) -> Optional[Defendant]:
        """
        Create or update a Defendant record with deduplication logic.

        Args:
            data: DefendantData containing defendant information

        Returns:
            Defendant: Created or updated defendant instance, or None if data is insufficient
        """
        try:
            # Skip if no meaningful data
            if not data.first_name and not data.last_name:
                logger.debug("Skipping defendant creation - no name data")
                return None

            # Clean up names
            first_name = data.first_name.strip() if data.first_name else None
            last_name = data.last_name.strip() if data.last_name else None

            # Skip if names are empty after cleaning
            if not first_name and not last_name:
                return None

            # Try to find existing defendant by exact name match
            try:
                defendant = Defendant.objects.get(
                    first_name__iexact=first_name or "",
                    last_name__iexact=last_name or "",
                )
                logger.debug(f"Found existing defendant: {defendant}")
                return defendant
            except Defendant.DoesNotExist:
                pass
            except Defendant.MultipleObjectsReturned:
                # Multiple defendants with same name - get the first one
                defendant = Defendant.objects.filter(
                    first_name__iexact=first_name or "",
                    last_name__iexact=last_name or "",
                ).first()
                logger.debug(f"Multiple defendants found, using first: {defendant}")
                return defendant

            # Create new defendant
            defendant = Defendant.objects.create(
                first_name=first_name, last_name=last_name
            )

            logger.debug(f"Created new defendant: {defendant}")
            return defendant

        except Exception as e:
            logger.error(f"Error creating/updating defendant: {e}")
            raise

    def handle_missing_officer_data(
        self, data: PoliceOfficerData
    ) -> Optional[PoliceOfficerData]:
        """
        Handle missing or incomplete officer data gracefully.

        Args:
            data: PoliceOfficerData that may be incomplete

        Returns:
            PoliceOfficerData: Cleaned data or None if insufficient
        """
        try:
            # Check if we have any meaningful data
            has_name = bool(data.first_name or data.last_name)
            has_badge = bool(data.badge_number)
            has_station = bool(data.station_name)

            # If we have no identifying information, return None
            if not (has_name or has_badge):
                logger.debug("Officer data has no identifying information")
                return None

            # Clean up the data
            cleaned_data = PoliceOfficerData(
                first_name=data.first_name.strip() if data.first_name else None,
                last_name=data.last_name.strip() if data.last_name else None,
                rank=data.rank or "unknown",
                badge_number=data.badge_number.strip() if data.badge_number else None,
                station_name=data.station_name.strip() if data.station_name else None,
            )

            return cleaned_data

        except Exception as e:
            logger.error(f"Error handling missing officer data: {e}")
            return None

    def batch_create_officers(
        self, officers_data: List[PoliceOfficerData]
    ) -> List[PoliceOfficer]:
        """
        Create multiple officers efficiently with deduplication.

        Args:
            officers_data: List of PoliceOfficerData

        Returns:
            List[PoliceOfficer]: Created/found officer instances
        """
        officers = []

        for officer_data in officers_data:
            # Handle missing data gracefully
            cleaned_data = self.handle_missing_officer_data(officer_data)
            if cleaned_data:
                officer = self.create_or_update_police_officer(cleaned_data)
                if officer:
                    officers.append(officer)

        return officers

    def parse_defendant_names(
        self, defendants_data: List[DefendantData]
    ) -> List[DefendantData]:
        """
        Parse defendant names from given_names and last_name fields with improved logic.

        Args:
            defendants_data: List of raw DefendantData

        Returns:
            List[DefendantData]: Parsed and cleaned defendant data
        """
        parsed_defendants = []

        for defendant_data in defendants_data:
            try:
                # Handle cases where given_names might contain multiple names
                given_names = defendant_data.first_name or ""
                last_name = defendant_data.last_name or ""

                # Clean up names
                given_names = given_names.strip()
                last_name = last_name.strip()

                # Skip empty defendants
                if not given_names and not last_name:
                    continue

                # Handle cases where given_names contains multiple words
                # Take only the first name for first_name field
                if given_names:
                    name_parts = given_names.split()
                    first_name = name_parts[0] if name_parts else given_names

                    # If there are multiple given names and no last name,
                    # treat the last given name as last name
                    if len(name_parts) > 1 and not last_name:
                        first_name = " ".join(name_parts[:-1])
                        last_name = name_parts[-1]
                else:
                    first_name = None

                parsed_defendants.append(
                    DefendantData(first_name=first_name, last_name=last_name)
                )

            except Exception as e:
                logger.warning(f"Error parsing defendant name: {e}")
                continue

        return parsed_defendants

    def batch_create_defendants(
        self, defendants_data: List[DefendantData]
    ) -> List[Defendant]:
        """
        Create multiple defendants efficiently with deduplication logic.

        Args:
            defendants_data: List of DefendantData

        Returns:
            List[Defendant]: Created/found defendant instances
        """
        defendants = []

        # Parse names first
        parsed_data = self.parse_defendant_names(defendants_data)

        for defendant_data in parsed_data:
            defendant = self.create_or_update_defendant(defendant_data)
            if defendant:
                defendants.append(defendant)

        return defendants

    def link_defendants_to_submission(
        self, submission: Submission, defendants: List[Defendant]
    ) -> None:
        """
        Link defendants to submissions via many-to-many relationship.

        Args:
            submission: Submission instance
            defendants: List of Defendant instances to link
        """
        try:
            if defendants:
                # Use set() to replace all defendants for this submission
                submission.defendants.set(defendants)
                logger.debug(
                    f"Linked {len(defendants)} defendants to submission {submission.case_number}"
                )
            else:
                # Clear defendants if none provided
                submission.defendants.clear()
                logger.debug(
                    f"Cleared defendants for submission {submission.case_number}"
                )

        except Exception as e:
            logger.error(
                f"Error linking defendants to submission {submission.case_number}: {e}"
            )
            raise

    def create_drug_bag(self, data: DrugBagData, submission: Submission) -> DrugBag:
        """
        Create a DrugBag instance from JSON data.

        Maps quantity_of_bags to quantity field, handles tag_numbers array mapping
        to seal_tag_number fields, and sets content_type based on description mapping.
        Uses get_or_create logic for idempotent operations.

        Args:
            data: DrugBagData containing bag information
            submission: Parent Submission instance

        Returns:
            DrugBag: Created or updated drug bag instance

        Raises:
            ValueError: If required data is missing
        """
        try:
            # Validate required fields
            if not data.seal_tag_numbers:
                raise ValueError("seal_tag_numbers is required for drug bag creation")
            if not data.content_type:
                raise ValueError("content_type is required for drug bag creation")

            # Validate content_type against DrugBag.ContentType choices
            valid_content_types = [choice[0] for choice in DrugBag.ContentType.choices]
            if data.content_type not in valid_content_types:
                logger.warning(
                    f"Invalid content_type '{data.content_type}', using default 'plant_material'"
                )
                data.content_type = DrugBag.ContentType.PLANT_MATERIAL

            # Get or create the drug bag with proper field mapping
            drug_bag, created = DrugBag.objects.get_or_create(
                submission=submission,
                seal_tag_numbers=data.seal_tag_numbers,  # Unique constraint key
                defaults={
                    "content_type": data.content_type,
                    "new_seal_tag_numbers": data.new_seal_tag_numbers,  # Additional tags from array
                    "property_reference": data.property_reference or "",
                    "gross_weight": data.gross_weight,
                    "net_weight": data.net_weight,
                },
            )

            if not created:
                # Update existing drug bag
                drug_bag.content_type = data.content_type
                drug_bag.new_seal_tag_numbers = data.new_seal_tag_numbers
                drug_bag.property_reference = data.property_reference or ""
                if data.gross_weight:
                    drug_bag.gross_weight = data.gross_weight
                if data.net_weight:
                    drug_bag.net_weight = data.net_weight
                drug_bag.save()

            action = "Created" if created else "Updated"
            logger.debug(
                f"{action} drug bag {drug_bag.seal_tag_numbers} (content_type: {data.content_type}) "
                f"for submission {submission.case_number}"
            )
            return drug_bag

        except Exception as e:
            logger.error(
                f"Error creating drug bag for submission {submission.case_number}: {e}"
            )
            raise

    def create_botanical_assessment(
        self, data: BotanicalAssessmentData, drug_bag: DrugBag
    ) -> BotanicalAssessment:
        """
        Create a BotanicalAssessment record linked to a DrugBag.

        Maps result.identified_as to determination field, extracts botanist_notes
        from processing_notes.original_text, and parses assessment_date from
        cert_date.standardized_date.

        Args:
            data: BotanicalAssessmentData containing assessment information
            drug_bag: Parent DrugBag instance

        Returns:
            BotanicalAssessment: Created or updated assessment instance
        """
        try:
            # Validate determination against BotanicalAssessment.DeterminationChoices
            valid_determinations = [
                choice[0] for choice in BotanicalAssessment.DeterminationChoices.choices
            ]
            if data.determination and data.determination not in valid_determinations:
                logger.warning(
                    f"Invalid determination '{data.determination}', using 'inconclusive'"
                )
                data.determination = (
                    BotanicalAssessment.DeterminationChoices.INCONCLUSIVE
                )

            # Create or update the assessment (OneToOne relationship)
            assessment, created = BotanicalAssessment.objects.get_or_create(
                drug_bag=drug_bag,
                defaults={
                    "determination": data.determination,  # Mapped from result.identified_as
                    "assessment_date": data.assessment_date,  # Parsed from cert_date.standardized_date
                    "botanist_notes": data.botanist_notes,  # Extracted from processing_notes.original_text
                },
            )

            if not created:
                # Update existing assessment
                assessment.determination = data.determination
                assessment.assessment_date = data.assessment_date
                assessment.botanist_notes = data.botanist_notes
                assessment.save()

            action = "Created" if created else "Updated"
            logger.debug(
                f"{action} botanical assessment for bag {drug_bag.seal_tag_numbers} "
                f"(determination: {data.determination})"
            )
            return assessment

        except Exception as e:
            logger.error(
                f"Error creating botanical assessment for bag {drug_bag.seal_tag_numbers}: {e}"
            )
            raise

    def create_complete_submission_from_json(
        self, json_record: dict
    ) -> Optional[Submission]:
        """
        Create a complete submission with all related objects from a JSON record.
        Includes comprehensive error handling and rollback capabilities.

        This is the main orchestration method that coordinates all model creation.

        Args:
            json_record: Complete JSON record from cannabis_final.json

        Returns:
            Optional[Submission]: Created submission with all related objects, or None if failed
        """
        from .data_mapper import CannabisDataMapper

        record_id = json_record.get("row_id", "unknown")
        savepoint_id = self.error_handler.create_rollback_point()

        try:
            mapper = CannabisDataMapper()

            # Map all data structures with error handling
            try:
                submission_data = mapper.map_submission_data(json_record)
            except Exception as e:
                self.error_handler.handle_validation_error(
                    record_id, e, context={"operation": "map_submission_data"}
                )
                return None

            # Map police officers with error handling
            submitting_officer = None
            requesting_officer = None

            try:
                police_officer_json = json_record.get("police_officer", {})
                submitting_officer_data, requesting_officer_data = (
                    mapper.map_police_officer_data(police_officer_json)
                )

                # Create officers with error handling
                if submitting_officer_data:
                    cleaned_submitting = self.handle_missing_officer_data(
                        submitting_officer_data
                    )
                    if cleaned_submitting:
                        submitting_officer = (
                            self.create_or_update_police_officer_with_error_handling(
                                cleaned_submitting, record_id
                            )
                        )

                if requesting_officer_data:
                    cleaned_requesting = self.handle_missing_officer_data(
                        requesting_officer_data
                    )
                    if cleaned_requesting:
                        requesting_officer = (
                            self.create_or_update_police_officer_with_error_handling(
                                cleaned_requesting, record_id
                            )
                        )
            except Exception as e:
                logger.warning(
                    f"Error processing police officers for record {record_id}: {e}"
                )
                # Continue without officers rather than failing completely

            # Map and create defendants with error handling
            defendants = []
            try:
                defendants_json = json_record.get("defendants", [])
                defendants_data = mapper.map_defendant_data(defendants_json)
                defendants = self.batch_create_defendants_with_error_handling(
                    defendants_data, record_id
                )
            except Exception as e:
                logger.warning(
                    f"Error processing defendants for record {record_id}: {e}"
                )
                # Continue without defendants rather than failing completely

            # Create submission with comprehensive error handling
            submission = self.create_or_update_submission(
                submission_data,
                submitting_officer=submitting_officer,
                requesting_officer=requesting_officer,
                defendants=defendants,
            )

            if not submission:
                if savepoint_id:
                    self.error_handler.rollback_to_point(savepoint_id)
                return None

            # Map and create single drug bag with error handling
            try:
                drug_bag_data = mapper.map_drug_bag_data(json_record)

                drug_bag = self.create_drug_bag_with_error_handling(
                    drug_bag_data, submission, record_id
                )

                if drug_bag:
                    # Create botanical assessment for the bag
                    try:
                        result_json = json_record.get("result", {})
                        cert_date_str = json_record.get("cert_date", "")
                        assessment_data = mapper.map_botanical_assessment_data(
                            result_json, cert_date_str
                        )

                        self.create_botanical_assessment_with_error_handling(
                            assessment_data, drug_bag, record_id
                        )
                    except Exception as e:
                        logger.warning(
                            f"Error creating botanical assessment for bag in record {record_id}: {e}"
                        )
                        # Continue - bag exists without assessment
                else:
                    logger.warning(f"No drug bag created for submission {record_id}")

            except Exception as e:
                logger.warning(
                    f"Error processing drug bags for record {record_id}: {e}"
                )
                # Continue - submission exists without bags

            # Commit the savepoint if we got this far
            if savepoint_id:
                self.error_handler.commit_rollback_point(savepoint_id)

            logger.info(
                f"Successfully created complete submission {submission.case_number} (record {record_id})"
            )
            return submission

        except Exception as e:
            # Rollback on any critical error
            if savepoint_id:
                self.error_handler.rollback_to_point(savepoint_id)

            self.error_handler.handle_validation_error(
                record_id,
                e,
                context={
                    "operation": "create_complete_submission",
                    "critical_error": True,
                },
            )
            return None

    def _map_rank_to_seniority(self, rank: str) -> str:
        """
        Map rank string to PoliceOfficer.SeniorityChoices value.

        Args:
            rank: Rank string from data

        Returns:
            str: Mapped seniority choice value
        """
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

    def create_or_update_police_officer_with_error_handling(
        self, data: PoliceOfficerData, record_id: str
    ) -> Optional[PoliceOfficer]:
        """
        Create or update police officer with comprehensive error handling.

        Args:
            data: PoliceOfficerData containing officer information
            record_id: Record identifier for error tracking

        Returns:
            Optional[PoliceOfficer]: Created officer or None if failed
        """
        try:
            return self.create_or_update_police_officer(data)
        except ValidationError as e:
            self.error_handler.handle_validation_error(
                record_id, e, context={"model": "PoliceOfficer", "data": data.__dict__}
            )
            return None
        except IntegrityError as e:
            should_continue = self.error_handler.handle_integrity_error(
                record_id, e, context={"model": "PoliceOfficer"}
            )
            return (
                None
                if not should_continue
                else self.create_or_update_police_officer(data)
            )
        except Exception as e:
            self.error_handler.handle_validation_error(
                record_id, e, context={"model": "PoliceOfficer", "unexpected": True}
            )
            return None

    def batch_create_defendants_with_error_handling(
        self, defendants_data: List[DefendantData], record_id: str
    ) -> List[Defendant]:
        """
        Create multiple defendants with error handling.

        Args:
            defendants_data: List of DefendantData
            record_id: Record identifier for error tracking

        Returns:
            List[Defendant]: Successfully created defendants
        """
        defendants = []
        parsed_data = self.parse_defendant_names(defendants_data)

        for defendant_data in parsed_data:
            try:
                defendant = self.create_or_update_defendant(defendant_data)
                if defendant:
                    defendants.append(defendant)
            except ValidationError as e:
                self.error_handler.handle_validation_error(
                    record_id,
                    e,
                    context={"model": "Defendant", "data": defendant_data.__dict__},
                )
                continue
            except IntegrityError as e:
                should_continue = self.error_handler.handle_integrity_error(
                    record_id, e, context={"model": "Defendant"}
                )
                if should_continue:
                    # Try to find existing defendant
                    try:
                        existing = Defendant.objects.get(
                            first_name__iexact=defendant_data.first_name or "",
                            last_name__iexact=defendant_data.last_name or "",
                        )
                        defendants.append(existing)
                    except Defendant.DoesNotExist:
                        pass
                continue
            except Exception as e:
                self.error_handler.handle_validation_error(
                    record_id, e, context={"model": "Defendant", "unexpected": True}
                )
                continue

        return defendants

    def create_drug_bag_with_error_handling(
        self, data: DrugBagData, submission: Submission, record_id: str
    ) -> Optional[DrugBag]:
        """
        Create drug bag with comprehensive error handling.

        Args:
            data: DrugBagData containing bag information
            submission: Parent Submission instance
            record_id: Record identifier for error tracking

        Returns:
            Optional[DrugBag]: Created drug bag or None if failed
        """
        try:
            return self.create_drug_bag(data, submission)
        except ValidationError as e:
            self.error_handler.handle_validation_error(
                record_id, e, context={"model": "DrugBag", "data": data.__dict__}
            )
            return None
        except IntegrityError as e:
            should_continue = self.error_handler.handle_integrity_error(
                record_id,
                e,
                context={"model": "DrugBag", "seal_tag": data.seal_tag_number},
            )
            if should_continue:
                # Try to find existing bag
                try:
                    existing = DrugBag.objects.get(
                        submission=submission, seal_tag_number=data.seal_tag_number
                    )
                    return existing
                except DrugBag.DoesNotExist:
                    pass
            return None
        except Exception as e:
            self.error_handler.handle_validation_error(
                record_id, e, context={"model": "DrugBag", "unexpected": True}
            )
            return None

    def create_botanical_assessment_with_error_handling(
        self, data: BotanicalAssessmentData, drug_bag: DrugBag, record_id: str
    ) -> Optional[BotanicalAssessment]:
        """
        Create botanical assessment with comprehensive error handling.

        Args:
            data: BotanicalAssessmentData containing assessment information
            drug_bag: Parent DrugBag instance
            record_id: Record identifier for error tracking

        Returns:
            Optional[BotanicalAssessment]: Created assessment or None if failed
        """
        try:
            return self.create_botanical_assessment(data, drug_bag)
        except ValidationError as e:
            self.error_handler.handle_validation_error(
                record_id,
                e,
                context={"model": "BotanicalAssessment", "data": data.__dict__},
            )
            return None
        except IntegrityError as e:
            should_continue = self.error_handler.handle_integrity_error(
                record_id,
                e,
                context={"model": "BotanicalAssessment", "drug_bag": drug_bag.id},
            )
            if should_continue:
                # Try to find existing assessment
                try:
                    existing = BotanicalAssessment.objects.get(drug_bag=drug_bag)
                    return existing
                except BotanicalAssessment.DoesNotExist:
                    pass
            return None
        except Exception as e:
            self.error_handler.handle_validation_error(
                record_id,
                e,
                context={"model": "BotanicalAssessment", "unexpected": True},
            )
            return None
