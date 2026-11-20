# Legacy certificate import

Imports the historical certificates from the old Access database
(`Cannabis2000.mdb`, table `Cannabis`, 3,727 rows) as legacy cases.

- One case per police reference number, one Priority 3 form per old
  certificate (split into forms of at most five bags), one bag per tag with its
  own content type and result.
- Every case is marked legacy, every form is complete, and no certificate is
  ever made for a legacy form: the old system issued it, and it may have been
  presented in court.
- Every source row is kept unaltered in `LegacySourceRecord` (Django admin,
  searchable by certificate or case number), with the record the import made
  from it, so any mistake found later can be traced and fixed.
- Officer roles follow the certificate rules: "Sworn Officer" and "Unsworn
  Officer" are labels, never ranks; a real rank from the source is kept.

## Sensitive data

The source table, its CSV export, the list of explained differences and the
row-specific officer corrections hold personal data. They live only in
`backend/etl/data/` (gitignored, excluded from the image) and in the upload
bundle. Never commit, email or attach them.

Rules committed with the code must stay general: patterns, rank and station
vocabularies, spelling variants. A rule that names a person or quotes a source
row belongs in `etl/data/rules/` and is read through
`etl/transform/private_rules.py`; add its file name to `NAMES` there so the
bundle carries it and the transform refuses to run without it. Examples in
comments and tests use made-up names, badge numbers and tags.

## Layout

```
etl/
  bundle.py               build and read the upload bundle
  run_transform.py        source table -> certificate records (no merging)
  config.json             column configuration
  transform/              per-field rules (domains/), dates, bags, officers
  verify/
    export_mdb.py         Access table -> JSON (run once, needs access-parser)
    source.py, oracle.py  independent expected values from the source
    app_sweep.mjs         checks every case through the running app
    run_app_sweep.sh      runs the sweep with API throttling off, then restores it
    sweep_settings.py     the unthrottled settings the sweep's backend uses
  data/                   gitignored: raw exports, private rules, outputs, exceptions, reports
cases/legacy_import/      importer, rollback, reconciliation, background tasks
```

## Prepare the data (once, locally)

```bash
cd monorepo/backend
python -m venv /tmp/mdbvenv && /tmp/mdbvenv/bin/pip install access-parser
/tmp/mdbvenv/bin/python etl/verify/export_mdb.py /path/to/Cannabis2000.mdb \
    etl/data/raw/Cannabis2000_mdb.json
# Optional: etl/data/raw/Cannabis2000.csv enables the CSV comparison check.
# Reviewed differences go in etl/data/verify/exceptions.json:
#   [{"check": "botanist", "id": "D491805", "reason": "..."}]
# Row-specific officer corrections go in etl/data/rules/officer_field_corrections.json
# (required; keep the copy from the original working set).
python -m etl.bundle      # writes etl/data/legacy_import_bundle.zip
```

## Run from the app (staging and production)

Only users with **Maintainer** ticked (Django admin, superusers only) see the
Legacy import section on the Settings page.

1. Upload `legacy_import_bundle.zip`. It is checked (format, checksums, columns,
   unique certificate numbers) before it is kept. It is stored in the database,
   never in file storage, and never served back.
2. **Dry run**: transforms and loads inside a transaction that is rolled back,
   and reports the counts.
3. **Import**: loads for real, then runs the checks. Expected: 2,803 cases,
   3,967 forms, 11,295 bags and 0 unexplained differences.
4. **Check imported data** reruns the checks at any time.
5. **Undo import** removes everything the import created, except records an app
   case still uses. App cases are never touched.
6. Delete the bundle when finished.

Tasks run in the background, one at a time, and show their log and result. The
import is one transaction: a task cut short changes nothing.

## Run locally (development)

```bash
cd monorepo/backend
poetry run python etl/run_transform.py                       # etl/data/modded/cannabis_clean.json
python -m etl.verify.oracle                                  # etl/data/modded/expected.json
poetry run python manage.py load_cannabis_data               # dry run
poetry run python manage.py load_cannabis_data --commit
poetry run python manage.py reconcile_legacy_import          # exits 1 on any unexplained difference
poetry run python manage.py undo_legacy_import --commit
SWEEP_EMAIL=you@dbca.wa.gov.au SWEEP_PASSWORD='...' etl/verify/run_app_sweep.sh
```

To start from empty: `poetry run python manage.py purge_case_data --confirm --reset-counters`.
Set `ETL_DEBUG_FILES=1` to let the field rules write their diagnostic files.

## What a person should review after the import

The import reports, and the Settings page shows:

- certificates whose result text does not say which bag had which result; their
  bags hold the legacy value "mixed";
- certificates with no result in the source (bags left pending);
- case numbers already used by cases made in the app (not imported).
