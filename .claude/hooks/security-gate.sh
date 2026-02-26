#!/bin/bash
# DuarteOS Hook: Security gate for dangerous commands
# Triggered by: PreToolUse (Bash)

COMMAND="$1"

# Block dangerous patterns
DANGEROUS_PATTERNS=(
  "rm -rf /"
  "rm -rf ~"
  "DROP DATABASE"
  "DROP TABLE"
  "truncate"
  "> /dev/sda"
  "mkfs"
  "dd if="
  ":(){:|:&};:"
  "chmod -R 777 /"
  "curl.*|.*sh"
  "wget.*|.*sh"
)

for pattern in "${DANGEROUS_PATTERNS[@]}"; do
  if echo "$COMMAND" | grep -qi "$pattern"; then
    echo "🚨 DuarteOS Security Gate: Blocked dangerous command pattern: $pattern"
    echo "Command: $COMMAND"
    exit 1
  fi
done

# Warn on sudo usage
if echo "$COMMAND" | grep -q "sudo"; then
  echo "⚠️ DuarteOS: sudo detected — proceeding with caution"
fi

exit 0
