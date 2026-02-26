#!/bin/bash
# DuarteOS Hook: Lembrete de documentacao
# Triggered by: PreToolUse (Bash) — apenas em "git commit"
# Gate 6 do pipeline de qualidade
# Apenas aviso — nunca bloqueia (exit 0 sempre)

INPUT="$1"

# Apenas intercepta comandos git commit
if [[ "$INPUT" != *"git commit"* ]]; then
  exit 0
fi

# Verificar se git esta disponivel
if ! command -v git &>/dev/null; then
  exit 0
fi

# Verificar se arquivos de API foram modificados no staged
STAGED_FILES=$(git diff --cached --name-only 2>/dev/null)

if [ -z "$STAGED_FILES" ]; then
  exit 0
fi

# Procurar arquivos de API modificados
API_CHANGED=false
if echo "$STAGED_FILES" | grep -qE "(src/app/api/|pages/api/|api/|routes/)"; then
  API_CHANGED=true
fi

if [ "$API_CHANGED" = false ]; then
  exit 0
fi

# Verificar se documentacao tambem foi modificada
DOCS_CHANGED=false
if echo "$STAGED_FILES" | grep -qiE "(README|CHANGELOG|docs/|\.md$|swagger|openapi)"; then
  DOCS_CHANGED=true
fi

if [ "$DOCS_CHANGED" = false ]; then
  echo "📝 DuarteOS Docs Gate: Arquivos de API foram modificados sem atualizar documentacao"
  echo "   Arquivos de API alterados:"
  echo "$STAGED_FILES" | grep -E "(src/app/api/|pages/api/|api/|routes/)" | sed 's/^/     /'
  echo "   Considere atualizar README, CHANGELOG ou docs/ correspondentes."
fi

# Nunca bloqueia — apenas aviso
exit 0
