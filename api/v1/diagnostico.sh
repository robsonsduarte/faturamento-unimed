#!/bin/bash

# ============================================================================
# DIAGNÓSTICO RÁPIDO - 30 SEGUNDOS
# ============================================================================

API_KEY="e877ba1c49319300be89bee57a9f11581c0b65c3326ddaf9121b414bafed5960"
BASE="https://consultoriopro.com.br/service/api/v1"

echo "DIAGNÓSTICO RÁPIDO - ConsultorioPro API"
echo "========================================"
echo ""

# Teste 1: Health Check
echo -n "1. Health Check (sem auth): "
if curl -s "$BASE/health" | grep -q '"status":"healthy"'; then
    echo "✅ OK"
else
    echo "❌ FALHOU - API não está respondendo"
fi

# Teste 2: Executions (referência que funciona)
echo -n "2. Executions (query param): "
response=$(curl -s "$BASE/executions?company=1" -H "X-API-Key: $API_KEY")
if echo "$response" | grep -q '"success":true'; then
    echo "✅ OK - API Key válida"
elif echo "$response" | grep -q 'UNAUTHORIZED'; then
    echo "❌ FALHOU - API Key sem permissão"
elif echo "$response" | grep -q '"success":false'; then
    echo "⚠️  ERRO - $(echo "$response" | grep -o '"message":"[^"]*"')"
else
    echo "❌ FALHOU - Erro desconhecido"
fi

# Teste 3: Schedules (path param)
echo -n "3. Schedules (path param): "
response=$(curl -s "$BASE/schedules/1" -H "X-API-Key: $API_KEY")
if echo "$response" | grep -q '"success":true'; then
    echo "✅ OK - Path param funciona"
elif echo "$response" | grep -q 'UNAUTHORIZED'; then
    echo "❌ FALHOU - Sem permissão"
else
    echo "⚠️  ERRO"
fi

# Teste 4: Professionals (query param)
echo -n "4. Professionals (query param): "
response=$(curl -s "$BASE/professionals?company_id=1" -H "X-API-Key: $API_KEY")
if echo "$response" | grep -q '"success":true'; then
    echo "✅ OK - Query param funciona"
elif echo "$response" | grep -q 'UNAUTHORIZED'; then
    echo "❌ FALHOU - Sem permissão"
else
    echo "⚠️  ERRO"
fi

# Teste 5: Professionals (path param) - O PROBLEMA!
echo -n "5. Professionals (path param): "
response=$(curl -s "$BASE/professionals/1" -H "X-API-Key: $API_KEY")
if echo "$response" | grep -q '"success":true'; then
    echo "✅ OK - Funcionando!"
elif echo "$response" | grep -q 'UNAUTHORIZED'; then
    echo "❌ FALHOU - Sem permissão (ESTE É O PROBLEMA!)"
elif echo "$response" | grep -q 'not found'; then
    echo "❌ FALHOU - Método não encontrado (routes.php não corrigido)"
else
    echo "⚠️  ERRO"
fi
echo ""

# Análise
echo "========================================"
echo "ANÁLISE:"
echo "========================================"
echo ""

if curl -s "$BASE/executions?company=1" -H "X-API-Key: $API_KEY" | grep -q '"success":true'; then
    echo "✅ API Key está VÁLIDA e tem acesso à empresa 1"
    echo ""
    
    if curl -s "$BASE/professionals?company_id=1" -H "X-API-Key: $API_KEY" | grep -q '"success":true'; then
        echo "✅ Professionals (query param) funciona"
        
        if curl -s "$BASE/professionals/1" -H "X-API-Key: $API_KEY" | grep -q '"success":true'; then
            echo "✅ Professionals (path param) funciona"
            echo ""
            echo "🎉 TUDO FUNCIONANDO!"
        else
            echo "❌ Professionals (path param) NÃO funciona"
            echo ""
            echo "📋 DIAGNÓSTICO:"
            echo "  1. routes.php não foi corrigido OU"
            echo "  2. Controller não foi substituído OU"
            echo "  3. Problema de cache"
            echo ""
            echo "🔧 SOLUÇÃO:"
            echo "  1. Verifique se aplicou as 4 correções no routes.php"
            echo "  2. Verifique se o ProfessionalController.php foi substituído"
            echo "  3. Limpe o cache do PHP/Apache"
            echo ""
            echo "📄 Resposta completa:"
            curl -s "$BASE/professionals/1" -H "X-API-Key: $API_KEY"
        fi
    else
        echo "❌ Professionals não funciona (nem query param)"
        echo ""
        echo "📋 DIAGNÓSTICO:"
        echo "  Problema no ProfessionalController ou routes.php"
    fi
else
    echo "❌ API Key INVÁLIDA ou SEM PERMISSÃO para empresa 1"
    echo ""
    echo "🔧 SOLUÇÃO:"
    echo "  1. Verifique se a API Key está correta"
    echo "  2. Verifique se tem acesso à empresa 1"
    echo "  3. Tente regenerar a API Key"
fi