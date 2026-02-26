#!/bin/bash
# DuarteOS Hook: Auto-lint after file edit
# Triggered by: PostToolUse (Write, Edit)

FILE="$1"
EXIT_CODE=0

# Detect and run linter
if [ -f "node_modules/.bin/eslint" ]; then
  npx eslint --fix "$FILE" 2>/dev/null
  EXIT_CODE=$?
elif [ -f "node_modules/.bin/biome" ]; then
  npx biome check --write "$FILE" 2>/dev/null
  EXIT_CODE=$?
elif [ -f "node_modules/.bin/prettier" ]; then
  npx prettier --write "$FILE" 2>/dev/null
  EXIT_CODE=$?
fi

exit $EXIT_CODE
