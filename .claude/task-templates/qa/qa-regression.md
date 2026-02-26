# Task: QA — Teste de Regressao

## Objetivo
Executar testes de regressao para garantir que mudancas recentes nao quebraram funcionalidades existentes, identificando areas afetadas, executando suites relevantes e comparando resultados com baseline.

## Contexto
Usar apos mudancas significativas no codebase: refatoracoes, atualizacoes de dependencias, migracoes de banco, ou antes de releases. A regressao nao testa a feature nova — testa tudo que JA funcionava e deve continuar funcionando. E a rede de seguranca que detecta efeitos colaterais.

## Pre-requisitos
- [ ] Mudancas a serem validadas identificadas (commits, PRs, features)
- [ ] Suite de testes existente funcional
- [ ] Baseline de resultados anterior disponivel (ultimo run verde)
- [ ] Ambiente de teste configurado e representativo

## Passos

### 1. Identificar Areas Afetadas
Analise o diff das mudancas e mapeie o blast radius:
```
Mudanca: Refatoracao do servico de autenticacao

Arquivos alterados diretamente:
- src/lib/supabase/server.ts
- src/lib/supabase/middleware.ts
- src/middleware.ts

Dependentes (importam os arquivos alterados):
- src/app/api/*/route.ts (todos os API routes usam createClient)
- src/hooks/use-auth.ts
- src/app/auth/*/page.tsx

Areas de risco:
- Login/logout (fluxo principal de auth)
- Acesso a rotas protegidas (middleware)
- Chamadas de API autenticadas (todos os endpoints)
- RBAC admin (verificacao de role)
```

Use ferramentas para mapear dependencias:
```bash
# Encontrar quem importa o arquivo alterado
grep -r "from.*supabase/server" src/ --include="*.ts" --include="*.tsx" -l
```

### 2. Selecionar Suites de Teste
Organize por prioridade de execucao:
```
Prioridade 1 (sempre executar):
- Testes dos arquivos diretamente alterados
- Testes de fluxos criticos (auth, pagamento, geracao de conteudo)

Prioridade 2 (executar se P1 passou):
- Testes dos modulos dependentes
- Testes de integracao entre camadas

Prioridade 3 (executar se P1+P2 passaram):
- Suite completa de testes
- Testes e2e dos fluxos principais
```

### 3. Executar Baseline (Se Nao Existe)
Se nao ha resultado anterior para comparar:
```bash
# Checkout da versao anterior (antes das mudancas)
git stash  # salvar mudancas atuais
git checkout HEAD~5  # voltar para antes das mudancas

# Rodar suite completa
npx vitest run --reporter=json --outputFile=baseline-results.json

# Voltar para a versao atual
git checkout -
git stash pop
```

### 4. Executar Testes na Versao Atual
```bash
# Suite completa com report detalhado
npx vitest run --reporter=json --outputFile=current-results.json

# Coverage para identificar areas nao testadas
npx vitest run --coverage
```

### 5. Comparar Resultados
Analise diferencas entre baseline e atual:
```
Comparacao de resultados:

| Metrica | Baseline | Atual | Status |
|---------|----------|-------|--------|
| Total de testes | 156 | 158 | +2 (novos testes adicionados) |
| Passando | 156 | 155 | -1 REGRESSAO |
| Falhando | 0 | 3 | +3 REGRESSAO |
| Tempo total | 12.3s | 14.8s | +20% (investigar) |
| Cobertura | 82% | 81% | -1% (aceitavel) |

Testes que falharam (nao falhavam antes):
1. src/lib/__tests__/auth-flow.test.ts:45 — "deve redirecionar apos login"
2. src/app/api/__tests__/content.test.ts:78 — "deve retornar 401 sem token"
3. src/hooks/__tests__/use-auth.test.ts:23 — "deve limpar sessao no logout"
```

### 6. Investigar Regressoes
Para cada teste que regrediu:
```
Regressao #1: "deve redirecionar apos login"
- Arquivo: src/lib/__tests__/auth-flow.test.ts:45
- Erro: Expected redirect to '/dashboard', got redirect to '/auth/login'
- Causa provavel: Middleware refatorado mudou a logica de redirect pos-login
- Impacto: Alto — usuarios nao conseguirao acessar o dashboard apos login
- Classificacao: Bug introduzido pela refatoracao

Acao: Corrigir logica de redirect no middleware antes de merge
```

### 7. Testes Manuais Complementares
Para areas criticas sem cobertura automatizada:
```
Checklist de teste manual:

Autenticacao:
- [ ] Login com email/senha funciona
- [ ] Login com Google OAuth funciona
- [ ] Logout limpa sessao completamente
- [ ] Redirect apos login vai para pagina correta
- [ ] Token expirado redireciona para login

Rotas protegidas:
- [ ] /dashboard redireciona para login se nao autenticado
- [ ] /dashboard/admin bloqueia usuarios nao-admin
- [ ] API routes retornam 401 sem token

Fluxos criticos:
- [ ] Gerar conteudo funciona end-to-end
- [ ] Comprar creditos funciona
- [ ] Visualizar historico funciona
```

### 8. Documentar Resultados
```markdown
## Relatorio de Regressao

**Data:** 2024-01-15
**Versao testada:** commit abc1234
**Mudancas testadas:** Refatoracao do servico de autenticacao

### Resumo
- Testes automatizados: 155/158 passando (3 regressoes)
- Testes manuais: 12/12 passando
- Cobertura: 81% (dentro do target)

### Regressoes Encontradas
1. [CRITICO] Redirect pos-login quebrado — correcao necessaria
2. [MEDIO] Teste de API retorna status errado — mock desatualizado
3. [BAIXO] Teste de hook falha por timing — test flaky

### Decisao
- Corrigir regressao #1 antes de merge (blocker)
- Corrigir regressao #2 (mock desatualizado)
- Marcar regressao #3 como flaky para investigar depois

### Aprovacao para Release
[ ] SIM / [x] NAO — Pendente correcao de regressao #1
```

## Criterios de Aceite
- [ ] Areas afetadas mapeadas a partir do diff
- [ ] Suites de teste priorizadas e executadas
- [ ] Resultados comparados com baseline
- [ ] Todas as regressoes investigadas com root cause
- [ ] Testes manuais executados para areas sem cobertura
- [ ] Relatorio documentado com decisao de go/no-go
- [ ] Regressoes criticas corrigidas ou bloqueiam merge

## Entregaveis
- Relatorio de regressao (markdown)
- Resultado dos testes (JSON ou JUnit XML)
- Lista de regressoes com root cause e acao
- Decisao documentada de go/no-go para release

## Verificacao
- [ ] Nenhuma regressao critica pendente
- [ ] Suite completa passando apos correcoes
- [ ] Relatorio revisado por responsavel pela release
- [ ] Testes flaky identificados e marcados (nao bloqueiam)
