"""Text formatting helpers shared across generated documents."""

from typing import Iterable


def join_with_and(values: Iterable[str]) -> str:
    """Join values as a readable English list.

    Certificates are read aloud in court, so lists of tag numbers and content
    types need to read as prose rather than as comma-separated data.

        []                    -> ""
        ["A"]                 -> "A"
        ["A", "B"]            -> "A and B"
        ["A", "B", "C"]       -> "A, B and C"

    Empty and whitespace-only values are dropped. No serial comma before "and",
    matching Australian usage.
    """
    items = [str(value).strip() for value in values if value and str(value).strip()]

    if not items:
        return ""
    if len(items) == 1:
        return items[0]
    if len(items) == 2:
        return f"{items[0]} and {items[1]}"
    return f"{', '.join(items[:-1])} and {items[-1]}"
