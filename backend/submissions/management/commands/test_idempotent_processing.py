"""
Django Management Command: Test Idempotent Processing

This command tests the idempotent and resumable processing capabilities
of the Cannabis Data Loader.

Usage:
    python manage.py test_idempotent_processing
"""

import json
import tempfile
import os
from datetime import datetime

from django.core.management.base import BaseCommand
from django.db import transaction
from submissions.models import Submission, DrugBag, BotanicalAssessment
from police.models import PoliceOfficer, PoliceStation

from .etl_modules.idempotent_processor import (
    IdempotentProcessor,
    ProcessingState,
    AuditTrail,
)
from .etl_modules.error_handler import ErrorHandler
from .etl_modules.model_factory import ModelFactory
from .etl_modules.data_mapper import CannabisDataMapper


class Command(BaseCommand):
    """Django management command for testing idempotent processing"""

    help = "Test idempotent and resumable processing functionality"

    def create_test_json_record(self, row_id: int, cert_number: str = None) -> dict:
        """Create a test JSON record for testing"""
        if cert_number is None:
            cert_number = f"CERT-{row_id}"

        return {
            "row_id": row_id,
            "cert_number": cert_number,
            "approved_botanist": "Dr. Test Botanist",
            "receipt_date": {"standardized_date": "2023-01-15"},
            "quantity_of_bags": 2,
            "tag_numbers": [f"TAG-{row_id}-1", f"TAG-{row_id}-2"],
            "description": ["plant_material"],
            "police_reference_number": f"REF-{row_id}",
            "police_officer": {
                "submitting_officer": {
                    "name": "John Smith",
                    "rank": "Constable",
                    "badge_id": f"BADGE-{row_id}",
                    "organisation": "Test Police Station",
                },
                "requesting_officer": {
                    "name": "Jane Doe",
                    "rank": "Senior Constable",
                    "badge_id": f"BADGE-REQ-{row_id}",
                    "organisation": "Test Police Station",
                },
            },
            "defendants": [{"given_names": "Test", "last_name": f"Defendant-{row_id}"}],
            "result": {
                "identified_as": "cannabis_sativa",
                "processing_notes": {
                    "original_text": f"Test botanical notes for record {row_id}"
                },
            },
            "cert_date": {"standardized_date": "2023-01-20"},
        }

    def test_duplicate_detection(self):
        """Test duplicate detection functionality"""
        self.stdout.write("Testing duplicate detection...")

        # Initialize processor
        error_handler = ErrorHandler()
        processor = IdempotentProcessor(error_handler)
        factory = ModelFactory(error_handler)

        # Create test record
        test_record = self.create_test_json_record(1001, "CERT-TEST-1001")

        # First creation - should not exist
        existing = processor.detect_existing_record("1001")
        assert existing is None, "Record should not exist initially"

        # Create the record
        submission = factory.create_complete_submission_from_json(test_record)
        assert submission is not None, "Failed to create submission"
        assert (
            submission.legacy_id == "1001"
        ), f"Expected legacy_id 1001, got {submission.legacy_id}"

        # Second check - should now exist
        existing = processor.detect_existing_record("1001")
        assert existing is not None, "Record should exist after creation"
        assert (
            existing.legacy_id == "1001"
        ), f"Expected legacy_id 1001, got {existing.legacy_id}"

        self.stdout.write(self.style.SUCCESS("✓ Duplicate detection test passed"))

    def test_audit_trail_preservation(self):
        """Test audit trail preservation during updates"""
        self.stdout.write("Testing audit trail preservation...")

        # Initialize processor
        error_handler = ErrorHandler()
        processor = IdempotentProcessor(error_handler)
        factory = ModelFactory(error_handler)

        # Create initial record
        test_record = self.create_test_json_record(1002, "CERT-TEST-1002")
        submission = factory.create_complete_submission_from_json(test_record)
        assert submission is not None, "Failed to create initial submission"

        # Preserve audit trail
        audit_trail = processor.preserve_audit_trail(submission)
        assert audit_trail is not None, "Failed to preserve audit trail"
        assert (
            audit_trail.update_count == 0
        ), f"Expected update_count 0, got {audit_trail.update_count}"

        # Update the record with a different police reference number
        updated_record = self.create_test_json_record(1002, "CERT-TEST-1002")
        updated_record["police_reference_number"] = "UPDATED-REF-1002"
        updated_submission = processor.update_existing_record(
            submission, updated_record, audit_trail
        )

        assert updated_submission is not None, "Failed to update submission"
        expected_case_number = "UPDATED-REF-1002"
        actual_case_number = updated_submission.case_number
        assert (
            actual_case_number == expected_case_number
        ), f"Case number not updated: expected '{expected_case_number}', got '{actual_case_number}'"
        assert (
            "ETL_UPDATE:" in updated_submission.assessment_notes
        ), "Audit trail not preserved in notes"

        self.stdout.write(self.style.SUCCESS("✓ Audit trail preservation test passed"))

    def test_should_update_logic(self):
        """Test the logic for determining if a record should be updated"""
        self.stdout.write("Testing should update logic...")

        # Initialize processor
        error_handler = ErrorHandler()
        processor = IdempotentProcessor(error_handler)
        factory = ModelFactory(error_handler)

        # Create initial record
        test_record = self.create_test_json_record(1003, "CERT-TEST-1003")
        submission = factory.create_complete_submission_from_json(test_record)
        assert submission is not None, "Failed to create initial submission"

        # Test with same data - should not update
        should_update = processor.should_update_record(submission, test_record)
        assert not should_update, "Should not update when data is the same"

        # Test with different police reference number (case number) - should update
        updated_record = self.create_test_json_record(1003, "CERT-TEST-1003")
        updated_record["police_reference_number"] = "CHANGED-REF-1003"
        should_update = processor.should_update_record(submission, updated_record)
        assert should_update, "Should update when case number changes"

        self.stdout.write(self.style.SUCCESS("✓ Should update logic test passed"))

    def test_processing_state_management(self):
        """Test processing state save/load functionality"""
        self.stdout.write("Testing processing state management...")

        # Initialize processor
        error_handler = ErrorHandler()
        processor = IdempotentProcessor(error_handler)

        # Create test state
        original_state = ProcessingState(
            total_records=1000,
            processed_records=500,
            successful_records=480,
            failed_records=20,
            last_processed_record=499,
            last_processed_legacy_id="499",
            start_time=datetime.now(),
            last_update_time=datetime.now(),
            batch_size=100,
            file_path="/test/path/cannabis_final.json",
        )

        # Save state
        success = processor.save_processing_state(original_state)
        assert success, "Failed to save processing state"

        # Load state
        loaded_state = processor.load_processing_state()
        assert loaded_state is not None, "Failed to load processing state"
        assert (
            loaded_state.total_records == original_state.total_records
        ), "Total records mismatch"
        assert (
            loaded_state.processed_records == original_state.processed_records
        ), "Processed records mismatch"
        assert (
            loaded_state.last_processed_legacy_id
            == original_state.last_processed_legacy_id
        ), "Last processed ID mismatch"

        # Clear state
        success = processor.clear_processing_state()
        assert success, "Failed to clear processing state"

        # Verify cleared
        cleared_state = processor.load_processing_state()
        assert cleared_state is None, "State should be None after clearing"

        self.stdout.write(
            self.style.SUCCESS("✓ Processing state management test passed")
        )

    def test_resume_consistency_validation(self):
        """Test resume consistency validation"""
        self.stdout.write("Testing resume consistency validation...")

        # Create temporary JSON file
        test_records = [
            self.create_test_json_record(1, "CERT-1"),
            self.create_test_json_record(2, "CERT-2"),
            self.create_test_json_record(3, "CERT-3"),
        ]

        with tempfile.NamedTemporaryFile(mode="w", suffix=".json", delete=False) as f:
            json.dump(test_records, f)
            temp_file = f.name

        try:
            # Initialize processor
            error_handler = ErrorHandler()
            processor = IdempotentProcessor(error_handler)

            # Create matching state
            state = ProcessingState(
                total_records=3,
                processed_records=2,
                successful_records=2,
                failed_records=0,
                last_processed_record=1,
                last_processed_legacy_id="2",
                start_time=datetime.now(),
                last_update_time=datetime.now(),
                batch_size=100,
                file_path=temp_file,
            )

            # Test consistency validation
            is_consistent = processor.validate_resume_consistency(state, temp_file)
            assert (
                is_consistent
            ), "Consistency validation should pass with matching data"

            # Test with mismatched file path
            state.file_path = "/wrong/path.json"
            is_consistent = processor.validate_resume_consistency(state, temp_file)
            assert (
                not is_consistent
            ), "Consistency validation should fail with wrong file path"

            self.stdout.write(
                self.style.SUCCESS("✓ Resume consistency validation test passed")
            )

        finally:
            # Clean up temp file
            os.unlink(temp_file)

    def test_get_resume_position(self):
        """Test getting resume position"""
        self.stdout.write("Testing resume position calculation...")

        # Initialize processor
        error_handler = ErrorHandler()
        processor = IdempotentProcessor(error_handler)

        # Create test state
        state = ProcessingState(
            total_records=1000,
            processed_records=500,
            successful_records=480,
            failed_records=20,
            last_processed_record=499,
            last_processed_legacy_id="499",
            start_time=datetime.now(),
            last_update_time=datetime.now(),
            batch_size=100,
            file_path="/test/path/cannabis_final.json",
        )

        # Get resume position
        resume_pos = processor.get_resume_start_position(state)
        assert resume_pos == 500, f"Expected resume position 500, got {resume_pos}"

        self.stdout.write(
            self.style.SUCCESS("✓ Resume position calculation test passed")
        )

    def handle(self, *args, **options):
        """Run all idempotent processing tests"""
        self.stdout.write("Running idempotent processing tests...")
        self.stdout.write("=" * 60)

        try:
            with transaction.atomic():
                self.test_duplicate_detection()
                self.test_audit_trail_preservation()
                self.test_should_update_logic()
                self.test_processing_state_management()
                self.test_resume_consistency_validation()
                self.test_get_resume_position()

                # Rollback all test data
                raise Exception("Rollback test data")

        except Exception as e:
            if "Rollback test data" not in str(e):
                self.stdout.write(self.style.ERROR(f"Test failed: {e}"))
                raise

        self.stdout.write("=" * 60)
        self.stdout.write(
            self.style.SUCCESS("✓ All idempotent processing tests passed!")
        )
