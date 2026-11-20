"""Export the Access `Cannabis` table to JSON so it can be used as a test oracle.

The Access file is the original system of record. This script needs the
pure-Python `access-parser` package, which is deliberately not a project
dependency. Run it from a throwaway virtual environment:

    python -m venv /tmp/mdbvenv
    /tmp/mdbvenv/bin/pip install access-parser
    /tmp/mdbvenv/bin/python etl/verify/export_mdb.py \
        /path/to/Cannabis2000.mdb etl/data/raw/Cannabis2000_mdb.json

The output holds personal data and lives in the gitignored `etl/data/raw/`.
"""

import json
import sys
from datetime import date, datetime

from access_parser import AccessParser


def _jsonable(value):
    if isinstance(value, (datetime, date)):
        return value.isoformat()
    return value


def export(mdb_path: str, out_path: str) -> int:
    table = AccessParser(mdb_path).parse_table("Cannabis")
    columns = list(table.keys())
    count = len(table[columns[0]])
    rows = [
        {column: _jsonable(table[column][index]) for column in columns}
        for index in range(count)
    ]
    with open(out_path, "w", encoding="utf-8") as handle:
        json.dump({"columns": columns, "rows": rows}, handle, ensure_ascii=False)
    return count


if __name__ == "__main__":
    if len(sys.argv) != 3:
        sys.exit(__doc__)
    exported = export(sys.argv[1], sys.argv[2])
    print(f"Exported {exported} rows to {sys.argv[2]}")
