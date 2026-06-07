#!/usr/bin/env bash
# Wrapper script to run frontend pre-commit hooks only on changed frontend files

set -e

# Get list of changed files in frontend directory
CHANGED_FILES=$(git diff --cached --name-only --diff-filter=ACM | grep "^frontend/" || true)

if [ -z "$CHANGED_FILES" ]; then
    echo "No frontend files changed, skipping frontend checks"
    exit 0
fi

echo "Running frontend pre-commit checks..."

# Change to frontend directory for all operations
cd frontend

# Convert paths from "frontend/foo.ts" to "foo.ts"
FRONTEND_FILES=$(echo "$CHANGED_FILES" | sed 's|^frontend/||')

# Export files for hooks that need them
export CHANGED_FILES="$FRONTEND_FILES"

# Run each hook manually in order
echo "→ Running Prettier (formatting)..."
if command -v bun &> /dev/null && [ -n "$FRONTEND_FILES" ]; then
    # Only format files Prettier supports (exclude .sh, .gitignore, Dockerfile, etc.)
    PRETTIER_FILES=$(echo "$FRONTEND_FILES" | grep -E '\.(ts|tsx|js|jsx|json|css|scss|md|html|yaml|yml)$' || true)
    if [ -n "$PRETTIER_FILES" ]; then
        echo "$PRETTIER_FILES" | xargs bunx prettier --write || true
    fi
fi

echo "→ Running ESLint (linting - warnings only)..."
if command -v bun &> /dev/null && [ -f .pre-commit-eslint-wrapper.sh ]; then
    ./.pre-commit-eslint-wrapper.sh || true
fi

echo "→ Running TypeScript (type checking)..."
if command -v bun &> /dev/null; then
    bun run tsc -b || {
        echo "TypeScript errors found. Please fix before committing."
        exit 1
    }
fi

echo "→ Running security checks..."
if [ -f .pre-commit-security-wrapper.sh ]; then
    ./.pre-commit-security-wrapper.sh || true
fi

echo "→ Running commit summary..."
if [ -f .pre-commit-summary.sh ]; then
    ./.pre-commit-summary.sh
fi
