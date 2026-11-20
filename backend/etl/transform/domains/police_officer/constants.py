"""
Shared constants, enums, and dataclasses for the police officer domain.
"""

from dataclasses import dataclass, field
from enum import Enum
from pathlib import Path
from typing import Dict, List

# Get the directory where this module is located
DOMAIN_PATH = Path(__file__).parent
DEBUG_FILE = DOMAIN_PATH / "debug.txt"
ANALYSIS_REPORT_FILE = DOMAIN_PATH / "analysis_report.md"
RANK_STANDARDISATION_FILE = DOMAIN_PATH / "rank_standardisation.json"

# Path to the raw data for analysis
RAW_DATA_PATH = (
    Path(__file__).parent.parent.parent / "data" / "raw" / "Cannabis2000.csv"
)

# Path to existing organization standardization
ORG_STANDARDISATION_FILE = (
    Path(__file__).parent.parent / "organisation" / "standardisation.json"
)

# Path to police officer domain-specific organization standardization
POLICE_ORG_STANDARDISATION_FILE = DOMAIN_PATH / "organisation_standardisation.json"


class OfficerFormat(Enum):
    """Enumeration of different police officer data formats"""

    EARLY_FORMAT = "early"  # "Senior Constable Name ID on behalf of - Rank Name of Org"
    LATER_FORMAT = (
        "later"  # "Sworn Officer Name ID on behalf of Sworn Officer Name ID of Org"
    )
    SINGLE_OFFICER = "single"  # "Rank Name ID" without "on behalf of"
    CORRUPTED = "corrupted"  # Defendant names or other corruption
    UNKNOWN = "unknown"  # Unrecognized format
    STANDARDIZED = "standard"  # UNKNOWN, INQ CONT, etc.


@dataclass
class AnalysisResult:
    """Container for analysis results"""

    total_entries: int = 0
    format_distribution: Dict[str, int] = field(default_factory=dict)
    corruption_patterns: Dict[str, List[str]] = field(default_factory=dict)
    rank_variations: Dict[str, int] = field(default_factory=dict)
    organization_variations: Dict[str, int] = field(default_factory=dict)
    standardization_needs: Dict[str, List[str]] = field(default_factory=dict)
    unique_patterns: List[str] = field(default_factory=list)
    sample_entries: Dict[str, List[str]] = field(default_factory=dict)
