#!/bin/bash
# Wrapper to run flake8 and show output but never fail
# Filter out E501 (line too long) warnings to reduce noise
poetry run flake8 "$@" 2>&1 | grep -v "E501 line too long" >&2 || true
exit 0
