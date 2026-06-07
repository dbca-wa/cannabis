"""OCR subpackage for police form extraction and entity matching."""

from dataclasses import dataclass, field


@dataclass
class ExtractedField:
    """A single extracted field with its raw text and confidence score."""

    value: str | int | None = None
    raw_text: str = ""
    confidence: float = 0.0


@dataclass
class ExtractedOfficer:
    """Officer name and badge number extracted from the form."""

    name: ExtractedField = field(default_factory=ExtractedField)
    badge_number: ExtractedField = field(default_factory=ExtractedField)


@dataclass
class ExtractedItem:
    """A single row from the items table."""

    property_reference: ExtractedField = field(default_factory=ExtractedField)
    quantity: ExtractedField = field(default_factory=ExtractedField)
    item_description: ExtractedField = field(default_factory=ExtractedField)
    item_type: ExtractedField = field(default_factory=ExtractedField)
    seal_number: ExtractedField = field(default_factory=ExtractedField)
    new_seal_number: ExtractedField = field(default_factory=ExtractedField)
    mapped_content_type: str = "unknown"


@dataclass
class ExtractionResult:
    """Complete extraction result from a police form."""

    date: ExtractedField = field(default_factory=ExtractedField)
    seizure_date: ExtractedField = field(default_factory=ExtractedField)
    security_movement_envelope: ExtractedField = field(default_factory=ExtractedField)
    conveying_officer: ExtractedOfficer = field(default_factory=ExtractedOfficer)
    on_behalf_of_officer: ExtractedOfficer = field(default_factory=ExtractedOfficer)
    division_unit: ExtractedField = field(default_factory=ExtractedField)
    defendant_name: ExtractedField = field(default_factory=ExtractedField)
    items: list[ExtractedItem] = field(default_factory=list)


@dataclass
class MatchCandidate:
    """A database record that potentially matches an extracted entity."""

    id: int = 0
    similarity: float = 0.0
    display_data: dict = field(default_factory=dict)


@dataclass
class MatchResult:
    """Entity matching result with ranked candidates."""

    candidates: list[MatchCandidate] = field(default_factory=list)
    match_type: str = "none"  # "exact_badge", "fuzzy_name", "none"
