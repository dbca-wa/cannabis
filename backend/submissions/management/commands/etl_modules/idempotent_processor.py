"""
Idempotent Processing Module

This module provides idempotent and resumable processing capabilities for the Cannabis Data Loader.
It handles duplicate detection, update logic, audit trail preservation, and resume functionality.

Requirements: 6.1, 6.2, 6.3, 6.4
"""

import json
import logging
import os
from datetime import datetime
from typing import Dict, Any, List, Optional, Tuple
from dataclasses import dataclass, asdict

from django.db import transaction, IntegrityError
from django.core.exceptions import ValidationError
from django.utils import timezone

from submissions.models import Submission, Defendant, DrugBag, BotanicalAssessment
from police.models import PoliceOfficer, PoliceStation
from .error_handler import ErrorHandler

logger = logging.getLogger(__name__)


@dataclass
class ProcessingState:
    """State information for resumable processing"""

    total_records: int
    processed_records: int
    successful_records: int
    failed_records: int
    last_processed_record: int
    last_processed_legacy_id: Optional[str]
    start_time: datetime
    last_update_time: datetime
    batch_size: int
    file_path: str

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for JSON serialization"""
        return {
            "total_records": self.total_records,
            "processed_records": self.processed_records,
            "successful_records": self.successful_records,
            "failed_records": self.failed_records,
            "last_processed_record": self.last_processed_record,
            "last_processed_legacy_id": self.last_processed_legacy_id,
            "start_time": self.start_time.isoformat(),
            "last_update_time": self.last_update_time.isoformat(),
            "batch_size": self.batch_size,
            "file_path": self.file_path,
        }

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "ProcessingState":
        """Create from dictionary loaded from JSON"""
        return cls(
            total_records=data["total_records"],
            processed_records=data["processed_records"],
            successful_records=data["successful_records"],
            failed_records=data["failed_records"],
            last_processed_record=data["last_processed_record"],
            last_processed_legacy_id=data.get("last_processed_legacy_id"),
            start_time=datetime.fromisoformat(data["start_time"]),
            last_update_time=datetime.fromisoformat(data["last_update_time"]),
            batch_size=data["batch_size"],
            file_path=data["file_path"],
        )


@dataclass
class AuditTrail:
    """Audit trail information for record updates"""

    original_created_at: Optional[datetime]
    original_updated_at: Optional[datetime]
    update_count: int
    last_etl_update: datetime
    etl_source_version: str
    processing_notes: List[str]

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for storage"""
        return {
            "original_created_at": (
                self.original_created_at.isoformat()
                if self.original_created_at
                else None
            ),
            "original_updated_at": (
                self.original_updated_at.isoformat()
                if self.original_updated_at
                else None
            ),
            "update_count": self.update_count,
            "last_etl_update": self.last_etl_update.isoformat(),
            "etl_source_version": self.etl_source_version,
            "processing_notes": self.processing_notes,
        }


class IdempotentProcessor:
    """
    Handles idempotent and resumable processing for cannabis data loading.

    Features:
    - Duplicate detection using legacy_id
    - Update logic for existing records with audit trail preservation
    - Resume capability for interrupted processing
    - Data consistency validation when resuming
    """

    def __init__(self, error_handler: Optional[ErrorHandler] = None):
        """
        Initialize the idempotent processor

        Args:
            error_handler: Optional ErrorHandler instance for error management
        """
        self.error_handler = error_handler or ErrorHandler()
        self.state_file_path = "cannabis_loader_state.json"
        self.etl_source_version = "cannabis_final_v1.0"

    def detect_existing_record(self, legacy_id: str) -> Optional[Submission]:
        """
        Detect if a record already exists using legacy_id.

        Args:
            legacy_id: The legacy_id to search for

        Returns:
            Optional[Submission]: Existing submission or None if not found
        """
        try:
            return Submission.objects.get(legacy_id=legacy_id)
        except Submission.DoesNotExist:
            return None
        except Submission.MultipleObjectsReturned:
            logger.warning(f"Multiple submissions found with legacy_id {legacy_id}")
            # Return the first one and log the issue
            return Submission.objects.filter(legacy_id=legacy_id).first()

    def should_update_record(
        self, existing_submission: Submission, json_record: Dict[str, Any]
    ) -> bool:
        """
        Determine if an existing record should be updated based on data comparison.

        Args:
            existing_submission: Existing Submission instance
            json_record: New JSON record data

        Returns:
            bool: True if record should be updated
        """
        try:
            # Compare key fields to determine if update is needed
            # Case number should be police_reference_number (same logic as data mapper)
            json_case_number = json_record.get("police_reference_number", "")
            if not json_case_number:
                # Fallback to cert_number if police_reference_number is missing
                cert_number = json_record.get("cert_number", "")
                if cert_number:
                    json_case_number = f"CRT-{cert_number}"

            # Check if case number has changed
            if existing_submission.case_number != json_case_number:
                logger.info(
                    f"Case number changed for legacy_id {existing_submission.legacy_id}: "
                    f"{existing_submission.case_number} -> {json_case_number}"
                )
                return True

            # Check if received date has changed
            receipt_date_json = json_record.get("receipt_date", {})
            if isinstance(receipt_date_json, dict):
                standardized_date = receipt_date_json.get("standardized_date")
                if standardized_date:
                    try:
                        from datetime import datetime

                        new_received = datetime.fromisoformat(
                            standardized_date.replace("Z", "+00:00")
                        )
                        if existing_submission.received != new_received:
                            logger.info(
                                f"Received date changed for legacy_id {existing_submission.legacy_id}"
                            )
                            return True
                    except (ValueError, TypeError) as e:
                        logger.warning(
                            f"Error parsing received date for legacy_id {existing_submission.legacy_id}: {e}"
                        )

            # Check if approved botanist has changed (only if both have values)
            json_botanist = json_record.get("approved_botanist", "")
            existing_botanist_name = ""
            if existing_submission.approved_botanist:
                existing_botanist_name = f"{existing_submission.approved_botanist.first_name} {existing_submission.approved_botanist.last_name}".strip()

            # Only consider it a change if both have values and they're different
            # Don't update just because one is missing and the other isn't (botanist might not exist in DB)
            if (
                json_botanist
                and existing_botanist_name
                and json_botanist != existing_botanist_name
            ):
                logger.info(
                    f"Approved botanist changed for legacy_id {existing_submission.legacy_id}: "
                    f"'{existing_botanist_name}' -> '{json_botanist}'"
                )
                return True

            # Check if drug bag data has changed
            json_quantity = json_record.get("quantity_of_bags", 1)
            existing_bags = existing_submission.bags.all()

            if len(existing_bags) == 0 and json_quantity > 0:
                logger.info(
                    f"Drug bags missing for legacy_id {existing_submission.legacy_id}"
                )
                return True

            # For now, assume updates are needed if we have significant changes
            # In production, you might want more sophisticated comparison logic
            return False

        except Exception as e:
            logger.warning(
                f"Error determining if record should be updated for legacy_id {existing_submission.legacy_id}: {e}"
            )
            # When in doubt, don't update to preserve data integrity
            return False

    def preserve_audit_trail(self, existing_submission: Submission) -> AuditTrail:
        """
        Preserve audit trail information before updating a record.

        Args:
            existing_submission: Existing Submission instance

        Returns:
            AuditTrail: Preserved audit information
        """
        # Get existing audit trail from submission notes or create new one
        existing_notes = existing_submission.assessment_notes or ""
        processing_notes = []

        # Parse existing audit trail if present
        update_count = 0
        original_created_at = (
            existing_submission.created_at
            if hasattr(existing_submission, "created_at")
            else None
        )
        original_updated_at = (
            existing_submission.updated_at
            if hasattr(existing_submission, "updated_at")
            else None
        )

        # Look for existing ETL update markers in notes
        if "ETL_UPDATE:" in existing_notes:
            lines = existing_notes.split("\n")
            for line in lines:
                if line.strip().startswith("ETL_UPDATE:"):
                    update_count += 1
                    processing_notes.append(line.strip())

        return AuditTrail(
            original_created_at=original_created_at,
            original_updated_at=original_updated_at,
            update_count=update_count,
            last_etl_update=timezone.now(),
            etl_source_version=self.etl_source_version,
            processing_notes=processing_notes,
        )

    def update_existing_record(
        self,
        existing_submission: Submission,
        json_record: Dict[str, Any],
        audit_trail: AuditTrail,
    ) -> Submission:
        """
        Update an existing record while preserving audit trail information.

        Args:
            existing_submission: Existing Submission instance
            json_record: New JSON record data
            audit_trail: Preserved audit trail information

        Returns:
            Submission: Updated submission instance
        """
        from .data_mapper import CannabisDataMapper
        from .model_factory import ModelFactory

        try:
            with transaction.atomic():
                # Create mapper and factory for processing
                mapper = CannabisDataMapper()
                factory = ModelFactory(self.error_handler)

                # Map the new data
                submission_data = mapper.map_submission_data(json_record)

                # Update submission fields
                existing_submission.case_number = submission_data.case_number
                existing_submission.received = submission_data.received

                # Handle approved botanist update
                if submission_data.approved_botanist:
                    from django.contrib.auth import get_user_model

                    User = get_user_model()
                    try:
                        botanist = User.objects.get(
                            first_name__icontains=submission_data.approved_botanist.split()[
                                0
                            ],
                            role="botanist",
                        )
                        existing_submission.approved_botanist = botanist
                    except (User.DoesNotExist, User.MultipleObjectsReturned):
                        logger.warning(
                            f"Could not find botanist '{submission_data.approved_botanist}' for update"
                        )

                # Update audit trail in assessment notes
                audit_trail.update_count += 1
                audit_trail.processing_notes.append(
                    f"ETL_UPDATE: {audit_trail.last_etl_update.isoformat()} - "
                    f"Updated from {self.etl_source_version} (update #{audit_trail.update_count})"
                )

                # Preserve original notes and add audit trail
                original_notes = existing_submission.assessment_notes or ""
                if original_notes and not original_notes.endswith("\n"):
                    original_notes += "\n"

                audit_notes = "\n".join(
                    audit_trail.processing_notes[-3:]
                )  # Keep last 3 updates
                existing_submission.assessment_notes = original_notes + audit_notes

                existing_submission.save()

                # Update related objects (police officers, defendants, drug bags)
                self.update_related_objects(
                    existing_submission, json_record, factory, mapper
                )

                logger.info(
                    f"Successfully updated existing submission {existing_submission.case_number} "
                    f"(legacy_id: {existing_submission.legacy_id}, update #{audit_trail.update_count})"
                )

                return existing_submission

        except Exception as e:
            logger.error(
                f"Error updating existing record {existing_submission.legacy_id}: {e}"
            )
            raise

    def update_related_objects(
        self, submission: Submission, json_record: Dict[str, Any], factory, mapper
    ) -> None:
        """
        Update related objects (police officers, defendants, drug bags) for an existing submission.

        Args:
            submission: Existing Submission instance
            json_record: New JSON record data
            factory: ModelFactory instance
            mapper: CannabisDataMapper instance
        """
        try:
            # Update police officers
            police_officer_json = json_record.get("police_officer", {})
            if police_officer_json:
                submitting_officer_data, requesting_officer_data = (
                    mapper.map_police_officer_data(police_officer_json)
                )

                if submitting_officer_data:
                    cleaned_submitting = factory.handle_missing_officer_data(
                        submitting_officer_data
                    )
                    if cleaned_submitting:
                        submitting_officer = factory.create_or_update_police_officer(
                            cleaned_submitting
                        )
                        if submitting_officer:
                            submission.submitting_officer = submitting_officer

                if requesting_officer_data:
                    cleaned_requesting = factory.handle_missing_officer_data(
                        requesting_officer_data
                    )
                    if cleaned_requesting:
                        requesting_officer = factory.create_or_update_police_officer(
                            cleaned_requesting
                        )
                        if requesting_officer:
                            submission.requesting_officer = requesting_officer

            # Update defendants
            defendants_json = json_record.get("defendants", [])
            if defendants_json:
                defendants_data = mapper.map_defendant_data(defendants_json)
                defendants = factory.batch_create_defendants(defendants_data)
                if defendants:
                    submission.defendants.set(defendants)

            # Update drug bags (this is more complex as we need to handle existing bags)
            self.update_drug_bags(submission, json_record, factory, mapper)

            submission.save()

        except Exception as e:
            logger.error(
                f"Error updating related objects for submission {submission.legacy_id}: {e}"
            )
            raise

    def update_drug_bags(
        self, submission: Submission, json_record: Dict[str, Any], factory, mapper
    ) -> None:
        """
        Update drug bags for an existing submission, handling existing bags carefully.

        Args:
            submission: Existing Submission instance
            json_record: New JSON record data
            factory: ModelFactory instance
            mapper: CannabisDataMapper instance
        """
        try:
            # Get existing drug bags
            existing_bags = {bag.seal_tag_number: bag for bag in submission.bags.all()}

            # Map new drug bag data
            drug_bags_data = mapper.map_drug_bag_data(json_record)

            # Process each new bag
            for bag_data in drug_bags_data:
                if bag_data.seal_tag_number in existing_bags:
                    # Update existing bag
                    existing_bag = existing_bags[bag_data.seal_tag_number]
                    existing_bag.content_type = bag_data.content_type
                    existing_bag.quantity = bag_data.quantity or 1
                    existing_bag.suspected_as = bag_data.suspected_as or "Cannabis"
                    existing_bag.new_seal_tag_number = bag_data.new_seal_tag_number
                    existing_bag.property_reference = bag_data.property_reference or ""
                    if bag_data.gross_weight:
                        existing_bag.gross_weight = bag_data.gross_weight
                    if bag_data.net_weight:
                        existing_bag.net_weight = bag_data.net_weight
                    existing_bag.save()

                    # Update botanical assessment if needed
                    try:
                        assessment = existing_bag.assessment
                        result_json = json_record.get("result", {})
                        cert_date_json = json_record.get("cert_date", {})
                        assessment_data = mapper.map_botanical_assessment_data(
                            result_json, cert_date_json
                        )

                        if assessment_data.determination:
                            assessment.determination = assessment_data.determination
                        if assessment_data.assessment_date:
                            assessment.assessment_date = assessment_data.assessment_date
                        if assessment_data.botanist_notes:
                            assessment.botanist_notes = assessment_data.botanist_notes
                        assessment.save()

                    except BotanicalAssessment.DoesNotExist:
                        # Create new assessment if it doesn't exist
                        result_json = json_record.get("result", {})
                        cert_date_json = json_record.get("cert_date", {})
                        assessment_data = mapper.map_botanical_assessment_data(
                            result_json, cert_date_json
                        )
                        factory.create_botanical_assessment(
                            assessment_data, existing_bag
                        )

                    logger.debug(
                        f"Updated existing drug bag {bag_data.seal_tag_number}"
                    )
                else:
                    # Create new bag
                    new_bag = factory.create_drug_bag(bag_data, submission)
                    if new_bag:
                        # Create botanical assessment for new bag
                        result_json = json_record.get("result", {})
                        cert_date_json = json_record.get("cert_date", {})
                        assessment_data = mapper.map_botanical_assessment_data(
                            result_json, cert_date_json
                        )
                        factory.create_botanical_assessment(assessment_data, new_bag)
                        logger.debug(f"Created new drug bag {bag_data.seal_tag_number}")

        except Exception as e:
            logger.error(
                f"Error updating drug bags for submission {submission.legacy_id}: {e}"
            )
            raise

    def save_processing_state(self, state: ProcessingState) -> bool:
        """
        Save processing state to temporary file for resume capability.

        Args:
            state: ProcessingState to save

        Returns:
            bool: True if saved successfully
        """
        try:
            with open(self.state_file_path, "w") as f:
                json.dump(state.to_dict(), f, indent=2)
            logger.debug(f"Saved processing state to {self.state_file_path}")
            return True
        except Exception as e:
            logger.error(f"Error saving processing state: {e}")
            return False

    def load_processing_state(self) -> Optional[ProcessingState]:
        """
        Load processing state from temporary file.

        Returns:
            Optional[ProcessingState]: Loaded state or None if not found/invalid
        """
        try:
            if not os.path.exists(self.state_file_path):
                return None

            with open(self.state_file_path, "r") as f:
                data = json.load(f)

            state = ProcessingState.from_dict(data)
            logger.info(f"Loaded processing state from {self.state_file_path}")
            return state

        except Exception as e:
            logger.error(f"Error loading processing state: {e}")
            return None

    def clear_processing_state(self) -> bool:
        """
        Clear the processing state file.

        Returns:
            bool: True if cleared successfully
        """
        try:
            if os.path.exists(self.state_file_path):
                os.remove(self.state_file_path)
                logger.debug(f"Cleared processing state file {self.state_file_path}")
            return True
        except Exception as e:
            logger.error(f"Error clearing processing state: {e}")
            return False

    def validate_resume_consistency(
        self, state: ProcessingState, json_file: str
    ) -> bool:
        """
        Validate data consistency when resuming operations.

        Args:
            state: Loaded processing state
            json_file: Path to JSON file being processed

        Returns:
            bool: True if data is consistent for resuming
        """
        try:
            # Check if file path matches
            if state.file_path != json_file:
                logger.warning(
                    f"File path mismatch: state has {state.file_path}, current is {json_file}"
                )
                return False

            # Check if file still exists and is readable
            if not os.path.exists(json_file):
                logger.error(f"JSON file no longer exists: {json_file}")
                return False

            # Load and check record count
            with open(json_file, "r") as f:
                records = json.load(f)

            if len(records) != state.total_records:
                logger.warning(
                    f"Record count mismatch: state has {state.total_records}, file has {len(records)}"
                )
                return False

            # Validate that the last processed record exists and matches
            if state.last_processed_legacy_id:
                if state.last_processed_record < len(records):
                    record = records[state.last_processed_record]
                    record_legacy_id = str(record.get("row_id", ""))
                    if record_legacy_id != state.last_processed_legacy_id:
                        logger.warning(
                            f"Last processed record mismatch: state has {state.last_processed_legacy_id}, "
                            f"file has {record_legacy_id}"
                        )
                        return False

            # Check database consistency - verify some of the processed records still exist
            if state.successful_records > 0:
                sample_size = min(10, state.successful_records)
                sample_records = records[
                    max(
                        0, state.last_processed_record - sample_size
                    ) : state.last_processed_record
                ]

                missing_count = 0
                for record in sample_records:
                    legacy_id = str(record.get("row_id", ""))
                    if not self.detect_existing_record(legacy_id):
                        missing_count += 1

                if missing_count > sample_size * 0.5:  # More than 50% missing
                    logger.warning(
                        f"Database consistency check failed: {missing_count}/{sample_size} sample records missing"
                    )
                    return False

            logger.info("Resume consistency validation passed")
            return True

        except Exception as e:
            logger.error(f"Error validating resume consistency: {e}")
            return False

    def get_resume_start_position(self, state: ProcessingState) -> int:
        """
        Get the position to resume processing from.

        Args:
            state: Loaded processing state

        Returns:
            int: Record index to resume from
        """
        # Resume from the next record after the last processed one
        return state.last_processed_record + 1
