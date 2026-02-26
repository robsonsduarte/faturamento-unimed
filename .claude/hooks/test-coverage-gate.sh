#!/bin/bash
# DuarteOS Hook: Gate de cobertura de testes
# Triggered by: PreToolUse (Bash) — apenas em "git commit"
# Gate 5 do pipeline de qualidade
# Bloqueia se cobertura abaixo do threshold configurado

INPUT="$1"

# Apenas intercepta comandos git commit
if [[ "$INPUT" != *"git commit"* ]]; then
  exit 0
fi

# Verificar se existe configuracao de cobertura minima
CONFIG_FILE=".claude/config/project.yaml"
MIN_COVERAGE=0

if [ -f "$CONFIG_FILE" ]; then
  # Extrair min_test_coverage do YAML (busca simples, sem parser completo)
  COVERAGE_LINE=$(grep -E "^\s*min_test_coverage:" "$CONFIG_FILE" 2>/dev/null)
  if [ -n "$COVERAGE_LINE" ]; then
    MIN_COVERAGE=$(echo "$COVERAGE_LINE" | sed 's/.*:\s*//' | tr -d '[:space:]')
  fi
fi

# Se threshold e 0, gate desabilitado
if [ "$MIN_COVERAGE" = "0" ] || [ -z "$MIN_COVERAGE" ]; then
  exit 0
fi

echo "🧪 DuarteOS Coverage Gate: Verificando cobertura de testes (minimo: ${MIN_COVERAGE}%)..."

# Detectar framework de teste
COVERAGE_RESULT=""

if [ -f "vitest.config.ts" ] || [ -f "vitest.config.js" ] || [ -f "vitest.config.mts" ]; then
  # Vitest
  if ! command -v npx &>/dev/null; then
    echo "  ⚠️  npx nao encontrado — pulando verificacao de cobertura"
    exit 0
  fi

  # Executar vitest com cobertura em formato JSON
  COVERAGE_OUTPUT=$(npx vitest run --coverage --reporter=json 2>&1)
  VITEST_EXIT=$?

  if [ $VITEST_EXIT -ne 0 ]; then
    echo "  ⚠️  Testes falharam — verificacao de cobertura nao pode ser feita"
    echo "  (O gate pre-commit ja deve ter reportado os erros)"
    exit 0
  fi

  # Tentar ler o arquivo de cobertura JSON
  COVERAGE_JSON=""
  for coverage_path in "coverage/coverage-summary.json" "coverage/coverage-final.json"; do
    if [ -f "$coverage_path" ]; then
      COVERAGE_JSON="$coverage_path"
      break
    fi
  done

  if [ -n "$COVERAGE_JSON" ] && command -v node &>/dev/null; then
    ACTUAL_COVERAGE=$(node -e "
      try {
        const data = require('./${COVERAGE_JSON}');
        if (data.total && data.total.lines) {
          console.log(Math.round(data.total.lines.pct));
        } else {
          console.log('unknown');
        }
      } catch(e) {
        console.log('unknown');
      }
    " 2>/dev/null)
  fi

elif [ -f "jest.config.js" ] || [ -f "jest.config.ts" ] || [ -f "jest.config.mjs" ]; then
  # Jest
  if ! command -v npx &>/dev/null; then
    echo "  ⚠️  npx nao encontrado — pulando verificacao de cobertura"
    exit 0
  fi

  npx jest --coverage --coverageReporters=json-summary 2>&1
  JEST_EXIT=$?

  if [ $JEST_EXIT -ne 0 ]; then
    echo "  ⚠️  Testes falharam — verificacao de cobertura nao pode ser feita"
    exit 0
  fi

  if [ -f "coverage/coverage-summary.json" ] && command -v node &>/dev/null; then
    ACTUAL_COVERAGE=$(node -e "
      try {
        const data = require('./coverage/coverage-summary.json');
        if (data.total && data.total.lines) {
          console.log(Math.round(data.total.lines.pct));
        } else {
          console.log('unknown');
        }
      } catch(e) {
        console.log('unknown');
      }
    " 2>/dev/null)
  fi

else
  # Sem framework de teste detectado
  exit 0
fi

# Avaliar resultado
if [ -z "$ACTUAL_COVERAGE" ] || [ "$ACTUAL_COVERAGE" = "unknown" ]; then
  echo "  ⚠️  Nao foi possivel extrair porcentagem de cobertura"
  echo "  Verifique se o coverage reporter esta configurado corretamente"
  exit 0
fi

if [ "$ACTUAL_COVERAGE" -lt "$MIN_COVERAGE" ] 2>/dev/null; then
  echo "  ✗ Cobertura: ${ACTUAL_COVERAGE}% (minimo: ${MIN_COVERAGE}%)"
  echo "  Adicione mais testes antes de commitar."
  exit 1
else
  echo "  ✓ Cobertura: ${ACTUAL_COVERAGE}% (minimo: ${MIN_COVERAGE}%)"
  exit 0
fi
