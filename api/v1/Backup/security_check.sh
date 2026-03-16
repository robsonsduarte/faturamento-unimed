#!/bin/bash

echo "==========================================="
echo "  🔒 VERIFICAÇÃO DE SEGURANÇA"
echo "==========================================="
echo ""

ERRORS=0

# Teste 1: .gitignore existe?
if [ -f .gitignore ]; then
    echo "✅ .gitignore existe"
else
    echo "❌ .gitignore NÃO EXISTE!"
    ERRORS=$((ERRORS + 1))
fi

# Teste 2: .env está protegido?
if grep -q "^\.env$" .gitignore; then
    echo "✅ .env está protegido no .gitignore"
else
    echo "❌ .env NÃO está protegido!"
    ERRORS=$((ERRORS + 1))
fi

# Teste 3: .env existe mas .env.example também?
if [ -f .env ] && [ -f .env.example ]; then
    echo "✅ .env e .env.example existem"
elif [ -f .env ]; then
    echo "⚠️  .env existe mas .env.example NÃO"
    ERRORS=$((ERRORS + 1))
else
    echo "⚠️  .env não existe (OK se ainda não configurado)"
fi

# Teste 4: Verificar se há senhas no código
echo ""
echo "Procurando senhas hardcoded..."
HARDCODED=$(grep -r "password.*=.*['\"]" --include="*.php" . 2>/dev/null | grep -v ".env" | grep -v "//")
if [ -z "$HARDCODED" ]; then
    echo "✅ Nenhuma senha hardcoded encontrada"
else
    echo "⚠️  POSSÍVEIS senhas hardcoded:"
    echo "$HARDCODED"
    ERRORS=$((ERRORS + 1))
fi

# Teste 5: Verificar logs expostos
echo ""
echo "Procurando arquivos de log..."
LOGS=$(find . -name "*.log" -o -name "error_log" 2>/dev/null)
if [ -z "$LOGS" ]; then
    echo "✅ Nenhum arquivo de log encontrado"
else
    echo "⚠️  Arquivos de log encontrados (devem estar no .gitignore):"
    echo "$LOGS"
fi

# Teste 6: Verificar backups expostos
echo ""
echo "Procurando arquivos de backup..."
BACKUPS=$(find . -name "*.backup" -o -name "*.bak" -o -name "*.old" 2>/dev/null)
if [ -z "$BACKUPS" ]; then
    echo "✅ Nenhum arquivo de backup encontrado"
else
    echo "⚠️  Arquivos de backup encontrados:"
    echo "$BACKUPS"
fi

# Teste 7: Verificar se API Key está exposta
echo ""
echo "Procurando API Keys expostas..."
API_KEYS=$(grep -r "api_key.*=.*[a-f0-9]{64}" --include="*.php" --include="*.sh" . 2>/dev/null | grep -v ".env")
if [ -z "$API_KEYS" ]; then
    echo "✅ Nenhuma API Key exposta encontrada"
else
    echo "⚠️  POSSÍVEIS API Keys expostas:"
    echo "$API_KEYS" | head -3
    ERRORS=$((ERRORS + 1))
fi

# Resumo
echo ""
echo "==========================================="
if [ $ERRORS -eq 0 ]; then
    echo "✅ SEGURANÇA OK! Seguro para commit"
    echo "==========================================="
    exit 0
else
    echo "⚠️  $ERRORS PROBLEMAS ENCONTRADOS!"
    echo "==========================================="
    echo ""
    echo "Corrija os problemas acima antes de fazer commit!"
    exit 1
fi
