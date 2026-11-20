"""Run the domain processors over extracted source rows.

Each domain standardises one field of every row. The processors report what
they changed or could not understand to a logger object; this module supplies a
lightweight in-memory one so a run leaves nothing behind except its report.
"""

import json
from collections import Counter
from pathlib import Path
from typing import Any, Dict, List

from .domains import get_domain_processor


class TransformationLogger:
    """Collects issues reported by the domain processors."""

    def __init__(self) -> None:
        self.issue_counts: Counter = Counter()
        self.review_items: List[Dict[str, Any]] = []

    def log_transformation_issue(
        self,
        domain_name: str,
        row_id: int,
        column: str,
        original_value: Any,
        issue_type: str,
        action_taken: str,
        final_value: Any,
        requires_review: bool = False,
    ) -> None:
        self.issue_counts[(domain_name, issue_type)] += 1
        if requires_review:
            self.review_items.append(
                {
                    "domain": domain_name,
                    "row_id": row_id,
                    "column": column,
                    "original_value": str(original_value),
                    "issue_type": issue_type,
                    "action_taken": action_taken,
                    "final_value": str(final_value),
                }
            )

    def summary(self) -> Dict[str, Any]:
        by_domain: Dict[str, Dict[str, int]] = {}
        for (domain, issue), count in sorted(self.issue_counts.items()):
            by_domain.setdefault(domain, {})[issue] = count
        return {
            "issues_by_domain": by_domain,
            "requires_review": len(self.review_items),
        }


def domains_in_order(config: Dict[str, Any]) -> List[str]:
    """Domain names in the order the configuration lists them."""
    names: List[str] = []
    for column in config.get("columns", []):
        if column.get("skip_and_drop", False):
            continue
        for resulting in column.get("resulting_columns", []):
            if resulting["name"] not in names:
                names.append(resulting["name"])
    return names


def run_domains(
    records: List[Dict[str, Any]],
    config: Dict[str, Any],
    logger: TransformationLogger,
) -> Dict[str, List[str]]:
    """Process every domain over the records in place.

    Returns the rows that raised an error, by domain, so a failure is never
    silent. A domain that cannot be imported at all raises immediately.
    """
    failures: Dict[str, List[str]] = {}
    for domain_name in domains_in_order(config):
        processor = get_domain_processor(domain_name)
        for index, record in enumerate(records):
            try:
                record[domain_name] = processor.process_value(
                    record.get(domain_name), index, logger
                )
            except Exception as error:  # noqa: BLE001 - reported, never swallowed
                failures.setdefault(domain_name, []).append(f"row {index}: {error}")
    return failures


def write_json(path: Path, payload: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with open(path, "w", encoding="utf-8") as handle:
        json.dump(payload, handle, indent=2, ensure_ascii=False)
