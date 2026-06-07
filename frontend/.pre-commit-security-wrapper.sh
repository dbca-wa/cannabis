#!/bin/bash
# Security pattern checks for frontend code

set -e

# Colours
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

WARNINGS=0

# Check for console.log in production code (not in tests)
echo "Checking for console.log statements..."
if git diff --cached --name-only | grep -E '\.(ts|tsx)$' | grep -v '\.test\.' | xargs grep -n "console\.log" 2>/dev/null; then
    echo -e "${YELLOW}⚠ Warning: console.log found in production code${NC}" >&2
    WARNINGS=$((WARNINGS + 1))
fi

# Check for eval() usage
echo "Checking for eval() usage..."
if git diff --cached --name-only | grep -E '\.(ts|tsx|js|jsx)$' | xargs grep -n "eval(" 2>/dev/null; then
    echo -e "${YELLOW}⚠ Warning: eval() usage detected (security risk)${NC}" >&2
    WARNINGS=$((WARNINGS + 1))
fi

# Check for dangerouslySetInnerHTML without DOMPurify
echo "Checking for unsafe dangerouslySetInnerHTML..."
if git diff --cached --name-only | grep -E '\.(tsx|jsx)$' | xargs grep -l "dangerouslySetInnerHTML" 2>/dev/null | while read file; do
    if ! grep -q "DOMPurify\|sanitize" "$file"; then
        echo -e "${YELLOW}⚠ Warning: dangerouslySetInnerHTML without sanitisation in $file${NC}" >&2
        WARNINGS=$((WARNINGS + 1))
    fi
done; then
    :
fi

# Check for hardcoded URLs (should use env vars)
echo "Checking for hardcoded API URLs..."
if git diff --cached --name-only | grep -E '\.(ts|tsx)$' | xargs grep -nE "https?://[^/]*/(api|backend)" 2>/dev/null | grep -v "VITE_"; then
    echo -e "${YELLOW}⚠ Warning: Hardcoded API URLs found (use environment variables)${NC}" >&2
    WARNINGS=$((WARNINGS + 1))
fi

if [ $WARNINGS -gt 0 ]; then
    echo -e "${YELLOW}Security checks completed with $WARNINGS warning(s)${NC}" >&2
fi

# Always exit 0 (warnings only)
exit 0
