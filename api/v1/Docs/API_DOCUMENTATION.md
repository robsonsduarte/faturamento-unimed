# 📚 ConsultorioPro REST API - Documentação Completa

## 🔗 Base URL
```
https://consultoriopro.com.br/service/api/v1
```

## 🔑 Autenticação

Todas as requisições (exceto `/health` e `/`) requerem autenticação via API Key no header:
```
X-API-Key: e877ba1c49319300be89bee57a9f11581c0b65c3326ddaf9121b414bafed5960
```

---

## 📋 Índice de Endpoints

- [Health Check](#health-check)
- [Schedules (Horários)](#schedules-horários)
- [Professionals (Profissionais)](#professionals-profissionais)
- [Sync (Sincronização Google)](#sync-sincronização-google-calendar)
- [**Appointments (Agendamentos)**](#appointments-agendamentos) ⭐ **NOVO**
- [**Patients (Pacientes)**](#patients-pacientes) ⭐ **NOVO**
- [Códigos de Erro](#códigos-de-erro)

---

## 🏥 Health Check

### 1️⃣ **Verificar Status da API**

```http
GET /health
```

**Resposta:**
```json
{
  "success": true,
  "data": {
    "status": "healthy",
    "version": "1.0.0",
    "timestamp": "2025-11-15T09:47:57-03:00",
    "new_features": {
      "appointments_api": "enabled",
      "patients_api": "enabled"
    }
  }
}
```

---

## 📅 Schedules (Horários)

### 2️⃣ **Listar Horários por Empresa**

```http
GET /schedules/{company_id}
```

**Exemplo:**
```bash
curl -H "X-API-Key: sua_key" \
  https://consultoriopro.com.br/service/api/v1/schedules/1
```

### 3️⃣ **Horários de um Profissional**

```http
GET /schedules/{company_id}/{user_id}
```

### 4️⃣ **Verificar Disponibilidade**

```http
GET /schedules/{company_id}/availability/{user_id}?date=2025-11-20
```

---

## 👨‍⚕️ Professionals (Profissionais)

### 5️⃣ **Listar Profissionais**

```http
GET /professionals/{company_id}
```

### 6️⃣ **Detalhes de um Profissional**

```http
GET /professionals/{company_id}/{user_id}
```

### 7️⃣ **Listar Ocupações**

```http
GET /professionals/{company_id}/occupations
```

---

## 🔄 Sync (Sincronização Google Calendar)

### 8️⃣ **Criar/Atualizar Sincronização**

```http
POST /sync/google-calendar
```

### 9️⃣ **Listar Sincronizações**

```http
GET /sync/google-calendar/{company_id}
```

### 🔟 **Ativar/Desativar Sincronização**

```http
PUT /sync/google-calendar/{company_id}/{user_id}/toggle
```

### 1️⃣1️⃣ **Remover Sincronização**

```http
DELETE /sync/google-calendar/{company_id}/{user_id}
```

---

# ⭐ APPOINTMENTS (Agendamentos) - NOVO

## 1️⃣2️⃣ **Criar Agendamento**

**Cria um novo agendamento no sistema**

```http
POST /appointments
```

**Headers:**
```
X-API-Key: sua_api_key
Content-Type: application/json
```

**Body (JSON):**
```json
{
  "company": 1,
  "user": 93,
  "patient": 456,
  "day": "2025-11-20 14:00:00",
  "period": 1,
  "project": "no",
  "payment": "credit_card",
  "agreement": 30,
  "value": 150.00,
  "confirmed": "yes",
  "status": "scheduled",
  "online": "no",
  "observation": "Primeira consulta",
  "type": 2,
  "author": 108
}
```

**Campos Obrigatórios:**
- `company`: ID da empresa
- `user`: ID do profissional
- `patient`: ID do paciente
- `day`: Data/hora no formato YYYY-MM-DD HH:MM:SS

**Campos Opcionais:**
- `period`: Período (1=manhã, 2=tarde, 3=noite)
- `project`: "yes" ou "no"
- `payment`: Forma de pagamento
- `agreement`: ID do convênio
- `value`: Valor da consulta
- `confirmed`: "yes" ou "no"
- `status`: scheduled, confirmed, completed
- `online`: "yes" ou "no"
- `observation`: Observações
- `type`: Tipo de consulta
- `author`: ID do autor do agendamento

**Exemplo:**
```bash
curl -X POST \
  -H "X-API-Key: sua_key" \
  -H "Content-Type: application/json" \
  -d '{
    "company": 1,
    "user": 93,
    "patient": 456,
    "day": "2025-11-20 14:00:00",
    "confirmed": "yes"
  }' \
  https://consultoriopro.com.br/service/api/v1/appointments
```

**Resposta (Sucesso - 201):**
```json
{
  "success": true,
  "data": {
    "appointment": {
      "id": "94309",
      "company": "1",
      "user": "93",
      "patient": "456",
      "day": "2025-11-20 14:00:00",
      "confirmed": "yes",
      "status": "scheduled",
      "calendar_id": "abc123@group.calendar.google.com",
      "professional_first_name": "João",
      "professional_last_name": "Silva",
      "professional_email": "joao@email.com",
      "patient_first_name": "Maria",
      "patient_last_name": "Santos",
      "patient_mobile": "+5573999887766",
      "patient_email": "maria@email.com",
      "google_calendar_id": "abc123@group.calendar.google.com",
      "created_at": "2025-11-15 19:40:00"
    },
    "message": "Appointment created successfully"
  },
  "timestamp": "2025-11-15T19:40:00-03:00",
  "api_version": "1.0.0"
}
```

**Erros Possíveis:**

```json
// Horário já ocupado (409)
{
  "success": false,
  "error": "Time slot already booked",
  "timestamp": "2025-11-15T19:40:00-03:00"
}

// Campos obrigatórios faltando (400)
{
  "success": false,
  "error": {
    "company": "O campo company é obrigatório",
    "user": "O campo user é obrigatório"
  }
}
```

---

## 1️⃣3️⃣ **Listar Agendamentos**

**Lista agendamentos com filtros opcionais**

```http
GET /appointments?company={company_id}&[filtros]
```

**Query Parameters:**

**Obrigatório:**
- `company`: ID da empresa

**Opcionais:**
- `user`: Filtrar por profissional
- `patient`: Filtrar por paciente
- `date`: Filtrar por data (YYYY-MM-DD)
- `status`: Filtrar por status (scheduled, confirmed, completed, canceled)
- `confirmed`: Filtrar por confirmação (yes, no)
- `limit`: Número de resultados (padrão: 50, máx: 100)
- `offset`: Paginação (padrão: 0)

**Exemplos:**

```bash
# Listar todos os agendamentos da empresa
curl -H "X-API-Key: sua_key" \
  "https://consultoriopro.com.br/service/api/v1/appointments?company=1&limit=10"

# Agendamentos de um profissional em uma data
curl -H "X-API-Key: sua_key" \
  "https://consultoriopro.com.br/service/api/v1/appointments?company=1&user=93&date=2025-11-20"

# Agendamentos confirmados de um paciente
curl -H "X-API-Key: sua_key" \
  "https://consultoriopro.com.br/service/api/v1/appointments?company=1&patient=456&confirmed=yes"
```

**Resposta (200):**
```json
{
  "success": true,
  "data": {
    "appointments": [
      {
        "id": "94308",
        "company": "1",
        "user": "76",
        "patient": "1791",
        "day": "2025-11-20 15:30:00",
        "period": "1",
        "confirmed": "yes",
        "status": "scheduled",
        "online": "no",
        "observation": "Consulta de retorno",
        "professional_first_name": "Carolina",
        "professional_last_name": "Loureiro",
        "patient_first_name": "JACIARA",
        "patient_last_name": "VIANA FERREIRA",
        "patient_mobile": "+5573988661308",
        "created_at": "2025-11-15 09:29:05"
      }
    ],
    "total": 59626,
    "limit": 50,
    "offset": 0,
    "filters": {
      "user": "93",
      "date": "2025-11-20"
    }
  },
  "timestamp": "2025-11-15T19:33:10-03:00",
  "api_version": "1.0.0"
}
```

---

## 1️⃣4️⃣ **Buscar Agendamento Específico**

**Retorna detalhes completos de um agendamento**

```http
GET /appointments/{id}?company={company_id}
```

**Exemplo:**
```bash
curl -H "X-API-Key: sua_key" \
  "https://consultoriopro.com.br/service/api/v1/appointments/94308?company=1"
```

**Resposta (200):**
```json
{
  "success": true,
  "data": {
    "appointment": {
      "id": "94308",
      "company": "1",
      "user": "76",
      "patient": "1791",
      "day": "2025-11-20 15:30:00",
      "confirmed": "yes",
      "status": "scheduled",
      "professional_first_name": "Carolina",
      "professional_last_name": "Loureiro",
      "professional_email": "carolina@email.com",
      "patient_first_name": "JACIARA",
      "patient_last_name": "VIANA FERREIRA",
      "patient_mobile": "+5573988661308",
      "patient_email": "jaciara@email.com",
      "google_calendar_id": "xyz789@group.calendar.google.com",
      "calendar_event": "event_id_123"
    }
  }
}
```

**Erros:**
```json
// Não encontrado (404)
{
  "success": false,
  "error": "Appointment not found"
}

// Sem permissão (403)
{
  "success": false,
  "error": "Unauthorized access"
}
```

---

## 1️⃣5️⃣ **Atualizar Agendamento**

**Atualiza dados de um agendamento existente**

```http
PUT /appointments/{id}
```

**Body (JSON):**
```json
{
  "company": 1,
  "day": "2025-11-20 16:00:00",
  "confirmed": "yes",
  "observation": "Horário alterado pelo paciente",
  "status": "confirmed"
}
```

**Campos Atualizáveis:**
- `day`: Nova data/hora
- `confirmed`: yes/no
- `status`: scheduled, confirmed, completed
- `observation`: Novas observações
- `value`: Novo valor
- Qualquer campo exceto: `id`, `company`, `created_at`

**Exemplo:**
```bash
curl -X PUT \
  -H "X-API-Key: sua_key" \
  -H "Content-Type: application/json" \
  -d '{
    "company": 1,
    "confirmed": "yes",
    "observation": "Paciente confirmou por WhatsApp"
  }' \
  https://consultoriopro.com.br/service/api/v1/appointments/94308
```

**Resposta (200):**
```json
{
  "success": true,
  "data": {
    "appointment": {
      "id": "94308",
      "confirmed": "yes",
      "observation": "Paciente confirmou por WhatsApp",
      "updated_at": "2025-11-15 19:45:00"
    },
    "message": "Appointment updated successfully"
  }
}
```

**Erros:**
```json
// Novo horário já ocupado (409)
{
  "success": false,
  "error": "New time slot already booked"
}
```

---

## 1️⃣6️⃣ **Cancelar Agendamento**

**Cancela um agendamento (soft delete)**

```http
DELETE /appointments/{id}?company={company_id}
```

**Body (JSON - Opcional):**
```json
{
  "reason": "Paciente cancelou por motivo pessoal"
}
```

**Exemplo:**
```bash
curl -X DELETE \
  -H "X-API-Key: sua_key" \
  -H "Content-Type: application/json" \
  -d '{"reason": "Paciente cancelou"}' \
  "https://consultoriopro.com.br/service/api/v1/appointments/94308?company=1"
```

**Resposta (200):**
```json
{
  "success": true,
  "data": {
    "message": "Appointment canceled successfully",
    "appointment_id": "94308"
  }
}
```

**Nota:** O agendamento não é deletado do banco, apenas marcado como:
- `canceled`: "yes"
- `status`: "canceled"
- `observation`: Razão do cancelamento

---

## 1️⃣7️⃣ **Verificar Disponibilidade de Horário**

**Verifica se um horário está disponível para agendamento**

```http
GET /appointments/check-availability?user={user_id}&day={datetime}
```

**Query Parameters:**
- `user`: ID do profissional (obrigatório)
- `day`: Data/hora no formato YYYY-MM-DD HH:MM:SS (obrigatório)

**Exemplo:**
```bash
curl -H "X-API-Key: sua_key" \
  "https://consultoriopro.com.br/service/api/v1/appointments/check-availability?user=76&day=2025-11-20%2014:00:00"
```

**Resposta (Disponível):**
```json
{
  "success": true,
  "data": {
    "available": true,
    "user": "76",
    "day": "2025-11-20 14:00:00"
  }
}
```

**Resposta (Ocupado):**
```json
{
  "success": true,
  "data": {
    "available": false,
    "user": "76",
    "day": "2025-11-20 14:00:00"
  }
}
```

---

## 1️⃣8️⃣ **Buscar por Evento Google**

**Busca agendamento pelo ID do evento do Google Calendar**

```http
GET /appointments/by-google-event/{google_event_id}?company={company_id}
```

**Exemplo:**
```bash
curl -H "X-API-Key: sua_key" \
  "https://consultoriopro.com.br/service/api/v1/appointments/by-google-event/event_123abc?company=1"
```

**Resposta (200):**
```json
{
  "success": true,
  "data": {
    "appointment": {
      "id": "94308",
      "calendar_event": "event_123abc",
      "day": "2025-11-20 14:00:00",
      ...
    }
  }
}
```

---

# 👥 PATIENTS (Pacientes) - NOVO

## 1️⃣9️⃣ **Buscar ou Criar Paciente**

**Busca paciente por telefone, se não existir cria um novo**

```http
POST /patients/find-or-create
```

**Body (JSON):**
```json
{
  "company": 1,
  "mobile": "+5573999887766",
  "first_name": "João",
  "last_name": "Silva",
  "email": "joao@email.com",
  "genre": "m",
  "born_at": "1990-05-15",
  "document": "12345678900",
  "agreement": "30"
}
```

**Campos Obrigatórios:**
- `company`: ID da empresa
- `mobile`: Telefone (com +55)

**Campos Opcionais:**
- `first_name`: Nome
- `last_name`: Sobrenome
- `email`: Email
- `genre`: m/f
- `born_at`: Data nascimento (YYYY-MM-DD)
- `document`: CPF
- `agreement`: ID do convênio

**Exemplo:**
```bash
curl -X POST \
  -H "X-API-Key: sua_key" \
  -H "Content-Type: application/json" \
  -d '{
    "company": 1,
    "mobile": "+5573999887766",
    "first_name": "João"
  }' \
  https://consultoriopro.com.br/service/api/v1/patients/find-or-create
```

**Resposta (Paciente Encontrado - 200):**
```json
{
  "success": true,
  "data": {
    "patient": {
      "id": "3713",
      "company": "1",
      "first_name": "João",
      "last_name": "Silva",
      "mobile": "+5573999887766",
      "email": "joao@email.com",
      "status": "active"
    },
    "created": false
  }
}
```

**Resposta (Paciente Criado - 201):**
```json
{
  "success": true,
  "data": {
    "patient": {
      "id": "3750",
      "company": "1",
      "first_name": "João",
      "last_name": "Silva",
      "mobile": "+5573999887766",
      "status": "active",
      "created_at": "2025-11-15 19:50:00"
    },
    "created": true
  }
}
```

**Nota:** Ideal para uso com WhatsApp! Sempre retorna um paciente válido.

---

## 2️⃣0️⃣ **Listar Pacientes**

**Lista pacientes ativos da empresa**

```http
GET /patients?company={company_id}&[filtros]
```

**Query Parameters:**
- `company`: ID da empresa (obrigatório)
- `limit`: Número de resultados (padrão: 50, máx: 100)
- `offset`: Paginação (padrão: 0)

**Exemplo:**
```bash
curl -H "X-API-Key: sua_key" \
  "https://consultoriopro.com.br/service/api/v1/patients?company=1&limit=20"
```

**Resposta (200):**
```json
{
  "success": true,
  "data": {
    "patients": [
      {
        "id": "3713",
        "company": "1",
        "first_name": "Ana Vitória",
        "last_name": "da Silva Pereira",
        "email": "ana@email.com",
        "mobile": "+5573991781072",
        "genre": "f",
        "born_at": "1999-04-08",
        "agreement": "31",
        "status": "active",
        "created_at": "2025-10-29 09:32:25"
      }
    ],
    "total": 689,
    "limit": 50,
    "offset": 0
  }
}
```

**Nota:** Campos sensíveis (`document`, `responsible_cpf`) são ocultados automaticamente.

---

## 2️⃣1️⃣ **Buscar Pacientes por Nome/Telefone**

**Busca pacientes por nome, sobrenome, email ou telefone**

```http
GET /patients/search?company={company_id}&query={termo}
```

**Query Parameters:**
- `company`: ID da empresa (obrigatório)
- `query`: Termo de busca (obrigatório)
- `limit`: Número de resultados (padrão: 20)

**Exemplos:**
```bash
# Buscar por nome
curl -H "X-API-Key: sua_key" \
  "https://consultoriopro.com.br/service/api/v1/patients/search?company=1&query=Ana"

# Buscar por telefone parcial
curl -H "X-API-Key: sua_key" \
  "https://consultoriopro.com.br/service/api/v1/patients/search?company=1&query=73999"
```

**Resposta (200):**
```json
{
  "success": true,
  "data": {
    "patients": [
      {
        "id": "3713",
        "first_name": "Ana Vitória",
        "last_name": "da Silva Pereira",
        "mobile": "+5573991781072",
        "email": "ana@email.com"
      },
      {
        "id": "3734",
        "first_name": "Ana Clara",
        "last_name": "Santos",
        "mobile": "+5573998290124"
      }
    ],
    "total": 20
  }
}
```

---

## 2️⃣2️⃣ **Buscar Paciente Específico**

**Retorna detalhes completos de um paciente**

```http
GET /patients/{id}?company={company_id}
```

**Exemplo:**
```bash
curl -H "X-API-Key: sua_key" \
  "https://consultoriopro.com.br/service/api/v1/patients/3713?company=1"
```

**Resposta (200):**
```json
{
  "success": true,
  "data": {
    "patient": {
      "id": "3713",
      "company": "1",
      "first_name": "Ana Vitória",
      "last_name": "da Silva Pereira",
      "email": "ana@email.com",
      "mobile": "+5573991781072",
      "phone": "",
      "genre": "f",
      "born_at": "1999-04-08",
      "agreement": "31",
      "agreement_code": "00309999033730012",
      "status": "active",
      "created_at": "2025-10-29 09:32:25"
    }
  }
}
```

---

## 2️⃣3️⃣ **Atualizar Paciente**

**Atualiza dados de um paciente**

```http
PUT /patients/{id}
```

**Body (JSON):**
```json
{
  "company": 1,
  "first_name": "João",
  "last_name": "Silva Santos",
  "email": "joao.novo@email.com",
  "mobile": "+5573999887766"
}
```

**Campos Atualizáveis:**
- Qualquer campo exceto: `id`, `company`, `author`, `created_at`

**Exemplo:**
```bash
curl -X PUT \
  -H "X-API-Key: sua_key" \
  -H "Content-Type: application/json" \
  -d '{
    "company": 1,
    "email": "email_atualizado@email.com"
  }' \
  https://consultoriopro.com.br/service/api/v1/patients/3713
```

**Resposta (200):**
```json
{
  "success": true,
  "data": {
    "patient": {
      "id": "3713",
      "email": "email_atualizado@email.com",
      "updated_at": "2025-11-15 20:00:00"
    },
    "updated": true
  }
}
```

---

## ⚠️ Códigos de Erro

| Código HTTP | Erro | Descrição |
|-------------|------|-----------|
| 200 | OK | Sucesso |
| 201 | Created | Recurso criado |
| 400 | Bad Request | Erro de validação |
| 401 | Unauthorized | API Key inválida |
| 403 | Forbidden | Sem permissão |
| 404 | Not Found | Recurso não encontrado |
| 409 | Conflict | Conflito (ex: horário ocupado) |
| 422 | Unprocessable Entity | Validação falhou |
| 500 | Internal Server Error | Erro interno |

---

## 📝 Notas Importantes

### Rate Limiting
- 60 requisições por minuto por API Key
- Timeout: 30 segundos por requisição

### Formatos
- **Charset**: UTF-8
- **Content-Type**: application/json
- **Timezone**: America/Bahia (GMT-3)

### Datas
- **Formato**: YYYY-MM-DD HH:MM:SS
- **Exemplo**: 2025-11-20 14:00:00

### Telefones
- **Formato**: +{código_país}{DDD}{número}
- **Exemplo**: +5573999887766

### Paginação
- Use `limit` e `offset` para paginar resultados
- Máximo de 100 resultados por requisição

---

## 🚀 Casos de Uso Práticos

### Criar Agendamento via WhatsApp

```bash
# 1. Buscar ou criar paciente
curl -X POST \
  -H "X-API-Key: sua_key" \
  -H "Content-Type: application/json" \
  -d '{
    "company": 1,
    "mobile": "+5573999887766",
    "first_name": "João"
  }' \
  https://consultoriopro.com.br/service/api/v1/patients/find-or-create

# 2. Verificar disponibilidade
curl -H "X-API-Key: sua_key" \
  "https://consultoriopro.com.br/service/api/v1/appointments/check-availability?user=93&day=2025-11-20%2014:00:00"

# 3. Criar agendamento
curl -X POST \
  -H "X-API-Key: sua_key" \
  -H "Content-Type: application/json" \
  -d '{
    "company": 1,
    "user": 93,
    "patient": 3750,
    "day": "2025-11-20 14:00:00",
    "confirmed": "yes"
  }' \
  https://consultoriopro.com.br/service/api/v1/appointments
```

---

## 📞 Suporte

- **Email**: suporte@consultoriopro.com.br
- **Documentação**: https://consultoriopro.com.br/api/docs
- **Versão**: 1.0.0
- **Última Atualização**: 15/11/2025