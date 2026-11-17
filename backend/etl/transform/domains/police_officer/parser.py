"""
Officer string parsing for police officer data.

Contains parsers for early format, later format, and single officer formats.
Handles name parsing, badge number extraction, and officer string splitting.
"""

import json
import logging
import re
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional

from etl.transform.lazy_pandas import is_missing, pd  # noqa: F401

from .constants import DOMAIN_PATH
from .rank_handler import StandardizationEngine


@dataclass
class ParsedOfficer:
    """Container for parsed officer information"""

    name: str = ""
    rank: str = ""
    badge_id: str = ""


@dataclass
class ParsedOfficerData:
    """Container for complete parsed officer data"""

    submitting_officer: ParsedOfficer = field(default_factory=ParsedOfficer)
    requesting_officer: ParsedOfficer = field(default_factory=ParsedOfficer)
    organisation: str = ""
    processing_notes: Dict[str, str] = field(default_factory=dict)

    def to_json(self) -> str:
        """Convert to JSON string for ETL system"""
        return json.dumps(
            {
                "submitting_officer": {
                    "name": self.submitting_officer.name,
                    "rank": self.submitting_officer.rank,
                    "badge_id": self.submitting_officer.badge_id,
                },
                "requesting_officer": {
                    "name": self.requesting_officer.name,
                    "rank": self.requesting_officer.rank,
                    "badge_id": self.requesting_officer.badge_id,
                },
                "organisation": self.organisation,
                "processing_notes": self.processing_notes,
            }
        )


class EarlyFormatParser:
    """Parser for early format police officer data: 'Senior Constable Name ID on behalf of - Rank Name of Organization'"""

    def __init__(self, standardization_engine: StandardizationEngine):
        self.logger = logging.getLogger(__name__)
        self.standardization_engine = standardization_engine

        # Compile regex patterns for early format parsing
        self._compile_patterns()

    def _compile_patterns(self):
        """Compile regex patterns for early format parsing"""

        # TYPO-TOLERANT PATTERNS ("On Behalf Variations")
        # "behlaf" typo pattern for early format
        self.behlaf_pattern = re.compile(
            r"^(Senior\s+Constable|Police\s+Constable|Detective|Sergeant|Constable|Acting\s+\w+(?:\s+\w+)?|P/C|S/C|S/CONSTABLE)\s+"  # Submitting rank
            r"([A-Z][a-z'-]+(?:\s+[A-Z][a-z'-]+)*)\s+"  # Submitting name
            r"(\d+)\s+"  # Submitting badge ID
            r"on\s+behlaf\s+of\s*[-:]?\s*"  # Separator with typo
            r"([A-Z0-9/.]+)\s+"  # Requesting rank (abbreviated)
            r"([A-Z][a-z'-]+(?:\s+[A-Z][a-z'-]+)*)\s+"  # Requesting name
            r"of\s+(.+)$",  # Organization
            re.IGNORECASE,
        )

        # "bahalf" typo pattern for early format
        self.bahalf_pattern = re.compile(
            r"^(Senior\s+Constable|Police\s+Constable|Detective|Sergeant|Constable|Acting\s+\w+(?:\s+\w+)?|P/C|S/C|S/CONSTABLE)\s+"  # Submitting rank
            r"([A-Z][a-z'-]+(?:\s+[A-Z][a-z'-]+)*)\s+"  # Submitting name
            r"(\d+)\s+"  # Submitting badge ID
            r"on\s+bahalf\s+of\s*[-:]?\s*"  # Separator with typo
            r"([A-Z0-9/.]+)\s+"  # Requesting rank (abbreviated)
            r"([A-Z][a-z'-]+(?:\s+[A-Z][a-z'-]+)*)\s+"  # Requesting name
            r"of\s+(.+)$",  # Organization
            re.IGNORECASE,
        )

        # "behalf fo" typo pattern for early format
        self.behalf_fo_pattern = re.compile(
            r"^(Senior\s+Constable|Police\s+Constable|Detective|Sergeant|Constable|Acting\s+\w+(?:\s+\w+)?|P/C|S/C|S/CONSTABLE)\s+"  # Submitting rank
            r"([A-Z][a-z'-]+(?:\s+[A-Z][a-z'-]+)*)\s+"  # Submitting name
            r"(\d+)\s+"  # Submitting badge ID
            r"on\s+behalf\s+fo\s*[-:]?\s*"  # Separator with typo
            r"([A-Z0-9/.]+)\s+"  # Requesting rank (abbreviated)
            r"([A-Z][a-z'-]+(?:\s+[A-Z][a-z'-]+)*)\s+"  # Requesting name
            r"of\s+(.+)$",  # Organization
            re.IGNORECASE,
        )

        # Pattern for missing badge ID in submitting officer: "Sworn Officer Bexana GARFIELD on behalf of Sworn Officer Wilbur LANBY 1821 of Joondalup Detectives."
        self.no_submitting_badge_pattern = re.compile(
            r"^(Sworn\s+Officer|Unsworn\s+Officer)\s+"  # Submitting rank
            r"([A-Z][a-z'-]+(?:\s+[A-Z][a-z'-]+)*)\s+"  # Submitting name (no badge ID)
            r"on\s+behalf\s+of\s+"  # Separator
            r"(Sworn\s+Officer|Unsworn\s+Officer)\s+"  # Requesting rank
            r"([A-Z][a-z'-]+(?:\s+[A-Z][a-z'-]+)*)\s+"  # Requesting name
            r"(\d+|PD\d+)\s+"  # Requesting badge ID
            r"of\s+(.+)$",  # Organization (may end with period)
            re.IGNORECASE,
        )

        # ORIGINAL PATTERNS
        # Main early format pattern: "Senior Constable Calwick 0663 on behalf of - S/C Casimir of Denmark"
        # Also handles variations like "P/C BELCOMBE 45822 ON BEHALF OF: DET KENMORE"
        self.main_pattern = re.compile(
            r"^(Senior\s+Constable|Police\s+Constable|Detective|Sergeant|Constable|Acting\s+\w+(?:\s+\w+)?|P/C|S/C|S/CONSTABLE)\s+"  # Submitting rank (including abbreviations)
            r"([A-Z][a-z'-]+(?:\s+[A-Z][a-z'-]+)*)\s+"  # Submitting name (allow apostrophes and hyphens)
            r"(\d+)\s+"  # Submitting badge ID
            r"on\s+behalf\s+of\s*[-:]?\s*"  # Separator (allow dash, colon, or both)
            r"([A-Z0-9/.]+)\s+"  # Requesting rank (abbreviated, allow numbers for 1/C and periods for DET.)
            r"([A-Z][a-z'-]+(?:\s+[A-Z][a-z'-]+)*)\s+"  # Requesting name (allow apostrophes and hyphens)
            r"of\s+(.+)$",  # Organization
            re.IGNORECASE,
        )

        # Semicolon separator pattern: "Senior Constable Garfield 0322 on behalf of - S/C Dunhurst; of Fremantle TIG"
        self.semicolon_pattern = re.compile(
            r"^(Senior\s+Constable|Police\s+Constable|Detective|Sergeant|Constable|Acting\s+\w+(?:\s+\w+)?|P/C|S/C|S/CONSTABLE|Det)\s+"  # Submitting rank
            r"([A-Z][a-z'-]+(?:\s+[A-Z][a-z'-]+)*)\s+"  # Submitting name (allow hyphens)
            r"(\d+)\s+"  # Submitting badge ID
            r"on\s+behalf\s+of\s*[-:]?\s*"  # Separator (flexible dash/colon)
            r"([A-Z0-9/.]+)\s+"  # Requesting rank (abbreviated, allow periods)
            r"([A-Z][a-z'-]+(?:\s+[A-Z][a-z'-]+)*)\s*;\s*"  # Requesting name followed by semicolon (allow hyphens)
            r"of\s+(.+)$",  # Organization
            re.IGNORECASE,
        )

        # Semicolon without rank pattern: "Senior Constable Garfield Dunhurst; of Fremantle TIG"
        # Garfield is submitting officer, Dunhurst is requesting officer (no rank)
        self.semicolon_no_rank_pattern = re.compile(
            r"^(Senior\s+Constable|Police\s+Constable|Detective|Sergeant|Constable|Acting\s+\w+(?:\s+\w+)?|P/C|S/C|S/CONSTABLE|Det)\s+"  # Submitting rank
            r"([A-Z][a-z']+)\s+"  # Submitting officer name
            r"([A-Z][a-z']+)\s*;\s*"  # Requesting officer name followed by semicolon
            r"of\s+(.+)$",  # Organization
            re.IGNORECASE,
        )

        # Missing rank pattern: "Senior Constable Ursula 7895 on behalf of Ashfield of M/Booka"
        self.missing_rank_pattern = re.compile(
            r"^(Senior\s+Constable|Police\s+Constable|Detective|Sergeant|Constable|Acting\s+\w+(?:\s+\w+)?|P/C|S/C|S/CONSTABLE)\s+"  # Submitting rank
            r"([A-Z][a-z'-]+(?:\s+[A-Z][a-z'-]+)*)\s+"  # Submitting name (allow hyphens)
            r"(\d+)\s+"  # Submitting badge ID
            r"on\s+behalf\s+of\s*[-:]?\s*"  # Separator (flexible dash/colon)
            r"([A-Z][a-z'-]+(?:\s+[A-Z][a-z'-]+)*)\s+"  # Requesting name (no rank, allow hyphens)
            r"of\s+(.+)$",  # Organization
            re.IGNORECASE,
        )

        # Flexible dash pattern: Handle various dash usage variations
        self.flexible_dash_pattern = re.compile(
            r"^(Senior\s+Constable|Police\s+Constable|Detective|Sergeant|Constable|Acting\s+\w+(?:\s+\w+)?|P/C|S/C|S/CONSTABLE)\s+"  # Submitting rank
            r"([A-Z][a-z']+(?:\s+[A-Z][a-z']+)*)\s+"  # Submitting name
            r"on\s+behalf\s+of\s*-?\s*"  # Flexible dash (optional)
            r"([A-Z0-9/]+)\s+"  # Requesting rank
            r"([A-Z][a-z']+(?:\s+[A-Z][a-z']+)*)\s+"  # Requesting name
            r"of\s+(.+)$",  # Organization
            re.IGNORECASE,
        )

        # Complex rank pattern: "Senior Constable Ursula 7895 on behalf of - Det Const 1/C Winifred of Midland Dets"
        self.complex_rank_pattern = re.compile(
            r"^(Senior\s+Constable|Police\s+Constable|Detective|Sergeant|Constable|Acting\s+\w+(?:\s+\w+)?|P/C|S/C|S/CONSTABLE)\s+"  # Submitting rank
            r"([A-Z][a-z']+(?:\s+[A-Z][a-z']+)*)\s+"  # Submitting name
            r"(\d+)\s+"  # Submitting badge ID
            r"on\s+behalf\s+of\s*[-:]?\s*"  # Separator
            r"(Det\s+Const\s+[A-Z0-9/]+|Constable|Det\s+[A-Z0-9/]+|[A-Z0-9/]+)\s+"  # Complex requesting rank
            r"([A-Z][a-z']+(?:\s+[A-Z][a-z']+)*)\s+"  # Requesting name
            r"(\d+\s+)?of\s+(.+)$",  # Optional badge ID and organization
            re.IGNORECASE,
        )

        # Alternative pattern for variations in spacing/punctuation and colon separators
        # Handles "P/C BELCOMBE 45822 ON BEHALF OF-: CONST CALHURST of COLLIE"
        self.alt_pattern = re.compile(
            r"^([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*|P/C|S/C|S/CONSTABLE|CONST)\s+"  # Submitting rank (full or abbreviated)
            r"([A-Z][a-z'-]+(?:\s+[A-Z][a-z'-]+)*)\s+"  # Submitting name (allow apostrophes and hyphens)
            r"(\d+)\s+"  # Submitting badge ID
            r"on\s+behalf\s+of\s*[-:]*\s*"  # Separator (allow dash and/or colon in any combination)
            r"([A-Z0-9/.]+)\s+"  # Requesting rank (allow numbers for 1/C and periods for DET.)
            r"([A-Z][a-z'-]+(?:\s+[A-Z][a-z'-]+)*)\s+"  # Requesting name (allow apostrophes and hyphens)
            r"of\s+(.+)$",  # Organization
            re.IGNORECASE,
        )

        # Specific pattern for dash-colon combination: "P/C BELCOMBE 45822 ON BEHALF OF-: CONST CALHURST of COLLIE"
        self.dash_colon_pattern = re.compile(
            r"^([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*|P/C|S/C|S/CONSTABLE|CONST)\s+"  # Submitting rank
            r"([A-Z][a-z'-]+(?:\s+[A-Z][a-z'-]+)*)\s+"  # Submitting name (allow hyphens)
            r"(\d+)?\s*"  # Submitting badge ID (optional)
            r"on\s+behalf\s+of\s*-:\s*"  # Specific dash-colon separator with optional space
            r"([A-Z0-9/.]+)\s+"  # Requesting rank (allow periods for DET.)
            r"([A-Z][a-z'-]+(?:\s+[A-Z][a-z'-]+)*)\s+"  # Requesting name (allow hyphens)
            r"of\s+(.+)$",  # Organization
            re.IGNORECASE,
        )

        # Pattern for no space after dash-colon: "S/CONSTABLE GARFIELD 0322 ON BEHALF OF-:S/C BELDALE"
        self.no_space_dash_colon_pattern = re.compile(
            r"^([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*|P/C|S/C|S/CONSTABLE|CONST)\s+"  # Submitting rank
            r"([A-Z][a-z'-]+(?:\s+[A-Z][a-z'-]+)*)\s+"  # Submitting name (allow hyphens)
            r"(\d+)\s+"  # Submitting badge ID
            r"on\s+behalf\s+of\s*-:\s*"  # Dash-colon separator
            r"([A-Z0-9/.]+)\s+"  # Requesting rank
            r"([A-Z][a-z'-]+(?:\s+[A-Z][a-z'-]+)*)\s*"  # Requesting name (allow hyphens)
            r"(?:of\s+(.+))?$",  # Optional organization
            re.IGNORECASE,
        )

        # ADDITIONAL PATTERNS

        # Pattern 1: Missing "Officer" in submitting rank (Sworn Bexana GARFIELD 0322 On behalf of...)
        self.missing_officer_pattern = re.compile(
            r"^(Sworn|Unsworn)\s+([A-Z](?:[a-z\'-]*)?(?:\s+[A-Z](?:[a-z\'-]*)?)*)\s+(\d+)\s+[Oo]n\s+behalf\s+of\s+(Sworn|Unsworn)\s+([A-Z](?:[a-z\'-]*)?(?:\s+[A-Z](?:[a-z\'-]*)?)*)\s+(\d+)\s+(?:of\s+)?(.+)",
            re.IGNORECASE,
        )

        # Pattern 2: Typo corrections with no space between badge and name (S/CONATBLE GARFIELD0322)
        self.typo_no_space_pattern = re.compile(
            r"^(S/CONATBLE|S/CONTABLE)\s+([A-Z][a-z\'-]+)(\d+)\s+ON\s+BEHALF\s+OF\s+([A-Z0-9/\.]+)\s+([A-Z](?:[a-z\'-]*)?(?:\s+[A-Z](?:[a-z\'-]*)?)*)\s+of\s+(.+)",
            re.IGNORECASE,
        )

        # Pattern 3: Extra dash before requesting officer (on behalf of -Sworn Officer)
        self.extra_dash_pattern = re.compile(
            r"^([A-Z](?:[a-z\'-]*)?(?:\s+[A-Z](?:[a-z\'-]*)?)*)\s+([A-Z][a-z\'-]+)\s+(\d+)\s+[Oo]n\s+[Bb]ehalf\s+of\s+-([A-Z](?:[a-z\'-]*)?(?:\s+[A-Z](?:[a-z\'-]*)?)*)\s+([A-Z](?:[a-z\'-]*)?(?:\s+[A-Z](?:[a-z\'-]*)?)*)\s+(\d+)\s+(?:of\s+)?(.+)",
            re.IGNORECASE,
        )

        # Pattern 4: Conveying Officer double prefix (Conveying Officer Sworn Officer)
        self.conveying_double_pattern = re.compile(
            r"^Conveying\s+Officer\s+(Sworn|Unsworn)\s+Officer\s+([A-Z](?:[a-z\'-]*)?(?:\s+[A-Z](?:[a-z\'-]*)?)*)\s+(\d+)\s+on\s+(behalaf|behalf)\s+of\s+(Sworn|Unsworn)\s+Officer\s+([A-Z](?:[a-z\'-]*)?(?:\s+[A-Z](?:[a-z\'-]*)?)*)\s+(\d+)\s+(?:of\s+)?(.+)",
            re.IGNORECASE,
        )

        # Pattern for Detective starting format: "Detective Dunstead 9999 on behalf of - 1/C Belgrave of Bunbury"
        self.detective_pattern = re.compile(
            r"^(Detective)\s+"  # Detective rank
            r"([A-Z][a-z']+(?:\s+[A-Z][a-z']+)*)\s+"  # Detective name
            r"(\d+)\s+"  # Detective badge ID
            r"on\s+behalf\s+of\s*[-:]?\s*"  # Separator (allow dash and/or colon)
            r"([A-Z0-9/]+)\s+"  # Requesting rank (allow numbers for 1/C)
            r"([A-Z][a-z']+(?:\s+[A-Z][a-z']+)*)\s+"  # Requesting name
            r"of\s+(.+)$",  # Organization
            re.IGNORECASE,
        )

        # Pattern for "FOR SUPERINTENDENT" format: "SWORN OFFICER BEXANA GARFIELD 0322 FOR SUPERINTENDENT"
        self.superintendent_pattern = re.compile(
            r"^(SWORN\s+OFFICER|UNSWORN\s+OFFICER)\s+"  # Officer rank
            r"([A-Z][a-z']*(?:\s+[A-Z][a-z']*)*)\s+"  # Officer name (allow all caps)
            r"(\d+)\s+"  # Badge ID
            r"FOR\s+SUPERINTENDENT\s*$",  # FOR SUPERINTENDENT ending
            re.IGNORECASE,
        )

        # PATTERNS - High Impact Fixes

        # Pattern 21: Non-standard rank format (Sergeant LANFIELD 0236 on behalf of Senior Constable BELWORTH 45115)
        self.nonstandard_rank_pattern = re.compile(
            r"^(Sergeant|Detective|Constable|Inspector)\s+"  # Non-standard rank
            r"([A-Z][a-z']*(?:\s+[A-Z][a-z']*)*)\s+"  # Name
            r"(\d+)\s+"  # Badge ID
            r"on\s+behalf\s+of\s+"
            r"(Senior\s+Constable|Police\s+Constable|Detective|Sergeant|Constable|First\s+Class\s+Constable)\s+"  # Standard requesting rank
            r"([A-Z][a-z']*(?:\s+[A-Z][a-z']*)*)\s+"  # Requesting name
            r"(\d+)?$",  # Optional requesting badge ID
            re.IGNORECASE,
        )

        # Pattern 22: Abbreviated rank with period + initials (Sgt. C. Kenley of Manjimup Police)
        self.abbrev_initials_pattern = re.compile(
            r"^(Sgt\.|Det\.|Const\.)\s+"  # Abbreviated rank with period
            r"([A-Z]\.\s+[A-Z][a-z']*)\s+"  # Initials + surname
            r"of\s+([A-Z][a-z']*(?:\s+[A-Z][a-z']*)*)\s+Police\s+"  # Organization
            r"on\s+behalf\s+of\s+"
            r"(Senior\s+Constable|Police\s+Constable|Detective|Sergeant|Constable)\s+"  # Requesting rank
            r"([A-Z]\.\s+[A-Z][a-z']*|[A-Z][a-z']*(?:\s+[A-Z][a-z']*)*)$",  # Requesting name (initials or full)
            re.IGNORECASE,
        )

        # Pattern 23: Double rank specification (Sworn Officer Sergeant CALWORTH)
        self.double_rank_pattern = re.compile(
            r"^(Sworn\s+Officer)\s+(Sergeant|Detective|Constable|Inspector)\s+"  # Double rank
            r"([A-Z][a-z']*(?:\s+[A-Z][a-z']*)*)\s+"  # Name
            r"(\d+)\s+"  # Badge ID
            r"on\s+behalf\s+of\s+"
            r"(Senior\s+Constable|Police\s+Constable|Detective|Sergeant|Constable|First\s+Class\s+Constable)\s+"  # Requesting rank
            r"([A-Z][a-z']*(?:\s+[A-Z][a-z']*)*)\s+"  # Requesting name
            r"(\d+)?$",  # Optional requesting badge ID
            re.IGNORECASE,
        )

        # Pattern 24: Zero-padded badge IDs (PD41477, PD2351)
        self.zero_padded_badge_pattern = re.compile(
            r"^(Sworn\s+Officer|Unsworn\s+Officer)\s+"
            r"(PD0\d+)\s+"  # Zero-padded badge ID
            r"([A-Z]+),\s+([A-Z][a-z']*)\s+"  # Lastname, Firstname
            r"On\s+(Behalf|Belhalf)\s+of\s+"  # Handle typo
            r"(Sworn\s+Officer|Unsworn\s+Officer)\s+"
            r"(PD\d+)\s+"  # Regular badge ID
            r"([A-Z]+)\s+([A-Z][a-z']*)"  # Requesting name
            r"(?:\s+of\s+(.+))?$",  # Optional organization
            re.IGNORECASE,
        )

        # Pattern for no dash after "on behalf of": "Senior Constable Garfield 0322 on behalf of S/C Elley-Elworth of Peel IMU"
        self.no_dash_pattern = re.compile(
            r"^(Senior\s+Constable|Police\s+Constable|Detective|Sergeant|Constable|Acting\s+\w+(?:\s+\w+)?|P/C|S/C|S/CONSTABLE)\s+"  # Submitting rank
            r"([A-Z][a-z'-]+(?:\s+[A-Z][a-z'-]+)*)\s+"  # Submitting name (allow hyphens)
            r"(\d+)\s+"  # Submitting badge ID
            r"on\s+behalf\s+of\s+"  # No dash separator, just space
            r"([A-Z0-9/.]+)\s+"  # Requesting rank (allow periods)
            r"([A-Z][a-z'-]+(?:\s+[A-Z][a-z'-]+)*)\s+"  # Requesting name (allow hyphens)
            r"of\s+(.+)$",  # Organization
            re.IGNORECASE,
        )

        # Pattern for hyphenated names: "Senior Constable Garfield 0322 on behalf of - PC Garmont-Gargrave of Geraldton"
        self.hyphenated_names_pattern = re.compile(
            r"^(Senior\s+Constable|Police\s+Constable|Detective|Sergeant|Constable|Acting\s+\w+(?:\s+\w+)?|P/C|S/C|S/CONSTABLE)\s+"  # Submitting rank
            r"([A-Z][a-z'-]+(?:\s+[A-Z][a-z'-]+)*)\s+"  # Submitting name (allow hyphens)
            r"(\d+)\s+"  # Submitting badge ID
            r"on\s+behalf\s+of\s*[-:]?\s*"  # Separator (flexible)
            r"([A-Z0-9/.]+)\s+"  # Requesting rank (allow periods)
            r"([A-Z][a-z'-]+(?:-[A-Z][a-z'-]+)*(?:\s+[A-Z][a-z'-]+)*)\s+"  # Requesting name (explicit hyphen support)
            r"of\s+(.+)$",  # Organization
            re.IGNORECASE,
        )

        # Pattern for no badge ID with periods: "S/CONSTABLE GARFIELD ON BEHALF OF DET. BELHURST of Murdoch"
        self.no_badge_period_pattern = re.compile(
            r"^(Senior\s+Constable|Police\s+Constable|Detective|Sergeant|Constable|Acting\s+\w+(?:\s+\w+)?|P/C|S/C|S/CONSTABLE)\s+"  # Submitting rank
            r"([A-Z][a-z'-]+(?:\s+[A-Z][a-z'-]+)*)\s+"  # Submitting name (no badge ID)
            r"on\s+behalf\s+of\s*[-:]?\s*"  # Separator (flexible)
            r"([A-Z0-9/.]+)\s+"  # Requesting rank (allow periods)
            r"([A-Z][a-z'-]+(?:\s+[A-Z][a-z'-]+)*)\s+"  # Requesting name
            r"of\s+(.+)$",  # Organization
            re.IGNORECASE,
        )

        # Pattern for typos and missing submitting badge ID: "Senior Constable Ashhurst on behalf of - First Class Constable Belby 45203 of TRG"
        self.typo_missing_badge_pattern = re.compile(
            r"^(S/Contable|Senior\s+Constable|Police\s+Constable|Detective|Sergeant|Constable|Acting\s+\w+(?:\s+\w+)?|P/C|S/C|S/CONSTABLE)\s+"  # Submitting rank (typos first)
            r"([A-Z][a-z'-]+(?:\s+[A-Z][a-z'-]+)*)\s+"  # Submitting name (no badge ID)
            r"on\s+behal[af]\s+of\s*[-:]?\s*"  # Separator (allow typos: behalaf)
            r"([A-Z][a-z'-]+(?:\s+[A-Z][a-z'-]+)*)\s+"  # Requesting rank (full rank like "First Class Constable")
            r"([A-Z][a-z'-]+(?:\s+[A-Z][a-z'-]+)*)\s+"  # Requesting name
            r"(\d+)\s+"  # Requesting badge ID
            r"of\s+(.+)$",  # Organization
            re.IGNORECASE,
        )

        # Pattern for typos with submitting badge ID: "S/Contable S Garby 0322 on behalf of PC Elsie of Fremantle"
        self.typo_with_badge_pattern = re.compile(
            r"^(S/Contable|Senior\s+Constable|Police\s+Constable|Detective|Sergeant|Constable|Acting\s+\w+(?:\s+\w+)?|P/C|S/C|S/CONSTABLE)\s+"  # Submitting rank (typos first)
            r"([A-Z](?:[a-z'-]*)?(?:\s+[A-Z](?:[a-z'-]*)?)*)\s+"  # Submitting name (allow single letters)
            r"(\d+)\s+"  # Submitting badge ID
            r"on\s+behal[af]\s+of\s*[-:]?\s*"  # Separator (allow typos: behalaf)
            r"([A-Z0-9/.]+)\s+"  # Requesting rank (abbreviated)
            r"([A-Z](?:[a-z'-]*)?(?:\s+[A-Z](?:[a-z'-]*)?)*)\s+"  # Requesting name (allow single letters)
            r"of\s+(.+)$",  # Organization
            re.IGNORECASE,
        )

    def parse(self, text: str, row_id: int) -> ParsedOfficerData:
        """
        Parse early format police officer data
        Returns ParsedOfficerData with extracted information
        """
        self.logger.debug(f"Row {row_id}: Parsing early format: '{text}'")

        # Try patterns in order of specificity (TYPO PATTERNS FIRST)
        patterns_to_try = [
            # Typo patterns - highest priority
            (self.behlaf_pattern, "behlaf_typo"),
            (self.bahalf_pattern, "bahalf_typo"),
            (self.behalf_fo_pattern, "behalf_fo_typo"),
            # Format gap patterns
            (self.no_submitting_badge_pattern, "no_submitting_badge"),
            # Nonstandard format patterns - high priority
            (self.nonstandard_rank_pattern, "nonstandard_rank"),
            (self.abbrev_initials_pattern, "abbrev_initials"),
            (self.double_rank_pattern, "double_rank"),
            (self.zero_padded_badge_pattern, "zero_padded_badge"),
            (self.missing_officer_pattern, "missing_officer"),
            (self.typo_no_space_pattern, "typo_no_space"),
            (self.extra_dash_pattern, "extra_dash"),
            (self.conveying_double_pattern, "conveying_double"),
            # Existing patterns
            (self.main_pattern, "main"),
            (self.hyphenated_names_pattern, "hyphenated_names"),
            (self.no_dash_pattern, "no_dash"),
            (self.no_badge_period_pattern, "no_badge_period"),
            (self.typo_missing_badge_pattern, "typo_missing_badge"),
            (self.typo_with_badge_pattern, "typo_with_badge"),
            (self.semicolon_pattern, "semicolon"),
            (self.semicolon_no_rank_pattern, "semicolon_no_rank"),
            (self.missing_rank_pattern, "missing_rank"),
            (self.complex_rank_pattern, "complex_rank"),
            (self.flexible_dash_pattern, "flexible_dash"),
            (self.detective_pattern, "detective"),
            (self.dash_colon_pattern, "dash_colon"),
            (self.no_space_dash_colon_pattern, "no_space_dash_colon"),
            (self.alt_pattern, "alternative"),
            (self.superintendent_pattern, "superintendent"),
        ]

        match = None
        pattern_used = None

        for pattern, pattern_name in patterns_to_try:
            match = pattern.match(text)
            if match:
                pattern_used = pattern_name
                self.logger.debug(f"Row {row_id}: Matched {pattern_name} pattern")
                break

        if not match:
            return self._create_error_result("no_pattern_match", text)

        try:
            # TYPO PATTERN HANDLING
            if pattern_used in ["behlaf_typo", "bahalf_typo", "behalf_fo_typo"]:
                # Typo patterns: standard early format extraction
                submitting_rank = match.group(1).strip()
                submitting_name = match.group(2).strip()
                submitting_badge = match.group(3).strip()
                requesting_rank_abbrev = match.group(4).strip()
                requesting_name = match.group(5).strip()
                requesting_badge = (
                    ""  # Early format typically doesn't have requesting badge
                )
                organization = match.group(6).strip()
            # FORMAT GAP PATTERN HANDLING
            elif pattern_used == "no_submitting_badge":
                # Missing badge ID in submitting officer: "Sworn Officer Bexana GARFIELD on behalf of Sworn Officer Wilbur LANBY 1821 of Joondalup Detectives."
                submitting_rank = match.group(1).strip()
                submitting_name = match.group(2).strip()
                submitting_badge = ""  # No badge ID for submitting officer
                requesting_rank_abbrev = match.group(3).strip()
                requesting_name = match.group(4).strip()
                requesting_badge = match.group(5).strip()
                organization = (
                    match.group(6).strip().rstrip(".")
                )  # Remove trailing period
            # PATTERN HANDLING
            elif pattern_used == "nonstandard_rank":
                # Non-standard rank format: Sergeant LANFIELD 0236 on behalf of Senior Constable BELWORTH 45115
                submitting_rank = match.group(1).strip()
                submitting_name = match.group(2).strip()
                submitting_badge = match.group(3).strip()
                requesting_rank_abbrev = match.group(4).strip()
                requesting_name = match.group(5).strip()
                requesting_badge = match.group(6).strip() if match.group(6) else ""
                organization = ""  # No organization in this pattern
            elif pattern_used == "abbrev_initials":
                # Abbreviated rank with initials: Sgt. C. Kenley of Manjimup Police
                submitting_rank = (
                    match.group(1).strip().replace(".", "")
                )  # Remove period
                submitting_name = match.group(2).strip()
                submitting_badge = ""  # No submitting badge in this pattern
                requesting_rank_abbrev = match.group(4).strip()
                requesting_name = match.group(5).strip()
                requesting_badge = ""  # No requesting badge in this pattern
                organization = f"{match.group(3).strip()} Police"
            elif pattern_used == "double_rank":
                # Double rank specification: Sworn Officer Sergeant CALWORTH 1257
                submitting_rank = match.group(
                    2
                ).strip()  # Use the second rank (Sergeant)
                submitting_name = match.group(3).strip()
                submitting_badge = match.group(4).strip()
                requesting_rank_abbrev = match.group(5).strip()
                requesting_name = match.group(6).strip()
                requesting_badge = match.group(7).strip() if match.group(7) else ""
                organization = ""  # No organization in this pattern
            elif pattern_used == "zero_padded_badge":
                # Zero-padded badge IDs: PD41477 ASHMORE, Juniper On Behalf of PD2351 SOUTH Gideon
                submitting_rank = match.group(1).strip()
                submitting_badge = match.group(2).strip()  # Keep zero-padded format
                submitting_name = f"{match.group(4).strip()} {match.group(3).strip()}"  # Firstname Lastname
                requesting_rank_abbrev = match.group(6).strip()
                requesting_badge = match.group(7).strip()
                requesting_name = f"{match.group(9).strip()} {match.group(8).strip()}"  # Firstname Lastname
                organization = match.group(10).strip() if match.group(10) else ""
            elif pattern_used == "missing_officer":
                # Missing "Officer" in submitting rank: Sworn Bexana GARFIELD 0322 On behalf of Sworn Bexo KENWICK 45117
                submitting_rank = (
                    f"{match.group(1).strip()} Officer"  # Add missing "Officer"
                )
                submitting_name = match.group(2).strip()
                submitting_badge = match.group(3).strip()
                requesting_rank_abbrev = (
                    f"{match.group(4).strip()} Officer"  # Add missing "Officer"
                )
                requesting_name = match.group(5).strip()
                requesting_badge = match.group(6).strip()
                organization = match.group(7).strip()
            elif pattern_used == "typo_no_space":
                # Typo with no space: S/CONATBLE GARFIELD0322 ON BEHALF OF 1/C CALSTEAD
                submitting_rank = "Senior Constable"  # Fix S/CONATBLE typo
                submitting_name = match.group(2).strip()
                submitting_badge = match.group(3).strip()
                requesting_rank_abbrev = match.group(4).strip()
                requesting_name = match.group(5).strip()
                requesting_badge = ""  # No requesting badge in this pattern
                organization = match.group(6).strip()
            elif pattern_used == "extra_dash":
                # Extra dash before requesting officer: on behalf of -Sworn Officer
                submitting_rank = match.group(1).strip()
                submitting_name = match.group(2).strip()
                submitting_badge = match.group(3).strip()
                requesting_rank_abbrev = match.group(4).strip()
                requesting_name = match.group(5).strip()
                requesting_badge = match.group(6).strip()
                organization = match.group(7).strip()
            elif pattern_used == "conveying_double":
                # Conveying Officer double prefix: Conveying Officer Sworn Officer Bexana GARFIELD 0322
                submitting_rank = (
                    f"{match.group(1).strip()} Officer"  # Use the Sworn/Unsworn part
                )
                submitting_name = match.group(2).strip()
                submitting_badge = match.group(3).strip()
                requesting_rank_abbrev = (
                    f"{match.group(5).strip()} Officer"  # Use the Sworn/Unsworn part
                )
                requesting_name = match.group(6).strip()
                requesting_badge = match.group(7).strip()
                organization = match.group(8).strip()
            # Handle superintendent pattern differently (no requesting officer)
            elif pattern_used == "superintendent":
                submitting_rank = match.group(1).strip()
                submitting_name = match.group(2).strip()
                submitting_badge = match.group(3).strip()
                requesting_rank_abbrev = ""
                requesting_name = ""
                organization = "SUPERINTENDENT"  # Special organization for superintendent delegation
            elif pattern_used == "missing_rank":
                # Missing rank pattern: no rank for requesting officer
                submitting_rank = match.group(1).strip()
                submitting_name = match.group(2).strip()
                submitting_badge = match.group(3).strip()
                requesting_rank_abbrev = ""  # No rank provided
                requesting_name = match.group(4).strip()
                organization = match.group(5).strip()
            elif pattern_used == "complex_rank":
                # Complex rank pattern: may have badge ID in different position
                submitting_rank = match.group(1).strip()
                submitting_name = match.group(2).strip()
                submitting_badge = match.group(3).strip()
                requesting_rank_abbrev = match.group(4).strip()
                requesting_name = match.group(5).strip()
                # Group 6 might be badge ID, group 7 is organization
                if match.group(6) and match.group(6).strip().isdigit():
                    organization = match.group(7).strip()
                else:
                    organization = match.group(7).strip()
            elif pattern_used == "flexible_dash":
                # Flexible dash pattern: no badge ID
                submitting_rank = match.group(1).strip()
                submitting_name = match.group(2).strip()
                submitting_badge = ""  # No badge ID in this pattern
                requesting_rank_abbrev = match.group(3).strip()
                requesting_name = match.group(4).strip()
                organization = match.group(5).strip()
            elif pattern_used == "semicolon_no_rank":
                # Semicolon without rank pattern: "Senior Constable Garfield Dunhurst; of Fremantle TIG"
                # Garfield is submitting officer, Dunhurst is requesting officer
                submitting_rank = match.group(1).strip()
                submitting_name = match.group(2).strip()  # Garfield
                submitting_badge = ""  # No badge ID in this pattern
                requesting_rank_abbrev = ""  # No rank for requesting officer
                requesting_name = match.group(3).strip()  # Dunhurst
                organization = match.group(4).strip()
            elif pattern_used in ["dash_colon", "no_space_dash_colon"]:
                # Dash-colon patterns: may have optional badge ID
                submitting_rank = match.group(1).strip()
                submitting_name = match.group(2).strip()
                submitting_badge = match.group(3).strip() if match.group(3) else ""
                requesting_rank_abbrev = match.group(4).strip()
                requesting_name = match.group(5).strip()
                organization = match.group(6).strip()
            elif pattern_used == "no_badge_period":
                # No badge ID with periods pattern: "S/CONSTABLE GARFIELD ON BEHALF OF DET. BELHURST of Murdoch"
                submitting_rank = match.group(1).strip()
                submitting_name = match.group(2).strip()
                submitting_badge = ""  # No badge ID
                requesting_rank_abbrev = match.group(3).strip()
                requesting_name = match.group(4).strip()
                organization = match.group(5).strip()
            elif pattern_used == "typo_missing_badge":
                # Typo and missing badge pattern: "Senior Constable Ashhurst on behalf of - First Class Constable Belby 45203 of TRG"
                submitting_rank = match.group(1).strip()
                submitting_name = match.group(2).strip()
                submitting_badge = ""  # No submitting badge ID
                requesting_rank_abbrev = match.group(
                    3
                ).strip()  # Full rank like "First Class Constable"
                requesting_name = match.group(4).strip()
                requesting_badge = match.group(5).strip()  # Requesting officer badge ID
                organization = match.group(6).strip()

                # Fix typos in rank
                if "Contable" in submitting_rank:
                    submitting_rank = submitting_rank.replace("Contable", "Constable")
            elif pattern_used == "typo_with_badge":
                # Typo with badge pattern: "S/Contable S Garby 0322 on behalf of PC Elsie of Fremantle"
                submitting_rank = match.group(1).strip()
                submitting_name = match.group(2).strip()
                submitting_badge = match.group(3).strip()
                requesting_rank_abbrev = match.group(4).strip()
                requesting_name = match.group(5).strip()
                organization = match.group(6).strip()

                # Fix typos in rank
                if "Contable" in submitting_rank:
                    submitting_rank = submitting_rank.replace("Contable", "Constable")
            else:
                # Extract components for regular patterns
                submitting_rank = match.group(1).strip()
                submitting_name = match.group(2).strip()
                submitting_badge = match.group(3).strip()
                requesting_rank_abbrev = match.group(4).strip()
                requesting_name = match.group(5).strip()
                organization = match.group(6).strip()

            # Standardize ranks
            submitting_rank_std = self.standardization_engine.expand_rank_abbreviations(
                submitting_rank
            )
            requesting_rank_std = self.standardization_engine.expand_rank_abbreviations(
                requesting_rank_abbrev
            )

            # Standardize organization
            organization_std = (
                self.standardization_engine.standardize_organization_names(organization)
            )

            # Format badge ID (add PD prefix if numeric only)
            submitting_badge_formatted = self._format_badge_id(submitting_badge)

            # Handle requesting officer badge ID for special patterns
            requesting_badge_formatted = ""
            if pattern_used == "typo_missing_badge":
                requesting_badge_formatted = self._format_badge_id(requesting_badge)
            # For typo_with_badge pattern, no requesting badge ID

            # Create parsed result
            result = ParsedOfficerData(
                submitting_officer=ParsedOfficer(
                    name=submitting_name,
                    rank=submitting_rank_std,
                    badge_id=submitting_badge_formatted,
                ),
                requesting_officer=ParsedOfficer(
                    name=requesting_name,
                    rank=requesting_rank_std,
                    badge_id=requesting_badge_formatted,
                ),
                organisation=organization_std,
                processing_notes={
                    "reason": "successfully_parsed",
                    "format_detected": "early_format",
                },
            )

            self.logger.debug(f"Row {row_id}: Successfully parsed early format")
            return result

        except Exception as e:
            self.logger.error(f"Row {row_id}: Error parsing early format: {str(e)}")
            return self._create_error_result("parsing_error", text, str(e))

    def _format_badge_id(self, badge_id: str) -> str:
        """Format badge ID with PD prefix if needed"""
        if not badge_id:
            return ""

        # If it's just numbers, add PD prefix
        if badge_id.isdigit():
            return f"PD{badge_id}"

        return badge_id

    def _create_error_result(
        self, error_type: str, original_text: str, error_msg: str = ""
    ) -> ParsedOfficerData:
        """Create error result for failed parsing"""
        return ParsedOfficerData(
            submitting_officer=ParsedOfficer(),
            requesting_officer=ParsedOfficer(),
            organisation="",
            processing_notes={
                "reason": error_type,
                "format_detected": "early_format",
                "error_message": error_msg,
                "original_text": original_text[:100],  # Truncate for logging
            },
        )


class LaterFormatParser:
    """Parser for later format police officer data: 'Sworn Officer Name ID on behalf of Sworn Officer Name ID of Organization'"""

    def __init__(self, standardization_engine: StandardizationEngine):
        self.logger = logging.getLogger(__name__)
        self.standardization_engine = standardization_engine

        # Compile regex patterns for later format parsing
        self._compile_patterns()

    def _fix_officer_title_typos(self, rank: str) -> str:
        """Fix common typos in officer titles"""
        rank_lower = rank.lower()

        # Fix common typos
        if "sworn oficer" in rank_lower:
            return "Sworn Officer"
        elif "unsworn oficer" in rank_lower:
            return "Unsworn Officer"
        elif "sworn officer" in rank_lower:
            return "Sworn Officer"
        elif "unsworn officer" in rank_lower:
            return "Unsworn Officer"
        else:
            # Return title case version
            return rank.title()

    def _compile_patterns(self):
        """Compile regex patterns for later format parsing"""

        # TYPO-TOLERANT PATTERNS ("On Behalf Variations")
        # "bahalf" typo pattern
        self.bahalf_pattern = re.compile(
            r"^(Sworn\s+Officer|Unsworn\s+Officer)\s+"  # Submitting rank
            r"(PD\d+|\d+)\s+"  # Submitting badge ID
            r"([A-Z]+),?\s*([A-Z][a-z]+)?\s+"  # Submitting name (flexible)
            r"on\s+bahalf\s+of\s+"  # Separator with typo
            r"(Sworn\s+Officer|Unsworn\s+Officer)\s+"  # Requesting rank
            r"(PD\d+|\d+)\s+"  # Requesting badge ID
            r"([A-Z]+)(?:,?\s*([A-Z][a-z]+))?.*?$",  # Requesting name (flexible, may not have organization)
            re.IGNORECASE,
        )

        # "behlaf" typo pattern
        self.behlaf_pattern = re.compile(
            r"^(Sworn\s+Officer|Unsworn\s+Officer)\s+"  # Submitting rank
            r"(PD\d+|\d+)\s+"  # Submitting badge ID
            r"([A-Z]+),?\s*([A-Z][a-z]+)?\s+"  # Submitting name (flexible)
            r"on\s+behlaf\s+of\s+"  # Separator with typo
            r"(Sworn\s+Officer|Unsworn\s+Officer)\s+"  # Requesting rank
            r"(PD\d+|\d+)\s+"  # Requesting badge ID
            r"([A-Z]+)(?:,?\s*([A-Z][a-z]+))?.*?$",  # Requesting name (flexible)
            re.IGNORECASE,
        )

        # "behalf fo" typo pattern (flexible format)
        self.behalf_fo_pattern = re.compile(
            r"^(Sworn\s+Officer|Unsworn\s+Officer)\s+"  # Submitting rank
            r"([A-Z]+)\s+([A-Z]+)\s+"  # Submitting name (First LAST)
            r"(\d+|PD\d+)\s+"  # Submitting badge ID
            r"on\s+behalf\s+fo\s+"  # Separator with typo
            r"(Sworn\s+Officer|Unsworn\s+Officer)\s+"  # Requesting rank
            r"([A-Z]+)\s+([A-Z]+)\s+"  # Requesting name (First LAST)
            r"(\d+|PD\d+).*?$",  # Requesting badge ID (flexible end)
            re.IGNORECASE,
        )

        # Pattern for names with periods/initials: "Sworn Officer G.N. ASHHURST 8977 on behalf of Sworn Officer Linus GARWICK 45685"
        self.initials_pattern = re.compile(
            r"^(Sworn\s+Officer|Unsworn\s+Officer)\s+"  # Submitting rank
            r"([A-Z]\.[A-Z]\.)\s+"  # Submitting initials (G.N.)
            r"([A-Z]+)\s+"  # Submitting surname (ASHHURST)
            r"(\d+|PD\d+)\s+"  # Submitting badge ID
            r"on\s+behalf\s+of\s+"  # Separator
            r"(Sworn\s+Officer|Unsworn\s+Officer)\s+"  # Requesting rank
            r"([A-Z][a-z]+(?:\s+[A-Z']+)*)\s+"  # Requesting name (allow apostrophes)
            r"(\d+|PD\d+)(?:\s+of\s+(.+))?$",  # Requesting badge ID + optional organization
            re.IGNORECASE,
        )

        # Pattern for multiple periods in names: "Sworn Officer J.P. SMITH 9999 on behalf of Sworn Officer A.B. JONES 8888 of Central District"
        self.multiple_initials_pattern = re.compile(
            r"^(Sworn\s+Officer|Unsworn\s+Officer)\s+"  # Submitting rank
            r"([A-Z]\.[A-Z]\.)\s+"  # Submitting initials (J.P.)
            r"([A-Z]+)\s+"  # Submitting surname (SMITH)
            r"(\d+|PD\d+)\s+"  # Submitting badge ID
            r"on\s+behalf\s+of\s+"  # Separator
            r"(Sworn\s+Officer|Unsworn\s+Officer)\s+"  # Requesting rank
            r"([A-Z]\.[A-Z]\.)\s+"  # Requesting initials (A.B.)
            r"([A-Z]+)\s+"  # Requesting surname (JONES)
            r"(\d+|PD\d+)\s+"  # Requesting badge ID
            r"of\s+(.+)$",  # Organization
            re.IGNORECASE,
        )

        # ORIGINAL PATTERNS
        # Main later format pattern: "Sworn Officer Bexana GARFIELD 0322 on behalf of Sworn Officer Sabine ASHMONT 1848 of West Metropolitan District Office"
        self.main_pattern = re.compile(
            r"^(Sworn\s+Officer|Unsworn\s+Officer)\s+"  # Submitting rank
            r"([A-Z][a-z]+(?:\s+[A-Z]+)*)\s+"  # Submitting name (First LASTNAME format)
            r"(\d+|PD\d+)\s+"  # Submitting badge ID (numeric or PD-prefixed)
            r"on\s+behalf\s+of\s+"  # Separator
            r"(Sworn\s+Officer|Unsworn\s+Officer)\s+"  # Requesting rank
            r"([A-Z][a-z]+(?:\s+[A-Z]+)*)\s+"  # Requesting name (First LASTNAME format)
            r"(\d+|PD\d+)\s+"  # Requesting badge ID
            r"of\s+(.+)$",  # Organization
            re.IGNORECASE,
        )

        # Pattern for comma-separated names: "Unsworn Officer PD87862 FENFIELD, Alex On Behalf of..."
        self.comma_pattern = re.compile(
            r"^(Sworn\s+Officer|Unsworn\s+Officer)\s+"  # Submitting rank
            r"(PD\d+|\d+)\s+"  # Submitting badge ID (PD-prefixed or numeric)
            r"([A-Z]+),\s*([A-Z][a-z]+)\s+"  # Submitting name (LASTNAME, Firstname)
            r"On\s+Behalf\s+[Oo]f\s+"  # Separator (case variations)
            r"(Sworn\s+Officer|Unsworn\s+Officer)\s+"  # Requesting rank
            r"(PD\d+|\d+)\s+"  # Requesting badge ID
            r"([A-Z]+),\s*([A-Z][a-z]+)\s+"  # Requesting name (LASTNAME, Firstname)
            r"of\s+(.+)$",  # Organization
            re.IGNORECASE,
        )

        # Pattern for mixed format: "Sworn Officer Bexana GARFIELD 0322 on behalf of Sworn Officer Bronte LANWICK of..."
        self.mixed_pattern = re.compile(
            r"^(Sworn\s+Officer|Unsworn\s+Officer)\s+"  # Submitting rank
            r"([A-Z][a-z]+(?:\s+[A-Z]+)*)\s+"  # Submitting name (First LASTNAME)
            r"(\d+|PD\d+)\s+"  # Submitting badge ID
            r"on\s+behalf\s+of\s+"  # Separator
            r"(Sworn\s+Officer|Unsworn\s+Officer)\s+"  # Requesting rank
            r"([A-Z][a-z]+(?:\s+[A-Z]+)*)\s+"  # Requesting name (First LASTNAME, no badge ID)
            r"of\s+(.+)$",  # Organization
            re.IGNORECASE,
        )

        # Alternative pattern for "the" prefix in organization: "of the Police Transit Unit"
        self.the_org_pattern = re.compile(
            r"^(Sworn\s+Officer|Unsworn\s+Officer)\s+"  # Submitting rank
            r"([A-Z][a-z]+(?:\s+[A-Z]+)*)\s+"  # Submitting name
            r"(\d+|PD\d+)\s+"  # Submitting badge ID
            r"on\s+behalf\s+of\s+"  # Separator
            r"(Sworn\s+Officer|Unsworn\s+Officer)\s+"  # Requesting rank
            r"([A-Z][a-z]+(?:\s+[A-Z]+)*)\s+"  # Requesting name
            r"(\d+|PD\d+)\s+"  # Requesting badge ID
            r"of\s+the\s+(.+)$",  # Organization with "the" prefix
            re.IGNORECASE,
        )

        # PATTERNS FOR "ON BEHALF VARIATIONS" COMPLEX PATTERNS

        # Pattern for "On Behalf of-" with dash: "Sworn Officer Bexana GARFIELD 0322 On Behalf of-Sworn Officer Dovana CALCOMBE 45716 of Central Metropolitan TIG"
        self.on_behalf_dash_pattern = re.compile(
            r"^(Sworn\s+Officer|Unsworn\s+Officer)\s+"  # Submitting rank
            r"([A-Z][a-z]+)\s+([A-Z]+)\s+"  # Submitting name (First LASTNAME)
            r"(\d+|PD\d+)\s+"  # Submitting badge ID
            r"On\s+Behalf\s+of-"  # Separator with dash (no space before dash)
            r"(Sworn\s+Officer|Unsworn\s+Officer)\s+"  # Requesting rank
            r"([A-Z][a-z]+)\s+([A-Z]+)\s+"  # Requesting name (First LASTNAME)
            r"(\d+|PD\d+)\s+"  # Requesting badge ID
            r"of\s+(.+)$",  # Organization
            re.IGNORECASE,
        )

        # Pattern for "On Behalf of- " with dash and space: "Sworn Officer Bexana GARFIELD 0322 On Behalf of- Sworn Officer Kestrel DUNFIELD 0938 of Organised Crime Investigation"
        self.on_behalf_dash_space_pattern = re.compile(
            r"^(Sworn\s+Officer|Unsworn\s+Officer)\s+"  # Submitting rank
            r"([A-Z][a-z]+)\s+([A-Z]+)\s+"  # Submitting name (First LASTNAME)
            r"(\d+|PD\d+)\s+"  # Submitting badge ID
            r"On\s+Behalf\s+of-\s+"  # Separator with dash and space
            r"(Sworn\s+Officer|Unsworn\s+Officer)\s+"  # Requesting rank
            r"([A-Z][a-z]+)\s+([A-Z]+)\s+"  # Requesting name (First LASTNAME)
            r"(\d+|PD\d+)\s+"  # Requesting badge ID
            r"of\s+(.+)$",  # Organization
            re.IGNORECASE,
        )

        # Pattern for lowercase "shane": "Sworn Officer shane GARFIELD 0322 On Behalf of-Sworn Officer Una CALTON 2177 of OrganIsed Crime Investigation"
        self.lowercase_name_pattern = re.compile(
            r"^(Sworn\s+Officer|Unsworn\s+Officer)\s+"  # Submitting rank
            r"([a-z][a-z]+)\s+([A-Z]+)\s+"  # Submitting name (lowercase first LASTNAME)
            r"(\d+|PD\d+)\s+"  # Submitting badge ID
            r"On\s+Behalf\s+of-"  # Separator with dash
            r"(Sworn\s+Officer|Unsworn\s+Officer)\s+"  # Requesting rank
            r"([A-Z][a-z]+)\s+([A-Z]+)\s+"  # Requesting name (First LASTNAME)
            r"(\d+|PD\d+)\s+"  # Requesting badge ID
            r"of\s+(.+)$",  # Organization
            re.IGNORECASE,
        )

        # Pattern for "Conveying Officer -" delegation: "Conveying Officer - Senior Constable GARFIELD 0322 on behalf of - S/C KENWORTH of Gang Response Unit"
        self.conveying_delegation_pattern = re.compile(
            r"^Conveying\s+Officer\s+-\s+"  # Conveying Officer prefix with dash
            r"(Senior\s+Constable|Police\s+Constable|Detective|Sergeant|Constable)\s+"  # Submitting rank
            r"([A-Z]+)\s+"  # Submitting surname (ALL CAPS)
            r"(\d+|PD\d+)\s+"  # Submitting badge ID
            r"on\s+behalf\s+of\s+-\s+"  # Separator with dash
            r"([A-Z/]+)\s+"  # Requesting rank (may be abbreviated like S/C)
            r"([A-Z]+)\s+"  # Requesting surname (ALL CAPS)
            r"of\s+(.+)$",  # Organization
            re.IGNORECASE,
        )

        # Pattern for "Sworn Officer-" with dash: "Sworn Officer- Verity KENSTEAD 7602 On Behalf of - Sworn Officer Greer GARSTEAD 2609 of South East Metropolitan District Office"
        self.sworn_officer_dash_pattern = re.compile(
            r"^(Sworn\s+Officer|Unsworn\s+Officer)-\s+"  # Officer rank with dash
            r"([A-Z][a-z]+)\s+([A-Z]+)\s+"  # Submitting name (First LASTNAME)
            r"(\d+|PD\d+)\s+"  # Submitting badge ID
            r"On\s+Behalf\s+of\s+-\s+"  # Separator with dash
            r"(Sworn\s+Officer|Unsworn\s+Officer)\s+"  # Requesting rank
            r"([A-Z][a-z]+)\s+([A-Z]+)\s+"  # Requesting name (First LASTNAME)
            r"(\d+|PD\d+)\s+"  # Requesting badge ID
            r"of\s+(.+)$",  # Organization
            re.IGNORECASE,
        )

        # FINAL OPTIMIZATION PATTERNS FOR "ON BEHALF VARIATIONS"

        # Pattern for "Conveying Officer - " with space before dash: "Conveying Officer - Sworn Officer Verity KENSTEAD 7602 on behalf of Sworn Officer Bryn FENCOMBE 1370"
        self.conveying_space_dash_pattern = re.compile(
            r"^Conveying\s+Officer\s+-\s+"  # Conveying Officer - (space before dash)
            r"(Sworn\s+Officer|Unsworn\s+Officer)\s+"  # Submitting rank
            r"([A-Z][a-z]+)\s+([A-Z]+)\s+"  # Submitting name (First LASTNAME)
            r"(\d+|PD\d+)\s+"  # Submitting badge ID
            r"on\s+behalf\s+of\s+"  # Separator
            r"(Sworn\s+Officer|Unsworn\s+Officer)\s+"  # Requesting rank
            r"([A-Z][a-z]+)\s+([A-Z]+)\s+"  # Requesting name (First LASTNAME)
            r"(\d+|PD\d+)(?:\s+of\s+(.+))?$",  # Requesting badge ID + optional organization
            re.IGNORECASE,
        )

        # Pattern for "On Behalf of - " with dash and space: "Sworn Officer Verity KENSTEAD 7602 on Behalf of - Sworn Officer Bexis DUNBY-DUNMORE 45914 of Peel District Office"
        self.on_behalf_dash_space_final_pattern = re.compile(
            r"^(Sworn\s+Officer|Unsworn\s+Officer)\s+"  # Submitting rank
            r"([A-Z][a-z]+)\s+([A-Z]+)\s+"  # Submitting name (First LASTNAME)
            r"(\d+|PD\d+)\s+"  # Submitting badge ID
            r"on\s+Behalf\s+of\s+-\s+"  # Separator with dash and space
            r"(Sworn\s+Officer|Unsworn\s+Officer)\s+"  # Requesting rank
            r"([A-Z][a-z]+(?:-[A-Z]+)*)\s+([A-Z-]+)\s+"  # Requesting name (allow hyphens like DUNBY-DUNMORE)
            r"(\d+|PD\d+)\s+"  # Requesting badge ID
            r"of\s+(.+)$",  # Organization
            re.IGNORECASE,
        )

        # Pattern for "On Behalf 0f" with zero instead of 'o': "Sworn Officer Bexana GARFIELD 0322 on Behalf 0f - Sworn Officer Sabine CALBY 45352 of Organised Crime Divisional Office"
        self.on_behalf_zero_pattern = re.compile(
            r"^(Sworn\s+Officer|Unsworn\s+Officer)\s+"  # Submitting rank
            r"([A-Z][a-z]+)\s+([A-Z]+)\s+"  # Submitting name (First LASTNAME)
            r"(\d+|PD\d+)\s+"  # Submitting badge ID
            r"on\s+Behalf\s+0f\s+-\s+"  # Separator with zero instead of 'o'
            r"(Sworn\s+Officer|Unsworn\s+Officer)\s+"  # Requesting rank
            r"([A-Z][a-z]+)\s+([A-Z]+)\s+"  # Requesting name (First LASTNAME)
            r"(\d+|PD\d+)\s+"  # Requesting badge ID
            r"of\s+(.+)$",  # Organization
            re.IGNORECASE,
        )

        # Pattern for same officer delegation: "First Class Constable KENMORE 45520 on behalf of First Class Constable KENMORE 45520 of Boyup Brook Police Station"
        self.same_officer_pattern = re.compile(
            r"^(First\s+Class\s+Constable|Senior\s+Constable|Police\s+Constable|Detective|Sergeant|Constable)\s+"  # Submitting rank
            r"([A-Z]+)\s+"  # Submitting surname (ALL CAPS)
            r"(\d+|PD\d+)\s+"  # Submitting badge ID
            r"on\s+behalf\s+of\s+"  # Separator
            r"(First\s+Class\s+Constable|Senior\s+Constable|Police\s+Constable|Detective|Sergeant|Constable)\s+"  # Requesting rank (same)
            r"([A-Z]+)\s+"  # Requesting surname (same)
            r"(\d+|PD\d+)\s+"  # Requesting badge ID (same)
            r"of\s+(.+)$",  # Organization
            re.IGNORECASE,
        )

        # Pattern for "Conveying Officer - " with comma names: "Conveying Officer - Sworn Officer PD0101 JONES, David on Behalf of - Sworn Officer PD9038 ELTON, Sabine of Organised Crime Divisional Office"
        self.conveying_comma_names_pattern = re.compile(
            r"^Conveying\s+Officer\s+-\s+"  # Conveying Officer - (space before dash)
            r"(Sworn\s+Officer|Unsworn\s+Officer)\s+"  # Submitting rank
            r"(PD\d+|\d+)\s+"  # Submitting badge ID
            r"([A-Z]+),\s*([A-Z][a-z]+)\s+"  # Submitting name (LASTNAME, Firstname)
            r"on\s+Behalf\s+of\s+-\s+"  # Separator with dash
            r"(Sworn\s+Officer|Unsworn\s+Officer)\s+"  # Requesting rank
            r"(PD\d+|\d+)\s+"  # Requesting badge ID
            r"([A-Z]+),\s*([A-Z][a-z]+)\s+"  # Requesting name (LASTNAME, Firstname)
            r"of\s+(.+)$",  # Organization
            re.IGNORECASE,
        )

        # Pattern for complex rank sequences: "Conveying Officer - Sworn Officer First Class Constable Garmore 45562 on Behalf of - First Class Constable Garmore of Bridgetown Police Station"
        self.complex_rank_pattern = re.compile(
            r"^Conveying\s+Officer\s+-\s+"  # Conveying Officer - prefix
            r"(Sworn\s+Officer)\s+"  # Submitting rank prefix
            r"(First\s+Class\s+Constable|Senior\s+Constable|Police\s+Constable|Detective|Sergeant|Constable)\s+"  # Submitting rank
            r"([A-Z]+)\s+"  # Submitting surname
            r"(\d+|PD\d+)\s+"  # Submitting badge ID
            r"on\s+Behalf\s+of\s+-\s+"  # Separator with dash
            r"(First\s+Class\s+Constable|Senior\s+Constable|Police\s+Constable|Detective|Sergeant|Constable)\s+"  # Requesting rank
            r"([A-Z]+)\s+"  # Requesting surname
            r"of\s+(.+)$",  # Organization
            re.IGNORECASE,
        )

        # Pattern for lowercase officer title: "Sworn officer PD1028 GARCOMBE Felix on behalf of Sworn Officer FENHOLM, Mabel of South Metropolitan District Office"
        self.lowercase_officer_pattern = re.compile(
            r"^(Sworn\s+officer|Unsworn\s+officer)\s+"  # Officer rank (lowercase 'officer')
            r"(PD\d+|\d+)\s+"  # Submitting badge ID
            r"([A-Z]+)\s+([A-Z][a-z]+)\s+"  # Submitting name (LASTNAME Firstname)
            r"on\s+behalf\s+of\s+"  # Separator
            r"(Sworn\s+Officer|Unsworn\s+Officer)\s+"  # Requesting rank
            r"([A-Z]+),\s*([A-Z][a-z]+)\s+"  # Requesting name (LASTNAME, Firstname)
            r"of\s+(.+)$",  # Organization
            re.IGNORECASE,
        )

        # PRODUCTION QUALITY PATTERNS FOR REMAINING FAILURES

        # Pattern 1: Standard delegation format with no comma in submitting name
        # "Sworn Officer PD0785 FENMORE Tristram on behalf of Sworn Officer PD48021 LANWORTH Nerys of South East Metropolitan District Office"
        self.standard_delegation_pattern = re.compile(
            r"^(Sworn\s+Officer|Unsworn\s+Officer)\s+"  # Submitting rank
            r"(PD\d+|\d+)\s+"  # Submitting badge ID
            r"([A-Z]+)\s+([A-Z][a-z]+)\s+"  # Submitting name (LASTNAME Firstname)
            r"on\s+behalf\s+of\s+"  # Separator
            r"(Sworn\s+Officer|Unsworn\s+Officer)\s+"  # Requesting rank
            r"(PD\d+|\d+)\s+"  # Requesting badge ID
            r"([A-Z]+)\s+([A-Z][a-z]+)\s+"  # Requesting name (LASTNAME Firstname)
            r"of\s+(.+)$",  # Organization
            re.IGNORECASE,
        )

        # Pattern 2: Standard delegation format with comma in requesting name
        # "Sworn Officer PD0785 FENMORE Tristram on behalf of Sworn Officer PD47648 KENDALE, Peregrine of South East Metropolitan District"
        self.standard_delegation_comma_pattern = re.compile(
            r"^(Sworn\s+Officer|Unsworn\s+Officer)\s+"  # Submitting rank
            r"(PD\d+|\d+)\s+"  # Submitting badge ID
            r"([A-Z]+)\s+([A-Z][a-z]+)\s+"  # Submitting name (LASTNAME Firstname)
            r"on\s+behalf\s+of\s+"  # Separator
            r"(Sworn\s+Officer|Unsworn\s+Officer)\s+"  # Requesting rank
            r"(PD\d+|\d+)\s+"  # Requesting badge ID
            r"([A-Z]+),\s*([A-Z][a-z]+)\s+"  # Requesting name (LASTNAME, Firstname)
            r"of\s+(.+)$",  # Organization
            re.IGNORECASE,
        )

        # Pattern 3: Space in badge ID
        # "Sworn Officer PD 0785 FENMORE Tristram on behalf of - Sworn Officer PD0938 DUNFIELD Kestrel"
        self.space_badge_id_pattern = re.compile(
            r"^(Sworn\s+Officer|Unsworn\s+Officer)\s+"  # Submitting rank
            r"(PD\s+\d+|\d+)\s+"  # Submitting badge ID with space
            r"([A-Z]+)\s+([A-Z][a-z]+)\s+"  # Submitting name (LASTNAME Firstname)
            r"on\s+behalf\s+of\s+-?\s*"  # Separator (optional dash)
            r"(Sworn\s+Officer|Unsworn\s+Officer)\s+"  # Requesting rank
            r"(PD\d+|\d+)\s+"  # Requesting badge ID
            r"([A-Z]+)\s+([A-Z][a-z]+)\s+"  # Requesting name (LASTNAME Firstname)
            r"(?:of\s+(.+))?$",  # Optional organization
            re.IGNORECASE,
        )

        # Pattern 4: Missing "Sworn Officer" in requesting
        # "Sworn Officer PD1028 GARCOMBE Felix on behalf of PD45741 KENFORD Felix of South East Metropolitan District Office"
        self.missing_requesting_rank_pattern = re.compile(
            r"^(Sworn\s+Officer|Unsworn\s+Officer)\s+"  # Submitting rank
            r"(PD\d+|\d+)\s+"  # Submitting badge ID
            r"([A-Z]+)\s+([A-Z][a-z]+)\s+"  # Submitting name (LASTNAME Firstname)
            r"on\s+behalf\s+of\s+"  # Separator
            r"(PD\d+|\d+)\s+"  # Requesting badge ID (no rank)
            r"([A-Z]+)\s+([A-Z][a-z]+)\s+"  # Requesting name (LASTNAME Firstname)
            r"of\s+(.+)$",  # Organization
            re.IGNORECASE,
        )

        # Pattern 5: Lowercase "officer"
        # "Sworn officer PD1028 GARCOMBE Felix on behalf of Sworn Officer PD2094 ELMORE Bexana of South West Office"
        self.lowercase_officer_delegation_pattern = re.compile(
            r"^(Sworn\s+officer|Unsworn\s+officer)\s+"  # Submitting rank (lowercase 'officer')
            r"(PD\d+|\d+)\s+"  # Submitting badge ID
            r"([A-Z]+)\s+([A-Z][a-z]+)\s+"  # Submitting name (LASTNAME Firstname)
            r"on\s+behalf\s+of\s+"  # Separator
            r"(Sworn\s+Officer|Unsworn\s+Officer)\s+"  # Requesting rank
            r"(PD\d+|\d+)\s+"  # Requesting badge ID
            r"([A-Z]+)\s+([A-Z][a-z]+)\s+"  # Requesting name (LASTNAME Firstname)
            r"of\s+(.+)$",  # Organization
            re.IGNORECASE,
        )

        # Pattern 6: Comma after badge ID in submitting officer
        # "Unsworn Officer PD85192, BELLEY, Dunholm-Duncombe On Behalf of Sworn Officer PD48438 DUNWICK, Aralyn"
        self.comma_after_badge_pattern = re.compile(
            r"^(Sworn\s+Officer|Unsworn\s+Officer)\s+"  # Submitting rank
            r"(PD\d+|\d+),\s+"  # Submitting badge ID with comma
            r"([A-Z]+),\s*([A-Z][a-z-]+)\s+"  # Submitting name (LASTNAME, Firstname with hyphens)
            r"On\s+Behalf\s+of\s+"  # Separator
            r"(Sworn\s+Officer|Unsworn\s+Officer)\s+"  # Requesting rank
            r"(PD\d+|\d+)\s+"  # Requesting badge ID
            r"([A-Z]+),\s*([A-Z][a-z]+)(?:\s+of\s+(.+))?$",  # Requesting name + optional organization
            re.IGNORECASE,
        )

        # Pattern 7: Missing organization
        # "Unsworn Officer PD85862 ELFORD, Saffron On Behalf of Sworn Officer PD45444"
        self.missing_organization_pattern = re.compile(
            r"^(Sworn\s+Officer|Unsworn\s+Officer)\s+"  # Submitting rank
            r"(PD\d+|\d+)\s+"  # Submitting badge ID
            r"([A-Z]+),\s*([A-Z][a-z]+)\s+"  # Submitting name (LASTNAME, Firstname)
            r"On\s+Behalf\s+of\s+"  # Separator
            r"(Sworn\s+Officer|Unsworn\s+Officer)\s+"  # Requesting rank
            r"(PD\d+|\d+)$",  # Requesting badge ID only (no name or organization)
            re.IGNORECASE,
        )

        # Pattern 8: Multi-part surnames
        # "Unsworn Officer PD89190 VAN DER LANTON, Opal"
        self.multi_part_surname_pattern = re.compile(
            r"^(Sworn\s+Officer|Unsworn\s+Officer)\s+"  # Rank
            r"(PD\d+|\d+)\s+"  # Badge ID
            r"([A-Z]+(?:\s+[A-Z]+)*),\s*([A-Z][a-z]+)$",  # Multi-part surname (VAN DER LANTON, Opal)
            re.IGNORECASE,
        )

        # Pattern 9: Complex organization names with typos
        # Handle organization name variations and typos
        self.organization_typo_pattern = re.compile(
            r"^(Sworn\s+Officer|Unsworn\s+Officer)\s+"  # Submitting rank
            r"(PD\d+|\d+)\s+"  # Submitting badge ID
            r"([A-Z]+)\s+([A-Z][a-z]+)\s+"  # Submitting name
            r"on\s+behalf\s+of\s+"  # Separator
            r"(Sworn\s+Officer|Unsworn\s+Officer)\s+"  # Requesting rank
            r"(PD\d+|\d+)\s+"  # Requesting badge ID
            r"([A-Z]+),?\s*([A-Z][a-z]+)\s+"  # Requesting name (optional comma)
            r"(?:fo|of)\s+(.+)$",  # Organization (handle "fo" typo)
            re.IGNORECASE,
        )

        # Pattern 10: PF badge ID format (instead of PD)
        # "Sworn Officer PD1028 GARCOMBE Felix on behalf of Sworn Officer PF0302 KENHURST David of South West District Office"
        self.pf_badge_pattern = re.compile(
            r"^(Sworn\s+Officer|Unsworn\s+Officer)\s+"  # Submitting rank
            r"(PD\d+|\d+)\s+"  # Submitting badge ID
            r"([A-Z]+)\s+([A-Z][a-z]+)\s+"  # Submitting name (LASTNAME Firstname)
            r"on\s+behalf\s+of\s+"  # Separator
            r"(Sworn\s+Officer|Unsworn\s+Officer)\s+"  # Requesting rank
            r"(PF\d+)\s+"  # Requesting badge ID (PF format)
            r"([A-Z]+)\s+([A-Z][a-z]+)\s+"  # Requesting name (LASTNAME Firstname)
            r"of\s+(.+)$",  # Organization
            re.IGNORECASE,
        )

        # Pattern 11: Missing organization in delegation
        # "Unsworn Officer PD85192 BELLEY, Dunholm-Duncombe On Behalf of Sworn Officer PD48438 DUNWICK, Aralyn"
        self.missing_org_delegation_pattern = re.compile(
            r"^(Sworn\s+Officer|Unsworn\s+Officer)\s+"  # Submitting rank
            r"(PD\d+|\d+)\s+"  # Submitting badge ID
            r"([A-Z]+),\s*([A-Z][a-z-]+)\s+"  # Submitting name (LASTNAME, Firstname with hyphens)
            r"On\s+Behalf\s+of\s+"  # Separator
            r"(Sworn\s+Officer|Unsworn\s+Officer)\s+"  # Requesting rank
            r"(PD\d+|\d+)\s+"  # Requesting badge ID
            r"([A-Z]+),\s*([A-Z][a-z-]+)$",  # Requesting name (LASTNAME, Firstname with hyphens, no organization)
            re.IGNORECASE,
        )

        # Pattern 12: Comma after badge ID with missing organization
        # "Unsworn Officer PD85192, BELLEY, Dunholm-Duncombe On Behalf of Sworn Officer PD48438 DUNWICK, Aralyn"
        self.comma_badge_missing_org_pattern = re.compile(
            r"^(Sworn\s+Officer|Unsworn\s+Officer)\s+"  # Submitting rank
            r"(PD\d+|\d+),\s+"  # Submitting badge ID with comma
            r"([A-Z]+),\s*([A-Z][a-z-]+)\s+"  # Submitting name (LASTNAME, Firstname with hyphens)
            r"On\s+Behalf\s+of\s+"  # Separator
            r"(Sworn\s+Officer|Unsworn\s+Officer)\s+"  # Requesting rank
            r"(PD\d+|\d+)\s+"  # Requesting badge ID
            r"([A-Z]+),\s*([A-Z][a-z-]+)$",  # Requesting name (LASTNAME, Firstname with hyphens, no organization)
            re.IGNORECASE,
        )

        # ADDITIONAL FINAL PATTERNS FOR REMAINING EDGE CASES

        # Pattern for missing requesting badge ID: "Sworn Officer PD1028 GARCOMBE, Felix on behalf of Sworn Officer FENHOLM, Mabel of South Metropolitan District Office"
        self.missing_requesting_badge_pattern = re.compile(
            r"^(Sworn\s+Officer|Unsworn\s+Officer)\s+"  # Submitting rank
            r"(PD\d+|\d+)\s+"  # Submitting badge ID
            r"([A-Z]+),\s*([A-Z][a-z]+)\s+"  # Submitting name (LASTNAME, Firstname)
            r"on\s+behalf\s+of\s+"  # Separator
            r"(Sworn\s+Officer|Unsworn\s+Officer)\s+"  # Requesting rank
            r"([A-Z]+),\s*([A-Z][a-z]+)\s+"  # Requesting name (LASTNAME, Firstname) - NO BADGE ID
            r"of\s+(.+)$",  # Organization
            re.IGNORECASE,
        )

        # Pattern for comma after first name: "Sworn Officer PD1028 GARCOMBE Felix, on behalf of - Sworn Officer PD45677 CALHOLM Norbert of State Intelligence Divisional Office"
        self.comma_after_firstname_pattern = re.compile(
            r"^(Sworn\s+Officer|Unsworn\s+Officer)\s+"  # Submitting rank
            r"(PD\d+|\d+)\s+"  # Submitting badge ID
            r"([A-Z]+)\s+([A-Z][a-z]+),\s+"  # Submitting name (LASTNAME Firstname,)
            r"on\s+behalf\s+of\s+-\s+"  # Separator with dash
            r"(Sworn\s+Officer|Unsworn\s+Officer)\s+"  # Requesting rank
            r"(PD\d+|\d+)\s+"  # Requesting badge ID
            r"([A-Z]+)\s+([A-Z][a-z]+)\s+"  # Requesting name (LASTNAME Firstname)
            r"of\s+(.+)$",  # Organization
            re.IGNORECASE,
        )

        # Pattern for no badge ID after first name: "Sworn Officer PD1028 GARCOMBE Felix on behalf of - Sworn Officer PD2331 CALFORD Dulcie of South West District Office"
        self.no_badge_after_firstname_pattern = re.compile(
            r"^(Sworn\s+Officer|Unsworn\s+Officer)\s+"  # Submitting rank
            r"(PD\d+|\d+)\s+"  # Submitting badge ID
            r"([A-Z]+)\s+([A-Z][a-z]+)\s+"  # Submitting name (LASTNAME Firstname)
            r"on\s+behalf\s+of\s+-\s+"  # Separator with dash
            r"(Sworn\s+Officer|Unsworn\s+Officer)\s+"  # Requesting rank
            r"(PD\d+|\d+)\s+"  # Requesting badge ID
            r"([A-Z]+)\s+([A-Z][a-z]+)\s+"  # Requesting name (LASTNAME Firstname)
            r"of\s+(.+)$",  # Organization
            re.IGNORECASE,
        )

        # FINAL OPTIMIZATION PATTERNS

        # Pattern for hyphenated names in delegation: "Unsworn Officer PD85192 BELLEY, Dunholm-Duncombe On Behalf of Sworn Officer PD46576 GARHURST-HALWICK, Yorick"
        self.hyphenated_delegation_pattern = re.compile(
            r"^(Sworn\s+Officer|Unsworn\s+Officer)\s+"  # Submitting rank
            r"(PD\d+|\d+)\s+"  # Submitting badge ID
            r"([A-Z]+),\s*([A-Z][a-z-]+)\s+"  # Submitting name (LASTNAME, Firstname with hyphens)
            r"On\s+Behalf\s+of\s+"  # Separator
            r"(Sworn\s+Officer|Unsworn\s+Officer)\s+"  # Requesting rank
            r"(PD\d+|\d+)\s+"  # Requesting badge ID
            r"([A-Z-]+),\s*([A-Z][a-z-]+)(?:\s+of\s+(.+))?$",  # Requesting name (hyphenated) + optional organization
            re.IGNORECASE,
        )

        # Pattern for comma after badge ID in delegation: "Unsworn Officer PD92706, FENTON, Niall On Behalf of - Sworn Officer PD46959 GARTON, Bryn of Serious & Organised Crime Divisional Office"
        self.comma_badge_delegation_pattern = re.compile(
            r"^(Sworn\s+Officer|Unsworn\s+Officer)\s+"  # Submitting rank
            r"(PD\d+|\d+),\s+"  # Submitting badge ID with comma
            r"([A-Z]+),\s*([A-Z][a-z]+)\s+"  # Submitting name (LASTNAME, Firstname)
            r"On\s+Behalf\s+of\s+-?\s*"  # Separator (optional dash)
            r"(Sworn\s+Officer|Unsworn\s+Officer)\s+"  # Requesting rank
            r"(PD\d+|\d+)\s+"  # Requesting badge ID
            r"([A-Z]+),\s*([A-Z][a-z]+)\s+"  # Requesting name (LASTNAME, Firstname)
            r"of\s+(.+)$",  # Organization
            re.IGNORECASE,
        )

        # Pattern for missing requesting officer name: "Unsworn Officer PD85862 ELFORD, Saffron On Behalf of Sworn Officer PD45444"
        self.missing_requesting_name_pattern = re.compile(
            r"^(Sworn\s+Officer|Unsworn\s+Officer)\s+"  # Submitting rank
            r"(PD\d+|\d+)\s+"  # Submitting badge ID
            r"([A-Z]+),\s*([A-Z][a-z]+)\s+"  # Submitting name (LASTNAME, Firstname)
            r"On\s+Behalf\s+of\s+"  # Separator
            r"(Sworn\s+Officer|Unsworn\s+Officer)\s+"  # Requesting rank
            r"(PD\d+|\d+)$",  # Requesting badge ID only (no name or organization)
            re.IGNORECASE,
        )

        # Pattern for organization typos: "fo" instead of "of", "Divsional" instead of "Divisional"
        self.org_typo_delegation_pattern = re.compile(
            r"^(Sworn\s+Officer|Unsworn\s+Officer)\s+"  # Submitting rank
            r"(PD\d+|\d+)\s+"  # Submitting badge ID
            r"([A-Z]+),\s*([A-Z][a-z-]+)\s+"  # Submitting name (LASTNAME, Firstname with hyphens)
            r"On\s+Behalf\s+of\s+-?\s*"  # Separator (optional dash)
            r"(Sworn\s+Officer|Unsworn\s+Officer)\s+"  # Requesting rank
            r"(PD\d+|\d+)\s+"  # Requesting badge ID
            r"([A-Z]+),\s*([A-Z][a-z]+)\s+"  # Requesting name (LASTNAME, Firstname)
            r"(?:fo|of)\s+(.+)$",  # Organization (handle "fo" typo)
            re.IGNORECASE,
        )

        # Pattern for missing comma in requesting officer name: "Unsworn Officer PD85878 DUNDALE, Araric On Behalf of Sworn Officer PD46956 LE CALFIELD, Benedikt of Serious & Organised Crime Divisional Office"
        self.no_comma_requesting_pattern = re.compile(
            r"^(Sworn\s+Officer|Unsworn\s+Officer)\s+"  # Submitting rank
            r"(PD\d+|\d+)\s+"  # Submitting badge ID
            r"([A-Z]+),\s*([A-Z][a-z]+)\s+"  # Submitting name (LASTNAME, Firstname)
            r"On\s+Behalf\s+of\s+"  # Separator
            r"(Sworn\s+Officer|Unsworn\s+Officer)\s+"  # Requesting rank
            r"(PD\d+|\d+)\s+"  # Requesting badge ID
            r"([A-Z\s]+),\s*([A-Z][a-z]+)\s+"  # Requesting name (multi-word LASTNAME, Firstname)
            r"of\s+(.+)$",  # Organization
            re.IGNORECASE,
        )

        # ADDITIONAL FINAL EDGE CASE PATTERNS

        # Pattern for missing requesting officer first name: "Unsworn Officer PD85192 BELLEY, Dunholm-Duncombe On Behalf of Sworn Officer PD46576 GARHURST-HALWICK"
        self.missing_requesting_firstname_pattern = re.compile(
            r"^(Sworn\s+Officer|Unsworn\s+Officer)\s+"  # Submitting rank
            r"(PD\d+|\d+)\s+"  # Submitting badge ID
            r"([A-Z]+),\s*([A-Z][a-z-]+)\s+"  # Submitting name (LASTNAME, Firstname with hyphens)
            r"On\s+Behalf\s+of\s+"  # Separator
            r"(Sworn\s+Officer|Unsworn\s+Officer)\s+"  # Requesting rank
            r"(PD\d+|\d+)\s+"  # Requesting badge ID
            r"([A-Z-]+)(?:\s+of\s+(.+))?$",  # Requesting surname only (hyphenated) + optional organization
            re.IGNORECASE,
        )

        # Pattern for PDF badge ID: "Unsworn Officer PD86288 ELWICK, Romilly On behalf of - Sworn Officer PDF1760 HALCOMBE, Isolde"
        self.pdf_badge_pattern = re.compile(
            r"^(Sworn\s+Officer|Unsworn\s+Officer)\s+"  # Submitting rank
            r"(PD\d+|\d+)\s+"  # Submitting badge ID
            r"([A-Z]+),\s*([A-Z][a-z]+)\s+"  # Submitting name (LASTNAME, Firstname)
            r"On\s+behalf\s+of\s+-?\s*"  # Separator (case variation, optional dash)
            r"(Sworn\s+Officer|Unsworn\s+Officer)\s+"  # Requesting rank
            r"(PDF\d+)\s+"  # Requesting badge ID (PDF format)
            r"([A-Z]+),\s*([A-Z][a-z]+)(?:\s+of\s+(.+))?$",  # Requesting name + optional organization
            re.IGNORECASE,
        )

        # Pattern for apostrophes in names: "Unsworn Officer PD85862 ELFORD, Saffron On Behalf of Sworn Officer PD49483 FENHURST, Zelda"
        self.apostrophe_names_pattern = re.compile(
            r"^(Sworn\s+Officer|Unsworn\s+Officer)\s+"  # Submitting rank
            r"(PD\d+|\d+)\s+"  # Submitting badge ID
            r"([A-Z]+),\s*([A-Z][a-z]+)\s+"  # Submitting name (LASTNAME, Firstname)
            r"On\s+Behalf\s+of\s+"  # Separator
            r"(Sworn\s+Officer|Unsworn\s+Officer)\s+"  # Requesting rank
            r"(PD\d+|\d+)\s+"  # Requesting badge ID
            r"([A-Z']+),\s*([A-Z][a-z]+)(?:\s+of\s+(.+))?$",  # Requesting name with apostrophe + optional organization
            re.IGNORECASE,
        )

        # Pattern for missing comma in submitting name: "Unsworn Officer PD91359 HALTON Viggo On Behalf of - Sworn Officer PD52274 KENFIELD, Cedric of South Wet District Office"
        self.no_comma_submitting_pattern = re.compile(
            r"^(Sworn\s+Officer|Unsworn\s+Officer)\s+"  # Submitting rank
            r"(PD\d+|\d+)\s+"  # Submitting badge ID
            r"([A-Z]+)\s+([A-Z][a-z]+)\s+"  # Submitting name (LASTNAME Firstname, no comma)
            r"On\s+Behalf\s+of\s+-?\s*"  # Separator (optional dash)
            r"(Sworn\s+Officer|Unsworn\s+Officer)\s+"  # Requesting rank
            r"(PD\d+|\d+)\s+"  # Requesting badge ID
            r"([A-Z]+),\s*([A-Z][a-z]+)\s+"  # Requesting name (LASTNAME, Firstname)
            r"of\s+(.+)$",  # Organization
            re.IGNORECASE,
        )

        # Pattern for complex multi-part names: "Unsworn Officer PD85906 DUNDALE, Bexana On Behalf of Sworn Officer PD48539 FENGRAVE, Oriel, Thaddeus of Serious & Organised Crime Divisional Office"
        self.complex_multipart_names_pattern = re.compile(
            r"^(Sworn\s+Officer|Unsworn\s+Officer)\s+"  # Submitting rank
            r"(PD\d+|\d+)\s+"  # Submitting badge ID
            r"([A-Z]+),\s*([A-Z][a-z]+)\s+"  # Submitting name (LASTNAME, Firstname)
            r"On\s+Behalf\s+of\s+"  # Separator
            r"(Sworn\s+Officer|Unsworn\s+Officer)\s+"  # Requesting rank
            r"(PD\d+|\d+)\s+"  # Requesting badge ID
            r"([A-Z]+),\s*([A-Z][a-z]+),\s*([A-Z][a-z]+)\s+"  # Requesting name (LASTNAME, First, Middle)
            r"of\s+(.+)$",  # Organization
            re.IGNORECASE,
        )

        # Pattern for hyphenated requesting officer names: "Unsworn Officer PD89902 FENBY, Bexwen On Behalf of - Sworn Officer PD53572 KENMONT-KENGRAVE, Rufus of Mandurah District Office"
        self.hyphenated_requesting_pattern = re.compile(
            r"^(Sworn\s+Officer|Unsworn\s+Officer)\s+"  # Submitting rank
            r"(PD\d+|\d+)\s+"  # Submitting badge ID
            r"([A-Z]+),\s*([A-Z][a-z]+)\s+"  # Submitting name (LASTNAME, Firstname)
            r"On\s+Behalf\s+of\s+-?\s*"  # Separator (optional dash)
            r"(Sworn\s+Officer|Unsworn\s+Officer)\s+"  # Requesting rank
            r"(PD\d+|\d+)\s+"  # Requesting badge ID
            r"([A-Z-]+),\s*([A-Z][a-z]+)\s+"  # Requesting name (hyphenated LASTNAME, Firstname)
            r"of\s+(.+)$",  # Organization
            re.IGNORECASE,
        )

        # Pattern for comma after badge ID with organization typo: "Unsworn Officer PD92706, FENTON, Niall On Behalf of - Sworn Officer PD52260 LE KENBY, Halley of Serious & Organised Crime Divsional Office"
        self.comma_badge_org_typo_pattern = re.compile(
            r"^(Sworn\s+Officer|Unsworn\s+Officer)\s+"  # Submitting rank
            r"(PD\d+|\d+),\s+"  # Submitting badge ID with comma
            r"([A-Z]+),\s*([A-Z][a-z]+)\s+"  # Submitting name (LASTNAME, Firstname)
            r"On\s+Behalf\s+of\s+-?\s*"  # Separator (optional dash)
            r"(Sworn\s+Officer|Unsworn\s+Officer)\s+"  # Requesting rank
            r"(PD\d+|\d+)\s+"  # Requesting badge ID
            r"([A-Z\s]+),\s*([A-Z][a-z]+)\s+"  # Requesting name (multi-word LASTNAME, Firstname)
            r"of\s+(.+)$",  # Organization (may have typos)
            re.IGNORECASE,
        )

        # Pattern for multiple officers: "Sworn Officer PD1675 KENTON Cailyn and Sworn Officer PD45117 KENWICK Bexo on behalf of Sworn Offcer PD9613 VAN DER HALWORTH Xanthe of Mirrabooka Police Station"
        self.multiple_officers_pattern = re.compile(
            r"^(Sworn\s+Officer|Unsworn\s+Officer)\s+"  # First submitting rank
            r"(PD\d+|\d+)\s+"  # First submitting badge ID
            r"([A-Z]+)\s+([A-Z][a-z]+)\s+"  # First submitting name (LASTNAME Firstname)
            r"and\s+"  # "and" separator
            r"(Sworn\s+Officer|Unsworn\s+Officer)\s+"  # Second submitting rank
            r"(PD\d+|\d+)\s+"  # Second submitting badge ID
            r"([A-Z]+)\s+([A-Z][a-z]+)\s+"  # Second submitting name (LASTNAME Firstname)
            r"on\s+behalf\s+of\s+"  # Separator
            r"(Sworn\s+Offcer|Sworn\s+Officer|Unsworn\s+Officer)\s+"  # Requesting rank (may have typo)
            r"(PD\d+|\d+)\s+"  # Requesting badge ID
            r"([A-Z\s]+)\s+"  # Requesting name (may have spaces like VAN DER HALWORTH)
            r"([A-Z][a-z]+)\s+"  # Requesting first name
            r"of\s+(.+)$",  # Organization
            re.IGNORECASE,
        )

        # Pattern for single officer with organization: "Sworn Officer PD46956 LE CALFIELD, Benedikt of Serious & Organised Crime Divisional Office"
        self.single_officer_with_org_pattern = re.compile(
            r"^(Sworn\s+Officer|Unsworn\s+Officer)\s+"  # Officer rank
            r"(PD\d+|\d+)\s+"  # Badge ID
            r"([A-Z\s]+),\s*([A-Z][a-z]+)\s+"  # Name (may have spaces like LE CALFIELD, Benedikt)
            r"of\s+(.+)$",  # Organization
            re.IGNORECASE,
        )
        self.sworn_officer_dash_pattern = re.compile(
            r"^(Sworn\s+Officer|Unsworn\s+Officer)-\s+"  # Officer rank with dash
            r"([A-Z][a-z]+)\s+([A-Z]+)\s+"  # Submitting name (First LASTNAME)
            r"(\d+|PD\d+)\s+"  # Submitting badge ID
            r"On\s+Behalf\s+of\s+-\s+"  # Separator with dash
            r"(Sworn\s+Officer|Unsworn\s+Officer)\s+"  # Requesting rank
            r"([A-Z][a-z]+)\s+([A-Z]+)\s+"  # Requesting name (First LASTNAME)
            r"(\d+|PD\d+)\s+"  # Requesting badge ID
            r"of\s+(.+)$",  # Organization
            re.IGNORECASE,
        )

        # Pattern for no space between name and badge: "Senior Constable KENSTEAD7602 ON BEHALF OF Constable HALHOLM 46611 of Clarkson Police Station"
        self.no_space_name_badge_pattern = re.compile(
            r"^(Senior\s+Constable|Police\s+Constable|Detective|Sergeant|Constable)\s+"  # Submitting rank
            r"([A-Z]+)(\d+|PD\d+)\s+"  # Submitting name + badge ID (no space)
            r"ON\s+BEHALF\s+OF\s+"  # Separator (all caps)
            r"(Senior\s+Constable|Police\s+Constable|Detective|Sergeant|Constable)\s+"  # Requesting rank
            r"([A-Z]+)\s+"  # Requesting surname (ALL CAPS)
            r"(\d+|PD\d+)\s+"  # Requesting badge ID
            r"of\s+(.+)$",  # Organization
            re.IGNORECASE,
        )

        # ENHANCED COMMA-SEPARATED LATER FORMAT PATTERNS

        # Pattern for badge ID first, comma-separated name: "Sworn Officer PD0322 GARFIELD, Bexana on Behalf of - Sworn Officer PD46332 ASHSTEAD, Arais of Peel District Office"
        self.badge_first_comma_pattern = re.compile(
            r"^(Sworn\s+Officer|Unsworn\s+Officer)\s+"  # Submitting rank
            r"(PD\d+|\d+)\s+"  # Submitting badge ID first
            r"([A-Z]+),\s*([A-Z][a-z]+)\s+"  # Submitting name (LASTNAME, Firstname)
            r"on\s+[Bb]ehalf\s+of\s*-?\s*"  # Separator (flexible case and dash)
            r"(Sworn\s+Officer|Unsworn\s+Officer)\s+"  # Requesting rank
            r"(PD\d+|\d+)\s+"  # Requesting badge ID
            r"([A-Z]+),\s*([A-Z][a-z]+)\s+"  # Requesting name (LASTNAME, Firstname)
            r"of\s+(.+)$",  # Organization
            re.IGNORECASE,
        )

        # Pattern for multiple spaces in names: "Unsworn Officer PD34456  BELSTEAD, David On Behalf Of Sworn Officer..."
        self.multiple_spaces_comma_pattern = re.compile(
            r"^(Sworn\s+Officer|Unsworn\s+Officer)\s+"  # Submitting rank
            r"(PD\d+|\d+)\s+"  # Submitting badge ID
            r"([A-Z]+),\s*([A-Z][a-z]+)\s+"  # Submitting name (LASTNAME, Firstname)
            r"[Oo]n\s+[Bb]ehalf\s+[Oo]f\s+"  # Separator (case insensitive)
            r"(Sworn\s+Officer|Unsworn\s+Officer)\s+"  # Requesting rank
            r"(PD\d+|\d+)\s+"  # Requesting badge ID
            r"([A-Z]+),\s*([A-Z][a-z]+)(?:\s+of\s+(.+))?$",  # Requesting name + optional organization
            re.IGNORECASE,
        )

        # Pattern for comma after badge ID: "Unsworn Officer PD34456, BELSTEAD, David On Behalf of..."
        self.comma_after_badge_pattern = re.compile(
            r"^(Sworn\s+Officer|Unsworn\s+Officer)\s+"  # Submitting rank
            r"(PD\d+|\d+),\s+"  # Submitting badge ID with comma
            r"([A-Z]+),\s*([A-Z][a-z]+)\s+"  # Submitting name (LASTNAME, Firstname)
            r"[Oo]n\s+[Bb]ehalf\s+[Oo]f\s+"  # Separator (case insensitive)
            r"(Sworn\s+Officer|Unsworn\s+Officer)\s+"  # Requesting rank
            r"(PD\d+|\d+)\s+"  # Requesting badge ID
            r"([A-Z]+),\s*([A-Z][a-z]+)(?:\s+of\s+(.+))?$",  # Requesting name + optional organization
            re.IGNORECASE,
        )

        # Pattern for hyphenated names: "BELLEY, Dunholm-Duncombe"
        self.hyphenated_names_pattern = re.compile(
            r"^(Sworn\s+Officer|Unsworn\s+Officer)\s+"  # Submitting rank
            r"(PD\d+|\d+)\s+"  # Submitting badge ID
            r"([A-Z]+),\s*([A-Z][a-z]+-[A-Z][a-z]+)\s+"  # Submitting name with hyphen (LASTNAME, First-Second)
            r"[Oo]n\s+[Bb]ehalf\s+[Oo]f\s+"  # Separator (case insensitive)
            r"(Sworn\s+Officer|Unsworn\s+Officer)\s+"  # Requesting rank
            r"(PD\d+|\d+)\s+"  # Requesting badge ID
            r"([A-Z]+)(?:,\s*([A-Z][a-z]+-?[A-Z]?[a-z]*))?\s+"  # Requesting name (may have hyphen)
            r"of\s+(.+)$",  # Organization
            re.IGNORECASE,
        )

        # Pattern for space in badge ID: "Sworn Officer PD 7895 URSULA, Sorrel On Behalf of..."
        self.space_in_badge_pattern = re.compile(
            r"^(Sworn\s+Officer|Unsworn\s+Officer)\s+"  # Submitting rank
            r"PD\s+(\d+)\s+"  # Submitting badge ID with space (PD 7895)
            r"([A-Z]+),\s*([A-Z][a-z]+)\s+"  # Submitting name (LASTNAME, Firstname)
            r"[Oo]n\s+[Bb]ehalf\s+[Oo]f\s*-?\s*"  # Separator (flexible case and dash)
            r"(Sworn\s+Officer|Unsworn\s+Officer)\s+"  # Requesting rank
            r"(PD\d+|\d+)\s+"  # Requesting badge ID
            r"([A-Z]+),\s*([A-Z][a-z]+)\s+"  # Requesting name (LASTNAME, Firstname)
            r"of\s+(.+)$",  # Organization
            re.IGNORECASE,
        )

        # Pattern for missing badge number: "Sworn Officer PD GARFIELD, Bexana On Behalf of..."
        self.missing_badge_number_pattern = re.compile(
            r"^(Sworn\s+Officer|Unsworn\s+Officer)\s+"  # Submitting rank
            r"PD\s+"  # PD without number
            r"([A-Z]+),\s*([A-Z][a-z]+)\s+"  # Submitting name (LASTNAME, Firstname)
            r"[Oo]n\s+[Bb]ehalf\s+[Oo]f\s+"  # Separator (case insensitive)
            r"(Sworn\s+Officer|Unsworn\s+Officer)\s+"  # Requesting rank
            r"(PD\d+|\d+)\s+"  # Requesting badge ID
            r"([A-Z]+),\s*([A-Z][a-z]+)(?:\s+of\s+(.+))?$",  # Requesting name + optional organization
            re.IGNORECASE,
        )

        # Pattern for conveying officer with comma-separated names: "Conveying Officer- Sworn Officer PD7895 URSULA, Sorrel on behalf of..."
        self.conveying_comma_pattern = re.compile(
            r"^Conveying\s+Officer-?\s*"  # Conveying Officer prefix (optional dash)
            r"(Sworn\s+Officer|Unsworn\s+Officer)\s+"  # Submitting rank
            r"(PD\d+|\d+)\s+"  # Submitting badge ID
            r"([A-Z]+),\s*([A-Z][a-z]+)\s+"  # Submitting name (LASTNAME, Firstname)
            r"on\s+behalf\s+of\s+"  # Separator
            r"(Sworn\s+Officer|Unsworn\s+Officer)\s+"  # Requesting rank
            r"(PD\d+|\d+)\s+"  # Requesting badge ID
            r"([A-Z]+),\s*([A-Z][a-z]+)\s+"  # Requesting name (LASTNAME, Firstname)
            r"of\s+(.+)$",  # Organization
            re.IGNORECASE,
        )

        # Pattern for mixed case "On Behalf Of": "On Behalf Of" vs "on behalf of"
        self.mixed_case_on_behalf_pattern = re.compile(
            r"^(Sworn\s+Officer|Unsworn\s+Officer)\s+"  # Submitting rank
            r"(PD\d+|\d+)\s+"  # Submitting badge ID
            r"([A-Z]+),\s*([A-Z][a-z]+)\s+"  # Submitting name (LASTNAME, Firstname)
            r"[Oo][Nn]\s+[Bb][Ee][Hh][Aa][Ll][Ff]\s+[Oo][Ff]\s*-?\s*"  # Case insensitive "On Behalf Of"
            r"(Sworn\s+Officer|Unsworn\s+Officer)\s+"  # Requesting rank
            r"(PD\d+|\d+)\s+"  # Requesting badge ID
            r"([A-Z]+),\s*([A-Z][a-z]+)(?:\s+of\s+(.+))?$",  # Requesting name + optional organization
            re.IGNORECASE,
        )

        # ADVANCED DELEGATION AND CONVEYING PATTERNS

        # Pattern for missing organization: "Sworn Officer Bexana GARFIELD 0322 on behalf of Sworn Officer Jethro CALDALE 0066"
        self.missing_organization_pattern = re.compile(
            r"^(Sworn\s+Officer|Unsworn\s+Officer)\s+"  # Submitting rank
            r"([A-Z][a-z]+)\s+([A-Z]+)\s+"  # Submitting name (First LASTNAME)
            r"(\d+|PD\d+)\s+"  # Submitting badge ID
            r"on\s+behalf\s+of\s+"  # Separator
            r"(Sworn\s+Officer|Unsworn\s+Officer)\s+"  # Requesting rank
            r"([A-Z][a-z]+)\s+([A-Z]+)\s+"  # Requesting name (First LASTNAME)
            r"(\d+|PD\d+)$",  # Requesting badge ID (no organization)
            re.IGNORECASE,
        )

        # Pattern for "Conveying Officer-" with dash: "Conveying Officer- Sworn Officer Bexana GARFIELD 0322 on behalf of Sworn Officer Silas ELGRAVE 45604 of Organised Crime Divisional Office"
        self.conveying_officer_dash_pattern = re.compile(
            r"^Conveying\s+Officer-\s+"  # Conveying Officer with dash
            r"(Sworn\s+Officer|Unsworn\s+Officer)\s+"  # Submitting rank
            r"([A-Z][a-z]+)\s+([A-Z]+)\s+"  # Submitting name (First LASTNAME)
            r"(\d+|PD\d+)\s+"  # Submitting badge ID
            r"on\s+behalf\s+of\s+"  # Separator
            r"(Sworn\s+Officer|Unsworn\s+Officer)\s+"  # Requesting rank
            r"([A-Z][a-z]+)\s+([A-Z]+)\s+"  # Requesting name (First LASTNAME)
            r"(\d+|PD\d+)\s+"  # Requesting badge ID
            r"of\s+(.+)$",  # Organization
            re.IGNORECASE,
        )

        # Pattern for "Conveying Officer-" with "On Behalf" case variations: "Conveying Officer- Sworn Officer Verity KENSTEAD 7602 on Behalf of Sworn Officer John DUNWORTH 0219"
        self.conveying_officer_case_pattern = re.compile(
            r"^Conveying\s+Officer-\s+"  # Conveying Officer with dash
            r"(Sworn\s+Officer|Unsworn\s+Officer)\s+"  # Submitting rank
            r"([A-Z][a-z]+)\s+([A-Z]+)\s+"  # Submitting name (First LASTNAME)
            r"(\d+|PD\d+)\s+"  # Submitting badge ID
            r"[Oo]n\s+[Bb]ehalf\s+[Oo]f\s+"  # Case insensitive "on Behalf of"
            r"(Sworn\s+Officer|Unsworn\s+Officer)\s+"  # Requesting rank
            r"([A-Z][a-z]+)\s+([A-Z]+)\s+"  # Requesting name (First LASTNAME)
            r"(\d+|PD\d+)\s+"  # Requesting badge ID
            r"of\s+(.+)$",  # Organization
            re.IGNORECASE,
        )

        # Pattern for higher ranks (Inspector, Superintendent): "Sworn Officer Verity KENSTEAD 7602 on behalf of Inspector Dovlyn KENCOMBE 0678 of South West District Office"
        self.higher_ranks_pattern = re.compile(
            r"^(Sworn\s+Officer|Unsworn\s+Officer)\s+"  # Submitting rank
            r"([A-Z][a-z]+)\s+([A-Z]+)\s+"  # Submitting name (First LASTNAME)
            r"(\d+|PD\d+)\s+"  # Submitting badge ID
            r"on\s+behalf\s+of\s+"  # Separator
            r"(Inspector|Superintendent|Chief\s+Inspector|Senior\s+Sergeant|Acting\s+Inspector)\s+"  # Higher requesting rank
            r"([A-Z][a-z]+)\s+([A-Z]+)\s+"  # Requesting name (First LASTNAME)
            r"(\d+|PD\d+)\s+"  # Requesting badge ID
            r"of\s+(.+)$",  # Organization
            re.IGNORECASE,
        )

        # Pattern for typos in officer titles: "Sworn Oficer" (missing 'f'), "Sworn officer" (lowercase)
        self.officer_title_typos_pattern = re.compile(
            r"^(Sworn\s+Oficer|sworn\s+officer|Unsworn\s+Oficer|unsworn\s+officer)\s+"  # Typo in rank
            r"([A-Z][a-z]+)\s+([A-Z]+)\s+"  # Submitting name (First LASTNAME)
            r"(\d+|PD\d+)\s+"  # Submitting badge ID
            r"[Oo]n\s+[Bb]ehalf\s+[Oo]f\s*-?\s*"  # Case insensitive "On Behalf of" with optional dash
            r"(Sworn\s+Officer|sworn\s+officer|Unsworn\s+Officer|unsworn\s+officer)\s+"  # Requesting rank (may have typos)
            r"([A-Z][a-z]+)\s+([A-Z]+)\s+"  # Requesting name (First LASTNAME)
            r"(\d+|PD\d+)\s+"  # Requesting badge ID
            r"of\s+(.+)$",  # Organization
            re.IGNORECASE,
        )

        # Pattern for mixed case variations: "On Behalf Of" vs "on behalf of" vs "On behalf of"
        self.flexible_case_pattern = re.compile(
            r"^(Sworn\s+Officer|Unsworn\s+Officer)\s+"  # Submitting rank
            r"([A-Z][a-z]+)\s+([A-Z]+)\s+"  # Submitting name (First LASTNAME)
            r"(\d+|PD\d+)\s+"  # Submitting badge ID
            r"[Oo][Nn]\s+[Bb]ehalf\s+[Oo]f\s*-?\s*"  # Flexible case "On behalf of" with optional dash
            r"(Sworn\s+Officer|Unsworn\s+Officer)\s+"  # Requesting rank
            r"([A-Z][a-z]+)\s+([A-Z]+)\s+"  # Requesting name (First LASTNAME)
            r"(\d+|PD\d+)\s+"  # Requesting badge ID
            r"of\s+(.+)$",  # Organization
            re.IGNORECASE,
        )

        # Pattern for "Conveying Officer-" with comma-separated names: "Conveying Officer- Sworn Officer PD7895 URSULA, Sorrel On Behalf of- Sworn Officer PD1109 LANLEY, Raymond"
        self.conveying_comma_advanced_pattern = re.compile(
            r"^Conveying\s+Officer-\s+"  # Conveying Officer with dash
            r"(Sworn\s+Officer|Unsworn\s+Officer)\s+"  # Submitting rank
            r"(PD\d+|\d+)\s+"  # Submitting badge ID
            r"([A-Z]+),\s*([A-Z][a-z]+)\s+"  # Submitting name (LASTNAME, Firstname)
            r"[Oo]n\s+[Bb]ehalf\s+[Oo]f\s*-?\s*"  # Case insensitive "On Behalf of" with optional dash
            r"(Sworn\s+Officer|Unsworn\s+Officer)\s+"  # Requesting rank
            r"(PD\d+|\d+)\s+"  # Requesting badge ID
            r"([A-Z]+),\s*([A-Z][a-z]+)\s+"  # Requesting name (LASTNAME, Firstname)
            r"of\s+(.+)$",  # Organization
            re.IGNORECASE,
        )

    def parse(self, text: str, row_id: int) -> ParsedOfficerData:
        """
        Parse later format police officer data
        Returns ParsedOfficerData with extracted information
        """
        self.logger.debug(f"Row {row_id}: Parsing later format: '{text}'")

        # Try patterns in order of specificity (most specific first)
        patterns_to_try = [
            # FINAL OPTIMIZATION PATTERNS (highest priority)
            (self.comma_badge_org_typo_pattern, "comma_badge_org_typo"),
            (self.missing_requesting_firstname_pattern, "missing_requesting_firstname"),
            (self.pdf_badge_pattern, "pdf_badge"),
            (self.apostrophe_names_pattern, "apostrophe_names"),
            (self.no_comma_submitting_pattern, "no_comma_submitting"),
            (self.complex_multipart_names_pattern, "complex_multipart_names"),
            (self.hyphenated_requesting_pattern, "hyphenated_requesting"),
            (self.hyphenated_delegation_pattern, "hyphenated_delegation"),
            (self.comma_badge_delegation_pattern, "comma_badge_delegation"),
            (self.missing_requesting_name_pattern, "missing_requesting_name"),
            (self.org_typo_delegation_pattern, "org_typo_delegation"),
            (self.no_comma_requesting_pattern, "no_comma_requesting"),
            # PRODUCTION QUALITY PATTERNS FOR REMAINING FAILURES
            (self.standard_delegation_pattern, "standard_delegation"),
            (self.standard_delegation_comma_pattern, "standard_delegation_comma"),
            (self.space_badge_id_pattern, "space_badge_id"),
            (self.missing_requesting_rank_pattern, "missing_requesting_rank"),
            (self.lowercase_officer_delegation_pattern, "lowercase_officer_delegation"),
            (self.comma_after_badge_pattern, "comma_after_badge_task20"),
            (self.missing_organization_pattern, "missing_organization_task20"),
            (self.multi_part_surname_pattern, "multi_part_surname"),
            (self.organization_typo_pattern, "organization_typo"),
            (self.pf_badge_pattern, "pf_badge"),
            (self.missing_org_delegation_pattern, "missing_org_delegation"),
            (self.comma_badge_missing_org_pattern, "comma_badge_missing_org"),
            # FINAL OPTIMIZATION PATTERNS FOR "ON BEHALF VARIATIONS"
            (self.missing_requesting_badge_pattern, "missing_requesting_badge"),
            (self.comma_after_firstname_pattern, "comma_after_firstname"),
            (self.no_badge_after_firstname_pattern, "no_badge_after_firstname"),
            (self.multiple_officers_pattern, "multiple_officers"),
            (self.single_officer_with_org_pattern, "single_officer_with_org"),
            (self.conveying_space_dash_pattern, "conveying_space_dash"),
            (self.on_behalf_dash_space_final_pattern, "on_behalf_dash_space_final"),
            (self.on_behalf_zero_pattern, "on_behalf_zero"),
            (self.same_officer_pattern, "same_officer"),
            (self.conveying_comma_names_pattern, "conveying_comma_names"),
            (self.complex_rank_pattern, "complex_rank"),
            (self.lowercase_officer_pattern, "lowercase_officer"),
            # Advanced delegation and conveying patterns
            (self.conveying_officer_dash_pattern, "conveying_officer_dash"),
            (self.conveying_officer_case_pattern, "conveying_officer_case"),
            (self.conveying_comma_advanced_pattern, "conveying_comma_advanced"),
            (self.higher_ranks_pattern, "higher_ranks"),
            (self.officer_title_typos_pattern, "officer_title_typos"),
            (self.flexible_case_pattern, "flexible_case"),
            (self.missing_organization_pattern, "missing_organization"),
            # Enhanced comma-separated later format patterns
            (self.badge_first_comma_pattern, "badge_first_comma"),
            (self.multiple_spaces_comma_pattern, "multiple_spaces_comma"),
            (self.comma_after_badge_pattern, "comma_after_badge"),
            (self.hyphenated_names_pattern, "hyphenated_names"),
            (self.space_in_badge_pattern, "space_in_badge"),
            (self.missing_badge_number_pattern, "missing_badge_number"),
            (self.conveying_comma_pattern, "conveying_comma"),
            (self.mixed_case_on_behalf_pattern, "mixed_case_on_behalf"),
            # Complex "On Behalf Variations" patterns
            (self.on_behalf_dash_pattern, "on_behalf_dash"),
            (self.on_behalf_dash_space_pattern, "on_behalf_dash_space"),
            (self.lowercase_name_pattern, "lowercase_name"),
            (self.conveying_delegation_pattern, "conveying_delegation"),
            (self.sworn_officer_dash_pattern, "sworn_officer_dash"),
            (self.no_space_name_badge_pattern, "no_space_name_badge"),
            # Existing typo patterns
            (self.bahalf_pattern, "bahalf_typo"),
            (self.behlaf_pattern, "behlaf_typo"),
            (self.behalf_fo_pattern, "behalf_fo_typo"),
            (self.initials_pattern, "initials"),
            (self.multiple_initials_pattern, "multiple_initials"),
            (self.main_pattern, "main"),
            (self.comma_pattern, "comma"),
            (self.the_org_pattern, "the_org"),
            (self.mixed_pattern, "mixed"),
        ]

        for pattern, pattern_name in patterns_to_try:
            match = pattern.match(text)
            if match:
                self.logger.debug(f"Row {row_id}: Matched {pattern_name} pattern")
                try:
                    return self._extract_from_match(match, pattern_name, text, row_id)
                except Exception as e:
                    self.logger.warning(
                        f"Row {row_id}: Error with {pattern_name} pattern: {str(e)}"
                    )
                    continue

        # No pattern matched
        return self._create_error_result("no_pattern_match", text)

    def _extract_from_match(
        self, match, pattern_name: str, text: str, row_id: int
    ) -> ParsedOfficerData:
        """Extract officer data from regex match based on pattern type"""

        # FINAL OPTIMIZATION PATTERN EXTRACTION
        if pattern_name == "comma_badge_org_typo":
            # Comma after badge ID with organization typo: "Unsworn Officer PD92706, FENTON, Niall On Behalf of - Sworn Officer PD52260 LE KENBY, Halley of Serious & Organised Crime Divsional Office"
            submitting_rank = match.group(1).strip()  # Unsworn Officer
            submitting_badge = match.group(2).strip()  # PD92706
            submitting_lastname = match.group(3).strip()  # FENTON
            submitting_firstname = match.group(4).strip()  # Niall
            requesting_rank = match.group(5).strip()  # Sworn Officer
            requesting_badge = match.group(6).strip()  # PD52260
            requesting_lastname = match.group(7).strip()  # LE KENBY
            requesting_firstname = match.group(8).strip()  # Halley
            organization = match.group(
                9
            ).strip()  # Serious & Organised Crime Divsional Office

            # Fix organization typos
            if "divsional" in organization.lower():
                organization = organization.replace("Divsional", "Divisional").replace(
                    "divsional", "divisional"
                )

            # Format names
            submitting_name = f"{submitting_firstname} {submitting_lastname.title()}"
            requesting_name = f"{requesting_firstname} {requesting_lastname.title()}"

        elif pattern_name == "missing_requesting_firstname":
            # Missing requesting officer first name: "Unsworn Officer PD85192 BELLEY, Dunholm-Duncombe On Behalf of Sworn Officer PD46576 GARHURST-HALWICK"
            submitting_rank = match.group(1).strip()  # Unsworn Officer
            submitting_badge = match.group(2).strip()  # PD85192
            submitting_lastname = match.group(3).strip()  # BELLEY
            submitting_firstname = match.group(4).strip()  # Dunholm-Duncombe
            requesting_rank = match.group(5).strip()  # Sworn Officer
            requesting_badge = match.group(6).strip()  # PD46576
            requesting_lastname = match.group(7).strip()  # GARHURST-HALWICK
            organization = (
                match.group(8).strip() if match.group(8) else ""
            )  # Optional organization

            # Format names
            submitting_name = f"{submitting_firstname} {submitting_lastname.title()}"
            requesting_name = requesting_lastname.title()  # Only surname available
            requesting_firstname = ""
            requesting_lastname = requesting_lastname

        elif pattern_name == "pdf_badge":
            # PDF badge ID: "Unsworn Officer PD86288 ELWICK, Romilly On behalf of - Sworn Officer PDF1760 HALCOMBE, Isolde"
            submitting_rank = match.group(1).strip()  # Unsworn Officer
            submitting_badge = match.group(2).strip()  # PD86288
            submitting_lastname = match.group(3).strip()  # ELWICK
            submitting_firstname = match.group(4).strip()  # Romilly
            requesting_rank = match.group(5).strip()  # Sworn Officer
            requesting_badge = match.group(6).strip()  # PDF1760
            requesting_lastname = match.group(7).strip()  # HALCOMBE
            requesting_firstname = match.group(8).strip()  # Isolde
            organization = (
                match.group(9).strip() if match.group(9) else ""
            )  # Optional organization

            # Format names
            submitting_name = f"{submitting_firstname} {submitting_lastname.title()}"
            requesting_name = f"{requesting_firstname} {requesting_lastname.title()}"

        elif pattern_name == "apostrophe_names":
            # Apostrophes in names: "Unsworn Officer PD85862 ELFORD, Saffron On Behalf of Sworn Officer PD49483 FENHURST, Zelda"
            submitting_rank = match.group(1).strip()  # Unsworn Officer
            submitting_badge = match.group(2).strip()  # PD85862
            submitting_lastname = match.group(3).strip()  # ELFORD
            submitting_firstname = match.group(4).strip()  # Saffron
            requesting_rank = match.group(5).strip()  # Sworn Officer
            requesting_badge = match.group(6).strip()  # PD49483
            requesting_lastname = match.group(7).strip()  # FENHURST
            requesting_firstname = match.group(8).strip()  # Zelda
            organization = (
                match.group(9).strip() if match.group(9) else ""
            )  # Optional organization

            # Format names (preserve apostrophes)
            submitting_name = f"{submitting_firstname} {submitting_lastname.title()}"
            requesting_name = f"{requesting_firstname} {requesting_lastname.title()}"

        elif pattern_name == "no_comma_submitting":
            # Missing comma in submitting name: "Unsworn Officer PD91359 HALTON Viggo On Behalf of - Sworn Officer PD52274 KENFIELD, Cedric of South Wet District Office"
            submitting_rank = match.group(1).strip()  # Unsworn Officer
            submitting_badge = match.group(2).strip()  # PD91359
            submitting_lastname = match.group(3).strip()  # HALTON
            submitting_firstname = match.group(4).strip()  # Viggo
            requesting_rank = match.group(5).strip()  # Sworn Officer
            requesting_badge = match.group(6).strip()  # PD52274
            requesting_lastname = match.group(7).strip()  # KENFIELD
            requesting_firstname = match.group(8).strip()  # Cedric
            organization = match.group(9).strip()  # South Wet District Office

            # Format names
            submitting_name = f"{submitting_firstname} {submitting_lastname.title()}"
            requesting_name = f"{requesting_firstname} {requesting_lastname.title()}"

        elif pattern_name == "complex_multipart_names":
            # Complex multi-part names: "Unsworn Officer PD85906 DUNDALE, Bexana On Behalf of Sworn Officer PD48539 FENGRAVE, Oriel, Thaddeus of Serious & Organised Crime Divisional Office"
            submitting_rank = match.group(1).strip()  # Unsworn Officer
            submitting_badge = match.group(2).strip()  # PD85906
            submitting_lastname = match.group(3).strip()  # DUNDALE
            submitting_firstname = match.group(4).strip()  # Bexana
            requesting_rank = match.group(5).strip()  # Sworn Officer
            requesting_badge = match.group(6).strip()  # PD48539
            requesting_lastname = match.group(7).strip()  # FENGRAVE
            requesting_firstname = match.group(8).strip()  # Oriel
            requesting_middle = match.group(9).strip()  # Thaddeus
            organization = match.group(
                10
            ).strip()  # Serious & Organised Crime Divisional Office

            # Format names (combine first and middle names)
            submitting_name = f"{submitting_firstname} {submitting_lastname.title()}"
            requesting_name = f"{requesting_firstname} {requesting_middle} {requesting_lastname.title()}"

        elif pattern_name == "hyphenated_requesting":
            # Hyphenated requesting officer names: "Unsworn Officer PD89902 FENBY, Bexwen On Behalf of - Sworn Officer PD53572 KENMONT-KENGRAVE, Rufus of Mandurah District Office"
            submitting_rank = match.group(1).strip()  # Unsworn Officer
            submitting_badge = match.group(2).strip()  # PD89902
            submitting_lastname = match.group(3).strip()  # FENBY
            submitting_firstname = match.group(4).strip()  # Bexwen
            requesting_rank = match.group(5).strip()  # Sworn Officer
            requesting_badge = match.group(6).strip()  # PD53572
            requesting_lastname = match.group(7).strip()  # KENMONT-KENGRAVE
            requesting_firstname = match.group(8).strip()  # Rufus
            organization = match.group(9).strip()  # Mandurah District Office

            # Format names (preserve hyphens)
            submitting_name = f"{submitting_firstname} {submitting_lastname.title()}"
            requesting_name = f"{requesting_firstname} {requesting_lastname.title()}"

        elif pattern_name == "hyphenated_delegation":
            # Hyphenated names in delegation: "Unsworn Officer PD85192 BELLEY, Dunholm-Duncombe On Behalf of Sworn Officer PD46576 GARHURST-HALWICK, Yorick"
            submitting_rank = match.group(1).strip()  # Unsworn Officer
            submitting_badge = match.group(2).strip()  # PD85192
            submitting_lastname = match.group(3).strip()  # BELLEY
            submitting_firstname = match.group(4).strip()  # Dunholm-Duncombe
            requesting_rank = match.group(5).strip()  # Sworn Officer
            requesting_badge = match.group(6).strip()  # PD46576
            requesting_lastname = match.group(7).strip()  # GARHURST-HALWICK
            requesting_firstname = match.group(8).strip()  # Yorick
            organization = (
                match.group(9).strip() if match.group(9) else ""
            )  # Optional organization

            # Format names (preserve hyphens)
            submitting_name = f"{submitting_firstname} {submitting_lastname.title()}"
            requesting_name = f"{requesting_firstname} {requesting_lastname.title()}"

        elif pattern_name == "comma_badge_delegation":
            # Comma after badge ID in delegation: "Unsworn Officer PD92706, FENTON, Niall On Behalf of - Sworn Officer PD46959 GARTON, Bryn of Serious & Organised Crime Divisional Office"
            submitting_rank = match.group(1).strip()  # Unsworn Officer
            submitting_badge = match.group(2).strip()  # PD92706
            submitting_lastname = match.group(3).strip()  # FENTON
            submitting_firstname = match.group(4).strip()  # Niall
            requesting_rank = match.group(5).strip()  # Sworn Officer
            requesting_badge = match.group(6).strip()  # PD46959
            requesting_lastname = match.group(7).strip()  # GARTON
            requesting_firstname = match.group(8).strip()  # Bryn
            organization = match.group(
                9
            ).strip()  # Serious & Organised Crime Divisional Office

            # Format names
            submitting_name = f"{submitting_firstname} {submitting_lastname.title()}"
            requesting_name = f"{requesting_firstname} {requesting_lastname.title()}"

        elif pattern_name == "missing_requesting_name":
            # Missing requesting officer name: "Unsworn Officer PD85862 ELFORD, Saffron On Behalf of Sworn Officer PD45444"
            submitting_rank = match.group(1).strip()  # Unsworn Officer
            submitting_badge = match.group(2).strip()  # PD85862
            submitting_lastname = match.group(3).strip()  # ELFORD
            submitting_firstname = match.group(4).strip()  # Saffron
            requesting_rank = match.group(5).strip()  # Sworn Officer
            requesting_badge = match.group(6).strip()  # PD45444
            organization = ""  # No organization

            # Format names
            submitting_name = f"{submitting_firstname} {submitting_lastname.title()}"
            requesting_name = ""  # No requesting officer name
            requesting_firstname = ""
            requesting_lastname = ""

        elif pattern_name == "org_typo_delegation":
            # Organization typos: "fo" instead of "of", "Divsional" instead of "Divisional"
            submitting_rank = match.group(1).strip()  # Unsworn Officer
            submitting_badge = match.group(2).strip()  # PD89902
            submitting_lastname = match.group(3).strip()  # FENBY
            submitting_firstname = match.group(4).strip()  # Bexwen
            requesting_rank = match.group(5).strip()  # Sworn Officer
            requesting_badge = match.group(6).strip()  # PD52924
            requesting_lastname = match.group(7).strip()  # ELSTEAD
            requesting_firstname = match.group(8).strip()  # Fleur
            organization = match.group(9).strip()  # Organization (may have typos)

            # Fix common organization typos
            if "fo " in organization.lower():
                organization = organization.replace("fo ", "of ")
            if "divsional" in organization.lower():
                organization = organization.replace("Divsional", "Divisional")

            # Format names
            submitting_name = f"{submitting_firstname} {submitting_lastname.title()}"
            requesting_name = f"{requesting_firstname} {requesting_lastname.title()}"

        elif pattern_name == "no_comma_requesting":
            # Missing comma in requesting officer name: "Unsworn Officer PD85878 DUNDALE, Araric On Behalf of Sworn Officer PD46956 LE CALFIELD, Benedikt of Serious & Organised Crime Divisional Office"
            submitting_rank = match.group(1).strip()  # Unsworn Officer
            submitting_badge = match.group(2).strip()  # PD85878
            submitting_lastname = match.group(3).strip()  # DUNDALE
            submitting_firstname = match.group(4).strip()  # Araric
            requesting_rank = match.group(5).strip()  # Sworn Officer
            requesting_badge = match.group(6).strip()  # PD46956
            requesting_lastname_parts = match.group(
                7
            ).strip()  # LE CALFIELD (multi-word)
            requesting_firstname = match.group(8).strip()  # Benedikt
            organization = match.group(
                9
            ).strip()  # Serious & Organised Crime Divisional Office

            # Format names (handle multi-word surnames)
            submitting_name = f"{submitting_firstname} {submitting_lastname.title()}"
            requesting_name = (
                f"{requesting_firstname} {requesting_lastname_parts.title()}"
            )

        # PRODUCTION QUALITY PATTERN EXTRACTION FOR REMAINING FAILURES
        elif pattern_name == "standard_delegation":
            # Standard delegation format: "Sworn Officer PD0785 FENMORE Tristram on behalf of Sworn Officer PD48021 LANWORTH Nerys of South East Metropolitan District Office"
            submitting_rank = match.group(1).strip()  # Sworn Officer
            submitting_badge = match.group(2).strip()  # PD0785
            submitting_lastname = match.group(3).strip()  # FENMORE
            submitting_firstname = match.group(4).strip()  # Tristram
            requesting_rank = match.group(5).strip()  # Sworn Officer
            requesting_badge = match.group(6).strip()  # PD48021
            requesting_lastname = match.group(7).strip()  # LANWORTH
            requesting_firstname = match.group(8).strip()  # Nerys
            organization = match.group(
                9
            ).strip()  # South East Metropolitan District Office

            # Format names
            submitting_name = f"{submitting_firstname} {submitting_lastname.title()}"
            requesting_name = f"{requesting_firstname} {requesting_lastname.title()}"

        elif pattern_name == "standard_delegation_comma":
            # Standard delegation with comma: "Sworn Officer PD0785 FENMORE Tristram on behalf of Sworn Officer PD47648 KENDALE, Peregrine of South East Metropolitan District"
            submitting_rank = match.group(1).strip()  # Sworn Officer
            submitting_badge = match.group(2).strip()  # PD0785
            submitting_lastname = match.group(3).strip()  # FENMORE
            submitting_firstname = match.group(4).strip()  # Tristram
            requesting_rank = match.group(5).strip()  # Sworn Officer
            requesting_badge = match.group(6).strip()  # PD47648
            requesting_lastname = match.group(7).strip()  # KENDALE
            requesting_firstname = match.group(8).strip()  # Peregrine
            organization = match.group(9).strip()  # South East Metropolitan District

            # Format names
            submitting_name = f"{submitting_firstname} {submitting_lastname.title()}"
            requesting_name = f"{requesting_firstname} {requesting_lastname.title()}"

        elif pattern_name == "space_badge_id":
            # Space in badge ID: "Sworn Officer PD 0785 FENMORE Tristram on behalf of - Sworn Officer PD0938 DUNFIELD Kestrel"
            submitting_rank = match.group(1).strip()  # Sworn Officer
            submitting_badge = (
                match.group(2).replace(" ", "").strip()
            )  # PD 0785 -> PD0785
            submitting_lastname = match.group(3).strip()  # FENMORE
            submitting_firstname = match.group(4).strip()  # Tristram
            requesting_rank = match.group(5).strip()  # Sworn Officer
            requesting_badge = match.group(6).strip()  # PD0938
            requesting_lastname = match.group(7).strip()  # DUNFIELD
            requesting_firstname = match.group(8).strip()  # Kestrel
            organization = (
                match.group(9).strip() if match.group(9) else ""
            )  # Optional organization

            # Format names
            submitting_name = f"{submitting_firstname} {submitting_lastname.title()}"
            requesting_name = f"{requesting_firstname} {requesting_lastname.title()}"

        elif pattern_name == "missing_requesting_rank":
            # Missing requesting rank: "Sworn Officer PD1028 GARCOMBE Felix on behalf of PD45741 KENFORD Felix of South East Metropolitan District Office"
            submitting_rank = match.group(1).strip()  # Sworn Officer
            submitting_badge = match.group(2).strip()  # PD1028
            submitting_lastname = match.group(3).strip()  # GARCOMBE
            submitting_firstname = match.group(4).strip()  # Felix
            requesting_badge = match.group(5).strip()  # PD45741
            requesting_lastname = match.group(6).strip()  # KENFORD
            requesting_firstname = match.group(7).strip()  # Felix
            organization = match.group(
                8
            ).strip()  # South East Metropolitan District Office

            # Format names
            submitting_name = f"{submitting_firstname} {submitting_lastname.title()}"
            requesting_name = f"{requesting_firstname} {requesting_lastname.title()}"
            requesting_rank = "Sworn Officer"  # Default rank when missing

        elif pattern_name == "lowercase_officer_delegation":
            # Lowercase officer: "Sworn officer PD1028 GARCOMBE Felix on behalf of Sworn Officer PD2094 ELMORE Bexana of South West Office"
            submitting_rank = (
                match.group(1).strip().title()
            )  # Sworn officer -> Sworn Officer
            submitting_badge = match.group(2).strip()  # PD1028
            submitting_lastname = match.group(3).strip()  # GARCOMBE
            submitting_firstname = match.group(4).strip()  # Felix
            requesting_rank = match.group(5).strip()  # Sworn Officer
            requesting_badge = match.group(6).strip()  # PD2094
            requesting_lastname = match.group(7).strip()  # ELMORE
            requesting_firstname = match.group(8).strip()  # Bexana
            organization = match.group(9).strip()  # South West Office

            # Format names
            submitting_name = f"{submitting_firstname} {submitting_lastname.title()}"
            requesting_name = f"{requesting_firstname} {requesting_lastname.title()}"

        elif pattern_name == "comma_after_badge_task20":
            # Comma after badge ID: "Unsworn Officer PD85192, BELLEY, Dunholm-Duncombe On Behalf of Sworn Officer PD48438 DUNWICK, Aralyn"
            submitting_rank = match.group(1).strip()  # Unsworn Officer
            submitting_badge = match.group(2).strip()  # PD85192
            submitting_lastname = match.group(3).strip()  # BELLEY
            submitting_firstname = match.group(4).strip()  # Dunholm-Duncombe
            requesting_rank = match.group(5).strip()  # Sworn Officer
            requesting_badge = match.group(6).strip()  # PD48438
            requesting_lastname = match.group(7).strip()  # DUNWICK
            requesting_firstname = match.group(8).strip()  # Aralyn
            organization = (
                match.group(9).strip() if match.group(9) else ""
            )  # Optional organization

            # Format names
            submitting_name = f"{submitting_firstname} {submitting_lastname.title()}"
            requesting_name = f"{requesting_firstname} {requesting_lastname.title()}"

        elif pattern_name == "missing_organization_task20":
            # Missing organization: "Sworn Officer Bexana GARFIELD 0322 on behalf of Sworn Officer Jethro CALDALE 0066"
            submitting_rank = match.group(1).strip()  # Sworn Officer
            submitting_firstname = match.group(2).strip()  # Bexana
            submitting_lastname = match.group(3).strip()  # GARFIELD
            submitting_badge = match.group(4).strip()  # 0322
            requesting_rank = match.group(5).strip()  # Sworn Officer
            requesting_firstname = match.group(6).strip()  # Jethro
            requesting_lastname = match.group(7).strip()  # CALDALE
            requesting_badge = match.group(8).strip()  # 0066
            organization = ""  # No organization

            # Format names
            submitting_name = f"{submitting_firstname} {submitting_lastname.title()}"
            requesting_name = f"{requesting_firstname} {requesting_lastname.title()}"

        elif pattern_name == "multi_part_surname":
            # Multi-part surname: "Unsworn Officer PD89190 VAN DER LANTON, Opal"
            submitting_rank = match.group(1).strip()  # Unsworn Officer
            submitting_badge = match.group(2).strip()  # PD89190
            submitting_lastname = match.group(3).strip()  # VAN DER LANTON
            submitting_firstname = match.group(4).strip()  # Opal
            organization = ""  # Single officer, no organization

            # Format names
            submitting_name = f"{submitting_firstname} {submitting_lastname.title()}"
            requesting_name = ""  # Single officer
            requesting_rank = ""
            requesting_badge = ""
            requesting_firstname = ""
            requesting_lastname = ""

        elif pattern_name == "organization_typo":
            # Organization typo: Handle "fo" instead of "of"
            submitting_rank = match.group(1).strip()  # Sworn Officer
            submitting_badge = match.group(2).strip()  # Badge ID
            submitting_lastname = match.group(3).strip()  # Lastname
            submitting_firstname = match.group(4).strip()  # Firstname
            requesting_rank = match.group(5).strip()  # Sworn Officer
            requesting_badge = match.group(6).strip()  # Badge ID
            requesting_lastname = match.group(7).strip()  # Lastname
            requesting_firstname = match.group(8).strip()  # Firstname
            organization = match.group(9).strip()  # Organization

            # Format names
            submitting_name = f"{submitting_firstname} {submitting_lastname.title()}"
            requesting_name = f"{requesting_firstname} {requesting_lastname.title()}"

        elif pattern_name == "pf_badge":
            # PF badge ID format: "Sworn Officer PD1028 GARCOMBE Felix on behalf of Sworn Officer PF0302 KENHURST David of South West District Office"
            submitting_rank = match.group(1).strip()  # Sworn Officer
            submitting_badge = match.group(2).strip()  # PD1028
            submitting_lastname = match.group(3).strip()  # GARCOMBE
            submitting_firstname = match.group(4).strip()  # Felix
            requesting_rank = match.group(5).strip()  # Sworn Officer
            requesting_badge = match.group(6).strip()  # PF0302
            requesting_lastname = match.group(7).strip()  # KENHURST
            requesting_firstname = match.group(8).strip()  # David
            organization = match.group(9).strip()  # South West District Office

            # Format names
            submitting_name = f"{submitting_firstname} {submitting_lastname.title()}"
            requesting_name = f"{requesting_firstname} {requesting_lastname.title()}"

        elif pattern_name == "missing_org_delegation":
            # Missing organization: "Unsworn Officer PD85192 BELLEY, Dunholm-Duncombe On Behalf of Sworn Officer PD48438 DUNWICK, Aralyn"
            submitting_rank = match.group(1).strip()  # Unsworn Officer
            submitting_badge = match.group(2).strip()  # PD85192
            submitting_lastname = match.group(3).strip()  # BELLEY
            submitting_firstname = match.group(4).strip()  # Dunholm-Duncombe
            requesting_rank = match.group(5).strip()  # Sworn Officer
            requesting_badge = match.group(6).strip()  # PD48438
            requesting_lastname = match.group(7).strip()  # DUNWICK
            requesting_firstname = match.group(8).strip()  # Aralyn
            organization = ""  # No organization

            # Format names
            submitting_name = f"{submitting_firstname} {submitting_lastname.title()}"
            requesting_name = f"{requesting_firstname} {requesting_lastname.title()}"

        elif pattern_name == "comma_badge_missing_org":
            # Comma after badge with missing org: "Unsworn Officer PD85192, BELLEY, Dunholm-Duncombe On Behalf of Sworn Officer PD48438 DUNWICK, Aralyn"
            submitting_rank = match.group(1).strip()  # Unsworn Officer
            submitting_badge = match.group(2).strip()  # PD85192
            submitting_lastname = match.group(3).strip()  # BELLEY
            submitting_firstname = match.group(4).strip()  # Dunholm-Duncombe
            requesting_rank = match.group(5).strip()  # Sworn Officer
            requesting_badge = match.group(6).strip()  # PD48438
            requesting_lastname = match.group(7).strip()  # DUNWICK
            requesting_firstname = match.group(8).strip()  # Aralyn
            organization = ""  # No organization

            # Format names
            submitting_name = f"{submitting_firstname} {submitting_lastname.title()}"
            requesting_name = f"{requesting_firstname} {requesting_lastname.title()}"

        # FINAL OPTIMIZATION PATTERN EXTRACTION FOR "ON BEHALF VARIATIONS"
        elif pattern_name == "missing_requesting_badge":
            # Missing requesting badge ID: "Sworn Officer PD1028 GARCOMBE, Felix on behalf of Sworn Officer FENHOLM, Mabel of South Metropolitan District Office"
            submitting_rank = match.group(1).strip()  # Sworn Officer
            submitting_badge = match.group(2).strip()  # PD1028
            submitting_lastname = match.group(3).strip()  # GARCOMBE
            submitting_firstname = match.group(4).strip()  # Felix
            requesting_rank = match.group(5).strip()  # Sworn Officer
            requesting_lastname = match.group(6).strip()  # FENHOLM
            requesting_firstname = match.group(7).strip()  # Mabel
            organization = match.group(8).strip()  # South Metropolitan District Office

            # Format names
            submitting_name = f"{submitting_firstname} {submitting_lastname.title()}"
            requesting_name = f"{requesting_firstname} {requesting_lastname.title()}"
            requesting_badge = ""  # No badge ID for requesting officer

        elif pattern_name == "comma_after_firstname":
            # Comma after first name: "Sworn Officer PD1028 GARCOMBE Felix, on behalf of - Sworn Officer PD45677 CALHOLM Norbert of State Intelligence Divisional Office"
            submitting_rank = match.group(1).strip()  # Sworn Officer
            submitting_badge = match.group(2).strip()  # PD1028
            submitting_lastname = match.group(3).strip()  # GARCOMBE
            submitting_firstname = match.group(4).strip()  # Felix
            requesting_rank = match.group(5).strip()  # Sworn Officer
            requesting_badge = match.group(6).strip()  # PD45677
            requesting_lastname = match.group(7).strip()  # CALHOLM
            requesting_firstname = match.group(8).strip()  # Norbert
            organization = match.group(
                9
            ).strip()  # State Intelligence Divisional Office

            # Format names
            submitting_name = f"{submitting_firstname} {submitting_lastname.title()}"
            requesting_name = f"{requesting_firstname} {requesting_lastname.title()}"

        elif pattern_name == "no_badge_after_firstname":
            # No badge after first name: "Sworn Officer PD1028 GARCOMBE Felix on behalf of - Sworn Officer PD2331 CALFORD Dulcie of South West District Office"
            submitting_rank = match.group(1).strip()  # Sworn Officer
            submitting_badge = match.group(2).strip()  # PD1028
            submitting_lastname = match.group(3).strip()  # GARCOMBE
            submitting_firstname = match.group(4).strip()  # Felix
            requesting_rank = match.group(5).strip()  # Sworn Officer
            requesting_badge = match.group(6).strip()  # PD2331
            requesting_lastname = match.group(7).strip()  # CALFORD
            requesting_firstname = match.group(8).strip()  # Dulcie
            organization = match.group(9).strip()  # South West District Office

            # Format names
            submitting_name = f"{submitting_firstname} {submitting_lastname.title()}"
            requesting_name = f"{requesting_firstname} {requesting_lastname.title()}"

        elif pattern_name == "multiple_officers":
            # Multiple officers: "Sworn Officer PD1675 KENTON Cailyn and Sworn Officer PD45117 KENWICK Bexo on behalf of Sworn Offcer PD9613 VAN DER HALWORTH Xanthe of Mirrabooka Police Station"
            # Use the first submitting officer as primary
            submitting_rank = match.group(1).strip()  # Sworn Officer
            submitting_badge = match.group(2).strip()  # PD1675
            submitting_lastname = match.group(3).strip()  # KENTON
            submitting_firstname = match.group(4).strip()  # Cailyn
            # Second officer info available but not used in this structure
            requesting_rank_raw = match.group(9).strip()  # Sworn Offcer (may have typo)
            requesting_badge = match.group(10).strip()  # PD9613
            requesting_lastname_parts = match.group(11).strip()  # VAN DER HALWORTH
            requesting_firstname = match.group(12).strip()  # Xanthe
            organization = match.group(13).strip()  # Mirrabooka Police Station

            # Fix typo in requesting rank
            requesting_rank = requesting_rank_raw.replace("Offcer", "Officer")

            # Format names
            submitting_name = f"{submitting_firstname} {submitting_lastname.title()}"
            requesting_name = (
                f"{requesting_firstname} {requesting_lastname_parts.title()}"
            )

        elif pattern_name == "single_officer_with_org":
            # Single officer with organization: "Sworn Officer PD46956 LE CALFIELD, Benedikt of Serious & Organised Crime Divisional Office"
            rank = match.group(1).strip()  # Sworn Officer
            badge_id = match.group(2).strip()  # PD46956
            lastname_parts = match.group(3).strip()  # LE CALFIELD (may have spaces)
            firstname = match.group(4).strip()  # Benedikt
            organization = match.group(
                5
            ).strip()  # Serious & Organised Crime Divisional Office

            # Format name (handle multi-part surnames)
            name = f"{firstname} {lastname_parts.title()}"

            # Return as single officer (no requesting officer)
            return ParsedOfficerData(
                submitting_officer=ParsedOfficer(
                    name=name,
                    rank=rank,
                    badge_id=badge_id,
                ),
                requesting_officer=ParsedOfficer(name="", rank="", badge_id=""),
                organisation=organization,
                processing_notes={
                    "reason": "successfully_parsed",
                    "format_detected": "single_officer_with_org",
                    "pattern_matched": pattern_name,
                },
            )

        elif pattern_name == "conveying_space_dash":
            # Conveying Officer - with space: "Conveying Officer - Sworn Officer Verity KENSTEAD 7602 on behalf of Sworn Officer Bryn FENCOMBE 1370"
            submitting_rank = match.group(1).strip()  # Sworn Officer
            submitting_firstname = match.group(2).strip()  # Verity
            submitting_lastname = match.group(3).strip()  # KENSTEAD
            submitting_badge = match.group(4).strip()  # 7602
            requesting_rank = match.group(5).strip()  # Sworn Officer
            requesting_firstname = match.group(6).strip()  # Bryn
            requesting_lastname = match.group(7).strip()  # FENCOMBE
            requesting_badge = match.group(8).strip()  # 1370
            organization = (
                match.group(9).strip() if match.group(9) else ""
            )  # Optional organization

            # Format names
            submitting_name = f"{submitting_firstname} {submitting_lastname.title()}"
            requesting_name = f"{requesting_firstname} {requesting_lastname.title()}"

        elif pattern_name == "on_behalf_dash_space_final":
            # On Behalf of - with dash and space: "Sworn Officer Verity KENSTEAD 7602 on Behalf of - Sworn Officer Bexis DUNBY-DUNMORE 45914 of Peel District Office"
            submitting_rank = match.group(1).strip()  # Sworn Officer
            submitting_firstname = match.group(2).strip()  # Verity
            submitting_lastname = match.group(3).strip()  # KENSTEAD
            submitting_badge = match.group(4).strip()  # 7602
            requesting_rank = match.group(5).strip()  # Sworn Officer
            requesting_firstname = match.group(6).strip()  # Bexis (may have hyphens)
            requesting_lastname = match.group(
                7
            ).strip()  # DUNBY-DUNMORE (may have hyphens)
            requesting_badge = match.group(8).strip()  # 45914
            organization = match.group(9).strip()  # Peel District Office

            # Format names (preserve hyphens)
            submitting_name = f"{submitting_firstname} {submitting_lastname.title()}"
            requesting_name = f"{requesting_firstname} {requesting_lastname.title()}"

        elif pattern_name == "on_behalf_zero":
            # On Behalf 0f with zero: "Sworn Officer Bexana GARFIELD 0322 on Behalf 0f - Sworn Officer Sabine CALBY 45352 of Organised Crime Divisional Office"
            submitting_rank = match.group(1).strip()  # Sworn Officer
            submitting_firstname = match.group(2).strip()  # Bexana
            submitting_lastname = match.group(3).strip()  # GARFIELD
            submitting_badge = match.group(4).strip()  # 0322
            requesting_rank = match.group(5).strip()  # Sworn Officer
            requesting_firstname = match.group(6).strip()  # Sabine
            requesting_lastname = match.group(7).strip()  # CALBY
            requesting_badge = match.group(8).strip()  # 45352
            organization = match.group(9).strip()  # Organised Crime Divisional Office

            # Format names
            submitting_name = f"{submitting_firstname} {submitting_lastname.title()}"
            requesting_name = f"{requesting_firstname} {requesting_lastname.title()}"

        elif pattern_name == "same_officer":
            # Same officer delegation: "First Class Constable KENMORE 45520 on behalf of First Class Constable KENMORE 45520 of Boyup Brook Police Station"
            submitting_rank = match.group(1).strip()  # First Class Constable
            submitting_surname = match.group(2).strip()  # KENMORE
            submitting_badge = match.group(3).strip()  # 45520
            requesting_rank = match.group(4).strip()  # First Class Constable (same)
            requesting_surname = match.group(5).strip()  # KENMORE (same)
            requesting_badge = match.group(6).strip()  # 45520 (same)
            organization = match.group(7).strip()  # Boyup Brook Police Station

            # Format names (same officer)
            submitting_name = submitting_surname.title()  # Kenmore
            requesting_name = requesting_surname.title()  # Kenmore

        elif pattern_name == "conveying_comma_names":
            # Conveying Officer - with comma names: "Conveying Officer - Sworn Officer PD0101 JONES, David on Behalf of - Sworn Officer PD9038 ELTON, Sabine of Organised Crime Divisional Office"
            submitting_rank = match.group(1).strip()  # Sworn Officer
            submitting_badge = match.group(2).strip()  # PD0101
            submitting_lastname = match.group(3).strip()  # JONES
            submitting_firstname = match.group(4).strip()  # David
            requesting_rank = match.group(5).strip()  # Sworn Officer
            requesting_badge = match.group(6).strip()  # PD9038
            requesting_lastname = match.group(7).strip()  # ELTON
            requesting_firstname = match.group(8).strip()  # Sabine
            organization = match.group(9).strip()  # Organised Crime Divisional Office

            # Format names
            submitting_name = f"{submitting_firstname} {submitting_lastname.title()}"
            requesting_name = f"{requesting_firstname} {requesting_lastname.title()}"

        elif pattern_name == "complex_rank":
            # Complex rank sequence: "Conveying Officer - Sworn Officer First Class Constable Garmore 45562 on Behalf of - First Class Constable Garmore of Bridgetown Police Station"
            submitting_rank_prefix = match.group(1).strip()  # Sworn Officer
            submitting_rank = match.group(2).strip()  # First Class Constable
            submitting_surname = match.group(3).strip()  # Garmore
            submitting_badge = match.group(4).strip()  # 45562
            requesting_rank = match.group(5).strip()  # First Class Constable
            requesting_surname = match.group(6).strip()  # Garmore
            organization = match.group(7).strip()  # Bridgetown Police Station

            # Format names and ranks
            full_submitting_rank = f"{submitting_rank_prefix} {submitting_rank}"  # Sworn Officer First Class Constable
            submitting_name = submitting_surname.title()  # Garmore
            requesting_name = requesting_surname.title()  # Garmore

            # Use the full rank for submitting officer
            submitting_rank = full_submitting_rank
            requesting_badge = ""  # No badge ID for requesting officer

        elif pattern_name == "lowercase_officer":
            # Lowercase officer title: "Sworn officer PD1028 GARCOMBE Felix on behalf of Sworn Officer FENHOLM, Mabel of South Metropolitan District Office"
            submitting_rank_raw = match.group(1).strip()  # Sworn officer (lowercase)
            submitting_badge = match.group(2).strip()  # PD1028
            submitting_lastname = match.group(3).strip()  # GARCOMBE
            submitting_firstname = match.group(4).strip()  # Felix
            requesting_rank = match.group(5).strip()  # Sworn Officer
            requesting_lastname = match.group(6).strip()  # FENHOLM
            requesting_firstname = match.group(7).strip()  # Mabel
            organization = match.group(8).strip()  # South Metropolitan District Office

            # Fix the case of the submitting rank
            submitting_rank = self._fix_officer_title_typos(
                submitting_rank_raw
            )  # Sworn Officer

            # Format names
            submitting_name = f"{submitting_firstname} {submitting_lastname.title()}"
            requesting_name = f"{requesting_firstname} {requesting_lastname.title()}"
            requesting_badge = ""  # No badge ID for requesting officer

        elif pattern_name in ["bahalf_typo", "behlaf_typo"]:
            # Typo patterns: flexible extraction (comma format)
            submitting_rank = match.group(1).strip()
            submitting_badge = match.group(2).strip()
            submitting_lastname = match.group(3).strip()
            submitting_firstname = match.group(4).strip() if match.group(4) else ""
            requesting_rank = match.group(5).strip()
            requesting_badge = match.group(6).strip()
            requesting_lastname = match.group(7).strip()
            requesting_firstname = match.group(8).strip() if match.group(8) else ""
            organization = ""  # May not have organization in typo cases

            # Format names properly
            if submitting_firstname:
                submitting_name = (
                    f"{submitting_firstname} {submitting_lastname.title()}"
                )
            else:
                submitting_name = submitting_lastname.title()

            if requesting_firstname:
                requesting_name = (
                    f"{requesting_firstname} {requesting_lastname.title()}"
                )
            else:
                requesting_name = requesting_lastname.title()

        elif pattern_name == "behalf_fo_typo":
            # "behalf fo" typo pattern: standard later format extraction
            submitting_rank = match.group(1).strip()
            submitting_name = f"{match.group(2).strip()} {match.group(3).strip()}"
            submitting_badge = match.group(4).strip()
            requesting_rank = match.group(5).strip()
            requesting_name = f"{match.group(6).strip()} {match.group(7).strip()}"
            requesting_badge = match.group(8).strip()
            organization = ""  # No organization in this case

        elif pattern_name == "initials":
            # Initials pattern: "Sworn Officer G.N. ASHHURST 8977 on behalf of Sworn Officer Linus GARWICK 45685"
            submitting_rank = match.group(1).strip()
            submitting_initials = match.group(2).strip()  # G.N.
            submitting_surname = match.group(3).strip()  # ASHHURST
            submitting_badge = match.group(4).strip()
            requesting_rank = match.group(5).strip()
            requesting_name = match.group(6).strip()  # Linus GARWICK
            requesting_badge = match.group(7).strip()
            organization = match.group(8).strip() if match.group(8) else ""

            # Format names
            submitting_name = (
                f"{submitting_initials} {submitting_surname.title()}"  # G.N. Ashhurst
            )
            requesting_name = requesting_name  # Keep as is (handles apostrophes)

        elif pattern_name == "multiple_initials":
            # Multiple initials pattern: "Sworn Officer J.P. SMITH 9999 on behalf of Sworn Officer A.B. JONES 8888 of Central District"
            submitting_rank = match.group(1).strip()
            submitting_initials = match.group(2).strip()  # J.P.
            submitting_surname = match.group(3).strip()  # SMITH
            submitting_badge = match.group(4).strip()
            requesting_rank = match.group(5).strip()
            requesting_initials = match.group(6).strip()  # A.B.
            requesting_surname = match.group(7).strip()  # JONES
            requesting_badge = match.group(8).strip()
            organization = match.group(9).strip()

            # Format names
            submitting_name = (
                f"{submitting_initials} {submitting_surname.title()}"  # J.P. Smith
            )
            requesting_name = (
                f"{requesting_initials} {requesting_surname.title()}"  # A.B. Jones
            )

        elif pattern_name == "comma":
            # Comma pattern: groups are different
            submitting_rank = match.group(1).strip()
            submitting_badge = match.group(2).strip()
            submitting_lastname = match.group(3).strip()
            submitting_firstname = match.group(4).strip()
            requesting_rank = match.group(5).strip()
            requesting_badge = match.group(6).strip()
            requesting_lastname = match.group(7).strip()
            requesting_firstname = match.group(8).strip()
            organization = match.group(9).strip()

            # Format names properly
            submitting_name = f"{submitting_firstname} {submitting_lastname.title()}"
            requesting_name = f"{requesting_firstname} {requesting_lastname.title()}"

        elif pattern_name == "mixed":
            # Mixed pattern: requesting officer has no badge ID
            submitting_rank = match.group(1).strip()
            submitting_name = match.group(2).strip()
            submitting_badge = match.group(3).strip()
            requesting_rank = match.group(4).strip()
            requesting_name = match.group(5).strip()
            requesting_badge = ""  # No badge ID in mixed format
            organization = match.group(6).strip()

        # PATTERN EXTRACTION FOR ENHANCED COMMA-SEPARATED FORMATS
        elif pattern_name == "badge_first_comma":
            # Badge first comma pattern: "Sworn Officer PD0322 GARFIELD, Bexana on Behalf of - Sworn Officer PD46332 ASHSTEAD, Arais of Peel District Office"
            submitting_rank = match.group(1).strip()
            submitting_badge = match.group(2).strip()
            submitting_lastname = match.group(3).strip()
            submitting_firstname = match.group(4).strip()
            requesting_rank = match.group(5).strip()
            requesting_badge = match.group(6).strip()
            requesting_lastname = match.group(7).strip()
            requesting_firstname = match.group(8).strip()
            organization = match.group(9).strip()

            # Format names
            submitting_name = f"{submitting_firstname} {submitting_lastname.title()}"
            requesting_name = f"{requesting_firstname} {requesting_lastname.title()}"

        elif pattern_name == "multiple_spaces_comma":
            # Multiple spaces comma pattern: "Unsworn Officer PD34456  BELSTEAD, David On Behalf Of Sworn Officer..."
            submitting_rank = match.group(1).strip()
            submitting_badge = match.group(2).strip()
            submitting_lastname = match.group(3).strip()
            submitting_firstname = match.group(4).strip()
            requesting_rank = match.group(5).strip()
            requesting_badge = match.group(6).strip()
            requesting_lastname = match.group(7).strip()
            requesting_firstname = match.group(8).strip()
            organization = match.group(9).strip() if match.group(9) else ""

            # Format names
            submitting_name = f"{submitting_firstname} {submitting_lastname.title()}"
            requesting_name = f"{requesting_firstname} {requesting_lastname.title()}"

        elif pattern_name == "comma_after_badge":
            # Comma after badge pattern: "Unsworn Officer PD34456, BELSTEAD, David On Behalf of..."
            submitting_rank = match.group(1).strip()
            submitting_badge = match.group(2).strip()
            submitting_lastname = match.group(3).strip()
            submitting_firstname = match.group(4).strip()
            requesting_rank = match.group(5).strip()
            requesting_badge = match.group(6).strip()
            requesting_lastname = match.group(7).strip()
            requesting_firstname = match.group(8).strip()
            organization = match.group(9).strip() if match.group(9) else ""

            # Format names
            submitting_name = f"{submitting_firstname} {submitting_lastname.title()}"
            requesting_name = f"{requesting_firstname} {requesting_lastname.title()}"

        elif pattern_name == "hyphenated_names":
            # Hyphenated names pattern: "BELLEY, Dunholm-Duncombe"
            submitting_rank = match.group(1).strip()
            submitting_badge = match.group(2).strip()
            submitting_lastname = match.group(3).strip()
            submitting_firstname = match.group(4).strip()  # Dunholm-Duncombe
            requesting_rank = match.group(5).strip()
            requesting_badge = match.group(6).strip()
            requesting_lastname = match.group(7).strip()
            requesting_firstname = match.group(8).strip() if match.group(8) else ""
            organization = match.group(9).strip()

            # Format names (preserve hyphens)
            submitting_name = f"{submitting_firstname} {submitting_lastname.title()}"
            if requesting_firstname:
                requesting_name = (
                    f"{requesting_firstname} {requesting_lastname.title()}"
                )
            else:
                requesting_name = requesting_lastname.title()

        elif pattern_name == "space_in_badge":
            # Space in badge pattern: "Sworn Officer PD 7895 URSULA, Sorrel On Behalf of..."
            submitting_rank = match.group(1).strip()
            submitting_badge_number = match.group(2).strip()  # Just the number part
            submitting_lastname = match.group(3).strip()
            submitting_firstname = match.group(4).strip()
            requesting_rank = match.group(5).strip()
            requesting_badge = match.group(6).strip()
            requesting_lastname = match.group(7).strip()
            requesting_firstname = match.group(8).strip()
            organization = match.group(9).strip()

            # Format badge ID (combine PD with number)
            submitting_badge = f"PD{submitting_badge_number}"

            # Format names
            submitting_name = f"{submitting_firstname} {submitting_lastname.title()}"
            requesting_name = f"{requesting_firstname} {requesting_lastname.title()}"

        elif pattern_name == "missing_badge_number":
            # Missing badge number pattern: "Sworn Officer PD GARFIELD, Bexana On Behalf of..."
            submitting_rank = match.group(1).strip()
            submitting_lastname = match.group(2).strip()
            submitting_firstname = match.group(3).strip()
            requesting_rank = match.group(4).strip()
            requesting_badge = match.group(5).strip()
            requesting_lastname = match.group(6).strip()
            requesting_firstname = match.group(7).strip()
            organization = match.group(8).strip() if match.group(8) else ""

            # No badge ID for submitting officer
            submitting_badge = ""

            # Format names
            submitting_name = f"{submitting_firstname} {submitting_lastname.title()}"
            requesting_name = f"{requesting_firstname} {requesting_lastname.title()}"

        elif pattern_name == "conveying_comma":
            # Conveying comma pattern: "Conveying Officer- Sworn Officer PD7895 URSULA, Sorrel on behalf of..."
            submitting_rank = match.group(1).strip()
            submitting_badge = match.group(2).strip()
            submitting_lastname = match.group(3).strip()
            submitting_firstname = match.group(4).strip()
            requesting_rank = match.group(5).strip()
            requesting_badge = match.group(6).strip()
            requesting_lastname = match.group(7).strip()
            requesting_firstname = match.group(8).strip()
            organization = match.group(9).strip()

            # Format names
            submitting_name = f"{submitting_firstname} {submitting_lastname.title()}"
            requesting_name = f"{requesting_firstname} {requesting_lastname.title()}"

        elif pattern_name == "mixed_case_on_behalf":
            # Mixed case on behalf pattern: case insensitive "On Behalf Of"
            submitting_rank = match.group(1).strip()
            submitting_badge = match.group(2).strip()
            submitting_lastname = match.group(3).strip()
            submitting_firstname = match.group(4).strip()
            requesting_rank = match.group(5).strip()
            requesting_badge = match.group(6).strip()
            requesting_lastname = match.group(7).strip()
            requesting_firstname = match.group(8).strip()
            organization = match.group(9).strip() if match.group(9) else ""

            # Format names
            submitting_name = f"{submitting_firstname} {submitting_lastname.title()}"
            requesting_name = f"{requesting_firstname} {requesting_lastname.title()}"

        # PATTERN EXTRACTION FOR COMPLEX "ON BEHALF VARIATIONS"
        elif pattern_name in ["on_behalf_dash", "on_behalf_dash_space"]:
            # "On Behalf of-" patterns: "Sworn Officer Bexana GARFIELD 0322 On Behalf of-Sworn Officer Dovana CALCOMBE 45716 of Central Metropolitan TIG"
            submitting_rank = match.group(1).strip()
            submitting_first = match.group(2).strip()  # Bexana
            submitting_last = match.group(3).strip()  # GARFIELD
            submitting_badge = match.group(4).strip()
            requesting_rank = match.group(5).strip()
            requesting_first = match.group(6).strip()  # Dovana
            requesting_last = match.group(7).strip()  # CALCOMBE
            requesting_badge = match.group(8).strip()
            organization = match.group(9).strip()

            # Format names
            submitting_name = f"{submitting_first} {submitting_last.title()}"
            requesting_name = f"{requesting_first} {requesting_last.title()}"

        elif pattern_name == "lowercase_name":
            # Lowercase name pattern: "Sworn Officer shane GARFIELD 0322 On Behalf of-Sworn Officer Una CALTON 2177 of OrganIsed Crime Investigation"
            submitting_rank = match.group(1).strip()
            submitting_first = match.group(2).strip().title()  # shane -> Bexana
            submitting_last = match.group(3).strip()  # GARFIELD
            submitting_badge = match.group(4).strip()
            requesting_rank = match.group(5).strip()
            requesting_first = match.group(6).strip()  # Una
            requesting_last = match.group(7).strip()  # CALTON
            requesting_badge = match.group(8).strip()
            organization = match.group(9).strip()

            # Format names
            submitting_name = f"{submitting_first} {submitting_last.title()}"
            requesting_name = f"{requesting_first} {requesting_last.title()}"

        elif pattern_name == "conveying_delegation":
            # Conveying delegation pattern: "Conveying Officer - Senior Constable GARFIELD 0322 on behalf of - S/C KENWORTH of Gang Response Unit"
            submitting_rank = match.group(1).strip()  # Senior Constable
            submitting_surname = match.group(2).strip()  # GARFIELD
            submitting_badge = match.group(3).strip()
            requesting_rank_abbrev = match.group(4).strip()  # S/C
            requesting_surname = match.group(5).strip()  # KENWORTH
            organization = match.group(6).strip()

            # Format names (surnames only in this pattern)
            submitting_name = submitting_surname.title()  # Garfield
            requesting_name = requesting_surname.title()  # Kenworth
            requesting_badge = ""  # No badge ID for requesting officer

            # Expand requesting rank abbreviation
            requesting_rank = self.standardization_engine.expand_rank_abbreviations(
                requesting_rank_abbrev
            )

        elif pattern_name == "sworn_officer_dash":
            # Sworn Officer dash pattern: "Sworn Officer- Verity KENSTEAD 7602 On Behalf of - Sworn Officer Greer GARSTEAD 2609 of South East Metropolitan District Office"
            submitting_rank = match.group(1).strip()  # Sworn Officer
            submitting_first = match.group(2).strip()  # Verity
            submitting_last = match.group(3).strip()  # KENSTEAD
            submitting_badge = match.group(4).strip()
            requesting_rank = match.group(5).strip()  # Sworn Officer
            requesting_first = match.group(6).strip()  # Greer
            requesting_last = match.group(7).strip()  # GARSTEAD
            requesting_badge = match.group(8).strip()
            organization = match.group(9).strip()

            # Format names
            submitting_name = f"{submitting_first} {submitting_last.title()}"
            requesting_name = f"{requesting_first} {requesting_last.title()}"

        elif pattern_name == "no_space_name_badge":
            # No space between name and badge: "Senior Constable KENSTEAD7602 ON BEHALF OF Constable HALHOLM 46611 of Clarkson Police Station"
            submitting_rank = match.group(1).strip()  # Senior Constable
            submitting_surname = match.group(2).strip()  # KENSTEAD
            submitting_badge = match.group(3).strip()  # 7602
            requesting_rank = match.group(4).strip()  # Constable
            requesting_surname = match.group(5).strip()  # HALHOLM
            requesting_badge = match.group(6).strip()  # 46611
            organization = match.group(7).strip()

            # Format names (surnames only)
            submitting_name = submitting_surname.title()  # Kenstead
            requesting_name = requesting_surname.title()  # Halholm

        # PATTERN EXTRACTION FOR ADVANCED DELEGATION AND CONVEYING PATTERNS
        elif pattern_name == "missing_organization":
            # Missing organization pattern: "Sworn Officer Bexana GARFIELD 0322 on behalf of Sworn Officer Jethro CALDALE 0066"
            submitting_rank = match.group(1).strip()
            submitting_first = match.group(2).strip()  # Bexana
            submitting_last = match.group(3).strip()  # GARFIELD
            submitting_badge = match.group(4).strip()
            requesting_rank = match.group(5).strip()
            requesting_first = match.group(6).strip()  # Jethro
            requesting_last = match.group(7).strip()  # CALDALE
            requesting_badge = match.group(8).strip()
            organization = ""  # No organization in this pattern

            # Format names
            submitting_name = f"{submitting_first} {submitting_last.title()}"
            requesting_name = f"{requesting_first} {requesting_last.title()}"

        elif pattern_name in ["conveying_officer_dash", "conveying_officer_case"]:
            # Conveying Officer dash patterns: "Conveying Officer- Sworn Officer Bexana GARFIELD 0322 on behalf of Sworn Officer Silas ELGRAVE 45604 of Organised Crime Divisional Office"
            submitting_rank = match.group(1).strip()
            submitting_first = match.group(2).strip()  # Bexana
            submitting_last = match.group(3).strip()  # GARFIELD
            submitting_badge = match.group(4).strip()
            requesting_rank = match.group(5).strip()
            requesting_first = match.group(6).strip()  # Silas
            requesting_last = match.group(7).strip()  # ELGRAVE
            requesting_badge = match.group(8).strip()
            organization = match.group(9).strip()

            # Format names
            submitting_name = f"{submitting_first} {submitting_last.title()}"
            requesting_name = f"{requesting_first} {requesting_last.title()}"

        elif pattern_name == "conveying_comma_advanced":
            # Advanced conveying comma pattern: "Conveying Officer- Sworn Officer PD7895 URSULA, Sorrel On Behalf of- Sworn Officer PD1109 LANLEY, Raymond of Public Sector Investigations"
            submitting_rank = match.group(1).strip()
            submitting_badge = match.group(2).strip()
            submitting_lastname = match.group(3).strip()  # URSULA
            submitting_firstname = match.group(4).strip()  # Sorrel
            requesting_rank = match.group(5).strip()
            requesting_badge = match.group(6).strip()
            requesting_lastname = match.group(7).strip()  # LANLEY
            requesting_firstname = match.group(8).strip()  # Raymond
            organization = match.group(9).strip()

            # Format names
            submitting_name = f"{submitting_firstname} {submitting_lastname.title()}"
            requesting_name = f"{requesting_firstname} {requesting_lastname.title()}"

        elif pattern_name == "higher_ranks":
            # Higher ranks pattern: "Sworn Officer Verity KENSTEAD 7602 on behalf of Inspector Dovlyn KENCOMBE 0678 of South West District Office"
            submitting_rank = match.group(1).strip()
            submitting_first = match.group(2).strip()  # Verity
            submitting_last = match.group(3).strip()  # KENSTEAD
            submitting_badge = match.group(4).strip()
            requesting_rank = match.group(5).strip()  # Inspector
            requesting_first = match.group(6).strip()  # Dovlyn
            requesting_last = match.group(7).strip()  # KENCOMBE
            requesting_badge = match.group(8).strip()
            organization = match.group(9).strip()

            # Format names
            submitting_name = f"{submitting_first} {submitting_last.title()}"
            requesting_name = f"{requesting_first} {requesting_last.title()}"

        elif pattern_name == "officer_title_typos":
            # Officer title typos pattern: "Sworn Oficer Verity KENSTEAD 7602 On Behalf of- Sworn officer Harriet SOUTH 2351 of East Metropolitan District Office"
            submitting_rank_raw = match.group(1).strip()  # Sworn Oficer
            submitting_first = match.group(2).strip()  # Verity
            submitting_last = match.group(3).strip()  # KENSTEAD
            submitting_badge = match.group(4).strip()
            requesting_rank_raw = match.group(5).strip()  # sworn officer
            requesting_first = match.group(6).strip()  # Harriet
            requesting_last = match.group(7).strip()  # SOUTH
            requesting_badge = match.group(8).strip()
            organization = match.group(9).strip()

            # Fix typos in ranks
            submitting_rank = self._fix_officer_title_typos(submitting_rank_raw)
            requesting_rank = self._fix_officer_title_typos(requesting_rank_raw)

            # Format names
            submitting_name = f"{submitting_first} {submitting_last.title()}"
            requesting_name = f"{requesting_first} {requesting_last.title()}"

        elif pattern_name == "flexible_case":
            # Flexible case pattern: handles various case combinations of "On behalf of"
            submitting_rank = match.group(1).strip()
            submitting_first = match.group(2).strip()
            submitting_last = match.group(3).strip()
            submitting_badge = match.group(4).strip()
            requesting_rank = match.group(5).strip()
            requesting_first = match.group(6).strip()
            requesting_last = match.group(7).strip()
            requesting_badge = match.group(8).strip()
            organization = match.group(9).strip()

            # Format names
            submitting_name = f"{submitting_first} {submitting_last.title()}"
            requesting_name = f"{requesting_first} {requesting_last.title()}"

        else:
            # Main and the_org patterns: standard extraction
            submitting_rank = match.group(1).strip()
            submitting_name = match.group(2).strip()
            submitting_badge = match.group(3).strip()
            requesting_rank = match.group(4).strip()
            requesting_name = match.group(5).strip()
            requesting_badge = match.group(6).strip()
            organization = match.group(7).strip()

        # Standardize ranks (later format typically uses standard ranks, but check anyway)
        submitting_rank_std = self.standardization_engine.expand_rank_abbreviations(
            submitting_rank
        )
        requesting_rank_std = self.standardization_engine.expand_rank_abbreviations(
            requesting_rank
        )

        # Standardize organization
        organization_std = self.standardization_engine.standardize_organization_names(
            organization
        )

        # Format badge IDs (add PD prefix if numeric only)
        submitting_badge_formatted = self._format_badge_id(submitting_badge)
        requesting_badge_formatted = self._format_badge_id(requesting_badge)

        # Format names properly (capitalize first letter of each word)
        submitting_name_formatted = self._format_name(submitting_name)
        requesting_name_formatted = self._format_name(requesting_name)

        # Create parsed result
        result = ParsedOfficerData(
            submitting_officer=ParsedOfficer(
                name=submitting_name_formatted,
                rank=submitting_rank_std,
                badge_id=submitting_badge_formatted,
            ),
            requesting_officer=ParsedOfficer(
                name=requesting_name_formatted,
                rank=requesting_rank_std,
                badge_id=requesting_badge_formatted,
            ),
            organisation=organization_std,
            processing_notes={
                "reason": "successfully_parsed",
                "format_detected": "later_format",
                "pattern_used": pattern_name,
            },
        )

        self.logger.debug(
            f"Row {row_id}: Successfully parsed later format using {pattern_name} pattern"
        )
        return result

    def _format_name(self, name: str) -> str:
        """Format officer name properly"""
        if not name:
            return ""

        # Handle "First LASTNAME" format - capitalize first name, title case last name
        parts = name.split()
        if len(parts) >= 2:
            # First part is first name (capitalize)
            first_name = parts[0].capitalize()
            # Remaining parts are last name (title case)
            last_name_parts = [part.title() for part in parts[1:]]
            return f"{first_name} {' '.join(last_name_parts)}"
        else:
            # Single name - title case
            return name.title()

    def _format_badge_id(self, badge_id: str) -> str:
        """Format badge ID with PD prefix if needed"""
        if not badge_id:
            return ""

        # If it's just numbers, add PD prefix
        if badge_id.isdigit():
            return f"PD{badge_id}"

        return badge_id

    def _create_error_result(
        self, error_type: str, original_text: str, error_msg: str = ""
    ) -> ParsedOfficerData:
        """Create error result for failed parsing"""
        return ParsedOfficerData(
            submitting_officer=ParsedOfficer(),
            requesting_officer=ParsedOfficer(),
            organisation="",
            processing_notes={
                "reason": error_type,
                "format_detected": "later_format",
                "error_message": error_msg,
                "original_text": original_text[:100],  # Truncate for logging
            },
        )


class SingleOfficerParser:
    """Parser for single officer format police officer data: 'Rank Name ID' without 'on behalf of'"""

    def __init__(self, standardization_engine: StandardizationEngine):
        self.logger = logging.getLogger(__name__)
        self.standardization_engine = standardization_engine

        # Compile regex patterns for single officer parsing
        self._compile_patterns()

    def _compile_patterns(self):
        """Compile regex patterns for single officer parsing"""

        # Pattern 1: Standard format "Sworn Officer Bexana GARFIELD 0322"
        self.standard_pattern = re.compile(
            r"^(Sworn\s+Officer|Unsworn\s+Officer)\s+"  # Officer rank
            r"([A-Z][a-z]+(?:\s+[A-Z]+)*)\s+"  # Officer name (First LASTNAME format)
            r"(\d+|PD\d+)$",  # Badge ID (numeric or PD-prefixed)
            re.IGNORECASE,
        )

        # Pattern 2: Comma-separated format "Sworn Officer PD0785 FENMORE, Tristram"
        self.comma_pattern = re.compile(
            r"^(Sworn\s+Officer|Unsworn\s+Officer)\s+"  # Officer rank
            r"(PD\d+|\d+)\s+"  # Badge ID (PD-prefixed or numeric)
            r"([A-Z]+),\s*([A-Z][a-z]+)$",  # Name (LASTNAME, Firstname)
            re.IGNORECASE,
        )

        # Pattern 3: Traditional rank format "Senior Constable Garfield 0322"
        self.traditional_pattern = re.compile(
            r"^(Senior\s+Constable|Police\s+Constable|Detective|Senior\s+Detective|Sergeant|Constable|Acting\s+\w+(?:\s+\w+)?)\s+"  # Traditional rank
            r"([A-Z][a-z']+(?:\s+[A-Z][a-z']+)*)\s+"  # Officer name (allow apostrophes)
            r"(\d+)$",  # Badge ID (numeric)
            re.IGNORECASE,
        )

        # Pattern 4: Abbreviated rank format "S/C BEXANA GARFIELD 0322"
        self.abbreviated_pattern = re.compile(
            r"^([A-Z]+/[A-Z]+|[A-Z]/[A-Z][a-z]+)\s+"  # Abbreviated rank (S/C, S/Constable)
            r"([A-Z]+(?:\s+[A-Z]+)*)\s+"  # Officer name (ALL CAPS format)
            r"(\d+)$",  # Badge ID (numeric)
            re.IGNORECASE,
        )

        # Pattern 5: Prefix format "Conveying Officer- Sworn Officer PD0322 GARFIELD, Bexana"
        self.prefix_pattern = re.compile(
            r"^.*?-\s*"  # Any prefix followed by dash
            r"(Sworn\s+Officer|Unsworn\s+Officer)\s+"  # Officer rank
            r"(PD\d+|\d+)\s+"  # Badge ID
            r"([A-Z]+),\s*([A-Z][a-z]+)$",  # Name (LASTNAME, Firstname)
            re.IGNORECASE,
        )

        # Pattern 6: Missing "Officer" in rank "Sworn Bexana GARFIELD 0322"
        self.missing_officer_pattern = re.compile(
            r"^(Sworn|Unsworn)\s+"  # Rank without "Officer"
            r"([A-Z][a-z]+(?:\s+[A-Z]+)*)\s+"  # Officer name
            r"(\d+|PD\d+)$",  # Badge ID
            re.IGNORECASE,
        )

        # Pattern 7: Initials format "Sworn Officer G.N. ASHHURST 8977"
        self.initials_pattern = re.compile(
            r"^(Sworn\s+Officer|Unsworn\s+Officer)\s+"  # Officer rank
            r"([A-Z]\.[A-Z]\.)\s+"  # Initials (G.N.)
            r"([A-Z]+)\s+"  # Surname
            r"(\d+|PD\d+)$",  # Badge ID
            re.IGNORECASE,
        )

        # Pattern 8: Conveying Officer prefix "Conveying Officer Sworn Officer Bexana GARFIELD 0322"
        self.conveying_officer_pattern = re.compile(
            r"^Conveying\s+Officer\s+"  # Conveying Officer prefix
            r"(Sworn\s+Officer|Unsworn\s+Officer)\s+"  # Officer rank
            r"([A-Z][a-z]+(?:\s+[A-Z]+)*)\s+"  # Officer name
            r"(\d+|PD\d+)$",  # Badge ID
            re.IGNORECASE,
        )

        # PATTERNS FOR "HAS NUMBERS" CATEGORY

        # Pattern 9: Typo in Officer (Sworn Ofiicer PD0101 JONES, David)
        self.typo_officer_pattern = re.compile(
            r"^(Sworn\s+Ofiicer|Unsworn\s+Ofiicer)\s+"  # Typo: Ofiicer → Officer
            r"(PD\d+|\d+)\s+"  # Badge ID
            r"([A-Z]+),\s*([A-Z][a-z]+)$",  # Name (LASTNAME, Firstname)
            re.IGNORECASE,
        )

        # Pattern 10: No space between badge and name (Sworn Officer PD9477ASHMORE, Juniper)
        self.no_space_badge_pattern = re.compile(
            r"^(Sworn\s+Officer|Unsworn\s+Officer)\s+"  # Officer rank
            r"(PD\d+)([A-Z]+),\s*([A-Z][a-z]+)$",  # Badge ID + Name (no space)
            re.IGNORECASE,
        )

        # Pattern 11: Detective with badge (Detective S/C Fenstead 0319)
        self.detective_badge_pattern = re.compile(
            r"^(Detective)\s+"  # Detective rank
            r"([A-Z]/[A-Z])\s+"  # Abbreviated rank (S/C)
            r"([A-Z][a-z]+)\s+"  # Name
            r"(\d+)$",  # Badge ID
            re.IGNORECASE,
        )

        # FINAL OPTIMIZATION PATTERNS

        # Pattern 12: Comma after badge ID in single officer (Unsworn Officer PD85192, BELLEY, Dunholm-Duncombe)
        self.comma_after_badge_single_pattern = re.compile(
            r"^(Sworn\s+Officer|Unsworn\s+Officer)\s+"  # Officer rank
            r"(PD\d+|\d+),\s+"  # Badge ID with comma
            r"([A-Z]+),\s*([A-Z][a-z-]+)$",  # Name (LASTNAME, Firstname) - allow hyphens
            re.IGNORECASE,
        )

        # Multi-part surname pattern (Unsworn Officer PD89190 VAN DER LANTON, Opal)
        self.multi_part_surname_pattern = re.compile(
            r"^(Sworn\s+Officer|Unsworn\s+Officer)\s+"  # Officer rank
            r"(PD\d+|\d+)\s+"  # Badge ID
            r"([A-Z]+(?:\s+[A-Z]+)*),\s*([A-Z][a-z]+)$",  # Multi-part surname (VAN DER LANTON, Opal)
            re.IGNORECASE,
        )

        # Pattern 9: No badge ID format "S/Constable Bexana GARFIELD"
        self.no_badge_pattern = re.compile(
            r"^([A-Z]+/[A-Z][a-z]+|Senior\s+Constable|Police\s+Constable|Detective|Sergeant|Constable)\s+"  # Rank
            r"([A-Z][a-z]+(?:\s+[A-Z]+)*)$",  # Officer name (no badge ID)
            re.IGNORECASE,
        )

        # Pattern 10: PD prefix with comma "Sworn Officer PD GARFIELD, Bexana"
        self.pd_comma_pattern = re.compile(
            r"^(Sworn\s+Officer|Unsworn\s+Officer)\s+"  # Officer rank
            r"PD\s+"  # PD prefix with space
            r"([A-Z]+),\s*([A-Z][a-z]+)$",  # Name (LASTNAME, Firstname)
            re.IGNORECASE,
        )

        # Pattern 11: Dash after rank "Sworn Officer - Bexana GARFIELD 0322"
        self.dash_after_rank_pattern = re.compile(
            r"^(Sworn\s+Officer|Unsworn\s+Officer)\s*-\s+"  # Officer rank with dash
            r"([A-Z][a-z]+(?:\s+[A-Z]+)*)\s+"  # Officer name
            r"(\d+|PD\d+)$",  # Badge ID
            re.IGNORECASE,
        )

        # Pattern 12: No space between name and badge ID "Sworn Officer Verity KENSTEAD7602"
        self.no_space_badge_pattern = re.compile(
            r"^(Sworn\s+Officer|Unsworn\s+Officer)\s+"  # Officer rank
            r"([A-Z][a-z]+)\s+"  # First name
            r"([A-Z]+)(\d+|PD\d+)$",  # Surname + badge ID (no space)
            re.IGNORECASE,
        )

        # Pattern 13: PD with space and badge ID "Sworn Officer PD 0322 GARFIELD, Bexana"
        self.pd_space_badge_pattern = re.compile(
            r"^(Sworn\s+Officer|Unsworn\s+Officer)\s+"  # Officer rank
            r"PD\s+(\d+)\s+"  # PD with space and badge ID
            r"([A-Z]+),\s*([A-Z][a-z]+)$",  # Name (LASTNAME, Firstname)
            re.IGNORECASE,
        )

        # PATTERNS FOR "HAS NUMBERS" CATEGORY - CONVEYING OFFICER VARIATIONS

        # Pattern 14: Conveying Officer with dash and no space "Conveying Officer- Sworn Officer Bexana GARFIELD 0322"
        self.conveying_no_space_pattern = re.compile(
            r"^Conveying\s+Officer-\s*"  # Conveying Officer- (no space before dash)
            r"(Sworn\s+Officer|Unsworn\s+Officer)\s+"  # Officer rank
            r"([A-Z][a-z]+(?:\s+[A-Z]+)*)\s+"  # Officer name (First LASTNAME or First Last)
            r"(\d+|PD\d+)$",  # Badge ID
            re.IGNORECASE,
        )

        # Pattern 15: Conveying Officer with dash and space "Conveying Officer - Sworn Officer Bexana GARFIELD 0322"
        self.conveying_with_space_pattern = re.compile(
            r"^Conveying\s+Officer\s+-\s*"  # Conveying Officer - (space before dash)
            r"(Sworn\s+Officer|Unsworn\s+Officer)\s+"  # Officer rank
            r"([A-Z][a-z]+(?:\s+[A-Z]+)*)\s+"  # Officer name (First LASTNAME or First Last)
            r"(\d+|PD\d+)$",  # Badge ID
            re.IGNORECASE,
        )

        # Pattern 16: Conveying Officer with mixed case names "Conveying Officer - Sworn Officer Bexana Garfield 0322"
        self.conveying_mixed_case_pattern = re.compile(
            r"^Conveying\s+Officer\s*-?\s*"  # Conveying Officer with optional dash
            r"(Sworn\s+Officer|Unsworn\s+Officer)\s+"  # Officer rank
            r"([A-Z][a-z]+)\s+"  # First name (Title case)
            r"([A-Z][a-z]+)\s+"  # Last name (Title case)
            r"(\d+|PD\d+)$",  # Badge ID
            re.IGNORECASE,
        )

        # Pattern 17: Simple Conveying Officer with traditional rank "Conveying Officer Constable ELHOLM 45722"
        self.conveying_traditional_pattern = re.compile(
            r"^Conveying\s+Officer\s+"  # Conveying Officer prefix
            r"(Senior\s+Constable|Police\s+Constable|Detective|Sergeant|Constable)\s+"  # Traditional rank
            r"([A-Z]+)\s+"  # Officer surname (ALL CAPS)
            r"(\d+|PD\d+)$",  # Badge ID
            re.IGNORECASE,
        )

        # PATTERNS FOR REMAINING "HAS NUMBERS" CATEGORY

        # Pattern 17: No space between badge and name "Sworn Officer PD9477ASHMORE, Juniper"
        self.no_space_badge_name_pattern = re.compile(
            r"^(Sworn\s+Officer|Unsworn\s+Officer)\s+"  # Officer rank
            r"(PD\d+)([A-Z]+),\s*([A-Z][a-z]+)$",  # Badge ID + Name (no space)
            re.IGNORECASE,
        )

        # Pattern 18: Detective with rank and badge "Detective Senior Constable 45565 INGRID, Ty"
        self.detective_rank_badge_pattern = re.compile(
            r"^(Detective)\s+"  # Detective prefix
            r"(Senior\s+Constable|Police\s+Constable|Constable)\s+"  # Rank
            r"(PD\d+|\d+)\s+"  # Badge ID
            r"([A-Z]+),\s*([A-Z][a-z]+)$",  # Name (LASTNAME, Firstname)
            re.IGNORECASE,
        )

        # Pattern 19: "For" instead of "on behalf of" "Constable PD47332 BREACH, Godric for Detective Senior Constable PD45383 KNIGHT, David"
        self.for_delegation_pattern = re.compile(
            r"^(Constable|Senior\s+Constable|Police\s+Constable|Detective|Sergeant)\s+"  # Submitting rank
            r"(PD\d+|\d+)\s+"  # Submitting badge ID
            r"([A-Z]+),\s*([A-Z][a-z]+)\s+"  # Submitting name (LASTNAME, Firstname)
            r"for\s+"  # "for" instead of "on behalf of"
            r"(Detective\s+Senior\s+Constable|Detective|Senior\s+Constable|Police\s+Constable|Constable|Sergeant)\s+"  # Requesting rank
            r"(PD\d+|\d+)\s+"  # Requesting badge ID
            r"([A-Z]+),\s*([A-Z][a-z]+)$",  # Requesting name (LASTNAME, Firstname)
            re.IGNORECASE,
        )

        # PATTERNS FOR COMPLEX "HAS NUMBERS" PATTERNS

        # Pattern 20: Single officer with embedded badge ID "Sworn Officer PD0785 FENMORE Tristram"
        self.embedded_badge_pattern = re.compile(
            r"^(Sworn\s+Officer|Unsworn\s+Officer)\s+"  # Officer rank
            r"(PD\d+)\s+"  # Badge ID (PD-prefixed)
            r"([A-Z]+)\s+"  # Surname (ALL CAPS)
            r"([A-Z][a-z]+)$",  # First name (Title case)
            re.IGNORECASE,
        )

        # Pattern 21: Single officer with typo "Sworn Offiicer PD1028 GARCOMBE Felix"
        self.typo_embedded_badge_pattern = re.compile(
            r"^(Sworn\s+Offiicer|Unsworn\s+Offiicer)\s+"  # Officer rank with typo
            r"(PD\d+)\s+"  # Badge ID (PD-prefixed)
            r"([A-Z]+)\s+"  # Surname (ALL CAPS)
            r"([A-Z][a-z]+)$",  # First name (Title case)
            re.IGNORECASE,
        )

        # Pattern 22: Single officer with numeric badge "Sworn Officer 0785 FENMORE Tristram"
        self.numeric_embedded_badge_pattern = re.compile(
            r"^(Sworn\s+Officer|Unsworn\s+Officer)\s+"  # Officer rank
            r"(\d+)\s+"  # Badge ID (numeric only)
            r"([A-Z]+)\s+"  # Surname (ALL CAPS)
            r"([A-Z][a-z]+)$",  # First name (Title case)
            re.IGNORECASE,
        )

        # PATTERNS FOR REMAINING SINGLE OFFICER "HAS NUMBERS" PATTERNS

        # Pattern 23: Badge ID at end of name "Senior Constable ASHCOMBE PD45554"
        self.badge_at_end_pattern = re.compile(
            r"^(Senior\s+Constable|Police\s+Constable|Detective|Sergeant|Constable)\s+"  # Traditional rank
            r"([A-Z]+)\s+"  # Surname (ALL CAPS)
            r"(PD\d+|\d+)$",  # Badge ID at end
            re.IGNORECASE,
        )

        # Pattern 24: Comma with badge at end "Sergeant GARWORTH, Petra PD8606"
        self.comma_badge_at_end_pattern = re.compile(
            r"^(Senior\s+Constable|Police\s+Constable|Detective|Sergeant|Constable)\s+"  # Traditional rank
            r"([A-Z]+),\s*"  # Surname with comma
            r"([A-Z][a-z]+)\s+"  # First name
            r"(PD\d+|\d+)$",  # Badge ID at end
            re.IGNORECASE,
        )

        # Pattern 25: Multiple typos "Sworn Officeer PD1028 GARCOMBE Felix" (double 'e')
        self.multiple_typos_pattern = re.compile(
            r"^(Sworn\s+Officeer|Unsworn\s+Officeer)\s+"  # Officer rank with double 'e' typo
            r"(PD\d+|\d+)\s+"  # Badge ID
            r"([A-Z]+)\s+"  # Surname (ALL CAPS)
            r"([A-Z][a-z]+)$",  # First name (Title case)
            re.IGNORECASE,
        )

        # Pattern 26: "For" delegation patterns "Constable PD47332 BREACH, Godric for Detective Senior Constable PD45383 KNIGHT, David"
        self.for_delegation_single_pattern = re.compile(
            r"^(Constable|Senior\s+Constable|Police\s+Constable|Detective|Sergeant)\s+"  # Submitting rank
            r"(PD\d+|\d+)\s+"  # Submitting badge ID
            r"([A-Z]+),\s*([A-Z][a-z]+)\s+"  # Submitting name (LASTNAME, Firstname)
            r"for\s+"  # "for" instead of "on behalf of"
            r"(Detective\s+Senior\s+Constable|Detective|Senior\s+Constable|Police\s+Constable|Constable|Sergeant)\s+"  # Requesting rank
            r"(PD\d+|\d+)\s+"  # Requesting badge ID
            r"([A-Z]+),\s*([A-Z][a-z]+)$",  # Requesting name (LASTNAME, Firstname)
            re.IGNORECASE,
        )

        # Pattern 27: Single officer with organization "Sworn Officer PD423983 CALMORE Isolde, of Great Southern District Office"
        self.single_with_org_pattern = re.compile(
            r"^(Sworn\s+Officer|Unsworn\s+Officer)\s+"  # Officer rank
            r"(PD\d+|\d+)\s+"  # Badge ID
            r"([A-Z]+)\s+"  # Surname (ALL CAPS)
            r"([A-Z][a-z]+),?\s+"  # First name with optional comma
            r"of\s+(.+)$",  # Organization
            re.IGNORECASE,
        )

        # Pattern 28: Detective with "from" organization "Detective Senior Constable 2554 GARLEY Ottilie from South West Detectives Office"
        self.detective_from_org_pattern = re.compile(
            r"^(Detective\s+Senior\s+Constable|Detective)\s+"  # Detective rank
            r"(PD\d+|\d+)\s+"  # Badge ID
            r"([A-Z]+)\s+"  # Surname (ALL CAPS)
            r"([A-Z][a-z]+)\s+"  # First name
            r"from\s+(.+)$",  # Organization with "from"
            re.IGNORECASE,
        )

        # Pattern 29: Comma after badge ID "Unsworn Officer PD34456, BELSTEAD, David"
        self.comma_after_badge_pattern = re.compile(
            r"^(Sworn\s+Officer|Unsworn\s+Officer)\s+"  # Officer rank
            r"(PD\d+|\d+),\s+"  # Badge ID with comma
            r"([A-Z]+),\s*([A-Z][a-z]+)$",  # Name (LASTNAME, Firstname)
            re.IGNORECASE,
        )

        # FINAL OPTIMIZATION PATTERNS FOR PRODUCTION QUALITY (95%+)

        # Pattern 30: Chemist pattern "Chemist, Mr. Arlo De Lavinia #55925"
        self.chemist_pattern = re.compile(
            r"^Chemist,\s+Mr\.\s+"  # Chemist, Mr.
            r"([A-Z][a-z]+)\s+"  # First name
            r"([A-Z][a-z]+\s+[A-Z][a-z]+)\s+"  # Full name (De Lavinia)
            r"#(\d+)$",  # Badge number with #
            re.IGNORECASE,
        )

        # Pattern 31: Simple single officer without badge "Sworn Officer Bexana GARFIELD"
        self.simple_single_pattern = re.compile(
            r"^(Sworn\s+Officer|Unsworn\s+Officer)\s+"  # Officer rank
            r"([A-Z][a-z]+)\s+"  # First name
            r"([A-Z]+)$",  # Surname (ALL CAPS, no badge ID)
            re.IGNORECASE,
        )

        # Pattern 32: Hyphenated names "Unsworn Officer PD85192 BELLEY, Dunholm-Duncombe"
        self.hyphenated_name_pattern = re.compile(
            r"^(Sworn\s+Officer|Unsworn\s+Officer)\s+"  # Officer rank
            r"(PD\d+|\d+)\s+"  # Badge ID
            r"([A-Z]+),\s*([A-Z][a-z]+-[A-Z][a-z]+)$",  # Hyphenated name (Dunholm-Duncombe)
            re.IGNORECASE,
        )

        # Pattern 33: Hyphenated names without comma "Unsworn Officer PD85192 BELLEY Dunholm-Duncombe"
        self.hyphenated_no_comma_pattern = re.compile(
            r"^(Sworn\s+Officer|Unsworn\s+Officer)\s+"  # Officer rank
            r"(PD\d+|\d+)\s+"  # Badge ID
            r"([A-Z]+)\s+"  # Surname
            r"([A-Z][a-z]+-[A-Z][a-z]+)$",  # Hyphenated first name
            re.IGNORECASE,
        )

        # Pattern 34: Missing badge number after PD "Sworn Officer PD FENMORE Tristram"
        self.missing_badge_number_pattern = re.compile(
            r"^(Sworn\s+Officer|Unsworn\s+Officer)\s+"  # Officer rank
            r"PD\s+"  # PD without number
            r"([A-Z]+)\s+"  # Surname
            r"([A-Z][a-z]+)$",  # First name
            re.IGNORECASE,
        )

    def parse(self, text: str, row_id: int) -> ParsedOfficerData:
        """
        Parse single officer format police officer data
        Returns ParsedOfficerData with extracted information
        """
        self.logger.debug(f"Row {row_id}: Parsing single officer format: '{text}'")

        # Try patterns in order of specificity (PATTERNS FIRST)
        patterns_to_try = [
            # FINAL OPTIMIZATION PATTERNS - HIGHEST PRIORITY
            (self.comma_after_badge_single_pattern, "comma_after_badge_single"),
            # PRODUCTION QUALITY PATTERNS
            (self.multi_part_surname_pattern, "multi_part_surname"),
            # FINAL OPTIMIZATION PATTERNS
            (self.chemist_pattern, "chemist"),
            (self.missing_badge_number_pattern, "missing_badge_number"),
            (self.hyphenated_name_pattern, "hyphenated_name"),
            (self.hyphenated_no_comma_pattern, "hyphenated_no_comma"),
            (self.simple_single_pattern, "simple_single"),
            # Patterns for remaining single officer "Has Numbers" patterns
            (self.badge_at_end_pattern, "badge_at_end"),
            (self.comma_badge_at_end_pattern, "comma_badge_at_end"),
            (self.multiple_typos_pattern, "multiple_typos"),
            (self.for_delegation_single_pattern, "for_delegation_single"),
            (self.single_with_org_pattern, "single_with_org"),
            (self.detective_from_org_pattern, "detective_from_org"),
            (self.comma_after_badge_pattern, "comma_after_badge"),
            # Patterns for complex "Has Numbers" category
            (self.embedded_badge_pattern, "embedded_badge"),
            (self.typo_embedded_badge_pattern, "typo_embedded_badge"),
            (self.numeric_embedded_badge_pattern, "numeric_embedded_badge"),
            # Patterns for "Has Numbers" category
            (self.no_space_badge_name_pattern, "no_space_badge_name"),
            (self.detective_rank_badge_pattern, "detective_rank_badge"),
            (self.for_delegation_pattern, "for_delegation"),
            (self.conveying_no_space_pattern, "conveying_no_space"),
            (self.conveying_with_space_pattern, "conveying_with_space"),
            (self.conveying_mixed_case_pattern, "conveying_mixed_case"),
            (self.conveying_traditional_pattern, "conveying_traditional"),
            (self.typo_officer_pattern, "typo_officer"),
            (self.detective_badge_pattern, "detective_badge"),
            # Existing patterns
            (self.standard_pattern, "standard"),
            (self.dash_after_rank_pattern, "dash_after_rank"),
            (self.no_space_badge_pattern, "no_space_badge"),
            (self.pd_space_badge_pattern, "pd_space_badge"),
            (self.conveying_officer_pattern, "conveying_officer"),
            (self.initials_pattern, "initials"),
            (self.missing_officer_pattern, "missing_officer"),
            (self.comma_pattern, "comma"),
            (self.pd_comma_pattern, "pd_comma"),
            (self.traditional_pattern, "traditional"),
            (self.abbreviated_pattern, "abbreviated"),
            (self.prefix_pattern, "prefix"),
            (self.no_badge_pattern, "no_badge"),
        ]

        for pattern, pattern_name in patterns_to_try:
            match = pattern.match(text)
            if match:
                self.logger.debug(f"Row {row_id}: Matched {pattern_name} pattern")
                try:
                    return self._extract_from_match(match, pattern_name, text, row_id)
                except Exception as e:
                    self.logger.warning(
                        f"Row {row_id}: Error with {pattern_name} pattern: {str(e)}"
                    )
                    continue

        # No pattern matched
        return self._create_error_result("no_pattern_match", text)

    def _extract_from_match(
        self, match, pattern_name: str, text: str, row_id: int
    ) -> ParsedOfficerData:
        """Extract officer data from regex match based on pattern type"""

        # FINAL OPTIMIZATION PATTERN HANDLING
        if pattern_name == "comma_after_badge_single":
            # Comma after badge ID in single officer: "Unsworn Officer PD85192, BELLEY, Dunholm-Duncombe"
            rank = match.group(1).strip()  # Unsworn Officer
            badge_id = match.group(2).strip()  # PD85192
            lastname = match.group(3).strip()  # BELLEY
            firstname = match.group(4).strip()  # Dunholm-Duncombe (allow hyphens)
            name = f"{firstname} {lastname.title()}"  # "Dunholm-Duncombe Belley"

            # Single officer - no requesting officer or organization
            requesting_name = ""
            requesting_rank = ""
            requesting_badge = ""
            organization = ""

        # PRODUCTION QUALITY PATTERN HANDLING FOR REMAINING FAILURES
        elif pattern_name == "multi_part_surname":
            # Multi-part surname: "Unsworn Officer PD89190 VAN DER LANTON, Opal"
            rank = match.group(1).strip()  # Unsworn Officer
            badge_id = match.group(2).strip()  # PD89190
            lastname = match.group(3).strip()  # VAN DER LANTON
            firstname = match.group(4).strip()  # Opal

            # Format name
            name = f"{firstname} {lastname.title()}"

            # Single officer - no requesting officer or organization
            requesting_name = ""
            requesting_rank = ""
            requesting_badge = ""
            organization = ""

        # FINAL OPTIMIZATION PATTERN HANDLING FOR PRODUCTION QUALITY (95%+)
        elif pattern_name == "chemist":
            # Chemist pattern: "Chemist, Mr. Arlo De Lavinia #55925"
            firstname = match.group(1).strip()  # Arlo
            fullname = match.group(2).strip()  # De Lavinia
            badge_id = match.group(3).strip()  # 55925
            rank = "Chemist"
            name = f"{firstname} {fullname}"  # "Arlo De Lavinia"

        elif pattern_name == "simple_single":
            # Simple single officer: "Sworn Officer Bexana GARFIELD"
            rank = match.group(1).strip()  # Sworn Officer
            firstname = match.group(2).strip()  # Bexana
            surname = match.group(3).strip()  # GARFIELD
            badge_id = ""  # No badge ID
            name = f"{firstname} {surname.title()}"  # "Bexana Garfield"

        elif pattern_name == "hyphenated_name":
            # Hyphenated name with comma: "Unsworn Officer PD85192 BELLEY, Dunholm-Duncombe"
            rank = match.group(1).strip()  # Unsworn Officer
            badge_id = match.group(2).strip()  # PD85192
            surname = match.group(3).strip()  # BELLEY
            firstname = match.group(4).strip()  # Dunholm-Duncombe
            name = f"{firstname} {surname.title()}"  # "Dunholm-Duncombe Belley"

        elif pattern_name == "hyphenated_no_comma":
            # Hyphenated name without comma: "Unsworn Officer PD85192 BELLEY Dunholm-Duncombe"
            rank = match.group(1).strip()  # Unsworn Officer
            badge_id = match.group(2).strip()  # PD85192
            surname = match.group(3).strip()  # BELLEY
            firstname = match.group(4).strip()  # Dunholm-Duncombe
            name = f"{firstname} {surname.title()}"  # "Dunholm-Duncombe Belley"

        elif pattern_name == "missing_badge_number":
            # Missing badge number after PD: "Sworn Officer PD FENMORE Tristram"
            rank = match.group(1).strip()  # Sworn Officer
            surname = match.group(2).strip()  # FENMORE
            firstname = match.group(3).strip()  # Tristram
            badge_id = ""  # No badge number
            name = f"{firstname} {surname.title()}"  # "Tristram Fenmore"

        # PATTERN HANDLING FOR REMAINING SINGLE OFFICER "HAS NUMBERS" PATTERNS
        elif pattern_name == "badge_at_end":
            # Badge ID at end pattern: "Senior Constable ASHCOMBE PD45554"
            rank = match.group(1).strip()  # Senior Constable
            surname = match.group(2).strip()  # ASHCOMBE
            badge_id = match.group(3).strip()  # PD45554
            name = surname.title()  # Convert to "Ashcombe"

        elif pattern_name == "comma_badge_at_end":
            # Comma with badge at end pattern: "Sergeant GARWORTH, Petra PD8606"
            rank = match.group(1).strip()  # Sergeant
            lastname = match.group(2).strip()  # GARWORTH
            firstname = match.group(3).strip()  # Petra
            badge_id = match.group(4).strip()  # PD8606
            name = f"{firstname} {lastname.title()}"  # Convert to "Petra Garworth"

        elif pattern_name == "multiple_typos":
            # Multiple typos pattern: "Sworn Officeer PD1028 GARCOMBE Felix" (double 'e')
            rank_with_typo = match.group(1).strip()  # Sworn Officeer
            badge_id = match.group(2).strip()  # PD1028
            surname = match.group(3).strip()  # GARCOMBE
            firstname = match.group(4).strip()  # Felix
            # Fix the typo in rank
            rank = rank_with_typo.replace("Officeer", "Officer")  # Fix double 'e' typo
            name = f"{firstname} {surname.title()}"  # Convert to "Felix Garcombe"

        elif pattern_name == "for_delegation_single":
            # "For" delegation pattern: "Constable PD47332 BREACH, Godric for Detective Senior Constable PD45383 KNIGHT, David"
            # This is actually a delegation pattern, but it's in the single officer parser
            # We need to return it as a delegation with both officers
            submitting_rank = match.group(1).strip()  # Constable
            submitting_badge = match.group(2).strip()  # PD47332
            submitting_lastname = match.group(3).strip()  # BREACH
            submitting_firstname = match.group(4).strip()  # Godric
            requesting_rank = match.group(5).strip()  # Detective Senior Constable
            requesting_badge = match.group(6).strip()  # PD45383
            requesting_lastname = match.group(7).strip()  # KNIGHT
            requesting_firstname = match.group(8).strip()  # David

            # Format names
            submitting_name = f"{submitting_firstname} {submitting_lastname.title()}"
            requesting_name = f"{requesting_firstname} {requesting_lastname.title()}"

            # Return as delegation structure
            return ParsedOfficerData(
                submitting_officer=ParsedOfficer(
                    name=submitting_name,
                    rank=submitting_rank,
                    badge_id=submitting_badge,
                ),
                requesting_officer=ParsedOfficer(
                    name=requesting_name,
                    rank=requesting_rank,
                    badge_id=requesting_badge,
                ),
                organisation="",
                processing_notes={
                    "reason": "successfully_parsed",
                    "format_detected": "single_officer",
                    "pattern_used": pattern_name,
                    "confidence": 0.95,
                },
            )

        elif pattern_name == "single_with_org":
            # Single officer with organization pattern: "Sworn Officer PD423983 CALMORE Isolde, of Great Southern District Office"
            rank = match.group(1).strip()  # Sworn Officer
            badge_id = match.group(2).strip()  # PD423983
            surname = match.group(3).strip()  # CALMORE
            firstname = match.group(4).strip()  # Isolde
            organization = match.group(5).strip()  # Great Southern District Office
            name = f"{firstname} {surname.title()}"  # Convert to "Isolde Calmore"

            # Return with organization
            return ParsedOfficerData(
                submitting_officer=ParsedOfficer(
                    name=name,
                    rank=rank,
                    badge_id=badge_id,
                ),
                requesting_officer=ParsedOfficer(
                    name="",
                    rank="",
                    badge_id="",
                ),
                organisation=organization,
                processing_notes={
                    "reason": "successfully_parsed",
                    "format_detected": "single_officer",
                    "pattern_used": pattern_name,
                    "confidence": 0.95,
                },
            )

        elif pattern_name == "detective_from_org":
            # Detective with "from" organization pattern: "Detective Senior Constable 2554 GARLEY Ottilie from South West Detectives Office"
            rank = match.group(1).strip()  # Detective Senior Constable
            badge_id = match.group(2).strip()  # 2554
            surname = match.group(3).strip()  # GARLEY
            firstname = match.group(4).strip()  # Ottilie
            organization = match.group(5).strip()  # South West Detectives Office
            name = f"{firstname} {surname.title()}"  # Convert to "Ottilie Garley"

            # Add PD prefix to numeric badge for consistency
            if badge_id.isdigit():
                badge_id = f"PD{badge_id}"

            # Return with organization
            return ParsedOfficerData(
                submitting_officer=ParsedOfficer(
                    name=name,
                    rank=rank,
                    badge_id=badge_id,
                ),
                requesting_officer=ParsedOfficer(
                    name="",
                    rank="",
                    badge_id="",
                ),
                organisation=organization,
                processing_notes={
                    "reason": "successfully_parsed",
                    "format_detected": "single_officer",
                    "pattern_used": pattern_name,
                    "confidence": 0.95,
                },
            )

        elif pattern_name == "comma_after_badge":
            # Comma after badge ID pattern: "Unsworn Officer PD34456, BELSTEAD, David"
            rank = match.group(1).strip()  # Unsworn Officer
            badge_id = match.group(2).strip()  # PD34456
            lastname = match.group(3).strip()  # BELSTEAD
            firstname = match.group(4).strip()  # David
            name = f"{firstname} {lastname.title()}"  # Convert to "David Belstead"

        # PATTERN HANDLING
        elif pattern_name == "conveying_no_space":
            # Conveying Officer no space pattern: "Conveying Officer- Sworn Officer Bexana GARFIELD 0322"
            rank = match.group(1).strip()  # Sworn Officer
            name = match.group(2).strip()  # Bexana GARFIELD
            badge_id = match.group(3).strip()  # 0322

        elif pattern_name == "conveying_with_space":
            # Conveying Officer with space pattern: "Conveying Officer - Sworn Officer Bexana GARFIELD 0322"
            rank = match.group(1).strip()  # Sworn Officer
            name = match.group(2).strip()  # Bexana GARFIELD
            badge_id = match.group(3).strip()  # 0322

        elif pattern_name == "conveying_mixed_case":
            # Conveying Officer mixed case pattern: "Conveying Officer - Sworn Officer Bexana Garfield 0322"
            rank = match.group(1).strip()  # Sworn Officer
            first_name = match.group(2).strip()  # Bexana
            last_name = match.group(3).strip()  # Garfield
            badge_id = match.group(4).strip()  # 0322
            name = f"{first_name} {last_name.upper()}"  # Convert to "Bexana GARFIELD" format

        elif pattern_name == "conveying_traditional":
            # Conveying Officer traditional pattern: "Conveying Officer Constable ELHOLM 45722"
            rank = match.group(1).strip()  # Constable
            surname = match.group(2).strip()  # ELHOLM
            badge_id = match.group(3).strip()  # 45722
            name = surname.title()  # Convert to "Elholm"

        elif pattern_name == "no_space_badge_name":
            # No space between badge and name pattern: "Sworn Officer PD9477ASHMORE, Juniper"
            rank = match.group(1).strip()  # Sworn Officer
            badge_id = match.group(2).strip()  # PD9477
            lastname = match.group(3).strip()  # ASHMORE
            firstname = match.group(4).strip()  # Juniper
            name = f"{firstname} {lastname.title()}"  # Convert to "Juniper Ashmore"

        elif pattern_name == "detective_rank_badge":
            # Detective with rank and badge pattern: "Detective Senior Constable 45565 INGRID, Ty"
            detective_prefix = match.group(1).strip()  # Detective
            rank_suffix = match.group(2).strip()  # Senior Constable
            badge_id = match.group(3).strip()  # 45565
            lastname = match.group(4).strip()  # INGRID
            firstname = match.group(5).strip()  # Ty
            rank = f"{detective_prefix} {rank_suffix}"  # Detective Senior Constable
            name = f"{firstname} {lastname.title()}"  # Convert to "Ty Ingrid"

        elif pattern_name == "for_delegation":
            # "For" delegation pattern: "Constable PD47332 BREACH, Godric for Detective Senior Constable PD45383 KNIGHT, David"
            # This is actually a delegation pattern, but it's in the single officer parser
            # We need to return it as a delegation with both officers
            submitting_rank = match.group(1).strip()  # Constable
            submitting_badge = match.group(2).strip()  # PD47332
            submitting_lastname = match.group(3).strip()  # BREACH
            submitting_firstname = match.group(4).strip()  # Godric
            requesting_rank = match.group(5).strip()  # Detective Senior Constable
            requesting_badge = match.group(6).strip()  # PD45383
            requesting_lastname = match.group(7).strip()  # KNIGHT
            requesting_firstname = match.group(8).strip()  # David

            # Format names
            submitting_name = f"{submitting_firstname} {submitting_lastname.title()}"
            requesting_name = f"{requesting_firstname} {requesting_lastname.title()}"

            # Return as delegation structure
            return ParsedOfficerData(
                submitting_officer=ParsedOfficer(
                    name=submitting_name,
                    rank=submitting_rank,
                    badge_id=submitting_badge,
                ),
                requesting_officer=ParsedOfficer(
                    name=requesting_name,
                    rank=requesting_rank,
                    badge_id=requesting_badge,
                ),
                organisation="",
                processing_notes={
                    "reason": "successfully_parsed",
                    "format_detected": "single_officer",
                    "pattern_used": pattern_name,
                    "confidence": 0.95,
                },
            )

        # PATTERN HANDLING FOR COMPLEX "HAS NUMBERS" PATTERNS
        elif pattern_name == "embedded_badge":
            # Single officer with embedded badge ID: "Sworn Officer PD0785 FENMORE Tristram"
            rank = match.group(1).strip()  # Sworn Officer
            badge_id = match.group(2).strip()  # PD0785
            surname = match.group(3).strip()  # FENMORE
            firstname = match.group(4).strip()  # Tristram
            name = f"{firstname} {surname.title()}"  # Convert to "Tristram Fenmore"

        elif pattern_name == "typo_embedded_badge":
            # Single officer with typo and embedded badge ID: "Sworn Offiicer PD1028 GARCOMBE Felix"
            rank_with_typo = match.group(1).strip()  # Sworn Offiicer
            badge_id = match.group(2).strip()  # PD1028
            surname = match.group(3).strip()  # GARCOMBE
            firstname = match.group(4).strip()  # Felix
            # Fix the typo in rank
            rank = rank_with_typo.replace("Offiicer", "Officer")  # Fix typo
            name = f"{firstname} {surname.title()}"  # Convert to "Felix Garcombe"

        elif pattern_name == "numeric_embedded_badge":
            # Single officer with numeric badge: "Sworn Officer 0785 FENMORE Tristram"
            rank = match.group(1).strip()  # Sworn Officer
            badge_id = match.group(2).strip()  # 0785
            surname = match.group(3).strip()  # FENMORE
            firstname = match.group(4).strip()  # Tristram
            # Add PD prefix to numeric badge for consistency
            if not badge_id.startswith("PD"):
                badge_id = f"PD{badge_id}"
            name = f"{firstname} {surname.title()}"  # Convert to "Tristram Fenmore"

        elif pattern_name == "typo_officer":
            # Typo Officer pattern: "Sworn Ofiicer PD0101 JONES, David"
            rank = "Sworn Officer"  # Fix typo: Ofiicer → Officer
            badge_id = match.group(2).strip()
            lastname = match.group(3).strip()
            firstname = match.group(4).strip()
            name = f"{firstname} {lastname.title()}"

        elif pattern_name == "detective_badge":
            # Detective with badge pattern: "Detective S/C Fenstead 0319"
            rank_prefix = match.group(1).strip()  # Detective
            rank_abbrev = match.group(2).strip()  # S/C
            name = match.group(3).strip()
            badge_id = match.group(4).strip()
            # Combine ranks: Detective Senior Constable
            rank = f"{rank_prefix} Senior Constable"  # S/C → Senior Constable

        elif pattern_name == "comma":
            # Comma pattern: "Sworn Officer PD0785 FENMORE, Tristram"
            rank = match.group(1).strip()
            badge_id = match.group(2).strip()
            lastname = match.group(3).strip()
            firstname = match.group(4).strip()
            name = f"{firstname} {lastname.title()}"

        elif pattern_name == "pd_comma":
            # PD comma pattern: "Sworn Officer PD GARFIELD, Bexana"
            rank = match.group(1).strip()
            lastname = match.group(2).strip()
            firstname = match.group(3).strip()
            name = f"{firstname} {lastname.title()}"
            badge_id = ""  # No badge ID in this format

        elif pattern_name == "conveying_officer":
            # Conveying Officer pattern: "Conveying Officer Sworn Officer Bexana GARFIELD 0322"
            rank = match.group(1).strip()
            name = match.group(2).strip()
            badge_id = match.group(3).strip()

        elif pattern_name == "initials":
            # Initials pattern: "Sworn Officer G.N. ASHHURST 8977"
            rank = match.group(1).strip()
            initials = match.group(2).strip()
            surname = match.group(3).strip()
            badge_id = match.group(4).strip()
            name = f"{initials} {surname.title()}"

        elif pattern_name == "missing_officer":
            # Missing Officer pattern: "Sworn Bexana GARFIELD 0322"
            rank_partial = match.group(1).strip()
            name = match.group(2).strip()
            badge_id = match.group(3).strip()
            # Add "Officer" to the rank
            rank = f"{rank_partial} Officer"

        elif pattern_name == "no_badge":
            # No badge pattern: "S/Constable Bexana GARFIELD"
            rank = match.group(1).strip()
            name = match.group(2).strip()
            badge_id = ""  # No badge ID

        elif pattern_name == "dash_after_rank":
            # Dash after rank pattern: "Sworn Officer - Bexana GARFIELD 0322"
            rank = match.group(1).strip()
            name = match.group(2).strip()
            badge_id = match.group(3).strip()

        elif pattern_name == "no_space_badge":
            # No space between name and badge ID: "Sworn Officer Verity KENSTEAD7602"
            rank = match.group(1).strip()
            first_name = match.group(2).strip()
            surname = match.group(3).strip()
            badge_id = match.group(4).strip()
            name = f"{first_name} {surname.title()}"

        elif pattern_name == "pd_space_badge":
            # PD with space and badge ID: "Sworn Officer PD 0322 GARFIELD, Bexana"
            rank = match.group(1).strip()
            badge_id = f"PD{match.group(2).strip()}"  # Add PD prefix to badge ID
            lastname = match.group(3).strip()
            firstname = match.group(4).strip()
            name = f"{firstname} {lastname.title()}"

        elif pattern_name == "abbreviated":
            # Abbreviated pattern: "S/C BEXANA GARFIELD 0322"
            rank_abbrev = match.group(1).strip()
            name_caps = match.group(2).strip()
            badge_id = match.group(3).strip()

            # Expand abbreviated rank
            rank = self.standardization_engine.expand_rank_abbreviations(rank_abbrev)

            # Format name from ALL CAPS to proper case
            name = self._format_caps_name(name_caps)

        elif pattern_name == "prefix":
            # Prefix pattern: "Conveying Officer- Sworn Officer PD0322 GARFIELD, Bexana"
            rank = match.group(1).strip()
            badge_id = match.group(2).strip()
            lastname = match.group(3).strip()
            firstname = match.group(4).strip()
            name = f"{firstname} {lastname.title()}"

        else:
            # Standard and traditional patterns: "Sworn Officer Bexana GARFIELD 0322"
            rank = match.group(1).strip()
            name = match.group(2).strip()
            badge_id = match.group(3).strip()

        # Standardize rank
        rank_std = self.standardization_engine.expand_rank_abbreviations(rank)

        # Format badge ID (add PD prefix if numeric only)
        badge_id_formatted = self._format_badge_id(badge_id)

        # Format name properly
        name_formatted = self._format_name(name)

        # Single officer patterns don't have organizations
        organization_std = ""

        # Create parsed result (single officer - no requesting officer)
        result = ParsedOfficerData(
            submitting_officer=ParsedOfficer(
                name=name_formatted,
                rank=rank_std,
                badge_id=badge_id_formatted,
            ),
            requesting_officer=ParsedOfficer(
                name="",
                rank="",
                badge_id="",
            ),  # Empty for single officer
            organisation=organization_std,
            processing_notes={
                "reason": "successfully_parsed",
                "format_detected": "single_officer",
                "pattern_used": pattern_name,
            },
        )

        self.logger.debug(
            f"Row {row_id}: Successfully parsed single officer using {pattern_name} pattern"
        )
        return result

    def _format_caps_name(self, name_caps: str) -> str:
        """Format ALL CAPS name to proper case"""
        if not name_caps:
            return ""

        # Split by spaces and title case each part
        parts = name_caps.split()
        formatted_parts = [part.title() for part in parts]
        return " ".join(formatted_parts)

    def _format_name(self, name: str) -> str:
        """Format officer name properly"""
        if not name:
            return ""

        # Handle "First LASTNAME" format - capitalize first name, title case last name
        parts = name.split()
        if len(parts) >= 2:
            # First part is first name (capitalize)
            first_name = parts[0].capitalize()
            # Remaining parts are last name (title case)
            last_name_parts = [part.title() for part in parts[1:]]
            return f"{first_name} {' '.join(last_name_parts)}"
        else:
            # Single name - title case
            return name.title()

    def _format_badge_id(self, badge_id: str) -> str:
        """Format badge ID with PD prefix if needed"""
        if not badge_id:
            return ""

        # If it's just numbers, add PD prefix
        if badge_id.isdigit():
            return f"PD{badge_id}"

        return badge_id

    def _create_error_result(
        self, error_type: str, original_text: str, error_msg: str = ""
    ) -> ParsedOfficerData:
        """Create error result for failed parsing"""
        return ParsedOfficerData(
            submitting_officer=ParsedOfficer(),
            requesting_officer=ParsedOfficer(),
            organisation="",
            processing_notes={
                "reason": error_type,
                "format_detected": "single_officer",
                "error_message": error_msg,
                "original_text": original_text[:100],  # Truncate for logging
            },
        )


@dataclass
class ProcessingIssue:
    """Container for processing issues and failures"""

    row_id: int
    original_value: str
    issue_type: str
    issue_description: str
    attempted_strategies: List[str] = field(default_factory=list)
    partial_extraction: Dict[str, str] = field(default_factory=dict)
    confidence_score: float = 0.0
    suggested_fix: str = ""


class ErrorAnalyzer:
    """Comprehensive error analysis and pattern identification system"""

    def __init__(self):
        self.logger = logging.getLogger(__name__)
        self.issues = []

    def analyze_processing_results(self, csv_file_path: str) -> Dict[str, Any]:
        """
        Analyze the 8_police_officer.csv file to identify patterns of failures
        Returns comprehensive analysis of what needs fixing
        """
        self.logger.info(
            "Starting comprehensive analysis of police officer processing results"
        )

        try:
            df = pd.read_csv(csv_file_path)
        except Exception as e:
            self.logger.error(f"Could not read CSV file: {str(e)}")
            return {"error": f"Could not read CSV file: {str(e)}"}

        analysis_results = {
            "total_entries": len(df),
            "empty_submitting_officer": [],
            "empty_requesting_officer": [],
            "empty_organisation": [],
            "parsing_failures": [],
            "corruption_patterns": {},
            "partial_parsing_opportunities": [],
            "confidence_distribution": {},
            "format_specific_issues": {},
            "suggested_improvements": [],
        }

        for idx, row in df.iterrows():
            try:
                original_value = row["original_value"]
                processed_value = row["processed_value"]

                # Handle NaN values
                if pd.isna(original_value):
                    original_value = ""
                else:
                    original_value = str(original_value)

                if pd.isna(processed_value) or not str(processed_value).strip():
                    continue

                parsed_data = json.loads(processed_value)
                issue = self._analyze_single_result(idx, original_value, parsed_data)

                if issue:
                    self.issues.append(issue)
                    self._categorize_issue(issue, analysis_results)

            except Exception as e:
                self.logger.warning(f"Error analyzing row {idx}: {str(e)}")
                analysis_results["parsing_failures"].append(
                    {
                        "row_id": idx,
                        "original_value": str(row.get("original_value", "")),
                        "error": str(e),
                        "issue_type": "json_parsing_error",
                    }
                )

        # Generate comprehensive analysis
        self._generate_pattern_analysis(analysis_results)
        self._generate_improvement_suggestions(analysis_results)

        # Save detailed analysis report
        self._save_analysis_report(analysis_results)

        return analysis_results

    def _analyze_single_result(
        self, row_id: int, original_value: str, parsed_data: Dict
    ) -> Optional[ProcessingIssue]:
        """Analyze a single processing result for issues"""

        submitting_officer = parsed_data.get("submitting_officer", {})
        requesting_officer = parsed_data.get("requesting_officer", {})
        organisation = parsed_data.get("organisation", "")
        processing_notes = parsed_data.get("processing_notes", {})

        reason = processing_notes.get("reason", "")
        format_detected = processing_notes.get("format_detected", "")

        # Check for empty submitting officer (should generally always have one unless corrupted)
        if not submitting_officer.get("name", "").strip():
            # Determine if this is expected (corruption) or unexpected (parsing failure)
            if reason in [
                "corrupted_defendant_name",
                "corrupted_description_data",
                "standardized_unknown",
            ]:
                return None  # Expected empty result
            else:
                # Unexpected empty submitting officer - this is an issue
                partial_extraction = self._attempt_partial_extraction(original_value)
                return ProcessingIssue(
                    row_id=row_id,
                    original_value=original_value,
                    issue_type="empty_submitting_officer",
                    issue_description=f"No submitting officer extracted despite reason: {reason}",
                    attempted_strategies=[format_detected],
                    partial_extraction=partial_extraction,
                    confidence_score=0.0,
                    suggested_fix=self._suggest_fix_for_empty_submitting(
                        original_value, reason
                    ),
                )

        # Check for parsing failures
        if reason in ["no_pattern_match", "parsing_error"]:
            partial_extraction = self._attempt_partial_extraction(original_value)
            confidence = self._calculate_confidence_for_partial(partial_extraction)

            return ProcessingIssue(
                row_id=row_id,
                original_value=original_value,
                issue_type="parsing_failure",
                issue_description=f"Failed to parse: {reason}",
                attempted_strategies=[format_detected],
                partial_extraction=partial_extraction,
                confidence_score=confidence,
                suggested_fix=self._suggest_parsing_improvement(
                    original_value, partial_extraction
                ),
            )

        # Check for incomplete parsing (missing expected components)
        if reason == "successfully_parsed":
            missing_components = []

            # For formats that should have requesting officer
            if "on behalf of" in original_value.lower():
                if not requesting_officer.get("name", "").strip():
                    missing_components.append("requesting_officer")
                if not organisation.strip():
                    missing_components.append("organisation")

            if missing_components:
                return ProcessingIssue(
                    row_id=row_id,
                    original_value=original_value,
                    issue_type="incomplete_parsing",
                    issue_description=f"Missing components: {', '.join(missing_components)}",
                    attempted_strategies=[format_detected],
                    partial_extraction={"missing": missing_components},
                    confidence_score=0.5,
                    suggested_fix=f"Improve {format_detected} parser to extract {', '.join(missing_components)}",
                )

        return None

    def _attempt_partial_extraction(self, text: str) -> Dict[str, str]:
        """Attempt to extract any identifiable information from failed parsing"""
        partial = {}

        if not text or not text.strip():
            return partial

        text = text.strip()

        # Look for badge numbers
        badge_patterns = re.findall(r"\b(?:PD)?(\d{3,5})\b", text)
        if badge_patterns:
            partial["potential_badge_ids"] = badge_patterns

        # Look for rank keywords
        rank_keywords = ["constable", "sergeant", "detective", "officer", "inspector"]
        found_ranks = [
            keyword for keyword in rank_keywords if keyword.lower() in text.lower()
        ]
        if found_ranks:
            partial["potential_ranks"] = found_ranks

        # Look for "on behalf of" structure
        if "on behalf of" in text.lower():
            partial["has_delegation"] = "true"
            parts = re.split(r"\bon behalf of\b", text, flags=re.IGNORECASE)
            if len(parts) == 2:
                partial["submitting_part"] = parts[0].strip()
                partial["requesting_part"] = parts[1].strip()

        # Look for organization indicators
        org_indicators = ["police", "detectives", "district", "office", "unit", "group"]
        found_orgs = [
            indicator
            for indicator in org_indicators
            if indicator.lower() in text.lower()
        ]
        if found_orgs:
            partial["potential_organization_indicators"] = found_orgs

        # Look for name patterns (capitalized words)
        name_patterns = re.findall(r"\b[A-Z][a-z]+\b", text)
        if name_patterns:
            partial["potential_names"] = name_patterns

        return partial

    def _calculate_confidence_for_partial(
        self, partial_extraction: Dict[str, str]
    ) -> float:
        """Calculate confidence score based on partial extraction success"""
        confidence = 0.0

        if partial_extraction.get("potential_badge_ids"):
            confidence += 0.3
        if partial_extraction.get("potential_ranks"):
            confidence += 0.2
        if partial_extraction.get("has_delegation"):
            confidence += 0.2
        if partial_extraction.get("potential_names"):
            confidence += 0.2
        if partial_extraction.get("potential_organization_indicators"):
            confidence += 0.1

        return min(confidence, 1.0)

    def _suggest_fix_for_empty_submitting(
        self, original_value: str, reason: str
    ) -> str:
        """Suggest specific fixes for empty submitting officer issues"""

        if ";" in original_value:
            return "Handle semicolon separator in officer names"
        elif "on behalf of" not in original_value.lower():
            return "Improve single officer format detection and parsing"
        elif re.search(r"\d+", original_value):
            return "Enhance badge ID extraction and officer name parsing"
        else:
            return f"Review {reason} logic - may need additional parsing patterns"

    def _suggest_parsing_improvement(
        self, original_value: str, partial_extraction: Dict
    ) -> str:
        """Suggest specific parsing improvements based on partial extraction"""

        suggestions = []

        if partial_extraction.get("potential_badge_ids") and partial_extraction.get(
            "potential_names"
        ):
            suggestions.append("Add pattern for badge ID and name combination")

        if partial_extraction.get("has_delegation"):
            if ";" in original_value:
                suggestions.append("Handle semicolon punctuation in delegation format")
            else:
                suggestions.append("Improve delegation format parsing patterns")

        if not partial_extraction:
            suggestions.append(
                "Consider if this is actually corrupted data that should be flagged"
            )

        return "; ".join(suggestions) if suggestions else "Manual review required"

    def _categorize_issue(self, issue: ProcessingIssue, analysis_results: Dict):
        """Categorize issue into analysis results"""

        if issue.issue_type == "empty_submitting_officer":
            analysis_results["empty_submitting_officer"].append(
                {
                    "row_id": issue.row_id,
                    "original_value": issue.original_value,
                    "reason": issue.issue_description,
                    "suggested_fix": issue.suggested_fix,
                    "partial_extraction": issue.partial_extraction,
                }
            )

        elif issue.issue_type == "parsing_failure":
            analysis_results["parsing_failures"].append(
                {
                    "row_id": issue.row_id,
                    "original_value": issue.original_value,
                    "reason": issue.issue_description,
                    "confidence": issue.confidence_score,
                    "partial_extraction": issue.partial_extraction,
                    "suggested_fix": issue.suggested_fix,
                }
            )

        elif issue.issue_type == "incomplete_parsing":
            analysis_results["partial_parsing_opportunities"].append(
                {
                    "row_id": issue.row_id,
                    "original_value": issue.original_value,
                    "missing_components": issue.partial_extraction.get("missing", []),
                    "suggested_fix": issue.suggested_fix,
                }
            )

    def _generate_pattern_analysis(self, analysis_results: Dict):
        """Generate analysis of failure patterns"""

        # Analyze common failure patterns
        failure_patterns = {}

        for failure in analysis_results["parsing_failures"]:
            original = failure["original_value"]

            # Pattern: semicolon issues
            if ";" in original:
                failure_patterns.setdefault("semicolon_punctuation", []).append(failure)

            # Pattern: missing badge ID
            elif "on behalf of" in original.lower() and not re.search(
                r"\d{3,5}", original
            ):
                failure_patterns.setdefault("missing_badge_id", []).append(failure)

            # Pattern: unusual formatting
            elif re.search(r"\b\d+\b.*\b[A-Z][a-z]+\b", original):
                failure_patterns.setdefault("unusual_order", []).append(failure)

            # Pattern: complex organization names
            elif len(original.split()) > 10:
                failure_patterns.setdefault("complex_format", []).append(failure)

            else:
                failure_patterns.setdefault("other", []).append(failure)

        analysis_results["failure_patterns"] = failure_patterns

    def _generate_improvement_suggestions(self, analysis_results: Dict):
        """Generate prioritized improvement suggestions"""

        suggestions = []

        # High priority: Empty submitting officers
        empty_submitting_count = len(analysis_results["empty_submitting_officer"])
        if empty_submitting_count > 0:
            suggestions.append(
                {
                    "priority": "HIGH",
                    "issue": f"{empty_submitting_count} entries with empty submitting officer",
                    "action": "Review and enhance parsing patterns to ensure submitting officer extraction",
                    "affected_rows": [
                        item["row_id"]
                        for item in analysis_results["empty_submitting_officer"][:10]
                    ],
                }
            )

        # Medium priority: Parsing failures with high confidence partial extraction
        high_confidence_failures = [
            f
            for f in analysis_results["parsing_failures"]
            if f.get("confidence", 0) > 0.5
        ]
        if high_confidence_failures:
            suggestions.append(
                {
                    "priority": "MEDIUM",
                    "issue": f"{len(high_confidence_failures)} parsing failures with recoverable information",
                    "action": "Add parsing patterns for high-confidence partial extractions",
                    "affected_rows": [
                        f["row_id"] for f in high_confidence_failures[:10]
                    ],
                }
            )

        # Low priority: Incomplete parsing
        incomplete_count = len(analysis_results["partial_parsing_opportunities"])
        if incomplete_count > 0:
            suggestions.append(
                {
                    "priority": "LOW",
                    "issue": f"{incomplete_count} entries with incomplete parsing",
                    "action": "Enhance existing parsers to extract missing components",
                    "affected_rows": [
                        item["row_id"]
                        for item in analysis_results["partial_parsing_opportunities"][
                            :10
                        ]
                    ],
                }
            )

        analysis_results["suggested_improvements"] = suggestions

    def _save_analysis_report(self, analysis_results: Dict):
        """Save comprehensive analysis report"""

        report_path = DOMAIN_PATH / "error_analysis_report.md"

        try:
            with open(report_path, "w") as f:
                f.write("# Police Officer Processing - Error Analysis Report\n\n")
                f.write(f"Generated: {pd.Timestamp.now()}\n\n")

                # Summary
                f.write("## Summary\n\n")
                f.write(f"- **Total Entries**: {analysis_results['total_entries']:,}\n")
                f.write(
                    f"- **Empty Submitting Officer**: {len(analysis_results['empty_submitting_officer'])}\n"
                )
                f.write(
                    f"- **Parsing Failures**: {len(analysis_results['parsing_failures'])}\n"
                )
                f.write(
                    f"- **Incomplete Parsing**: {len(analysis_results['partial_parsing_opportunities'])}\n\n"
                )

                # Priority Issues
                f.write("## Priority Issues\n\n")
                for suggestion in analysis_results["suggested_improvements"]:
                    f.write(f"### {suggestion['priority']} Priority\n")
                    f.write(f"**Issue**: {suggestion['issue']}\n\n")
                    f.write(f"**Action**: {suggestion['action']}\n\n")
                    f.write(
                        f"**Sample Affected Rows**: {suggestion['affected_rows']}\n\n"
                    )

                # Detailed Analysis
                if analysis_results["empty_submitting_officer"]:
                    f.write("## Empty Submitting Officer Issues\n\n")
                    f.write("| Row ID | Original Value | Suggested Fix |\n")
                    f.write("|--------|----------------|---------------|\n")
                    for item in analysis_results["empty_submitting_officer"][:20]:
                        original_truncated = (
                            item["original_value"][:50] + "..."
                            if len(item["original_value"]) > 50
                            else item["original_value"]
                        )
                        f.write(
                            f"| {item['row_id']} | {original_truncated} | {item['suggested_fix']} |\n"
                        )
                    f.write("\n")

                if analysis_results.get("failure_patterns"):
                    f.write("## Failure Patterns\n\n")
                    for pattern_name, failures in analysis_results[
                        "failure_patterns"
                    ].items():
                        f.write(
                            f"### {pattern_name.replace('_', ' ').title()} ({len(failures)} cases)\n\n"
                        )
                        for failure in failures[:5]:  # Show first 5 examples
                            f.write(
                                f"- Row {failure['row_id']}: `{failure['original_value'][:100]}...`\n"
                            )
                        f.write("\n")

                f.write("## Next Steps\n\n")
                f.write(
                    "1. Address HIGH priority issues first (empty submitting officers)\n"
                )
                f.write(
                    "2. Implement parsing patterns for high-confidence partial extractions\n"
                )
                f.write("3. Enhance existing parsers for incomplete parsing cases\n")
                f.write(
                    "4. Regular monitoring of processing results to catch new patterns\n"
                )

        except Exception as e:
            self.logger.error(f"Error saving analysis report: {str(e)}")
