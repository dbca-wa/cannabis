#!/usr/bin/env python3
"""
Domain Logic for Tag Numbers - Corrected Version with Complete PS# References
"""

import re
from typing import Any, List


def process_value(input_value: Any, row_id: int, transformation_logger) -> List[str]:
    """Process Tag Numbers - parse strings into clean tag arrays"""

    # Handle empty/null values
    if input_value is None or input_value == "" or str(input_value).strip() == "":
        return []

    tag_str = str(input_value).strip()
    original_value = tag_str

    try:
        # Step 1: Clean the string
        cleaned = clean_tag_string(tag_str)

        # Step 2: Extract all tag-like patterns (multiple formats)
        tags = extract_all_tag_formats(cleaned)

        # Step 3: Expand any ranges
        expanded_tags = []
        for tag in tags:
            if is_expandable_range(tag):
                expanded_tags.extend(expand_range(tag))
            else:
                expanded_tags.append(tag)

        # Step 4: Remove duplicates while preserving order
        final_tags = list(dict.fromkeys(expanded_tags))

        # Log result
        transformation_logger.log_transformation_issue(
            domain_name="tag_numbers",
            row_id=row_id,
            column="Tag Number",
            original_value=original_value,
            issue_type="tag_parsing_successful" if final_tags else "no_tags_found",
            action_taken=f"found_{len(final_tags)}_tags",
            final_value=final_tags,
            requires_review=len(final_tags) == 0 and cleaned != "",
        )

        return final_tags

    except Exception as e:
        transformation_logger.log_transformation_issue(
            domain_name="tag_numbers",
            row_id=row_id,
            column="Tag Number",
            original_value=original_value,
            issue_type="parsing_error",
            action_taken=f"error_{str(e)}",
            final_value=[],
            requires_review=True,
        )
        return []


def clean_tag_string(text: str) -> str:
    """Remove descriptive text, keep only tag-relevant parts"""

    # Remove descriptive phrases
    text = re.sub(
        r",?\s*containing a quantity of plants[^,]*", "", text, flags=re.IGNORECASE
    )
    text = re.sub(r",?\s*and root balls[^,]*", "", text, flags=re.IGNORECASE)
    text = re.sub(r",?\s*and seedlings[^,]*", "", text, flags=re.IGNORECASE)
    text = re.sub(r",?\s*each\s*$", "", text, flags=re.IGNORECASE)

    # Remove parenthetical information like "(13)" at the end
    text = re.sub(r"\s*\(\d+\)\s*$", "", text)

    # Clean up whitespace
    text = re.sub(r"\s+", " ", text).strip()
    text = re.sub(r"^,+|,+$", "", text)  # Remove leading/trailing commas

    return text


def extract_all_tag_formats(text: str) -> List[str]:
    """Extract all possible tag formats from text"""

    tags = []
    working_text = text

    # Format 1: Complete PS# references like "731804 PS# 3744275/004"
    # Process FIRST to avoid conflicts with number extraction
    ps_pattern = r"(\d{6,}\s+PS#\s+\d+/\d+)"
    ps_matches = re.findall(ps_pattern, working_text)
    for match in ps_matches:
        tags.append(match)  # Complete PS reference like "731804 PS# 3744275/004"

    # Remove PS patterns from working text
    working_text = re.sub(ps_pattern, "", working_text, flags=re.IGNORECASE)

    # Format 2: Slash notation like T53948/50 (means T53948 and T53950)
    # Process BEFORE multi-range to avoid conflicts
    slash_range_pattern = r"\b([A-Z]+\d+)/(\d+)\b"
    slash_matches = re.findall(slash_range_pattern, working_text, re.IGNORECASE)
    for prefix_num, end_num in slash_matches:
        tags.append(f"{prefix_num.upper()}/{end_num}")  # Will be expanded later

    # Remove slash patterns from working text
    working_text = re.sub(slash_range_pattern, "", working_text, flags=re.IGNORECASE)

    # Format 3: Complex multi-range patterns like T53951-2-3, T53954-5-6
    # Process AFTER slash ranges to avoid conflicts
    multi_range_pattern = r"\b([A-Z]+\d+(?:-\d+){2,})\b"  # Require at least 2 hyphens
    multi_range_matches = re.findall(multi_range_pattern, working_text, re.IGNORECASE)
    for match in multi_range_matches:
        tags.append(match.upper())  # Will be expanded later

    # Remove multi-range patterns from working text
    working_text = re.sub(multi_range_pattern, "", working_text, flags=re.IGNORECASE)

    # Format 4: Standard letter+number tags (T12345, BB12345, etc.)
    # Include simple ranges like T51908-19 (single hyphen)
    letter_number_pattern = r"\b([A-Z]+\d+(?:-\d+)?)\b"
    letter_matches = re.findall(letter_number_pattern, working_text, re.IGNORECASE)
    tags.extend([match.upper() for match in letter_matches])

    # Remove letter+number patterns from working text
    working_text = re.sub(letter_number_pattern, "", working_text, flags=re.IGNORECASE)

    # Format 5: Pure number sequences (6+ digits, likely tag numbers)
    number_pattern = r"\b(\d{6,})\b"
    number_matches = re.findall(number_pattern, working_text)
    tags.extend(number_matches)

    # Remove number patterns from working text
    working_text = re.sub(number_pattern, "", working_text)

    # Format 6: Handle ranges of pure numbers (like 018864-018869)
    number_range_pattern = r"\b(\d{6,})-(\d{6,})\b"
    number_range_matches = re.findall(number_range_pattern, working_text)
    for start, end in number_range_matches:
        tags.append(f"{start}-{end}")  # Will be expanded later

    return tags


def is_expandable_range(tag: str) -> bool:
    """Check if a tag represents an expandable range"""
    # Slash ranges like T53948/50
    if re.match(r"^[A-Z]+\d+/\d+$", tag, re.IGNORECASE):
        return True

    # Multi-range patterns like T53951-2-3, T53954-5-6
    if re.match(r"^[A-Z]+\d+(?:-\d+)+$", tag, re.IGNORECASE):
        return True

    # Standard letter+number ranges like T51908-19
    if re.match(r"^[A-Z]+\d+-\d+$", tag, re.IGNORECASE):
        return True

    # Pure number ranges like 018864-018869
    if re.match(r"^\d+-\d+$", tag):
        return True

    return False


def expand_range(tag_range: str) -> List[str]:
    """Expand various range formats"""

    # Handle two-tag slash notation like T53948/50
    slash_match = re.match(r"^([A-Z]+)(\d+)/(\d+)$", tag_range, re.IGNORECASE)
    if slash_match:
        prefix = slash_match.group(1).upper()
        start_str = slash_match.group(2)
        end_str = slash_match.group(3)

        # A slash lists two tags, not a range: T53948/50 is T53948 and T53950.
        # (A range would give 18 bags for certificate 1037, whose quantity and
        # narrative both say 17.) The short end replaces the trailing digits.
        if len(end_str) < len(start_str):
            full_end = start_str[: -len(end_str)] + end_str
        else:
            full_end = end_str
        return [f"{prefix}{start_str}", f"{prefix}{full_end}"]

    # Handle multi-range patterns like T53951-2-3 (means T53951, T53952, T53953)
    multi_range_match = re.match(
        r"^([A-Z]+)(\d+)(?:-(\d+))+$", tag_range, re.IGNORECASE
    )
    if multi_range_match:
        prefix = multi_range_match.group(1).upper()
        base_num_str = multi_range_match.group(2)
        base_num = int(base_num_str)

        # Extract all the suffix numbers after the hyphens
        suffix_matches = re.findall(r"-(\d+)", tag_range)

        result = []
        num_digits = len(base_num_str)

        # Start with the base number
        result.append(f"{prefix}{base_num:0{num_digits}d}")

        # Add each suffix as consecutive numbers
        current_num = base_num
        for suffix in suffix_matches:
            # Handle short form: if suffix is shorter, it's relative to base
            if len(suffix) < len(base_num_str):
                # Replace the last digits of the base number
                base_prefix = base_num_str[: -len(suffix)]
                next_num = int(base_prefix + suffix)
            else:
                next_num = int(suffix)

            # Fill in the gap between current and next number
            for i in range(current_num + 1, next_num + 1):
                result.append(f"{prefix}{i:0{num_digits}d}")

            current_num = next_num

        return result

    # Handle standard letter+number ranges like T51908-19
    letter_match = re.match(r"^([A-Z]+)(\d+)-(\d+)$", tag_range, re.IGNORECASE)
    if letter_match:
        prefix = letter_match.group(1).upper()
        start_str = letter_match.group(2)
        end_str = letter_match.group(3)

        start_num = int(start_str)

        # Handle short form: T51908-19 means T51908 to T51919
        if len(end_str) < len(start_str):
            prefix_digits = start_str[: -len(end_str)]
            full_end = prefix_digits + end_str
            end_num = int(full_end)
        else:
            end_num = int(end_str)

        # Generate the range, preserving leading zeros
        result = []
        num_digits = len(start_str)
        for i in range(start_num, end_num + 1):
            result.append(f"{prefix}{i:0{num_digits}d}")

        return result

    # Handle pure number ranges like 018864-018869
    number_match = re.match(r"^(\d+)-(\d+)$", tag_range)
    if number_match:
        start_num = int(number_match.group(1))
        end_num = int(number_match.group(2))

        # Only expand if reasonable range (not more than 50 numbers)
        if end_num - start_num <= 50:
            result = []
            num_digits = len(number_match.group(1))
            for i in range(start_num, end_num + 1):
                result.append(f"{i:0{num_digits}d}")
            return result

    # If not a recognized range format, return as-is
    return [tag_range]


# Test the functions
if __name__ == "__main__":
    test_cases = [
        "B523151 and  B523152",
        "B524292",
        "T367926-44",
        "T52293, T52294, T52295, T52296, T52297 and T52299",
        "T366991, containing a quantity of plants,  and T366993,",
        "731804 PS# 3744275/004, 731815 PS# 3744275/010",
        "018864, 018865, 018866, 018867, 018869",
        "B574458 and T51908-19 (13)",
        "T53948/50",  # Should expand to T53948, T53949, T53950
        "T53951-2-3, T53954-5-6",  # Should expand to T53951, T53952, T53953, T53954, T53955, T53956
        "BB00761, T53948/50, T53951-2-3, T53954-5-6, T53957-8-9, T53960-1-2 & T53963-4",
    ]

    for test in test_cases:
        print(f"\nInput: '{test}'")
        cleaned = clean_tag_string(test)
        print(f"Cleaned: '{cleaned}'")
        tags = extract_all_tag_formats(cleaned)
        print(f"Extracted: {tags}")

        expanded = []
        for tag in tags:
            if is_expandable_range(tag):
                expanded.extend(expand_range(tag))
            else:
                expanded.append(tag)

        final = list(dict.fromkeys(expanded))
        print(f"Final: {final}")
