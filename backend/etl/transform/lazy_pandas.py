"""pandas, imported only when first used.

Some field-rule modules carry analysis helpers that read CSVs with pandas.
The import itself never calls them, and pandas is a development dependency
only, so the modules import this stand-in instead of pandas directly.
"""

import math
from importlib import import_module


class _LazyPandas:
    def __getattr__(self, name):
        return getattr(import_module("pandas"), name)


pd = _LazyPandas()


def is_missing(value) -> bool:
    """True for None and NaN: what ``pd.isna`` reports for a single value."""
    return value is None or (isinstance(value, float) and math.isnan(value))
