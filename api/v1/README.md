# 🏥 ConsultorioPro REST API

API REST profissional para gestão de horários, profissionais e sincronização com Google Calendar.

---

## 🚀 **Quick Start**

### **1. Testar a API:**
```bash
curl https://consultoriopro.com.br/service/api/v1/health
```

### **2. Autenticar:**
```bash
curl -H "X-API-Key: SUA_CHAVE" \
  https://consultoriopro.com.br/service/api/v1/schedules/1
```

---

## 📖 **Documentação**

- **[API_DOCUMENTATION.md](API_DOCUMENTATION.md)** - Documentação completa dos endpoints
- **[N8N_EXAMPLES.md](N8N_EXAMPLES.md)** - Exemplos de integração com n8n

---

## 🧪 **Testes**

### **Testes Automatizados (Bash):**
```bash
./run_all_tests.sh
```

### **Testes PHP:**
```bash
php test_api.php
```

**Resultado Atual:** ✅ 21/21 testes passando (100%)

---

## 🔑 **API Key**

Gerada e configurada. Para criar novas:
```bash
php generate_api_key.php
```

---

## 📊 **Endpoints Disponíveis**

### **Schedules (Horários):**
- `GET /schedules/{company_id}` - Todos os horários
- `GET /schedules/{company_id}/{user_id}` - Horários de um profissional
- `GET /schedules/{company_id}/availability/{user_id}?date=YYYY-MM-DD` - Disponibilidade

### **Professionals (Profissionais):**
- `GET /professionals/{company_id}` - Listar profissionais
- `GET /professionals/{company_id}/{user_id}` - Detalhes
- `GET /professionals/{company_id}/occupations` - Ocupações/Especialidades

### **Sync (Sincronização):**
- `POST /sync/google-calendar` - Criar sincronização
- `GET /sync/google-calendar/{company_id}` - Listar sincronizações
- `PUT /sync/google-calendar/{company_id}/{user_id}/toggle` - Ativar/Desativar
- `DELETE /sync/google-calendar/{company_id}/{user_id}` - Remover

### **Utility:**
- `GET /health` - Health check
- `GET /` - Documentação automática

---

## 🗄️ **Banco de Dados**

### **Tabelas:**
- `users_google_calendar` - Vincula profissionais ao Google Calendar
- `api_keys` - Chaves de autenticação
- `api_logs` - Logs de requisições

### **Dados:**
- ✅ 26 profissionais vinculados
- ✅ 1 API Key ativa

---

## 🔧 **Configuração**

### **Arquivo .env:**
```ini
DB_HOST=localhost
DB_NAME=consult6_cpro
DB_USER=consult6_robson
DB_PASS=sua_senha

API_BASE_URL=https://consultoriopro.com.br/service/api/v1
TIMEZONE=America/Bahia
```

---

## 🛠️ **Scripts Utilitários**

| Script | Descrição |
|--------|-----------|
| `generate_api_key.php` | Gera nova API Key |
| `install_database.php` | Cria tabelas no banco |
| `sync_professionals.php` | Vincula profissionais ao Google Calendar |
| `test_api.php` | Suite de testes PHP (17 testes) |
| `run_all_tests.sh` | Suite de testes Bash (21 testes) |

---

## 📈 **Status do Projeto**

- ✅ **API:** 100% funcional
- ✅ **Testes:** 21/21 passando (100%)
- ✅ **Documentação:** Completa
- ✅ **Profissionais:** 26 vinculados
- ✅ **Google Calendar:** Sincronizado

---

## 🌐 **Base URL**
```
https://consultoriopro.com.br/service/api/v1
```

---

## 📞 **Suporte**

- **Desenvolvedor:** Robson Duarte
- **Email:** suporte@consultoriopro.com.br
- **Versão:** 1.0.0
- **Data:** Novembro 2025

---

## 🎯 **Próximos Passos**

1. ✅ Integrar com n8n (ver N8N_EXAMPLES.md)
2. ✅ Configurar automações de agendamento
3. ✅ Monitorar logs e performance
4. ⚠️ Desabilitar DEBUG_MODE em produção (.env)

---

## 📝 **Licença**

Proprietário - ConsultorioPro © 2025
