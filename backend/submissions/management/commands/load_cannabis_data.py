"""
Django Management Command: Load Cannabis Data

This command loads processed cannabis data from cannabis_clean.json into the Django database.
It provides safe testing through disposable databases and production loading with explicit confirmation.

Usage:
    python manage.py load_cannabis_data [--real] [--file path/to/file.json]
"""

import json
import logging
import os
from datetime import datetime
from typing import Dict, Any, List

from django.core.management.base import BaseCommand, CommandError
from django.db import transaction
from django.db.utils import OperationalError, IntegrityError
from django.contrib.auth import get_user_model

from submissions.models import Submission, Defendant, DrugBag, BotanicalAssessment
from police.models import PoliceOfficer, PoliceStation

# Import the ETL modules
from .etl_modules.data_mapper import CannabisDataMapper
from .etl_modules.model_factory import ModelFactory
from .etl_modules.database_manager import DatabaseManager
from .etl_modules.error_handler import ErrorHandler
from .etl_modules.progress_reporter import ProgressReporter
from .etl_modules.validation_reporter import ValidationReporter
from .etl_modules.idempotent_processor import IdempotentProcessor, ProcessingState

User = get_user_model()
logger = logging.getLogger(__name__)


class Command(BaseCommand):
    """Django management command for loading cannabis data"""

    help = "Load processed cannabis data from JSON file into Django database"

    def add_arguments(self, parser):
        """Add command line arguments"""
        parser.add_argument(
            "--file",
            type=str,
            default="etl/data/modded/cannabis_clean.json",
            help="Path to cannabis JSON file (default: etl/data/modded/cannabis_clean.json)",
        )
        parser.add_argument(
            "--real",
            action="store_true",
            help="Load data into production database (requires confirmation)",
        )
        parser.add_argument(
            "--batch-size",
            type=int,
            default=100,
            help="Number of records to process in each batch (default: 100)",
        )
        parser.add_argument(
            "--start-from",
            type=int,
            default=0,
            help="Start processing from this record number (for resuming)",
        )
        parser.add_argument(
            "--max-records",
            type=int,
            help="Maximum number of records to process (for testing)",
        )
        parser.add_argument(
            "--resume",
            action="store_true",
            help="Resume from last processing state (if available)",
        )
        parser.add_argument(
            "--force-restart",
            action="store_true",
            help="Force restart from beginning, ignoring any saved state",
        )

    def handle(self, *args, **options):
        """Main command handler"""
        try:
            # Setup logging
            self.setup_logging(options["verbosity"])

            # Validate arguments
            json_file = self.validate_json_file(options["file"])

            # Confirm production mode if --real flag is used
            if options["real"]:
                self.confirm_production_mode()
            else:
                self.stdout.write(
                    self.style.WARNING(
                        "Running in TEST mode (use --real for production)"
                    )
                )

            # Load and process data
            self.load_cannabis_data(
                json_file=json_file,
                real_mode=options["real"],
                batch_size=options["batch_size"],
                start_from=options["start_from"],
                max_records=options["max_records"],
                resume=options["resume"],
                force_restart=options["force_restart"],
            )

        except KeyboardInterrupt:
            self.stdout.write(self.style.ERROR("\nOperation cancelled by user"))
            return
        except Exception as e:
            logger.error(f"Command failed: {e}")
            raise CommandError(f"Failed to load cannabis data: {e}")

    def setup_logging(self, verbosity: int):
        """Setup logging based on verbosity level"""
        log_levels = {
            0: logging.WARNING,
            1: logging.INFO,
            2: logging.DEBUG,
        }

        level = log_levels.get(verbosity, logging.DEBUG)
        logging.basicConfig(
            level=level, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
        )

    def validate_json_file(self, file_path: str) -> str:
        """Validate that the JSON file exists and is readable"""
        if not os.path.isabs(file_path):
            # Make path relative to Django project root
            from django.conf import settings

            file_path = os.path.join(settings.BASE_DIR, file_path)

        if not os.path.exists(file_path):
            raise CommandError(f"JSON file not found: {file_path}")

        if not os.access(file_path, os.R_OK):
            raise CommandError(f"Cannot read JSON file: {file_path}")

        # Test JSON parsing
        try:
            with open(file_path, "r") as f:
                json.load(f)
        except json.JSONDecodeError as e:
            raise CommandError(f"Invalid JSON file: {e}")

        self.stdout.write(f"Using JSON file: {file_path}")
        return file_path

    def confirm_production_mode(self):
        """Confirm production mode with user"""
        self.stdout.write(
            self.style.ERROR(
                "WARNING: You are about to load data into the PRODUCTION database!"
            )
        )
        self.stdout.write(
            "This operation will create/update records in the live system."
        )

        confirm = input('Type "yes" to continue, or anything else to cancel: ')
        if confirm.lower() != "yes":
            raise CommandError("Operation cancelled by user")

        self.stdout.write(self.style.SUCCESS("Production mode confirmed"))

    def load_cannabis_data(
        self,
        json_file: str,
        real_mode: bool,
        batch_size: int,
        start_from: int,
        max_records: int = None,
        resume: bool = False,
        force_restart: bool = False,
    ):
        """Load cannabis data from JSON file"""

        # Initialize database manager
        db_manager = DatabaseManager()

        if real_mode:
            # Production mode - validate connection and proceed
            self.load_data_production_mode(
                db_manager,
                json_file,
                batch_size,
                start_from,
                max_records,
                resume,
                force_restart,
            )
        else:
            # Test mode - use disposable database
            self.load_data_test_mode(
                db_manager,
                json_file,
                batch_size,
                start_from,
                max_records,
                resume,
                force_restart,
            )

    def load_data_test_mode(
        self,
        db_manager: DatabaseManager,
        json_file: str,
        batch_size: int,
        start_from: int,
        max_records: int = None,
        resume: bool = False,
        force_restart: bool = False,
    ):
        """Load data using disposable test database"""
        self.stdout.write(
            self.style.SUCCESS("Using disposable PostgreSQL database for testing")
        )

        try:
            with db_manager.disposable_database_context() as db_info:
                self.stdout.write(f"Created test database: {db_info['name']}")

                # Process data with test database
                self.process_cannabis_data(
                    json_file,
                    batch_size,
                    start_from,
                    max_records,
                    resume,
                    force_restart,
                )

                self.stdout.write(
                    self.style.SUCCESS(
                        "Test completed - disposable database will be cleaned up"
                    )
                )

        except Exception as e:
            self.stdout.write(self.style.ERROR(f"Test mode failed: {e}"))
            raise

    def load_data_production_mode(
        self,
        db_manager: DatabaseManager,
        json_file: str,
        batch_size: int,
        start_from: int,
        max_records: int = None,
        resume: bool = False,
        force_restart: bool = False,
    ):
        """Load data into production database with comprehensive error recovery"""
        self.stdout.write("Validating production database connection...")

        # Test connection recovery capabilities
        if not db_manager.test_connection_recovery():
            raise CommandError("Production database connection test failed")

        if not db_manager.validate_production_connection():
            # Attempt connection recovery
            if db_manager.recover_from_connection_loss():
                self.stdout.write(self.style.WARNING("Database connection recovered"))
            else:
                raise CommandError("Production database connection validation failed")

        if not db_manager.validate_schema():
            raise CommandError("Production database schema validation failed")

        # Validate transaction isolation
        if not db_manager.validate_transaction_isolation():
            self.stdout.write(
                self.style.WARNING("Transaction isolation level may cause issues")
            )

        self.stdout.write(self.style.SUCCESS("Production database validated"))

        # Process data with enhanced error recovery
        retry_count = 0
        max_retries = 3

        while retry_count <= max_retries:
            try:
                # Use enhanced transaction context with retry logic
                with db_manager.production_transaction_context(
                    retry_on_failure=True, max_retries=2
                ):
                    self.process_cannabis_data(
                        json_file,
                        batch_size,
                        start_from,
                        max_records,
                        resume,
                        force_restart,
                    )
                break  # Success - exit retry loop

            except OperationalError as e:
                retry_count += 1
                error_msg = str(e).lower()

                if retry_count <= max_retries and any(
                    keyword in error_msg
                    for keyword in ["connection", "timeout", "server"]
                ):
                    self.stdout.write(
                        self.style.WARNING(
                            f"Connection error, attempting recovery (attempt {retry_count})"
                        )
                    )

                    # Attempt connection recovery
                    if db_manager.recover_from_connection_loss():
                        continue  # Retry the operation
                    else:
                        raise CommandError(
                            f"Failed to recover from connection error: {e}"
                        )
                else:
                    raise CommandError(
                        f"Production loading failed after {retry_count} attempts: {e}"
                    )

            except IntegrityError as e:
                # Don't retry integrity errors
                self.stdout.write(
                    self.style.ERROR(
                        f"Data integrity error - check for duplicate or invalid data: {e}"
                    )
                )
                raise CommandError(
                    f"Production loading failed due to data integrity: {e}"
                )

            except Exception as e:
                self.stdout.write(
                    self.style.ERROR(
                        f"Production loading failed and was rolled back: {e}"
                    )
                )
                raise CommandError(f"Production loading failed: {e}")

    def process_cannabis_data(
        self,
        json_file: str,
        batch_size: int,
        start_from: int,
        max_records: int = None,
        resume: bool = False,
        force_restart: bool = False,
    ):
        """Process cannabis data records with comprehensive error handling and idempotent processing"""

        # Initialize components with error handler
        error_handler = ErrorHandler(max_retries=3, retry_delay=1.0)
        factory = ModelFactory(error_handler=error_handler)
        mapper = CannabisDataMapper()
        idempotent_processor = IdempotentProcessor(error_handler=error_handler)

        # Handle resume functionality
        processing_state = None
        actual_start_from = start_from

        if resume and not force_restart:
            self.stdout.write("Checking for previous processing state...")
            processing_state = idempotent_processor.load_processing_state()

            if processing_state:
                self.stdout.write(f"Found previous processing state:")
                self.stdout.write(
                    f"  - Total records: {processing_state.total_records}"
                )
                self.stdout.write(
                    f"  - Processed: {processing_state.processed_records}"
                )
                self.stdout.write(
                    f"  - Successful: {processing_state.successful_records}"
                )
                self.stdout.write(f"  - Failed: {processing_state.failed_records}")
                self.stdout.write(
                    f"  - Last processed: {processing_state.last_processed_record}"
                )

                # Validate consistency
                if idempotent_processor.validate_resume_consistency(
                    processing_state, json_file
                ):
                    actual_start_from = idempotent_processor.get_resume_start_position(
                        processing_state
                    )
                    self.stdout.write(
                        self.style.SUCCESS(f"Resuming from record {actual_start_from}")
                    )
                else:
                    self.stdout.write(
                        self.style.WARNING(
                            "Resume consistency check failed, starting from beginning"
                        )
                    )
                    processing_state = None
            else:
                self.stdout.write("No previous processing state found")
        elif force_restart:
            self.stdout.write("Force restart requested, clearing any existing state")
            idempotent_processor.clear_processing_state()

        # Load JSON data
        self.stdout.write("Loading JSON data...")
        try:
            with open(json_file, "r") as f:
                records = json.load(f)
        except Exception as e:
            error_handler.handle_validation_error("FILE_LOAD", e)
            raise CommandError(f"Failed to load JSON file: {e}")

        total_records = len(records)
        self.stdout.write(f"Found {total_records} records in JSON file")

        # Initialize processing state if not resuming
        if not processing_state:
            processing_state = ProcessingState(
                total_records=total_records,
                processed_records=0,
                successful_records=0,
                failed_records=0,
                last_processed_record=-1,
                last_processed_legacy_id=None,
                start_time=datetime.now(),
                last_update_time=datetime.now(),
                batch_size=batch_size,
                file_path=json_file,
            )

        # Apply filtering
        if actual_start_from > 0:
            records = records[actual_start_from:]
            self.stdout.write(f"Starting from record {actual_start_from}")

        if max_records:
            # Adjust max_records if resuming
            remaining_records = (
                max_records - processing_state.processed_records
                if processing_state.processed_records > 0
                else max_records
            )
            if remaining_records > 0:
                records = records[:remaining_records]
                self.stdout.write(
                    f"Processing maximum {remaining_records} remaining records"
                )
            else:
                self.stdout.write("Maximum records already processed")
                return

        # Process records in batches with idempotent processing
        self.stdout.write(
            f"Processing {len(records)} records in batches of {batch_size}..."
        )

        try:
            for i in range(0, len(records), batch_size):
                batch = records[i : i + batch_size]
                batch_results = self.process_batch_with_idempotent_handling(
                    batch,
                    factory,
                    idempotent_processor,
                    error_handler,
                    i + actual_start_from,
                    processing_state,
                )

                processing_state.processed_records += len(batch)
                processing_state.successful_records += batch_results["successful"]
                processing_state.failed_records += batch_results["failed"]
                processing_state.last_update_time = datetime.now()

                # Update last processed record info
                if batch:
                    last_record = batch[-1]
                    processing_state.last_processed_record = (
                        i + actual_start_from + len(batch) - 1
                    )
                    processing_state.last_processed_legacy_id = str(
                        last_record.get("row_id", "")
                    )

                # Save state periodically
                idempotent_processor.save_processing_state(processing_state)

                # Progress update
                progress = (processing_state.processed_records / len(records)) * 100
                self.stdout.write(
                    f"Progress: {processing_state.processed_records}/{len(records)} ({progress:.1f}%) - "
                    f"Success: {processing_state.successful_records}, Failed: {processing_state.failed_records}"
                )

            # Clear processing state on successful completion
            idempotent_processor.clear_processing_state()
            self.stdout.write(
                self.style.SUCCESS("Processing completed successfully, state cleared")
            )

        except KeyboardInterrupt:
            # Save state on interruption
            idempotent_processor.save_processing_state(processing_state)
            self.stdout.write(
                self.style.WARNING("\nProcessing interrupted, state saved for resume")
            )
            raise
        except Exception as e:
            # Save state on error
            idempotent_processor.save_processing_state(processing_state)
            self.stdout.write(
                self.style.ERROR(f"Processing failed, state saved for resume: {e}")
            )
            raise

        # Generate and display comprehensive error report
        self.print_comprehensive_summary(
            processing_state.processed_records,
            processing_state.successful_records,
            processing_state.failed_records,
            error_handler,
        )

    def process_batch_with_error_handling(
        self,
        batch: List[Dict[str, Any]],
        factory: ModelFactory,
        error_handler: ErrorHandler,
        start_index: int,
    ) -> Dict[str, Any]:
        """Process a batch of records with comprehensive error handling and rollback capabilities"""
        successful = 0
        failed = 0

        # Create batch-level savepoint for rollback capability
        batch_savepoint = error_handler.create_rollback_point()

        for i, record in enumerate(batch):
            record_index = start_index + i
            row_id = record.get("row_id", record_index)

            # Create record-level savepoint
            record_savepoint = error_handler.create_rollback_point()

            try:
                # Attempt to create complete submission from JSON
                submission = factory.create_complete_submission_from_json(record)

                if submission:
                    successful += 1
                    # Commit record-level savepoint on success
                    if record_savepoint:
                        error_handler.commit_rollback_point(record_savepoint)

                    logger.debug(
                        f"Successfully processed record {row_id}: {submission.case_number}"
                    )
                else:
                    failed += 1
                    # Rollback record-level changes
                    if record_savepoint:
                        error_handler.rollback_to_point(record_savepoint)

                    logger.warning(
                        f"Failed to process record {row_id} - no submission created"
                    )

            except DatabaseError as e:
                failed += 1
                # Rollback record-level changes
                if record_savepoint:
                    error_handler.rollback_to_point(record_savepoint)

                # Handle database errors with retry logic
                should_retry, should_continue = error_handler.handle_database_error(
                    str(row_id), e, operation="process_record"
                )

                if should_retry:
                    # Retry the record (this is a simplified retry - in production might want more sophisticated logic)
                    try:
                        submission = factory.create_complete_submission_from_json(
                            record
                        )
                        if submission:
                            successful += 1
                            failed -= 1  # Correct the count
                            logger.info(
                                f"Successfully processed record {row_id} on retry"
                            )
                        else:
                            logger.warning(f"Record {row_id} failed again on retry")
                    except Exception as retry_e:
                        logger.error(f"Record {row_id} failed on retry: {retry_e}")

                if not should_continue:
                    # Critical error - rollback entire batch
                    if batch_savepoint:
                        error_handler.rollback_to_point(batch_savepoint)
                    logger.error(
                        f"Critical database error in batch, rolling back batch"
                    )
                    break

            except Exception as e:
                failed += 1
                # Rollback record-level changes
                if record_savepoint:
                    error_handler.rollback_to_point(record_savepoint)

                # Handle unexpected errors
                should_continue = error_handler.handle_validation_error(
                    str(row_id),
                    e,
                    context={"operation": "process_record", "batch_index": i},
                )

                if not should_continue:
                    logger.error(
                        f"Critical error processing record {row_id}, stopping batch"
                    )
                    break

        # Commit batch-level savepoint if we completed successfully
        if batch_savepoint:
            error_handler.commit_rollback_point(batch_savepoint)

        return {"successful": successful, "failed": failed}

    def process_batch_with_idempotent_handling(
        self,
        batch: List[Dict[str, Any]],
        factory: ModelFactory,
        idempotent_processor: IdempotentProcessor,
        error_handler: ErrorHandler,
        start_index: int,
        processing_state: ProcessingState,
    ) -> Dict[str, Any]:
        """Process a batch of records with idempotent processing and resume capability"""
        successful = 0
        failed = 0

        # Create batch-level savepoint for rollback capability
        batch_savepoint = error_handler.create_rollback_point()

        for i, record in enumerate(batch):
            record_index = start_index + i
            row_id = record.get("row_id", record_index)
            legacy_id = str(row_id)

            # Create record-level savepoint
            record_savepoint = error_handler.create_rollback_point()

            try:
                # Check if record already exists (idempotent processing)
                existing_submission = idempotent_processor.detect_existing_record(
                    legacy_id
                )

                if existing_submission:
                    # Record exists - determine if update is needed
                    if idempotent_processor.should_update_record(
                        existing_submission, record
                    ):
                        # Preserve audit trail and update
                        audit_trail = idempotent_processor.preserve_audit_trail(
                            existing_submission
                        )
                        submission = idempotent_processor.update_existing_record(
                            existing_submission, record, audit_trail
                        )

                        if submission:
                            successful += 1
                            logger.info(
                                f"Updated existing record {legacy_id}: {submission.case_number}"
                            )
                        else:
                            failed += 1
                            logger.warning(
                                f"Failed to update existing record {legacy_id}"
                            )
                    else:
                        # Record exists and doesn't need update - skip
                        successful += 1
                        logger.debug(
                            f"Skipped existing record {legacy_id} (no update needed)"
                        )
                else:
                    # Record doesn't exist - create new
                    submission = factory.create_complete_submission_from_json(record)

                    if submission:
                        successful += 1
                        logger.debug(
                            f"Created new record {legacy_id}: {submission.case_number}"
                        )
                    else:
                        failed += 1
                        logger.warning(f"Failed to create new record {legacy_id}")

                # Commit record-level savepoint on success
                if record_savepoint:
                    error_handler.commit_rollback_point(record_savepoint)

            except DatabaseError as e:
                failed += 1
                # Rollback record-level changes
                if record_savepoint:
                    error_handler.rollback_to_point(record_savepoint)

                # Handle database errors with retry logic
                should_retry, should_continue = error_handler.handle_database_error(
                    str(row_id), e, operation="process_record_idempotent"
                )

                if should_retry:
                    # Retry the record
                    try:
                        existing_submission = (
                            idempotent_processor.detect_existing_record(legacy_id)
                        )

                        if existing_submission:
                            if idempotent_processor.should_update_record(
                                existing_submission, record
                            ):
                                audit_trail = idempotent_processor.preserve_audit_trail(
                                    existing_submission
                                )
                                submission = (
                                    idempotent_processor.update_existing_record(
                                        existing_submission, record, audit_trail
                                    )
                                )
                            else:
                                submission = existing_submission
                        else:
                            submission = factory.create_complete_submission_from_json(
                                record
                            )

                        if submission:
                            successful += 1
                            failed -= 1  # Correct the count
                            logger.info(
                                f"Successfully processed record {row_id} on retry"
                            )
                        else:
                            logger.warning(f"Record {row_id} failed again on retry")
                    except Exception as retry_e:
                        logger.error(f"Record {row_id} failed on retry: {retry_e}")

                if not should_continue:
                    # Critical error - rollback entire batch
                    if batch_savepoint:
                        error_handler.rollback_to_point(batch_savepoint)
                    logger.error(
                        f"Critical database error in batch, rolling back batch"
                    )
                    break

            except Exception as e:
                failed += 1
                # Rollback record-level changes
                if record_savepoint:
                    error_handler.rollback_to_point(record_savepoint)

                # Handle unexpected errors
                should_continue = error_handler.handle_validation_error(
                    str(row_id),
                    e,
                    context={
                        "operation": "process_record_idempotent",
                        "batch_index": i,
                    },
                )

                if not should_continue:
                    logger.error(
                        f"Critical error processing record {row_id}, stopping batch"
                    )
                    break

        # Commit batch-level savepoint if we completed successfully
        if batch_savepoint:
            error_handler.commit_rollback_point(batch_savepoint)

        return {"successful": successful, "failed": failed}

    @transaction.atomic
    def process_batch(
        self, batch: List[Dict[str, Any]], factory: ModelFactory, start_index: int
    ) -> Dict[str, Any]:
        """Legacy process batch method - kept for compatibility"""
        successful = 0
        failed = 0
        errors = []

        for i, record in enumerate(batch):
            try:
                record_index = start_index + i
                row_id = record.get("row_id", record_index)

                # Create complete submission from JSON
                submission = factory.create_complete_submission_from_json(record)

                if submission:
                    successful += 1
                    logger.debug(
                        f"Successfully processed record {row_id}: {submission.case_number}"
                    )
                else:
                    failed += 1
                    error_msg = f"Record {row_id}: Failed to create submission"
                    errors.append(error_msg)
                    logger.error(error_msg)

            except Exception as e:
                failed += 1
                error_msg = f"Record {record.get('row_id', record_index)}: {str(e)}"
                errors.append(error_msg)
                logger.error(error_msg)

                # Continue processing other records
                continue

        return {"successful": successful, "failed": failed, "errors": errors}

    def print_summary(
        self, processed: int, successful: int, failed: int, errors: List[str]
    ):
        """Print processing summary"""
        self.stdout.write("\n" + "=" * 60)
        self.stdout.write("CANNABIS DATA LOADING SUMMARY")
        self.stdout.write("=" * 60)

        self.stdout.write(f"Total records processed: {processed}")
        self.stdout.write(self.style.SUCCESS(f"Successful: {successful}"))

        if failed > 0:
            self.stdout.write(self.style.ERROR(f"Failed: {failed}"))

            if errors:
                self.stdout.write("\nErrors encountered:")
                for error in errors[:10]:  # Show first 10 errors
                    self.stdout.write(f"  - {error}")

                if len(errors) > 10:
                    self.stdout.write(f"  ... and {len(errors) - 10} more errors")

        # Database statistics
        self.print_database_stats()

    def print_comprehensive_summary(
        self, processed: int, successful: int, failed: int, error_handler: ErrorHandler
    ):
        """Print comprehensive processing summary with error analysis"""
        self.stdout.write("\n" + "=" * 80)
        self.stdout.write("CANNABIS DATA LOADING COMPREHENSIVE SUMMARY")
        self.stdout.write("=" * 80)

        # Basic statistics
        self.stdout.write(f"Total records processed: {processed}")
        self.stdout.write(self.style.SUCCESS(f"Successful: {successful}"))

        if failed > 0:
            self.stdout.write(self.style.ERROR(f"Failed: {failed}"))
            success_rate = (successful / processed) * 100 if processed > 0 else 0
            self.stdout.write(f"Success rate: {success_rate:.1f}%")

        # Error statistics
        error_report = error_handler.generate_error_report()
        error_stats = error_report["summary"]["statistics"]

        if error_stats["total_errors"] > 0:
            self.stdout.write("\nError Statistics:")
            self.stdout.write(f"  Total errors: {error_stats['total_errors']}")
            self.stdout.write(
                f"  Validation errors: {error_stats['validation_errors']}"
            )
            self.stdout.write(f"  Database errors: {error_stats['database_errors']}")
            self.stdout.write(f"  Integrity errors: {error_stats['integrity_errors']}")
            self.stdout.write(
                f"  Connection errors: {error_stats['connection_errors']}"
            )
            self.stdout.write(
                f"  Records with errors: {error_stats['records_with_errors']}"
            )

            # Show sample errors by category
            self.stdout.write("\nError Samples by Category:")
            for category, errors in error_report["errors_by_category"].items():
                if errors:
                    self.stdout.write(f"\n  {category.upper()} Errors:")
                    for error in errors[:3]:  # Show first 3 errors of each type
                        self.stdout.write(
                            f"    - Record {error['record_id']}: {error['message']}"
                        )
                    if len(errors) > 3:
                        self.stdout.write(
                            f"    ... and {len(errors) - 3} more {category} errors"
                        )

            # Show recommendations
            recommendations = error_report["recommendations"]
            if recommendations:
                self.stdout.write("\nRecommendations:")
                for i, rec in enumerate(recommendations, 1):
                    self.stdout.write(f"  {i}. {rec}")

        # Export error report
        if error_stats["total_errors"] > 0:
            try:
                timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
                error_report_path = f"cannabis_loader_errors_{timestamp}.json"
                if error_handler.export_error_report(error_report_path, "json"):
                    self.stdout.write(
                        f"\nDetailed error report exported to: {error_report_path}"
                    )

                # Also export CSV for easier analysis
                csv_report_path = f"cannabis_loader_errors_{timestamp}.csv"
                if error_handler.export_error_report(csv_report_path, "csv"):
                    self.stdout.write(f"Error summary exported to: {csv_report_path}")

            except Exception as e:
                logger.warning(f"Failed to export error reports: {e}")

        # Database statistics
        self.print_database_stats()

    def print_database_stats(self):
        """Print current database statistics"""
        self.stdout.write("\nDatabase Statistics:")
        self.stdout.write(f"  Submissions: {Submission.objects.count()}")
        self.stdout.write(f"  Drug Bags: {DrugBag.objects.count()}")
        self.stdout.write(
            f"  Botanical Assessments: {BotanicalAssessment.objects.count()}"
        )
        self.stdout.write(f"  Police Officers: {PoliceOfficer.objects.count()}")
        self.stdout.write(f"  Police Stations: {PoliceStation.objects.count()}")
        self.stdout.write(f"  Defendants: {Defendant.objects.count()}")
