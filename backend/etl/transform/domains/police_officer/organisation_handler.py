"""
Data quality analysis and organisation handling for police officer data.

Handles comprehensive data quality analysis, organisation extraction,
rank extraction from text, and report generation.
"""

import json
import logging
import re
from collections import defaultdict
from typing import Dict, List, Optional

from etl.transform import debug_files
from etl.transform.lazy_pandas import is_missing, pd  # noqa: F401

from .constants import (
    ANALYSIS_REPORT_FILE,
    DEBUG_FILE,
    ORG_STANDARDISATION_FILE,
    POLICE_ORG_STANDARDISATION_FILE,
    RANK_STANDARDISATION_FILE,
    RAW_DATA_PATH,
    AnalysisResult,
    OfficerFormat,
)
from .format_detector import FormatDetectionResult, FormatDetector
from .rank_handler import StandardizationEngine


class DataQualityAnalyzer:
    """Comprehensive data quality analysis for Police Officer column"""

    def __init__(self):
        self.logger = logging.getLogger(__name__)
        self._clear_debug_file()

        # Initialize standardization engine
        self.standardization_engine = StandardizationEngine()

        # Initialize format detector
        self.format_detector = FormatDetector(self.standardization_engine)

        # Load existing organization standardization
        self.org_standardization = self.standardization_engine.org_standardization

        # Load corruption patterns from rank config
        rank_config = self.standardization_engine.rank_config
        corruption_patterns = rank_config.get("corruption_patterns", {})

        self.defendant_patterns = corruption_patterns.get(
            "defendant_name_patterns",
            [
                r"^[A-Z]+\s+[A-Z]+\s+[A-Z]+$",  # "DUNTON EDMUND RAYMOND"
                r"^[A-Z]+\s+[A-Z]+$",  # "SMITH JOHN"
                r"^[A-Z-]+,\s*[A-Z\s]+$",  # "HALMORE-HALFIELD, BEXLYN ROSALIND"
                r"^INQ\s+CONT$",  # "INQ CONT" - defendant pattern
            ],
        )

        # Known standardized values
        self.standardized_values = set(
            rank_config.get("standardized_values", {}).keys()
        )

        # Corruption indicators
        self.corruption_indicators = corruption_patterns.get(
            "corruption_indicators",
            [
                "quantity of",
                "plant",
                "seed",
                "head",
                "striking",
            ],
        )

    def _clear_debug_file(self):
        """Clear the debug file"""
        if not debug_files.enabled():
            return
        try:
            with open(DEBUG_FILE, "w") as f:
                f.write("POLICE OFFICER PROCESSING DEBUG LOG\n")
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

    def analyze_police_officer_data(self) -> AnalysisResult:
        """
        Comprehensive analysis of Police Officer column data
        Returns detailed analysis report with patterns, corruption, and recommendations
        """
        self._debug_log("Starting comprehensive Police Officer data analysis")

        result = AnalysisResult()

        try:
            # Load raw data
            df = pd.read_csv(RAW_DATA_PATH)
            police_officer_column = df["Police Officer"].fillna("")

            result.total_entries = len(police_officer_column)
            self._debug_log(f"Total entries to analyse: {result.total_entries}")

            # Analyse each entry
            for idx, value in enumerate(police_officer_column):
                value_str = str(value).strip()

                # Skip empty values
                if not value_str:
                    continue

                # Detect format with detailed analysis
                detection_result = self._detect_format_with_details(value_str)
                format_type = detection_result.format_type
                format_name = format_type.value

                result.format_distribution[format_name] = (
                    result.format_distribution.get(format_name, 0) + 1
                )

                # Collect samples for each format with confidence information
                if format_name not in result.sample_entries:
                    result.sample_entries[format_name] = []
                if (
                    len(result.sample_entries[format_name]) < 5
                ):  # Keep 5 samples per format
                    sample_info = (
                        f"{value_str} (confidence: {detection_result.confidence:.2f})"
                    )
                    result.sample_entries[format_name].append(sample_info)

                # Analyze corruption patterns
                if format_type == OfficerFormat.CORRUPTED:
                    corruption_type = self._identify_corruption_type(value_str)
                    if corruption_type not in result.corruption_patterns:
                        result.corruption_patterns[corruption_type] = []
                    if len(result.corruption_patterns[corruption_type]) < 10:
                        result.corruption_patterns[corruption_type].append(value_str)

                # Extract rank variations
                ranks = self._extract_ranks(value_str, format_type)
                for rank in ranks:
                    result.rank_variations[rank] = (
                        result.rank_variations.get(rank, 0) + 1
                    )

                # Extract organization variations
                org = self._extract_organization(value_str, format_type)
                if org:
                    result.organization_variations[org] = (
                        result.organization_variations.get(org, 0) + 1
                    )

                # Identify standardization needs
                standardization_needs = self._identify_standardization_needs(
                    value_str, format_type
                )
                for need_type, values in standardization_needs.items():
                    if need_type not in result.standardization_needs:
                        result.standardization_needs[need_type] = []
                    result.standardization_needs[need_type].extend(values)

            # Get unique patterns for manual review
            result.unique_patterns = list(
                set(police_officer_column.dropna().astype(str))
            )[
                :50
            ]  # Top 50 unique patterns

            self._debug_log(
                f"Analysis complete. Found {len(result.format_distribution)} format types"
            )

            # Generate comprehensive report
            self._generate_analysis_report(result)

            return result

        except Exception as e:
            self.logger.error(f"Error during analysis: {str(e)}")
            self._debug_log(f"Analysis error: {str(e)}")
            return result

    def _detect_format(self, text: str) -> OfficerFormat:
        """
        Detect the format of police officer data using enhanced format detector
        Returns: EARLY_FORMAT, LATER_FORMAT, SINGLE_OFFICER, CORRUPTED, UNKNOWN, STANDARDIZED
        """
        detection_result = self.format_detector.detect_format_with_confidence(text)

        # Log detection details for debugging
        self._debug_log(
            f"Format detection for '{text[:50]}...': {detection_result.format_type.value} (confidence: {detection_result.confidence:.2f})"
        )
        if detection_result.matched_patterns:
            self._debug_log(f"  Matched patterns: {detection_result.matched_patterns}")
        if detection_result.detection_notes:
            self._debug_log(f"  Notes: {'; '.join(detection_result.detection_notes)}")
        if detection_result.fallback_attempted:
            self._debug_log("  Fallback detection was attempted")

        return detection_result.format_type

    def _detect_format_with_details(self, text: str) -> FormatDetectionResult:
        """
        Detect format with full details including confidence and patterns
        Used for detailed analysis and debugging
        """
        return self.format_detector.detect_format_with_confidence(text)

    def _is_corrupted_data(self, text: str) -> bool:
        """
        Detect if text contains corrupted data (defendant names, description data, etc.)
        """
        is_corrupted, _ = self.standardization_engine.detect_and_flag_corruption(text)
        return is_corrupted

    def _identify_corruption_type(self, text: str) -> str:
        """Identify the type of corruption in the data"""
        _, corruption_type = self.standardization_engine.detect_and_flag_corruption(
            text
        )
        return corruption_type if corruption_type else "unknown_corruption"

    def _extract_ranks(self, text: str, format_type: OfficerFormat) -> List[str]:
        """Extract rank information from text based on format type"""
        ranks = []

        if (
            format_type == OfficerFormat.CORRUPTED
            or format_type == OfficerFormat.STANDARDIZED
        ):
            return ranks

        # Common rank patterns (including abbreviations)
        rank_patterns = [
            r"Senior\s+Constable",
            r"Police\s+Constable",
            r"First\s+Class\s+Constable",
            r"Acting\s+Senior\s+Constable",
            r"Acting\s+Constable",
            r"Acting\s+Sergeant",
            r"Detective",
            r"Sergeant",
            r"Senior\s+Sergeant",
            r"Inspector",
            r"Constable",
            r"Sworn\s+Officer",
            r"Unsworn\s+Officer",
            r"S/C",
            r"PC",
            r"Det",
            r"1/C",
            r"Sgt",
            r"S/Sgt",
            r"Insp",
            r"A/C",
            r"A/S/C",
            r"A/Sgt",
        ]

        found_ranks = set()  # Use set to avoid duplicates

        for pattern in rank_patterns:
            matches = re.findall(pattern, text, re.IGNORECASE)
            for match in matches:
                # Standardize the rank
                standardized_rank = (
                    self.standardization_engine.expand_rank_abbreviations(match)
                )
                found_ranks.add(standardized_rank)

        return list(found_ranks)

    def _extract_organization(
        self, text: str, format_type: OfficerFormat
    ) -> Optional[str]:
        """Extract organization information from text"""
        if (
            format_type == OfficerFormat.CORRUPTED
            or format_type == OfficerFormat.STANDARDIZED
        ):
            return None

        # Look for organization patterns after "of" - handle different formats
        if format_type == OfficerFormat.EARLY_FORMAT:
            # Early format: "... on behalf of - Rank Name of Organization"
            org_match = re.search(
                r"on behalf of\s*-\s*.+?\s+of\s+(.+)$", text, re.IGNORECASE
            )
            if org_match:
                org_name = org_match.group(1).strip()
                return self.standardization_engine.standardize_organization_names(
                    org_name
                )
        elif format_type == OfficerFormat.LATER_FORMAT:
            # Later format: "... on behalf of ... of Organization"
            org_match = re.search(
                r"on behalf of\s+.+?\s+of\s+(.+)$", text, re.IGNORECASE
            )
            if org_match:
                org_name = org_match.group(1).strip()
                return self.standardization_engine.standardize_organization_names(
                    org_name
                )
        else:
            # Single officer or other formats: look for "of Organization" at end
            org_match = re.search(r"\bof\s+(.+)$", text, re.IGNORECASE)
            if org_match:
                org_name = org_match.group(1).strip()
                return self.standardization_engine.standardize_organization_names(
                    org_name
                )

        return None

    def _identify_standardization_needs(
        self, text: str, format_type: OfficerFormat
    ) -> Dict[str, List[str]]:
        """Identify standardization needs for ranks, organizations, and abbreviations"""
        needs = defaultdict(list)

        if format_type == OfficerFormat.CORRUPTED:
            return needs

        # Rank abbreviations that need expansion
        rank_abbrevs = re.findall(r"\b(S/C|PC|Det|1/C|Sgt)\b", text)
        if rank_abbrevs:
            needs["rank_abbreviations"].extend(rank_abbrevs)

        # Organization abbreviations
        org_abbrevs = re.findall(r"\b(TIG|DSG|CIB)\b", text)
        if org_abbrevs:
            needs["organization_abbreviations"].extend(org_abbrevs)

        return needs

    def _generate_analysis_report(self, result: AnalysisResult):
        """Generate comprehensive analysis report"""
        try:
            with open(ANALYSIS_REPORT_FILE, "w") as f:
                f.write("# Police Officer Data Analysis Report\n\n")
                f.write(
                    f"**Generated:** {pd.Timestamp.now().strftime('%Y-%m-%d %H:%M:%S')}\n\n"
                )

                # Summary statistics
                f.write("## Summary Statistics\n\n")
                f.write(f"- **Total Entries:** {result.total_entries:,}\n")
                f.write(f"- **Unique Patterns:** {len(result.unique_patterns)}\n")
                f.write(
                    f"- **Format Types Detected:** {len(result.format_distribution)}\n\n"
                )

                # Format distribution
                f.write("## Format Distribution\n\n")
                total_analyzed = sum(result.format_distribution.values())
                for format_type, count in sorted(
                    result.format_distribution.items(), key=lambda x: x[1], reverse=True
                ):
                    percentage = (
                        (count / total_analyzed) * 100 if total_analyzed > 0 else 0
                    )
                    f.write(
                        f"- **{format_type.title()}:** {count:,} entries ({percentage:.1f}%)\n"
                    )
                f.write("\n")

                # Sample entries for each format
                f.write("## Sample Entries by Format\n\n")
                for format_type, samples in result.sample_entries.items():
                    f.write(f"### {format_type.title()} Format\n\n")
                    for i, sample in enumerate(samples, 1):
                        f.write(f"{i}. `{sample}`\n")
                    f.write("\n")

                # Corruption patterns
                if result.corruption_patterns:
                    f.write("## Data Corruption Patterns\n\n")
                    for corruption_type, examples in result.corruption_patterns.items():
                        f.write(f"### {corruption_type.replace('_', ' ').title()}\n\n")
                        for i, example in enumerate(examples, 1):
                            f.write(f"{i}. `{example}`\n")
                        f.write("\n")

                # Rank variations
                if result.rank_variations:
                    f.write("## Rank Variations\n\n")
                    f.write("| Rank | Frequency |\n")
                    f.write("|------|----------|\n")
                    for rank, count in sorted(
                        result.rank_variations.items(), key=lambda x: x[1], reverse=True
                    )[:20]:
                        f.write(f"| {rank} | {count:,} |\n")
                    f.write("\n")

                # Organization variations
                if result.organization_variations:
                    f.write("## Organization Variations\n\n")
                    f.write("| Organization | Frequency |\n")
                    f.write("|--------------|----------|\n")
                    for org, count in sorted(
                        result.organization_variations.items(),
                        key=lambda x: x[1],
                        reverse=True,
                    )[:20]:
                        f.write(f"| {org} | {count:,} |\n")
                    f.write("\n")

                # Standardization recommendations
                if result.standardization_needs:
                    f.write("## Standardization Recommendations\n\n")
                    for need_type, values in result.standardization_needs.items():
                        f.write(f"### {need_type.replace('_', ' ').title()}\n\n")
                        unique_values = list(set(values))
                        for value in unique_values[:10]:  # Top 10
                            f.write(f"- `{value}`\n")
                        f.write("\n")

                f.write("## Next Steps\n\n")
                f.write("1. Review corruption patterns and implement detection logic\n")
                f.write("2. Create rank standardization mappings\n")
                f.write("3. Implement format-specific parsers\n")
                f.write("4. Test parsing accuracy with sample data\n")
                f.write("5. Integrate with ETL pipeline\n")

        except Exception as e:
            self.logger.error(f"Error generating analysis report: {str(e)}")
            self._debug_log(f"Report generation error: {str(e)}")

    def generate_standardization_mappings(self) -> Dict:
        """Generate standardization mapping recommendations"""
        self._debug_log("Generating standardization mappings")

        # Basic rank standardization mappings
        rank_mappings = {
            "abbreviations": {
                "S/C": "Senior Constable",
                "PC": "Police Constable",
                "Det": "Detective",
                "1/C": "First Class Constable",
                "Sgt": "Sergeant",
            },
            "seniority_levels": {
                "Police Constable": 1,
                "First Class Constable": 2,
                "Senior Constable": 3,
                "Detective": 4,
                "Sergeant": 5,
                "Sworn Officer": 3,  # Equivalent to Senior Constable
                "Unsworn Officer": 1,  # Equivalent to Police Constable
            },
        }

        # Organization abbreviation mappings
        org_mappings = {
            "TIG": "Tactical Investigation Group",
            "DSG": "District Support Group",
            "CIB": "Criminal Investigation Branch",
        }

        standardization_config = {
            "rank_standardization": rank_mappings,
            "organization_abbreviations": org_mappings,
            "corruption_patterns": {
                "defendant_name_patterns": self.defendant_patterns,
                "corruption_indicators": self.corruption_indicators,
            },
            "standardized_values": list(self.standardized_values),
        }

        # Save rank standardization file
        try:
            with open(RANK_STANDARDISATION_FILE, "w") as f:
                json.dump(standardization_config, f, indent=2)
            self._debug_log(
                f"Standardization mappings saved to {RANK_STANDARDISATION_FILE}"
            )
        except Exception as e:
            self.logger.error(f"Error saving standardization mappings: {str(e)}")
            self._debug_log(f"Standardization save error: {str(e)}")

        return standardization_config
