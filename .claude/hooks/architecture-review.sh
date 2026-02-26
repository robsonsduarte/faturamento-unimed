#!/bin/bash
# DuarteOS Hook: Revisao de arquitetura para arquivos novos
# Triggered by: PostToolUse (Write, Edit)
# Gate 3 do pipeline de qualidade
# Apenas aviso — nunca bloqueia (exit 0 sempre)

FILE_PATH="$1"

# Se nao recebeu arquivo, sair silenciosamente
if [ -z "$FILE_PATH" ]; then
  exit 0
fi

# Verificar se o arquivo e novo (nao rastreado pelo git)
if ! command -v git &>/dev/null; then
  exit 0
fi

# Se nao estamos em um repositorio git, sair
if ! git rev-parse --is-inside-work-tree &>/dev/null 2>&1; then
  exit 0
fi

# Verificar se o arquivo ja e rastreado pelo git
if git ls-files --error-unmatch "$FILE_PATH" &>/dev/null 2>&1; then
  # Arquivo ja existe no git, nao e novo — nada a verificar
  exit 0
fi

# Arquivo e novo — validar localizacao
# Diretorios reconhecidos (ajuste conforme seu projeto)
KNOWN_DIRS=(
  "src/"
  "tests/"
  "test/"
  "__tests__/"
  "docs/"
  "scripts/"
  "config/"
  "public/"
  "assets/"
  "supabase/"
  ".claude/"
  ".github/"
  ".vscode/"
  "prisma/"
  "migrations/"
  "lib/"
  "app/"
  "pages/"
  "components/"
  "hooks/"
  "styles/"
  "utils/"
  "types/"
  "api/"
)

# Verificar se o arquivo esta em um diretorio reconhecido
IN_KNOWN_DIR=false
for dir in "${KNOWN_DIRS[@]}"; do
  if [[ "$FILE_PATH" == *"$dir"* ]]; then
    IN_KNOWN_DIR=true
    break
  fi
done

if [ "$IN_KNOWN_DIR" = false ]; then
  # Verificar se esta na raiz do projeto
  if [[ "$FILE_PATH" != *"/"* ]] || [[ "$FILE_PATH" == "./"* && $(echo "$FILE_PATH" | tr -cd '/' | wc -c) -le 1 ]]; then
    echo "⚠️  DuarteOS Architecture Review: Arquivo novo criado na raiz do projeto"
    echo "   Arquivo: $FILE_PATH"
    echo "   Considere mover para um diretorio apropriado (src/, tests/, docs/, etc.)"
  else
    echo "⚠️  DuarteOS Architecture Review: Arquivo novo em diretorio nao-padrao"
    echo "   Arquivo: $FILE_PATH"
    echo "   Diretorios reconhecidos: src/, tests/, docs/, scripts/, config/, public/"
    echo "   Se este local e intencional, ignore este aviso."
  fi
fi

# Nunca bloqueia — apenas aviso
exit 0
