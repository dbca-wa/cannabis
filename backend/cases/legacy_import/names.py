"""Name and badge normalisation used to recognise the same person or place."""

import re
from typing import Optional, Tuple

TITLES = {"dr", "prof", "professor", "mr", "mrs", "ms", "miss"}


def _tokens(text: str) -> list:
    cleaned = re.sub(r"[^a-z\s'-]", " ", (text or "").lower())
    return [token for token in re.split(r"[\s,]+", cleaned) if token]


def person_key(given_names: Optional[str], last_name: Optional[str]) -> str:
    """A key equal for "LANDER, Nicholas S", "Nicholas Lander" and "N. Lander".

    Titles and single-letter initials are dropped and the rest sorted, so word
    order and middle initials do not matter.
    """
    tokens = [
        token
        for token in _tokens(f"{given_names or ''} {last_name or ''}")
        if token not in TITLES and len(token) > 1
    ]
    return " ".join(sorted(tokens))


def tidy_word(word: str) -> str:
    """``GARFIELD`` as ``Garfield`` and ``MCDONALD`` as ``McDonald``.

    Words that already mix capitals and lower case are left as written.
    """
    if len(word) > 1 and word.isupper():
        word = word.title()
        word = re.sub(r"\b(Mc)([a-z])", lambda m: m.group(1) + m.group(2).upper(), word)
        word = re.sub(r"(['-])([a-z])", lambda m: m.group(1) + m.group(2).upper(), word)
    return word


def split_full_name(name: str) -> Tuple[str, str]:
    """``"Bexana Garfield"`` as ``("Bexana", "Garfield")``; one word is a surname."""
    parts = [tidy_word(word) for word in (name or "").split()]
    if not parts:
        return "", ""
    if len(parts) == 1:
        return "", parts[0]
    return " ".join(parts[:-1]), parts[-1]


def normalise_badge(badge: Optional[str]) -> str:
    return re.sub(r"\s+", "", (badge or "")).upper()


def place_key(name: Optional[str]) -> str:
    return re.sub(r"\s+", " ", (name or "")).strip().casefold()
