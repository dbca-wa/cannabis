"""Receipt and certification dates for the legacy certificates.

The Access table stores real dates, so no century guessing is needed. Only
obvious keying errors are corrected, and every correction is recorded so it can
be shown to a person:

* A year before 2000 is a typo (the service started in 2000).
* A missing receipt date takes the certification date.
* Where a replacement is still unavailable, the previous certificate's date is
  used, because certificate numbers are issued in date order.
"""

from datetime import date, datetime
from typing import Any, Dict, List, Optional

EARLIEST_YEAR = 2000


def parse_source_date(value: Any) -> Optional[date]:
    if value in (None, ""):
        return None
    if isinstance(value, datetime):
        return value.date()
    if isinstance(value, date):
        return value
    return datetime.fromisoformat(str(value)[:10]).date()


def _plausible(value: Optional[date]) -> bool:
    return value is not None and value.year >= EARLIEST_YEAR


def _label(value: Optional[date]) -> str:
    return value.strftime("%d %b %Y") if value else "blank"


def resolve_dates(source_rows: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """Return, per row and in the same order, the dates to import and any notes.

    ``source_rows`` must be in certificate-number order and carry the keys
    ``Receipt Date`` and ``Certification Date``.
    """
    resolved: List[Dict[str, Any]] = []
    previous_receipt: Optional[date] = None
    previous_certified: Optional[date] = None
    for row in source_rows:
        source_receipt = parse_source_date(row.get("Receipt Date"))
        source_certified = parse_source_date(row.get("Certification Date"))
        receipt, certified = source_receipt, source_certified
        notes: List[str] = []

        if source_certified is not None and not _plausible(source_certified):
            certified = None
        if source_receipt is not None and not _plausible(source_receipt):
            receipt = None

        if receipt is None:
            receipt = certified or previous_receipt
        if source_certified is not None and certified is None:
            certified = receipt or previous_certified

        if receipt != source_receipt:
            notes.append(
                f"Receipt date: source gave {_label(source_receipt)}; "
                f"{_label(receipt)} used"
            )
        if certified != source_certified:
            notes.append(
                f"Certification date: source gave {_label(source_certified)}; "
                f"{_label(certified)} used"
            )

        resolved.append(
            {
                "receipt_date": receipt.isoformat() if receipt else None,
                "cert_date": certified.isoformat() if certified else None,
                "date_notes": notes,
            }
        )
        previous_receipt = receipt or previous_receipt
        previous_certified = certified or previous_certified
    return resolved
