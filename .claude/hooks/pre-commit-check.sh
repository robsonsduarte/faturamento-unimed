#!/bin/bash
# DuarteOS Hook: Quality gate before commits
# Triggered by: PreToolUse (Bash) when command contains "git commit"

COMMAND="$1"

# Only intercept git commit commands
if [[ "$COMMAND" != *"git commit"* ]]; then
  exit 0
fi

echo "🔍 DuarteOS Pre-Commit Check..."

ERRORS=0

# Type check (if tsconfig exists)
if [ -f "tsconfig.json" ]; then
  echo "  → TypeScript check..."
  npx tsc --noEmit 2>/dev/null
  if [ $? -ne 0 ]; then
    echo "  ✗ TypeScript errors found"
    ERRORS=$((ERRORS + 1))
  else
    echo "  ✓ TypeScript OK"
  fi
fi

# Lint check
if [ -f "node_modules/.bin/eslint" ]; then
  echo "  → ESLint check..."
  npx eslint . --max-warnings 0 2>/dev/null
  if [ $? -ne 0 ]; then
    echo "  ✗ Lint errors found"
    ERRORS=$((ERRORS + 1))
  else
    echo "  ✓ ESLint OK"
  fi
fi

# Test check (if test script exists)
if grep -q '"test"' package.json 2>/dev/null; then
  echo "  → Running tests..."
  npm test 2>/dev/null
  if [ $? -ne 0 ]; then
    echo "  ✗ Tests failed"
    ERRORS=$((ERRORS + 1))
  else
    echo "  ✓ Tests OK"
  fi
fi

if [ $ERRORS -gt 0 ]; then
  echo "❌ Pre-commit check failed ($ERRORS issues). Fix before committing."
  exit 1
fi

echo "✅ All checks passed."
exit 0
