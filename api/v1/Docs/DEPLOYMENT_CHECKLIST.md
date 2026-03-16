# ✅ Checklist de Deploy - ConsultorioPro API

## 🔒 **SEGURANÇA (CRÍTICO)**

- [ ] `.env` está no `.gitignore`
- [ ] `.env.example` existe sem senhas reais
- [ ] Nenhuma senha hardcoded no código
- [ ] API Keys não estão expostas no código
- [ ] `DEBUG_MODE=false` em produção
- [ ] Arquivos `.log` estão no `.gitignore`
- [ ] Arquivos `.backup` estão no `.gitignore`

## 🧪 **TESTES**

- [ ] `php test_api.php` - 17/17 passando (100%)
- [ ] `./run_all_tests.sh` - 21/21 passando (100%)
- [ ] Todos os endpoints retornam 200 ou erro esperado
- [ ] Autenticação funciona corretamente

## 📊 **BANCO DE DADOS**

- [ ] Tabelas criadas (`users_google_calendar`, `api_keys`, `api_logs`)
- [ ] 26 profissionais vinculados ao Google Calendar
- [ ] API Key gerada e testada
- [ ] Conexão com banco funcionando

## 📖 **DOCUMENTAÇÃO**

- [ ] `README.md` completo
- [ ] `API_DOCUMENTATION.md` atualizado
- [ ] `N8N_EXAMPLES.md` com exemplos práticos
- [ ] `GIT_INSTRUCTIONS.md` para controle de versão

## 🔧 **CONFIGURAÇÃO**

- [ ] `.htaccess` configurado (URL rewrite)
- [ ] `.env` com credenciais corretas
- [ ] Timezone configurado (`America/Bahia`)
- [ ] Base URL correta no `.env`

## 🚀 **PRODUÇÃO**

- [ ] `DEBUG_MODE=false` no `.env`
- [ ] Logs configurados para monitoramento
- [ ] Backup automático configurado
- [ ] Monitoramento de uptime ativo

## 🔐 **PÓS-DEPLOY**

- [ ] Testar todos os endpoints em produção
- [ ] Configurar alertas de erro
- [ ] Documentar mudanças no CHANGELOG
- [ ] Notificar equipe sobre nova versão

---

## 📝 **Comandos de Verificação:**
```bash
# Verificar segurança
bash security_check.sh

# Executar testes
php test_api.php
./run_all_tests.sh

# Verificar configuração
cat .env | grep DEBUG_MODE

# Testar API
curl https://consultoriopro.com.br/service/api/v1/health
```

---

## 🆘 **Rollback de Emergência:**
```bash
# 1. Desabilitar API
mv .htaccess .htaccess.disabled

# 2. Restaurar versão anterior
git checkout main
git pull

# 3. Reabilitar
mv .htaccess.disabled .htaccess
```
