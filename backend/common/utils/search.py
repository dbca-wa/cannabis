"""Helpers for free-text searches."""

import re

_SEPARATORS = re.compile(r"[\s,;]+")


def search_terms(text):
    """Split a search into words, ignoring commas and semicolons.

    People are shown as "SURNAME, Given", so a name typed or pasted the way it
    is shown must match the same records as "Given Surname".

        "WINCHESTER, Dean" -> ["WINCHESTER", "Dean"]
        "  Dean  "         -> ["Dean"]
        ""                 -> []
    """
    return [term for term in _SEPARATORS.split(text or "") if term]
