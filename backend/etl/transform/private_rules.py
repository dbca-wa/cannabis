"""Transform rules that name real people, kept out of git.

A few corrections only make sense for one row of the old table, so they name
the officers on that row. They live in ``etl/data/rules/`` (gitignored) and
travel in the import bundle. A run inside the app hands the bundle's copy to
``supplied``; a local run reads the directory.
"""

import json
from contextlib import contextmanager
from contextvars import ContextVar
from pathlib import Path
from typing import Any, Dict, Iterator, List, Optional

RULES_DIR = Path(__file__).resolve().parent.parent / "data" / "rules"
OFFICER_CORRECTIONS = "officer_field_corrections.json"
NAMES = (OFFICER_CORRECTIONS,)

_supplied: ContextVar[Optional[Dict[str, Any]]] = ContextVar(
    "private_rules", default=None
)


@contextmanager
def supplied(rules: Dict[str, Any]) -> Iterator[None]:
    """Use ``rules`` (file name to parsed JSON) instead of the local directory."""
    token = _supplied.set(rules)
    try:
        yield
    finally:
        _supplied.reset(token)


def load(name: str) -> Optional[Any]:
    """The parsed rule file, or ``None`` when it is not available."""
    rules = _supplied.get()
    if rules is not None:
        return rules.get(name)
    path = RULES_DIR / name
    if not path.exists():
        return None
    with open(path, encoding="utf-8") as handle:
        return json.load(handle)


def missing() -> List[str]:
    """Rule files the transform needs but cannot find."""
    return [name for name in NAMES if load(name) is None]
