"""
Comprehensive Test for Cannabis Data Loader Error Handling

This script tests the error handling with actual data scenarios and database operations.
"""

import json
import tempfile
from django.core.management.base import BaseCommand
from django.db import transaction

from .etl_modules.error_handler import ErrorHandler
from .etl_modules.model_factory import ModelFactory
from .etl_modules.database_manager import DatabaseManager


class Command(BaseCommand):
    """Comprehensive test command for error handling with real scenarios"""

    help = "Test comprehensive error handling with real data scenarios"

    def handle(self, *args, **options):
        """Main test handler"""
        self.stdout.write("Testing Comprehensive Error Handling with Real Scenarios")
        self.stdout.write("=" * 60)

        # Test with disposable database
        self.test_with_disposable_database()

        self.stdout.write(
            self.style.SUCCESS("\nComprehensive error handling tests completed")
        )

    def test_with_disposable_database(self):
        """Test error handling with disposable database"""
        self.stdout.write("\n1. Testing with Disposable Database")
        self.stdout.write("-" * 40)

        db_manager = DatabaseManager()

        try:
            with db_manager.disposable_database_context() as db_info:
                self.stdout.write(f"✓ Created test database: {db_info['name']}")

                # Test error handling within transaction context
                self.test_error_handling_in_transaction()

                # Test batch processing with errors
                self.test_batch_processing_with_errors()

                # Test error report generation
                self.test_error_report_generation()

        except Exception as e:
            self.stdout.write(f"✗ Disposable database test failed: {e}")

    def test_error_handling_in_transaction(self):
        """Test error handling within transaction context"""
        self.stdout.write("\n  Testing Error Handling in Transaction Context")

        error_handler = ErrorHandler()
        factory = ModelFactory(error_handler=error_handler)

        with transaction.atomic():
            # Test savepoint creation and rollback
            savepoint_id = error_handler.create_rollback_point()
            if savepoint_id:
                self.stdout.write(f"  ✓ Created savepoint: {savepoint_id}")

                # Test rollback
                rollback_success = error_handler.rollback_to_point(savepoint_id)
                self.stdout.write(
                    f"  ✓ Rollback test: {'SUCCESS' if rollback_success else 'FAILED'}"
                )
            else:
                self.stdout.write("  ✗ Failed to create savepoint")

    def test_batch_processing_with_errors(self):
        """Test batch processing with various error scenarios"""
        self.stdout.write("\n  Testing Batch Processing with Errors")

        error_handler = ErrorHandler()
        factory = ModelFactory(error_handler=error_handler)

        # Create test records with various error scenarios
        test_records = [
            {
                "row_id": "GOOD_001",
                "cert_number": "C001",
                "receipt_date": {"standardized_date": "2023-01-01T10:00:00Z"},
                "defendants": [{"given_names": "John", "last_name": "Doe"}],
                "police_officer": {
                    "submitting_officer": {
                        "name": "Officer Smith",
                        "rank": "Constable",
                    },
                    "organisation": "Test Station",
                },
                "quantity_of_bags": 1,
                "tag_numbers": ["TAG001"],
                "description": "plant_material",
                "result": {"identified_as": "cannabis_sativa"},
            },
            {
                "row_id": "BAD_001",
                # Missing required fields
                "cert_number": "",
                "receipt_date": {"standardized_date": "invalid-date"},
                "defendants": [],
                "police_officer": {},
                "quantity_of_bags": 0,
                "tag_numbers": [],
                "description": "invalid_type",
                "result": {},
            },
            {
                "row_id": "GOOD_002",
                "cert_number": "C002",
                "receipt_date": {"standardized_date": "2023-01-02T10:00:00Z"},
                "defendants": [{"given_names": "Jane", "last_name": "Smith"}],
                "police_officer": {
                    "submitting_officer": {
                        "name": "Officer Jones",
                        "rank": "Senior Constable",
                    },
                    "organisation": "Test Station 2",
                },
                "quantity_of_bags": 2,
                "tag_numbers": ["TAG002", "TAG003"],
                "description": "seed",
                "result": {"identified_as": "not_cannabis"},
            },
        ]

        successful = 0
        failed = 0

        for record in test_records:
            try:
                submission = factory.create_complete_submission_from_json(record)
                if submission:
                    successful += 1
                    self.stdout.write(f"  ✓ Processed record {record['row_id']}")
                else:
                    failed += 1
                    self.stdout.write(
                        f"  ✗ Failed to process record {record['row_id']}"
                    )
            except Exception as e:
                failed += 1
                self.stdout.write(
                    f"  ✗ Exception processing record {record['row_id']}: {e}"
                )

        self.stdout.write(f"  Batch Results: {successful} successful, {failed} failed")

        # Check error statistics
        report = error_handler.generate_error_report()
        stats = report["summary"]["statistics"]
        self.stdout.write(f"  Error Statistics: {stats['total_errors']} total errors")

    def test_error_report_generation(self):
        """Test comprehensive error report generation"""
        self.stdout.write("\n  Testing Error Report Generation")

        error_handler = ErrorHandler()

        # Generate some test errors
        from django.core.exceptions import ValidationError
        from django.db import IntegrityError

        # Add various types of errors
        error_handler.handle_validation_error(
            "REPORT_001",
            ValidationError("Test validation error"),
            context={"test": True},
        )

        error_handler.handle_integrity_error(
            "REPORT_002",
            IntegrityError("Test integrity error"),
            context={"model": "TestModel"},
        )

        # Generate comprehensive report
        report = error_handler.generate_error_report()

        self.stdout.write(
            f"  ✓ Generated report with {len(report['all_errors'])} errors"
        )
        self.stdout.write(
            f"  ✓ Error categories: {list(report['errors_by_category'].keys())}"
        )
        self.stdout.write(
            f"  ✓ Error severities: {list(report['errors_by_severity'].keys())}"
        )
        self.stdout.write(f"  ✓ Recommendations: {len(report['recommendations'])}")

        # Test report export
        try:
            with tempfile.NamedTemporaryFile(
                mode="w", suffix=".json", delete=False
            ) as f:
                export_success = error_handler.export_error_report(f.name, "json")
                self.stdout.write(
                    f"  ✓ JSON export: {'SUCCESS' if export_success else 'FAILED'}"
                )

            with tempfile.NamedTemporaryFile(
                mode="w", suffix=".csv", delete=False
            ) as f:
                export_success = error_handler.export_error_report(f.name, "csv")
                self.stdout.write(
                    f"  ✓ CSV export: {'SUCCESS' if export_success else 'FAILED'}"
                )

        except Exception as e:
            self.stdout.write(f"  ✗ Export test failed: {e}")
