#!/bin/bash
# DuarteOS Hook: Monitoramento de tamanho do bundle
# Triggered by: PostToolUse (Bash) — apenas apos "npm run build" ou "next build"
# Gate 8 do pipeline de qualidade
# Apenas aviso — nunca bloqueia (exit 0 sempre)

INPUT="$1"

# Apenas intercepta comandos de build
if [[ "$INPUT" != *"npm run build"* ]] && [[ "$INPUT" != *"next build"* ]] && [[ "$INPUT" != *"npx next build"* ]]; then
  exit 0
fi

# Verificar se o diretorio .next existe (build Next.js)
BUILD_DIR=".next"

if [ ! -d "$BUILD_DIR" ]; then
  # Tentar outros diretorios comuns de build
  for dir in "dist" "build" "out"; do
    if [ -d "$dir" ]; then
      BUILD_DIR="$dir"
      break
    fi
  done
fi

if [ ! -d "$BUILD_DIR" ]; then
  exit 0
fi

# Ler threshold de configuracao
CONFIG_FILE=".claude/config/project.yaml"
MAX_SIZE_KB=0

if [ -f "$CONFIG_FILE" ]; then
  SIZE_LINE=$(grep -E "^\s*bundle_size_alert_kb:" "$CONFIG_FILE" 2>/dev/null)
  if [ -n "$SIZE_LINE" ]; then
    MAX_SIZE_KB=$(echo "$SIZE_LINE" | sed 's/.*:\s*//' | tr -d '[:space:]')
  fi
fi

# Se threshold e 0, apenas reporta o tamanho sem alerta
if [ "$MAX_SIZE_KB" = "0" ] || [ -z "$MAX_SIZE_KB" ]; then
  # Calcular e mostrar tamanho mesmo sem threshold
  if command -v du &>/dev/null; then
    TOTAL_SIZE_KB=$(du -sk "$BUILD_DIR" 2>/dev/null | cut -f1)
    if [ -n "$TOTAL_SIZE_KB" ]; then
      TOTAL_SIZE_MB=$((TOTAL_SIZE_KB / 1024))
      echo "📦 DuarteOS Bundle Size: ${BUILD_DIR}/ = ${TOTAL_SIZE_MB}MB (${TOTAL_SIZE_KB}KB)"
    fi
  fi
  exit 0
fi

# Calcular tamanho do build
if ! command -v du &>/dev/null; then
  exit 0
fi

TOTAL_SIZE_KB=$(du -sk "$BUILD_DIR" 2>/dev/null | cut -f1)

if [ -z "$TOTAL_SIZE_KB" ]; then
  exit 0
fi

TOTAL_SIZE_MB=$((TOTAL_SIZE_KB / 1024))

if [ "$TOTAL_SIZE_KB" -gt "$MAX_SIZE_KB" ] 2>/dev/null; then
  MAX_SIZE_MB=$((MAX_SIZE_KB / 1024))
  echo "⚠️  DuarteOS Bundle Size: Build excedeu o limite configurado!"
  echo "   Tamanho atual: ${TOTAL_SIZE_MB}MB (${TOTAL_SIZE_KB}KB)"
  echo "   Limite: ${MAX_SIZE_MB}MB (${MAX_SIZE_KB}KB)"
  echo "   Excesso: $(( (TOTAL_SIZE_KB - MAX_SIZE_KB) / 1024 ))MB"
  echo ""
  echo "   Sugestoes para reduzir:"
  echo "   - Verifique imports desnecessarios"
  echo "   - Use dynamic imports para rotas pesadas"
  echo "   - Analise com 'npx @next/bundle-analyzer'"
else
  echo "📦 DuarteOS Bundle Size: ${TOTAL_SIZE_MB}MB (${TOTAL_SIZE_KB}KB) — dentro do limite (${MAX_SIZE_KB}KB)"
fi

# Nunca bloqueia — apenas aviso
exit 0
