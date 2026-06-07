#!/bin/bash
# Pre-commit summary wrapper
# Runs all checks, tests, and displays a summary (blocking on failures)

set -e

# Colours for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Colour

# Track if any issues were found
ISSUES_FOUND=0

# Force output to stderr so it shows in pre-commit
exec 1>&2

echo ""
echo -e "${BLUE}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║         Pre-Commit Check Summary                           ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════════╝${NC}"
echo ""

# Function to run a check and display results
run_check() {
    local check_name="$1"
    local check_command="$2"

    echo -e "${BLUE}▶ Running ${check_name}...${NC}"

    if eval "$check_command" > /tmp/precommit_output.txt 2>&1; then
        echo -e "${GREEN}✓ ${check_name} passed${NC}"
        echo ""
    else
        echo -e "${RED}✗ ${check_name} FAILED:${NC}"
        cat /tmp/precommit_output.txt
        echo ""
        ISSUES_FOUND=1
    fi

    rm -f /tmp/precommit_output.txt
}

# Run flake8 (linting)
if command -v poetry &> /dev/null; then
    run_check "Flake8 (linting)" "poetry run flake8 --max-line-length=88 --extend-ignore=E203,W503,E501 --exclude=migrations,__pycache__,.venv,venv,build,dist,.pytest_cache,htmlcov,staticfiles,etl ."
else
    echo -e "${YELLOW}⚠ Poetry not found, skipping flake8${NC}"
    echo ""
fi

# Run bandit (security)
if command -v poetry &> /dev/null; then
    run_check "Bandit (security)" "poetry run bandit -c pyproject.toml -r . --exclude tests,migrations,venv -q"
else
    echo -e "${YELLOW}⚠ Poetry not found, skipping bandit${NC}"
    echo ""
fi

# Final summary
echo -e "${BLUE}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║         Final Summary                                      ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════════╝${NC}"
echo ""

if [ $ISSUES_FOUND -eq 0 ]; then
    echo -e "${GREEN}✓ All checks passed! Proceeding with commit...${NC}"
    echo ""
    echo -e "${YELLOW}Note: Full test suite will run in CI/CD pipeline${NC}"
    echo ""
    echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
    echo ""
    exit 0
else
    echo -e "${RED}✗ Checks failed! Please fix the issues above before committing.${NC}"
    echo ""
    echo -e "${YELLOW}To bypass these checks (not recommended), use:${NC}"
    echo -e "${YELLOW}  git commit --no-verify${NC}"
    echo ""
    echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
    echo ""
    exit 1
fi
