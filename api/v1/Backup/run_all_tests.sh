#!/bin/bash

# =========================================
# Script de Testes Completo - ConsultorioPro API
# =========================================

# Cores
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Configurações
API_KEY="e877ba1c49319300be89bee57a9f11581c0b65c3326ddaf9121b414bafed5960"
BASE_URL="https://consultoriopro.com.br/service/api/v1"
LOG_FILE="test_results_$(date +%Y%m%d_%H%M%S).log"

# Contadores
TOTAL_TESTS=0
PASSED_TESTS=0
FAILED_TESTS=0

# Função para imprimir cabeçalho
print_header() {
    echo -e "${CYAN}=========================================${NC}"
    echo -e "${CYAN}  $1${NC}"
    echo -e "${CYAN}=========================================${NC}"
}

# Função para imprimir fase
print_phase() {
    echo -e "\n${PURPLE}>>> FASE $1${NC}\n"
}

# Função para testar endpoint
test_endpoint() {
    local test_name="$1"
    local method="$2"
    local endpoint="$3"
    local expected_code="$4"
    local data="$5"
    local use_auth="$6"
    
    TOTAL_TESTS=$((TOTAL_TESTS + 1))
    
    echo -e "${BLUE}[Teste $TOTAL_TESTS]${NC} $test_name"
    
    # Construir comando curl
    local curl_cmd="curl -s -w '\n%{http_code}' -X $method"
    
    if [ "$use_auth" == "true" ]; then
        curl_cmd="$curl_cmd -H 'X-API-Key: $API_KEY'"
    fi
    
    if [ ! -z "$data" ]; then
        curl_cmd="$curl_cmd -H 'Content-Type: application/json' -d '$data'"
    fi
    
    curl_cmd="$curl_cmd '$BASE_URL$endpoint'"
    
    # Executar
    response=$(eval $curl_cmd)
    http_code=$(echo "$response" | tail -n1)
    body=$(echo "$response" | sed '$d')
    
    # Verificar resultado
    if [ "$http_code" == "$expected_code" ]; then
        echo -e "   ${GREEN}✅ PASSOU${NC} (HTTP $http_code)"
        PASSED_TESTS=$((PASSED_TESTS + 1))
        echo "[PASSOU] $test_name - HTTP $http_code" >> "$LOG_FILE"
    else
        echo -e "   ${RED}❌ FALHOU${NC} (Esperado: $expected_code, Recebido: $http_code)"
        echo "   Resposta: $(echo $body | cut -c1-100)..."
        FAILED_TESTS=$((FAILED_TESTS + 1))
        echo "[FALHOU] $test_name - Esperado $expected_code, Recebido $http_code" >> "$LOG_FILE"
        echo "Resposta: $body" >> "$LOG_FILE"
    fi
    
    echo "" >> "$LOG_FILE"
}

# Iniciar log
print_header "TESTES DA API - ConsultorioPro" | tee "$LOG_FILE"
echo "Data: $(date)" | tee -a "$LOG_FILE"
echo "API Key: ${API_KEY:0:16}..." | tee -a "$LOG_FILE"
echo "Base URL: $BASE_URL" | tee -a "$LOG_FILE"
echo "" | tee -a "$LOG_FILE"

# =========================================
# FASE 1: TESTES BÁSICOS
# =========================================
print_phase "1 - TESTES BÁSICOS (Fundação)"

test_endpoint \
    "Health Check" \
    "GET" \
    "/health" \
    "200" \
    "" \
    "false"

test_endpoint \
    "Documentação da API" \
    "GET" \
    "/" \
    "200" \
    "" \
    "false"

test_endpoint \
    "Sem Autenticação (deve falhar)" \
    "GET" \
    "/schedules/1" \
    "401" \
    "" \
    "false"

test_endpoint \
    "API Key Inválida (deve falhar)" \
    "GET" \
    "/schedules/1" \
    "401" \
    "" \
    "false"

# Sobrescrever API Key temporariamente para testar key inválida
OLD_API_KEY="$API_KEY"
API_KEY="chave_invalida_123456"
test_endpoint \
    "Autenticação com Key Inválida" \
    "GET" \
    "/schedules/1" \
    "401" \
    "" \
    "true"
API_KEY="$OLD_API_KEY"

test_endpoint \
    "API Key Válida (deve funcionar)" \
    "GET" \
    "/schedules/1" \
    "200" \
    "" \
    "true"

# =========================================
# FASE 2: TESTES DE DADOS (Leitura)
# =========================================
print_phase "2 - TESTES DE DADOS (Leitura)"

test_endpoint \
    "Listar Profissionais" \
    "GET" \
    "/professionals/1" \
    "200" \
    "" \
    "true"

test_endpoint \
    "Profissionais com Google Calendar" \
    "GET" \
    "/professionals/1?with_calendar=true" \
    "200" \
    "" \
    "true"

test_endpoint \
    "Detalhes de Profissional (ID 93)" \
    "GET" \
    "/professionals/1/93" \
    "200" \
    "" \
    "true"

test_endpoint \
    "Listar Ocupações" \
    "GET" \
    "/professionals/1/occupations" \
    "200" \
    "" \
    "true"

# =========================================
# FASE 3: TESTES DE HORÁRIOS
# =========================================
print_phase "3 - TESTES DE HORÁRIOS"

test_endpoint \
    "Horários de Todos os Profissionais" \
    "GET" \
    "/schedules/1" \
    "200" \
    "" \
    "true"

test_endpoint \
    "Horários de UM Profissional (ID 93)" \
    "GET" \
    "/schedules/1/93" \
    "200" \
    "" \
    "true"

test_endpoint \
    "Verificar Disponibilidade (Data Válida)" \
    "GET" \
    "/schedules/1/availability/93?date=2025-11-20" \
    "200" \
    "" \
    "true"

# =========================================
# FASE 4: TESTES DE SINCRONIZAÇÃO
# =========================================
print_phase "4 - TESTES DE SINCRONIZAÇÃO"

test_endpoint \
    "Listar Sincronizações" \
    "GET" \
    "/sync/google-calendar/1" \
    "200" \
    "" \
    "true"

# =========================================
# FASE 5: TESTES DE VALIDAÇÃO (Erros)
# =========================================
print_phase "5 - TESTES DE VALIDAÇÃO (Erros Esperados)"

test_endpoint \
    "Profissional Inexistente (deve retornar 404)" \
    "GET" \
    "/professionals/1/999999" \
    "404" \
    "" \
    "true"

test_endpoint \
    "Horários de Profissional Inexistente (404)" \
    "GET" \
    "/schedules/1/999999" \
    "404" \
    "" \
    "true"

test_endpoint \
    "Data Inválida (deve retornar 422)" \
    "GET" \
    "/schedules/1/availability/93?date=data-invalida" \
    "422" \
    "" \
    "true"

test_endpoint \
    "Disponibilidade Sem Parâmetro Date (400)" \
    "GET" \
    "/schedules/1/availability/93" \
    "400" \
    "" \
    "true"

test_endpoint \
    "Criar Sincronização - Dados Inválidos (422)" \
    "POST" \
    "/sync/google-calendar" \
    "422" \
    '{"dados":"invalidos"}' \
    "true"

test_endpoint \
    "Criar Sincronização - Sem Body (400)" \
    "POST" \
    "/sync/google-calendar" \
    "400" \
    "" \
    "true"

test_endpoint \
    "Endpoint Inexistente (404)" \
    "GET" \
    "/endpoint/que/nao/existe" \
    "404" \
    "" \
    "true"

# =========================================
# RELATÓRIO FINAL
# =========================================
print_header "RELATÓRIO FINAL"

PERCENTAGE=$(awk "BEGIN {printf \"%.2f\", ($PASSED_TESTS / $TOTAL_TESTS) * 100}")

echo -e "${GREEN}✅ Testes Passaram: $PASSED_TESTS${NC}"
echo -e "${RED}❌ Testes Falharam: $FAILED_TESTS${NC}"
echo -e "${BLUE}📊 Total de Testes: $TOTAL_TESTS${NC}"
echo -e "${YELLOW}📈 Taxa de Sucesso: $PERCENTAGE%${NC}"
echo ""
echo -e "📄 Log salvo em: ${CYAN}$LOG_FILE${NC}"
echo ""

# Salvar relatório no log
echo "=========================================" >> "$LOG_FILE"
echo "RELATÓRIO FINAL" >> "$LOG_FILE"
echo "=========================================" >> "$LOG_FILE"
echo "✅ Testes Passaram: $PASSED_TESTS" >> "$LOG_FILE"
echo "❌ Testes Falharam: $FAILED_TESTS" >> "$LOG_FILE"
echo "📊 Total de Testes: $TOTAL_TESTS" >> "$LOG_FILE"
echo "📈 Taxa de Sucesso: $PERCENTAGE%" >> "$LOG_FILE"

if [ $FAILED_TESTS -eq 0 ]; then
    echo -e "${GREEN}🎉 TODOS OS TESTES PASSARAM! 🎉${NC}"
    exit 0
else
    echo -e "${RED}⚠️  Alguns testes falharam. Verifique o log: $LOG_FILE${NC}"
    exit 1
fi
