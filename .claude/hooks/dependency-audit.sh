#!/bin/bash
# DuarteOS Hook: Auditoria de dependencias
# Triggered by: PreToolUse (Bash) — apenas em "git commit"
# Gate 7 do pipeline de qualidade
# Bloqueia apenas se vulnerabilidades HIGH ou CRITICAL encontradas

INPUT="$1"

# Apenas intercepta comandos git commit
if [[ "$INPUT" != *"git commit"* ]]; then
  exit 0
fi

# Verificar se npm esta disponivel
if ! command -v npm &>/dev/null; then
  exit 0
fi

# Verificar se package.json ou package-lock.json foram modificados no staged
DEPS_CHANGED=false

if command -v git &>/dev/null; then
  STAGED_FILES=$(git diff --cached --name-only 2>/dev/null)

  if echo "$STAGED_FILES" | grep -qE "^(package\.json|package-lock\.json)$"; then
    DEPS_CHANGED=true
  fi
fi

# Se dependencias nao foram alteradas, nada a fazer
if [ "$DEPS_CHANGED" = false ]; then
  exit 0
fi

echo "🔐 DuarteOS Dependency Audit: Verificando vulnerabilidades em dependencias..."

# Executar npm audit com nivel high
AUDIT_OUTPUT=$(npm audit --audit-level=high 2>&1)
AUDIT_EXIT=$?

if [ $AUDIT_EXIT -ne 0 ]; then
  # npm audit retorna exit code != 0 quando encontra vulnerabilidades no nivel especificado
  echo "  ✗ Vulnerabilidades HIGH ou CRITICAL encontradas nas dependencias:"
  echo ""
  echo "$AUDIT_OUTPUT" | head -30
  echo ""
  echo "  Execute 'npm audit fix' para tentar corrigir automaticamente."
  echo "  Execute 'npm audit' para ver o relatorio completo."
  exit 1
else
  echo "  ✓ Nenhuma vulnerabilidade HIGH ou CRITICAL encontrada"
  exit 0
fi
