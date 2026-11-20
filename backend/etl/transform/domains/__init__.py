"""Field-level standardisation of the legacy certificate table.

Each domain standardises one source field. A domain module exposes
``process_value(value, row_index, logger)`` and may ship a
``standardisation.json`` of rules. Dates are handled separately in
``etl.transform.dates`` because the Access table stores real dates.
"""

from importlib import import_module

DOMAINS = (
    "approved_botanist",
    "cert_number",
    "defendants",
    "description",
    "internal_comments",
    "other_matters",
    "police_officer",
    "police_reference_number",
    "quantity_of_bags",
    "result",
    "tag_numbers",
)


def get_domain_processor(domain_name: str):
    """Return the ``logic`` module for a domain."""
    if domain_name not in DOMAINS:
        raise ImportError(f"Unknown domain: {domain_name}")
    return import_module(f"{__name__}.{domain_name}.logic")


def get_available_domains():
    return list(DOMAINS)


__all__ = ["DOMAINS", "get_domain_processor", "get_available_domains"]
