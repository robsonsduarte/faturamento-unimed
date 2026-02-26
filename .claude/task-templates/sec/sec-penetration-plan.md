# Task: Sec — Planejar Teste de Penetracao

## Objetivo
Planejar e executar teste de penetracao estruturado para identificar vulnerabilidades exploráveis na aplicacao, infraestrutura e configuracao, produzindo relatorio com achados classificados e remedicacoes.

## Contexto
Usar como teste periodico (semestral ou anual), antes de lancamentos criticos, ou apos mudancas arquiteturais significativas. Diferente da auditoria OWASP (que e checklist), o pentest simula um atacante real tentando explorar vulnerabilidades de forma criativa. Pode ser interno (equipe propria) ou externo (empresa especializada).

## Pre-requisitos
- [ ] Escopo claramente definido (o que testar e o que NAO testar)
- [ ] Autorizacao formal para testar (evitar problemas legais)
- [ ] Ambiente de teste isolado (NAO testar diretamente em producao)
- [ ] Ferramentas de teste instaladas
- [ ] Backup recente do ambiente de teste
- [ ] Contatos de emergencia caso algo de errado

## Passos

### 1. Definir Escopo e Regras de Engajamento
```
## Escopo do Teste

Incluido:
- Aplicacao web: https://staging.app.example.com.br
- API: https://staging.app.example.com.br/api/*
- Autenticacao e sessao
- Upload de arquivos
- Integracoes (Supabase, Stripe webhooks)

Excluido:
- Infraestrutura Supabase (responsabilidade do Supabase)
- Servicos de terceiros (Stripe, Cloudflare)
- DDoS / negacao de servico
- Engenharia social
- Teste em producao

Regras:
- Apenas no ambiente de staging
- Horario: seg-sex, 08-20h
- Nao deletar dados de outros usuarios de teste
- Parar imediatamente se causar indisponibilidade
- Reportar vulnerabilidades criticas imediatamente (nao esperar relatorio final)

Autorizacao: [nome do responsavel] em [data]
```

### 2. Reconhecimento (Reconnaissance)
```
Coleta de informacao passiva:
- [ ] Tecnologias identificadas (Wappalyzer, headers)
- [ ] Subdominios descobertos (DNS enumeration)
- [ ] Endpoints de API mapeados (crawling, documentacao)
- [ ] Versoes de software expostas (Server header, meta tags)
- [ ] Informacoes em repositorios publicos (GitHub, npm)
- [ ] Google dorks: site:app.example.com.br filetype:env

Coleta ativa:
- [ ] Port scan do servidor (nmap)
- [ ] Diretorio brute force (dirbuster, gobuster)
- [ ] Parametros de API enumerados
- [ ] Formularios e pontos de entrada mapeados
- [ ] Respostas de erro analisadas (info leakage)

Resultado esperado:
- Mapa completo da superficie de ataque
- Lista de tecnologias e versoes
- Lista de endpoints e parametros
```

### 3. Testar Autenticacao
```
Testes:
- [ ] Brute force de senha (tentar 1000 senhas comuns)
  → Resultado esperado: bloqueio apos N tentativas
- [ ] Password spraying (1 senha comum em muitos emails)
  → Resultado esperado: rate limiting por IP
- [ ] Enumeracao de usuarios (diferencas na resposta de login)
  → Resultado esperado: resposta identica para email existente vs inexistente
- [ ] Token de reset de senha previsivel?
  → Resultado esperado: token aleatorio, expira em 1h, uso unico
- [ ] Session fixation (forcar session ID)
  → Resultado esperado: nova sessao apos login
- [ ] Session hijacking via XSS (roubar cookie)
  → Resultado esperado: HttpOnly impede acesso via JS
- [ ] OAuth redirect manipulation
  → Resultado esperado: redirect validado contra whitelist
```

### 4. Testar Autorizacao (Access Control)
```
Testes:
- [ ] IDOR: Acessar recurso de outro usuario alterando ID na URL/body
  → GET /api/content/[id-de-outro-usuario]
  → Resultado esperado: 403 ou 404
- [ ] Privilege escalation: Acessar funcoes de admin como usuario comum
  → POST /api/admin/users com token de usuario normal
  → Resultado esperado: 403
- [ ] BOLA (Broken Object Level Authorization):
  → Alterar user_id no body do request
  → Resultado esperado: RLS bloqueia
- [ ] Funcao horizontal: Modificar dados de outro usuario do mesmo role
  → PUT /api/content/[id] com dados de outro usuario
  → Resultado esperado: RLS bloqueia
```

### 5. Testar Injection
```
Testes de SQL Injection:
- [ ] Campos de texto: ' OR 1=1 --
- [ ] Parametros de URL: ?id=1 UNION SELECT * FROM profiles
- [ ] Headers: X-Forwarded-For: ' OR 1=1 --
- [ ] JSON body: {"email": "admin'--"}
→ Resultado esperado: Supabase client parametriza queries automaticamente

Testes de XSS:
- [ ] Stored XSS: Salvar <script>alert(1)</script> em campo de texto
  → Resultado esperado: Escapado na renderizacao (React faz por padrao)
- [ ] Reflected XSS: URL com ?q=<script>alert(1)</script>
  → Resultado esperado: Input sanitizado
- [ ] DOM XSS: Manipular hash/fragment da URL
  → Resultado esperado: Nao executado

Testes de Command Injection:
- [ ] Campos que podem gerar comandos do sistema
  → Ex: nome de arquivo com ; rm -rf /
  → Resultado esperado: Input sanitizado

Testes de SSRF:
- [ ] Campos de URL (webhook, image URL, etc)
  → Tentar: http://127.0.0.1:5432, http://169.254.169.254/metadata
  → Resultado esperado: URL validada contra whitelist
```

### 6. Testar Upload de Arquivos
```
Testes:
- [ ] Upload de arquivo executavel (.php, .jsp, .sh)
  → Resultado esperado: Tipo rejeitado
- [ ] Upload com extensao manipulada (evil.php.jpg)
  → Resultado esperado: Validacao por magic bytes, nao extensao
- [ ] Upload gigante (10GB)
  → Resultado esperado: Limite de tamanho aplicado
- [ ] Path traversal no nome: ../../../etc/passwd
  → Resultado esperado: Nome sanitizado
- [ ] Content-Type spoofing (image/jpeg com conteudo PHP)
  → Resultado esperado: Validacao de conteudo real
```

### 7. Testar Configuracao e Infra
```
Testes:
- [ ] Portas abertas desnecessarias (nmap -sV target)
- [ ] Servicos expostos (Redis sem auth, debug endpoints)
- [ ] Headers de seguranca ausentes (HSTS, CSP, X-Frame-Options)
- [ ] Diretorio listing habilitado
- [ ] Arquivos sensiveis acessiveis (/.env, /backup.sql, /.git)
- [ ] Pagina de erro expoe stack trace
- [ ] Versao do servidor exposta (Server header)
- [ ] TLS vulneravel (SSLScan, testssl.sh)
```

### 8. Documentar Relatorio
```markdown
## Relatorio de Teste de Penetracao

**Data:** 2024-01-15 a 2024-01-17
**Escopo:** Aplicacao web staging
**Testador:** [nome]
**Metodologia:** OWASP Testing Guide v4 + PTES

### Resumo Executivo
- Vulnerabilidades encontradas: 12
- Criticas: 1
- Altas: 2
- Medias: 4
- Baixas: 5

### Achados

#### [CRITICO] IDOR na API de conteudo
**Descricao:** Endpoint GET /api/content/[id] retorna conteudo de qualquer
usuario sem verificar ownership.
**Reprodução:**
1. Autenticar como usuario A
2. Obter ID de conteudo do usuario B (via listagem publica)
3. GET /api/content/[id-do-usuario-B] com token do usuario A
4. Conteudo completo do usuario B retornado

**Impacto:** Qualquer usuario autenticado pode ler conteudo de qualquer outro.
**Remediacao:** Verificar ownership no endpoint OU confiar em RLS (verificar que RLS esta ativo).
**CVSS:** 8.1 (High)
**Prazo para correcao:** Imediato

#### [ALTO] Falta de rate limiting no login
**Descricao:** ...
[continuar para cada achado]

### Recomendacoes Gerais
1. Implementar IDOR check em todos os endpoints que acessam recursos por ID
2. Adicionar rate limiting em endpoints de autenticacao
3. Revisar headers de seguranca (CSP esta faltando)

### Proximo Teste
Agendado para: [data + 6 meses]
```

## Criterios de Aceite
- [ ] Escopo e regras de engajamento documentados
- [ ] Reconhecimento concluido com mapa de superficie de ataque
- [ ] Autenticacao testada (brute force, session, token)
- [ ] Autorizacao testada (IDOR, privilege escalation)
- [ ] Injection testada (SQL, XSS, command, SSRF)
- [ ] Upload de arquivo testado
- [ ] Configuracao e infra testados
- [ ] Relatorio com achados classificados por severidade
- [ ] Remedicacoes propostas para cada achado Critico/Alto
- [ ] Nenhum achado Critico sem plano de correcao imediato

## Entregaveis
- Relatorio de pentest completo (markdown ou PDF)
- Evidencias de cada vulnerabilidade (screenshots, logs, payloads)
- Lista de remedicacoes priorizadas com prazos
- Reteste apos correcoes

## Verificacao
- [ ] Achados Criticos corrigidos e re-testados
- [ ] Achados Altos tem prazo de correcao definido
- [ ] Relatorio compartilhado com equipe de desenvolvimento
- [ ] Proxima rodada de pentest agendada
