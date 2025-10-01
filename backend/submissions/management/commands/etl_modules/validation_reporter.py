"""
Validation and Error Reporter for Cannabis Data Loader

This module provides comprehensive error and validation reporting capabilities including:
- Detailed error logs with record identifiers
- Summary reports of data quality issues
- Export reports in multiple formats (JSON, CSV, text)
- Data validation analysis and recommendations

Requirements: 5.1, 5.2, 5.4
"""

import json
import csv
import logging
from datetime import datetime
from typing import Dict, List, Any, Optional, Set, Tuple
from dataclasses import dataclass, field
from pathlib import Path
from collections import defaultdict, Counter

logger = logging.getLogger(__name__)


@dataclass
class ValidationIssue:
    """Represents a single validation issue"""

    record_id: str
    field_name: str
    issue_type: str
    severity: str  # 'error', 'warning', 'info'
    message: str
    expected_value: Optional[str] = None
    actual_value: Optional[str] = None
    suggestion: Optional[str] = None
    timestamp: datetime = field(default_factory=datetime.now)

    def to_dict(self) -> Dict[str, Any]:
        """Convert validation issue to dictionary"""
        return {
            "record_id": self.record_id,
            "field_name": self.field_name,
            "issue_type": self.issue_type,
            "severity": self.severity,
            "message": self.message,
            "expected_value": self.expected_value,
            "actual_value": self.actual_value,
            "suggestion": self.suggestion,
            "timestamp": self.timestamp.isoformat(),
        }


@dataclass
class DataQualityReport:
    """Comprehensive data quality analysis report"""

    total_records_analyzed: int = 0
    records_with_issues: int = 0
    total_issues: int = 0

    # Issue categorization
    errors: int = 0
    warnings: int = 0
    info_issues: int = 0

    # Field-specific analysis
    field_issue_counts: Dict[str, int] = field(default_factory=dict)
    issue_type_counts: Dict[str, int] = field(default_factory=dict)
    severity_distribution: Dict[str, int] = field(default_factory=dict)

    # Data patterns
    common_patterns: Dict[str, int] = field(default_factory=dict)
    problematic_records: Set[str] = field(default_factory=set)

    def to_dict(self) -> Dict[str, Any]:
        """Convert data quality report to dictionary"""
        return {
            "summary": {
                "total_records_analyzed": self.total_records_analyzed,
                "records_with_issues": self.records_with_issues,
                "total_issues": self.total_issues,
                "data_quality_score": self.data_quality_score,
                "issue_rate": self.issue_rate,
            },
            "issue_breakdown": {
                "errors": self.errors,
                "warnings": self.warnings,
                "info_issues": self.info_issues,
            },
            "field_analysis": {
                "field_issue_counts": self.field_issue_counts,
                "most_problematic_fields": self.most_problematic_fields,
            },
            "issue_type_analysis": {
                "issue_type_counts": self.issue_type_counts,
                "most_common_issues": self.most_common_issues,
            },
            "severity_distribution": self.severity_distribution,
            "data_patterns": {
                "common_patterns": self.common_patterns,
                "problematic_records": list(self.problematic_records),
            },
        }

    @property
    def data_quality_score(self) -> float:
        """Calculate data quality score (0-100)"""
        if self.total_records_analyzed == 0:
            return 100.0

        # Weight errors more heavily than warnings
        weighted_issues = (self.errors * 2) + self.warnings + (self.info_issues * 0.5)
        issue_rate = weighted_issues / self.total_records_analyzed

        # Convert to quality score (higher is better)
        quality_score = max(0, 100 - (issue_rate * 10))  # Scale factor of 10
        return round(quality_score, 2)

    @property
    def issue_rate(self) -> float:
        """Calculate overall issue rate as percentage"""
        if self.total_records_analyzed == 0:
            return 0.0
        return (self.records_with_issues / self.total_records_analyzed) * 100

    @property
    def most_problematic_fields(self) -> List[Tuple[str, int]]:
        """Get fields with most issues"""
        return sorted(
            self.field_issue_counts.items(), key=lambda x: x[1], reverse=True
        )[:10]

    @property
    def most_common_issues(self) -> List[Tuple[str, int]]:
        """Get most common issue types"""
        return sorted(self.issue_type_counts.items(), key=lambda x: x[1], reverse=True)[
            :10
        ]


class ValidationReporter:
    """
    Comprehensive validation and error reporting system.

    Provides detailed error logging, data quality analysis, and comprehensive
    reporting capabilities with multiple export formats.
    """

    def __init__(self, report_directory: str = "reports"):
        """
        Initialize validation reporter

        Args:
            report_directory: Directory to save validation reports
        """
        self.report_directory = Path(report_directory)
        self.report_directory.mkdir(exist_ok=True)

        # Validation tracking
        self.validation_issues: List[ValidationIssue] = []
        self.data_quality_report = DataQualityReport()

        # Analysis tracking
        self.field_validators: Dict[str, List[str]] = defaultdict(list)
        self.record_issue_counts: Dict[str, int] = defaultdict(int)
        self.pattern_analysis: Dict[str, Counter] = defaultdict(Counter)

        # Report metadata
        self.report_metadata = {
            "report_version": "1.0.0",
            "generator": "Cannabis Data Loader Validation Reporter",
            "generation_time": None,
        }

    def add_validation_issue(
        self,
        record_id: str,
        field_name: str,
        issue_type: str,
        severity: str,
        message: str,
        expected_value: Optional[str] = None,
        actual_value: Optional[str] = None,
        suggestion: Optional[str] = None,
    ):
        """
        Add a validation issue to the report

        Args:
            record_id: Identifier for the record with the issue
            field_name: Name of the field with the issue
            issue_type: Type of validation issue
            severity: Severity level ('error', 'warning', 'info')
            message: Descriptive message about the issue
            expected_value: Expected value for the field
            actual_value: Actual value found in the field
            suggestion: Suggestion for fixing the issue
        """
        issue = ValidationIssue(
            record_id=record_id,
            field_name=field_name,
            issue_type=issue_type,
            severity=severity,
            message=message,
            expected_value=expected_value,
            actual_value=actual_value,
            suggestion=suggestion,
        )

        self.validation_issues.append(issue)

        # Update tracking statistics
        self._update_tracking_statistics(issue)

        # Log the issue
        self._log_validation_issue(issue)

    def add_missing_field_issue(
        self, record_id: str, field_name: str, required: bool = True
    ):
        """Add a missing field validation issue"""
        severity = "error" if required else "warning"
        suggestion = f"Ensure {field_name} is populated in the source data"

        self.add_validation_issue(
            record_id=record_id,
            field_name=field_name,
            issue_type="missing_field",
            severity=severity,
            message=f"Required field '{field_name}' is missing or empty",
            suggestion=suggestion,
        )

    def add_invalid_format_issue(
        self, record_id: str, field_name: str, expected_format: str, actual_value: str
    ):
        """Add an invalid format validation issue"""
        self.add_validation_issue(
            record_id=record_id,
            field_name=field_name,
            issue_type="invalid_format",
            severity="error",
            message=f"Field '{field_name}' has invalid format",
            expected_value=expected_format,
            actual_value=actual_value,
            suggestion=f"Ensure {field_name} follows the format: {expected_format}",
        )

    def add_invalid_choice_issue(
        self,
        record_id: str,
        field_name: str,
        valid_choices: List[str],
        actual_value: str,
    ):
        """Add an invalid choice validation issue"""
        choices_str = ", ".join(valid_choices[:5])  # Show first 5 choices
        if len(valid_choices) > 5:
            choices_str += f" (and {len(valid_choices) - 5} more)"

        self.add_validation_issue(
            record_id=record_id,
            field_name=field_name,
            issue_type="invalid_choice",
            severity="error",
            message=f"Field '{field_name}' contains invalid choice",
            expected_value=f"One of: {choices_str}",
            actual_value=actual_value,
            suggestion=f"Use one of the valid choices for {field_name}",
        )

    def add_data_type_issue(
        self, record_id: str, field_name: str, expected_type: str, actual_value: str
    ):
        """Add a data type validation issue"""
        self.add_validation_issue(
            record_id=record_id,
            field_name=field_name,
            issue_type="invalid_data_type",
            severity="error",
            message=f"Field '{field_name}' has incorrect data type",
            expected_value=f"Type: {expected_type}",
            actual_value=f"Value: {actual_value}",
            suggestion=f"Ensure {field_name} is provided as {expected_type}",
        )

    def add_range_validation_issue(
        self,
        record_id: str,
        field_name: str,
        min_value: Optional[Any] = None,
        max_value: Optional[Any] = None,
        actual_value: str = None,
    ):
        """Add a range validation issue"""
        range_desc = ""
        if min_value is not None and max_value is not None:
            range_desc = f"between {min_value} and {max_value}"
        elif min_value is not None:
            range_desc = f"at least {min_value}"
        elif max_value is not None:
            range_desc = f"at most {max_value}"

        self.add_validation_issue(
            record_id=record_id,
            field_name=field_name,
            issue_type="value_out_of_range",
            severity="warning",
            message=f"Field '{field_name}' value is outside expected range",
            expected_value=f"Value {range_desc}",
            actual_value=actual_value,
            suggestion=f"Verify that {field_name} value is correct",
        )

    def add_duplicate_record_issue(
        self,
        record_id: str,
        duplicate_field: str,
        duplicate_value: str,
        existing_record_id: str,
    ):
        """Add a duplicate record validation issue"""
        self.add_validation_issue(
            record_id=record_id,
            field_name=duplicate_field,
            issue_type="duplicate_record",
            severity="warning",
            message=f"Duplicate record detected based on {duplicate_field}",
            actual_value=duplicate_value,
            suggestion=f"Record may be duplicate of {existing_record_id}. Consider merging or updating existing record.",
        )

    def add_referential_integrity_issue(
        self,
        record_id: str,
        field_name: str,
        referenced_table: str,
        referenced_value: str,
    ):
        """Add a referential integrity validation issue"""
        self.add_validation_issue(
            record_id=record_id,
            field_name=field_name,
            issue_type="referential_integrity",
            severity="error",
            message=f"Referenced record not found in {referenced_table}",
            actual_value=referenced_value,
            suggestion=f"Ensure referenced {referenced_table} record exists or create it first",
        )

    def analyze_record(self, record_id: str, record_data: Dict[str, Any]):
        """
        Analyze a complete record for validation issues

        Args:
            record_id: Identifier for the record
            record_data: The record data to analyze
        """
        self.data_quality_report.total_records_analyzed += 1
        record_has_issues = False

        # Track patterns in the data
        self._analyze_data_patterns(record_id, record_data)

        # Check for common validation issues
        issues_found = self._perform_comprehensive_validation(record_id, record_data)

        if issues_found > 0:
            record_has_issues = True
            self.data_quality_report.records_with_issues += 1
            self.data_quality_report.problematic_records.add(record_id)

        return record_has_issues

    def finalize_analysis(self):
        """Finalize the validation analysis and generate summary statistics"""
        # Update final statistics
        self.data_quality_report.total_issues = len(self.validation_issues)

        # Count issues by severity
        for issue in self.validation_issues:
            if issue.severity == "error":
                self.data_quality_report.errors += 1
            elif issue.severity == "warning":
                self.data_quality_report.warnings += 1
            else:
                self.data_quality_report.info_issues += 1

        # Update severity distribution
        self.data_quality_report.severity_distribution = {
            "errors": self.data_quality_report.errors,
            "warnings": self.data_quality_report.warnings,
            "info": self.data_quality_report.info_issues,
        }

        logger.info(
            f"Validation analysis complete: {self.data_quality_report.total_issues} issues found in {self.data_quality_report.total_records_analyzed} records"
        )

    def generate_validation_report(self) -> Dict[str, Any]:
        """
        Generate comprehensive validation report

        Returns:
            Dict containing detailed validation analysis
        """
        self.report_metadata["generation_time"] = datetime.now().isoformat()

        # Generate issue summaries
        issues_by_type = defaultdict(list)
        issues_by_field = defaultdict(list)
        issues_by_severity = defaultdict(list)

        for issue in self.validation_issues:
            issues_by_type[issue.issue_type].append(issue.to_dict())
            issues_by_field[issue.field_name].append(issue.to_dict())
            issues_by_severity[issue.severity].append(issue.to_dict())

        report = {
            "metadata": self.report_metadata,
            "data_quality_report": self.data_quality_report.to_dict(),
            "validation_issues": {
                "by_type": dict(issues_by_type),
                "by_field": dict(issues_by_field),
                "by_severity": dict(issues_by_severity),
                "all_issues": [issue.to_dict() for issue in self.validation_issues],
            },
            "analysis": {
                "field_analysis": self._generate_field_analysis(),
                "pattern_analysis": self._generate_pattern_analysis(),
                "recommendations": self._generate_validation_recommendations(),
            },
            "summary": self._generate_validation_summary(),
        }

        return report

    def export_validation_report(
        self,
        filename_prefix: str = "cannabis_validation_report",
        formats: List[str] = None,
    ) -> Dict[str, str]:
        """
        Export validation report in multiple formats

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

        report = self.generate_validation_report()

        for format_type in formats:
            try:
                if format_type.lower() == "json":
                    filename = f"{filename_prefix}_{timestamp}.json"
                    filepath = self.report_directory / filename
                    self._export_json_validation_report(report, filepath)
                    exported_files["json"] = str(filepath)

                elif format_type.lower() == "csv":
                    filename = f"{filename_prefix}_{timestamp}.csv"
                    filepath = self.report_directory / filename
                    self._export_csv_validation_report(report, filepath)
                    exported_files["csv"] = str(filepath)

                elif format_type.lower() == "txt":
                    filename = f"{filename_prefix}_{timestamp}.txt"
                    filepath = self.report_directory / filename
                    self._export_text_validation_report(report, filepath)
                    exported_files["txt"] = str(filepath)

                logger.info(f"Validation report exported to: {filepath}")

            except Exception as e:
                logger.error(f"Failed to export {format_type} validation report: {e}")

        return exported_files

    def get_issues_for_record(self, record_id: str) -> List[ValidationIssue]:
        """Get all validation issues for a specific record"""
        return [
            issue for issue in self.validation_issues if issue.record_id == record_id
        ]

    def get_issues_by_severity(self, severity: str) -> List[ValidationIssue]:
        """Get all validation issues of a specific severity"""
        return [issue for issue in self.validation_issues if issue.severity == severity]

    def get_issues_by_field(self, field_name: str) -> List[ValidationIssue]:
        """Get all validation issues for a specific field"""
        return [
            issue for issue in self.validation_issues if issue.field_name == field_name
        ]

    def _update_tracking_statistics(self, issue: ValidationIssue):
        """Update internal tracking statistics"""
        # Update field issue counts
        if issue.field_name in self.data_quality_report.field_issue_counts:
            self.data_quality_report.field_issue_counts[issue.field_name] += 1
        else:
            self.data_quality_report.field_issue_counts[issue.field_name] = 1

        # Update issue type counts
        if issue.issue_type in self.data_quality_report.issue_type_counts:
            self.data_quality_report.issue_type_counts[issue.issue_type] += 1
        else:
            self.data_quality_report.issue_type_counts[issue.issue_type] = 1

        # Update record issue counts
        self.record_issue_counts[issue.record_id] += 1

    def _log_validation_issue(self, issue: ValidationIssue):
        """Log validation issue with appropriate level"""
        log_msg = f"[VALIDATION] Record {issue.record_id}, Field '{issue.field_name}': {issue.message}"

        if issue.severity == "error":
            logger.error(log_msg)
        elif issue.severity == "warning":
            logger.warning(log_msg)
        else:
            logger.info(log_msg)

        # Log additional details at debug level
        if issue.actual_value or issue.expected_value:
            details = []
            if issue.expected_value:
                details.append(f"Expected: {issue.expected_value}")
            if issue.actual_value:
                details.append(f"Actual: {issue.actual_value}")
            logger.debug(
                f"Validation details for record {issue.record_id}: {', '.join(details)}"
            )

    def _analyze_data_patterns(self, record_id: str, record_data: Dict[str, Any]):
        """Analyze data patterns in the record"""
        for field_name, value in record_data.items():
            if value is not None:
                # Track value patterns
                value_str = str(value)
                self.pattern_analysis[field_name][value_str] += 1

                # Track common patterns
                pattern_key = f"{field_name}_pattern"
                if len(value_str) > 0:
                    self.data_quality_report.common_patterns[pattern_key] = (
                        self.data_quality_report.common_patterns.get(pattern_key, 0) + 1
                    )

    def _perform_comprehensive_validation(
        self, record_id: str, record_data: Dict[str, Any]
    ) -> int:
        """Perform comprehensive validation on a record"""
        issues_found = 0

        # Required field validation
        required_fields = ["cert_number", "approved_botanist", "receipt_date"]
        for field in required_fields:
            if field not in record_data or not record_data[field]:
                self.add_missing_field_issue(record_id, field, required=True)
                issues_found += 1

        # Date format validation
        date_fields = ["receipt_date", "cert_date"]
        for field in date_fields:
            if field in record_data and record_data[field]:
                if not self._validate_date_format(record_data[field]):
                    self.add_invalid_format_issue(
                        record_id,
                        field,
                        "ISO date format (YYYY-MM-DD)",
                        str(record_data[field]),
                    )
                    issues_found += 1

        # Numeric field validation
        numeric_fields = ["quantity_of_bags"]
        for field in numeric_fields:
            if field in record_data and record_data[field] is not None:
                if not self._validate_numeric_field(record_data[field]):
                    self.add_data_type_issue(
                        record_id, field, "positive integer", str(record_data[field])
                    )
                    issues_found += 1

        return issues_found

    def _validate_date_format(self, date_value: Any) -> bool:
        """Validate date format"""
        if isinstance(date_value, dict) and "standardized_date" in date_value:
            date_str = date_value["standardized_date"]
        else:
            date_str = str(date_value)

        try:
            datetime.fromisoformat(date_str.replace("Z", "+00:00"))
            return True
        except (ValueError, AttributeError):
            return False

    def _validate_numeric_field(self, value: Any) -> bool:
        """Validate numeric field"""
        try:
            num_value = float(value)
            return num_value >= 0
        except (ValueError, TypeError):
            return False

    def _generate_field_analysis(self) -> Dict[str, Any]:
        """Generate detailed field analysis"""
        field_stats = {}

        for (
            field_name,
            issue_count,
        ) in self.data_quality_report.field_issue_counts.items():
            field_stats[field_name] = {
                "total_issues": issue_count,
                "issue_rate": (
                    issue_count / self.data_quality_report.total_records_analyzed
                )
                * 100,
                "common_issue_types": self._get_common_issue_types_for_field(
                    field_name
                ),
            }

        return {
            "field_statistics": field_stats,
            "most_problematic_fields": self.data_quality_report.most_problematic_fields,
            "field_recommendations": self._generate_field_recommendations(),
        }

    def _generate_pattern_analysis(self) -> Dict[str, Any]:
        """Generate pattern analysis"""
        pattern_summary = {}

        for field_name, patterns in self.pattern_analysis.items():
            most_common = patterns.most_common(5)
            pattern_summary[field_name] = {
                "unique_values": len(patterns),
                "most_common_values": most_common,
                "value_distribution": dict(patterns),
            }

        return pattern_summary

    def _get_common_issue_types_for_field(
        self, field_name: str
    ) -> List[Tuple[str, int]]:
        """Get common issue types for a specific field"""
        issue_types = Counter()

        for issue in self.validation_issues:
            if issue.field_name == field_name:
                issue_types[issue.issue_type] += 1

        return issue_types.most_common(3)

    def _generate_field_recommendations(self) -> Dict[str, str]:
        """Generate field-specific recommendations"""
        recommendations = {}

        for (
            field_name,
            issue_count,
        ) in self.data_quality_report.field_issue_counts.items():
            if issue_count > 0:
                issue_rate = (
                    issue_count / self.data_quality_report.total_records_analyzed
                ) * 100

                if issue_rate > 50:
                    recommendations[field_name] = (
                        f"Critical: {issue_rate:.1f}% of records have issues with {field_name}. Review data extraction process."
                    )
                elif issue_rate > 20:
                    recommendations[field_name] = (
                        f"High: {issue_rate:.1f}% of records have issues with {field_name}. Consider data validation improvements."
                    )
                elif issue_rate > 5:
                    recommendations[field_name] = (
                        f"Moderate: {issue_rate:.1f}% of records have issues with {field_name}. Monitor for patterns."
                    )

        return recommendations

    def _generate_validation_recommendations(self) -> List[str]:
        """Generate overall validation recommendations"""
        recommendations = []

        # Data quality recommendations
        if self.data_quality_report.data_quality_score < 80:
            recommendations.append(
                f"Data quality score is {self.data_quality_report.data_quality_score:.1f}/100. Consider improving data cleaning processes."
            )

        # Error rate recommendations
        if self.data_quality_report.errors > 0:
            error_rate = (
                self.data_quality_report.errors
                / self.data_quality_report.total_records_analyzed
            ) * 100
            if error_rate > 10:
                recommendations.append(
                    f"High error rate ({error_rate:.1f}%). Review data validation rules and source data quality."
                )

        # Field-specific recommendations
        problematic_fields = self.data_quality_report.most_problematic_fields[:3]
        if problematic_fields:
            field_names = [field for field, count in problematic_fields]
            recommendations.append(
                f"Focus validation improvements on: {', '.join(field_names)}"
            )

        # Pattern recommendations
        if (
            len(self.data_quality_report.problematic_records)
            > self.data_quality_report.total_records_analyzed * 0.2
        ):
            recommendations.append(
                "More than 20% of records have validation issues. Consider comprehensive data review."
            )

        return recommendations

    def _generate_validation_summary(self) -> Dict[str, Any]:
        """Generate validation summary"""
        return {
            "overall_data_quality": (
                "EXCELLENT"
                if self.data_quality_report.data_quality_score >= 95
                else (
                    "GOOD"
                    if self.data_quality_report.data_quality_score >= 80
                    else (
                        "FAIR"
                        if self.data_quality_report.data_quality_score >= 60
                        else "POOR"
                    )
                )
            ),
            "validation_status": (
                "PASSED" if self.data_quality_report.errors == 0 else "FAILED"
            ),
            "critical_issues": self.data_quality_report.errors,
            "warning_issues": self.data_quality_report.warnings,
            "records_needing_attention": len(
                self.data_quality_report.problematic_records
            ),
            "data_completeness": (
                (
                    (
                        self.data_quality_report.total_records_analyzed
                        - len(self.data_quality_report.problematic_records)
                    )
                    / self.data_quality_report.total_records_analyzed
                    * 100
                )
                if self.data_quality_report.total_records_analyzed > 0
                else 100
            ),
        }

    def _export_json_validation_report(self, report: Dict[str, Any], filepath: Path):
        """Export validation report as JSON"""
        with open(filepath, "w") as f:
            json.dump(report, f, indent=2, default=str)

    def _export_csv_validation_report(self, report: Dict[str, Any], filepath: Path):
        """Export validation report as CSV"""
        with open(filepath, "w", newline="") as f:
            writer = csv.writer(f)

            # Write header
            writer.writerow(
                [
                    "Record ID",
                    "Field Name",
                    "Issue Type",
                    "Severity",
                    "Message",
                    "Expected Value",
                    "Actual Value",
                    "Suggestion",
                    "Timestamp",
                ]
            )

            # Write all validation issues
            for issue_dict in report["validation_issues"]["all_issues"]:
                writer.writerow(
                    [
                        issue_dict["record_id"],
                        issue_dict["field_name"],
                        issue_dict["issue_type"],
                        issue_dict["severity"],
                        issue_dict["message"],
                        issue_dict.get("expected_value", ""),
                        issue_dict.get("actual_value", ""),
                        issue_dict.get("suggestion", ""),
                        issue_dict["timestamp"],
                    ]
                )

    def _export_text_validation_report(self, report: Dict[str, Any], filepath: Path):
        """Export validation report as formatted text"""
        with open(filepath, "w") as f:
            f.write("CANNABIS DATA LOADER - VALIDATION REPORT\n")
            f.write("=" * 60 + "\n\n")

            # Metadata
            metadata = report["metadata"]
            f.write(f"Report Generated: {metadata['generation_time']}\n")
            f.write(f"Report Version: {metadata['report_version']}\n\n")

            # Summary
            summary = report["summary"]
            f.write("VALIDATION SUMMARY\n")
            f.write("-" * 30 + "\n")
            f.write(f"Overall Data Quality: {summary['overall_data_quality']}\n")
            f.write(f"Validation Status: {summary['validation_status']}\n")
            f.write(
                f"Data Quality Score: {report['data_quality_report']['summary']['data_quality_score']:.1f}/100\n"
            )
            f.write(
                f"Records Analyzed: {report['data_quality_report']['summary']['total_records_analyzed']:,}\n"
            )
            f.write(
                f"Records with Issues: {report['data_quality_report']['summary']['records_with_issues']:,}\n"
            )
            f.write(
                f"Total Issues Found: {report['data_quality_report']['summary']['total_issues']:,}\n\n"
            )

            # Issue breakdown
            breakdown = report["data_quality_report"]["issue_breakdown"]
            f.write("ISSUE BREAKDOWN\n")
            f.write("-" * 30 + "\n")
            f.write(f"Errors: {breakdown['errors']:,}\n")
            f.write(f"Warnings: {breakdown['warnings']:,}\n")
            f.write(f"Info Issues: {breakdown['info_issues']:,}\n\n")

            # Most problematic fields
            field_analysis = report["data_quality_report"]["field_analysis"]
            if field_analysis["most_problematic_fields"]:
                f.write("MOST PROBLEMATIC FIELDS\n")
                f.write("-" * 30 + "\n")
                for field, count in field_analysis["most_problematic_fields"][:5]:
                    f.write(f"{field}: {count:,} issues\n")
                f.write("\n")

            # Recommendations
            if report["analysis"]["recommendations"]:
                f.write("RECOMMENDATIONS\n")
                f.write("-" * 30 + "\n")
                for i, rec in enumerate(report["analysis"]["recommendations"], 1):
                    f.write(f"{i}. {rec}\n")
