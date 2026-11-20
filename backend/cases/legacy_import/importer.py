"""Persist certificate-level legacy JSON as legacy cases, forms, bags and results.

Mapping, in brief:

* One case per police reference number (``case_key``).
* One form per legacy certificate, split into forms of at most five bags.
* One bag per tag, each with its own content type and result.
* Facts that differ between a case's certificates and cannot live on the case
  itself (a second botanist, officer or receipt date) are recorded in the
  case's internal comments so nothing is dropped.
"""

import json
import logging
from collections import Counter, OrderedDict
from dataclasses import dataclass, field
from datetime import date, datetime
from typing import Any, Dict, List, Optional
from zoneinfo import ZoneInfo

from django.db import transaction

from cases.models import (
    BotanicalAssessment,
    Case,
    DrugBag,
    LegacySourceRecord,
    Priority3Form,
)
from cases.services import certificate_wording as wording

from .resolvers import (
    BotanistResolver,
    DefendantResolver,
    OfficerResolver,
    StationResolver,
    get_import_user,
)

logger = logging.getLogger(__name__)

PERTH = ZoneInfo("Australia/Perth")
ENVELOPE_MAX_LENGTH = 20


@dataclass
class ImportReport:
    counts: Counter = field(default_factory=Counter)
    failed_cases: List[Dict[str, str]] = field(default_factory=list)
    conflicts: List[str] = field(default_factory=list)
    unsplit_certificates: List[int] = field(default_factory=list)
    unassessed_certificates: List[int] = field(default_factory=list)
    split_certificates: List[int] = field(default_factory=list)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "counts": dict(sorted(self.counts.items())),
            "failed_cases": self.failed_cases,
            "conflicts": self.conflicts,
            "unsplit_certificates": self.unsplit_certificates,
            "unassessed_certificates": self.unassessed_certificates,
            "split_certificates": self.split_certificates,
        }


def perth_midnight(iso_date: Optional[str]) -> Optional[datetime]:
    if not iso_date:
        return None
    parsed = date.fromisoformat(iso_date)
    return datetime(parsed.year, parsed.month, parsed.day, tzinfo=PERTH)


def unwrap(value: Any, key: str) -> Optional[str]:
    """Text inside a ``{"key": text}`` wrapper (or plain text), None when blank."""
    if isinstance(value, str):
        stripped = value.strip()
        if stripped.startswith("{"):
            try:
                value = json.loads(stripped).get(key)
            except json.JSONDecodeError:
                value = stripped
        else:
            value = stripped
    if isinstance(value, str) and value.strip():
        return value.strip()
    return None


def as_object(value: Any, default: Any) -> Any:
    if isinstance(value, str):
        try:
            return json.loads(value)
        except json.JSONDecodeError:
            return default
    return value if value is not None else default


class LegacyImporter:
    def __init__(self, dry_run: bool = False) -> None:
        self.dry_run = dry_run
        self.report = ImportReport()

    # ------------------------------------------------------------------ run

    def run(self, records: List[Dict[str, Any]]) -> ImportReport:
        groups: "OrderedDict[str, List[Dict[str, Any]]]" = OrderedDict()
        for record in sorted(records, key=lambda r: int(r["cert_number"])):
            groups.setdefault(record["case_key"], []).append(record)

        with transaction.atomic():
            # Everything, including the import user, is created inside the
            # transaction so a dry run leaves no trace.
            self.import_user = get_import_user()
            self._build_resolvers()
            for case_key, certificates in groups.items():
                before = [Counter(r.stats) for r in self._resolvers()]
                try:
                    with transaction.atomic():
                        self._import_case(case_key, certificates)
                except Exception as error:  # noqa: BLE001 - reported per case
                    self.report.counts["cases failed"] += 1
                    self.report.failed_cases.append(
                        {"case": case_key, "error": f"{type(error).__name__}: {error}"}
                    )
                    logger.warning("Case %s was not imported: %s", case_key, error)
                    # The case's records were rolled back, so anything the
                    # resolvers remembered about them is stale: start them afresh.
                    self._build_resolvers()
                    for resolver, stats in zip(self._resolvers(), before):
                        resolver.stats = stats
            if self.dry_run:
                transaction.set_rollback(True)

        for resolver in self._resolvers():
            self.report.counts.update(resolver.stats)
        return self.report

    def _build_resolvers(self) -> None:
        self.botanists = BotanistResolver(self.import_user)
        self.stations = StationResolver(self.import_user)
        self.officers = OfficerResolver(self.import_user)
        self.defendants = DefendantResolver(self.import_user)

    def _resolvers(self):
        return (self.botanists, self.stations, self.officers, self.defendants)

    # ----------------------------------------------------------------- case

    def _import_case(self, case_key: str, certificates: List[Dict[str, Any]]) -> None:
        first = certificates[0]
        legacy_id = f"LC{first['cert_number']}"
        if Case.all_objects.filter(legacy_id=legacy_id).exists():
            self.report.counts["cases already imported"] += 1
            return
        if Case.all_objects.filter(case_number=case_key).exists():
            self.report.conflicts.append(case_key)
            self.report.counts["cases in conflict"] += 1
            return

        notes: List[str] = []
        multiple = len(certificates) > 1

        def note(certificate: Dict[str, Any], text: str) -> None:
            prefix = f"Certificate {certificate['cert_number']}: " if multiple else ""
            notes.append(f"{prefix}{text}")

        botanist = self.botanists.resolve(first.get("approved_botanist") or "")
        station, requesting, submitting = self._officers_for(first)
        receipts = [
            perth_midnight(c.get("receipt_date"))
            for c in certificates
            if c.get("receipt_date")
        ]
        received = min(receipts) if receipts else None
        if received is None:
            raise ValueError("no receipt date on any certificate")

        for certificate in certificates:
            if multiple and certificate is not first:
                self._note_differences(certificate, first, received, note)
            comment = unwrap(certificate.get("internal_comments"), "internal_comments")
            if comment:
                note(certificate, comment)
            for extra in certificate.get("extras") or []:
                note(certificate, f"{extra['label']}: {extra['value']}")
            for date_note in certificate.get("date_notes") or []:
                note(certificate, date_note)

        case = Case.objects.create(
            case_number=case_key,
            legacy_id=legacy_id,
            received=received,
            approved_botanist=botanist,
            requesting_officer=requesting,
            submitting_officer=submitting,
            station=station,
            internal_comments="\n".join(notes) or None,
            is_legacy=True,
            created_by=self.import_user,
        )
        self.report.counts["cases"] += 1

        defendants = []
        for certificate in certificates:
            for entry in as_object(certificate.get("defendants"), []):
                if isinstance(entry, dict):
                    defendant = self.defendants.resolve(
                        (entry.get("given_names") or "").strip() or None,
                        (entry.get("last_name") or "").strip() or None,
                    )
                    if defendant and defendant not in defendants:
                        defendants.append(defendant)
        if defendants:
            case.defendants.set(defendants)

        for certificate in certificates:
            self._import_certificate(case, certificate)

    def _officers_for(self, certificate: Dict[str, Any]):
        officers = as_object(certificate.get("police_officer"), {})
        station = self.stations.resolve(officers.get("organisation"))
        requesting_data = officers.get("requesting_officer") or {}
        submitting_data = officers.get("submitting_officer") or {}
        has_requesting = bool(
            requesting_data.get("name") or requesting_data.get("badge_id")
        )
        # "of <station>" follows the officer named last in the source text.
        requesting = self.officers.resolve(
            requesting_data, station if has_requesting else None
        )
        submitting = self.officers.resolve(
            submitting_data, None if has_requesting else station
        )
        return station, requesting, submitting

    def _note_differences(self, certificate, first, received, note) -> None:
        if (certificate.get("approved_botanist") or "") != (
            first.get("approved_botanist") or ""
        ):
            note(
                certificate,
                f"approved botanist: {certificate.get('approved_botanist')}",
            )
        if certificate.get("police_officer") != first.get("police_officer"):
            officers = as_object(certificate.get("police_officer"), {})
            parts = []
            for label, key in (
                ("submitting", "submitting_officer"),
                ("requesting", "requesting_officer"),
            ):
                data = officers.get(key) or {}
                text = " ".join(
                    p
                    for p in (data.get("rank"), data.get("name"), data.get("badge_id"))
                    if p
                )
                if text:
                    parts.append(f"{label} {text}")
            if officers.get("organisation"):
                parts.append(f"station {officers['organisation']}")
            if parts:
                note(certificate, "police officer: " + "; ".join(parts))
        own = perth_midnight(certificate.get("receipt_date"))
        if own and own != received:
            note(certificate, f"received {own.date().isoformat()}")

    # ---------------------------------------------------------- certificate

    def _import_certificate(self, case: Case, certificate: Dict[str, Any]) -> None:
        number = int(certificate["cert_number"])
        section_c = unwrap(certificate.get("other_matters"), "other_matters")
        envelope = wording.sme_from_note(section_c) or ""
        if len(envelope) > ENVELOPE_MAX_LENGTH:
            envelope = ""
        certified = perth_midnight(certificate.get("cert_date"))
        bags = certificate["bags"]

        basis = certificate.get("result_basis")
        determinations = {bag["determination"] for bag in bags}
        if basis == "unsplit":
            self.report.unsplit_certificates.append(number)
        if "pending" in determinations:
            self.report.unassessed_certificates.append(number)
        if len(bags) > Priority3Form.MAX_BAGS:
            self.report.split_certificates.append(number)

        # Keyed by certificate number: a record left behind when its case was
        # deleted in the app is reattached rather than duplicated.
        LegacySourceRecord.objects.update_or_create(
            certificate_number=str(number),
            defaults={
                "source_row": certificate.get("source_row") or {},
                "transformed": {
                    k: v for k, v in certificate.items() if k != "source_row"
                },
                "case": case,
            },
        )
        self.report.counts["source records"] += 1

        for start in range(0, len(bags), Priority3Form.MAX_BAGS):
            chunk = bags[start : start + Priority3Form.MAX_BAGS]
            form = Priority3Form.objects.create(
                case=case,
                phase=Case.PhaseChoices.COMPLETE,
                security_movement_envelope=envelope,
                additional_notes=section_c,
                legacy_certificate_number=str(number),
                legacy_certified_date=certified.date() if certified else None,
                created_by=self.import_user,
            )
            created_bags = DrugBag.objects.bulk_create(
                [
                    DrugBag(
                        form=form,
                        content_type=bag["content_type"],
                        seal_tag_numbers=bag["tag"],
                        new_seal_tag_numbers=bag.get("new_tag"),
                        created_by=self.import_user,
                    )
                    for bag in chunk
                ]
            )
            BotanicalAssessment.objects.bulk_create(
                [
                    BotanicalAssessment(
                        drug_bag=drug_bag,
                        determination=bag["determination"],
                        assessment_date=certified,
                        botanist_notes=bag.get("narrative"),
                        created_by=self.import_user,
                    )
                    for drug_bag, bag in zip(created_bags, chunk)
                ]
            )
            self.report.counts["forms"] += 1
            self.report.counts["bags"] += len(chunk)
        self.report.counts["certificates"] += 1
