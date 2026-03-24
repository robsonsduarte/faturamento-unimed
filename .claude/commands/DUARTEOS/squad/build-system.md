# Squad: Build System — App Factory

Recebe um PRD, workflow N8N, ou URL de referencia e constroi um sistema completo automaticamente.

**Agente lider:** PM (Supreme Orchestrator)
**Agentes envolvidos:** Todos os 13 agentes (7 deliberativos + 6 custom)
**Motor:** GSD completo (new-project → plan → execute → verify)
**Modo:** YOLO — executa tudo automaticamente, so pergunta quando CRITICO

## Descricao

O comando mais poderoso do DuarteOS. Recebe um input (PRD, workflow, ou URL), delega analise ao Architect (NEXUS) que gera blueprint completo, e o PM orquestra a construcao do sistema inteiro com:
- Banco de dados configurado
- Autenticacao (login, registro, middleware)
- API routes completas
- Interface grafica com UX clara e design coerente
- Error handling, loading states, responsivo

## Input aceito

| Tipo | Exemplo | Como funciona |
|------|---------|---------------|
| **PRD** (arquivo) | `build-system PRD.md` | Analisa requisitos, features, regras de negocio |
| **N8N Workflow** (JSON) | `build-system workflow.json` | Extrai nodes, conexoes, transforma em features |
| **URL** (site referencia) | `build-system https://example.com` | Scrape + analise: estrutura, design, features, UX |
| **Texto livre** | `build-system "SaaS de gestao de clinicas"` | Interpreta como briefing verbal |

## Modo YOLO

Este comando opera em YOLO mode por padrao:
- **NAO pergunta** sobre stack (usa defaults inteligentes)
- **NAO pergunta** sobre design (gera paleta coerente automaticamente)
- **NAO pergunta** sobre patterns (segue melhores praticas)
- **SO pergunta** quando:
  1. Input ambiguo que pode gerar 2 sistemas completamente diferentes
  2. Decisao de EXCLUIR feature que estava no input original
  3. Custo significativo (API paga, servico externo obrigatorio)
  4. Seguranca (expor dados sensiveis, permissoes criticas)

## Como funciona

### FASE 0 — INPUT ANALYSIS + BLUEPRINT (PM coordena, NEXUS executa, ~5 min)

PM e PURO orquestrador nesta fase — detecta o tipo de input e DELEGA toda analise tecnica.

```
1. PM detecta tipo de input:
   - Se termina em .md/.txt/.pdf → PRD
   - Se termina em .json e tem "nodes" → N8N workflow
   - Se comeca com http → URL para scraping
   - Senao → texto livre (briefing)

2. PM faz perguntas de esclarecimento SE input for ambiguo (senao, pula)

3. PM SPAWNA NEXUS (Architect) via Task tool para:
   - Analisar o input completo (PRD/N8N/URL/texto)
   - Executar analise especializada:
     - PRD: extrair features, data models, regras de negocio, personas
     - N8N: extrair nodes → mapear para features, trigger → eventos, connections → fluxos
     - URL: scrape → extrair paginas, navegacao, design, cores, features visiveis
     - Texto: inferir dominio, features minimas viaveis, publico
   - Gerar BLUEPRINT.md em .planning/ contendo:
     - Nome do projeto
     - Stack (inferido ou default)
     - Data models (entidades, campos, relacionamentos)
     - Auth requirements (roles, permissoes)
     - Pages/Routes (cada tela com descricao)
     - API endpoints (CRUD + custom)
     - Design (paleta de cores, tipografia, layout)
     - Features (priorizadas: MVP → Nice-to-have)

4. PM SPAWNA SPECTER (Security Auditor) via Task tool para:
   - Review de seguranca do BLUEPRINT.md
   - Identificar dados sensiveis, falhas de auth, riscos de exposicao
   - Retornar report: PASS / WARN (com sugestoes) / BLOCK (com justificativa)

5. PM SPAWNA SHADOW (Devil's Advocate) via Task tool para:
   - Contestar premissas do blueprint
   - Identificar riscos de scope creep, dependencias frageis, complexidade oculta
   - Retornar report: PASS / WARN (com alertas) / BLOCK (com justificativa)

6. PM RECEBE os 3 reports (NEXUS + SPECTER + SHADOW) e DECIDE GO/NO-GO:
   - Se todos PASS/WARN → GO (incorpora sugestoes no blueprint)
   - Se qualquer BLOCK → PM avalia, pode pedir ajuste ao NEXUS ou escalar ao usuario

7. CRIAR TASKS no Redis Task Manager:
   PM usa create_tasks_batch() para criar todas as tasks do projeto
   com dependencias entre elas. Exemplo:

   [
     {"temp_id": "t1", "title": "Database schema", "agent": "backend", "phase": "foundation", "priority": "P1"},
     {"temp_id": "t2", "title": "Auth setup", "agent": "backend", "phase": "foundation", "priority": "P1", "blocked_by": ["t1"]},
     {"temp_id": "t3", "title": "Layout base", "agent": "frontend", "phase": "foundation", "priority": "P1"},
     {"temp_id": "t4", "title": "Auth pages", "agent": "frontend", "phase": "foundation", "priority": "P2", "blocked_by": ["t2", "t3"]},
     {"temp_id": "t5", "title": "CRUD produtos", "agent": "backend", "phase": "features", "priority": "P2", "blocked_by": ["t1"]},
     {"temp_id": "t6", "title": "Pagina produtos", "agent": "frontend", "phase": "features", "priority": "P2", "blocked_by": ["t5", "t3"]}
   ]

   O task manager resolve temp_ids para IDs reais e configura bloqueios automaticamente.
```

### FASE 1 — ARCHITECTURE DECISION (PM decide, NEXUS propoe, ~5 min)

PM NAO define stack, data models, ou auth. O Architect PROPOE, o PM DECIDE.

```
1. PM SPAWNA NEXUS (Architect) via Task tool para:
   - Analisar BLUEPRINT.md e propor 3 opcoes de arquitetura com trade-offs:
     - Opcao A: Conservadora (stack mais simples, menos risco)
     - Opcao B: Equilibrada (melhor custo-beneficio)
     - Opcao C: Ambiciosa (mais features, mais complexidade)
   - Cada opcao deve incluir:
     - Stack final (framework, UI, auth, database, ORM, deploy)
     - Database schema completo (SQL ready)
     - API contract (OpenAPI-like)
     - Component tree (paginas → componentes)
     - Auth strategy
   - NEXUS escreve ARCHITECTURE.md em .planning/ com as 3 opcoes

2. PM SPAWNA SPECTER (Security Auditor) via Task tool para:
   - Validar cada opcao proposta pelo Architect:
     - Schema seguro? (sem dados sensiveis expostos)
     - Auth adequado? (RBAC se multi-role)
     - Input validation planejado?
   - Retornar report de seguranca por opcao

3. PM SPAWNA SHADOW (Devil's Advocate) via Task tool para:
   - Contestar cada opcao (silent mode — so bloqueia se CRITICO)
   - Identificar over-engineering, pontos de falha, dependencias arriscadas

4. PM RECEBE os 3 reports e DECIDE qual opcao:
   - Aprova automaticamente se Opcao B (equilibrada) nao tem bloqueios
   - Se bloqueio critico em todas opcoes → escala ao usuario
   - PM NUNCA define a arquitetura — apenas ESCOLHE entre as opcoes do NEXUS
```

### FASES 2-5 — EXECUCAO BASEADA EM TASKS (auto-execute)

O PM usa o **Redis Task Manager** para orquestrar execucao multi-agente:

```
LOOP DE EXECUCAO:

1. PM chama get_next_tasks() → retorna tasks prontas (pending + sem bloqueios)
   Resultado agrupado por agente:
   {
     "backend": [task_001, task_005],
     "frontend": [task_003],
     "devops": [task_002]
   }

2. PM spawna agentes em PARALELO:
   - Cada agente recebe sua(s) task(s)
   - Agente chama assign_task(id, agent) ao iniciar
   - Agente executa o trabalho
   - Agente chama complete_task(id, resultado) ao concluir

3. complete_task() DESBLOQUEIA dependentes automaticamente:
   - Remove o ID completado do blocked_by dos dependentes
   - Se blocked_by ficou vazio → status muda de "blocked" para "pending"
   - Na proxima iteracao, essas tasks aparecem em get_next_tasks()

4. PM chama get_next_tasks() novamente → proximo wave
5. Repete ate get_next_tasks() retornar vazio E nao haver tasks in_progress

MONITORAMENTO:
- get_project_board()  → visao Kanban com todas tasks por status
- get_phase_status(fase) → progresso % de uma fase
- get_blocked_tasks() → tasks travadas e seus bloqueios
- fail_task(id, erro)  → marca falha, mostra tasks impactadas
```

**Exemplo de execucao multi-agente:**
```
Wave 1 (get_next_tasks retorna t1, t2, t3):
  Backend  → task_001 "Database schema"     (sem bloqueios)
  DevOps   → task_002 "Scaffold projeto"    (sem bloqueios)
  Frontend → task_003 "Layout base"         (sem bloqueios)

  [3 agentes rodam em paralelo]

  complete_task("task_001") → desbloqueia task_004 (Auth setup) e task_007 (CRUD)
  complete_task("task_003") → desbloqueia task_005 (Design system)

Wave 2 (get_next_tasks retorna t4, t5, t7):
  Backend  → task_004 "Auth setup"          (t1 completada)
  Frontend → task_005 "Design system"       (t3 completada)
  Backend  → task_007 "CRUD produtos"       (t1 completada)

  [agentes rodam em paralelo novamente]

Wave 3, 4, ... ate todas completas
```

### VALIDACAO (apos cada wave)

```
- QA: smoke tests das tasks completadas no wave
- Se fail_task() → PM avalia impacto e decide retry ou skip
- Se todas tasks de uma fase estao completas → get_phase_status() confirma 100%
```

### DELIVERY (apos ultimo wave)

```
1. cleanup_completed() — arquiva tasks completadas
2. QA gera relatorio final de verificacao
3. DevOps gera instrucoes de deploy
4. PM gera DELIVERY.md com:
   - O que foi construido
   - Como rodar (dev + prod)
   - Credenciais criadas
   - Proximos passos sugeridos
   - Gaps conhecidos (se houver)
```

## Stack Defaults (quando nao especificado)

| Camada | Default | Alternativas detectaveis |
|--------|---------|-------------------------|
| Framework | Next.js 15 (App Router) | Nuxt, SvelteKit, Remix |
| UI | Tailwind CSS + shadcn/ui | Material UI, Chakra |
| Auth | Supabase Auth | NextAuth, Clerk |
| Database | Supabase (PostgreSQL) | PlanetScale, Neon |
| ORM | Supabase Client | Prisma, Drizzle |
| Deploy | Vercel / VPS | Railway, Fly.io |

## Design Defaults

| Aspecto | Default |
|---------|---------|
| Paleta | Inferida do input. Fallback: slate + emerald accent |
| Tipografia | Inter (sans-serif) |
| Layout | Sidebar + main content |
| Dark mode | Sim (default) |
| Responsivo | Mobile-first |
| Animacoes | Sutis (framer-motion) |

## Flags

- `--stack=nextjs|nuxt|svelte` — forca stack especifica
- `--db=supabase|postgres|mysql` — forca banco
- `--auth=supabase|nextauth|clerk` — forca auth provider
- `--no-auth` — sistema sem autenticacao
- `--verbose` — mostra logs detalhados de cada fase
- `--dry-run` — gera BLUEPRINT.md sem executar (para revisar antes)

## Exemplos

```bash
# A partir de um PRD
/DUARTEOS:squad:build-system docs/PRD.md

# A partir de um workflow N8N
/DUARTEOS:squad:build-system automation/lead-capture.json

# A partir de um site de referencia
/DUARTEOS:squad:build-system https://linear.app

# A partir de um briefing
/DUARTEOS:squad:build-system "Sistema de agendamento para clinicas com painel admin, area do paciente e notificacoes por email"

# Dry run (so gera blueprint)
/DUARTEOS:squad:build-system --dry-run docs/PRD.md

# Stack especifica
/DUARTEOS:squad:build-system --stack=nuxt --db=postgres docs/PRD.md
```

## Output esperado

```
.planning/
  BLUEPRINT.md          — Blueprint completo do sistema
  ARCHITECTURE.md       — Decisoes arquiteturais
  SCHEMA.sql            — Database schema
  DELIVERY.md           — Instrucoes de deploy e uso
  phases/               — Artefatos de cada fase
src/                    — Codigo fonte completo
  app/                  — Pages e routes
  components/           — UI components
  lib/                  — Services e utils
  middleware.ts         — Auth middleware
public/                 — Assets estaticos
```

## Regras YOLO

1. **Assume defaults inteligentes** — nao pergunta o que pode inferir
2. **Feature completa > feature perfeita** — entrega funcional, refina depois
3. **Commit por feature** — atomico e rastreavel
4. **So pergunta quando CRITICO** — ambiguidade, exclusao, custo, seguranca
5. **Design coerente automatico** — paleta + tipografia + layout sem pedir input
6. **Auth incluso por padrao** — login + registro + middleware + RBAC se multi-role
7. **Banco configurado** — schema + seeds + migrations prontos
8. **Pronto pra rodar** — npm run dev funciona ao final
