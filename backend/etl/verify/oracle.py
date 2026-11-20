"""State what the database must contain, working only from the Access table.

This module reads the original table and writes ``expected.json``. It shares no
code with the transform or the loader: every rule here is written from the
source data directly, so a mistake in the pipeline shows up as a difference
rather than being repeated on both sides.

    poetry run python -m etl.verify.oracle

Checks that compare free text (defendant and officer names, content types,
results) are deliberately structural: the same words must appear, nothing may be
invented, nothing may be lost. They do not repeat the pipeline's own parsing.
"""

import json
import math
import re
import sys
from datetime import date
from pathlib import Path
from typing import Any, Dict, List, Optional, Set

from etl.verify import source

OUTPUT = Path(__file__).resolve().parent.parent / "data" / "modded" / "expected.json"
MEMO_RESIDUE = "\u00ff\u00fe"
EARLIEST_YEAR = 2000
MAX_BAGS_PER_FORM = 5
NAME_NOISE = {
    "unknown",
    "and",
    "cont",
    "inq",
    "inqs",
    "inquiries",
    "continuing",
    "enquiries",
    "none",
    "nil",
}
SURNAMES = (
    "marchant",
    "huisman",
    "chapman",
    "sha",
    "knight",
    "shepherd",
    "lander",
    "cranfield",
    "patrick",
)
SME_PHRASE = "subsamples placed into security movement envelope"
# A real police rank at the start of an officer's text. "Sworn Officer" and
# "Unsworn Officer" are certificate labels, not ranks, so they do not count.
RANK_AT_START = re.compile(
    r"^(?:conveying officer\s*[-:]?\s*)?(?:"
    r"senior constable|s/c\b|s/constable|s/contable|detective|det\b|"
    r"sergeant|sgt\b|police constable|pc\b|p/c\b|1/c\b|first class|"
    r"constable|inspector)",
    re.IGNORECASE,
)

TAG = re.compile(r"\b([A-Z]{1,3})(\d{3,})((?:[-/]\d+)*)")

CONTENT_WORDS = [
    ("plant material", "plant_material"),
    ("seedling", "seedling"),
    ("root ball", "rootball"),
    ("rootball", "rootball"),
    ("root", "rootball"),
    ("stalk", "stalk"),
    ("stem", "stem"),
    ("cutting", "cutting"),
    ("striking", "cutting"),
    ("seed", "seed"),
    ("mushroom", "mushroom"),
    ("poppy", "poppy"),
    ("tablet", "tablet"),
    ("head", "head"),
    ("plant", "plant"),
]


def clean_text(value: Any) -> str:
    return source.normalise_text(str(value or "").split(MEMO_RESIDUE, 1)[0])


def squash(value: str) -> str:
    return re.sub(r"\s+", " ", value or "").strip()


def expected_tags(cell: str) -> List[str]:
    """Tags in a Tag Number cell. A hyphen after a tag is a range to the number
    given (``T367926-44`` runs to ``T367944``); ``T53951-2-3`` lists three; a
    slash gives one further tag (``T53948/50``)."""
    cell = cell.upper()
    property_pairs = re.findall(r"\d{6,}\s+PS#\s+\d+/\d+", cell)
    if property_pairs:
        return list(dict.fromkeys(property_pairs))
    tags: List[str] = []
    if not TAG.search(cell):
        return list(dict.fromkeys(re.findall(r"\b\d{5,}\b", cell)))
    for prefix, digits, tail in TAG.findall(cell):
        tags.append(prefix + digits)
        current = digits
        for separator, suffix in re.findall(r"([-/])(\d+)", tail):
            end = current[: max(0, len(current) - len(suffix))] + suffix
            if separator == "-" and int(end) > int(current):
                tags.extend(
                    prefix + str(n).zfill(len(current))
                    for n in range(int(current) + 1, int(end) + 1)
                )
            else:
                tags.append(prefix + end)
            current = end
    return list(dict.fromkeys(tags))


def content_types(description: str) -> List[str]:
    text = description.lower()
    found: List[str] = []
    for word, content_type in CONTENT_WORDS:
        if word in text:
            text = text.replace(word, " ")
            if content_type not in found:
                found.append(content_type)
    return found


STATEMENT = re.compile(
    r"identif|unable|inable|unabe|could not|cannot|not able|confirm|found not|"
    r"probably|appear|observed|not a species|not cannabis|did not contain"
)


def result_classes(narrative: str) -> Set[str]:
    """Every result class the narrative states about the material.

    Only sentences that make a statement about identification count; sentences
    that merely mention cannabis (for example a leaf lacking its hairs) do not.
    """
    classes: Set[str] = set()
    protected = re.sub(r"\bnos?\.", "no", narrative, flags=re.IGNORECASE)
    for sentence in re.split(r"(?<=[.;])\s*(?=[A-Z])", protected):
        low = sentence.lower()
        if not STATEMENT.search(low):
            continue
        if re.search(r"resealed|subsample|handed over", low) and not re.search(
            r"unable|inable|unabe|could not", low
        ):
            continue
        if re.search(r"not (be )?cannabis|found not to be|did not contain", low):
            classes.add("not_cannabis")
        elif re.search(
            r"unable|inable|unabe|could not|cannot|insufficient|not able", low
        ):
            classes.add(
                "degraded"
                if re.search(r"decompos|deteriorat|decay|degrad|rotten|mould", low)
                else "inconclusive"
            )
        elif re.search(
            r"papaver|poppy|catha|khat|psilocybe|malvaceae|not a species", low
        ):
            classes.add("not_cannabis")
        elif "cannabis" in low:
            classes.add("cannabis_sativa")
    return classes


def name_tokens(text: str) -> List[str]:
    return sorted(
        token
        for token in re.findall(r"[a-z][a-z'’-]*", text.lower())
        if token not in NAME_NOISE and len(token) > 1
    )


def parse_date(value: Any) -> Optional[date]:
    return source.mdb_date(value)


def resolve_dates(rows: List[Dict[str, Any]]) -> List[Dict[str, Optional[str]]]:
    """Receipt and certification dates, correcting only years before 2000."""
    out: List[Dict[str, Optional[str]]] = []
    previous: Optional[date] = None
    for row in rows:
        receipt = parse_date(row["Receipt Date"])
        certified = parse_date(row["Certification Date"])
        good = lambda d: d is not None and d.year >= EARLIEST_YEAR  # noqa: E731
        use_receipt = (
            receipt if good(receipt) else (certified if good(certified) else previous)
        )
        use_certified = (
            certified if good(certified) or certified is None else use_receipt
        )
        out.append(
            {
                "receipt": use_receipt.isoformat() if use_receipt else None,
                "certified": use_certified.isoformat() if use_certified else None,
                "corrected": (receipt != use_receipt or certified != use_certified),
            }
        )
        previous = use_receipt or previous
    return out


def build(
    mdb_rows: Optional[List[Dict[str, Any]]] = None,
    csv_rows: Optional[List[Dict[str, str]]] = None,
) -> Dict[str, Any]:
    """Expected values for every certificate.

    With no arguments the local export files are read. The in-app import passes
    the rows from the uploaded bundle instead; the CSV comparison runs only when
    CSV rows are available.
    """
    if mdb_rows is None:
        mdb_rows = source.load_mdb()
        csv_rows = source.load_csv() if source.CSV_PATH.exists() else None
    differences = (
        source.compare_csv_with_mdb(csv_rows, mdb_rows) if csv_rows is not None else []
    )
    rows = sorted(mdb_rows, key=lambda r: int(r["Certificate Number"]))
    dates = resolve_dates(rows)

    certificates = []
    for row, resolved in zip(rows, dates):
        number = int(row["Certificate Number"])
        reference = clean_text(row["Police Reference Number"])
        narrative = squash(clean_text(row["Result"]))
        tag_cell = clean_text(row["Tag Number"])
        description = clean_text(row["Description"])
        if not tag_cell and expected_tags(description):
            # Certificate 1922 has its tags typed into the Description column.
            tag_cell, description = description, ""
        tags = expected_tags(tag_cell)
        extras = {
            label: squash(clean_text(row[label]))
            for label in ("Location", "Quantity Sub Sampled", "New Bag Numbers")
            if squash(clean_text(row[label]))
        }
        if not tags:
            extras["Quantity of Bags (no tag numbers recorded)"] = squash(
                clean_text(row["Quantity of Bags"])
            )
        officer_cell = squash(clean_text(row["Police Officer"]))
        officer_expected = bool(
            re.search(
                r"\d{4,6}|officer|constable|sergeant|inspector|detective|\bdet\b|"
                r"\bpc\b|[a-z0-9]/c\b|sgt",
                officer_cell,
                re.IGNORECASE,
            )
        )
        if officer_cell and not officer_expected:
            extras["Police Officer (not recognised as an officer)"] = officer_cell
        officer_parts = re.split(
            r"\s+on\s+be[a-z]*\s+of\s*[-:.]*\s*", officer_cell, maxsplit=1, flags=re.I
        )
        officer_parts += [""] * (2 - len(officer_parts))
        rank_stated = {
            role: bool(part and RANK_AT_START.match(part))
            for role, part in zip(("submitting", "requesting"), officer_parts)
        }
        without_behalf = re.sub(
            r"\bon\s+be[a-z]*\s+of\b", "on-behalf", officer_cell, flags=re.I
        )
        station_matches = re.findall(
            r"\b(?:of|from|fo|for)\s+(?!(?:sworn|unsworn)\b)([A-Za-z].*?)\.?$",
            without_behalf,
            re.I,
        )
        station_text = station_matches[-1].strip() if station_matches else ""
        if re.search(
            r"\d{4,}|^(?:sworn|unsworn|officer|constable|detective|sergeant|senior|first)\b",
            station_text,
            re.I,
        ):
            station_text = ""  # an officer's name and rank, not a place
        section_c_raw = clean_text(row["Other Matters"])
        envelopes = set()
        for line in section_c_raw.splitlines():
            text = squash(line).rstrip(".")
            if text.lower().startswith(SME_PHRASE + " "):
                envelopes.add(text[len(SME_PHRASE) :].strip())
        envelope = envelopes.pop() if len(envelopes) == 1 else ""
        surnames = [
            s for s in SURNAMES if s in clean_text(row["Approved Botanist"]).lower()
        ]
        certificates.append(
            {
                "cert": number,
                "case_number": reference or f"CRT-{number}",
                "receipt_date": resolved["receipt"],
                "cert_date": resolved["certified"],
                "date_corrected": resolved["corrected"],
                "tags": tags or ["UNKNOWN"],
                "tag_cell": squash(tag_cell),
                "quantity_cell": clean_text(row["Quantity of Bags"]),
                "content_types": content_types(description),
                "narrative_types": content_types(narrative),
                "description": description,
                "result_classes": sorted(result_classes(narrative)),
                "narrative": narrative,
                "section_c": squash(section_c_raw),
                "envelope": envelope if len(envelope) <= 20 else "",
                "botanist_surnames": surnames,
                "defendant_tokens": name_tokens(clean_text(row["Defendant"])),
                "defendant_cell": squash(clean_text(row["Defendant"])),
                "officer_cell": officer_cell,
                "officer_expected": officer_expected,
                "station_text": station_text,
                "rank_stated": rank_stated,
                "officer_badges": sorted(
                    set(
                        re.findall(
                            r"(?:PD)?(\d{4,6})\b", clean_text(row["Police Officer"])
                        )
                    )
                ),
                "comments": squash(clean_text(row["Comments"])),
                "extras": extras,
            }
        )

    case_numbers = {c["case_number"] for c in certificates}
    forms = sum(math.ceil(len(c["tags"]) / MAX_BAGS_PER_FORM) for c in certificates)
    return {
        "source_row_count": len(rows),
        "csv_compared": csv_rows is not None,
        "csv_mdb_differences": differences,
        "fees_all_zero": all(
            str(r["Identification Fee"]).replace("$", "") in ("0.00", "None", "")
            for r in rows
        ),
        "mailmerge_all_false": all(
            str(r["MailMerge"]).lower() == "false" for r in rows
        ),
        "totals": {
            "certificates": len(certificates),
            "cases": len(case_numbers),
            "forms": forms,
            "bags": sum(len(c["tags"]) for c in certificates),
        },
        "certificates": certificates,
    }


def main() -> int:
    expected = build()
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    with open(OUTPUT, "w", encoding="utf-8") as handle:
        json.dump(expected, handle, indent=1, ensure_ascii=False)
    totals = expected["totals"]
    print(
        f"expected.json: {totals['certificates']} certificates, {totals['cases']} cases, "
        f"{totals['forms']} forms, {totals['bags']} bags; "
        f"{len(expected['csv_mdb_differences'])} CSV/MDB differences "
        "(expected: the damaged reference numbers and four memo artefacts)"
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
