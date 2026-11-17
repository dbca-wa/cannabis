"""Whether the domain processors may write their diagnostic files.

The processors can write ``debug.txt`` and analysis files beside their code,
which is useful when tuning a rule locally. They are off by default because the
import also runs inside the deployed app, whose filesystem is read-only.
Set ``ETL_DEBUG_FILES=1`` to turn them on.
"""

import os


def enabled() -> bool:
    return os.environ.get("ETL_DEBUG_FILES") == "1"
