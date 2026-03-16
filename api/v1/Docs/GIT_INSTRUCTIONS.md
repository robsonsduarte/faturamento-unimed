# 🔧 Git - Instruções de Uso

## 📋 **Primeiro Commit**

### **1. Inicializar repositório (se ainda não existir):**
```bash
cd ~/public_html/service/api/v1
git init
```

### **2. Verificar .gitignore:**
```bash
cat .gitignore
```

### **3. Adicionar arquivos SEGUROS:**
```bash
# Adicionar tudo (o .gitignore protege arquivos sensíveis)
git add .

# OU adicionar seletivamente:
git add .htaccess .env.example .gitignore
git add index.php routes.php
git add Config/ Models/ Controllers/ Middleware/ Helpers/
git add *.md
git add *.sh
git add api_agendamento_sql_setup.sql
```

### **4. Verificar o que será commitado:**
```bash
git status
```

**⚠️ IMPORTANTE:** Verifique se `.env` NÃO aparece na lista!

### **5. Fazer commit:**
```bash
git commit -m "Initial commit - ConsultorioPro REST API v1.0.0

- 22 arquivos PHP (MVC completo)
- 12 endpoints funcionais
- Documentação completa
- Scripts de teste (100% passando)
- Sistema de autenticação via API Key"
```

---

## 🔒 **Verificar Segurança ANTES de Commit**

### **Nunca commitar:**
- ❌ `.env` (senhas do banco)
- ❌ `*.log` (logs com dados sensíveis)
- ❌ `*.backup` (backups podem ter dados)
- ❌ Arquivos com senhas hardcoded

### **Verificar antes:**
```bash
# Ver todos os arquivos que serão commitados
git status

# Ver conteúdo de um arquivo específico
git diff --cached arquivo.php

# Remover arquivo acidentalmente adicionado
git reset HEAD .env
```

---

## 🌿 **Branching**

### **Criar branch de desenvolvimento:**
```bash
git checkout -b desenvolvimento
```

### **Criar branch para nova feature:**
```bash
git checkout -b feature/n8n-integration
```

### **Voltar para main:**
```bash
git checkout main
```

---

## 📤 **Push para Repositório Remoto**

### **1. Adicionar remote (GitHub, GitLab, etc):**
```bash
git remote add origin https://github.com/seu-usuario/consultoriopro-api.git
```

### **2. Push:**
```bash
git push -u origin main
```

---

## 🔐 **Boas Práticas de Segurança**

1. ✅ **SEMPRE** use `.env` para dados sensíveis
2. ✅ **SEMPRE** verifique `git status` antes de commit
3. ✅ **NUNCA** commite `.env` (use `.env.example`)
4. ✅ **SEMPRE** revise o diff antes de push
5. ✅ Use `.gitignore` para proteger arquivos sensíveis

---

## 🆘 **Remover arquivo sensível commitado por engano:**
```bash
# Remover do histórico (CUIDADO!)
git filter-branch --force --index-filter \
  "git rm --cached --ignore-unmatch .env" \
  --prune-empty --tag-name-filter cat -- --all

# Force push (se já fez push)
git push origin --force --all
```

**⚠️ ATENÇÃO:** Mude as senhas imediatamente se .env foi exposto!

---

## 📝 **Mensagens de Commit**

### **Formato recomendado:**
```
tipo: descrição curta

Descrição detalhada do que foi alterado e por quê.
```

### **Tipos:**
- `feat:` Nova funcionalidade
- `fix:` Correção de bug
- `docs:` Documentação
- `refactor:` Refatoração de código
- `test:` Adição/correção de testes
- `chore:` Tarefas de manutenção

### **Exemplos:**
```bash
git commit -m "feat: adicionar endpoint de relatórios"
git commit -m "fix: corrigir validação de data no availability"
git commit -m "docs: atualizar API_DOCUMENTATION.md"
```
