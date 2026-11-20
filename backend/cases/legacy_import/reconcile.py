"""Compare imported legacy data with what the old system's table says it must be.

``Reconciler`` runs every check against the database. It takes the expected
values (from ``etl.verify.oracle``), the reasoned exceptions and the source rows
as plain data, so the same checks run from the command line and from the
in-app import.

A difference passes only if the exceptions list names it, with a reason.
"""

import difflib
import math
import re
from collections import Counter, defaultdict
from zoneinfo import ZoneInfo

from django.db.models import Prefetch

from cases.models import (
    BotanicalAssessment,
    Case,
    Certificate,
    DrugBag,
    LegacySourceRecord,
    Priority3Form,
)
from defendants.models import Defendant
from defendants.validators import placeholder_name_q
from police.models import PoliceOfficer

PERTH = ZoneInfo("Australia/Perth")
MAX_BAGS = 5
SME_PHRASE = "subsamples placed into security movement envelope"
NAME_NOISE = {"unknown"}


def squash(value):
    return re.sub(r"\s+", " ", value or "").strip()


def name_tokens(text):
    return sorted(
        token
        for token in re.findall(r"[a-z][a-z'’-]*", (text or "").lower())
        if token not in NAME_NOISE and len(token) > 1
    )


def perth_date(value):
    return value.astimezone(PERTH).date().isoformat() if value else None


def compatible(db_type, expected_type):
    return (
        db_type == expected_type
        or db_type.startswith(expected_type)
        or expected_type.startswith(db_type)
        or db_type.endswith("_" + expected_type)
    )


def envelope_in(note):
    found = set()
    for line in (note or "").splitlines():
        text = squash(line).rstrip(".")
        if text.lower().startswith(SME_PHRASE + " "):
            value = text[len(SME_PHRASE) :].strip()
            if value:
                found.add(value)
    if len(found) != 1:
        return ""
    value = found.pop()
    return value if len(value) <= 20 else ""


class Reconciler:
    def __init__(self, expected, exceptions, source_rows):
        self.expected = expected
        self.allowed = {(e["check"], str(e["id"])): e["reason"] for e in exceptions}
        self.source_rows = source_rows
        self.failures = []
        self.checked = Counter()

    def run(self):
        """Run every check; return the counts and the unexplained differences."""
        self._reconcile(self.expected)
        unexplained = [
            f for f in self.failures if (f["check"], str(f["id"])) not in self.allowed
        ]
        by_check = Counter(f["check"] for f in unexplained)
        return {
            "checked": dict(sorted(self.checked.items())),
            "unexplained_by_check": dict(by_check),
            "unexplained": unexplained,
            "explained": len(self.failures) - len(unexplained),
        }

    def fail(self, check, ident, detail):
        self.failures.append({"check": check, "id": ident, "detail": detail})

    def ok(self, check, count=1):
        self.checked[check] += count

    def expect(self, check, ident, condition, detail):
        self.checked[check] += 1
        if not condition:
            self.fail(check, ident, detail() if callable(detail) else detail)

    def _reconcile(self, expected):
        self._source_checks(expected)
        self._total_checks(expected)
        self._certificate_checks(expected)
        self._case_checks(expected)
        self._source_record_checks(expected)
        self._global_checks()

    def _source_checks(self, expected):
        self.expect(
            "source_fees", "all", expected["fees_all_zero"], "a fee is not $0.00"
        )
        self.expect(
            "source_mailmerge",
            "all",
            expected["mailmerge_all_false"],
            "MailMerge not all FALSE",
        )
        for line in expected["csv_mdb_differences"]:
            damaged = "Police Reference Number" in line and (
                "E+" in line or re.search(r"csv='(\d+)' mdb='0\1'", line)
            )
            memo = (
                "\u00ff\u00fe" in line or "Result" in line or "Police Officer" in line
            )
            typo = "Date" in line or "New Bag Numbers" in line
            self.expect(
                "source_csv_vs_mdb",
                line.split(":")[0],
                damaged or memo or typo,
                line,
            )

    def _total_checks(self, expected):
        totals = expected["totals"]
        legacy_cases = Case.all_objects.filter(is_legacy=True)
        forms = Priority3Form.all_objects.filter(case__is_legacy=True)
        bags = DrugBag.all_objects.filter(form__case__is_legacy=True)
        assessments = BotanicalAssessment.all_objects.filter(
            drug_bag__form__case__is_legacy=True
        )
        for name, actual, want in (
            ("cases", legacy_cases.count(), totals["cases"]),
            ("forms", forms.count(), totals["forms"]),
            ("bags", bags.count(), totals["bags"]),
            ("assessments", assessments.count(), totals["bags"]),
            (
                "legacy certificate numbers",
                forms.exclude(legacy_certificate_number="")
                .values("legacy_certificate_number")
                .distinct()
                .count(),
                totals["certificates"],
            ),
        ):
            self.expect(
                "totals",
                name,
                actual == want,
                f"database has {actual}, expected {want}",
            )

    def _certificate_checks(self, expected):
        forms = (
            Priority3Form.all_objects.filter(case__is_legacy=True)
            .select_related("case")
            .prefetch_related(
                Prefetch(
                    "bags",
                    queryset=DrugBag.all_objects.select_related("assessment").order_by(
                        "pk"
                    ),
                )
            )
            .order_by("pk")
        )
        by_cert = defaultdict(list)
        for form in forms:
            by_cert[form.legacy_certificate_number].append(form)

        for cert in expected["certificates"]:
            ident = str(cert["cert"])
            group = by_cert.get(ident, [])
            self.expect(
                "form_present", ident, bool(group), "no form for this certificate"
            )
            if not group:
                continue
            want_forms = math.ceil(len(cert["tags"]) / MAX_BAGS)
            self.expect(
                "form_count",
                ident,
                len(group) == want_forms,
                f"{len(group)} forms, expected {want_forms}",
            )
            self.expect(
                "case_number",
                ident,
                all(
                    f.case.case_number.casefold() == cert["case_number"].casefold()
                    for f in group
                ),
                lambda: f"forms are in case {group[0].case.case_number}, expected {cert['case_number']}",
            )
            bags = [bag for form in group for bag in form.bags.all()]
            self.expect(
                "form_bag_cap",
                ident,
                all(len(f.bags.all()) <= MAX_BAGS for f in group),
                "a form holds more than five bags",
            )
            self.expect(
                "tags",
                ident,
                sorted(b.seal_tag_numbers for b in bags) == sorted(cert["tags"]),
                lambda: f"database {sorted(b.seal_tag_numbers for b in bags)[:6]} expected {sorted(cert['tags'])[:6]}",
            )
            self.expect(
                "phase",
                ident,
                all(f.phase == "complete" for f in group),
                "form is not complete",
            )
            self.expect(
                "certified_date",
                ident,
                all(
                    (
                        f.legacy_certified_date.isoformat()
                        if f.legacy_certified_date
                        else None
                    )
                    == cert["cert_date"]
                    for f in group
                ),
                lambda: f"{[str(f.legacy_certified_date) for f in group]} expected {cert['cert_date']}",
            )
            self.expect(
                "section_c",
                ident,
                all(squash(f.additional_notes) == cert["section_c"] for f in group),
                lambda: f"{squash(group[0].additional_notes)[:80]!r} expected {cert['section_c'][:80]!r}",
            )
            want_envelope = cert["envelope"]
            self.expect(
                "envelope",
                ident,
                all(f.security_movement_envelope == want_envelope for f in group),
                lambda: f"{group[0].security_movement_envelope!r} expected {want_envelope!r}",
            )
            self._content_types(ident, cert, bags)
            self._results(ident, cert, bags)
            for bag in bags:
                assessment = getattr(bag, "assessment", None)
                self.expect(
                    "assessment_present",
                    f"{ident}/{bag.seal_tag_numbers}",
                    assessment is not None,
                    "bag has no assessment",
                )
                if assessment is None:
                    continue
                self.expect(
                    "assessment_date",
                    f"{ident}/{bag.seal_tag_numbers}",
                    perth_date(assessment.assessment_date) == cert["cert_date"],
                    f"{perth_date(assessment.assessment_date)} expected {cert['cert_date']}",
                )
                self.expect(
                    "narrative",
                    f"{ident}/{bag.seal_tag_numbers}",
                    squash(assessment.botanist_notes) == cert["narrative"],
                    "botanist notes differ from the source result text",
                )
                if bag.new_seal_tag_numbers:
                    self.expect(
                        "new_tag_in_narrative",
                        f"{ident}/{bag.seal_tag_numbers}",
                        bag.new_seal_tag_numbers.upper() in cert["narrative"].upper(),
                        f"new tag {bag.new_seal_tag_numbers} is not in the source result text",
                    )

    def _content_types(self, ident, cert, bags):
        types = {b.content_type for b in bags}
        want = cert["content_types"]
        if not want:
            # No usable description: the type is unknown unless the result text
            # names the material.
            self.expect(
                "content_types",
                ident,
                all(
                    t == "unknown"
                    or any(compatible(t, n) for n in cert["narrative_types"])
                    for t in types
                ),
                f"{sorted(types)} but the description is {cert['description']!r} and the result text names {cert['narrative_types']}",
            )
            return
        allowed = want + cert["narrative_types"]
        legal = all(
            t == "unsure" or any(compatible(t, w) for w in allowed) for t in types
        )
        self.expect(
            "content_types",
            ident,
            legal,
            f"database {sorted(types)} source description {want}, result text {cert['narrative_types']}",
        )
        self.expect(
            "unsure_only_when_ambiguous",
            ident,
            "unsure" not in types or len(want) > 1,
            "bags are unsure although the description names one type",
        )

    def _results(self, ident, cert, bags):
        got = {b.assessment.determination for b in bags if hasattr(b, "assessment")}
        classes = set(cert["result_classes"])
        if not classes:
            ok = got == {"pending"}
        elif len(classes) == 1:
            ok = got == classes
        else:
            ok = got <= classes | {"mixed"} and (got == {"mixed"} or classes <= got)
        self.expect(
            "results",
            ident,
            ok,
            f"database {sorted(got)} source narrative says {sorted(classes)}",
        )

    def _case_checks(self, expected):
        by_case = defaultdict(list)
        for cert in expected["certificates"]:
            by_case[cert["case_number"].casefold()].append(cert)
        cases = {
            c.case_number.casefold(): c
            for c in Case.all_objects.filter(is_legacy=True)
            .select_related(
                "approved_botanist",
                "requesting_officer",
                "submitting_officer",
                "station",
            )
            .prefetch_related("defendants")
        }
        for key, certs in by_case.items():
            ident = certs[0]["case_number"]
            case = cases.get(key)
            self.expect("case_present", ident, case is not None, "case missing")
            if case is None:
                continue
            first = certs[0]
            receipts = [c["receipt_date"] for c in certs if c["receipt_date"]]
            self.expect(
                "received",
                ident,
                perth_date(case.received) == min(receipts),
                f"{perth_date(case.received)} expected {min(receipts)}",
            )
            botanist = case.approved_botanist
            surnames = first["botanist_surnames"]
            self.expect(
                "botanist",
                ident,
                botanist is not None
                and len(surnames) == 1
                and (botanist.last_name or "").lower() == surnames[0],
                lambda: f"{botanist and botanist.last_name} expected one of {surnames}",
            )
            want_def = set()
            for cert in certs:
                want_def.update(cert["defendant_tokens"])
            got_def = set()
            for defendant in case.defendants.all():
                got_def.update(
                    name_tokens(
                        f"{defendant.given_names or ''} {defendant.last_name or ''}"
                    )
                )
            # A cell that names nobody (a location, an operation) is kept as a
            # comment instead of becoming a defendant.
            kept_as_comment = not got_def and all(
                squash(c["defendant_cell"]) in squash(case.internal_comments)
                for c in certs
                if c["defendant_tokens"]
            )
            if not got_def and want_def and kept_as_comment:
                self.ok("defendant_text_kept_as_comment")
            self.expect(
                "defendants",
                ident,
                got_def == want_def or (not got_def and kept_as_comment),
                f"database {sorted(got_def)} source {sorted(want_def)}",
            )
            self._officers(ident, case, first)
            comments = squash(case.internal_comments)
            wanted = [c["comments"] for c in certs if c["comments"]]
            for cert in certs:
                wanted.extend(cert["extras"].values())
            for text in wanted:
                self.expect(
                    "internal_comments",
                    ident,
                    squash(text) in comments,
                    f"{squash(text)[:60]!r} is not in the case's internal comments",
                )
        self.expect(
            "no_unexpected_cases",
            "all",
            set(cases) <= set(by_case),
            "legacy cases the source does not have",
        )

    def _officers(self, ident, case, first):
        text = first["officer_cell"].casefold()
        digits = set()
        for officer in (case.requesting_officer, case.submitting_officer):
            if officer is None:
                continue
            if officer.badge_number:
                digits.update(re.findall(r"\d+", officer.badge_number))
            if officer.last_name:
                # Spelling slips in the source ("Garby", "FENMORE") are
                # corrected by the standardisation rules, so compare by closeness.
                words = re.findall(r"[a-z'’-]+", text)
                closest = max(
                    (
                        difflib.SequenceMatcher(
                            None, officer.last_name.casefold(), w
                        ).ratio()
                        for w in words
                    ),
                    default=0,
                )
                self.expect(
                    "officer_name_in_source",
                    ident,
                    closest >= 0.75,
                    f"officer {officer.last_name} is not in {first['officer_cell'][:80]!r}",
                )
            self.expect(
                "officer_not_rank_label",
                ident,
                officer.rank not in ("sworn_officer", "unsworn_officer"),
                "role label stored as a rank",
            )
        # A rank the source states is kept, so "print recorded rank" can show
        # it for the requesting officer. Sworn/Unsworn are labels and give none.
        for role, officer in (
            ("submitting", case.submitting_officer),
            ("requesting", case.requesting_officer),
        ):
            if officer is not None and first["rank_stated"][role]:
                self.expect(
                    "officer_rank_kept",
                    f"{ident}/{role}",
                    officer.rank not in ("", "other", "unknown"),
                    f"{officer.full_name} has rank {officer.rank!r}; source {first['officer_cell'][:80]!r}",
                )
        # Every badge in the source must be on an officer. An officer may also
        # carry a badge the source row omitted when the same named officer is
        # recorded with it elsewhere; that is counted, not failed.
        wanted_badges = set(first["officer_badges"])
        # Badges the two officer slots cannot hold keep the whole officer text
        # in the case's internal comments.
        recorded = squash(first["officer_cell"]) in squash(case.internal_comments)
        self.expect(
            "officer_badges",
            ident,
            wanted_badges <= digits or recorded,
            f"database {sorted(digits)} is missing source badge(s) {sorted(wanted_badges - digits)}",
        )
        if digits - wanted_badges:
            self.ok("officer_badge_taken_from_same_named_officer")
        station_text = first["station_text"]
        if station_text and first["officer_expected"]:
            station = case.station
            raw_words = [w for w in re.findall(r"[a-z]{3,}", station_text.lower())]
            station_words = re.findall(
                r"[a-z]{3,}", (station.name if station else "").lower()
            )
            matched = any(
                a == b
                or a.startswith(b)
                or b.startswith(a)
                or difflib.SequenceMatcher(None, a, b).ratio() >= 0.7
                for a in raw_words
                for b in station_words
            )
            # Abbreviations ("OCI", "Ftle Dets", "R'ham") must be a subsequence
            # of the station's letters, so a wrong station cannot slip through.
            if not matched and station:
                compact = re.sub(r"[^a-z]", "", station_text.lower())
                letters = iter(re.sub(r"[^a-z]", "", station.name.lower()))
                matched = bool(compact) and all(ch in letters for ch in compact)
            self.expect(
                "station",
                ident,
                station is not None and matched,
                f"station {station and station.name!r} for source text {station_text!r}",
            )
        else:
            self.expect(
                "station_not_invented",
                ident,
                case.station is None,
                f"station {case.station and case.station.name!r} but the source names none",
            )
        self.expect(
            "officer_present",
            ident,
            first["officer_expected"]
            == bool(case.submitting_officer or case.requesting_officer),
            "officer presence differs from the source",
        )

    def _source_record_checks(self, expected):
        """Every source row is stored, unaltered, against the case it became."""
        mdb_rows = {str(row["Certificate Number"]): row for row in self.source_rows}
        records = {
            r.certificate_number: r
            for r in LegacySourceRecord.objects.select_related("case")
        }
        self.expect(
            "source_record_count",
            "all",
            len(records) == len(mdb_rows),
            f"{len(records)} source records for {len(mdb_rows)} source rows",
        )
        for cert in expected["certificates"]:
            ident = str(cert["cert"])
            record = records.get(ident)
            self.expect(
                "source_record_present", ident, record is not None, "no source record"
            )
            if record is None:
                continue
            self.expect(
                "source_record_exact",
                ident,
                record.source_row == mdb_rows[ident],
                "stored row differs from the Access row",
            )
            self.expect(
                "source_record_case",
                ident,
                record.case is not None
                and record.case.case_number.casefold()
                == cert["case_number"].casefold(),
                lambda: f"linked to {record.case and record.case.case_number}",
            )
            self.expect(
                "source_record_transformed",
                ident,
                str(record.transformed.get("cert_number")) == ident
                and "source_row" not in record.transformed,
                "transformed record missing or holds a second copy of the row",
            )

    def _global_checks(self):
        self.expect(
            "no_legacy_certificates",
            "all",
            not Certificate.all_objects.filter(form__case__is_legacy=True).exists(),
            "a legacy form has a certificate",
        )
        self.expect(
            "no_placeholder_defendants",
            "all",
            not Defendant.all_objects.filter(placeholder_name_q()).exists(),
            "a defendant is named Unknown",
        )
        self.expect(
            "legacy_flag",
            "all",
            not Case.all_objects.filter(
                is_legacy=False, legacy_id__isnull=False
            ).exists(),
            "a case with a legacy id is not flagged legacy",
        )
        unattributed = (
            Case.all_objects.filter(is_legacy=True, created_by__isnull=True).count()
            + Priority3Form.all_objects.filter(
                case__is_legacy=True, created_by__isnull=True
            ).count()
            + DrugBag.all_objects.filter(
                form__case__is_legacy=True, created_by__isnull=True
            ).count()
        )
        self.expect(
            "attributed_to_import",
            "all",
            unattributed == 0,
            f"{unattributed} imported rows have no import attribution",
        )
        by_badge = defaultdict(list)
        for officer in PoliceOfficer.all_objects.exclude(
            badge_number__isnull=True
        ).exclude(badge_number=""):
            by_badge[officer.badge_number].append(officer)
        for badge, officers in by_badge.items():
            for i, one in enumerate(officers):
                for other in officers[i + 1 :]:
                    alike = difflib.SequenceMatcher(
                        None,
                        (one.last_name or "").casefold(),
                        (other.last_name or "").casefold(),
                    ).ratio()
                    self.expect(
                        "no_duplicate_officers",
                        badge,
                        alike < 0.75,
                        f"{one.full_name} and {other.full_name} share badge {badge}",
                    )
