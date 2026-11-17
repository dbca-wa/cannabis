"""Per-bag content types and results for one legacy certificate.

The legacy table records one description and one result narrative for the whole
certificate. The application records a content type and a determination for
each bag. This module derives the per-bag values from the narrative where it
names the bags, and says so when it could not.

The result is a list of bags, each with ``tag``, ``content_type``,
``determination`` and ``basis``. ``basis`` states how the determination was
reached so the import report can list the certificates a person should check:

``certificate``    one result for the whole certificate
``named_bags``     every bag is named in the narrative
``named_and_rest`` some bags are named, the others take the one unnamed result
``unsplit``        the narrative gives different results but not for which
                   bags; every bag carries the legacy value ``mixed``
"""

import re
from typing import Any, Dict, List, Optional, Tuple

CANNABIS = "cannabis_sativa"
NOT_CANNABIS = "not_cannabis"
DEGRADED = "degraded"
INCONCLUSIVE = "inconclusive"
MIXED = "mixed"
PENDING = "pending"

TAG_EXPRESSION = re.compile(r"([A-Z]{1,3})(\d{3,})((?:[-/]\d+)*)")
SUFFIX = re.compile(r"([-/])(\d+)")

NEGATIVE_CANNABIS = re.compile(
    r"not (?:be )?cannabis|found not to be|did not contain cannabis|"
    r"not a species of (?:the genus )?cannabis"
)
UNABLE = re.compile(
    r"\b(?:unable|inable|unabe)\b|not able|could not|cannot|insufficient"
)
DETERIORATED = re.compile(r"decompos|deteriorat|decay|degrad|rotten|mould|mold")
NOT_CANNABIS_SPECIES = re.compile(
    r"papaver|poppy|catha|khat|psilocybe|malvaceae|not a species"
)
POSITIVE_CANNABIS = re.compile(
    r"identified|confirm|observed|contained|was cannabis|were cannabis|"
    r"are cannabis|is cannabis|as cannabis"
)
IDENTIFICATION = re.compile(
    r"\bidentif|\bunable\b|\binable\b|\bunabe\b|could not|not a species|"
    r"consistent with|not able|cannot|cannabis|insufficient|found not|"
    r"papaver|poppy|catha|khat|psilocybe|malvaceae|probably|appear"
)
OWN_VERB = re.compile(
    r"identif|\bunable\b|\binable\b|could not|cannot|not able|confirm|found|appear"
)
SEALING = re.compile(r"resealed|subsample|handed over|sealed into|sealed in ")

NOUN_TO_CONTENT_TYPE: List[Tuple[re.Pattern, str]] = [
    (re.compile(r"plant material|leaf|leaves|loose green"), "plant_material"),
    (re.compile(r"seedling"), "seedling"),
    (re.compile(r"root ?ball|root/|crown|plant bases|roots"), "rootball"),
    (re.compile(r"stalk"), "stalk"),
    (re.compile(r"\bstems?\b"), "stem"),
    (re.compile(r"cutting|striking"), "cutting"),
    (re.compile(r"\bseeds?\b"), "seed"),
    (re.compile(r"mushroom"), "mushroom"),
    (re.compile(r"\bplants?\b"), "plant"),
]


def expand_tags(text: str) -> List[str]:
    """Every tag named in ``text``, expanding ranges such as ``T53140-45``.

    ``T53951-2-3`` is T53951, T53952, T53953. ``T53948/50`` is T53948 and
    T53950. A range written with a hyphen includes every tag between.
    """
    tags: List[str] = []
    for match in TAG_EXPRESSION.finditer(text):
        prefix, digits, suffixes = match.groups()
        tags.append(f"{prefix.upper()}{digits}")
        current = digits
        for separator, tail in SUFFIX.findall(suffixes):
            end = (
                current[: len(current) - len(tail)] + tail
                if len(tail) <= len(current)
                else tail
            )
            if separator == "-" and int(end) > int(current):
                tags.extend(
                    f"{prefix.upper()}{number:0{len(current)}d}"
                    for number in range(int(current) + 1, int(end) + 1)
                )
            else:
                tags.append(f"{prefix.upper()}{end}")
            current = end
    return tags


def split_sentences(text: str) -> List[str]:
    protected = re.sub(r"\bnos?\.", "no", text, flags=re.IGNORECASE)
    parts = re.split(r"(?<=[.;])\s*(?=[A-Z])", protected.strip())
    return [part.strip() for part in parts if part.strip()]


def split_clauses(sentence: str) -> List[str]:
    """Split "... bag T1 as X and the ... bag T2 as Y" into its two clauses.

    Only done when every clause names its own bags and has its own verb, so a
    list such as "seeds and plants in bags T1 and T2" is never cut and
    "unable to identify the plants in bag T1 as X and the plants in bag T2 as Y"
    keeps its single "unable".
    """
    parts = re.split(r",?\s+and\s+(?=the\s)", sentence)
    if (
        len(parts) > 1
        and all(expand_tags(part) for part in parts)
        and all(OWN_VERB.search(part.lower()) for part in parts)
    ):
        return parts
    return [sentence]


def classify_sentence(sentence: str) -> Optional[str]:
    """The determination a single identification sentence states, or None."""
    lowered = sentence.lower()
    if NEGATIVE_CANNABIS.search(lowered):
        return NOT_CANNABIS
    if UNABLE.search(lowered):
        return DEGRADED if DETERIORATED.search(lowered) else INCONCLUSIVE
    if NOT_CANNABIS_SPECIES.search(lowered):
        return NOT_CANNABIS
    if "cannabis" in lowered and POSITIVE_CANNABIS.search(lowered):
        return CANNABIS
    return None


def identification_sentences(narrative: str) -> List[str]:
    sentences = []
    for sentence in split_sentences(narrative):
        lowered = sentence.lower()
        if SEALING.search(lowered) and not UNABLE.search(lowered):
            continue
        if IDENTIFICATION.search(lowered):
            sentences.append(sentence)
    return sentences


def content_type_for_noun(sentence: str) -> Optional[str]:
    lowered = sentence.lower()
    for pattern, content_type in NOUN_TO_CONTENT_TYPE:
        if pattern.search(lowered):
            return content_type
    return None


def determine_bags(
    narrative: str, tags: List[str]
) -> Tuple[Dict[str, str], str, Dict[str, str]]:
    """Return ``(determination by tag, basis, content type by tag for named bags)``."""
    sentences = [
        clause
        for sentence in identification_sentences(narrative)
        for clause in split_clauses(sentence)
    ]
    classified = [(s, classify_sentence(s)) for s in sentences]
    classified = [(s, c) for s, c in classified if c is not None]
    if not classified:
        return {tag: PENDING for tag in tags}, "certificate", {}

    classes = {c for _, c in classified}
    if len(classes) == 1:
        only = classes.pop()
        return {tag: only for tag in tags}, "certificate", {}

    wanted = set(tags)
    named: Dict[str, str] = {}
    named_types: Dict[str, str] = {}
    unnamed: List[str] = []
    for sentence, determination in classified:
        found = [tag for tag in expand_tags(sentence) if tag in wanted]
        if not found:
            unnamed.append(determination)
            continue
        noun_type = content_type_for_noun(sentence)
        for tag in found:
            if tag in named and named[tag] != determination:
                return {tag: MIXED for tag in tags}, "unsplit", {}
            named[tag] = determination
            if noun_type:
                named_types[tag] = noun_type

    if len(named) == len(tags):
        return named, "named_bags", named_types
    if named and len(set(unnamed)) == 1:
        rest = unnamed[0]
        return (
            {tag: named.get(tag, rest) for tag in tags},
            "named_and_rest",
            named_types,
        )
    return {tag: MIXED for tag in tags}, "unsplit", {}


def assign_content_types(
    description: List[str],
    tags: List[str],
    named_types: Dict[str, str],
    fallback_type: Optional[str] = None,
) -> Dict[str, str]:
    """A content type for each bag.

    One described type applies to every bag. Where several are described and the
    narrative names which bag holds which, those bags take the named type and the
    rest take the remaining type when only one is left. Otherwise the bag is
    ``unsure``: the source does not say, and guessing would invent a fact.
    """
    described = [d for d in description if d] or ["unknown"]
    unique = list(dict.fromkeys(described))
    # A vague word in the description ("roots", "pot") must not hide the one
    # concrete type it sits beside.
    concrete = [t for t in unique if t not in ("unsure", "unknown")]
    if concrete:
        unique = concrete
    elif fallback_type:
        unique = [fallback_type]
    if len(unique) == 1:
        return {tag: unique[0] for tag in tags}
    assigned = {tag: named_types[tag] for tag in tags if tag in named_types}
    leftover = [t for t in unique if t not in set(assigned.values())]
    result: Dict[str, str] = {}
    for tag in tags:
        if tag in assigned:
            result[tag] = assigned[tag]
        elif len(leftover) == 1:
            result[tag] = leftover[0]
        else:
            result[tag] = "unsure"
    return result


def pair_new_tags(
    tags: List[str], narrative: str, new_tags: List[str]
) -> Dict[str, str]:
    """Pair each original tag with the tag of the bag it was resealed into.

    The narrative lists new tags in the order of the original bags only when it
    describes one resealing per bag. Tags of subsample bags are not
    replacements, so they are set aside first. If the remaining count does not
    equal the number of original bags the pairing is not attempted: every new
    tag is still in the narrative stored with each bag.
    """
    subsample_tags = set()
    for sentence in split_sentences(narrative):
        if "subsample" in sentence.lower():
            subsample_tags.update(expand_tags(sentence))
    replacements = [
        tag for tag in dict.fromkeys(new_tags or []) if tag not in subsample_tags
    ]
    if len(replacements) != len(tags) or tags == ["UNKNOWN"]:
        return {}
    return dict(zip(tags, replacements))


def build_bags(record: Dict[str, Any]) -> Dict[str, Any]:
    """The bags for one certificate record, with how each result was reached."""
    tags: List[str] = list(dict.fromkeys(record.get("tag_numbers") or []))
    result = record.get("result") or {}
    narrative = ((result.get("processing_notes") or {}).get("original_text")) or ""
    if not tags:
        tags = ["UNKNOWN"]
    determinations, basis, named_types = determine_bags(narrative, tags)
    sentences = identification_sentences(narrative)
    content_types = assign_content_types(
        record.get("description") or [],
        tags,
        named_types,
        content_type_for_noun(sentences[0]) if sentences else None,
    )
    new_tags = pair_new_tags(tags, narrative, result.get("new_tag_numbers") or [])
    bags = [
        {
            "tag": tag,
            # Later certificates record the bag's own tag as its "new" one;
            # that is not a reseal, so it is not stored twice.
            "new_tag": new_tags.get(tag) if new_tags.get(tag) != tag else None,
            "content_type": content_types[tag],
            "determination": determinations[tag],
            "narrative": narrative or None,
        }
        for tag in tags
    ]
    return {"bags": bags, "result_basis": basis}
