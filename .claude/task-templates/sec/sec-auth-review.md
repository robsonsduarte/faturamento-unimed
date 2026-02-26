# Task: Sec — Revisar Autenticacao e Autorizacao

## Objetivo
Revisar sistematicamente todos os fluxos de autenticacao e autorizacao da aplicacao, verificando seguranca de tokens, gestao de sessoes, RBAC, e protecao contra ataques comuns, produzindo lista de melhorias priorizadas.

## Contexto
Usar como auditoria periodica, apos mudancas no sistema de auth, ou antes de lancamentos. Autenticacao ("quem e voce?") e autorizacao ("o que voce pode fazer?") sao as primeiras linhas de defesa — se falharem, nenhuma outra medida de seguranca importa. Esta revisao cobre desde login ate gestao de permissoes granulares.

## Pre-requisitos
- [ ] Acesso ao codebase (middleware, API routes, hooks de auth)
- [ ] Documentacao de fluxos de auth (login, registro, reset, OAuth)
- [ ] Acesso a configuracao do Supabase Auth
- [ ] Conhecimento do modelo de permissoes (roles, policies)
- [ ] Ambiente de teste com usuarios em diferentes roles

## Passos

### 1. Mapear Fluxos de Autenticacao
```
Fluxos existentes:
1. Login com email/senha
   → POST /api/auth/login → Supabase Auth → Set cookie → Redirect /dashboard

2. Registro
   → POST /api/auth/register → Supabase Auth → Email de confirmacao → Login

3. OAuth (Google)
   → /auth/callback → Supabase OAuth → Set cookie → Redirect /dashboard

4. Reset de senha
   → POST /api/auth/reset → Supabase Auth → Email com link → Nova senha

5. Logout
   → POST /api/auth/logout → Supabase Auth → Clear cookie → Redirect /auth/login

6. Refresh de sessao
   → Middleware → Supabase getSession() → Refresh token automatico

Para cada fluxo, verificar:
- [ ] Input e validado (email formato, senha minima)
- [ ] Rate limiting aplicado
- [ ] Resposta nao vaza informacao (email existe vs nao existe)
- [ ] Logs registram tentativas (sucesso e falha)
- [ ] Tokens sao tratados de forma segura
```

### 2. Verificar Gestao de Sessoes
```
Configuracao de sessao:

Cookies:
- [ ] HttpOnly: true (nao acessivel via JavaScript)
- [ ] Secure: true (apenas HTTPS)
- [ ] SameSite: Lax ou Strict (protecao CSRF)
- [ ] Path: / (ou restrito ao necessario)
- [ ] Domain: explicitamente definido
- [ ] Max-Age / Expires: definido (nao sessao infinita)

Verificar no Supabase:
- [ ] Access token expira em tempo razoavel (1h padrao)
- [ ] Refresh token expira em tempo razoavel (7 dias padrao)
- [ ] Refresh token rotation habilitado (cada uso gera novo refresh token)
- [ ] Logout invalida refresh token no servidor

Testes:
1. Inspecionar cookies apos login:
   - Abrir DevTools → Application → Cookies
   - Verificar flags HttpOnly, Secure, SameSite

2. Testar expiracao:
   - Fazer login
   - Aguardar expiracao do access token
   - Verificar que refresh automatico funciona
   - Verificar que refresh token expira apos periodo definido

3. Testar concorrencia de sessoes:
   - Fazer login no browser A
   - Fazer login no browser B
   - Ambas sessoes devem funcionar (ou politica de sessao unica)

4. Testar logout:
   - Fazer logout
   - Tentar usar o token antigo → deve ser rejeitado
   - Cookie deve ser removido
```

### 3. Revisar Middleware de Autenticacao
```typescript
// Verificar: src/middleware.ts e src/lib/supabase/middleware.ts

Checklist:
- [ ] Middleware roda em TODAS as rotas protegidas
- [ ] Sessao e refrescada a cada request (getSession ou getUser)
- [ ] Rotas publicas estao explicitamente whitelisted
- [ ] Rotas de admin verificam role
- [ ] Redirect apos login preserva destino original (?redirect=)
- [ ] Nao ha bypass possivel (ex: case sensitivity, trailing slash)

Testes:
1. Acessar /dashboard sem autenticacao → redirect para /auth/login
2. Acessar /dashboard/admin como user normal → redirect para /access-denied
3. Acessar /api/admin/* como user normal → 403
4. Acessar /auth/login autenticado → redirect para /dashboard
5. Acessar rota que nao existe → 404 (nao expor informacao)
```

### 4. Verificar Autorizacao (RBAC)
```
Modelo de roles:

| Role | Descricao | Acesso |
|------|-----------|--------|
| user | Usuario padrao | Proprios dados, geracao de conteudo |
| admin | Administrador | Tudo + painel admin + gerenciamento |

Verificar para CADA endpoint da API:
| Endpoint | Requer Auth | Requer Role | Verifica Ownership |
|----------|------------|-------------|-------------------|
| GET /api/content | Sim | user | Sim (user_id) |
| POST /api/content | Sim | user | N/A (cria proprio) |
| PUT /api/content/[id] | Sim | user | Sim (user_id) |
| DELETE /api/content/[id] | Sim | user | Sim (user_id) |
| GET /api/admin/users | Sim | admin | N/A |
| POST /api/admin/plans | Sim | admin | N/A |

Para cada endpoint, verificar:
- [ ] Auth e checada no handler (nao depender so do middleware)
- [ ] Role e verificada quando necessario
- [ ] Ownership e verificada (RLS ou codigo)
- [ ] Parametros de URL nao permitem IDOR
```

### 5. Verificar Tokens e Credenciais
```
Verificar:

JWT (Access Token):
- [ ] Assinado com algoritmo seguro (RS256 ou ES256, nao HS256 com secret fraco)
- [ ] Claims minimos necessarios (sub, exp, iat, role)
- [ ] Nao contem dados sensiveis no payload (senha, PII excessivo)
- [ ] Expiracao curta (1h ou menos)
- [ ] Validacao server-side (nao confiar apenas no client)

API Keys:
- [ ] Armazenadas no banco de forma segura (encriptadas ou com acesso restrito)
- [ ] Nao expostas em logs
- [ ] Nao expostas em respostas de API
- [ ] Rotacionaveis sem downtime

Senhas:
- [ ] Hasheadas com bcrypt/argon2 (nunca MD5/SHA1)
- [ ] Politica de complexidade minima (8+ chars)
- [ ] Nao armazenadas em plain text em nenhum lugar
- [ ] Reset de senha usa token de uso unico com expiracao (1h)
```

### 6. Verificar Protecao Contra Ataques
```
Brute Force:
- [ ] Rate limiting em /auth/login (ex: 5 tentativas por minuto)
- [ ] Rate limiting em /auth/reset-password
- [ ] Lockout temporario apos N tentativas (opcional)
- [ ] CAPTCHA apos N tentativas (opcional)

CSRF:
- [ ] SameSite cookie protege contra CSRF basico
- [ ] Operacoes criticas usam token CSRF adicional (se SameSite=None)
- [ ] Formularios de submit nao sao vulneraveis a cross-origin

Session Fixation:
- [ ] Nova sessao gerada apos login (nao reutiliza sessao pre-login)
- [ ] Session ID muda apos mudanca de privilegio

Token Replay:
- [ ] Tokens expirados sao rejeitados
- [ ] Refresh token rotation previne reuso
- [ ] Logout invalida tokens ativos

Enumeracao de Usuarios:
- [ ] Login retorna mesma mensagem para "email nao encontrado" e "senha errada"
- [ ] Registro nao confirma se email ja existe (use: "Se este email estiver cadastrado, voce recebera...")
- [ ] Reset password nao confirma se email existe
- [ ] Timing de resposta e similar em ambos os casos
```

### 7. Verificar OAuth/SSO
```
Se OAuth implementado (Google, GitHub, etc):
- [ ] State parameter usado para prevenir CSRF
- [ ] Redirect URI validado contra whitelist (nao open redirect)
- [ ] Token do provider nao e armazenado desnecessariamente
- [ ] Scopes solicitados sao minimos necessarios
- [ ] Erro no callback nao expoe tokens na URL
- [ ] Conta OAuth pode ser vinculada/desvinculada

Verificar no Supabase Dashboard:
- [ ] Providers habilitados: apenas os necessarios
- [ ] Redirect URLs: apenas dominios conhecidos
- [ ] Site URL: configurado corretamente
```

### 8. Documentar Relatorio
```markdown
## Relatorio de Revisao de Auth

**Data:** 2024-01-15
**Escopo:** Autenticacao e autorizacao completa

### Resumo
| Area | Status | Issues |
|------|--------|--------|
| Login/Registro | OK | 0 |
| Sessao/Cookies | Atencao | 2 |
| Middleware | OK | 0 |
| RBAC/RLS | Atencao | 1 |
| Tokens | OK | 0 |
| Protecao contra ataques | Critico | 1 |
| OAuth | OK | 0 |

### Achados

#### [CRITICO] Sem rate limiting no endpoint de login
**Risco:** Brute force de senhas
**Remediacao:** Implementar rate limiter (5 tentativas/min por IP)
**Prazo:** Imediato

#### [ALTO] Cookie sem flag SameSite explicito
**Risco:** CSRF em navegadores antigos
**Remediacao:** Configurar SameSite=Lax no Supabase
**Prazo:** 7 dias

#### [MEDIO] Resposta de login diferencia email inexistente de senha errada
**Risco:** Enumeracao de usuarios
**Remediacao:** Unificar mensagem de erro
**Prazo:** 14 dias

### Recomendacoes Adicionais
- Implementar MFA para contas admin
- Adicionar logging de todas as tentativas de login
- Configurar alerta para 10+ logins falhados do mesmo IP
```

## Criterios de Aceite
- [ ] Todos os fluxos de autenticacao mapeados e testados
- [ ] Gestao de sessoes verificada (cookies, tokens, expiracao)
- [ ] Middleware revisado com testes de bypass
- [ ] RBAC verificado em todos os endpoints
- [ ] Protecao contra brute force, CSRF, session fixation verificada
- [ ] OAuth/SSO revisado (se aplicavel)
- [ ] Nenhum achado Critico sem correcao imediata
- [ ] Relatorio com achados priorizados e remedicacoes

## Entregaveis
- Relatorio de revisao de auth
- Matriz de autorizacao (endpoint x role)
- Lista de melhorias priorizadas
- Testes de seguranca que validam as correcoes

## Verificacao
- [ ] Achados Criticos corrigidos e re-testados
- [ ] Rate limiting funcional em endpoints de auth
- [ ] Cookies com todas as flags de seguranca
- [ ] RBAC funcional (admin vs user testado)
- [ ] Nenhum bypass de autenticacao encontrado
