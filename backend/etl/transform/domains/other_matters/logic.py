"""
Other Matters Processing Domain

Simple text processing domain that handles the "Other Matters" column.
Focuses on preserving text content as-is while properly handling empty values
by converting them to null for Django backend compatibility.
"""

import json
from typing import Any, Optional

from etl.transform.lazy_pandas import is_missing, pd  # noqa: F401


def process_value(value: Any, row_id: int, logger) -> str:
    """
    Process other matters text with simple null handling

    Args:
        value: Raw other matters text
        row_id: Row identifier for logging
        logger: Transformation logger (optional)

    Returns:
        JSON string with processed other matters
    """
    try:
        # Process the text with null handling
        processed_text = _process_text(value)

        # Create simple JSON structure
        result = {"other_matters": processed_text}

        # Log transformation if logger provided
        if logger:
            action = "converted_to_null" if processed_text is None else "preserved_text"
            logger.log_transformation_issue(
                domain_name="other_matters",
                row_id=row_id,
                column="Other Matters",
                original_value=str(value) if value is not None else "None",
                issue_type="processing",
                action_taken=action,
                final_value=json.dumps(result),
                requires_review=False,
            )

        return json.dumps(result)

    except Exception:
        # Handle any processing errors gracefully
        error_result = {"other_matters": None}

        if logger:
            logger.log_transformation_issue(
                domain_name="other_matters",
                row_id=row_id,
                column="Other Matters",
                original_value=str(value) if value is not None else "None",
                issue_type="error",
                action_taken="error_fallback",
                final_value=json.dumps(error_result),
                requires_review=True,
            )

        return json.dumps(error_result)


def _process_text(value: Any) -> Optional[str]:
    """
    Simple text processing with null handling

    Args:
        value: Raw text value

    Returns:
        Processed text or None for empty values
    """
    # Handle None and NaN
    if value is None or is_missing(value):
        return None

    # Convert to string and trim whitespace
    text = str(value).strip()

    # Return None for empty content, otherwise return text as-is
    return text if text else None


def analyze_processing_results(output_file: str) -> dict:
    """
    Generate basic analysis of processing results

    Args:
        output_file: Path to processed CSV file

    Returns:
        Dictionary with analysis results
    """
    try:
        df = pd.read_csv(output_file)

        total_records = len(df)
        null_count = 0
        content_count = 0

        for _, row in df.iterrows():
            if pd.notna(row["processed_value"]):
                try:
                    parsed = json.loads(row["processed_value"])
                    if parsed.get("other_matters") is None:
                        null_count += 1
                    else:
                        content_count += 1
                except Exception:
                    null_count += 1  # Count JSON errors as null
            else:
                null_count += 1

        return {
            "total_records": total_records,
            "null_count": null_count,
            "content_count": content_count,
            "null_percentage": (
                (null_count / total_records * 100) if total_records > 0 else 0
            ),
            "content_percentage": (
                (content_count / total_records * 100) if total_records > 0 else 0
            ),
        }

    except Exception as e:
        return {
            "error": f"Analysis failed: {str(e)}",
            "total_records": 0,
            "null_count": 0,
            "content_count": 0,
            "null_percentage": 0,
            "content_percentage": 0,
        }
