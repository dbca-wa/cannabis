#!/usr/bin/env python3
"""
Domain logic for Certificate Number processing
Converts to integer with validation and logging
"""


def process_value(input_value, row_id, transformation_logger):
    """
    Process Certificate Number - convert to integer with validation

    Args:
        input_value: Raw certificate number from CSV
        row_id: Row number for logging
        transformation_logger: Logger for tracking transformations

    Returns:
        Validated integer certificate number
    """

    # Handle empty values
    if input_value is None or input_value == "" or str(input_value).strip() == "":
        transformation_logger.log_transformation_issue(
            domain_name="cert_number",
            row_id=row_id,
            column="Certificate Number",
            original_value=input_value,
            issue_type="missing_certificate_number",
            action_taken="flag_for_review",
            final_value="MISSING_CERT_NUMBER",
            requires_review=True,
        )
        return "MISSING_CERT_NUMBER"

    # Convert to string first, then try to convert to integer
    str_value = str(input_value).strip()

    try:
        # Convert to integer
        int_value = int(float(str_value))  # float() handles cases like "1234.0"

        # Validate it's a positive number
        if int_value <= 0:
            transformation_logger.log_transformation_issue(
                domain_name="cert_number",
                row_id=row_id,
                column="Certificate Number",
                original_value=input_value,
                issue_type="invalid_certificate_number",
                action_taken="flag_negative_cert_number",
                final_value=f"INVALID_CERT_NUMBER: {int_value}",
                requires_review=True,
            )
            return f"INVALID_CERT_NUMBER: {int_value}"

        # Log successful conversion (this makes it appear in the review process)
        transformation_logger.log_transformation_issue(
            domain_name="cert_number",
            row_id=row_id,
            column="Certificate Number",
            original_value=input_value,
            issue_type="successful_conversion",
            action_taken="converted_to_integer",
            final_value=int_value,
            requires_review=False,
        )

        return int_value

    except (ValueError, TypeError):
        # Handle non-numeric values
        transformation_logger.log_transformation_issue(
            domain_name="cert_number",
            row_id=row_id,
            column="Certificate Number",
            original_value=input_value,
            issue_type="non_numeric_certificate",
            action_taken="flag_for_manual_review",
            final_value=f"NON_NUMERIC_CERT: {str_value}",
            requires_review=True,
        )
        return f"NON_NUMERIC_CERT: {str_value}"
