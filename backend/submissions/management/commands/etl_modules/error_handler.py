"""
Error Handler for Cannabis Data Loader

This module provides comprehensive error handling capabilities including:
- Validation error handling with detailed logging
- Database error recovery with retry logic
- Error reporting and statistics
- Rollback capabilities for critical failures

Requirements: 5.1, 5.2, 5.3, 5.4
"""

import logging
import traceback
import time
from datetime import datetime
from typing import Dict, List, Any, Optional, Tuple
from dataclasses import dataclass, field
from enum import Enum

from django.db import IntegrityError, DatabaseError, transaction
from django.core.exceptions import ValidationError
from django.db.utils import OperationalError, DataError

logger = logging.getLogger(__name__)


class ErrorSeverity(Enum):
    """Error severity levels"""

    INFO = "info"
    WARNING = "warning"
    ERROR = "error"
    CRITICAL = "critical"


class ErrorCategory(Enum):
    """Error categories for classification"""

    VALIDATION = "validation"
    DATABASE = "database"
    INTEGRITY = "integrity"
    CONNECTION = "connection"
    DATA_MAPPING = "data_mapping"
    BUSINESS_LOGIC = "business_logic"
    SYSTEM = "system"


@dataclass
class ErrorRecord:
    """Represents a single error occurrence"""

    record_id: str
    error_type: str
    category: ErrorCategory
    severity: ErrorSeverity
    message: str
    details: str
    timestamp: datetime = field(default_factory=datetime.now)
    traceback: Optional[str] = None
    retry_count: int = 0
    resolved: bool = False

    def to_dict(self) -> Dict[str, Any]:
        """Convert error record to dictionary for reporting"""
        return {
            "record_id": self.record_id,
            "error_type": self.error_type,
            "category": self.category.value,
            "severity": self.severity.value,
            "message": self.message,
            "details": self.details,
            "timestamp": self.timestamp.isoformat(),
            "traceback": self.traceback,
            "retry_count": self.retry_count,
            "resolved": self.resolved,
        }


@dataclass
class ErrorStatistics:
    """Statistics about errors encountered during processing"""

    total_errors: int = 0
    validation_errors: int = 0
    database_errors: int = 0
    integrity_errors: int = 0
    connection_errors: int = 0
    critical_errors: int = 0
    resolved_errors: int = 0
    records_with_errors: int = 0

    def to_dict(self) -> Dict[str, int]:
        """Convert statistics to dictionary"""
        return {
            "total_errors": self.total_errors,
            "validation_errors": self.validation_errors,
            "database_errors": self.database_errors,
            "integrity_errors": self.integrity_errors,
            "connection_errors": self.connection_errors,
            "critical_errors": self.critical_errors,
            "resolved_errors": self.resolved_errors,
            "records_with_errors": self.records_with_errors,
        }


class ErrorHandler:
    """
    Comprehensive error handler for cannabis data loading operations.

    Provides validation error handling, database error recovery, retry logic,
    and comprehensive error reporting capabilities.
    """

    def __init__(self, max_retries: int = 3, retry_delay: float = 1.0):
        """
        Initialize error handler

        Args:
            max_retries: Maximum number of retry attempts for recoverable errors
            retry_delay: Delay between retry attempts in seconds
        """
        self.max_retries = max_retries
        self.retry_delay = retry_delay
        self.errors: List[ErrorRecord] = []
        self.statistics = ErrorStatistics()
        self.failed_records: set = set()

    def handle_validation_error(
        self, record_id: str, error: Exception, context: Dict[str, Any] = None
    ) -> bool:
        """
        Handle validation errors with detailed logging.

        Args:
            record_id: Identifier for the record being processed
            error: The validation error that occurred
            context: Additional context information

        Returns:
            bool: True if processing should continue, False if critical
        """
        try:
            # Determine error details
            error_type = type(error).__name__
            message = str(error)
            details = self._extract_validation_details(error, context)

            # Create error record
            error_record = ErrorRecord(
                record_id=record_id,
                error_type=error_type,
                category=ErrorCategory.VALIDATION,
                severity=self._determine_validation_severity(error),
                message=message,
                details=details,
                traceback=traceback.format_exc(),
            )

            # Log the error
            self._log_error(error_record)

            # Store error record
            self.errors.append(error_record)
            self.statistics.validation_errors += 1
            self.statistics.total_errors += 1
            self.failed_records.add(record_id)

            # Determine if processing should continue
            should_continue = error_record.severity != ErrorSeverity.CRITICAL

            if should_continue:
                logger.info(
                    f"Continuing processing after validation error in record {record_id}"
                )
            else:
                logger.error(
                    f"Critical validation error in record {record_id}, stopping processing"
                )

            return should_continue

        except Exception as e:
            logger.error(f"Error in validation error handler: {e}")
            return False

    def handle_database_error(
        self,
        record_id: str,
        error: Exception,
        operation: str = "unknown",
        retry_count: int = 0,
    ) -> Tuple[bool, bool]:
        """
        Handle database errors with retry logic and rollback capabilities.

        Args:
            record_id: Identifier for the record being processed
            error: The database error that occurred
            operation: Description of the database operation
            retry_count: Current retry attempt number

        Returns:
            Tuple[bool, bool]: (should_retry, should_continue)
        """
        try:
            error_type = type(error).__name__
            message = str(error)

            # Determine error category and severity
            category, severity = self._classify_database_error(error)

            # Create error record
            error_record = ErrorRecord(
                record_id=record_id,
                error_type=error_type,
                category=category,
                severity=severity,
                message=message,
                details=f"Operation: {operation}, Retry: {retry_count}",
                traceback=traceback.format_exc(),
                retry_count=retry_count,
            )

            # Log the error
            self._log_error(error_record)

            # Store error record
            self.errors.append(error_record)
            self._update_database_error_statistics(category)

            # Determine retry and continue logic
            should_retry = self._should_retry_database_error(error, retry_count)
            should_continue = severity != ErrorSeverity.CRITICAL

            if should_retry:
                logger.info(
                    f"Will retry database operation for record {record_id} (attempt {retry_count + 1})"
                )
                time.sleep(self.retry_delay * (retry_count + 1))  # Exponential backoff
            elif should_continue:
                logger.info(
                    f"Skipping record {record_id} due to database error, continuing with next record"
                )
                self.failed_records.add(record_id)
            else:
                logger.error(
                    f"Critical database error for record {record_id}, stopping processing"
                )

            return should_retry, should_continue

        except Exception as e:
            logger.error(f"Error in database error handler: {e}")
            return False, False

    def handle_integrity_error(
        self, record_id: str, error: IntegrityError, context: Dict[str, Any] = None
    ) -> bool:
        """
        Handle referential integrity constraint violations.

        Args:
            record_id: Identifier for the record being processed
            error: The integrity error that occurred
            context: Additional context about the operation

        Returns:
            bool: True if processing should continue, False if critical
        """
        try:
            message = str(error)
            details = self._extract_integrity_details(error, context)

            # Create error record
            error_record = ErrorRecord(
                record_id=record_id,
                error_type="IntegrityError",
                category=ErrorCategory.INTEGRITY,
                severity=ErrorSeverity.ERROR,
                message=message,
                details=details,
                traceback=traceback.format_exc(),
            )

            # Log the error
            self._log_error(error_record)

            # Store error record
            self.errors.append(error_record)
            self.statistics.integrity_errors += 1
            self.statistics.total_errors += 1
            self.failed_records.add(record_id)

            # Check if this is a duplicate key error (which might be acceptable)
            if (
                "duplicate key" in message.lower()
                or "unique constraint" in message.lower()
            ):
                logger.warning(
                    f"Duplicate key error for record {record_id}, continuing processing"
                )
                return True

            # Other integrity errors should continue but be logged
            logger.warning(
                f"Integrity constraint violation for record {record_id}, continuing processing"
            )
            return True

        except Exception as e:
            logger.error(f"Error in integrity error handler: {e}")
            return False

    def handle_connection_error(self, error: Exception, retry_count: int = 0) -> bool:
        """
        Handle database connection errors with retry logic.

        Args:
            error: The connection error that occurred
            retry_count: Current retry attempt number

        Returns:
            bool: True if should retry, False if should abort
        """
        try:
            message = str(error)

            # Create error record
            error_record = ErrorRecord(
                record_id="CONNECTION",
                error_type=type(error).__name__,
                category=ErrorCategory.CONNECTION,
                severity=(
                    ErrorSeverity.CRITICAL
                    if retry_count >= self.max_retries
                    else ErrorSeverity.ERROR
                ),
                message=message,
                details=f"Connection retry attempt: {retry_count}",
                traceback=traceback.format_exc(),
                retry_count=retry_count,
            )

            # Log the error
            self._log_error(error_record)

            # Store error record
            self.errors.append(error_record)
            self.statistics.connection_errors += 1
            self.statistics.total_errors += 1

            # Determine if should retry
            should_retry = retry_count < self.max_retries

            if should_retry:
                wait_time = self.retry_delay * (2**retry_count)  # Exponential backoff
                logger.info(
                    f"Connection error, retrying in {wait_time} seconds (attempt {retry_count + 1})"
                )
                time.sleep(wait_time)
                return True
            else:
                logger.error(
                    f"Connection failed after {self.max_retries} attempts, aborting"
                )
                return False

        except Exception as e:
            logger.error(f"Error in connection error handler: {e}")
            return False

    def create_rollback_point(self) -> Optional[str]:
        """
        Create a database savepoint for rollback capability.

        Returns:
            Optional[str]: Savepoint identifier or None if failed
        """
        try:
            savepoint_id = transaction.savepoint()
            logger.debug(f"Created rollback point: {savepoint_id}")
            return savepoint_id
        except Exception as e:
            logger.error(f"Failed to create rollback point: {e}")
            return None

    def rollback_to_point(self, savepoint_id: str) -> bool:
        """
        Rollback to a specific savepoint.

        Args:
            savepoint_id: The savepoint to rollback to

        Returns:
            bool: True if rollback successful, False otherwise
        """
        try:
            transaction.savepoint_rollback(savepoint_id)
            logger.info(f"Successfully rolled back to savepoint: {savepoint_id}")
            return True
        except Exception as e:
            logger.error(f"Failed to rollback to savepoint {savepoint_id}: {e}")
            return False

    def commit_rollback_point(self, savepoint_id: str) -> bool:
        """
        Commit (release) a savepoint.

        Args:
            savepoint_id: The savepoint to commit

        Returns:
            bool: True if commit successful, False otherwise
        """
        try:
            transaction.savepoint_commit(savepoint_id)
            logger.debug(f"Committed savepoint: {savepoint_id}")
            return True
        except Exception as e:
            logger.error(f"Failed to commit savepoint {savepoint_id}: {e}")
            return False

    def generate_error_report(self) -> Dict[str, Any]:
        """
        Generate comprehensive error report.

        Returns:
            Dict containing detailed error information and statistics
        """
        # Update final statistics
        self.statistics.records_with_errors = len(self.failed_records)
        self.statistics.resolved_errors = sum(
            1 for error in self.errors if error.resolved
        )

        # Group errors by category and severity
        errors_by_category = {}
        errors_by_severity = {}

        for error in self.errors:
            # By category
            category = error.category.value
            if category not in errors_by_category:
                errors_by_category[category] = []
            errors_by_category[category].append(error.to_dict())

            # By severity
            severity = error.severity.value
            if severity not in errors_by_severity:
                errors_by_severity[severity] = []
            errors_by_severity[severity].append(error.to_dict())

        # Create comprehensive report
        report = {
            "summary": {
                "total_errors": len(self.errors),
                "failed_records": list(self.failed_records),
                "statistics": self.statistics.to_dict(),
                "generation_time": datetime.now().isoformat(),
            },
            "errors_by_category": errors_by_category,
            "errors_by_severity": errors_by_severity,
            "all_errors": [error.to_dict() for error in self.errors],
            "recommendations": self._generate_recommendations(),
        }

        return report

    def export_error_report(self, file_path: str, format: str = "json") -> bool:
        """
        Export error report to file.

        Args:
            file_path: Path to save the report
            format: Export format ('json' or 'csv')

        Returns:
            bool: True if export successful, False otherwise
        """
        try:
            report = self.generate_error_report()

            if format.lower() == "json":
                import json

                with open(file_path, "w") as f:
                    json.dump(report, f, indent=2)
            elif format.lower() == "csv":
                import csv

                with open(file_path, "w", newline="") as f:
                    writer = csv.DictWriter(
                        f,
                        fieldnames=[
                            "record_id",
                            "error_type",
                            "category",
                            "severity",
                            "message",
                            "timestamp",
                            "retry_count",
                        ],
                    )
                    writer.writeheader()
                    for error in self.errors:
                        writer.writerow(
                            {
                                "record_id": error.record_id,
                                "error_type": error.error_type,
                                "category": error.category.value,
                                "severity": error.severity.value,
                                "message": error.message,
                                "timestamp": error.timestamp.isoformat(),
                                "retry_count": error.retry_count,
                            }
                        )
            else:
                raise ValueError(f"Unsupported format: {format}")

            logger.info(f"Error report exported to: {file_path}")
            return True

        except Exception as e:
            logger.error(f"Failed to export error report: {e}")
            return False

    def _extract_validation_details(
        self, error: Exception, context: Dict[str, Any] = None
    ) -> str:
        """Extract detailed information from validation errors"""
        details = []

        if isinstance(error, ValidationError):
            if hasattr(error, "message_dict"):
                for field, messages in error.message_dict.items():
                    details.append(f"Field '{field}': {', '.join(messages)}")
            elif hasattr(error, "messages"):
                details.extend(error.messages)

        if context:
            details.append(f"Context: {context}")

        return "; ".join(details) if details else str(error)

    def _extract_integrity_details(
        self, error: IntegrityError, context: Dict[str, Any] = None
    ) -> str:
        """Extract detailed information from integrity errors"""
        details = [str(error)]

        if context:
            if "model" in context:
                details.append(f"Model: {context['model']}")
            if "field" in context:
                details.append(f"Field: {context['field']}")
            if "value" in context:
                details.append(f"Value: {context['value']}")

        return "; ".join(details)

    def _determine_validation_severity(self, error: Exception) -> ErrorSeverity:
        """Determine severity level for validation errors"""
        error_msg = str(error).lower()

        # Critical validation errors
        if any(keyword in error_msg for keyword in ["required", "null", "blank"]):
            return ErrorSeverity.ERROR

        # Warning level validation errors
        if any(keyword in error_msg for keyword in ["invalid", "format", "choice"]):
            return ErrorSeverity.WARNING

        return ErrorSeverity.ERROR

    def _classify_database_error(
        self, error: Exception
    ) -> Tuple[ErrorCategory, ErrorSeverity]:
        """Classify database errors by category and severity"""
        if isinstance(error, IntegrityError):
            return ErrorCategory.INTEGRITY, ErrorSeverity.ERROR
        elif isinstance(error, OperationalError):
            return ErrorCategory.CONNECTION, ErrorSeverity.CRITICAL
        elif isinstance(error, DataError):
            return ErrorCategory.VALIDATION, ErrorSeverity.ERROR
        elif isinstance(error, DatabaseError):
            return ErrorCategory.DATABASE, ErrorSeverity.ERROR
        else:
            return ErrorCategory.SYSTEM, ErrorSeverity.ERROR

    def _should_retry_database_error(self, error: Exception, retry_count: int) -> bool:
        """Determine if a database error should be retried"""
        if retry_count >= self.max_retries:
            return False

        # Retry connection-related errors
        if isinstance(error, OperationalError):
            error_msg = str(error).lower()
            if any(
                keyword in error_msg
                for keyword in [
                    "connection",
                    "timeout",
                    "server",
                    "network",
                    "temporary",
                ]
            ):
                return True

        return False

    def _update_database_error_statistics(self, category: ErrorCategory):
        """Update statistics based on database error category"""
        if category == ErrorCategory.DATABASE:
            self.statistics.database_errors += 1
        elif category == ErrorCategory.INTEGRITY:
            self.statistics.integrity_errors += 1
        elif category == ErrorCategory.CONNECTION:
            self.statistics.connection_errors += 1

        self.statistics.total_errors += 1

    def _log_error(self, error_record: ErrorRecord):
        """Log error record with appropriate level"""
        log_msg = f"[{error_record.category.value.upper()}] Record {error_record.record_id}: {error_record.message}"

        if error_record.severity == ErrorSeverity.CRITICAL:
            logger.critical(log_msg)
        elif error_record.severity == ErrorSeverity.ERROR:
            logger.error(log_msg)
        elif error_record.severity == ErrorSeverity.WARNING:
            logger.warning(log_msg)
        else:
            logger.info(log_msg)

        # Log details at debug level
        if error_record.details:
            logger.debug(
                f"Error details for record {error_record.record_id}: {error_record.details}"
            )

    def _generate_recommendations(self) -> List[str]:
        """Generate recommendations based on error patterns"""
        recommendations = []

        if self.statistics.validation_errors > 0:
            recommendations.append(
                "Review data validation errors and consider updating data cleaning processes"
            )

        if self.statistics.integrity_errors > 0:
            recommendations.append(
                "Check for referential integrity issues and ensure proper foreign key relationships"
            )

        if self.statistics.connection_errors > 0:
            recommendations.append(
                "Investigate database connection stability and consider connection pooling"
            )

        if (
            len(self.failed_records) > len(self.errors) * 0.1
        ):  # More than 10% failure rate
            recommendations.append(
                "High failure rate detected - consider reviewing data quality and processing logic"
            )

        return recommendations
