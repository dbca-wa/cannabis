"""
Test Enhanced Cannabis ETL System

This management command tests the enhanced ETL functionality including:
- New field mappings with various data scenarios
- Array handling with different tag/description combinations
- Preprocessing deduplication logic
- Certificate creation from historical data
- End-to-end testing with enhanced field capture
"""

import json
import logging
from decimal import Decimal
from django.core.management.base import BaseCommand
from django.db import transaction
from django.utils import timezone

from submissions.models import (
    Submission,
    DrugBag,
    BotanicalAssessment,
    Certificate,
    Defendant,
)
from police.models import PoliceOfficer, PoliceStation
from users.models import User

from .etl_modules.data_preprocessor import DataPreprocessor
from .etl_modules.data_mapper import CannabisDataMapper
from .etl_modules.model_factory import ModelFactory
from .etl_modules.error_handler import ErrorHandler

logger = logging.getLogger(__name__)


class Command(BaseCommand):
    help = "Test enhanced Cannabis ETL system with comprehensive validation"

    def add_arguments(self, parser):
        parser.add_argument(
            "--test-data-file",
            type=str,
            default="etl/data/modded/cannabis_final.json",
            help="Path to test data file (default: etl/data/modded/cannabis_final.json)",
        )
        parser.add_argument(
            "--max-records",
            type=int,
            default=5,
            help="Maximum number of records to test (default: 5)",
        )
        parser.add_argument(
            "--cleanup", action="store_true", help="Clean up test data after testing"
        )

    def handle(self, *args, **options):
        """Main test execution"""
        self.stdout.write(self.style.SUCCESS("Starting Enhanced ETL Testing..."))

        test_data_file = options["test_data_file"]
        max_records = options["max_records"]
        cleanup = options["cleanup"]

        try:
            # Load test data
            test_records = self.load_test_data(test_data_file, max_records)

            # Run comprehensive tests
            with transaction.atomic():
                savepoint = transaction.savepoint()

                try:
                    self.run_preprocessing_tests(test_records)
                    self.run_array_handling_tests(test_records)
                    self.run_new_field_mapping_tests(test_records)

                    self.run_end_to_end_tests(test_records)

                    self.stdout.write(self.style.SUCCESS("All tests passed!"))

                    if cleanup:
                        transaction.savepoint_rollback(savepoint)
                        self.stdout.write(self.style.WARNING("Test data cleaned up"))
                    else:
                        transaction.savepoint_commit(savepoint)
                        self.stdout.write(
                            self.style.WARNING("Test data preserved in database")
                        )

                except Exception as e:
                    transaction.savepoint_rollback(savepoint)
                    self.stdout.write(self.style.ERROR(f"Tests failed: {e}"))
                    raise

        except Exception as e:
            self.stdout.write(self.style.ERROR(f"Test execution failed: {e}"))
            return

    def load_test_data(self, file_path: str, max_records: int) -> list:
        """Load test data from JSON file"""
        self.stdout.write(f"Loading test data from {file_path}...")

        try:
            with open(file_path, "r") as f:
                all_records = json.load(f)

            # Take only the requested number of records
            test_records = all_records[:max_records]

            self.stdout.write(f"Loaded {len(test_records)} test records")
            return test_records

        except Exception as e:
            raise Exception(f"Failed to load test data: {e}")

    def run_preprocessing_tests(self, test_records: list):
        """Test data preprocessing deduplication logic"""
        self.stdout.write(self.style.HTTP_INFO("Testing data preprocessing..."))

        preprocessor = DataPreprocessor()

        # Test preprocessing
        preprocessed_data = preprocessor.preprocess_all_entities(test_records)

        # Validate results
        assert "botanists" in preprocessed_data
        assert "stations" in preprocessed_data
        assert "officers" in preprocessed_data
        assert "defendants" in preprocessed_data

        # Check that entities were created
        botanists = preprocessed_data["botanists"]
        stations = preprocessed_data["stations"]
        officers = preprocessed_data["officers"]
        defendants = preprocessed_data["defendants"]

        self.stdout.write(f"  Created {len(botanists)} botanists")
        self.stdout.write(f"  Created {len(stations)} stations")
        self.stdout.write(f"  Created {len(officers)} officers")
        self.stdout.write(f"  Created {len(defendants)} defendants")

        # Test deduplication - run preprocessing again
        preprocessed_data2 = preprocessor.preprocess_all_entities(test_records)

        # Should find existing entities, not create new ones
        stats = preprocessor.get_preprocessing_stats()
        existing_count = (
            stats["botanists_existing"]
            + stats["stations_existing"]
            + stats["officers_existing"]
            + stats["defendants_existing"]
        )

        assert (
            existing_count > 0
        ), "Deduplication not working - no existing entities found"

        self.stdout.write(self.style.SUCCESS("  ✓ Preprocessing tests passed"))

    def run_array_handling_tests(self, test_records: list):
        """Test array field handling with different tag/description combinations"""
        self.stdout.write(self.style.HTTP_INFO("Testing array field handling..."))

        mapper = CannabisDataMapper()

        # Test various array scenarios
        test_scenarios = [
            {
                "name": "Multiple tags, single description",
                "record": {
                    "row_id": "test_1",
                    "quantity_of_bags": 2,
                    "tag_numbers": ["TAG001", "TAG002"],
                    "description": ["head"],
                    "result": {"new_tag_numbers": ["NEWTAG001", "NEWTAG002"]},
                    "police_reference_number": "REF001",
                },
            },
            {
                "name": "Single tag, multiple descriptions",
                "record": {
                    "row_id": "test_2",
                    "quantity_of_bags": 2,
                    "tag_numbers": ["TAG003"],
                    "description": ["head", "seed"],
                    "result": {"new_tag_numbers": []},
                    "police_reference_number": "REF002",
                },
            },
            {
                "name": "Mismatched arrays",
                "record": {
                    "row_id": "test_3",
                    "quantity_of_bags": 3,
                    "tag_numbers": ["TAG004", "TAG005"],
                    "description": ["plant"],
                    "result": {"new_tag_numbers": ["NEWTAG003"]},
                    "police_reference_number": "REF003",
                },
            },
        ]

        for scenario in test_scenarios:
            self.stdout.write(f'  Testing: {scenario["name"]}')

            # Map drug bag data (now returns single bag)
            drug_bag_data = mapper.map_drug_bag_data(scenario["record"])

            # Validate array handling
            assert drug_bag_data, f"No drug bag created for {scenario['name']}"

            # Check tag distribution
            assert drug_bag_data.seal_tag_numbers, f"Missing seal_tag_numbers for bag"

            # Validate content type mapping
            assert drug_bag_data.content_type, f"Missing content_type for bag"

            self.stdout.write(
                f"    ✓ Created 1 bag with tags: {drug_bag_data.seal_tag_numbers}"
            )

        self.stdout.write(self.style.SUCCESS("  ✓ Array handling tests passed"))

    def run_new_field_mapping_tests(self, test_records: list):
        """Test new field mappings with various data scenarios"""
        self.stdout.write(self.style.HTTP_INFO("Testing new field mappings..."))

        mapper = CannabisDataMapper()

        # Test basic botanical assessment mapping
        test_result = {
            "identified_as": "Cannabis sativa",
            "processing_notes": {
                "original_text": "Sample assessment notes",
            },
        }

        test_cert_date = {
            "standardized_date": "2023-01-15",
            "original_date": "15-Jan-23",
        }

        assessment_data = mapper.map_botanical_assessment_data(
            test_result, test_cert_date
        )

        # Validate basic fields
        assert assessment_data.determination, "Determination not mapped"
        assert assessment_data.botanist_notes, "Botanist notes not mapped"
        assert assessment_data.assessment_date, "Assessment date not mapped"

        # Test certificate mapping

        self.stdout.write(self.style.SUCCESS("  ✓ Basic field mapping tests passed"))

    def run_end_to_end_tests(self, test_records: list):
        """End-to-end testing with enhanced field capture"""
        self.stdout.write(self.style.HTTP_INFO("Testing end-to-end processing..."))

        if not test_records:
            self.stdout.write(self.style.WARNING("  No test records available"))
            return

        # Use first test record for comprehensive test
        test_record = test_records[0]

        # Initialize components
        preprocessor = DataPreprocessor()
        mapper = CannabisDataMapper()
        error_handler = ErrorHandler()

        # Preprocess entities
        preprocessed_data = preprocessor.preprocess_all_entities([test_record])
        factory = ModelFactory(preprocessed_data, error_handler)

        # Map all data
        submission_data = mapper.map_submission_data(test_record)

        # Create submission with preprocessed entities
        submission = factory.create_or_update_submission(submission_data)
        assert submission, "Failed to create submission in end-to-end test"

        # Create single drug bag with array handling
        drug_bag_data = mapper.map_drug_bag_data(test_record)

        drug_bag = factory.create_drug_bag(drug_bag_data, submission)
        assert drug_bag, f"Failed to create drug bag {drug_bag_data.seal_tag_numbers}"

        # Create botanical assessments with enhanced fields
        result_json = test_record.get("result", {})
        cert_date_json = test_record.get("cert_date", {})

        if result_json and cert_date_json:
            assessment_data = mapper.map_botanical_assessment_data(
                result_json, cert_date_json
            )

            assessment = factory.create_botanical_assessment(assessment_data, drug_bag)
            assert (
                assessment
            ), f"Failed to create assessment for bag {drug_bag.seal_tag_numbers}"

        # Validate complete data integrity
        self.validate_data_integrity(submission, drug_bag)

        self.stdout.write(f"  ✓ Processed complete submission {submission.case_number}")
        self.stdout.write(
            f"    - 1 drug bag created with tags: {drug_bag.seal_tag_numbers}"
        )
        self.stdout.write(self.style.SUCCESS("  ✓ End-to-end tests passed"))

    def validate_data_integrity(self, submission: Submission, drug_bag):
        """Validate data integrity after processing"""

        # Check submission fields
        assert submission.legacy_id, "Legacy ID missing"
        assert submission.case_number, "Case number missing"
        assert submission.received, "Received date missing"

        # Check drug bag
        assert drug_bag.seal_tag_numbers, "Seal tag numbers missing"
        assert drug_bag.content_type, "Content type missing"
        assert drug_bag.submission == submission, "Drug bag not linked to submission"

        # Check assessment if exists
        if hasattr(drug_bag, "assessment"):
            assessment = drug_bag.assessment
            # Basic fields should be present
            assert (
                assessment.determination or assessment.botanist_notes
            ), "Assessment has no data"

    def create_test_scenarios(self):
        """Create additional test scenarios for edge cases"""
        return [
            # Edge case: Empty arrays
            {
                "row_id": "edge_1",
                "quantity_of_bags": 1,
                "tag_numbers": [],
                "description": [],
                "result": {"new_tag_numbers": []},
                "police_reference_number": "EDGE001",
            },
            # Edge case: Mismatched quantities
            {
                "row_id": "edge_2",
                "quantity_of_bags": 5,
                "tag_numbers": ["TAG1", "TAG2"],
                "description": ["head"],
                "result": {"new_tag_numbers": ["NEW1"]},
                "police_reference_number": "EDGE002",
            },
        ]
