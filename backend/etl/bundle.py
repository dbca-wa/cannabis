"""The legacy import bundle: every sensitive input in one file.

The import needs the old system's certificate table (personal data), the
transform rules that name officers on particular rows, and the reviewed list
of explained differences (it names police references). None of them belongs
in git or the image, so they travel in one zip that is built locally and
uploaded through the app's Settings page by a maintainer.

    poetry run python -m etl.bundle            # builds etl/data/legacy_import_bundle.zip

Contents:

    manifest.json                      format, build time, size and SHA-256 per file
    source/Cannabis2000_mdb.json       the Access ``Cannabis`` table (required)
    source/Cannabis2000.csv            the CSV export (optional; enables the CSV check)
    rules/officer_field_corrections.json  row-specific officer corrections (required)
    verify/exceptions.json             reviewed, reasoned differences (optional)

``read_bundle`` checks the manifest, every hash and the table's shape before
anything is used, so a damaged or wrong file is refused rather than imported.
"""

import csv
import hashlib
import io
import json
import sys
import zipfile
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, BinaryIO, Dict, List, Optional, Union

if __package__ in (None, ""):
    sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from etl.transform import private_rules  # noqa: E402

FORMAT = "legacy-import-bundle/1"
ETL_ROOT = Path(__file__).resolve().parent
DATA_DIR = ETL_ROOT / "data"
DEFAULT_OUTPUT = DATA_DIR / "legacy_import_bundle.zip"

SOURCE_TABLE = "source/Cannabis2000_mdb.json"
SOURCE_CSV = "source/Cannabis2000.csv"
EXCEPTIONS = "verify/exceptions.json"
RULES_PREFIX = "rules/"
RULE_FILES = {
    RULES_PREFIX + name: private_rules.RULES_DIR / name for name in private_rules.NAMES
}
LOCAL_FILES = {
    SOURCE_TABLE: DATA_DIR / "raw" / "Cannabis2000_mdb.json",
    SOURCE_CSV: DATA_DIR / "raw" / "Cannabis2000.csv",
    EXCEPTIONS: DATA_DIR / "verify" / "exceptions.json",
    **RULE_FILES,
}
REQUIRED = {SOURCE_TABLE, *RULE_FILES}
REQUIRED_COLUMNS = {
    "Certificate Number",
    "Receipt Date",
    "Certification Date",
    "Approved Botanist",
    "Police Reference Number",
    "Tag Number",
    "Description",
    "Defendant",
    "Police Officer",
    "Result",
    "Other Matters",
}
MAX_UNCOMPRESSED = 200 * 1024 * 1024


class BundleError(ValueError):
    """The bundle is missing, damaged or not a legacy import bundle."""


@dataclass
class Bundle:
    rows: List[Dict[str, Any]]
    csv_rows: Optional[List[Dict[str, str]]]
    exceptions: List[Dict[str, Any]]
    rules: Dict[str, Any] = field(default_factory=dict)
    manifest: Dict[str, Any] = field(default_factory=dict)

    @property
    def summary(self) -> Dict[str, Any]:
        return {
            "format": self.manifest.get("format"),
            "built_at": self.manifest.get("built_at"),
            "source_rows": len(self.rows),
            "has_csv": self.csv_rows is not None,
            "exceptions": len(self.exceptions),
            "rule_files": len(self.rules),
            "source_sha256": self.manifest["files"][SOURCE_TABLE]["sha256"],
        }


def _sha256(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def build_bundle(output: Path = DEFAULT_OUTPUT) -> Dict[str, Any]:
    """Write the bundle from the local data files and return its manifest."""
    contents: Dict[str, bytes] = {}
    for name, path in LOCAL_FILES.items():
        if path.exists():
            contents[name] = path.read_bytes()
        elif name in REQUIRED:
            raise BundleError(
                f"{path} not found; see etl/README.md for where it comes from"
            )
    manifest = {
        "format": FORMAT,
        "built_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "files": {
            name: {"sha256": _sha256(data), "size": len(data)}
            for name, data in contents.items()
        },
    }
    output.parent.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(output, "w", compression=zipfile.ZIP_DEFLATED) as archive:
        archive.writestr("manifest.json", json.dumps(manifest, indent=1))
        for name, data in contents.items():
            archive.writestr(name, data)
    # Prove the file reads back before it is used anywhere.
    with open(output, "rb") as handle:
        manifest["source_rows"] = len(read_bundle(handle).rows)
    return manifest


def read_bundle(source: Union[BinaryIO, bytes]) -> Bundle:
    """Open and validate a bundle; raise ``BundleError`` with the reason if not usable."""
    raw = source if isinstance(source, bytes) else source.read()
    try:
        archive = zipfile.ZipFile(io.BytesIO(raw))
    except zipfile.BadZipFile as error:
        raise BundleError("The file is not a zip archive.") from error
    with archive:
        if sum(info.file_size for info in archive.infolist()) > MAX_UNCOMPRESSED:
            raise BundleError("The bundle is larger than expected.")
        names = set(archive.namelist())
        if "manifest.json" not in names:
            raise BundleError("The bundle has no manifest.json.")
        try:
            manifest = json.loads(archive.read("manifest.json"))
        except json.JSONDecodeError as error:
            raise BundleError("manifest.json is not valid JSON.") from error
        if manifest.get("format") != FORMAT:
            raise BundleError(f"Unknown bundle format {manifest.get('format')!r}.")
        files = manifest.get("files") or {}
        for name in REQUIRED:
            if name not in files or name not in names:
                raise BundleError(f"The bundle is missing {name}.")
        data: Dict[str, bytes] = {}
        for name, meta in files.items():
            if name not in names:
                raise BundleError(f"{name} is listed in the manifest but missing.")
            data[name] = archive.read(name)
            if _sha256(data[name]) != meta.get("sha256"):
                raise BundleError(f"{name} does not match its checksum.")

    try:
        rows = json.loads(data[SOURCE_TABLE])["rows"]
    except (json.JSONDecodeError, KeyError, TypeError) as error:
        raise BundleError(f"{SOURCE_TABLE} is not an Access table export.") from error
    if not rows:
        raise BundleError("The source table has no rows.")
    missing = REQUIRED_COLUMNS - set(rows[0])
    if missing:
        raise BundleError(
            f"The source table lacks columns: {', '.join(sorted(missing))}."
        )
    numbers = [str(row.get("Certificate Number")) for row in rows]
    if len(set(numbers)) != len(numbers):
        raise BundleError("Certificate numbers in the source table are not unique.")

    csv_rows = None
    if SOURCE_CSV in data:
        text = data[SOURCE_CSV].decode("utf-8-sig", errors="replace")
        csv_rows = list(csv.DictReader(io.StringIO(text, newline="")))
    exceptions = json.loads(data[EXCEPTIONS]) if EXCEPTIONS in data else []
    if not isinstance(exceptions, list):
        raise BundleError(f"{EXCEPTIONS} must be a list.")
    rules: Dict[str, Any] = {}
    for name in RULE_FILES:
        try:
            rules[name[len(RULES_PREFIX) :]] = json.loads(data[name])
        except json.JSONDecodeError as error:
            raise BundleError(f"{name} is not valid JSON.") from error
    return Bundle(
        rows=rows,
        csv_rows=csv_rows,
        exceptions=exceptions,
        rules=rules,
        manifest=manifest,
    )


def main() -> int:
    output = Path(sys.argv[1]) if len(sys.argv) > 1 else DEFAULT_OUTPUT
    manifest = build_bundle(output)
    files = ", ".join(
        f"{name} ({meta['size']:,} bytes)" for name, meta in manifest["files"].items()
    )
    print(f"Bundle written to {output}: {manifest['source_rows']} source rows; {files}")
    print(
        "It holds personal data. Upload it on the Settings page; do not commit or email it."
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
