"""Read the legacy source independently of the transform and the loader.

Two copies of the source exist: the CSV export and a JSON snapshot of the
original Access table. This module loads both and reports any difference, so a
truncated or damaged export is caught before it is trusted.
"""

import csv
import json
from datetime import date, datetime
from pathlib import Path
from typing import Dict, List, Optional

ETL_ROOT = Path(__file__).resolve().parent.parent
RAW_DIR = ETL_ROOT / "data" / "raw"
CSV_PATH = RAW_DIR / "Cannabis2000.csv"
MDB_JSON_PATH = RAW_DIR / "Cannabis2000_mdb.json"

TEXT_COLUMNS = [
    "Approved Botanist",
    "Police Reference Number",
    "Location",
    "Quantity of Bags",
    "Tag Number",
    "Description",
    "Defendant",
    "Police Officer",
    "Result",
    "Quantity Sub Sampled",
    "Other Matters",
    "New Bag Numbers",
    "Comments",
]
DATE_COLUMNS = ["Receipt Date", "Certification Date"]


def normalise_text(value) -> str:
    """Collapse line endings and trim, so equal text compares equal."""
    if value is None:
        return ""
    return str(value).replace("\r\n", "\n").replace("\r", "\n").strip()


def load_csv(path: Path = CSV_PATH) -> List[Dict[str, str]]:
    with open(path, encoding="utf-8-sig", newline="") as handle:
        return list(csv.DictReader(handle))


def load_mdb(path: Path = MDB_JSON_PATH) -> List[Dict[str, object]]:
    with open(path, encoding="utf-8") as handle:
        return json.load(handle)["rows"]


def mdb_date(value) -> Optional[date]:
    """An Access date/time value as a plain date, or None when blank."""
    if value in (None, ""):
        return None
    if isinstance(value, (date, datetime)):
        return value.date() if isinstance(value, datetime) else value
    return datetime.fromisoformat(str(value)).date()


def compare_csv_with_mdb(
    csv_rows: List[Dict[str, str]], mdb_rows: List[Dict[str, object]]
) -> List[str]:
    """Return a list of human-readable differences between the two copies."""
    problems: List[str] = []
    if len(csv_rows) != len(mdb_rows):
        problems.append(f"row count: csv={len(csv_rows)} mdb={len(mdb_rows)}")
    by_number = {str(row["Certificate Number"]).strip(): row for row in mdb_rows}
    if len(by_number) != len(mdb_rows):
        problems.append("duplicate certificate numbers in mdb")
    for csv_row in csv_rows:
        number = csv_row["Certificate Number"].strip()
        mdb_row = by_number.get(number)
        if mdb_row is None:
            problems.append(f"certificate {number}: missing from mdb")
            continue
        for column in TEXT_COLUMNS:
            left = normalise_text(csv_row.get(column))
            right = normalise_text(mdb_row.get(column))
            if left != right:
                problems.append(
                    f"certificate {number}: {column}: csv={left[:60]!r} mdb={right[:60]!r}"
                )
        for column in DATE_COLUMNS:
            mdb_value = mdb_date(mdb_row.get(column))
            csv_value = csv_row.get(column, "").strip()
            if not csv_value and mdb_value is None:
                continue
            if not csv_value or mdb_value is None:
                problems.append(f"certificate {number}: {column}: one side blank")
                continue
            parsed = datetime.strptime(csv_value, "%d-%b-%y").date()
            if parsed.replace(year=parsed.year % 100 + 2000) != mdb_value:
                problems.append(
                    f"certificate {number}: {column}: csv={csv_value} mdb={mdb_value}"
                )
    return problems
