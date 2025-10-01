"""
Progress Reporter for Cannabis Data Loader

This module provides comprehensive progress tracking and reporting capabilities including:
- Real-time progress updates during processing
- Detailed summary reports upon completion
- Track total, processed, successful, and failed record counts
- Export reports in multiple formats (JSON, CSV, text)

Requirements: 1.4, 2.4, 5.4
"""

import json
import csv
import logging
import time
from datetime import datetime, timedelta
from typing import Dict, List, Any, Optional, Union
from dataclasses import dataclass, field
from pathlib import Path

logger = logging.getLogger(__name__)


@dataclass
class ProcessingStatistics:
    """Statistics for data processing operations"""

    total_records: int = 0
    processed_records: int = 0
    successful_records: int = 0
    failed_records: int = 0
    skipped_records: int = 0

    # Timing information
    start_time: Optional[datetime] = None
    end_time: Optional[datetime] = None
    last_update_time: Optional[datetime] = None

    # Batch information
    current_batch: int = 0
    total_batches: int = 0
    batch_size: int = 100

    # Performance metrics
    records_per_second: float = 0.0
    estimated_time_remaining: Optional[timedelta] = None

    def to_dict(self) -> Dict[str, Any]:
        """Convert statistics to dictionary for reporting"""
        return {
            "total_records": self.total_records,
            "processed_records": self.processed_records,
            "successful_records": self.successful_records,
            "failed_records": self.failed_records,
            "skipped_records": self.skipped_records,
            "current_batch": self.current_batch,
            "total_batches": self.total_batches,
            "batch_size": self.batch_size,
            "records_per_second": self.records_per_second,
            "start_time": self.start_time.isoformat() if self.start_time else None,
            "end_time": self.end_time.isoformat() if self.end_time else None,
            "last_update_time": (
                self.last_update_time.isoformat() if self.last_update_time else None
            ),
            "estimated_time_remaining": (
                str(self.estimated_time_remaining)
                if self.estimated_time_remaining
                else None
            ),
            "processing_time": (
                str(self.processing_time) if self.processing_time else None
            ),
            "success_rate": self.success_rate,
            "failure_rate": self.failure_rate,
            "completion_percentage": self.completion_percentage,
        }

    @property
    def processing_time(self) -> Optional[timedelta]:
        """Calculate total processing time"""
        if self.start_time and self.end_time:
            return self.end_time - self.start_time
        elif self.start_time:
            return datetime.now() - self.start_time
        return None

    @property
    def success_rate(self) -> float:
        """Calculate success rate as percentage"""
        if self.processed_records > 0:
            return (self.successful_records / self.processed_records) * 100
        return 0.0

    @property
    def failure_rate(self) -> float:
        """Calculate failure rate as percentage"""
        if self.processed_records > 0:
            return (self.failed_records / self.processed_records) * 100
        return 0.0

    @property
    def completion_percentage(self) -> float:
        """Calculate completion percentage"""
        if self.total_records > 0:
            return (self.processed_records / self.total_records) * 100
        return 0.0


@dataclass
class DatabaseStatistics:
    """Statistics about database operations and record counts"""

    submissions_created: int = 0
    submissions_updated: int = 0
    drug_bags_created: int = 0
    botanical_assessments_created: int = 0
    police_officers_created: int = 0
    police_stations_created: int = 0
    defendants_created: int = 0

    # Current database counts
    total_submissions: int = 0
    total_drug_bags: int = 0
    total_botanical_assessments: int = 0
    total_police_officers: int = 0
    total_police_stations: int = 0
    total_defendants: int = 0

    def to_dict(self) -> Dict[str, Any]:
        """Convert database statistics to dictionary"""
        return {
            "created": {
                "submissions": self.submissions_created,
                "drug_bags": self.drug_bags_created,
                "botanical_assessments": self.botanical_assessments_created,
                "police_officers": self.police_officers_created,
                "police_stations": self.police_stations_created,
                "defendants": self.defendants_created,
            },
            "updated": {
                "submissions": self.submissions_updated,
            },
            "totals": {
                "submissions": self.total_submissions,
                "drug_bags": self.total_drug_bags,
                "botanical_assessments": self.total_botanical_assessments,
                "police_officers": self.total_police_officers,
                "police_stations": self.total_police_stations,
                "defendants": self.total_defendants,
            },
        }


@dataclass
class DataQualityMetrics:
    """Metrics about data quality issues encountered during processing"""

    missing_required_fields: int = 0
    invalid_date_formats: int = 0
    invalid_content_types: int = 0
    missing_police_officer_data: int = 0
    missing_defendant_data: int = 0
    duplicate_records: int = 0
    data_validation_warnings: int = 0

    # Field-specific issues
    field_issues: Dict[str, int] = field(default_factory=dict)

    def add_field_issue(self, field_name: str, count: int = 1):
        """Add or increment field-specific issue count"""
        if field_name in self.field_issues:
            self.field_issues[field_name] += count
        else:
            self.field_issues[field_name] = count

    def to_dict(self) -> Dict[str, Any]:
        """Convert data quality metrics to dictionary"""
        return {
            "missing_required_fields": self.missing_required_fields,
            "invalid_date_formats": self.invalid_date_formats,
            "invalid_content_types": self.invalid_content_types,
            "missing_police_officer_data": self.missing_police_officer_data,
            "missing_defendant_data": self.missing_defendant_data,
            "duplicate_records": self.duplicate_records,
            "data_validation_warnings": self.data_validation_warnings,
            "field_issues": self.field_issues,
        }


class ProgressReporter:
    """
    Comprehensive progress tracking and reporting system for cannabis data loading.

    Provides real-time progress updates, detailed statistics, and comprehensive
    reporting capabilities with multiple export formats.
    """

    def __init__(
        self,
        update_interval: float = 5.0,
        enable_real_time_updates: bool = True,
        report_directory: str = "reports",
    ):
        """
        Initialize progress reporter

        Args:
            update_interval: Seconds between progress updates
            enable_real_time_updates: Whether to show real-time progress
            report_directory: Directory to save reports
        """
        self.update_interval = update_interval
        self.enable_real_time_updates = enable_real_time_updates
        self.report_directory = Path(report_directory)

        # Ensure report directory exists
        self.report_directory.mkdir(exist_ok=True)

        # Initialize statistics
        self.processing_stats = ProcessingStatistics()
        self.database_stats = DatabaseStatistics()
        self.data_quality = DataQualityMetrics()

        # Progress tracking
        self.last_progress_update = 0
        self.progress_history: List[Dict[str, Any]] = []

        # Report metadata
        self.report_metadata = {
            "report_version": "1.0.0",
            "generator": "Cannabis Data Loader Progress Reporter",
            "generation_time": None,
        }

    def start_processing(self, total_records: int, batch_size: int = 100):
        """
        Initialize processing session

        Args:
            total_records: Total number of records to process
            batch_size: Size of processing batches
        """
        self.processing_stats.total_records = total_records
        self.processing_stats.batch_size = batch_size
        self.processing_stats.total_batches = (
            total_records + batch_size - 1
        ) // batch_size
        self.processing_stats.start_time = datetime.now()
        self.processing_stats.last_update_time = datetime.now()

        logger.info(
            f"Starting processing of {total_records} records in {self.processing_stats.total_batches} batches"
        )

        if self.enable_real_time_updates:
            self._print_progress_header()

    def update_progress(
        self,
        processed: int = 0,
        successful: int = 0,
        failed: int = 0,
        skipped: int = 0,
        current_batch: int = 0,
    ):
        """
        Update processing progress

        Args:
            processed: Number of records processed in this update
            successful: Number of successful records in this update
            failed: Number of failed records in this update
            skipped: Number of skipped records in this update
            current_batch: Current batch number
        """
        # Update statistics
        self.processing_stats.processed_records += processed
        self.processing_stats.successful_records += successful
        self.processing_stats.failed_records += failed
        self.processing_stats.skipped_records += skipped
        self.processing_stats.current_batch = current_batch

        # Calculate performance metrics
        self._calculate_performance_metrics()

        # Store progress snapshot
        self.progress_history.append(
            {
                "timestamp": datetime.now().isoformat(),
                "processed": self.processing_stats.processed_records,
                "successful": self.processing_stats.successful_records,
                "failed": self.processing_stats.failed_records,
                "completion_percentage": self.processing_stats.completion_percentage,
                "records_per_second": self.processing_stats.records_per_second,
            }
        )

        # Show real-time updates if enabled
        if self.enable_real_time_updates:
            current_time = time.time()
            if current_time - self.last_progress_update >= self.update_interval:
                self._print_progress_update()
                self.last_progress_update = current_time

    def update_database_stats(self, **kwargs):
        """
        Update database operation statistics

        Args:
            **kwargs: Database statistics to update (e.g., submissions_created=5)
        """
        for key, value in kwargs.items():
            if hasattr(self.database_stats, key):
                current_value = getattr(self.database_stats, key)
                setattr(self.database_stats, key, current_value + value)

    def update_data_quality(self, **kwargs):
        """
        Update data quality metrics

        Args:
            **kwargs: Data quality metrics to update
        """
        for key, value in kwargs.items():
            if hasattr(self.data_quality, key):
                current_value = getattr(self.data_quality, key)
                setattr(self.data_quality, key, current_value + value)

    def add_field_issue(self, field_name: str, count: int = 1):
        """Add field-specific data quality issue"""
        self.data_quality.add_field_issue(field_name, count)

    def finish_processing(self):
        """Mark processing as complete and finalize statistics"""
        self.processing_stats.end_time = datetime.now()
        self.processing_stats.last_update_time = datetime.now()

        if self.enable_real_time_updates:
            self._print_final_progress()

        logger.info(f"Processing completed in {self.processing_stats.processing_time}")

    def generate_comprehensive_report(self) -> Dict[str, Any]:
        """
        Generate comprehensive processing report

        Returns:
            Dict containing all processing statistics and metrics
        """
        self.report_metadata["generation_time"] = datetime.now().isoformat()

        report = {
            "metadata": self.report_metadata,
            "processing_statistics": self.processing_stats.to_dict(),
            "database_statistics": self.database_stats.to_dict(),
            "data_quality_metrics": self.data_quality.to_dict(),
            "progress_history": self.progress_history,
            "summary": self._generate_summary(),
            "recommendations": self._generate_recommendations(),
        }

        return report

    def export_report(
        self, filename_prefix: str = "cannabis_loader_report", formats: List[str] = None
    ) -> Dict[str, str]:
        """
        Export comprehensive report in multiple formats

        Args:
            filename_prefix: Prefix for report filenames
            formats: List of formats to export ('json', 'csv', 'txt')

        Returns:
            Dict mapping format to exported filename
        """
        if formats is None:
            formats = ["json", "csv", "txt"]

        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        exported_files = {}

        report = self.generate_comprehensive_report()

        for format_type in formats:
            try:
                if format_type.lower() == "json":
                    filename = f"{filename_prefix}_{timestamp}.json"
                    filepath = self.report_directory / filename
                    self._export_json_report(report, filepath)
                    exported_files["json"] = str(filepath)

                elif format_type.lower() == "csv":
                    filename = f"{filename_prefix}_{timestamp}.csv"
                    filepath = self.report_directory / filename
                    self._export_csv_report(report, filepath)
                    exported_files["csv"] = str(filepath)

                elif format_type.lower() == "txt":
                    filename = f"{filename_prefix}_{timestamp}.txt"
                    filepath = self.report_directory / filename
                    self._export_text_report(report, filepath)
                    exported_files["txt"] = str(filepath)

                logger.info(f"Report exported to: {filepath}")

            except Exception as e:
                logger.error(f"Failed to export {format_type} report: {e}")

        return exported_files

    def _calculate_performance_metrics(self):
        """Calculate performance metrics like records per second and ETA"""
        if not self.processing_stats.start_time:
            return

        elapsed_time = datetime.now() - self.processing_stats.start_time
        elapsed_seconds = elapsed_time.total_seconds()

        if elapsed_seconds > 0:
            self.processing_stats.records_per_second = (
                self.processing_stats.processed_records / elapsed_seconds
            )

            # Calculate estimated time remaining
            if self.processing_stats.records_per_second > 0:
                remaining_records = (
                    self.processing_stats.total_records
                    - self.processing_stats.processed_records
                )
                remaining_seconds = (
                    remaining_records / self.processing_stats.records_per_second
                )
                self.processing_stats.estimated_time_remaining = timedelta(
                    seconds=remaining_seconds
                )

    def _print_progress_header(self):
        """Print progress tracking header"""
        print("\n" + "=" * 80)
        print("CANNABIS DATA LOADING PROGRESS")
        print("=" * 80)
        print(f"Total Records: {self.processing_stats.total_records}")
        print(f"Batch Size: {self.processing_stats.batch_size}")
        print(f"Total Batches: {self.processing_stats.total_batches}")
        print("-" * 80)

    def _print_progress_update(self):
        """Print real-time progress update"""
        stats = self.processing_stats

        # Progress bar
        bar_width = 40
        filled = int(bar_width * stats.completion_percentage / 100)
        bar = "█" * filled + "░" * (bar_width - filled)

        # Time information
        eta_str = (
            f"ETA: {stats.estimated_time_remaining}"
            if stats.estimated_time_remaining
            else "ETA: calculating..."
        )

        print(
            f"\r[{bar}] {stats.completion_percentage:5.1f}% | "
            f"Processed: {stats.processed_records:,}/{stats.total_records:,} | "
            f"Success: {stats.successful_records:,} | "
            f"Failed: {stats.failed_records:,} | "
            f"Rate: {stats.records_per_second:.1f}/s | "
            f"{eta_str}",
            end="",
            flush=True,
        )

    def _print_final_progress(self):
        """Print final progress summary"""
        print("\n" + "-" * 80)
        print("PROCESSING COMPLETE")
        print(f"Total Time: {self.processing_stats.processing_time}")
        print(f"Success Rate: {self.processing_stats.success_rate:.1f}%")
        print(
            f"Average Rate: {self.processing_stats.records_per_second:.1f} records/second"
        )
        print("=" * 80)

    def _generate_summary(self) -> Dict[str, Any]:
        """Generate processing summary"""
        return {
            "overall_status": (
                "SUCCESS"
                if self.processing_stats.failed_records == 0
                else "COMPLETED_WITH_ERRORS"
            ),
            "total_processing_time": (
                str(self.processing_stats.processing_time)
                if self.processing_stats.processing_time
                else None
            ),
            "average_processing_rate": self.processing_stats.records_per_second,
            "success_rate_percentage": self.processing_stats.success_rate,
            "failure_rate_percentage": self.processing_stats.failure_rate,
            "data_quality_score": self._calculate_data_quality_score(),
            "key_achievements": self._generate_key_achievements(),
            "main_issues": self._identify_main_issues(),
        }

    def _calculate_data_quality_score(self) -> float:
        """Calculate overall data quality score (0-100)"""
        total_issues = (
            self.data_quality.missing_required_fields
            + self.data_quality.invalid_date_formats
            + self.data_quality.invalid_content_types
            + self.data_quality.data_validation_warnings
        )

        if self.processing_stats.processed_records == 0:
            return 100.0

        issue_rate = total_issues / self.processing_stats.processed_records
        quality_score = max(0, 100 - (issue_rate * 100))
        return round(quality_score, 2)

    def _generate_key_achievements(self) -> List[str]:
        """Generate list of key processing achievements"""
        achievements = []

        if self.processing_stats.successful_records > 0:
            achievements.append(
                f"Successfully processed {self.processing_stats.successful_records:,} records"
            )

        if self.database_stats.submissions_created > 0:
            achievements.append(
                f"Created {self.database_stats.submissions_created:,} new submissions"
            )

        if self.database_stats.police_officers_created > 0:
            achievements.append(
                f"Created {self.database_stats.police_officers_created:,} police officer records"
            )

        if self.database_stats.defendants_created > 0:
            achievements.append(
                f"Created {self.database_stats.defendants_created:,} defendant records"
            )

        if self.processing_stats.records_per_second > 10:
            achievements.append(
                f"Maintained high processing rate of {self.processing_stats.records_per_second:.1f} records/second"
            )

        return achievements

    def _identify_main_issues(self) -> List[str]:
        """Identify main processing issues"""
        issues = []

        if self.processing_stats.failed_records > 0:
            failure_rate = self.processing_stats.failure_rate
            issues.append(
                f"Failed to process {self.processing_stats.failed_records:,} records ({failure_rate:.1f}% failure rate)"
            )

        if self.data_quality.missing_required_fields > 0:
            issues.append(
                f"Found {self.data_quality.missing_required_fields} records with missing required fields"
            )

        if self.data_quality.invalid_date_formats > 0:
            issues.append(
                f"Encountered {self.data_quality.invalid_date_formats} invalid date formats"
            )

        if self.data_quality.duplicate_records > 0:
            issues.append(
                f"Detected {self.data_quality.duplicate_records} duplicate records"
            )

        return issues

    def _generate_recommendations(self) -> List[str]:
        """Generate recommendations based on processing results"""
        recommendations = []

        # Performance recommendations
        if self.processing_stats.records_per_second < 5:
            recommendations.append(
                "Consider increasing batch size or optimizing database operations for better performance"
            )

        # Data quality recommendations
        if self.data_quality.missing_required_fields > 0:
            recommendations.append(
                "Review data extraction process to ensure all required fields are populated"
            )

        if self.data_quality.invalid_date_formats > 0:
            recommendations.append(
                "Improve date parsing logic to handle more date format variations"
            )

        if self.processing_stats.failure_rate > 10:
            recommendations.append(
                "High failure rate detected - review error logs and consider data preprocessing"
            )

        # Success recommendations
        if self.processing_stats.failure_rate < 1:
            recommendations.append(
                "Excellent processing results - consider this configuration for future loads"
            )

        return recommendations

    def _export_json_report(self, report: Dict[str, Any], filepath: Path):
        """Export report as JSON"""
        with open(filepath, "w") as f:
            json.dump(report, f, indent=2, default=str)

    def _export_csv_report(self, report: Dict[str, Any], filepath: Path):
        """Export report as CSV (summary data)"""
        with open(filepath, "w", newline="") as f:
            writer = csv.writer(f)

            # Write header
            writer.writerow(["Metric", "Value"])

            # Processing statistics
            writer.writerow(["Processing Statistics", ""])
            stats = report["processing_statistics"]
            for key, value in stats.items():
                if value is not None:
                    writer.writerow([key.replace("_", " ").title(), value])

            # Database statistics
            writer.writerow(["", ""])
            writer.writerow(["Database Statistics", ""])
            db_stats = report["database_statistics"]
            for category, data in db_stats.items():
                writer.writerow([category.title(), ""])
                for key, value in data.items():
                    writer.writerow([f"  {key.replace('_', ' ').title()}", value])

            # Data quality metrics
            writer.writerow(["", ""])
            writer.writerow(["Data Quality Metrics", ""])
            quality = report["data_quality_metrics"]
            for key, value in quality.items():
                if key != "field_issues":
                    writer.writerow([key.replace("_", " ").title(), value])

    def _export_text_report(self, report: Dict[str, Any], filepath: Path):
        """Export report as formatted text"""
        with open(filepath, "w") as f:
            f.write("CANNABIS DATA LOADER - COMPREHENSIVE REPORT\n")
            f.write("=" * 60 + "\n\n")

            # Metadata
            metadata = report["metadata"]
            f.write(f"Report Generated: {metadata['generation_time']}\n")
            f.write(f"Report Version: {metadata['report_version']}\n\n")

            # Summary
            summary = report["summary"]
            f.write("PROCESSING SUMMARY\n")
            f.write("-" * 30 + "\n")
            f.write(f"Overall Status: {summary['overall_status']}\n")
            f.write(f"Processing Time: {summary['total_processing_time']}\n")
            f.write(f"Success Rate: {summary['success_rate_percentage']:.1f}%\n")
            f.write(f"Data Quality Score: {summary['data_quality_score']:.1f}/100\n\n")

            # Processing statistics
            stats = report["processing_statistics"]
            f.write("PROCESSING STATISTICS\n")
            f.write("-" * 30 + "\n")
            f.write(f"Total Records: {stats['total_records']:,}\n")
            f.write(f"Processed: {stats['processed_records']:,}\n")
            f.write(f"Successful: {stats['successful_records']:,}\n")
            f.write(f"Failed: {stats['failed_records']:,}\n")
            f.write(
                f"Average Rate: {stats['records_per_second']:.1f} records/second\n\n"
            )

            # Key achievements
            if summary["key_achievements"]:
                f.write("KEY ACHIEVEMENTS\n")
                f.write("-" * 30 + "\n")
                for achievement in summary["key_achievements"]:
                    f.write(f"• {achievement}\n")
                f.write("\n")

            # Main issues
            if summary["main_issues"]:
                f.write("MAIN ISSUES\n")
                f.write("-" * 30 + "\n")
                for issue in summary["main_issues"]:
                    f.write(f"• {issue}\n")
                f.write("\n")

            # Recommendations
            if report["recommendations"]:
                f.write("RECOMMENDATIONS\n")
                f.write("-" * 30 + "\n")
                for i, rec in enumerate(report["recommendations"], 1):
                    f.write(f"{i}. {rec}\n")
