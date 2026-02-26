# Task: Sec — Auditoria OWASP Top 10

## Objetivo
Executar auditoria de seguranca baseada no OWASP Top 10, verificando cada categoria de vulnerabilidade, documentando achados e implementando remedicacoes priorizadas.

## Contexto
Usar como auditoria periodica (trimestral recomendado), antes de lancamentos significativos, ou apos incidentes de seguranca. O OWASP Top 10 cobre as vulnerabilidades web mais criticas e e o padrao da industria. Esta auditoria foca em verificacao pratica — nao em compliance teorico.

## Pre-requisitos
- [ ] Acesso ao codebase completo
- [ ] Acesso a configuracao de infraestrutura (Nginx, env vars)
- [ ] Ambiente de teste para validar vulnerabilidades
- [ ] Compreensao da arquitetura da aplicacao
- [ ] Lista de endpoints e fluxos criticos

## Passos

### 1. A01:2021 — Broken Access Control
```
Verificar:
- [ ] RLS habilitado em TODAS as tabelas com dados de usuario
- [ ] Endpoints de API verificam autenticacao (nao confiam so no middleware)
- [ ] Endpoints verificam autorizacao (role, ownership)
- [ ] IDs sequenciais nao permitem IDOR (Insecure Direct Object Reference)
- [ ] Upload de arquivo nao permite path traversal
- [ ] CORS configurado restritivamente (nao Access-Control-Allow-Origin: *)
- [ ] Rate limiting em endpoints sensiveis

Teste pratico:
1. Fazer request a /api/content/[id] com ID de outro usuario → deve retornar 403/404
2. Acessar /dashboard/admin como usuario nao-admin → deve redirecionar
3. Modificar user_id no body de POST → RLS deve bloquear

Achados: [documentar aqui]
```

### 2. A02:2021 — Cryptographic Failures
```
Verificar:
- [ ] HTTPS obrigatorio (HTTP redireciona 301)
- [ ] TLS 1.2+ apenas (TLS 1.0 e 1.1 desabilitados)
- [ ] Senhas hasheadas com algoritmo forte (bcrypt, argon2)
- [ ] Dados sensiveis nao sao logados (PII, tokens, senhas)
- [ ] API keys armazenadas de forma segura (banco, nao .env em codigo)
- [ ] Cookies com flags: HttpOnly, Secure, SameSite
- [ ] Nenhum secret hardcoded no codigo fonte
- [ ] .env nao esta no repositorio

Teste pratico:
1. SSL Labs test → score deve ser A+
2. Buscar "password", "secret", "key" no codebase → nao deve ter hardcoded
3. Inspecionar cookies → devem ter HttpOnly e Secure

Achados: [documentar aqui]
```

### 3. A03:2021 — Injection
```
Verificar:
- [ ] Queries SQL usam parametros (nao concatenacao de strings)
- [ ] ORM/query builder usado para acesso ao banco (Supabase client)
- [ ] Input do usuario validado com schema (Zod)
- [ ] Nenhum eval() ou Function() com input do usuario
- [ ] Template strings nao injetam HTML sem sanitizacao
- [ ] Command injection prevenido (nao usar child_process com input do usuario)
- [ ] LDAP/OS injection prevenido

Teste pratico:
1. Enviar ' OR 1=1 -- em campos de texto → nao deve alterar comportamento
2. Enviar <script>alert(1)</script> em campos → deve ser escapado no output
3. Enviar ${process.env.SECRET} em campos → nao deve expandir

Achados: [documentar aqui]
```

### 4. A04:2021 — Insecure Design
```
Verificar:
- [ ] Fluxos criticos tem limite de tentativas (login, OTP, reset password)
- [ ] Recovery de conta nao expoe se email existe
- [ ] Multi-step wizards nao podem ser manipulados (pular passos)
- [ ] Rate limiting em operacoes que consomem recursos (AI generation)
- [ ] Creditos/limites verificados server-side (nao apenas client)
- [ ] Business logic flaws: descontos negativos, quantidades < 0, etc

Teste pratico:
1. Tentar login 100x com senha errada → deve bloquear/limitar
2. Tentar gerar conteudo sem creditos → deve negar server-side
3. Enviar quantidade negativa em compra → deve rejeitar

Achados: [documentar aqui]
```

### 5. A05:2021 — Security Misconfiguration
```
Verificar:
- [ ] Headers de seguranca configurados (X-Frame-Options, CSP, HSTS, etc)
- [ ] Stack traces nao expostos ao usuario em producao
- [ ] Diretories listing desabilitado no Nginx
- [ ] Portas desnecessarias fechadas no firewall
- [ ] Servicos default (PHPMyAdmin, etc) removidos
- [ ] Debug mode desabilitado em producao
- [ ] Permissoes de arquivo adequadas (600 para secrets, 644 para configs)
- [ ] Versao de server nao exposta (Server header removido)

Teste pratico:
1. Acessar /.env → deve retornar 404
2. Acessar /api/nonexistent → erro nao deve expor stack trace
3. Verificar headers: curl -I https://app.example.com

Achados: [documentar aqui]
```

### 6. A06:2021 — Vulnerable and Outdated Components
```
Verificar:
- [ ] npm audit sem vulnerabilidades criticas/altas
- [ ] Node.js em versao LTS atual (20.x ou 22.x)
- [ ] Dependencias com CVEs conhecidos identificadas
- [ ] Lock file (package-lock.json) commitado e atualizado
- [ ] Dependencias nao utilizadas removidas
- [ ] Sub-dependencias nao trazem vulnerabilidades transitivas

Teste pratico:
npm audit
npm audit --production  # apenas deps de producao
npx npm-check-updates  # listar atualizacoes disponiveis

Achados: [documentar aqui]
```

### 7. A07:2021 — Identification and Authentication Failures
```
Verificar:
- [ ] Politica de senha minima (8+ chars, complexidade)
- [ ] Protecao contra brute force (rate limiting, CAPTCHA apos N tentativas)
- [ ] Tokens de sessao sao aleatorios e imprevisiveis
- [ ] Sessao expira apos inatividade (30min-24h)
- [ ] Logout invalida sessao server-side
- [ ] Multi-factor authentication disponivel (se aplicavel)
- [ ] Reset de senha usa token de uso unico com expiracao
- [ ] OAuth state parameter valida contra CSRF

Teste pratico:
1. Verificar que sessao expira apos tempo configurado
2. Tentar reusar token apos logout → deve falhar
3. Verificar que reset password token expira

Achados: [documentar aqui]
```

### 8. A08-A10: Server-Side Request Forgery, Logging/Monitoring, Software Integrity
```
A08 — SSRF:
- [ ] URLs fornecidas pelo usuario sao validadas (whitelist de dominios)
- [ ] Requests server-side nao acessam rede interna (127.0.0.1, 10.x, 192.168.x)
- [ ] Redirect following limitado ou desabilitado em HTTP clients

A09 — Security Logging and Monitoring Failures:
- [ ] Login failures sao logados com IP e timestamp
- [ ] Acoes administrativas sao logados (audit trail)
- [ ] Logs nao contem dados sensiveis (senhas, tokens, PII)
- [ ] Alertas configurados para padroes anomalos
- [ ] Logs sao imutaveis (nao podem ser alterados por atacante)

A10 — Software and Data Integrity Failures:
- [ ] CI/CD pipeline tem verificacao de integridade
- [ ] Dependencias vem de registros confiaveis (npm public registry)
- [ ] Deserialization de dados nao confiaveis e segura
- [ ] Auto-update nao instala codigo nao verificado
- [ ] Webhooks validam assinatura (Stripe webhook signature)

Achados: [documentar aqui]
```

## Criterios de Aceite
- [ ] Todas as 10 categorias OWASP verificadas
- [ ] Pelo menos 1 teste pratico por categoria
- [ ] Achados documentados com severidade (Critico/Alto/Medio/Baixo)
- [ ] Remedicacoes propostas para cada achado Critico e Alto
- [ ] Nenhum achado Critico sem plano de correcao
- [ ] Score SSL Labs A+
- [ ] npm audit sem vulnerabilidades criticas
- [ ] RLS verificado em todas as tabelas

## Entregaveis
- Relatorio de auditoria OWASP (markdown)
- Lista de achados priorizados com remedicacoes
- Evidencias de testes (screenshots, logs, curl output)
- Plano de correcao com prazos

## Verificacao
- [ ] Achados Criticos corrigidos e re-testados
- [ ] Achados Altos tem prazo de correcao definido (<30 dias)
- [ ] Relatorio revisado por segundo par de olhos
- [ ] Proxima auditoria agendada (trimestral)
