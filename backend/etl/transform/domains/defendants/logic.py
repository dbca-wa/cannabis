#!/usr/bin/env python3
"""
Domain Logic for Defendant - FIXED VERSION
Handles compound surnames, legal format detection, and complex separators
Fixes the major issues identified in first_name_issues_README.md
"""

import csv
import json
import logging
import re
from pathlib import Path
from typing import Any, List, Optional, Tuple

from etl.transform import debug_files

# Get the directory where this logic file is located
DOMAIN_PATH = Path(__file__).parent
STANDARDISATION_FILE = DOMAIN_PATH / "standardisation.json"
DEBUG_FILE = DOMAIN_PATH / "debug.txt"

# Path to the defendants CSV file for analysis
DEFENDANTS_CSV_PATH = (
    Path(__file__).parent.parent.parent / "data" / "modded" / "7_defendants.csv"
)
FIRST_NAME_ISSUES_FILE = DOMAIN_PATH / "first_name_issues_README.md"
LAST_NAME_ISSUES_FILE = DOMAIN_PATH / "last_name_issues_README.md"

# Compound surname patterns (order matters - longest first)
# Updated to match task requirements: ["DE", "DA", "VAN", "VAN DEN", "VAN DER", "AL", "VON", "DU"]
COMPOUND_PREFIXES = [
    "VAN DEN",
    "VAN DER",
    "VAN",
    "DE",
    "DA",
    "AL",
    "VON",
    "DU",
]


class DefendantProcessor:
    """Enhanced defendant processor with pattern recognition fixes"""

    # Known non-defendant strings (case-insensitive exact match)
    _KNOWN_NON_DEFENDANT_STRINGS = frozenset(
        [
            "unknown",
            "n/a",
            "nil",
            "none",
            "not known",
            "not applicable",
            "defendant unknown",
        ]
    )

    # Enquiry continuation patterns (case-insensitive substring/prefix match)
    _ENQUIRY_PATTERNS = re.compile(
        r"(?i)(?:"
        r"inq\.?\s*cont\.?"
        r"|inquir(?:y|ies)\s+cont(?:inuing)?"
        r"|enquir(?:y|ies)\s+cont(?:inuing)?"
        r"|continuing\s+(?:en|in)quir(?:y|ies)"
        r"|inqs"
        r")",
    )

    # Operation name pattern (starts with "operation", case-insensitive)
    _OPERATION_PATTERN = re.compile(r"(?i)^operation\b")

    # Address patterns:
    #   1. Four-digit postcode followed by "WA" (e.g. "9081 WA" or "9081, WA")
    #   2. Starts with a street number followed by a street type
    _ADDRESS_POSTCODE_PATTERN = re.compile(r"(?i)\b\d{4}\s*,?\s*WA\b")
    _ADDRESS_STREET_PATTERN = re.compile(
        r"(?i)^\d+\s+(?:\w+\s+)+"
        r"(?:street|st|road|rd|avenue|ave|drive|dr|crescent|cres|"
        r"place|pl|court|ct|lane|ln|way|terrace|tce|parade|pde|"
        r"highway|hwy|boulevard|blvd|circuit|cct|close|cl|"
        r"grove|gr|loop|mews|rise|row|square|sq|track|trail|"
        r"view|walk|circle|cir|esplanade|esp)\b"
    )

    # Location seized pattern (starts with "location seized", case-insensitive)
    _LOCATION_SEIZED_PATTERN = re.compile(r"(?i)^location\s+seized\b")

    def __init__(self):
        self.logger = logging.getLogger(__name__)
        self.standardisation_config = self._load_standardisation_config()
        self.empty_variants = set()
        self._build_empty_variants()
        self._clear_debug_file()

    def _clear_debug_file(self):
        """Clear the debug file"""
        if not debug_files.enabled():
            return
        try:
            with open(DEBUG_FILE, "w") as f:
                f.write("DEFENDANT PROCESSING DEBUG LOG - FIXED VERSION\n")
                f.write("=" * 50 + "\n\n")
        except Exception as e:
            self.logger.error(f"Could not create debug file: {str(e)}")

    def _debug_log(self, message: str):
        """Write debug message to file"""
        if not debug_files.enabled():
            return
        try:
            with open(DEBUG_FILE, "a") as f:
                f.write(message + "\n")
        except Exception as e:
            self.logger.error(f"Could not write to debug file: {str(e)}")

    def _load_standardisation_config(self) -> dict:
        """Load the standardisation configuration"""
        try:
            if STANDARDISATION_FILE.exists():
                with open(STANDARDISATION_FILE, "r") as f:
                    config = json.load(f)
                return config
            else:
                return {"entries": []}
        except Exception as e:
            self.logger.error(f"Error loading standardisation config: {str(e)}")
            return {"entries": []}

    def _build_empty_variants(self):
        """Build set of variants that should return empty array"""
        self.empty_variants = set()
        for entry in self.standardisation_config.get("entries", []):
            canonical = entry.get("canonical")
            if canonical == []:
                variants = entry.get("variants", [])
                for variant in variants:
                    self.empty_variants.add(variant.lower().strip())

    def _should_be_empty_array(self, text: str) -> bool:
        """Check if text should result in empty array"""
        if not text or text.strip() == "":
            return True
        normalized = text.lower().strip()
        return normalized in self.empty_variants

    def _should_skip(self, value: str) -> bool:
        """
        Check if the defendant field value matches a skip pattern indicating
        it is not a genuine defendant name. Returns True if the value should
        be skipped (resulting in an empty defendant list).

        Patterns checked (in order):
        1. Known non-defendant strings (exact, case-insensitive)
        2. Enquiry continuation patterns
        3. Operation name patterns (starts with "operation")
        4. Address patterns (postcode + WA, or street number + street type)
        5. Location seized patterns (starts with "location seized")
        """
        if not value or not value.strip():
            return True

        normalised = value.strip().lower()

        # 1. Known non-defendant strings
        if normalised in self._KNOWN_NON_DEFENDANT_STRINGS:
            return True

        # 2. Enquiry continuation patterns
        if self._ENQUIRY_PATTERNS.search(value):
            return True

        # 3. Operation name pattern
        if self._OPERATION_PATTERN.search(value):
            return True

        # 4. Address patterns
        if self._ADDRESS_POSTCODE_PATTERN.search(value):
            return True
        if self._ADDRESS_STREET_PATTERN.search(value):
            return True

        # 5. Location seized pattern
        if self._LOCATION_SEIZED_PATTERN.search(value):
            return True

        return False

    def _detect_compound_surname(
        self, text: str
    ) -> Tuple[Optional[str], Optional[str]]:
        """
        Detect compound surnames in text and return (compound_surname, remaining_text)
        FIXED: Now preserves original case throughout processing and only uses uppercase for pattern matching
        """
        if not text or not text.strip():
            return None, None

        # Preserve original case throughout processing
        original_words = text.strip().split()

        # Check each compound prefix (longest first to avoid partial matches)
        for prefix in COMPOUND_PREFIXES:
            prefix_words = prefix.split()

            # Look for the compound prefix anywhere in the text
            for start_idx in range(len(original_words) - len(prefix_words) + 1):
                # Check if this position matches the compound prefix (case-insensitive matching)
                candidate_words = original_words[
                    start_idx : start_idx + len(prefix_words)
                ]
                # Use uppercase only for comparison, preserve original case in candidate_words
                candidate_upper = " ".join(candidate_words).upper()

                if candidate_upper == prefix:
                    # Found compound surname prefix
                    # For legal format like "VAN DEN BELTON, DOVRIC", we need to find where the surname ends

                    # Check if this is legal format (contains comma)
                    full_text = " ".join(original_words)
                    if "," in full_text:
                        # Legal format: everything before comma is the surname
                        comma_parts = full_text.split(",", 1)
                        surname_part = comma_parts[0].strip()
                        given_part = (
                            comma_parts[1].strip() if len(comma_parts) > 1 else ""
                        )

                        # The compound surname is the entire surname part (preserve original case)
                        compound_surname = surname_part
                        remaining_text = given_part

                        return compound_surname, remaining_text
                    else:
                        # Non-legal format: compound surname from prefix position to end
                        # Given names are everything before the prefix
                        given_words = original_words[:start_idx]
                        surname_words = original_words[start_idx:]

                        # Preserve original case in both parts
                        compound_surname = " ".join(surname_words)
                        remaining_text = " ".join(given_words) if given_words else ""

                        return compound_surname, remaining_text

        return None, None

    def _handle_numbered_format(self, text: str, row_id: int) -> Optional[List[str]]:
        """
        Handle numbered defendant lists like "1. SMITH, John 2. JONES, Mary"
        Also handles: "1) SMITH, John 2) JONES, Mary"
        """
        self._debug_log(f"Row {row_id}: CHECKING NUMBERED FORMAT: '{text}'")

        # Pattern: digits followed by . or ) then a space, used as list markers
        # Split on numbered markers like "1. ", "2. ", "1) ", "2) "
        parts = re.split(r"\d+[.)]\s+", text)

        # Filter out empty parts (the split will produce an empty first element)
        parts = [part.strip() for part in parts if part.strip()]

        if len(parts) >= 2:
            self._debug_log(f"  NUMBERED FORMAT RESULT: {parts}")
            return parts

        self._debug_log("  NO NUMBERED FORMAT DETECTED")
        return None

    def _handle_ampersand_separator(
        self, text: str, row_id: int
    ) -> Optional[List[str]]:
        """
        Handle ampersand (&) as a separator between defendants.
        Examples:
        - "SMITH, John & JONES, Mary" → ["SMITH, John", "JONES, Mary"]
        - "SMITH & JONES" → ["SMITH", "JONES"]
        Only triggers when & is surrounded by spaces (word separator).
        """
        self._debug_log(f"Row {row_id}: CHECKING AMPERSAND SEPARATOR: '{text}'")

        # Pattern 1: Legal format - SURNAME, Given & SURNAME, Given
        pattern_legal = re.match(r"^([^,]+),\s*([^&]+?)\s+&\s+([^,]+),\s*(.+)$", text)

        if pattern_legal:
            surname1 = pattern_legal.group(1).strip()
            given1 = pattern_legal.group(2).strip()
            surname2 = pattern_legal.group(3).strip()
            given2 = pattern_legal.group(4).strip()

            result = [f"{surname1}, {given1}", f"{surname2}, {given2}"]
            self._debug_log(f"  AMPERSAND SEPARATOR (legal format) RESULT: {result}")
            return result

        # Pattern 2: Simple format - NAME & NAME (no commas)
        # Split by " & " and treat each part as a separate defendant
        if " & " in text and "," not in text:
            parts = [part.strip() for part in text.split(" & ") if part.strip()]
            if len(parts) >= 2:
                self._debug_log(f"  AMPERSAND SEPARATOR (simple) RESULT: {parts}")
                return parts

        self._debug_log("  NO AMPERSAND SEPARATOR DETECTED")
        return None

    def _split_comma_separated_defendants(self, segment: str, row_id: int) -> List[str]:
        """
        Split a comma-separated segment that may contain multiple defendants
        in paired format: "SURNAME1, Given1, SURNAME2, Given2, ..."
        OR in no-comma format: "SURNAME GIVEN, SURNAME GIVEN, ..."

        Uses the heuristic: split on all commas, then iterate in pairs.
        If a part is a single word (or compound surname), treat it as a surname
        and the NEXT part as given names.

        Returns a list of defendant strings in "SURNAME, Given" format.
        If the segment is a single defendant, returns it as-is in a list.
        """
        if "," not in segment:
            return [segment]

        comma_parts = [p.strip() for p in segment.split(",") if p.strip()]

        # Check for "SURNAME GIVEN, SURNAME GIVEN" format (no-comma format)
        # Each comma-part has 2+ words and the first word is ALL CAPS (the surname)
        # This check must happen BEFORE the <= 2 early return because 2-part
        # no-comma format ("SMITH JOHN, JONES MARY") is 2 defendants, not legal format.
        all_parts_match_no_comma = len(comma_parts) >= 2
        for part in comma_parts:
            words = part.strip().split()
            if len(words) < 2:
                all_parts_match_no_comma = False
                break
            # First word should be ALL CAPS (surname)
            if not words[0].isupper():
                all_parts_match_no_comma = False
                break

        if all_parts_match_no_comma:
            # Each part is "SURNAME GIVEN" — split first word as surname
            defendants = []
            for part in comma_parts:
                words = part.strip().split()
                surname = words[0]
                given = " ".join(words[1:])
                defendants.append(f"{surname}, {given}")
            self._debug_log(f"  NO-COMMA FORMAT SPLIT: '{segment}' -> {defendants}")
            return defendants

        # If only 2 parts, it's a single "SURNAME, Given" defendant
        if len(comma_parts) <= 2:
            return [segment]

        # Check if the first part looks like a surname (single word or compound)
        first_part_words = comma_parts[0].split()
        is_compound = self._detect_compound_surname(comma_parts[0])[0] is not None

        if len(first_part_words) != 1 and not is_compound:
            # First part is multi-word and not a compound surname
            # This isn't the paired format, return as-is
            return [segment]

        # Try paired processing: [SURNAME, Given, SURNAME, Given, ...]
        defendants = []
        i = 0

        while i < len(comma_parts):
            current = comma_parts[i].strip()
            current_words = current.split()
            current_is_compound = self._detect_compound_surname(current)[0] is not None

            if (len(current_words) == 1 or current_is_compound) and i + 1 < len(
                comma_parts
            ):
                # This is a surname, next part is given names
                given = comma_parts[i + 1].strip()
                defendants.append(f"{current}, {given}")
                i += 2
            else:
                # Multi-word part without a following given name — treat as standalone
                defendants.append(current)
                i += 1

        self._debug_log(
            f"  COMMA-SEPARATED MULTI-DEFENDANT SPLIT: '{segment}' -> {defendants}"
        )

        # Only return the split result if we actually found multiple defendants
        if len(defendants) > 1:
            return defendants

        # Fallback: return original segment as single defendant
        return [segment]

    def _handle_legal_format_with_and(
        self, text: str, row_id: int
    ) -> Optional[List[str]]:
        """
        Handle legal format with AND separator.

        Splits on ALL occurrences of ' and ' (case-insensitive), then processes
        each resulting segment through _split_comma_separated_defendants() to
        handle cases like "ASHFORD, Melisande Kira, HALFORD, Damaris Aurelia La and HALDALE, Anselm Alaric".
        """
        self._debug_log(f"Row {row_id}: CHECKING LEGAL FORMAT WITH AND: '{text}'")

        # Check if text contains " and " at all
        if not re.search(r"\s+and\s+", text, re.IGNORECASE):
            self._debug_log("  NO 'AND' SEPARATOR FOUND")
            return None

        # Split on ALL occurrences of " and " (case-insensitive)
        and_segments = re.split(r"\s+and\s+", text, flags=re.IGNORECASE)

        if len(and_segments) < 2:
            self._debug_log("  SPLIT PRODUCED < 2 SEGMENTS")
            return None

        # Process each segment — it may contain multiple comma-separated defendants
        all_defendants = []
        for segment in and_segments:
            segment = segment.strip()
            if not segment:
                continue

            # Each segment might be "SURNAME, Given" or "SURNAME1, Given1, SURNAME2, Given2"
            segment_defendants = self._split_comma_separated_defendants(segment, row_id)
            all_defendants.extend(segment_defendants)

        if len(all_defendants) >= 2:
            self._debug_log(f"  LEGAL FORMAT WITH AND RESULT: {all_defendants}")
            return all_defendants

        self._debug_log("  NO LEGAL FORMAT WITH AND DETECTED")
        return None

    def _handle_multiple_slash_pattern(
        self, text: str, row_id: int
    ) -> Optional[List[str]]:
        """
        Handle multiple defendants separated by slashes
        FIXED: Now handles 3+ defendants properly
        """
        self._debug_log(f"Row {row_id}: CHECKING MULTIPLE SLASH PATTERN: '{text}'")

        if "/" not in text:
            return None

        # Split by slash and process each part
        slash_parts = [part.strip() for part in text.split("/") if part.strip()]

        if len(slash_parts) < 2:
            return None

        self._debug_log(f"  SLASH PARTS: {slash_parts}")

        defendants = []
        for part in slash_parts:
            part = part.strip()
            if part:
                # Check if this part is in legal format (SURNAME, GIVEN NAMES)
                if "," in part:
                    defendants.append(part)
                else:
                    # FIXED: Assume it's in "SURNAME GIVEN_NAMES" format and convert to legal format
                    words = part.split()
                    if len(words) >= 2:
                        surname = words[0]  # First word is surname
                        given_names = " ".join(
                            words[1:]
                        )  # Remaining words are given names
                        defendants.append(f"{surname}, {given_names}")
                    else:
                        # Single word - treat as surname only
                        defendants.append(part)

        self._debug_log(f"  MULTIPLE SLASH RESULT: {defendants}")
        return defendants if len(defendants) > 1 else None

    def _reconstruct_malformed_and_arrays(
        self, items: List[str], row_id: int
    ) -> List[str]:
        """
        Detect and reconstruct malformed arrays that contain AND separators
        Example: ['ELMONT', 'WINIFRED BELHOLM  AND FENLEY', 'HALGRAVE MARY']
        Should become: ['ELMONT, WINIFRED BELHOLM AND FENLEY, HALGRAVE MARY']
        """
        self._debug_log(f"Row {row_id}: CHECKING FOR MALFORMED AND ARRAYS: {items}")

        if len(items) != 3:
            self._debug_log("  NOT 3-ITEM ARRAY - no reconstruction needed")
            return items

        # Check if middle item contains AND
        middle_item = items[1].strip()
        if not re.search(r"\s+and\s+", middle_item, re.IGNORECASE):
            self._debug_log("  NO AND IN MIDDLE ITEM - no reconstruction needed")
            return items

        # Pattern: ['SURNAME1', 'GIVEN1 AND SURNAME2', 'GIVEN2']
        # Should become: 'SURNAME1, GIVEN1 AND SURNAME2, GIVEN2'
        surname1 = items[0].strip()
        middle_part = items[1].strip()
        given2 = items[2].strip()

        # Split the middle part by AND
        and_match = re.search(r"(.+?)\s+and\s+(.+)", middle_part, re.IGNORECASE)
        if and_match:
            given1 = and_match.group(1).strip()
            surname2 = and_match.group(2).strip()

            # Reconstruct as legal format
            reconstructed = f"{surname1}, {given1} AND {surname2}, {given2}"
            self._debug_log(f"  RECONSTRUCTED: '{reconstructed}'")
            return [reconstructed]

        self._debug_log("  COULD NOT RECONSTRUCT - returning original items")
        return items

    def _handle_semicolon_separators(
        self, text: str, row_id: int
    ) -> Optional[List[str]]:
        """
        Handle semicolon separators with support for mixed patterns
        Examples:
        - "CALGRAVE, Bettina Vera; ASHDALE, Gideon; DUNFORD, Arawen and LANFORD, Leopold Wystan"
        - "SMITH, John; JONES, Mary"
        """
        self._debug_log(f"Row {row_id}: HANDLING SEMICOLON SEPARATORS: '{text}'")

        parts = [part.strip() for part in text.split(";") if part.strip()]

        if len(parts) <= 1:
            self._debug_log(f"  NOT ENOUGH SEMICOLON PARTS: {len(parts)}")
            return None

        # Process each semicolon-separated part
        # Some parts might contain AND separators within them
        final_defendants = []

        for part in parts:
            part = part.strip()
            if not part:
                continue

            # Check if this part contains AND separator
            if " and " in part.lower():
                # Handle AND within this semicolon part
                and_result = self._handle_legal_format_with_and(part, row_id)
                if and_result:
                    final_defendants.extend(and_result)
                else:
                    # Fallback: treat as single defendant
                    final_defendants.append(part)
            else:
                # Single defendant in this part
                final_defendants.append(part)

        self._debug_log(f"  SEMICOLON RESULT: {final_defendants}")
        return final_defendants if len(final_defendants) > 1 else None

    def _handle_complex_comma_and_pattern(
        self, text: str, row_id: int
    ) -> Optional[List[str]]:
        """
        Handle complex comma + AND patterns with 3+ defendants
        Examples:
        - "GARFORD, Mark Nicholas, HALLEY, Evander Elfield, and DALE, Corin Rowena"
        - "SMITH, John, JONES, Mary, and BROWN, David"
        - "A, B, C, D, E, F, and G, H"
        """
        self._debug_log(f"Row {row_id}: CHECKING COMPLEX COMMA+AND PATTERN: '{text}'")

        # Look for pattern: multiple comma-separated legal format names ending with "and SURNAME, Given Names"
        # Pattern: "SURNAME1, Given1, SURNAME2, Given2, and SURNAME3, Given3"
        and_match = re.search(r",\s*and\s+([^,]+),\s*(.+)$", text, re.IGNORECASE)

        if not and_match:
            self._debug_log("  NO COMPLEX AND PATTERN FOUND")
            return None

        # Split the text at the "and" keyword
        before_and = text[: and_match.start()].strip()
        and_surname = and_match.group(1).strip()
        and_given = and_match.group(2).strip()

        self._debug_log(f"  BEFORE AND: '{before_and}'")
        self._debug_log(f"  AND DEFENDANT: '{and_surname}, {and_given}'")

        # Split the part before "and" by commas
        before_parts = [part.strip() for part in before_and.split(",") if part.strip()]

        if len(before_parts) < 2:
            self._debug_log(f"  NOT ENOUGH PARTS BEFORE AND: {len(before_parts)}")
            return None

        # Group the parts before "and" into legal format pairs
        # Pattern should be: SURNAME1, Given1, SURNAME2, Given2, ...
        defendants = []
        i = 0

        while i < len(before_parts) - 1:
            surname = before_parts[i].strip()
            given = before_parts[i + 1].strip()

            # Check if this looks like a legal format pair
            # The surname should be a single word or compound surname
            # The given names can be multiple words

            # Simple heuristic: if the next part (i+2) exists and looks like a surname,
            # then current pair is complete
            if i + 2 < len(before_parts):
                next_part = before_parts[i + 2].strip()
                # If next part is all caps or looks like a surname, current pair is complete
                if (
                    next_part.isupper() and len(next_part.split()) <= 2
                ) or self._detect_compound_surname(next_part)[0]:
                    defendants.append(f"{surname}, {given}")
                    i += 2
                else:
                    # Next part might be part of current given names
                    # Combine with current given names
                    given = f"{given}, {next_part}"
                    defendants.append(f"{surname}, {given}")
                    i += 3
            else:
                # Last pair before "and"
                defendants.append(f"{surname}, {given}")
                i += 2

        # Add the final defendant after "and"
        defendants.append(f"{and_surname}, {and_given}")

        # Validate that we have at least 3 defendants for complex pattern
        if len(defendants) >= 3:
            self._debug_log(f"  COMPLEX COMMA+AND RESULT: {defendants}")
            return defendants
        else:
            self._debug_log(
                f"  NOT ENOUGH DEFENDANTS FOR COMPLEX PATTERN: {len(defendants)}"
            )
            return None

    def _extract_array_items(self, text: str, row_id: int) -> List[str]:
        """Extract items from array-like format"""
        self._debug_log(f"Row {row_id}: EXTRACTING ARRAY ITEMS: '{text}'")

        if text.startswith("[") and text.endswith("]"):
            inner_content = text[1:-1].strip()

            items = []
            # Handle quoted items in arrays
            current_item = ""
            in_quotes = False
            quote_char = None

            i = 0
            while i < len(inner_content):
                char = inner_content[i]

                if not in_quotes and char in ['"', "'"]:
                    # Start of quoted string
                    in_quotes = True
                    quote_char = char
                elif in_quotes and char == quote_char:
                    # End of quoted string
                    in_quotes = False
                    quote_char = None
                elif not in_quotes and char == ",":
                    # End of item
                    if current_item.strip():
                        items.append(current_item.strip())
                    current_item = ""
                    i += 1
                    continue
                else:
                    current_item += char

                i += 1

            # Add last item
            if current_item.strip():
                items.append(current_item.strip())

            self._debug_log(f"  EXTRACTED ARRAY ITEMS: {items}")
            return items

        return [text]

    def _is_array_legal_format(self, items: List[str], row_id: int) -> bool:
        """
        Detect if 2-item array represents single defendant in legal format
        ['SURNAME', 'GIVEN NAMES'] vs ['DEFENDANT1', 'DEFENDANT2']
        """
        if len(items) != 2:
            return False

        first_item = items[0].strip()
        second_item = items[1].strip()

        self._debug_log(
            f"Row {row_id}: CHECKING ARRAY LEGAL FORMAT: ['{first_item}', '{second_item}']"
        )

        # ENHANCED LOGIC: Distinguish between legal format and multiple defendants
        # Legal format: ['SURNAME', 'GIVEN NAMES'] (single word surname + given names)
        # Multiple defendants: ['SURNAME GIVEN_NAMES', 'SURNAME GIVEN_NAMES'] (both have multiple words)

        first_words = len(first_item.split())
        second_words = len(second_item.split())

        # If both items have multiple words, likely multiple defendants
        # Examples: ['ASHWORTH MABEL IRIS', 'HALBY VALENTIN LUCIAN'] = 2 defendants
        #          ['ELBY LINUS INGRID', 'ASHHOLM HUGO MARK'] = 2 defendants
        both_items_multi_word = first_words >= 2 and second_words >= 2

        if both_items_multi_word:
            self._debug_log(
                f"  Both items multi-word ({first_words}, {second_words}) - likely multiple defendants"
            )
            return False

        # Check for compound surname in first item
        compound, _ = self._detect_compound_surname(first_item)
        is_compound_surname = compound is not None

        # Check if first item looks like a single surname
        is_all_caps = first_item.isupper()
        is_mixed_case_surname = (
            # Check if it looks like a surname with mixed case (e.g., Fenworth, O'Connor)
            first_words == 1  # Single word
            and first_item[0].isupper()  # Starts with capital
            and len(first_item) >= 2  # At least 2 characters
            and not first_item.islower()  # Not all lowercase (would be given name)
        )

        is_single_surname = (
            (
                is_all_caps and first_words == 1
            )  # Single word all caps surname like "SMITH"
            or is_mixed_case_surname  # Mixed case single word surname like "Fenworth"
            or is_compound_surname  # Compound surname like "VAN DEN BELTON"
        )

        # Check if second item looks like given names
        looks_like_given_names = (
            second_words >= 1  # At least one word
            and not second_item.startswith("DEFENDANT")  # Not generic defendant label
            and len(second_item) >= 2  # At least 2 characters
        )

        is_legal_format = is_single_surname and looks_like_given_names

        self._debug_log(f"  Compound surname: {is_compound_surname}")
        self._debug_log(f"  Single surname: {is_single_surname}")
        self._debug_log(f"  Looks like given names: {looks_like_given_names}")
        self._debug_log(f"  Is legal format: {is_legal_format}")

        return is_legal_format

    def _handle_apostrophes(self, text: str) -> str:
        """Handle apostrophes by replacing with &apos; entity - ONLY in actual names"""
        return re.sub(r"([a-zA-Z])'([a-zA-Z])", r"\1&apos;\2", text)

    def _title_case_name(self, text: str) -> str:
        """
        Convert name to title case with proper handling of:
        - Hyphens (FENWICK-FENFORD → Fenwick-Fenford)
        - Apostrophes (O'BRIEN → O'Brien, D'SOUZA → D'Souza)
        - Mc/Mac prefixes (MCDONALD → McDonald, MACLEOD → Macleod)
        """
        if not text:
            return text

        text_with_apos = self._handle_apostrophes(text)

        words = []
        for word in text_with_apos.split():
            if "-" in word:
                hyphen_parts = word.split("-")
                title_parts = [
                    self._title_case_single_word(part) if part else ""
                    for part in hyphen_parts
                ]
                processed_word = "-".join(title_parts)
                words.append(processed_word)
            elif "&apos;" in word:
                apos_parts = word.split("&apos;")
                title_parts = [
                    part.lower().capitalize() if part else "" for part in apos_parts
                ]
                # Restore apostrophe (convert &apos; back to real apostrophe)
                processed_word = "'".join(title_parts)
                words.append(processed_word)
            else:
                processed_word = self._title_case_single_word(word)
                words.append(processed_word)

        return " ".join(words)

    def _title_case_single_word(self, word: str) -> str:
        """
        Title case a single word with Mc/Mac prefix handling.
        - MC prefix: MCDONALD → McDonald, FENWORTH → Fenworth
        - MAC prefix: MACLEOD → Macleod (no special handling — Mac names are
          inconsistent so we use standard title case to avoid false positives
          like "Mace" → "MaCe")
        """
        if not word:
            return word

        upper_word = word.upper()

        # Handle Mc prefix (3+ chars, starts with MC)
        if len(upper_word) >= 3 and upper_word.startswith("MC"):
            remainder = word[2:]
            return "Mc" + remainder.lower().capitalize()

        return word.lower().capitalize()

    def _parse_single_defendant(self, name_text: str, row_id: int) -> dict:
        """
        Parse a single defendant name with enhanced pattern recognition
        FIXED: Better compound surname detection and legal format handling
        """
        self._debug_log(f"Row {row_id}: PARSING SINGLE DEFENDANT: '{name_text}'")

        if not name_text or not name_text.strip():
            return None

        # Check skip patterns BEFORE any processing
        if self._should_skip(name_text.strip()):
            self._debug_log("  SKIP PATTERN MATCH - returning None")
            return None

        # Check standardization BEFORE any processing
        if self._should_be_empty_array(name_text.strip()):
            self._debug_log("  STANDARDIZATION MATCH - returning None")
            return None

        # PRESERVE original case for compound surname detection
        original_text = name_text.strip()

        # Legal format: "LASTNAME, Firstname Middlename"
        comma_match = re.match(r"^([^,]+),\s*(.+)$", original_text)
        if comma_match:
            surname_part = comma_match.group(1).strip()
            given_part = comma_match.group(2).strip()

            self._debug_log(
                f"  LEGAL FORMAT DETECTED: surname='{surname_part}', given='{given_part}'"
            )

            # Check for compound surname in surname_part
            compound_surname, remaining = self._detect_compound_surname(surname_part)

            if compound_surname:
                # Compound surname found - but in legal format, the given names come after comma
                final_surname = self._title_case_name(compound_surname)
                final_given = self._title_case_name(given_part)

                # If there was remaining text in surname part, it should be added to given names
                if remaining:
                    final_given = self._title_case_name(
                        f"{remaining} {given_part}".strip()
                    )

                result = {"given_names": final_given, "last_name": final_surname}
                self._debug_log(f"  COMPOUND SURNAME IN LEGAL FORMAT: {result}")
                return result
            else:
                # Regular legal format
                final_surname = self._title_case_name(surname_part)
                final_given = self._title_case_name(given_part)
                result = {"given_names": final_given, "last_name": final_surname}
                self._debug_log(f"  REGULAR LEGAL FORMAT: {result}")
                return result

        # Non-comma format - check for compound surname first
        compound_surname, remaining_given = self._detect_compound_surname(original_text)
        if compound_surname:
            final_surname = self._title_case_name(compound_surname)
            final_given = (
                self._title_case_name(remaining_given) if remaining_given else ""
            )
            result = {"given_names": final_given, "last_name": final_surname}
            self._debug_log(f"  COMPOUND SURNAME (non-legal): {result}")
            return result

        # Regular name parsing
        words = original_text.split()
        self._debug_log(f"  REGULAR PARSING - words: {words}")

        if len(words) >= 2:
            # FIXED: First word is surname, remaining words are given names
            # Based on data analysis: "DUNLEY JOLYON" -> surname="DUNLEY", given_names="JOLYON"
            surname = words[0]
            given_names = " ".join(words[1:])
            final_surname = self._title_case_name(surname)
            final_given = self._title_case_name(given_names)
            result = {"given_names": final_given, "last_name": final_surname}
            self._debug_log(f"  MULTI-WORD: {result}")
            return result
        elif len(words) == 1:
            # Single word - treat as surname only (common for defendants)
            final_surname = self._title_case_name(words[0])
            result = {"given_names": "", "last_name": final_surname}
            self._debug_log(f"  SINGLE WORD (surname only): {result}")
            return result

        self._debug_log("  FALLBACK - empty result")
        return None

    def _handle_space_separated_surnames(
        self, text: str, row_id: int
    ) -> Optional[List[str]]:
        """
        Handle space-separated multiple defendants without commas
        Examples:
        - "ELDALE, Arao Beatrix ASHGRAVE, Florian" -> ["ELDALE, Arao Beatrix", "ASHGRAVE, Florian"]
        - "ELCOMBE, Pippa Phineas ELCOMBE, Hester" -> ["ELCOMBE, Pippa Phineas", "ELCOMBE, Hester"]
        """
        self._debug_log(f"Row {row_id}: CHECKING SPACE-SEPARATED SURNAMES: '{text}'")

        # Only process if there are commas (mixed format)
        if "," not in text:
            return None

        # Split by commas first to get potential parts
        comma_parts = [part.strip() for part in text.split(",") if part.strip()]

        if len(comma_parts) < 3:
            # Not enough parts for space-separated pattern
            return None

        self._debug_log(f"  COMMA PARTS: {comma_parts}")

        # Look for surname patterns in the middle parts
        # Pattern: "SURNAME1, Given Names1 SURNAME2, Given Names2"
        # After comma split: ["SURNAME1", "Given Names1 SURNAME2", "Given Names2"]

        # Try to find surname boundaries and reconstruct
        defendants = []

        # Start with first part (always a surname)
        current_surname = comma_parts[0].strip()
        current_given_names = []

        for i in range(1, len(comma_parts)):
            part = comma_parts[i].strip()

            # Check if this part contains a surname boundary
            surname_boundary = self._find_surname_boundary_in_text(part, row_id)

            if surname_boundary is not None:
                # Split at the boundary
                given_names_part = part[:surname_boundary].strip()
                surname_part = part[surname_boundary:].strip()

                # Add the given names part to current defendant
                if given_names_part:
                    current_given_names.append(given_names_part)

                # Complete current defendant
                given_names_str = " ".join(current_given_names)
                defendants.append(f"{current_surname}, {given_names_str}")

                self._debug_log(
                    f"  COMPLETED DEFENDANT: '{current_surname}, {given_names_str}'"
                )

                # Start new defendant with the surname part
                current_surname = surname_part
                current_given_names = []

            else:
                # No surname boundary, add to current given names
                current_given_names.append(part)

        # Complete the last defendant
        if current_surname:
            given_names_str = " ".join(current_given_names)
            defendants.append(f"{current_surname}, {given_names_str}")
            self._debug_log(
                f"  FINAL DEFENDANT: '{current_surname}, {given_names_str}'"
            )

        # Only return if we found multiple defendants and it makes sense
        if len(defendants) >= 2:
            self._debug_log(f"  SPACE-SEPARATED SURNAMES RESULT: {defendants}")
            return defendants
        else:
            self._debug_log(f"  NOT ENOUGH DEFENDANTS FOUND: {len(defendants)}")
            return None

    def _find_surname_boundary_in_text(self, text: str, row_id: int) -> Optional[int]:
        """
        Find the boundary where a surname starts in mixed text
        Example: "Arao Beatrix ASHGRAVE" -> returns index of "ASHGRAVE"
        """
        words = text.split()

        if len(words) < 2:
            return None

        self._debug_log(f"  ANALYZING WORDS FOR SURNAME BOUNDARY: {words}")

        # Look for surname patterns from right to left
        # Priority: All caps surnames, then mixed case surnames
        for i in range(len(words) - 1, 0, -1):
            word = words[i]

            # Check if this word looks like a surname
            if self._is_likely_surname(word, row_id):
                # Calculate the character position of this word
                char_position = 0
                for j in range(i):
                    char_position += len(words[j]) + 1  # +1 for space

                self._debug_log(
                    f"  SURNAME BOUNDARY FOUND: '{word}' at position {char_position}"
                )
                return char_position

        # No fallback - be very conservative
        # Only detect clear surname patterns (all caps, compound, hyphenated)

        return None

    def _is_likely_surname(self, word: str, row_id: int) -> bool:
        """
        Determine if a word is likely a surname based on patterns
        """
        # Check for compound surname prefixes first
        compound, _ = self._detect_compound_surname(word)
        if compound is not None:
            return True

        # Check if it's all uppercase (strong surname indicator)
        if word.isupper() and len(word) >= 2:
            self._debug_log(f"    SURNAME PATTERN: '{word}' - all uppercase")
            return True

        # Check for hyphenated surnames
        if "-" in word and word[0].isupper():
            self._debug_log(f"    SURNAME PATTERN: '{word}' - hyphenated")
            return True

        # For mixed case words, be very conservative
        # Only consider it a surname if it's clearly a surname pattern
        if (
            word[0].isupper()
            and len(word) >= 3
            and not word.islower()
            and not word.isupper()
        ):
            # Be conservative with mixed case - only treat as surname if it's very likely
            # For space-separated detection, focus on all-caps surnames primarily
            self._debug_log(
                f"    MIXED CASE: '{word}' - being conservative, not treating as surname"
            )
            return False

        return False

    def _split_by_separators(self, text: str, row_id: int) -> List[str]:
        """
        Split text by various separators with enhanced detection
        ENHANCED: Better handling of semicolon, complex comma+AND, numbered, ampersand,
        and mixed separator patterns
        """
        self._debug_log(f"Row {row_id}: SPLITTING BY SEPARATORS: '{text}'")

        # PRIORITY 0: Handle numbered format (e.g., "1. SMITH, John 2. JONES, Mary")
        # Check early because numbered markers are unambiguous
        if re.search(r"\d+[.)]\s+", text):
            numbered_result = self._handle_numbered_format(text, row_id)
            if numbered_result:
                return numbered_result

        # PRIORITY 1: Handle semicolon separators (highest priority)
        # Semicolons can contain AND within parts, so check first
        if ";" in text:
            semicolon_result = self._handle_semicolon_separators(text, row_id)
            if semicolon_result:
                return semicolon_result

        # PRIORITY 2: Handle complex comma + AND patterns (3+ defendants)
        # Check for patterns like "A, B, C, D, and E, F" before simple AND patterns
        complex_and_result = self._handle_complex_comma_and_pattern(text, row_id)
        if complex_and_result:
            return complex_and_result

        # PRIORITY 3: Handle ampersand separator (e.g., "SMITH, John & JONES, Mary")
        if "&" in text:
            ampersand_result = self._handle_ampersand_separator(text, row_id)
            if ampersand_result:
                return ampersand_result

        # PRIORITY 4: Handle simple legal format with AND (2 defendants)
        and_result = self._handle_legal_format_with_and(text, row_id)
        if and_result:
            return and_result

        # PRIORITY 5: Check for multiple slash pattern
        slash_result = self._handle_multiple_slash_pattern(text, row_id)
        if slash_result:
            return slash_result

        # PRIORITY 5.5: Check for no-comma format multi-defendant
        # "SURNAME GIVEN, SURNAME GIVEN, SURNAME GIVEN" — each comma-part is one defendant
        # Must run BEFORE space-separated surnames handler which mishandles this format
        if "," in text:
            no_comma_result = self._split_comma_separated_defendants(text, row_id)
            if len(no_comma_result) > 1:
                return no_comma_result

        # PRIORITY 6: Handle space-based surname pattern detection
        # Check for cases like "ELDALE, Arao Beatrix ASHGRAVE, Florian"
        space_surname_result = self._handle_space_separated_surnames(text, row_id)
        if space_surname_result:
            return space_surname_result

        # Handle comma separation (smart detection)
        if "," in text:
            parts = [part.strip() for part in text.split(",") if part.strip()]

            # If we have exactly 2 parts, check if it's legal format vs multiple defendants
            if len(parts) == 2:
                first_part = parts[0].strip()
                second_part = parts[1].strip()

                # Check if this looks like legal format: "SURNAME, Given Names" vs multiple defendants
                # ENHANCED LOGIC: Consider both parts to distinguish patterns
                # Legal format: "SMITH, JOHN ISOLDE" (single word surname + given names)
                # Multiple defendants: "SMITH JOHN, JONES MARY" (multiple words in both parts)

                compound, _ = self._detect_compound_surname(first_part)

                # Count words in each part
                first_part_words = len(first_part.split())
                second_part_words = len(second_part.split())

                # Check if first part looks like a single surname
                is_all_caps = first_part.isupper()
                is_mixed_case_surname = (
                    # Check if it looks like a surname with mixed case (e.g., Fenworth, O'Connor)
                    first_part_words == 1  # Single word
                    and first_part[0].isupper()  # Starts with capital
                    and len(first_part) >= 2  # At least 2 characters
                    and not first_part.islower()  # Not all lowercase (would be given name)
                )

                is_single_surname = (
                    (
                        is_all_caps and first_part_words == 1
                    )  # Single word all caps surname like "SMITH"
                    or is_mixed_case_surname  # Mixed case single word surname like "Fenworth"
                    or compound is not None  # Compound surname like "VAN DEN BELTON"
                )

                # ENHANCED: If both parts have multiple words, likely multiple defendants
                # Examples: "ASHWORTH MABEL IRIS, HALBY VALENTIN LUCIAN" = 2 defendants
                #          "ELBY LINUS INGRID, ASHHOLM HUGO MARK" = 2 defendants
                both_parts_multi_word = first_part_words >= 2 and second_part_words >= 2

                if both_parts_multi_word:
                    self._debug_log(
                        f"  MULTIPLE DEFENDANTS: both parts have multiple words ({first_part_words}, {second_part_words})"
                    )
                    return parts
                elif is_single_surname:
                    self._debug_log("  LEGAL FORMAT: single surname + given names")
                    return [text]
                else:
                    # Fallback: if first part has multiple words but second doesn't, likely multiple defendants
                    # Example: "SMITH JOHN, MARY" -> probably 2 defendants
                    self._debug_log(
                        f"  MULTIPLE DEFENDANTS: first part multi-word ({first_part_words} words)"
                    )
                    return parts
            else:
                # More than 2 comma-separated parts
                # Check if this is a multi-defendant paired format:
                # "SURNAME1, Given1, SURNAME2, Given2, ..."
                paired_result = self._split_comma_separated_defendants(text, row_id)
                if len(paired_result) > 1:
                    self._debug_log(f"  MULTI-DEFENDANT COMMA PAIRS: {paired_result}")
                    return paired_result

                self._debug_log(f"  MULTIPLE COMMA PARTS: {parts}")
                return parts

        # Single defendant
        self._debug_log("  NO SEPARATORS FOUND")
        return [text]

    def process_value(
        self, input_value: Any, row_id: int, transformation_logger
    ) -> str:
        """Main processing method with fixes"""

        # Debug specific problematic rows
        problematic_rows = [
            385,  # Added for slash separator testing
            419,
            424,
            437,
            454,  # Added for testing Fenworth, ARAANA SABINE
            480,
            536,
            588,  # Added for testing Calworth, Nestor Imogen
            647,
            788,
            832,
            835,
            836,
            1022,
            1380,
            1855,
            1860,
            3635,
        ]
        should_debug = row_id in problematic_rows

        if should_debug:
            self._debug_log(f"\n{'='*60}")
            self._debug_log(f"PROCESSING PROBLEMATIC ROW {row_id}")
            self._debug_log(f"{'='*60}")

        original_str = str(input_value) if input_value is not None else "None"
        transformation_logger.log_transformation_issue(
            domain_name="defendants",
            row_id=row_id,
            column="defendants",
            original_value=original_str,
            issue_type="processing_started",
            action_taken="defendant_processing",
            final_value="processing",
            requires_review=False,
        )

        # Handle empty/null values
        if (
            input_value is None
            or input_value == ""
            or str(input_value).strip() == ""
            or str(input_value).lower().strip() == "null"
            or (isinstance(input_value, float) and input_value != input_value)
        ):
            if should_debug:
                self._debug_log(f"Row {row_id}: EMPTY INPUT - returning []")

            transformation_logger.log_transformation_issue(
                domain_name="defendants",
                row_id=row_id,
                column="defendants",
                original_value="empty",
                issue_type="empty_value",
                action_taken="return_empty_array",
                final_value="[]",
                requires_review=False,
            )
            return "[]"

        defendant_text = str(input_value).strip()

        if should_debug:
            self._debug_log(f"Row {row_id}: INPUT: '{defendant_text}'")

        # Check skip patterns BEFORE any name parsing/splitting logic
        if self._should_skip(defendant_text):
            if should_debug:
                self._debug_log(f"Row {row_id}: SKIP PATTERN MATCH - returning []")

            transformation_logger.log_transformation_issue(
                domain_name="defendants",
                row_id=row_id,
                column="defendants",
                original_value=defendant_text,
                issue_type="skip_pattern",
                action_taken="mapped_to_empty_array",
                final_value="[]",
                requires_review=False,
            )
            return "[]"

        # Check standardization (exact variant matches from JSON config)
        if self._should_be_empty_array(defendant_text):
            if should_debug:
                self._debug_log(f"Row {row_id}: STANDARDIZATION MATCH - returning []")

            transformation_logger.log_transformation_issue(
                domain_name="defendants",
                row_id=row_id,
                column="defendants",
                original_value=defendant_text,
                issue_type="standardization",
                action_taken="mapped_to_empty_array",
                final_value="[]",
                requires_review=False,
            )
            return "[]"

        # Extract items from array format if present
        items = self._extract_array_items(defendant_text, row_id)

        # Check if 2-item array represents single defendant in legal format
        if len(items) == 2 and self._is_array_legal_format(items, row_id):
            # Treat as single defendant: ['SURNAME', 'GIVEN NAMES']
            surname = items[0].strip()
            given_names = items[1].strip()
            legal_format_string = f"{surname}, {given_names}"

            if should_debug:
                self._debug_log(
                    f"Row {row_id}: ARRAY LEGAL FORMAT DETECTED: '{legal_format_string}'"
                )

            final_defendant_strings = [legal_format_string]
        else:
            # Check for malformed array with AND separators and reconstruct
            reconstructed_items = self._reconstruct_malformed_and_arrays(items, row_id)

            # Process each item through separator splitting
            final_defendant_strings = []
            for item in reconstructed_items:
                if item.strip():
                    split_items = self._split_by_separators(item.strip(), row_id)

                    # FIXED: If split_items has multiple parts, they are already properly separated
                    # and should not be processed through _split_by_separators again
                    if len(split_items) > 1:
                        # Multiple defendants found - add them directly
                        final_defendant_strings.extend(split_items)
                    else:
                        # Single defendant - add it directly
                        final_defendant_strings.extend(split_items)

        # Parse each defendant string
        defendants = []
        for i, defendant_str in enumerate(final_defendant_strings):
            if defendant_str.strip():
                if should_debug:
                    self._debug_log(
                        f"Row {row_id}: PARSING DEFENDANT {i+1}: '{defendant_str.strip()}'"
                    )

                parsed = self._parse_single_defendant(defendant_str.strip(), row_id)
                if parsed:
                    defendants.append(parsed)

                    transformation_logger.log_transformation_issue(
                        domain_name="defendants",
                        row_id=row_id,
                        column="defendants",
                        original_value=defendant_str.strip(),
                        issue_type="parsed",
                        action_taken="legal_name_parsing",
                        final_value=f"{parsed['given_names']} {parsed['last_name']}".strip(),
                        requires_review=False,
                    )

        if not defendants:
            if should_debug:
                self._debug_log(f"Row {row_id}: NO VALID DEFENDANTS - returning []")
            return []

        try:
            # Return structured data directly instead of JSON string
            if should_debug:
                self._debug_log(f"Row {row_id}: FINAL RESULT: {defendants}")
            return defendants
        except Exception as e:
            if should_debug:
                self._debug_log(f"Row {row_id}: ERROR: {str(e)}")
            self.logger.error(f"Error processing defendants: {str(e)}")
            return []

    @staticmethod
    def analyze_defendants_csv():
        """Analyze the defendants CSV file to find empty given_names and last_name issues"""
        print("\n" + "=" * 60)
        print("DEFENDANTS CSV ANALYSIS - FIXED VERSION")
        print("=" * 60)

        # Check if CSV file exists
        print(f"Looking for CSV at: {DEFENDANTS_CSV_PATH}")
        if not DEFENDANTS_CSV_PATH.exists():
            print("ERROR: Defendants CSV file not found!")
            return

        # Analyze the CSV
        first_name_issues = []
        last_name_issues = []
        total_rows = 0
        empty_arrays = 0
        invalid_json = 0
        valid_defendants = 0

        try:
            with open(DEFENDANTS_CSV_PATH, "r", encoding="utf-8") as csvfile:
                reader = csv.DictReader(csvfile)

                for row_num, row in enumerate(reader, 1):
                    total_rows += 1
                    row_id = row.get("row_id", "unknown")
                    original_value = row.get("original_value", "")
                    processed_value = row.get("processed_value", "")

                    # Skip empty processed values
                    if processed_value.strip() in ["[]", '""', ""]:
                        empty_arrays += 1
                        continue

                    try:
                        defendants_list = json.loads(processed_value)
                        if not isinstance(defendants_list, list):
                            continue

                        valid_defendants += len(defendants_list)

                        # Check each defendant for issues
                        for defendant_idx, defendant in enumerate(defendants_list):
                            if isinstance(defendant, dict):
                                given_names = defendant.get("given_names", "")
                                last_name = defendant.get("last_name", "")

                                # Check for empty given names (excluding single name defendants)
                                if (
                                    given_names == ""
                                    and not DefendantProcessor._is_single_name_defendant(
                                        original_value
                                    )
                                ):
                                    issue_entry = {
                                        "row_id": row_id,
                                        "original_value": original_value,
                                        "processed_value": processed_value,
                                        "defendant_index": defendant_idx,
                                        "last_name": last_name,
                                    }
                                    first_name_issues.append(issue_entry)

                                # Check for empty last names
                                if last_name == "":
                                    issue_entry = {
                                        "row_id": row_id,
                                        "original_value": original_value,
                                        "processed_value": processed_value,
                                        "defendant_index": defendant_idx,
                                        "given_names": given_names,
                                    }
                                    last_name_issues.append(issue_entry)

                    except (json.JSONDecodeError, TypeError):
                        invalid_json += 1

        except Exception as e:
            print(f"ERROR reading CSV file: {e}")
            return

        # Print summary
        print("\nFIXED VERSION ANALYSIS SUMMARY:")
        print(f"  Total rows processed: {total_rows}")
        print(f"  Empty arrays (valid): {empty_arrays}")
        print(f"  Invalid JSON entries: {invalid_json}")
        print(f"  Total valid defendants: {valid_defendants}")
        print(f"  Empty given_names issues: {len(first_name_issues)}")
        print(f"  Empty last_name issues: {len(last_name_issues)}")
        print("Summary printed, now generating reports...")

        # Generate detailed issue reports
        print(
            f"About to generate reports with {len(first_name_issues)} first name issues and {len(last_name_issues)} last name issues..."
        )
        try:
            DefendantProcessor._generate_first_name_issues_report(first_name_issues)
            DefendantProcessor._generate_last_name_issues_report(last_name_issues)
            print("Report generation completed successfully!")
        except Exception as e:
            print(f"Error during report generation: {e}")
            import traceback

            traceback.print_exc()

    @staticmethod
    def _is_single_name_defendant(original_value: str) -> bool:
        """Check if this appears to be an intentionally single-name defendant"""
        # Single names like "SMITH", "JONES", etc. should have empty given names
        original = original_value.strip()

        # Remove array brackets if present
        if original.startswith("[") and original.endswith("]"):
            original = original[1:-1].strip()
            # Remove quotes
            original = original.strip("'\"")

        # If it's a single word and all caps, it's likely intentionally surname-only
        words = original.split()
        return len(words) == 1 and original.isupper()

    @staticmethod
    def _analyze_issue_type(original_value: str, processed_value: str) -> str:
        """Analyze the specific issue type for detailed reporting"""
        original = original_value.strip()

        # Compound surname analysis
        compound_prefixes = ["VAN DEN", "VAN DER", "DE ", "DA ", "AL ", "VON", "DU "]
        for prefix in compound_prefixes:
            if prefix in original.upper():
                return (
                    f"Compound surname '{prefix.strip()}' not detected as single unit"
                )

        # Array format analysis
        if "[" in original and "]" in original:
            return "Array format: first element should be surname, second should be given names"

        # Separator analysis
        if " AND " in original.upper() or " and " in original:
            return (
                "AND separator: should create 2 defendants, not split single defendant"
            )

        if "/" in original:
            slash_count = original.count("/")
            return f"Slash separator: should create {slash_count + 1} defendants with proper name parsing"

        if ";" in original:
            semicolon_count = original.count(";")
            return (
                f"Semicolon separator: should create {semicolon_count + 1} defendants"
            )

        # Legal format analysis
        if "," in original:
            comma_count = original.count(",")
            if comma_count == 1:
                return "Legal format: 'SURNAME, Given Names' should be single defendant"
            else:
                return (
                    f"Multiple commas: likely {comma_count} defendants in legal format"
                )

        return "Unknown parsing issue"

    @staticmethod
    def _analyze_last_name_issue(original_value: str, processed_value: str) -> str:
        """Analyze the specific last name issue type for detailed reporting"""
        original = original_value.strip()

        # Check for compound surname patterns
        compound_prefixes = ["VAN DEN", "VAN DER", "DE ", "DA ", "AL ", "VON", "DU "]
        for prefix in compound_prefixes:
            if prefix in original.upper():
                return f"Compound surname '{prefix.strip()}' processing failure"

        # Check for separator issues
        if " AND " in original.upper() or " and " in original:
            return "AND separator: surname lost during multiple defendant processing"

        if "/" in original:
            return "Slash separator: surname lost during multiple defendant processing"

        if ";" in original:
            return (
                "Semicolon separator: surname lost during multiple defendant processing"
            )

        # Check for format detection issues
        if "," in original:
            return "Legal format: surname not properly extracted from 'SURNAME, Given Names'"

        # Basic parsing errors
        if not original or original.strip() == "":
            return "Empty input: no surname available to extract"

        return "Unknown surname extraction failure"

    @staticmethod
    def _generate_first_name_issues_report(first_name_issues):
        """Generate detailed first_name_issues_README.md report with comprehensive categorisation"""
        try:
            with open(FIRST_NAME_ISSUES_FILE, "w", encoding="utf-8") as f:
                f.write("# First Name Issues Analysis Report\n\n")
                f.write(
                    "This report contains all cases where defendants have empty given_names fields "
                )
                f.write("(excluding intentional surname-only cases).\n\n")
                f.write(f"**Total Issues Found:** {len(first_name_issues)}\n\n")

                # Enhanced categorisation by issue type
                compound_surname_issues = []
                array_format_issues = []
                legal_format_issues = []
                and_separator_issues = []
                slash_separator_issues = []
                semicolon_separator_issues = []
                format_detection_issues = []
                other_issues = []

                for issue in first_name_issues:
                    original = issue["original_value"]
                    processed = issue["processed_value"]

                    # Check for compound surname patterns
                    if any(
                        prefix in original.upper()
                        for prefix in [
                            "VAN DEN",
                            "VAN DER",
                            "DE ",
                            "DA ",
                            "AL ",
                            "VON",
                            "DU ",
                        ]
                    ):
                        compound_surname_issues.append(issue)
                    # Check for array format issues (brackets)
                    elif "[" in original and "]" in original:
                        array_format_issues.append(issue)
                    # Check for AND separator issues
                    elif " AND " in original.upper() or " and " in original:
                        and_separator_issues.append(issue)
                    # Check for slash separator issues
                    elif "/" in original:
                        slash_separator_issues.append(issue)
                    # Check for semicolon separator issues
                    elif ";" in original:
                        semicolon_separator_issues.append(issue)
                    # Check for legal format issues (comma but no other separators)
                    elif "," in original:
                        # Determine if this is a format detection issue by checking processed output
                        if len(processed.split('{"given_names": "", "last_name":')) > 2:
                            format_detection_issues.append(issue)
                        else:
                            legal_format_issues.append(issue)
                    else:
                        other_issues.append(issue)

                f.write("## Issue Categories\n\n")
                f.write(
                    f"- **Compound Surname Issues:** {len(compound_surname_issues)} - Names with prefixes like 'Van Den', 'De', 'Al' not properly detected\n"
                )
                f.write(
                    f"- **Array Format Issues:** {len(array_format_issues)} - Array format ['SURNAME', 'GIVEN NAMES'] incorrectly parsed\n"
                )
                f.write(
                    f"- **Legal Format Issues:** {len(legal_format_issues)} - 'SURNAME, Given Names' format incorrectly split\n"
                )
                f.write(
                    f"- **AND Separator Issues:** {len(and_separator_issues)} - Multiple defendants with 'AND' separator incorrectly handled\n"
                )
                f.write(
                    f"- **Slash Separator Issues:** {len(slash_separator_issues)} - Multiple defendants with '/' separator incorrectly handled\n"
                )
                f.write(
                    f"- **Semicolon Separator Issues:** {len(semicolon_separator_issues)} - Multiple defendants with ';' separator incorrectly handled\n"
                )
                f.write(
                    f"- **Format Detection Issues:** {len(format_detection_issues)} - Single defendant incorrectly detected as multiple defendants\n"
                )
                f.write(
                    f"- **Other Issues:** {len(other_issues)} - Miscellaneous parsing problems\n\n"
                )

                # Write detailed issues with enhanced analysis
                categories = [
                    (
                        "Compound Surname Issues",
                        compound_surname_issues,
                        "These cases involve compound surnames (European/Middle Eastern names) that should be kept together as the last name.",
                    ),
                    (
                        "Array Format Issues",
                        array_format_issues,
                        "These cases involve array format input where the first element should be the surname and second should be given names.",
                    ),
                    (
                        "Legal Format Issues",
                        legal_format_issues,
                        "These cases involve legal format 'SURNAME, Given Names' that are being incorrectly split into multiple defendants.",
                    ),
                    (
                        "AND Separator Issues",
                        and_separator_issues,
                        "These cases involve multiple defendants separated by 'AND' that are not being parsed correctly.",
                    ),
                    (
                        "Slash Separator Issues",
                        slash_separator_issues,
                        "These cases involve multiple defendants separated by '/' that are not being parsed correctly.",
                    ),
                    (
                        "Semicolon Separator Issues",
                        semicolon_separator_issues,
                        "These cases involve multiple defendants separated by ';' that are not being parsed correctly.",
                    ),
                    (
                        "Format Detection Issues",
                        format_detection_issues,
                        "These cases involve single defendants that are incorrectly being detected as multiple defendants.",
                    ),
                    (
                        "Other Issues",
                        other_issues,
                        "These cases involve miscellaneous parsing problems that don't fit other categories.",
                    ),
                ]

                for category_name, issues, description in categories:
                    if issues:
                        f.write(f"## {category_name}\n\n")
                        f.write(f"{description}\n\n")
                        f.write(
                            "| Row ID | Original Value | Processed Value | Last Name | Issue Analysis |\n"
                        )
                        f.write(
                            "|--------|----------------|-----------------|-----------|----------------|\n"
                        )

                        for issue in issues[:50]:  # Limit to first 50 for readability
                            row_id = issue["row_id"]
                            original = issue["original_value"].replace("|", "\\|")
                            processed = issue["processed_value"].replace("|", "\\|")
                            last_name = issue["last_name"].replace("|", "\\|")

                            # Generate issue analysis
                            analysis = DefendantProcessor._analyze_issue_type(
                                original, processed
                            )

                            f.write(
                                f"| {row_id} | {original} | {processed} | {last_name} | {analysis} |\n"
                            )

                        if len(issues) > 50:
                            f.write(f"\n*... and {len(issues) - 50} more cases*\n")
                        f.write("\n")

                print(f"Generated detailed report: {FIRST_NAME_ISSUES_FILE}")

        except Exception as e:
            print(f"Error generating first name issues report: {e}")
            import traceback

            traceback.print_exc()

    @staticmethod
    def _generate_last_name_issues_report(last_name_issues):
        """Generate detailed last_name_issues_README.md report with comprehensive categorisation"""
        try:
            with open(LAST_NAME_ISSUES_FILE, "w", encoding="utf-8") as f:
                f.write("# Last Name Issues Analysis Report\n\n")
                f.write(
                    "This report contains all cases where defendants have empty last_name fields.\n\n"
                )
                f.write(f"**Total Issues Found:** {len(last_name_issues)}\n\n")

                if not last_name_issues:
                    f.write("No last name issues found in the current processing.\n\n")
                    f.write(
                        "This indicates that the surname detection logic is working correctly "
                    )
                    f.write(
                        "and all defendants have been assigned a last_name value.\n\n"
                    )
                    return

                # Enhanced categorisation by issue type
                parsing_errors = []
                format_detection_issues = []
                separator_issues = []
                compound_surname_issues = []
                other_issues = []

                for issue in last_name_issues:
                    original = issue["original_value"]
                    processed = issue["processed_value"]

                    # Check for compound surname patterns
                    if any(
                        prefix in original.upper()
                        for prefix in [
                            "VAN DEN",
                            "VAN DER",
                            "DE ",
                            "DA ",
                            "AL ",
                            "VON",
                            "DU ",
                        ]
                    ):
                        compound_surname_issues.append(issue)
                    # Check for separator issues
                    elif any(sep in original for sep in ["/", ";", " AND ", " and "]):
                        separator_issues.append(issue)
                    # Check for format detection issues
                    elif "," in original:
                        format_detection_issues.append(issue)
                    else:
                        parsing_errors.append(issue)

                f.write("## Issue Categories\n\n")
                f.write(
                    f"- **Parsing Errors:** {len(parsing_errors)} - Basic name parsing failures\n"
                )
                f.write(
                    f"- **Format Detection Issues:** {len(format_detection_issues)} - Legal format detection problems\n"
                )
                f.write(
                    f"- **Separator Issues:** {len(separator_issues)} - Multiple defendant separator handling problems\n"
                )
                f.write(
                    f"- **Compound Surname Issues:** {len(compound_surname_issues)} - Compound surname detection failures\n"
                )
                f.write(
                    f"- **Other Issues:** {len(other_issues)} - Miscellaneous last name assignment problems\n\n"
                )

                # Write detailed issues with enhanced analysis
                categories = [
                    (
                        "Parsing Errors",
                        parsing_errors,
                        "These cases involve basic name parsing failures where no surname could be extracted.",
                    ),
                    (
                        "Format Detection Issues",
                        format_detection_issues,
                        "These cases involve legal format detection problems where surnames are not properly identified.",
                    ),
                    (
                        "Separator Issues",
                        separator_issues,
                        "These cases involve multiple defendant separator handling where surnames are lost in processing.",
                    ),
                    (
                        "Compound Surname Issues",
                        compound_surname_issues,
                        "These cases involve compound surname detection failures where multi-word surnames are not preserved.",
                    ),
                    (
                        "Other Issues",
                        other_issues,
                        "These cases involve miscellaneous last name assignment problems.",
                    ),
                ]

                for category_name, issues, description in categories:
                    if issues:
                        f.write(f"## {category_name}\n\n")
                        f.write(f"{description}\n\n")
                        f.write(
                            "| Row ID | Original Value | Processed Value | Given Names | Issue Analysis |\n"
                        )
                        f.write(
                            "|--------|----------------|-----------------|-------------|----------------|\n"
                        )

                        for issue in issues[:50]:  # Limit to first 50 for readability
                            row_id = issue["row_id"]
                            original = issue["original_value"].replace("|", "\\|")
                            processed = issue["processed_value"].replace("|", "\\|")
                            given_names = issue["given_names"].replace("|", "\\|")

                            # Generate issue analysis
                            analysis = DefendantProcessor._analyze_last_name_issue(
                                original, processed
                            )

                            f.write(
                                f"| {row_id} | {original} | {processed} | {given_names} | {analysis} |\n"
                            )

                        if len(issues) > 50:
                            f.write(f"\n*... and {len(issues) - 50} more cases*\n")
                        f.write("\n")

                print(f"Generated detailed report: {LAST_NAME_ISSUES_FILE}")

        except Exception as e:
            print(f"Error generating last name issues report: {e}")
            import traceback

            traceback.print_exc()


# Global processor instance
_processor = None


def get_processor():
    """Get the global processor instance"""
    global _processor
    if _processor is None:
        _processor = DefendantProcessor()
    return _processor


def process_value(input_value: Any, row_id: int, transformation_logger) -> str:
    """Main entry point"""
    processor = get_processor()
    return processor.process_value(input_value, row_id, transformation_logger)


def post_process():
    """Post-processing function called by orchestrator after domain processing completes"""
    print("\n" + "=" * 60)
    print("RUNNING DEFENDANTS POST-PROCESSING ANALYSIS - FIXED VERSION")
    print("=" * 60)
    DefendantProcessor.analyze_defendants_csv()


if __name__ == "__main__":
    print("Testing FIXED Defendants Logic...")

    test_cases = [
        # Compound surname cases
        (437, "VAN DEN BELTON, DOVRIC"),
        (536, "DE ASHWICK, ORSON"),
        (647, "DE CALMONT, Yvette"),
        (1022, "DA HALSTEAD, Cairic"),
        (1855, "VAN DER FENMONT, John"),
        (1860, "VAN DER KENHOLM, Caiwen"),
        (3635, "AL HALMONT, Jasper"),
        # Slash patterns
        (419, "DUNMONT, EDMUND CLEO/VAN DEN BELFORD, DOVRIC/SMITH, ISOLDE CAIANA"),
        (424, "DUNMONT, EDMUND CLEO/DAN DEN BELFORD, DOVRIC/SMITH, ISOLDE CAIANA"),
        # AND separator cases
        (480, "ELMONT, WINIFRED BELHOLM  AND FENLEY, HALGRAVE MARY"),
        (788, "JONES, Bexis Fenella and HALHURST, Sabine Winifred"),
        (832, "GARHOLM, Thea Isolde and GARHOLM, Eamon Delphine"),
        # Multiple comma cases
        (
            835,
            "GARFORD, Mark Nicholas, HALLEY, Evander Elfield, and DALE, Corin Rowena",
        ),
        (
            836,
            "FENDALE, Caiis Winifred, LANLEY, Hector Elfield, and DUNGRAVE, Ingrid Caio",
        ),
    ]

    class MockLogger:
        def log_transformation_issue(self, **kwargs):
            pass

    mock_logger = MockLogger()
    processor = get_processor()

    for row_id, test_case in test_cases:
        print(f"\nTest Row {row_id}: '{test_case}'")
        result = process_value(test_case, row_id, mock_logger)
        print(f"Result: {result}")

        # Parse and display more readable format
        try:
            defendants = json.loads(result)
            print("Parsed defendants:")
            for i, defendant in enumerate(defendants, 1):
                given = defendant.get("given_names", "")
                last = defendant.get("last_name", "")
                full_name = f"{given} {last}".strip()
                print(f"  {i}. {full_name} (given: '{given}', last: '{last}')")
        except Exception:
            print("  (Could not parse result)")

    print(f"\nCheck {DOMAIN_PATH}/debug.txt for detailed processing!")
