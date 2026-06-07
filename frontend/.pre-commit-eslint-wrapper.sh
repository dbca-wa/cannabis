#!/bin/bash
# Wrapper to run ESLint and show output but never fail
# Mirrors backend/.pre-commit-flake8-wrapper.sh

# Run ESLint with bun
bun run eslint "$@" >&2

# Always exit 0 (warnings only, don't block commit)
exit 0
