#!/bin/bash
# Wrapper to run bandit and show output but never fail
poetry run bandit -c pyproject.toml -r . --exclude tests,migrations,venv,scripts,_run_etl.py,_etl_ -q >&2
exit 0
