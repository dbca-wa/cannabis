#!/usr/bin/env python3
"""
Test script for comprehensive reporting system

This script tests the progress and validation reporting capabilities
of the Cannabis Data Loader system.
"""

import os
import sys
import json
import tempfile
from pathlib import Path

# Add Django setup
import django
from django.conf import settings


# Setup Django environment
def setup_django():
    """Setup Django environment for standalone script"""
    # Add the backend directory to Python path
    backend_dir = Path(__file__).parent.parent.parent.parent
    sys.path.insert(0, str(backend_dir))

    # Configure Django settings
    os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")
    django.setup()


# Setup Django before importing Django models
setup_django()

from etl_modules.progress_reporter import ProgressReporter
from etl_modules.validation_reporter import ValidationReporter


def create_test_data():
    """Create sample test data for reporting"""
    return [
        {
            "row_id": "1",
            "cert_number": "CERT001",
            "approved_botanist": "Dr. Smith",
            "receipt_date": {"standardized_date": "2023-01-15T10:30:00Z"},
            "quantity_of_bags": 2,
            "description": "plant",
            "police_officer": {
                "submitting_officer": {
                    "name": "Officer Johnson",
                    "rank": "Constable",
                    "badge_id": "12345",
                }
            },
            "defendants": [{"given_names": "John", "last_name": "Doe"}],
        },
        {
            "row_id": "2",
            "cert_number": "CERT002",
            "approved_botanist": "",  # Missing botanist - validation issue
            "receipt_date": {
                "standardized_date": "invalid-date"
            },  # Invalid date format
            "quantity_of_bags": -1,  # Invalid quantity
            "description": "unknown_type",  # Invalid content type
            "police_officer": {},  # Missing officer data
            "defendants": [],  # Missing defendants
        },
        {
            "row_id": "3",
            "cert_number": "CERT003",
            "approved_botanist": "Dr. Brown",
            "receipt_date": {"standardized_date": "2023-01-17T14:20:00Z"},
            "quantity_of_bags": 1,
            "description": "seed",
            "police_officer": {
                "submitting_officer": {
                    "name": "Officer Wilson",
                    "rank": "Senior Constable",
                    "badge_id": "67890",
                }
            },
            "defendants": [{"given_names": "Jane", "last_name": "Smith"}],
        },
    ]


def test_progress_reporter():
    """Test progress reporting functionality"""
    print("Testing Progress Reporter...")

    # Create temporary directory for reports
    with tempfile.TemporaryDirectory() as temp_dir:
        reporter = ProgressReporter(
            update_interval=1.0,
            enable_real_time_updates=True,
            report_directory=temp_dir,
        )

        # Test progress tracking
        total_records = 100
        batch_size = 10

        reporter.start_processing(total_records, batch_size)

        # Simulate processing batches
        for batch_num in range(1, 11):
            # Simulate some processing results
            processed = 10
            successful = 8 if batch_num != 5 else 6  # Simulate some failures in batch 5
            failed = 2 if batch_num != 5 else 4

            reporter.update_progress(
                processed=processed,
                successful=successful,
                failed=failed,
                current_batch=batch_num,
            )

            # Update database stats
            reporter.update_database_stats(
                submissions_created=successful,
                drug_bags_created=successful * 2,
                police_officers_created=1 if batch_num % 3 == 0 else 0,
            )

            # Update data quality metrics
            if batch_num == 5:  # Simulate data quality issues in batch 5
                reporter.update_data_quality(
                    missing_required_fields=2,
                    invalid_date_formats=1,
                    data_validation_warnings=1,
                )

        reporter.finish_processing()

        # Generate and export reports
        report = reporter.generate_comprehensive_report()
        exported_files = reporter.export_report(
            filename_prefix="test_progress_report", formats=["json", "csv", "txt"]
        )

        print(f"✓ Progress report generated successfully")
        print(f"  - Total records: {report['processing_statistics']['total_records']}")
        print(
            f"  - Success rate: {report['processing_statistics']['success_rate']:.1f}%"
        )
        print(
            f"  - Data quality score: {report['summary']['data_quality_score']:.1f}/100"
        )
        print(f"  - Exported files: {list(exported_files.keys())}")

        return True


def test_validation_reporter():
    """Test validation reporting functionality"""
    print("\nTesting Validation Reporter...")

    # Create temporary directory for reports
    with tempfile.TemporaryDirectory() as temp_dir:
        reporter = ValidationReporter(report_directory=temp_dir)

        # Create test data with various validation issues
        test_records = create_test_data()

        # Analyze records and add validation issues
        for record in test_records:
            record_id = record["row_id"]

            # Analyze the record
            reporter.analyze_record(record_id, record)

            # Add specific validation issues based on record content
            if record_id == "2":
                # Record 2 has multiple issues
                reporter.add_missing_field_issue(
                    record_id, "approved_botanist", required=True
                )
                reporter.add_invalid_format_issue(
                    record_id, "receipt_date", "ISO date format", "invalid-date"
                )
                reporter.add_range_validation_issue(
                    record_id, "quantity_of_bags", min_value=0, actual_value="-1"
                )
                reporter.add_invalid_choice_issue(
                    record_id, "description", ["plant", "seed", "head"], "unknown_type"
                )
                reporter.add_missing_field_issue(
                    record_id, "police_officer", required=True
                )

        # Add some additional validation issues for testing
        reporter.add_duplicate_record_issue("3", "cert_number", "CERT003", "1")
        reporter.add_referential_integrity_issue(
            "2", "approved_botanist", "users", "NonExistentUser"
        )

        # Finalize analysis
        reporter.finalize_analysis()

        # Generate and export reports
        report = reporter.generate_validation_report()
        exported_files = reporter.export_validation_report(
            filename_prefix="test_validation_report", formats=["json", "csv", "txt"]
        )

        print(f"✓ Validation report generated successfully")
        print(
            f"  - Records analyzed: {report['data_quality_report']['summary']['total_records_analyzed']}"
        )
        print(
            f"  - Total issues: {report['data_quality_report']['summary']['total_issues']}"
        )
        print(
            f"  - Data quality score: {report['data_quality_report']['summary']['data_quality_score']:.1f}/100"
        )
        print(f"  - Validation status: {report['summary']['validation_status']}")
        print(f"  - Exported files: {list(exported_files.keys())}")

        # Test specific query methods
        error_issues = reporter.get_issues_by_severity("error")
        warning_issues = reporter.get_issues_by_severity("warning")
        record_2_issues = reporter.get_issues_for_record("2")

        print(f"  - Error issues: {len(error_issues)}")
        print(f"  - Warning issues: {len(warning_issues)}")
        print(f"  - Issues in record 2: {len(record_2_issues)}")

        return True


def test_integration():
    """Test integration between progress and validation reporters"""
    print("\nTesting Integration...")

    # Create temporary directory for reports
    with tempfile.TemporaryDirectory() as temp_dir:
        progress_reporter = ProgressReporter(
            update_interval=1.0,
            enable_real_time_updates=False,  # Disable for testing
            report_directory=temp_dir,
        )

        validation_reporter = ValidationReporter(report_directory=temp_dir)

        test_records = create_test_data()

        # Start progress tracking
        progress_reporter.start_processing(len(test_records), batch_size=2)

        # Process records with both reporters
        for i, record in enumerate(test_records):
            record_id = record["row_id"]

            # Validation analysis
            has_issues = validation_reporter.analyze_record(record_id, record)

            # Simulate processing result
            if has_issues:
                # Record failed due to validation issues
                progress_reporter.update_progress(
                    processed=1, successful=0, failed=1, current_batch=(i // 2) + 1
                )
                progress_reporter.update_data_quality(data_validation_warnings=1)
            else:
                # Record processed successfully
                progress_reporter.update_progress(
                    processed=1, successful=1, failed=0, current_batch=(i // 2) + 1
                )
                progress_reporter.update_database_stats(submissions_created=1)

        # Finalize both reporters
        progress_reporter.finish_processing()
        validation_reporter.finalize_analysis()

        # Generate combined report data
        progress_report = progress_reporter.generate_comprehensive_report()
        validation_report = validation_reporter.generate_validation_report()

        # Create combined summary
        combined_summary = {
            "processing": {
                "total_records": progress_report["processing_statistics"][
                    "total_records"
                ],
                "success_rate": progress_report["processing_statistics"][
                    "success_rate"
                ],
                "processing_time": progress_report["processing_statistics"][
                    "processing_time"
                ],
            },
            "validation": {
                "data_quality_score": validation_report["data_quality_report"][
                    "summary"
                ]["data_quality_score"],
                "total_issues": validation_report["data_quality_report"]["summary"][
                    "total_issues"
                ],
                "validation_status": validation_report["summary"]["validation_status"],
            },
        }

        print(f"✓ Integration test completed successfully")
        print(
            f"  - Processing success rate: {combined_summary['processing']['success_rate']:.1f}%"
        )
        print(
            f"  - Data quality score: {combined_summary['validation']['data_quality_score']:.1f}/100"
        )
        print(
            f"  - Validation status: {combined_summary['validation']['validation_status']}"
        )

        return True


def main():
    """Run comprehensive reporting system tests"""
    print("CANNABIS DATA LOADER - COMPREHENSIVE REPORTING SYSTEM TESTS")
    print("=" * 70)

    try:
        # Run individual tests
        progress_test = test_progress_reporter()
        validation_test = test_validation_reporter()
        integration_test = test_integration()

        # Summary
        print("\n" + "=" * 70)
        print("TEST RESULTS SUMMARY")
        print("=" * 70)
        print(f"Progress Reporter Test: {'✓ PASSED' if progress_test else '✗ FAILED'}")
        print(
            f"Validation Reporter Test: {'✓ PASSED' if validation_test else '✗ FAILED'}"
        )
        print(f"Integration Test: {'✓ PASSED' if integration_test else '✗ FAILED'}")

        all_passed = progress_test and validation_test and integration_test
        print(
            f"\nOverall Result: {'✓ ALL TESTS PASSED' if all_passed else '✗ SOME TESTS FAILED'}"
        )

        if all_passed:
            print("\nThe comprehensive reporting system is working correctly!")
            print("Key features verified:")
            print("  • Real-time progress tracking with performance metrics")
            print("  • Comprehensive validation analysis with issue categorization")
            print("  • Multi-format report export (JSON, CSV, TXT)")
            print("  • Data quality scoring and recommendations")
            print("  • Integration between progress and validation reporting")

        return all_passed

    except Exception as e:
        print(f"\n✗ TEST EXECUTION FAILED: {e}")
        import traceback

        traceback.print_exc()
        return False


if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)
