"""Maps police form item descriptions to DrugBag ContentType choices."""

# Lookup table keyed by (description, type) tuples in lowercase.
# Values correspond to DrugBag.ContentType choices.
CONTENT_TYPE_MAP: dict[tuple[str, str], str] = {
    ("cannabis", "plant"): "plant",
    ("cannabis", "plant material"): "plant_material",
    ("cannabis", "seed"): "seed",
    ("cannabis", "seed material"): "seed_material",
    ("cannabis", "cutting"): "cutting",
    ("cannabis", "stalk"): "stalk",
    ("cannabis", "stem"): "stem",
    ("cannabis", "seedling"): "seedling",
    ("cannabis", "head"): "head",
    ("cannabis", "rootball"): "rootball",
    ("poppy", "plant"): "poppy_plant",
    ("poppy", "capsule"): "poppy_capsule",
    ("poppy", "head"): "poppy_head",
    ("poppy", "seed"): "poppy_seed",
    ("poppy", ""): "poppy",
    ("mushroom", ""): "mushroom",
    ("mushroom", "mushroom"): "mushroom",
    ("tablet", ""): "tablet",
    ("tablet", "tablet"): "tablet",
}


def map_content_type(description: str, item_type: str) -> str:
    """Case-insensitive lookup against the mapping table.

    Returns the matching DrugBag ContentType value, or 'unknown'
    if no match is found.
    """
    key = (description.strip().lower(), item_type.strip().lower())
    if key in CONTENT_TYPE_MAP:
        return CONTENT_TYPE_MAP[key]

    # Try with empty type as fallback (e.g. bare "poppy" or "mushroom")
    fallback_key = (key[0], "")
    return CONTENT_TYPE_MAP.get(fallback_key, "unknown")
