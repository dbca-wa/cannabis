"""Regex-based field extraction and date parsing for police forms."""

import re
from datetime import datetime

from cases.ocr import (
    ExtractedField,
    ExtractedItem,
    ExtractedOfficer,
    ExtractionResult,
)
from cases.ocr.content_type_map import map_content_type


def parse_date(raw_text: str) -> tuple[str | None, float]:
    """Parse date strings in common Australian police form formats.

    Supported formats:
      - DD-MMM-YYYY  (e.g. "05-MAR-2025")
      - MMM. DD, YYYY (e.g. "Mar. 19, 2025")
      - MMM DD, YYYY  (e.g. "Mar 19, 2025")
      - DD/MM/YYYY   (e.g. "19/03/2025")

    Returns (iso_date_string, confidence). If the string cannot be
    parsed, returns (None, 0.0).
    """
    if not raw_text or not raw_text.strip():
        return (None, 0.0)

    text = raw_text.strip()

    formats = [
        (r"^\d{1,2}-[A-Za-z]{3}-\d{4}$", "%d-%b-%Y"),
        (r"^\d{1,2}/\d{1,2}/\d{4}$", "%d/%m/%Y"),
    ]

    for pattern, fmt in formats:
        if re.match(pattern, text):
            try:
                dt = datetime.strptime(text, fmt)
                return (dt.strftime("%Y-%m-%d"), 0.9)
            except ValueError:
                continue

    # Handle "MMM. DD, YYYY" or "MMM DD, YYYY" or "MMM DD YYYY"
    mmm_match = re.match(r"^([A-Za-z]{3})\.?\s+(\d{1,2}),?\s+(\d{4})$", text)
    if mmm_match:
        try:
            normalised = (
                f"{mmm_match.group(1)} {mmm_match.group(2)} " f"{mmm_match.group(3)}"
            )
            dt = datetime.strptime(normalised, "%b %d %Y")
            return (dt.strftime("%Y-%m-%d"), 0.9)
        except ValueError:
            pass

    return (None, 0.0)


def parse_quantity(raw_text: str) -> int | None:
    """Parse compound quantity formats into a total unit count.

    Handles formats like "1 X 14 Units" → 14, "2 X 5 Units" → 10.
    Falls back to parsing a bare integer if no compound format is found.
    Returns None if the string cannot be parsed.
    """
    if not raw_text or not raw_text.strip():
        return None

    text = raw_text.strip()

    compound = re.match(r"(\d+)\s*[xX×]+\s*(\d+)\s*(?:units?)?", text, re.IGNORECASE)
    if compound:
        return int(compound.group(1)) * int(compound.group(2))

    bare = re.match(r"^(\d+)$", text)
    if bare:
        return int(bare.group(1))

    return None


class PoliceFormParser:
    """Extracts structured fields from Tesseract OCR text.

    Patterns are intentionally loose to handle OCR artefacts like
    misread characters, missing whitespace, and garbled highlighted text.
    """

    def calculate_field_confidence(
        self, field_text: str, word_confidences: list[dict]
    ) -> float:
        """Derive per-field confidence by averaging word-level scores.

        Matches words from the extracted field against Tesseract's
        per-word output and returns the mean confidence in [0.0, 1.0].
        """
        if not field_text or not word_confidences:
            return 0.0

        field_words = field_text.lower().split()
        scores = []
        for wc in word_confidences:
            if wc.get("text", "").lower() in field_words and wc.get("conf", -1) >= 0:
                scores.append(wc["conf"] / 100.0)

        return sum(scores) / len(scores) if scores else 0.5

    def _clean_badge(self, raw_badge: str) -> str:
        """Fix common OCR errors in badge numbers.

        Tesseract sometimes reads 'PD' as 'PDI' or 'PDl' (letter I or l
        inserted). Only strip the extra character when it's a letter,
        not a digit — 'PD10204' is valid, 'PDI0204' is not.
        """
        # PDI or PDl followed by digits → strip the I/l
        return re.sub(r"^PD([Il])", "PD", raw_badge, flags=re.IGNORECASE)

    @staticmethod
    def _normalise_seal(raw: str) -> str:
        """Normalise a seal tag number to the T + 6 digits format.

        OCR often misreads the 'T' prefix as '1' or '7', producing
        strings like '1107381' or '7107390' instead of 'T107381' or
        'T107390'. If the raw string starts with T, keep it. Otherwise
        replace the first character with T (it's the misread prefix).
        """
        if not raw:
            return ""
        if raw.startswith("T"):
            return raw
        # First char is a misread T — replace it
        return f"T{raw[1:]}"

    def _make_field(self, value: str, word_confidences: list[dict]) -> ExtractedField:
        """Build an ExtractedField with calculated confidence."""
        return ExtractedField(
            value=value,
            raw_text=value,
            confidence=self.calculate_field_confidence(value, word_confidences),
        )

    def _extract_officer_from_text(
        self, ocr_text: str, word_confidences: list[dict]
    ) -> ExtractedOfficer:
        """Extract the conveying officer details.

        Tries the 'Conveying Officer' header line first (best with
        pre-processing), then falls back to the 'Received from' line
        at the bottom. Handles OCR artefacts like periods instead of
        commas and garbled PD prefixes.
        """
        patterns = [
            # "Conveying Officer - Unsworn Officer PD57706 SURNAME, FirstName"
            r"Conveying\s+Officer\s*[-–—]?\s*(?:Unsworn|Sworn)?\s*Officer\s+"
            r"(PD[I1l]?\d{4,6})\s+"
            r"([A-Z][A-Z\s'-]+?)[,.\s]+(\w+)",
            # "Received from Unsworn Officer PD57706 SURNAME. FirstName"
            r"Received\s+from\s+.*?(?:Officer)\s+"
            r"(PD[I1l]?\d{4,6})\s+"
            r"([A-Z][A-Z\s'-]+?)[,.\s]+(\w+)",
        ]
        for pat in patterns:
            match = re.search(pat, ocr_text, re.IGNORECASE)
            if match:
                raw_badge = match.group(1).strip()
                badge = self._clean_badge(raw_badge)
                surname = match.group(2).strip()
                first_name = match.group(3).strip()
                full_name = f"{surname}, {first_name}"
                return ExtractedOfficer(
                    name=self._make_field(full_name, word_confidences),
                    badge_number=self._make_field(badge, word_confidences),
                )
        return ExtractedOfficer()

    def _extract_on_behalf_officer(
        self, ocr_text: str, word_confidences: list[dict]
    ) -> ExtractedOfficer:
        """Extract the 'On Behalf of' officer from the header section.

        This line is often garbled by OCR due to highlighting. We try
        multiple loose patterns to catch it.
        """
        patterns = [
            # "On Behalf of - Sworn Officer PD10204 VOLPI, Frederic"
            r"On\s+Behalf\s+of\s*[-–—:]?\s*(?:Sworn|Unsworn)?\s*Officer\s+"
            r"(PD[I1l]?\d{4,6})\s+([A-Z][A-Z\s'-]+?)[,.\s]+(\w+)",
            # Looser: PD number followed by name anywhere near "Behalf"
            r"Behalf.*?(PD[I1l]?\d{4,6})\s+([A-Z][A-Z\s'-]+?)[,.\s]+(\w+)",
        ]
        for pat in patterns:
            match = re.search(pat, ocr_text, re.IGNORECASE)
            if match:
                raw_badge = match.group(1).strip()
                badge = self._clean_badge(raw_badge)
                surname = match.group(2).strip()
                first_name = match.group(3).strip()
                full_name = f"{surname}, {first_name}"
                return ExtractedOfficer(
                    name=self._make_field(full_name, word_confidences),
                    badge_number=self._make_field(badge, word_confidences),
                )
        return ExtractedOfficer()

    def _extract_items_table(
        self, ocr_text: str, word_confidences: list[dict]
    ) -> list[ExtractedItem]:
        """Parse items table rows from OCR text.

        The table is often garbled — rows may split across lines, seal
        numbers lose their 'T' prefix, and special characters appear.
        We collect all property-ref-starting lines and any orphaned
        continuation data, then parse each assembled row.
        """
        items = []

        # Strip junk characters that OCR inserts
        cleaned = re.sub(r"[~()\[\]{}|+]", "", ocr_text)
        lines = [ln.strip() for ln in cleaned.split("\n") if ln.strip()]

        # First pass: identify property-ref lines and orphaned data
        ref_pattern = re.compile(r"^\d{6}\s+\d{4}\s+\d{4,5}/\d{4}")
        row_lines: list[str] = []
        orphan_data: list[str] = []

        for line in lines:
            if ref_pattern.match(line):
                row_lines.append(line)
            elif re.match(
                r"^(?:Plant|Seed|Cutting|Stalk|Seedling|Head|Rootball)\b",
                line,
                re.IGNORECASE,
            ):
                orphan_data.append(line)

        # Second pass: for each row, try to find its type + seal if missing
        for row in row_lines:
            ref_match = re.match(r"(\d{6}\s+\d{4}\s+\d{4,5}/\d{4,5})", row)
            if not ref_match:
                continue
            prop_ref = ref_match.group(1).strip()
            rest = row[ref_match.end() :]

            qty_match = re.search(
                r"(\d+)\s*[xX×]+\s*(\d+)\s*[-—]?\s*Units?",
                rest,
                re.IGNORECASE,
            )
            if not qty_match:
                continue
            qty_n = int(qty_match.group(1))
            qty_m = int(qty_match.group(2))
            quantity = qty_n * qty_m
            raw_qty = f"{qty_n} X {qty_m} Units"
            rest2 = rest[qty_match.end() :]

            # Try to find description + type in the same line
            desc_match = re.search(
                r"(Cannabis|Poppy|Mushroom|Tablet)\s+(\w+)",
                rest2,
                re.IGNORECASE,
            )
            description = ""
            item_type = ""
            seal_search_text = ""

            if desc_match:
                description = desc_match.group(1).strip()
                item_type = desc_match.group(2).strip()
                seal_search_text = rest2[desc_match.end() :]
            else:
                # Description might be at end of line without type
                desc_only = re.search(
                    r"(Cannabis|Poppy|Mushroom|Tablet)",
                    rest2,
                    re.IGNORECASE,
                )
                if desc_only:
                    description = desc_only.group(1).strip()
                    # Type is on an orphan line — consume the first one
                    if orphan_data:
                        orphan = orphan_data.pop(0)
                        type_match = re.match(r"(\w+)", orphan)
                        if type_match:
                            item_type = type_match.group(1).strip()
                        # Orphan may also have seal numbers
                        seal_search_text = orphan

            if not description:
                continue

            # Collect all digit sequences that look like seal numbers
            all_seals = re.findall(r"[T7]?\d{5,7}", seal_search_text)

            # Also check the main line remainder for seals
            if not all_seals:
                all_seals = re.findall(r"[T7]?\d{5,7}", rest2)

            seal = self._normalise_seal(all_seals[0]) if len(all_seals) >= 1 else ""
            new_seal = self._normalise_seal(all_seals[1]) if len(all_seals) >= 2 else ""

            items.append(
                ExtractedItem(
                    property_reference=self._make_field(prop_ref, word_confidences),
                    quantity=ExtractedField(
                        value=quantity,
                        raw_text=raw_qty,
                        confidence=self.calculate_field_confidence(
                            raw_qty, word_confidences
                        ),
                    ),
                    item_description=self._make_field(description, word_confidences),
                    item_type=self._make_field(
                        item_type or "unknown", word_confidences
                    ),
                    seal_number=self._make_field(seal, word_confidences),
                    new_seal_number=self._make_field(new_seal, word_confidences),
                    mapped_content_type=map_content_type(
                        description, item_type or "unknown"
                    ),
                )
            )

        return items

    def parse(self, ocr_text: str, word_confidences: list[dict]) -> ExtractionResult:
        """Extract all structured fields from OCR text output.

        Uses flexible regex patterns tuned to handle Tesseract artefacts
        from scanned police drug management forms.
        """
        # Date — look for "Date: DD-MMM-YYYY" pattern
        date_field = ExtractedField()
        date_match = re.search(
            r"Date[:\s]+(\d{1,2}[-/][A-Za-z]{3,}[-/]\d{4}" r"|\d{1,2}/\d{1,2}/\d{4})",
            ocr_text,
            re.IGNORECASE,
        )
        if date_match:
            raw_date = date_match.group(1).strip()
            parsed, conf = parse_date(raw_date)
            date_field = ExtractedField(
                value=parsed or raw_date,
                raw_text=raw_date,
                confidence=conf,
            )

        # Defendant — "Found in possession of: ..."
        defendant_field = ExtractedField()
        def_match = re.search(
            r"Found\s+in\s+possession\s+of[:\s]+(.+)",
            ocr_text,
            re.IGNORECASE,
        )
        if def_match:
            raw_def = def_match.group(1).strip().rstrip(".")
            defendant_field = self._make_field(raw_def, word_confidences)

        # Security Movement Envelope — look for "WW" followed by
        # an alphanumeric code, or the full label with a code after it.
        # The envelope number is often handwritten and may not OCR at all.
        envelope_field = ExtractedField()
        env_patterns = [
            # "WW CC54C977" — the envelope code itself
            r"\bWW\s*([A-Z0-9]{4,}[A-Z0-9\s]*)",
            # "Security Movement Envelope WW CC54C977"
            r"Security\s+Movement\s+Envelope\s+" r"(WW\s*[A-Z0-9]{4,}[A-Z0-9\s]*)",
        ]
        for pat in env_patterns:
            env_match = re.search(pat, ocr_text, re.IGNORECASE)
            if env_match:
                raw_env = env_match.group(1).strip()
                if len(raw_env) >= 4:
                    # Prefix with WW if not already present
                    if not raw_env.upper().startswith("WW"):
                        raw_env = f"WW {raw_env}"
                    envelope_field = self._make_field(raw_env, word_confidences)
                    break

        # Conveying officer — from header line or "Received from" fallback
        conveying = self._extract_officer_from_text(ocr_text, word_confidences)

        # On-behalf-of officer — from header (often garbled)
        on_behalf = self._extract_on_behalf_officer(ocr_text, word_confidences)

        # Division/unit — look for organisational unit names
        division_field = ExtractedField()
        div_patterns = [
            r"((?:Serious\s+&?\s*Organised\s+Crime|Drug\s+Squad|"
            r"Traffic|Forensic|Major\s+Crime|Regional)"
            r"[A-Za-z\s&]*(?:Division|Office|Squad|Unit|Crime))",
            r"of\s+([A-Z][A-Za-z\s&]+?(?:Division|Office|Squad|Unit))",
        ]
        for pat in div_patterns:
            div_match = re.search(pat, ocr_text, re.IGNORECASE)
            if div_match:
                raw_div = div_match.group(1).strip()
                division_field = self._make_field(raw_div, word_confidences)
                break

        # Items table
        items = self._extract_items_table(ocr_text, word_confidences)

        return ExtractionResult(
            date=date_field,
            seizure_date=date_field,
            security_movement_envelope=envelope_field,
            conveying_officer=conveying,
            on_behalf_of_officer=on_behalf,
            division_unit=division_field,
            defendant_name=defendant_field,
            items=items,
        )
