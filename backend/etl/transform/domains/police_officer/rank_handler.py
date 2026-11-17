"""
Rank handling and standardisation engine for police officer data.

Handles rank abbreviation expansion, organisation name standardisation,
corruption detection, and seniority mapping.
"""

import json
import logging
import re
from pathlib import Path
from typing import Dict, Optional, Tuple

# Get the directory where this module is located
DOMAIN_PATH = Path(__file__).parent
RANK_STANDARDISATION_FILE = DOMAIN_PATH / "rank_standardisation.json"

# Path to existing organization standardization
ORG_STANDARDISATION_FILE = (
    Path(__file__).parent.parent / "organisation" / "standardisation.json"
)

# Path to police officer domain-specific organization standardization
POLICE_ORG_STANDARDISATION_FILE = DOMAIN_PATH / "organisation_standardisation.json"


class StandardizationEngine:
    """Comprehensive standardization engine for police officer data"""

    # Class-level cache to avoid repeated loading
    _rank_config_cache = None
    _org_standardization_cache = None

    def __init__(self):
        self.logger = logging.getLogger(__name__)
        # Use cached versions to avoid repeated loading
        if StandardizationEngine._rank_config_cache is None:
            StandardizationEngine._rank_config_cache = self._load_rank_standardization()
        if StandardizationEngine._org_standardization_cache is None:
            StandardizationEngine._org_standardization_cache = (
                self._load_organization_standardization()
            )

        self.rank_config = StandardizationEngine._rank_config_cache
        self.org_standardization = StandardizationEngine._org_standardization_cache

    def _load_rank_standardization(self) -> Dict:
        """Load rank standardization configuration"""
        try:
            if RANK_STANDARDISATION_FILE.exists():
                with open(RANK_STANDARDISATION_FILE, "r") as f:
                    return json.load(f)
        except Exception as e:
            self.logger.warning(f"Could not load rank standardization: {str(e)}")
        return {
            "rank_standardization": {
                "abbreviations": {},
                "seniority_levels": {},
                "canonical_forms": {},
            }
        }

    def _load_organization_standardization(self) -> Dict:
        """Load organization standardization mappings - prioritize domain-specific file"""
        # Try to load domain-specific organization standardization first
        try:
            if POLICE_ORG_STANDARDISATION_FILE.exists():
                with open(POLICE_ORG_STANDARDISATION_FILE, "r") as f:
                    domain_org_config = json.load(f)
                    self.logger.info(
                        "Loaded police officer domain-specific organization standardization"
                    )
                    return domain_org_config
        except Exception as e:
            self.logger.warning(
                f"Could not load domain-specific organization standardization: {str(e)}"
            )

        # Fallback to general organization standardization
        try:
            if ORG_STANDARDISATION_FILE.exists():
                with open(ORG_STANDARDISATION_FILE, "r") as f:
                    general_org_config = json.load(f)
                    self.logger.info(
                        "Loaded general organization standardization as fallback"
                    )
                    return general_org_config
        except Exception as e:
            self.logger.warning(
                f"Could not load general organization standardization: {str(e)}"
            )

        return {"entries": []}

    def standardize_unknown_values(self, text: str) -> Optional[str]:
        """Handle UNKNOWN, INQ CONT, and other non-standard values"""
        if not text or not text.strip():
            return None

        text_upper = text.strip().upper()
        standardized_values = self.rank_config.get("standardized_values", {})

        if text_upper in standardized_values:
            config = standardized_values[text_upper]
            if config.get("return_empty", False):
                return (
                    None  # Return None to indicate empty structure should be returned
                )
            return config.get("canonical", text)

        return text

    def detect_and_flag_corruption(self, text: str) -> Tuple[bool, str]:
        """
        Detect data corruption (defendant names, quantity patterns)
        Returns (is_corrupted, corruption_type)
        """
        if not text or not text.strip():
            return False, ""

        text = text.strip()

        # Check defendant name patterns
        defendant_patterns = self.rank_config.get("corruption_patterns", {}).get(
            "defendant_name_patterns", []
        )
        for pattern in defendant_patterns:
            if re.match(pattern, text):
                return True, "defendant_name"

        # Check corruption indicators
        corruption_indicators = self.rank_config.get("corruption_patterns", {}).get(
            "corruption_indicators", []
        )
        text_lower = text.lower()
        for indicator in corruption_indicators:
            if indicator in text_lower:
                return True, "description_data"

        # Check description patterns
        description_patterns = self.rank_config.get("corruption_patterns", {}).get(
            "description_patterns", []
        )
        for pattern in description_patterns:
            if re.search(pattern, text_lower):
                return True, "description_pattern"

        return False, ""

    def expand_rank_abbreviations(self, rank: str) -> str:
        """Expand rank abbreviations to full titles"""
        if not rank:
            return rank

        abbreviations = self.rank_config.get("rank_standardization", {}).get(
            "abbreviations", {}
        )

        # Direct abbreviation match
        if rank in abbreviations:
            return abbreviations[rank]

        # Case-insensitive match
        for abbrev, full_rank in abbreviations.items():
            if rank.upper() == abbrev.upper():
                return full_rank

        # Standardize canonical forms
        canonical_forms = self.rank_config.get("rank_standardization", {}).get(
            "canonical_forms", {}
        )
        rank_lower = rank.lower()
        if rank_lower in canonical_forms:
            return canonical_forms[rank_lower]

        return rank

    def standardize_organization_names(self, org: str) -> str:
        """Standardize organization names and expand abbreviations"""
        if not org:
            return org

        # First check organization abbreviations
        org_abbrevs = self.rank_config.get("organization_abbreviations", {})
        if org in org_abbrevs:
            return org_abbrevs[org]

        # Then check existing organization standardization
        org_lower = org.lower()
        for entry in self.org_standardization.get("entries", []):
            variants = [v.lower() for v in entry.get("variants", [])]
            if org_lower in variants:
                return entry.get("canonical", org)

        return org

    def get_rank_seniority(self, rank: str) -> int:
        """Get seniority level for a rank (higher number = higher rank)"""
        seniority_levels = self.rank_config.get("rank_standardization", {}).get(
            "seniority_levels", {}
        )
        return seniority_levels.get(rank, 0)

    def is_standardized_value(self, text: str) -> bool:
        """Check if text is a standardized value like UNKNOWN, INQ CONT, etc."""
        if not text or not text.strip():
            return False

        text_upper = text.strip().upper()
        standardized_values = self.rank_config.get("standardized_values", {})
        return text_upper in standardized_values

    def detect_corruption(self, text: str) -> bool:
        """Detect if text contains corrupted data (defendant names, description data, etc.)"""
        is_corrupted, _ = self.detect_and_flag_corruption(text)
        return is_corrupted
