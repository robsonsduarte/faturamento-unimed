# 📥 Como Importar o Workflow no n8n

## 🎯 **Método 1: Importar via Interface (Recomendado)**

### **Passo 1: Acessar n8n**
```
https://n8n.robsonduarte.com.br
```

### **Passo 2: Importar Workflow**
1. Clique em **"Workflows"** no menu lateral
2. Clique no botão **"+" (Novo Workflow)**
3. Clique nos **3 pontinhos** (⋮) no canto superior direito
4. Selecione **"Import from File"**
5. Selecione o arquivo: `n8n_workflow_test.json`
6. Clique em **"Import"**

### **Passo 3: Salvar**
1. Clique em **"Save"** (canto superior direito)
2. Nome sugerido: **"ConsultorioPro API - Teste Completo"**

---

## 🚀 **Método 2: Importar via Clipboard**

### **Copiar JSON:**
```bash
cat n8n_workflow_test.json
```

### **No n8n:**
1. Novo Workflow
2. Clique nos **3 pontinhos** (⋮)
3. **"Import from Clipboard"**
4. Cole o JSON
5. **"Import"**

---

## ▶️ **Executar o Teste**

### **1. Abrir o Workflow Importado**

### **2. Clicar em "Execute Workflow"** (botão no canto superior direito)

### **3. Aguardar Execução** (deve levar ~2-3 segundos)

### **4. Verificar Resultados:**

Clique no node **"Processar Resultados"** para ver o output:
```json
{
  "test_timestamp": "2025-11-15T...",
  "results": {
    "health_check": {
      "status": "PASSED",
      "response": {...}
    },
    "professionals": {
      "status": "PASSED",
      "total_found": 26,
      "sample": [...]
    },
    "schedules": {
      "status": "PASSED",
      "professional_name": "Mailanne Batista Dantas",
      "has_google_calendar": "YES"
    }
  },
  "summary": {
    "all_tests_passed": true,
    "total_tests": 3,
    "passed": 3
  }
}
```

---

## ✅ **Resultado Esperado:**
```
✅ all_tests_passed: true
✅ total_tests: 3
✅ passed: 3
```

---

## 🔧 **Troubleshooting**

### **Erro: "Could not connect to host"**
- Verifique se a URL está correta
- Teste manualmente: `curl https://consultoriopro.com.br/service/api/v1/health`

### **Erro: 401 Unauthorized**
- Verifique a API Key no node "2. Listar Profissionais"
- Deve ser: `e877ba1c49319300be89bee57a9f11581c0b65c3326ddaf9121b414bafed5960`

### **Erro: 404 Not Found**
- Verifique se o profissional ID 93 existe
- Altere para outro ID se necessário

---

## 🎯 **Próximos Passos**

Após validar que o teste funciona:

1. ✅ Criar workflow de agendamento automático
2. ✅ Integrar com WhatsApp (via Z-API)
3. ✅ Criar automações de lembrete
4. ✅ Sincronizar com Google Calendar

Ver exemplos em: **N8N_EXAMPLES.md**
