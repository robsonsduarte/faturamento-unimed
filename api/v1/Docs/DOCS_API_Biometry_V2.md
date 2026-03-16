# 📋 DOCUMENTAÇÃO: API Biometria V2

**Data:** 11 de Dezembro de 2025  
**Versão API:** 1.0.0  
**Base URL:** https://consultoriopro.com.br/service/api/v1  
**Autenticação:** Header `X-API-Key`

---

## 🎯 VISÃO GERAL

A **API Biometria V2** é a evolução completa do sistema de validação biométrica facial, suportando:

- ✅ **Dois tipos de validação:** Pré-autorização e Validação para Cobrança
- ✅ **LGPD completo:** Consentimento com IP, timestamp, user-agent
- ✅ **Multitenant:** Isolamento por empresa
- ✅ **Reutilização de fotos:** Economia de tempo e melhor UX
- ✅ **Rastreabilidade:** Foreign Keys para appointments e executions
- ✅ **Expiração automática:** Sessões expiram em 2 dias

---

## 🔐 AUTENTICAÇÃO

Todas as requisições requerem o header:

```
X-API-Key: sua_api_key_aqui
```

E o parâmetro de query string:

```
?company={company_id}
```

**Exemplo:**
```bash
curl -H 'X-API-Key: e877ba1c...' \
  'https://consultoriopro.com.br/service/api/v1/biometry/v2/sessions?company=1'
```

---

## 📋 DIFERENÇAS V1 vs V2

| Aspecto | V1 (Legado) | V2 (Novo) |
|---------|-------------|-----------|
| **Estrutura** | Focada em Chatwoot | Estrutura completa |
| **validation_type** | ❌ Não existe | ✅ pre_authorization / billing_validation |
| **Multitenant** | ❌ Sem company/patient | ✅ company + patient obrigatórios |
| **LGPD** | ⚠️ Básico | ✅ Completo (5 campos) |
| **Relacionamentos** | ❌ Sem FKs | ✅ appointment_id / execution_id |
| **Reutilização** | ❌ Não suportado | ✅ allow_reuse + FK |
| **Expiração** | ❌ Manual | ✅ Automática (2 dias) |
| **Estatísticas** | ❌ Não existe | ✅ Taxa de sucesso |

**Recomendação:** Use V2 para novas integrações. V1 será descontinuado após migração completa.

---

## 🛣️ ENDPOINTS DISPONÍVEIS

### 1. Criar Sessão
```
POST /biometry/v2/sessions?company={id}
```

### 2. Registrar Consentimento LGPD
```
POST /biometry/v2/sessions/{id}/consent?company={id}
```

### 3. Atualizar Resultado de Validação
```
PUT /biometry/v2/sessions/{id}/validation?company={id}
```

### 4. Buscar Foto Reutilizável
```
GET /biometry/v2/sessions/reusable-photo?company={id}&patient={id}
```

### 5. Listar Sessões Pendentes
```
GET /biometry/v2/sessions/pending?company={id}&limit={n}
```

### 6. Buscar por Appointment
```
GET /biometry/v2/sessions/by-appointment/{appointment_id}?company={id}
```

### 7. Buscar por Execution
```
GET /biometry/v2/sessions/by-execution/{execution_id}?company={id}
```

### 8. Estatísticas
```
GET /biometry/v2/stats?company={id}&validation_type={type}
```

---

## 📖 DETALHAMENTO DOS ENDPOINTS

---

## 1️⃣ POST /biometry/v2/sessions

### Descrição
Cria uma nova sessão de validação biométrica com estrutura completa.

### Request

**Headers:**
```
X-API-Key: sua_api_key
Content-Type: application/json
```

**Query Params:**
```
company={company_id}  (obrigatório)
```

**Body (JSON):**
```json
{
  "company": 1,                          // Obrigatório: ID da empresa
  "patient": 123,                        // Obrigatório: ID do paciente
  "validation_type": "pre_authorization", // Obrigatório: pre_authorization ou billing_validation
  "guide_number": "2363981325",          // Opcional: Número da guia Unimed
  "patient_name": "João Silva",          // Opcional: Nome do paciente
  "professional_name": "Dr. Pedro",      // Opcional: Nome do profissional
  "appointment_date": "2025-12-15 10:00:00", // Opcional: Data/hora do atendimento
  "appointment_id": 194236,              // Opcional: ID do agendamento (para pre_authorization)
  "execution_id": 48955,                 // Opcional: ID da guia (para billing_validation)
  "operator_id": "chatwoot_123",         // Opcional: ID do operador
  "operator_name": "Recepcionista Maria", // Opcional: Nome do operador
  "chat_id": "394",                      // Opcional: ID da conversa Chatwoot
  "max_attempts": 3                      // Opcional: Máximo de tentativas (padrão: 3)
}
```

### Response

**Status:** `201 Created`

```json
{
  "success": true,
  "data": {
    "created": true,
    "session_id": 10,
    "token": "75e69b14e90e479c36c2a545768fc1cb",
    "validation_type": "pre_authorization",
    "biometry_link": "https://consultoriopro.com.br/biometria/?guia=2363981325&token=75e69b14e90e479c36c2a545768fc1cb",
    "expires_at": "2025-12-13 10:56:00"
  },
  "timestamp": "2025-12-11T10:56:00-03:00",
  "api_version": "1.0.0"
}
```

### Campos da Response

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `session_id` | integer | ID único da sessão criada |
| `token` | string | Token único para acesso à página de captura |
| `validation_type` | string | Tipo de validação criado |
| `biometry_link` | string | URL completa para o paciente acessar |
| `expires_at` | datetime | Data/hora de expiração (2 dias) |

### Regras de Negócio

1. ✅ `company` e `patient` são **obrigatórios**
2. ✅ `validation_type` deve ser `pre_authorization` ou `billing_validation`
3. ✅ Se `validation_type = pre_authorization` → `appointment_id` deve ser preenchido
4. ✅ Se `validation_type = billing_validation` → `execution_id` deve ser preenchido
5. ✅ `expires_at` é calculado automaticamente (NOW() + 2 dias)
6. ✅ `token` é gerado automaticamente (32 caracteres hex)
7. ✅ `biometry_link` é gerado se `guide_number` estiver presente

### Exemplo cURL

```bash
curl -X POST 'https://consultoriopro.com.br/service/api/v1/biometry/v2/sessions?company=1' \
-H 'X-API-Key: e877ba1c49319300be89bee57a9f11581c0b65c3326ddaf9121b414bafed5960' \
-H 'Content-Type: application/json' \
-d '{
  "company": 1,
  "patient": 123,
  "validation_type": "pre_authorization",
  "appointment_id": 194236,
  "guide_number": "2363981325",
  "patient_name": "João Silva",
  "professional_name": "Dr. Pedro",
  "appointment_date": "2025-12-15 10:00:00",
  "operator_name": "Recepcionista Maria"
}'
```

### Possíveis Erros

| Status | Código | Descrição |
|--------|--------|-----------|
| 400 | MISSING_PARAMS | `company` ou `patient` ausentes |
| 400 | INVALID_VALIDATION_TYPE | `validation_type` inválido |
| 401 | UNAUTHORIZED | API Key inválida ou ausente |
| 500 | INTERNAL_ERROR | Erro ao criar sessão no banco |

---

## 2️⃣ POST /biometry/v2/sessions/{id}/consent

### Descrição
Registra o consentimento LGPD do paciente para uso da imagem facial.

### Request

**Headers:**
```
X-API-Key: sua_api_key
Content-Type: application/json
```

**URL Params:**
```
{id} = session_id (obrigatório)
```

**Query Params:**
```
company={company_id}  (obrigatório)
```

**Body (JSON):**
```json
{
  "consent_text": "Autorizo a captura e uso da minha imagem facial para validação biométrica, conforme Lei 13.709/2018 (LGPD).",
  "ip": "179.106.174.254",               // Opcional: IP do paciente (auto-detectado se omitido)
  "user_agent": "Mozilla/5.0 ..."        // Opcional: User-Agent (auto-detectado se omitido)
}
```

### Response

**Status:** `200 OK`

```json
{
  "success": true,
  "data": {
    "consent_recorded": true,
    "session_id": 10,
    "timestamp": "2025-12-11 10:58:05"
  },
  "timestamp": "2025-12-11T10:58:05-03:00",
  "api_version": "1.0.0"
}
```

### Campos Salvos no Banco

| Campo | Fonte | Descrição |
|-------|-------|-----------|
| `consent_accepted` | 1 | Flag booleano |
| `consent_text` | Body | Texto integral do termo |
| `consent_ip` | Body ou $_SERVER['REMOTE_ADDR'] | IP do paciente |
| `consent_timestamp` | NOW() | Data/hora da aceitação |
| `consent_user_agent` | Body ou $_SERVER['HTTP_USER_AGENT'] | Navegador do paciente |

### Exemplo cURL

```bash
curl -X POST 'https://consultoriopro.com.br/service/api/v1/biometry/v2/sessions/10/consent?company=1' \
-H 'X-API-Key: e877ba1c49319300be89bee57a9f11581c0b65c3326ddaf9121b414bafed5960' \
-H 'Content-Type: application/json' \
-d '{
  "consent_text": "Autorizo a captura e uso da minha imagem facial para validação biométrica, conforme Lei 13.709/2018 (LGPD)."
}'
```

### Possíveis Erros

| Status | Código | Descrição |
|--------|--------|-----------|
| 400 | MISSING_PARAM | `consent_text` ausente |
| 404 | SESSION_NOT_FOUND | Sessão não existe |
| 500 | UPDATE_FAILED | Erro ao atualizar banco |

---

## 3️⃣ PUT /biometry/v2/sessions/{id}/validation

### Descrição
Atualiza o resultado da validação biométrica (approved, rejected ou error).

### Request

**Headers:**
```
X-API-Key: sua_api_key
Content-Type: application/json
```

**URL Params:**
```
{id} = session_id (obrigatório)
```

**Query Params:**
```
company={company_id}  (obrigatório)
```

**Body (JSON):**
```json
{
  "validation_result": "approved",       // Obrigatório: approved, rejected ou error
  "validation_message": "Biometria validada com sucesso. Face reconhecida com 98% de confiança."  // Opcional
}
```

### Response

**Status:** `200 OK`

```json
{
  "success": true,
  "data": {
    "validation_updated": true,
    "session_id": 10,
    "validation_result": "approved",
    "status": "completed"
  },
  "timestamp": "2025-12-11T10:59:46-03:00",
  "api_version": "1.0.0"
}
```

### Regras de Status Automático

| validation_result | status resultante |
|-------------------|-------------------|
| `approved` | `completed` |
| `rejected` | `failed` |
| `error` | `failed` |

### Campos Atualizados

| Campo | Valor |
|-------|-------|
| `validation_result` | approved / rejected / error |
| `validation_message` | Mensagem fornecida |
| `validated_at` | NOW() |
| `status` | completed ou failed |
| `completed_at` | NOW() |

### Exemplo cURL

```bash
curl -X PUT 'https://consultoriopro.com.br/service/api/v1/biometry/v2/sessions/10/validation?company=1' \
-H 'X-API-Key: e877ba1c49319300be89bee57a9f11581c0b65c3326ddaf9121b414bafed5960' \
-H 'Content-Type: application/json' \
-d '{
  "validation_result": "approved",
  "validation_message": "Biometria validada com sucesso. Face reconhecida com 98% de confiança."
}'
```

### Possíveis Erros

| Status | Código | Descrição |
|--------|--------|-----------|
| 400 | MISSING_PARAM | `validation_result` ausente |
| 400 | INVALID_RESULT | Resultado não é approved/rejected/error |
| 404 | SESSION_NOT_FOUND | Sessão não existe |
| 500 | UPDATE_FAILED | Erro ao atualizar banco |

---

## 4️⃣ GET /biometry/v2/sessions/reusable-photo

### Descrição
Busca foto reutilizável de sessão anterior do paciente (economia de tempo + melhor UX).

### Request

**Headers:**
```
X-API-Key: sua_api_key
```

**Query Params:**
```
company={company_id}  (obrigatório)
patient={patient_id}  (obrigatório)
max_days={n}          (opcional, padrão: 30)
```

### Response

**Status:** `200 OK` (se encontrar foto)

```json
{
  "success": true,
  "data": {
    "reusable": true,
    "session_id": 6,
    "photo_path": "/biometria/uploads/biometry/guia_2363981325_176539...",
    "photo_captured_at": "2025-12-10 11:09:06",
    "validated_at": "2025-12-10 11:09:06",
    "validation_type": "pre_authorization"
  },
  "timestamp": "2025-12-11T11:15:00-03:00",
  "api_version": "1.0.0"
}
```

**Status:** `404 Not Found` (se não encontrar)

```json
{
  "success": false,
  "error": {
    "code": "PHOTO_NOT_FOUND",
    "message": "Nenhuma foto reutilizável encontrada"
  },
  "timestamp": "2025-12-11T11:15:00-03:00",
  "api_version": "1.0.0"
}
```

### Critérios de Busca (SQL)

```sql
WHERE patient = {patient_id}
  AND company = {company_id}
  AND validation_result = 'approved'
  AND allow_reuse = 1
  AND photo_path IS NOT NULL
  AND photo_captured_at > DATE_SUB(NOW(), INTERVAL {max_days} DAY)
ORDER BY validated_at DESC
LIMIT 1
```

### Exemplo cURL

```bash
curl -X GET 'https://consultoriopro.com.br/service/api/v1/biometry/v2/sessions/reusable-photo?company=1&patient=123&max_days=30' \
-H 'X-API-Key: e877ba1c49319300be89bee57a9f11581c0b65c3326ddaf9121b414bafed5960'
```

### Possíveis Erros

| Status | Código | Descrição |
|--------|--------|-----------|
| 400 | MISSING_PARAM | `patient` ausente |
| 404 | PHOTO_NOT_FOUND | Nenhuma foto válida encontrada |

---

## 5️⃣ GET /biometry/v2/sessions/pending

### Descrição
Lista sessões pendentes (não finalizadas) de uma empresa.

### Request

**Headers:**
```
X-API-Key: sua_api_key
```

**Query Params:**
```
company={company_id}  (obrigatório)
limit={n}             (opcional, padrão: 50, máx: 100)
```

### Response

**Status:** `200 OK`

```json
{
  "success": true,
  "data": {
    "sessions": [
      {
        "id": "4",
        "company": "1",
        "patient": null,
        "chat_id": "394",
        "guide_number": "2362995559",
        "patient_name": "TALIRA ARAUJO SOARES",
        "validation_type": null,
        "status": "link_sent",
        "created_at": "2025-12-09 16:58:18",
        "expires_at": null
      },
      {
        "id": "7",
        "company": "1",
        "patient": "1",
        "guide_number": "TEST123456",
        "validation_type": "pre_authorization",
        "status": "started",
        "created_at": "2025-12-11 10:52:37",
        "expires_at": "2025-12-13 10:52:37"
      }
    ],
    "total": 5,
    "company": 1
  },
  "timestamp": "2025-12-11T11:09:16-03:00",
  "api_version": "1.0.0"
}
```

### Status Considerados Pendentes

- `started`
- `link_sent`
- `waiting_photo`
- `photo_received`

### Exemplo cURL

```bash
curl -X GET 'https://consultoriopro.com.br/service/api/v1/biometry/v2/sessions/pending?company=1&limit=20' \
-H 'X-API-Key: e877ba1c49319300be89bee57a9f11581c0b65c3326ddaf9121b414bafed5960'
```

---

## 6️⃣ GET /biometry/v2/sessions/by-appointment/{appointment_id}

### Descrição
Busca sessão vinculada a um agendamento específico.

### Request

**Headers:**
```
X-API-Key: sua_api_key
```

**URL Params:**
```
{appointment_id} = ID do agendamento (obrigatório)
```

**Query Params:**
```
company={company_id}  (obrigatório)
```

### Response

**Status:** `200 OK`

```json
{
  "success": true,
  "data": {
    "session": {
      "id": "10",
      "company": "1",
      "patient": "1",
      "validation_type": "pre_authorization",
      "appointment_id": "194236",
      "guide_number": "TEST123456",
      "status": "completed",
      "validation_result": "approved",
      "consent_accepted": "1",
      "photo_path": "/biometria/uploads/...",
      "created_at": "2025-12-11 10:56:00",
      "validated_at": "2025-12-11 10:59:46"
    }
  },
  "timestamp": "2025-12-11T11:08:23-03:00",
  "api_version": "1.0.0"
}
```

### Exemplo cURL

```bash
curl -X GET 'https://consultoriopro.com.br/service/api/v1/biometry/v2/sessions/by-appointment/194236?company=1' \
-H 'X-API-Key: e877ba1c49319300be89bee57a9f11581c0b65c3326ddaf9121b414bafed5960'
```

### Possíveis Erros

| Status | Código | Descrição |
|--------|--------|-----------|
| 400 | MISSING_PARAM | `appointment_id` ausente |
| 404 | SESSION_NOT_FOUND | Sessão não encontrada |

---

## 7️⃣ GET /biometry/v2/sessions/by-execution/{execution_id}

### Descrição
Busca sessão vinculada a uma guia de execução específica (para cobrança).

### Request

**Headers:**
```
X-API-Key: sua_api_key
```

**URL Params:**
```
{execution_id} = ID da guia (obrigatório)
```

**Query Params:**
```
company={company_id}  (obrigatório)
```

### Response

**Status:** `200 OK`

```json
{
  "success": true,
  "data": {
    "session": {
      "id": "15",
      "company": "1",
      "patient": "123",
      "validation_type": "billing_validation",
      "execution_id": "48955",
      "guide_number": "2363981325",
      "status": "completed",
      "validation_result": "approved",
      "reused_from_session_id": "10",
      "created_at": "2025-12-11 14:30:00",
      "validated_at": "2025-12-11 14:32:00"
    }
  },
  "timestamp": "2025-12-11T14:35:00-03:00",
  "api_version": "1.0.0"
}
```

### Exemplo cURL

```bash
curl -X GET 'https://consultoriopro.com.br/service/api/v1/biometry/v2/sessions/by-execution/48955?company=1' \
-H 'X-API-Key: e877ba1c49319300be89bee57a9f11581c0b65c3326ddaf9121b414bafed5960'
```

---

## 8️⃣ GET /biometry/v2/stats

### Descrição
Retorna estatísticas de taxa de sucesso das validações biométricas.

### Request

**Headers:**
```
X-API-Key: sua_api_key
```

**Query Params:**
```
company={company_id}      (obrigatório)
validation_type={type}    (opcional: pre_authorization ou billing_validation)
```

### Response

**Status:** `200 OK`

```json
{
  "success": true,
  "data": {
    "statistics": [
      {
        "validation_type": "pre_authorization",
        "total": "45",
        "approved": "42",
        "rejected": "2",
        "errors": "1",
        "success_rate": "93.33"
      },
      {
        "validation_type": "billing_validation",
        "total": "120",
        "approved": "118",
        "rejected": "1",
        "errors": "1",
        "success_rate": "98.33"
      }
    ],
    "company": 1,
    "validation_type": null
  },
  "timestamp": "2025-12-11T11:09:44-03:00",
  "api_version": "1.0.0"
}
```

### Exemplo cURL

**Todas as validações:**
```bash
curl -X GET 'https://consultoriopro.com.br/service/api/v1/biometry/v2/stats?company=1' \
-H 'X-API-Key: e877ba1c49319300be89bee57a9f11581c0b65c3326ddaf9121b414bafed5960'
```

**Apenas pré-autorizações:**
```bash
curl -X GET 'https://consultoriopro.com.br/service/api/v1/biometry/v2/stats?company=1&validation_type=pre_authorization' \
-H 'X-API-Key: e877ba1c49319300be89bee57a9f11581c0b65c3326ddaf9121b414bafed5960'
```

---

## 🎯 CASOS DE USO

---

### CASO 1: Fluxo Completo de Pré-Autorização

**Cenário:** Paciente agendou consulta. Clínica precisa validar biometria antes de solicitar autorização da guia na operadora.

#### Passo 1: Criar Sessão

```bash
curl -X POST 'https://consultoriopro.com.br/service/api/v1/biometry/v2/sessions?company=1' \
-H 'X-API-Key: ...' \
-H 'Content-Type: application/json' \
-d '{
  "company": 1,
  "patient": 2875,
  "validation_type": "pre_authorization",
  "appointment_id": 194236,
  "guide_number": "2363981325",
  "patient_name": "João Silva",
  "professional_name": "Dr. Pedro Cardiologista",
  "appointment_date": "2025-12-15 10:00:00"
}'
```

**Response:**
```json
{
  "session_id": 25,
  "token": "abc123...",
  "biometry_link": "https://consultoriopro.com.br/biometria/?guia=2363981325&token=abc123...",
  "expires_at": "2025-12-13 10:00:00"
}
```

#### Passo 2: Enviar Link para Paciente

```
Via WhatsApp/SMS:
"Olá João! Para sua consulta com Dr. Pedro no dia 15/12 às 10h, 
precisamos validar sua identidade. Acesse: 
https://consultoriopro.com.br/biometria/?guia=2363981325&token=abc123..."
```

#### Passo 3: Paciente Aceita Termo LGPD

```bash
curl -X POST 'https://consultoriopro.com.br/service/api/v1/biometry/v2/sessions/25/consent?company=1' \
-H 'X-API-Key: ...' \
-H 'Content-Type: application/json' \
-d '{
  "consent_text": "Autorizo a captura e uso da minha imagem facial..."
}'
```

#### Passo 4: Paciente Tira Foto

(Interface web captura foto e faz upload via endpoint próprio)

#### Passo 5: Sistema Valida no TRIX/SAW

(Workflow n8n Tools 1, 2, 3 processam validação)

#### Passo 6: Registrar Resultado

```bash
curl -X PUT 'https://consultoriopro.com.br/service/api/v1/biometry/v2/sessions/25/validation?company=1' \
-H 'X-API-Key: ...' \
-H 'Content-Type: application/json' \
-d '{
  "validation_result": "approved",
  "validation_message": "Face reconhecida com 97% de confiança"
}'
```

#### Resultado Final:
✅ Sessão com `status = completed`  
✅ `validation_result = approved`  
✅ Vinculada ao `appointment_id = 194236`  
✅ Pronta para autorização da guia

---

### CASO 2: Validação para Cobrança (com Reutilização)

**Cenário:** Atendimento já foi realizado. Sistema precisa validar presença do paciente antes de incluir guia no lote TISS.

#### Passo 1: Verificar se Existe Foto Reutilizável

```bash
curl -X GET 'https://consultoriopro.com.br/service/api/v1/biometry/v2/sessions/reusable-photo?company=1&patient=2875&max_days=30' \
-H 'X-API-Key: ...'
```

**Se encontrar:**
```json
{
  "reusable": true,
  "session_id": 25,
  "photo_path": "/biometria/uploads/...",
  "photo_captured_at": "2025-12-10 11:00:00",
  "validation_type": "pre_authorization"
}
```

#### Passo 2: Criar Sessão de Cobrança Reutilizando Foto

```bash
curl -X POST 'https://consultoriopro.com.br/service/api/v1/biometry/v2/sessions?company=1' \
-H 'X-API-Key: ...' \
-H 'Content-Type: application/json' \
-d '{
  "company": 1,
  "patient": 2875,
  "validation_type": "billing_validation",
  "execution_id": 48955,
  "guide_number": "2363981325",
  "allow_reuse": 1,
  "reused_from_session_id": 25,
  "photo_path": "/biometria/uploads/..."
}'
```

#### Passo 3: Validar Diretamente no SAW

(Workflow n8n reutiliza foto sem solicitar nova captura)

#### Passo 4: Registrar Resultado

```bash
curl -X PUT 'https://consultoriopro.com.br/service/api/v1/biometry/v2/sessions/30/validation?company=1' \
-H 'X-API-Key: ...' \
-H 'Content-Type: application/json' \
-d '{
  "validation_result": "approved"
}'
```

#### Resultado Final:
✅ Sessão com `validation_type = billing_validation`  
✅ Vinculada ao `execution_id = 48955`  
✅ Foto reutilizada (economia de tempo)  
✅ Pronta para incluir no lote XML TISS

---

## 🔄 GUIA DE MIGRAÇÃO V1 → V2

### Mapeamento de Endpoints

| V1 (Legado) | V2 (Novo) | Observações |
|-------------|-----------|-------------|
| `POST /biometry/session` | `POST /biometry/v2/sessions` | Adicionar `company`, `patient`, `validation_type` |
| `GET /biometry/session/{guide}` | `GET /biometry/v2/sessions/by-appointment/{id}` | Mudar de guide_number para appointment_id |
| `PUT /biometry/session/{guide}` | `PUT /biometry/v2/sessions/{id}/validation` | Separar consentimento de validação |
| ❌ Não existe | `POST /biometry/v2/sessions/{id}/consent` | **NOVO:** Endpoint específico LGPD |
| ❌ Não existe | `GET /biometry/v2/sessions/reusable-photo` | **NOVO:** Reutilização de fotos |
| ❌ Não existe | `GET /biometry/v2/stats` | **NOVO:** Estatísticas |

### Checklist de Migração

- [ ] Atualizar workflows n8n para usar endpoints V2
- [ ] Migrar dados de `app_executions.biometry_*` para `app_biometry_sessions`
- [ ] Atualizar interface de captura para chamar endpoint de consentimento
- [ ] Implementar lógica de reutilização de fotos
- [ ] Configurar cronjob para marcar sessões expiradas
- [ ] Testar fluxos de pré-autorização e cobrança
- [ ] Treinar equipe nos novos endpoints
- [ ] Remover campos obsoletos de `app_executions` após testes

---

## ⚠️ OBSERVAÇÕES IMPORTANTES

### Expiração de Sessões

Sessões expiram automaticamente após **2 dias** (`expires_at`). Um cronjob deve rodar periodicamente para marcar sessões expiradas:

```bash
# Executar a cada hora
0 * * * * curl -X POST 'https://consultoriopro.com.br/service/api/v1/biometry/v2/sessions/expire' -H 'X-API-Key: ...'
```

Ou diretamente no banco:

```sql
UPDATE app_biometry_sessions 
SET status = 'timeout'
WHERE expires_at < NOW()
  AND status NOT IN ('completed', 'failed', 'cancelled', 'timeout');
```

### Reutilização de Fotos

Para permitir reutilização, o paciente deve:
1. ✅ Ter sessão anterior com `validation_result = approved`
2. ✅ Ter marcado `allow_reuse = 1` na sessão original
3. ✅ Foto capturada há menos de 30 dias (configurável)

### Foreign Keys e Integridade

Todas as sessões devem ter:
- ✅ `company` válido (FK para `app_company`)
- ✅ `patient` válido (FK para `app_patient`)
- ✅ `appointment_id` válido se `validation_type = pre_authorization`
- ✅ `execution_id` válido se `validation_type = billing_validation`

Tentativas de criar sessão com IDs inválidos resultarão em erro 500.

### Compliance LGPD

Todos os campos de consentimento devem ser preenchidos:
- `consent_accepted = 1`
- `consent_text` = Texto integral do termo
- `consent_ip` = IP do paciente
- `consent_timestamp` = Data/hora da aceitação
- `consent_user_agent` = Navegador do paciente

**Sem consentimento = sessão inválida para produção.**

---

## 📊 CÓDIGOS DE STATUS

### HTTP Status Codes

| Status | Significado | Quando Usar |
|--------|-------------|-------------|
| `200 OK` | Sucesso | GET, PUT com sucesso |
| `201 Created` | Recurso criado | POST com sucesso |
| `400 Bad Request` | Parâmetros inválidos | Validação falhou |
| `401 Unauthorized` | Sem autenticação | API Key inválida |
| `404 Not Found` | Recurso não encontrado | Sessão não existe |
| `500 Internal Error` | Erro do servidor | Problema no banco/código |

### Session Status (campo `status`)

| Status | Significado | Próximo Passo |
|--------|-------------|---------------|
| `started` | Sessão criada | Enviar link ao paciente |
| `link_sent` | Link enviado | Aguardar acesso |
| `waiting_photo` | Aguardando foto | Paciente deve capturar |
| `photo_received` | Foto capturada | Validar no TRIX |
| `analyzing_photo` | IA processando | Aguardar resultado |
| `photo_invalid` | Foto rejeitada | Solicitar nova tentativa |
| `executing_saw` | Validando no SAW | Aguardar confirmação |
| `completed` | Validação concluída | Prosseguir com processo |
| `failed` | Validação falhou | Revisar erro |
| `timeout` | Sessão expirou | Criar nova sessão |
| `cancelled` | Cancelada manualmente | N/A |

### Validation Result (campo `validation_result`)

| Resultado | Significado |
|-----------|-------------|
| `approved` | Biometria aprovada |
| `rejected` | Biometria rejeitada |
| `error` | Erro técnico na validação |
| `NULL` | Ainda não validado |

---

## 🧪 TESTANDO A API

### Ambiente de Testes

**Base URL:** `https://consultoriopro.com.br/service/api/v1`  
**API Key de Teste:** (solicitar ao administrador)  
**Company de Teste:** 1

### Sequência de Testes Recomendada

1. ✅ Criar sessão pré-autorização
2. ✅ Registrar consentimento
3. ✅ Atualizar validação (approved)
4. ✅ Buscar por appointment_id
5. ✅ Verificar foto reutilizável
6. ✅ Criar sessão cobrança reutilizando
7. ✅ Listar pendentes
8. ✅ Ver estatísticas

### Postman Collection

(Em desenvolvimento - solicitar ao time de desenvolvimento)

---

## 🐛 TROUBLESHOOTING

### Erro: "Cannot add or update a child row: foreign key constraint fails"

**Causa:** Tentando usar `appointment_id` ou `execution_id` que não existe no banco.

**Solução:**
```bash
# Verificar se ID existe
mysql -e "SELECT id FROM app_appointment WHERE id = 194236;"
```

### Erro: "API Key inválida"

**Causa:** Header `X-API-Key` ausente ou incorreto.

**Solução:**
```bash
# Verificar API Keys ativas
mysql -e "SELECT company, api_key, name FROM app_api_keys WHERE status = 'active';"
```

### Sessões não expiram automaticamente

**Causa:** Cronjob não configurado.

**Solução:**
```bash
# Adicionar ao crontab
0 * * * * mysql -e "UPDATE app_biometry_sessions SET status='timeout' WHERE expires_at < NOW() AND status NOT IN ('completed','failed','timeout','cancelled');"
```

### Foto reutilizável não encontrada

**Causa:** Sessão anterior não tem `allow_reuse = 1` ou é muito antiga.

**Solução:**
- Verificar se sessão anterior tem `validation_result = approved`
- Ajustar parâmetro `max_days` na busca
- Garantir que foto existe no caminho especificado

---

## 📞 SUPORTE

**Documentação Técnica:** Este arquivo  
**Issues/Bugs:** GitHub (em desenvolvimento)  
**Contato:** Robson Duarte  
**Última Atualização:** 11/12/2025

---

## ✅ CHECKLIST DE IMPLEMENTAÇÃO

### Para Desenvolvedores

- [x] BiometrySession Model criado
- [x] BiometryController com 8 métodos V2
- [x] Routes configuradas
- [x] Endpoints testados via cURL
- [ ] Postman Collection criada
- [ ] Testes unitários implementados
- [ ] Documentação de código (PHPDoc)
- [ ] Logs estruturados adicionados

### Para DevOps

- [ ] Cronjob de expiração configurado
- [ ] Monitoramento de taxa de sucesso
- [ ] Alertas para erros 500
- [ ] Backup automático da tabela
- [ ] Rate limiting configurado

### Para Workflows n8n

- [ ] Tool 1 adaptado para V2
- [ ] Tool 2 adaptado para V2
- [ ] Tool 3 adaptado para V2
- [ ] Reutilização de fotos implementada
- [ ] Notificações de erro configuradas

### Para Frontend

- [ ] Interface de captura atualizada
- [ ] Endpoint de consentimento integrado
- [ ] Feedback visual de status
- [ ] Tratamento de erros amigável
- [ ] Testes de usabilidade

---

**Documentação Criada:** 11/12/2025  
**Versão:** 1.0.0  
**Status:** ✅ Completa e Testada  
**Próxima Revisão:** Após FASE 4 (Workflows n8n)
