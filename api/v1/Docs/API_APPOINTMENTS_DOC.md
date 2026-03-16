# 📘 APPOINTMENTS - Documentação Completa de Rotas

**Sistema:** ConsultorioPro REST API v1\
**Módulo:** Agendamentos (Appointments)\
**Base URL:** https://consultoriopro.com.br/service/api/v1\
**Autenticação:** Header `X-API-Key: {sua_api_key}`

------------------------------------------------------------------------

## 📋 ÍNDICE DE ROTAS

-   POST `/appointments/search-by-patient`\
-   GET `/appointments/by-google-event/{google_event_id}`\
-   GET `/appointments/check-availability`\
-   GET `/appointments/{id}`\
-   PUT `/appointments/{id}`\
-   DELETE `/appointments/{id}`\
-   POST `/appointments`\
-   GET `/appointments`

------------------------------------------------------------------------

## 🔍 Tabelas Utilizadas

-   **app_appointment** -- tabela principal de agendamentos\
-   **users** -- profissionais\
-   **app_patient** -- pacientes\
-   **users_google_calendar** -- sincronização Google Calendar

------------------------------------------------------------------------

## 1. POST /appointments/search-by-patient

### 🎯 Descrição

Busca agendamentos de um paciente com validação LGPD. Retorna consultas
das próximas 3 semanas.

### 📥 Request Body

``` json
{
  "company": 1,
  "first_name": "João",
  "last_name": "Silva Santos",
  "born_at": "1990-05-15",
  "mobile": "77988887777",
  "limit": 10
}
```

### 📤 Response Sucesso

``` json
{ "success": true }
```

------------------------------------------------------------------------

## 2. GET /appointments/by-google-event/{google_event_id}

Busca agendamento pelo ID do evento do Google Calendar.

### 📤 Response Sucesso

``` json
{ "success": true }
```

------------------------------------------------------------------------

## 3. GET /appointments/check-availability

Verifica se o horário está disponível para o profissional.

------------------------------------------------------------------------

## 4. GET /appointments/{id}

Busca todos os detalhes de um agendamento específico.

------------------------------------------------------------------------

## 5. PUT /appointments/{id}

Atualiza dados de um agendamento existente.

------------------------------------------------------------------------

## 6. DELETE /appointments/{id}

Cancela (soft delete) um agendamento.

------------------------------------------------------------------------

## 7. POST /appointments

Cria um novo agendamento no sistema.

------------------------------------------------------------------------

## 8. GET /appointments

Lista os agendamentos com filtros e paginação.

------------------------------------------------------------------------

## 📊 RESUMO DOS MÉTODOS DO MODEL

  Método              Descrição
  ------------------- --------------------------------
  insert              Insere novo agendamento
  update              Atualiza agendamento
  cancel              Cancela agendamento
  confirm             Confirma agendamento
  getByCompany        Lista agendamentos por empresa
  findWithDetails     Busca completo
  checkAvailability   Verifica disponibilidade

------------------------------------------------------------------------

## 🔐 Autenticação

Todas as rotas exigem o header:

    X-API-Key: {sua_api_key}

------------------------------------------------------------------------

## 📝 Notas Importantes

-   Soft delete com campo `deleted`\
-   Status validados no controller\
-   Conformidade com LGPD\
-   Integração opcional com Google Calendar\
-   Datas no formato `YYYY-MM-DD HH:MM:SS`\
-   Multitenant obrigatório por `company`

------------------------------------------------------------------------

📅 **Documentação gerada em:** 03/12/2025\
📦 **Versão da API:** 1.0.0\
🧩 **Sistema:** ConsultorioPro REST API

---

# 🎯 RESUMO COMPLETO - searchByPatient

## ✅ **ESTRUTURA DESCOBERTA:**

### **app_patient:**
```
✅ TEM: status (valores: 'active', etc)
❌ NÃO TEM: deleted
✅ USAR: WHERE status = 'active'
```

### **app_appointment:**
```
❓ PRECISA VERIFICAR: deleted, canceled, status
```

---

## 📄 **ARQUIVOS CRIADOS:**

1. **searchByPatient_ESTRUTURA_REAL.php** ← VERSÃO CORRIGIDA COM status='active'
2. **check_app_appointment.sql** ← SQL para verificar estrutura

---

## 🚀 **PRÓXIMOS PASSOS:**

### **1. Verificar estrutura de app_appointment:**

Execute no phpMyAdmin:
```sql
DESCRIBE `app_appointment`;
```

### **2. Instalar versão corrigida:**

```bash
cd /mnt/user-data/uploads/chserver6/public_html/service/api/v1/Controllers
nano AppointmentController.php
```

Substituir método `searchByPatient` pelo código de: `searchByPatient_ESTRUTURA_REAL.php`

### **3. Ajustar query de appointments conforme estrutura:**

**SE app_appointment TEM coluna `deleted`:**
```sql
WHERE ... AND (deleted IS NULL OR deleted = 'no')
```

**SE app_appointment TEM coluna `canceled`:**
```sql
WHERE ... AND (canceled IS NULL OR canceled = 'no')
```

**SE app_appointment USA coluna `status`:**
```sql
WHERE ... AND status NOT IN ('canceled', 'deleted')
```

**SE não tem nenhuma dessas colunas:**
```sql
-- Filtro manual em PHP (já implementado no código)
```

---

## 🔧 **MUDANÇAS APLICADAS:**

### **Query de app_patient (CORRIGIDA):**

**ANTES (ERRADO):**
```sql
WHERE company = ?
  AND name LIKE ?
  AND (deleted IS NULL OR deleted = 'no')  -- ❌ COLUNA NÃO EXISTE!
```

**AGORA (CORRETO):**
```sql
WHERE company = ?
  AND CONCAT(first_name, ' ', last_name) LIKE ?
  AND status = 'active'  -- ✅ COLUNA EXISTE!
```

### **Query de app_appointment (SAFE):**

```sql
-- Query básica sem assumir colunas
WHERE a.patient = ?
  AND a.company = ?
  AND a.day >= ?
  AND a.day <= ?
-- Sem filtros de deleted/canceled na query

-- Filtro manual depois em PHP:
$appointments = array_filter($appointments, function($apt) {
    $status = strtolower($apt['status'] ?? '');
    return !in_array($status, ['canceled', 'deleted', 'cut', 'close']);
});
```

---

## 📊 **FLUXO DO CÓDIGO ATUAL:**

```
1. Validação de campos ✅
2. Autenticação ✅
3. Buscar pacientes (com status='active') ✅
4. Verificar necessidade LGPD ✅
5. Validação LGPD (4 regras) ✅
6. Buscar agendamentos (query básica) ✅
7. Filtrar agendamentos cancelados (em PHP) ✅
8. Formatar agendamentos ✅
9. Resposta final ✅
```

---

## 🧪 **TESTAR:**

```bash
curl -X POST 'https://consultoriopro.com.br/service/api/v1/appointments/search-by-patient' \
  -H 'X-API-Key: e877ba1c49319300be89bee57a9f11581c0b65c3326ddaf9121b414bafed5960' \
  -H 'Content-Type: application/json' \
  -d '{
    "company": 1,
    "first_name": "Robson",
    "last_name": "Duarte",
    "born_at": "1977-01-01",
    "mobile": "73999913940"
  }' | jq '.'
```

---

## 🎯 **CÓDIGO ATUAL:**

✅ Usa `status = 'active'` para app_patient  
✅ Query básica para app_appointment (sem assumir colunas)  
✅ Filtro manual em PHP por status  
✅ 5 parâmetros para 5 placeholders  
✅ Zero dependências externas  
✅ Validação LGPD completa  
✅ Formatação com tradução de dias  

---

## ⚠️ **SE DER ERRO:**

1. Me mostre o erro completo
2. Execute: `DESCRIBE app_appointment;`
3. Me mostre a estrutura da tabela
4. Ajusto o código conforme a estrutura real

---

**Status:** ✅ PRONTO PARA TESTAR  
**Arquivo:** searchByPatient_ESTRUTURA_REAL.php  
**Próximo passo:** Instalar e testar