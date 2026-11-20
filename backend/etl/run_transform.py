#!/usr/bin/env python3
"""Transform the legacy certificate table into certificate-level JSON.

One output record per source row (one legacy certificate). Rows are not merged:
grouping certificates into cases is the loader's job, so no certificate-level
fact is lost on the way.

    poetry run python etl/run_transform.py

The input is a JSON snapshot of the original Access table, produced by
`etl/verify/export_mdb.py`. The CSV export is not used because Excel rewrote
many long police reference numbers as scientific notation and stripped their
leading zeros.
"""

import argparse
import hashlib
import json
import re
import sys
from contextlib import nullcontext
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

ETL_ROOT = Path(__file__).resolve().parent
sys.path.insert(0, str(ETL_ROOT.parent))

from etl.transform import private_rules  # noqa: E402
from etl.transform.bags import build_bags, expand_tags  # noqa: E402
from etl.transform.dates import resolve_dates  # noqa: E402
from etl.transform.officers import has_officer, repair_officers  # noqa: E402
from etl.transform.runner import (  # noqa: E402
    TransformationLogger,
    run_domains,
    write_json,
)

MDB_JSON_PATH = ETL_ROOT / "data" / "raw" / "Cannabis2000_mdb.json"
MODDED_DIR = ETL_ROOT / "data" / "modded"
DATE_COLUMNS = ("Receipt Date", "Certification Date")
MISSING_REFERENCE = "EMPTY_REF_NUMBER"
SOURCE_ROW_KEY = "__source_row__"
# Columns that carry nothing: every row holds the same value, which the
# verification checks (MailMerge is FALSE and the fee $0.00 on all 3,727 rows).
CONSTANT_COLUMNS = {"MailMerge", "Identification Fee"}

# Access memo fields occasionally carry the byte-order mark of an earlier,
# longer value after the current one. The current value is what precedes it.
MEMO_RESIDUE_MARKER = "\u00ff\u00fe"


def prepare_rows(table: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """Source rows in certificate-number order, text columns as plain strings."""
    rows: List[Dict[str, Any]] = []
    for source in table:
        # The untouched row travels with the record so the import can store it.
        row: Dict[str, Any] = {SOURCE_ROW_KEY: dict(source)}
        for column, value in source.items():
            if column in DATE_COLUMNS:
                row[column] = value
            else:
                text = "" if value is None else str(value)
                row[column] = text.split(MEMO_RESIDUE_MARKER, 1)[0]
        repair_misplaced_tags(row)
        rows.append(row)
    rows.sort(key=lambda row: int(row["Certificate Number"]))
    return rows


def repair_misplaced_tags(row: Dict[str, Any]) -> None:
    """Move tag numbers typed into the Description column to the Tag column.

    Certificate 1922 has its six tags in Description and nothing in Tag Number.
    """
    if row.get("Tag Number", "").strip() or not row.get("Description", "").strip():
        return
    if expand_tags(row["Description"]):
        row["Tag Number"] = row["Description"]
        row["Description"] = ""


def build_records(
    rows: List[Dict[str, Any]], config: Dict[str, Any]
) -> List[Dict[str, Any]]:
    """Map source columns to domain fields and keep dropped columns as extras."""
    mapping: Dict[str, str] = {}
    dropped: List[str] = []
    for column in config.get("columns", []):
        if column.get("skip_and_drop", False):
            dropped.append(column["name"])
        else:
            mapping[column["name"]] = column["resulting_columns"][0]["name"]
    records: List[Dict[str, Any]] = []
    for index, row in enumerate(rows):
        record: Dict[str, Any] = {"row_id": index}
        for source_column, domain_field in mapping.items():
            record[domain_field] = row.get(source_column, "")
        record["extras"] = [
            {"label": name, "value": str(row.get(name, "")).strip()}
            for name in dropped
            if name not in CONSTANT_COLUMNS and str(row.get(name, "")).strip()
        ]
        record["source_row"] = row[SOURCE_ROW_KEY]
        records.append(record)
    return records


def finish_records(records: List[Dict[str, Any]], rows: List[Dict[str, Any]]) -> None:
    """Add case keys, resolved dates and per-bag values to processed records."""
    for record, row, dates in zip(records, rows, resolve_dates(rows)):
        reference = str(record.get("police_reference_number") or "").strip()
        if not reference or reference == MISSING_REFERENCE:
            # A certificate with no reference is its own case.
            reference = f"CRT-{record['cert_number']}"
            record["police_reference_number"] = reference
        record["case_key"] = reference
        record.update(dates)
        raw_officer = str(row.get("Police Officer", "")).strip()
        record["police_officer"] = repair_officers(
            record["police_officer"], raw_officer
        )
        if raw_officer and not has_officer(record["police_officer"]):
            # The cell held something that is not an officer (for example a
            # defendant's name); keep it rather than lose it.
            record["extras"].append(
                {
                    "label": "Police Officer (not recognised as an officer)",
                    "value": raw_officer,
                }
            )
        record["extras"].extend(unrepresented_text(record, row))
        record.update(build_bags(record))
        if [bag["tag"] for bag in record["bags"]] == ["UNKNOWN"]:
            # No tag numbers were recorded, so one placeholder bag stands in for
            # the whole certificate; keep the source quantity so it is not lost.
            record["extras"].append(
                {
                    "label": "Quantity of Bags (no tag numbers recorded)",
                    "value": str(row["Quantity of Bags"]).strip(),
                }
            )


PLACEHOLDER_WORDS = {
    "unknown",
    "and",
    "cont",
    "inq",
    "inqs",
    "inquiries",
    "enquiries",
    "continuing",
    "none",
    "nil",
}
BADGE_DIGITS = re.compile(r"(?:\bPD\s*)?0*(\d{4,6})\b", re.IGNORECASE)


def unrepresented_text(
    record: Dict[str, Any], row: Dict[str, Any]
) -> List[Dict[str, str]]:
    """Source text the structured fields could not hold, kept as comments.

    * A defendant cell that names nobody but is not a placeholder (a location,
      an operation name).
    * An officer cell naming more badges than the two officer slots can hold.
    """
    extras: List[Dict[str, str]] = []
    defendants = record.get("defendants")
    if isinstance(defendants, str):
        defendants = json.loads(defendants)
    cell = str(row.get("Defendant", "")).strip()
    words = set(re.findall(r"[a-z]+", cell.lower()))
    if cell and not defendants and not words <= PLACEHOLDER_WORDS:
        extras.append({"label": "Defendant (no person named)", "value": cell})

    officer_cell = str(row.get("Police Officer", "")).strip()
    parsed = record["police_officer"]
    kept = {
        digits
        for key in ("submitting_officer", "requesting_officer")
        for digits in BADGE_DIGITS.findall((parsed.get(key) or {}).get("badge_id", ""))
    }
    stated = set(BADGE_DIGITS.findall(officer_cell))
    if stated - kept and has_officer(parsed):
        extras.append({"label": "Police Officers as recorded", "value": officer_cell})
    return extras


def sha256_of(path: Path) -> str:
    digest = hashlib.sha256()
    with open(path, "rb") as handle:
        for chunk in iter(lambda: handle.read(1 << 20), b""):
            digest.update(chunk)
    return digest.hexdigest()


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--source", default=str(MDB_JSON_PATH))
    parser.add_argument("--output", default=str(MODDED_DIR / "cannabis_clean.json"))
    args = parser.parse_args()

    source_path = Path(args.source)
    if not source_path.exists():
        print(f"Source not found: {source_path}", file=sys.stderr)
        return 2

    with open(source_path, encoding="utf-8") as handle:
        table = json.load(handle)["rows"]
    records, report, review_items = transform_table(table)
    report["source_sha256"] = sha256_of(source_path)

    output = Path(args.output)
    write_json(output, records)
    write_json(output.with_name(output.stem + ".manifest.json"), report)
    write_json(output.with_name(output.stem + ".review.json"), review_items)
    failures = report["domain_failures"]
    print(
        f"{len(records)} certificate records, {report['bags']} bags written to "
        f"{output} ({sum(len(v) for v in failures.values())} domain errors)"
    )
    return 1 if failures else 0


def transform_table(
    table: List[Dict[str, Any]],
    rules: Optional[Dict[str, Any]] = None,
) -> Tuple[List[Dict[str, Any]], Dict[str, Any], List[Dict[str, Any]]]:
    """Transform the Access table rows in memory; no file is read or written
    apart from the rule files.

    ``rules`` holds the private rule files (name to parsed JSON) from the
    import bundle; without it they are read from ``etl/data/rules/``. A missing
    rule file stops the run, because the result would differ from the one that
    was verified.

    Returns the certificate records, a summary report and the items the domain
    processors flagged for review.
    """
    with private_rules.supplied(rules) if rules is not None else nullcontext():
        absent = private_rules.missing()
        if absent:
            raise FileNotFoundError(
                f"Private transform rules not found: {', '.join(absent)} "
                f"(expected in {private_rules.RULES_DIR} or the import bundle)"
            )
        return _transform(table)


def _transform(
    table: List[Dict[str, Any]],
) -> Tuple[List[Dict[str, Any]], Dict[str, Any], List[Dict[str, Any]]]:
    with open(ETL_ROOT / "config.json", encoding="utf-8") as handle:
        config = json.load(handle)
    rows = prepare_rows(table)
    records = build_records(rows, config)
    logger = TransformationLogger()
    failures = run_domains(records, config, logger)
    finish_records(records, rows)
    bases: Dict[str, int] = {}
    for record in records:
        bases[record["result_basis"]] = bases.get(record["result_basis"], 0) + 1
    report = {
        "records": len(records),
        "bags": sum(len(record["bags"]) for record in records),
        "result_basis": bases,
        "domain_failures": failures,
        **logger.summary(),
    }
    return records, report, logger.review_items


if __name__ == "__main__":
    sys.exit(main())
