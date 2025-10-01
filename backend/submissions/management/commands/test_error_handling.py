"""
Test script for Cannabis Data Loader Error Handling

This script tests the comprehensive error handling capabilities including:
- Validation error handling
- Database error recovery
- Retry logic
- Rollback capabilities
"""

import json
import logging
from django.core.management.base import BaseCommand
from django.db import transaction, IntegrityError
from django.core.exceptions import ValidationError

from .etl_modules.error_handler import ErrorHandler, ErrorCategory, ErrorSeverity
from .etl_modules.model_factory import ModelFactory
from .etl_modules.database_manager import DatabaseManager
from .etl_modules.data_mapper import CannabisDataMapper, SubmissionData

logger = logging.getLogger(__name__)


class Command(BaseCommand):
    """Test command for error handling capabilities"""

    help = "Test comprehensive error handling for cannabis data loader"

    def add_arguments(self, parser):
        """Add command line arguments"""
        parser.add_argument(
            "--test-type",
            choices=["validation", "database", "integrity", "connection", "all"],
            default="all",
            help="Type of error handling to test",
        )
        parser.add_argument(
            "--verbose", action="store_true", help="Enable verbose output"
        )

    def handle(self, *args, **options):
        """Main test handler"""
        if options["verbose"]:
            logging.basicConfig(level=logging.DEBUG)

        test_type = options["test_type"]

        self.stdout.write("Testing Cannabis Data Loader Error Handling")
        self.stdout.write("=" * 50)

        if test_type in ["validation", "all"]:
            self.test_validation_error_handling()

        if test_type in ["database", "all"]:
            self.test_database_error_recovery()

        if test_type in ["integrity", "all"]:
            self.test_integrity_error_handling()

        if test_type in ["connection", "all"]:
            self.test_connection_recovery()

        self.stdout.write(self.style.SUCCESS("\nAll error handling tests completed"))

    def test_validation_error_handling(self):
        """Test validation error handling"""
        self.stdout.write("\n1. Testing Validation Error Handling")
        self.stdout.write("-" * 40)

        error_handler = ErrorHandler()

        # Test missing required field
        try:
            raise ValidationError("legacy_id is required")
        except ValidationError as e:
            should_continue = error_handler.handle_validation_error(
                "TEST_001", e, context={"field": "legacy_id"}
            )
            self.stdout.write(
                f"✓ Handled missing required field error, continue: {should_continue}"
            )

        # Test invalid choice
        try:
            raise ValidationError("Invalid choice for content_type")
        except ValidationError as e:
            should_continue = error_handler.handle_validation_error(
                "TEST_002",
                e,
                context={"field": "content_type", "value": "invalid_type"},
            )
            self.stdout.write(
                f"✓ Handled invalid choice error, continue: {should_continue}"
            )

        # Test data format error
        try:
            raise ValueError("Invalid date format: '2023-13-45'")
        except ValueError as e:
            should_continue = error_handler.handle_validation_error(
                "TEST_003", e, context={"field": "received_date"}
            )
            self.stdout.write(
                f"✓ Handled date format error, continue: {should_continue}"
            )

        # Generate error report
        report = error_handler.generate_error_report()
        self.stdout.write(
            f"✓ Generated error report with {report['summary']['total_errors']} errors"
        )

    def test_database_error_recovery(self):
        """Test database error recovery with retry logic"""
        self.stdout.write("\n2. Testing Database Error Recovery")
        self.stdout.write("-" * 40)

        error_handler = ErrorHandler(max_retries=2, retry_delay=0.1)

        # Simulate connection timeout
        from django.db.utils import OperationalError

        try:
            raise OperationalError("connection timeout")
        except OperationalError as e:
            should_retry, should_continue = error_handler.handle_database_error(
                "TEST_004", e, operation="test_connection", retry_count=0
            )
            self.stdout.write(
                f"✓ Handled connection timeout, retry: {should_retry}, continue: {should_continue}"
            )

        # Simulate server error
        try:
            raise OperationalError("server closed the connection unexpectedly")
        except OperationalError as e:
            should_retry, should_continue = error_handler.handle_database_error(
                "TEST_005", e, operation="test_server", retry_count=1
            )
            self.stdout.write(
                f"✓ Handled server error, retry: {should_retry}, continue: {should_continue}"
            )

        # Test max retries exceeded
        try:
            raise OperationalError("network unreachable")
        except OperationalError as e:
            should_retry, should_continue = error_handler.handle_database_error(
                "TEST_006", e, operation="test_network", retry_count=3
            )
            self.stdout.write(
                f"✓ Handled max retries exceeded, retry: {should_retry}, continue: {should_continue}"
            )

    def test_integrity_error_handling(self):
        """Test integrity constraint violation handling"""
        self.stdout.write("\n3. Testing Integrity Error Handling")
        self.stdout.write("-" * 40)

        error_handler = ErrorHandler()

        # Test duplicate key error
        try:
            raise IntegrityError(
                'duplicate key value violates unique constraint "submissions_submission_legacy_id_key"'
            )
        except IntegrityError as e:
            should_continue = error_handler.handle_integrity_error(
                "TEST_007",
                e,
                context={
                    "model": "Submission",
                    "field": "legacy_id",
                    "value": "DUP001",
                },
            )
            self.stdout.write(
                f"✓ Handled duplicate key error, continue: {should_continue}"
            )

        # Test foreign key constraint
        try:
            raise IntegrityError(
                'insert or update on table "submissions_drugbag" violates foreign key constraint'
            )
        except IntegrityError as e:
            should_continue = error_handler.handle_integrity_error(
                "TEST_008", e, context={"model": "DrugBag", "field": "submission_id"}
            )
            self.stdout.write(
                f"✓ Handled foreign key constraint error, continue: {should_continue}"
            )

        # Test check constraint
        try:
            raise IntegrityError(
                'new row for relation "submissions_submission" violates check constraint'
            )
        except IntegrityError as e:
            should_continue = error_handler.handle_integrity_error(
                "TEST_009",
                e,
                context={"model": "Submission", "constraint": "check_constraint"},
            )
            self.stdout.write(
                f"✓ Handled check constraint error, continue: {should_continue}"
            )

    def test_connection_recovery(self):
        """Test database connection recovery"""
        self.stdout.write("\n4. Testing Connection Recovery")
        self.stdout.write("-" * 40)

        db_manager = DatabaseManager()

        # Test connection recovery
        recovery_success = db_manager.test_connection_recovery(max_retries=2)
        self.stdout.write(
            f"✓ Connection recovery test: {'SUCCESS' if recovery_success else 'FAILED'}"
        )

        # Test transaction isolation validation
        isolation_ok = db_manager.validate_transaction_isolation()
        self.stdout.write(
            f"✓ Transaction isolation validation: {'OK' if isolation_ok else 'WARNING'}"
        )

        # Test savepoint operations
        error_handler = ErrorHandler()

        try:
            savepoint_id = error_handler.create_rollback_point()
            if savepoint_id:
                self.stdout.write(f"✓ Created savepoint: {savepoint_id}")

                # Test rollback
                rollback_success = error_handler.rollback_to_point(savepoint_id)
                self.stdout.write(
                    f"✓ Rollback test: {'SUCCESS' if rollback_success else 'FAILED'}"
                )
            else:
                self.stdout.write("✗ Failed to create savepoint")

        except Exception as e:
            self.stdout.write(f"✗ Savepoint test failed: {e}")

    def test_model_factory_error_integration(self):
        """Test model factory integration with error handler"""
        self.stdout.write("\n5. Testing Model Factory Error Integration")
        self.stdout.write("-" * 40)

        error_handler = ErrorHandler()
        factory = ModelFactory(error_handler=error_handler)

        # Test with invalid submission data
        invalid_data = SubmissionData(
            legacy_id="",  # Invalid - empty
            case_number="TEST001",
            received=None,  # Invalid - None
            approved_botanist=None,
            assessment_notes=None,
            security_movement_envelope=None,
        )

        submission = factory.create_or_update_submission(invalid_data)
        self.stdout.write(
            f"✓ Invalid submission handling: {'HANDLED' if submission is None else 'UNEXPECTED'}"
        )

        # Check error statistics
        report = error_handler.generate_error_report()
        validation_errors = report["summary"]["statistics"]["validation_errors"]
        self.stdout.write(f"✓ Validation errors recorded: {validation_errors}")

        # Test error report export
        try:
            export_success = error_handler.export_error_report(
                "test_error_report.json", "json"
            )
            self.stdout.write(
                f"✓ Error report export: {'SUCCESS' if export_success else 'FAILED'}"
            )
        except Exception as e:
            self.stdout.write(f"✗ Error report export failed: {e}")
