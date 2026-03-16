# 🔧 N8N - Exemplos de Integração com ConsultorioPro API

## 🔑 **Configuração Inicial**

### **Passo 1: Adicionar Credencial HTTP**

1. No n8n, vá em **Credentials** → **New**
2. Escolha **Header Auth**
3. Configure:
   - **Name**: `ConsultorioPro API Key`
   - **Header Name**: `X-API-Key`
   - **Header Value**: `sua_chave_de_64_caracteres`
4. Salve

---

## 📋 **EXEMPLO 1: Sincronizar Horários com Google Calendar**

### **Workflow: Buscar e Sincronizar Horários**
```json
{
  "name": "Sync Schedules to Google Calendar",
  "nodes": [
    {
      "parameters": {
        "rule": {
          "interval": [
            {
              "field": "hours",
              "hoursInterval": 6
            }
          ]
        }
      },
      "name": "Schedule Trigger",
      "type": "n8n-nodes-base.scheduleTrigger",
      "typeVersion": 1.1,
      "position": [250, 300]
    },
    {
      "parameters": {
        "url": "https://consultoriopro.com.br/service/api/v1/schedules/1",
        "authentication": "predefinedCredentialType",
        "nodeCredentialType": "headerAuth",
        "options": {}
      },
      "name": "Get Schedules",
      "type": "n8n-nodes-base.httpRequest",
      "typeVersion": 4.1,
      "position": [450, 300],
      "credentials": {
        "headerAuth": {
          "id": "1",
          "name": "ConsultorioPro API Key"
        }
      }
    },
    {
      "parameters": {
        "jsCode": "// Processar dados da API\nconst schedules = $input.item.json.data;\nconst output = [];\n\nfor (const [calendarId, days] of Object.entries(schedules)) {\n  output.push({\n    calendar_id: calendarId,\n    schedules: days\n  });\n}\n\nreturn output;"
      },
      "name": "Process Data",
      "type": "n8n-nodes-base.code",
      "typeVersion": 2,
      "position": [650, 300]
    },
    {
      "parameters": {
        "calendar": "={{ $json.calendar_id }}",
        "start": "={{ $now.plus({days: 1}).toISO() }}",
        "end": "={{ $now.plus({days: 30}).toISO() }}",
        "options": {}
      },
      "name": "Update Google Calendar",
      "type": "n8n-nodes-base.googleCalendar",
      "typeVersion": 1,
      "position": [850, 300]
    }
  ],
  "connections": {
    "Schedule Trigger": {
      "main": [
        [
          {
            "node": "Get Schedules",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "Get Schedules": {
      "main": [
        [
          {
            "node": "Process Data",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "Process Data": {
      "main": [
        [
          {
            "node": "Update Google Calendar",
            "type": "main",
            "index": 0
          }
        ]
      ]
    }
  }
}
```

---

## 📋 **EXEMPLO 2: Verificar Disponibilidade de Profissional**

### **Workflow: Webhook → Verificar Disponibilidade → Responder**

**Cenário:** Sistema externo consulta disponibilidade via webhook

### **Node 1: Webhook**
```
Tipo: Webhook
Method: POST
Path: check-availability
Respond: Using 'Respond to Webhook' Node
```

### **Node 2: HTTP Request - Check Availability**
```
URL: https://consultoriopro.com.br/service/api/v1/schedules/1/availability/{{ $json.body.user_id }}?date={{ $json.body.date }}
Method: GET
Authentication: Header Auth (ConsultorioPro API Key)
```

### **Node 3: IF - Está Disponível?**
```
Condition: {{ $json.data.available }} equals true
```

### **Node 4a: Respond - Disponível**
```json
{
  "available": true,
  "professional": "{{ $json.data.professional_name }}",
  "date": "{{ $json.data.date }}",
  "schedules": "{{ $json.data.schedules }}"
}
```

### **Node 4b: Respond - Indisponível**
```json
{
  "available": false,
  "message": "Profissional não trabalha neste dia"
}
```

---

## 📋 **EXEMPLO 3: Cadastrar Profissional no Google Calendar**

### **Workflow Completo**
```json
{
  "name": "Link Professional to Google Calendar",
  "nodes": [
    {
      "parameters": {
        "httpMethod": "POST",
        "path": "link-calendar",
        "responseMode": "responseNode",
        "options": {}
      },
      "name": "Webhook",
      "type": "n8n-nodes-base.webhook",
      "typeVersion": 1.1,
      "position": [250, 300],
      "webhookId": "abc-123-def"
    },
    {
      "parameters": {
        "url": "https://consultoriopro.com.br/service/api/v1/sync/google-calendar",
        "authentication": "predefinedCredentialType",
        "nodeCredentialType": "headerAuth",
        "sendBody": true,
        "bodyParameters": {
          "parameters": [
            {
              "name": "company_id",
              "value": "={{ $json.body.company_id }}"
            },
            {
              "name": "user_id",
              "value": "={{ $json.body.user_id }}"
            },
            {
              "name": "google_calendar_id",
              "value": "={{ $json.body.calendar_id }}"
            },
            {
              "name": "sync_enabled",
              "value": true
            }
          ]
        },
        "options": {
          "bodyContentType": "json"
        }
      },
      "name": "Create Sync",
      "type": "n8n-nodes-base.httpRequest",
      "typeVersion": 4.1,
      "position": [450, 300],
      "credentials": {
        "headerAuth": {
          "id": "1",
          "name": "ConsultorioPro API Key"
        }
      }
    },
    {
      "parameters": {
        "respondWith": "json",
        "responseBody": "={{ $json }}"
      },
      "name": "Respond Success",
      "type": "n8n-nodes-base.respondToWebhook",
      "typeVersion": 1,
      "position": [650, 300]
    }
  ],
  "connections": {
    "Webhook": {
      "main": [
        [
          {
            "node": "Create Sync",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "Create Sync": {
      "main": [
        [
          {
            "node": "Respond Success",
            "type": "main",
            "index": 0
          }
        ]
      ]
    }
  }
}
```

---

## 📋 **EXEMPLO 4: Listar Profissionais com Google Calendar**

### **Node: HTTP Request**
```
URL: https://consultoriopro.com.br/service/api/v1/professionals/1?with_calendar=true
Method: GET
Authentication: Header Auth
```

### **Processar Resposta (Code Node):**
```javascript
// Extrair apenas profissionais ativos com calendar
const professionals = $input.item.json.data;

const output = professionals
  .filter(p => p.sync_enabled === true)
  .map(p => ({
    id: p.id,
    name: p.name,
    email: p.email,
    calendar_id: p.google_calendar_id,
    occupation: p.occupation.name
  }));

return output;
```

---

## 📋 **EXEMPLO 5: Monitorar API Health**

### **Workflow: Monitor de Saúde da API**
```json
{
  "name": "API Health Monitor",
  "nodes": [
    {
      "parameters": {
        "rule": {
          "interval": [
            {
              "field": "minutes",
              "minutesInterval": 5
            }
          ]
        }
      },
      "name": "Every 5 Minutes",
      "type": "n8n-nodes-base.scheduleTrigger",
      "typeVersion": 1.1,
      "position": [250, 300]
    },
    {
      "parameters": {
        "url": "https://consultoriopro.com.br/service/api/v1/health",
        "options": {
          "timeout": 5000
        }
      },
      "name": "Check Health",
      "type": "n8n-nodes-base.httpRequest",
      "typeVersion": 4.1,
      "position": [450, 300]
    },
    {
      "parameters": {
        "conditions": {
          "boolean": [
            {
              "value1": "={{ $json.success }}",
              "value2": true
            }
          ]
        }
      },
      "name": "Is Healthy?",
      "type": "n8n-nodes-base.if",
      "typeVersion": 1,
      "position": [650, 300]
    },
    {
      "parameters": {
        "message": "⚠️ API OFFLINE!\n\nURL: https://consultoriopro.com.br/service/api/v1\nTimestamp: {{ $now.toISO() }}"
      },
      "name": "Send Alert (Slack/Email)",
      "type": "n8n-nodes-base.slack",
      "typeVersion": 1,
      "position": [850, 400]
    }
  ],
  "connections": {
    "Every 5 Minutes": {
      "main": [
        [
          {
            "node": "Check Health",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "Check Health": {
      "main": [
        [
          {
            "node": "Is Healthy?",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "Is Healthy?": {
      "main": [
        [],
        [
          {
            "node": "Send Alert (Slack/Email)",
            "type": "main",
            "index": 0
          }
        ]
      ]
    }
  }
}
```

---

## 🎯 **EXEMPLO 6: Workflow Completo - Agendamento Automático**

### **Cenário:** Paciente solicita consulta via WhatsApp → Verifica disponibilidade → Agenda
```javascript
// Node 1: Webhook (recebe dados do WhatsApp)

// Node 2: HTTP Request - Verificar Disponibilidade
URL: https://consultoriopro.com.br/service/api/v1/schedules/1/availability/{{ $json.doctor_id }}?date={{ $json.date }}

// Node 3: IF - Disponível?
Condition: {{ $json.data.available }} = true

// Node 4a: HTTP Request - Criar Agendamento (seu sistema)
// Node 4b: Responder WhatsApp - Indisponível

// Node 5: HTTP Request - Confirmar no Google Calendar
```

---

## 📝 **Dicas de Uso no n8n**

### **1. Reutilizar Credencial**
Crie UMA credencial `Header Auth` e reutilize em todos os workflows.

### **2. Tratamento de Erros**
Sempre adicione um node **Error Trigger** para capturar falhas:
```
Error Trigger → Send Alert (Slack/Email)
```

### **3. Logs**
Use **Set Node** para adicionar logs antes de cada requisição:
```javascript
return [{
  json: {
    timestamp: $now.toISO(),
    endpoint: '/schedules/1',
    request_data: $json
  }
}];
```

### **4. Cache de Dados**
Para dados que não mudam frequentemente (ex: lista de profissionais), use **Redis** ou **Function Items** para cache.

### **5. Rate Limiting**
A API permite 60 requisições/minuto. Use **Delay** entre chamadas em loops:
```
Loop Items → Delay (1000ms) → HTTP Request
```

---

## 🚀 **Próximos Passos**

1. Importe os workflows acima no seu n8n
2. Configure a credencial API Key
3. Teste cada endpoint individualmente
4. Adapte aos seus casos de uso

---

## 📞 **Suporte**

- Documentação completa: `API_DOCUMENTATION.md`
- Email: suporte@consultoriopro.com.br
