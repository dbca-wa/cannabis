"""Validation rules for case data entered through the API."""

SAME_OFFICER_MESSAGE = (
    "The conveying officer and the requesting officer must be two different "
    "people. Choose a different officer for one of them."
)


def _officer_id(value):
    return getattr(value, "pk", value)


def same_officer_error(data, instance=None):
    """The error to raise if one officer would fill both roles, else None.

    Going forward a case may not name the same person as both its conveying
    (submitting) and requesting officer. Older records, including those brought
    in by the ETL, can already break this rule; such a case keeps its officers
    and can still be edited as long as neither officer is changed to keep the
    clash. The ETL writes through the models, not these serializers, so it is
    never blocked.

    Args:
        data: Validated serializer data; officers missing from it keep the
            instance's current value.
        instance: The case being updated, or None when creating one.
    """
    current_sub = getattr(instance, "submitting_officer_id", None)
    current_req = getattr(instance, "requesting_officer_id", None)
    sub = (
        _officer_id(data["submitting_officer"])
        if "submitting_officer" in data
        else current_sub
    )
    req = (
        _officer_id(data["requesting_officer"])
        if "requesting_officer" in data
        else current_req
    )
    if not sub or not req or sub != req:
        return None
    # An existing clash that this change leaves exactly as it was.
    if instance is not None and current_sub == current_req == sub:
        return None
    return SAME_OFFICER_MESSAGE
