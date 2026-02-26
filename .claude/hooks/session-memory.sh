#!/bin/bash
# DuarteOS Hook: Auto-save session context
# Triggered by: Stop event

SESSION_FILE=".claude/session-context.md"

if [ ! -f "$SESSION_FILE" ]; then
  exit 0
fi

# Append timestamp
DATE=$(date '+%Y-%m-%d %H:%M')
echo "" >> "$SESSION_FILE"
echo "### $DATE — Sessao encerrada automaticamente" >> "$SESSION_FILE"
echo "- Contexto salvo via DuarteOS hook" >> "$SESSION_FILE"

exit 0
