# Protocolo de Integracao Agente ↔ GSD

**Versao:** 1.2.0
**Status:** Ativo
**Autor:** ATLAS (PM)

---

## Principio

Os agentes DuarteOS sao o **cerebro** (analise, decisao, contexto). O GSD e as **maos** (execucao estruturada, artefatos, rastreabilidade). Nenhum agente executa workflow complexo manualmente quando o GSD pode fazer com garantias.

```
Usuario → Agente (decide) → GSD (executa) → Artefato (.planning/)
```

---

## Modelo de Integracao

### Camadas

```
┌─────────────────────────────────────────┐
│  USUARIO                                │
│  Demanda, feedback, decisoes            │
├─────────────────────────────────────────┤
│  AGENTES (cerebro)                      │
│  PM, Architect, QA, Context, Devil,     │
│  Backend, Frontend, Squad               │
├─────────────────────────────────────────┤
│  GSD ENGINE (maos)                      │
│  new-project, plan-phase, execute-phase │
│  verify-work, debug, quick, etc.        │
├─────────────────────────────────────────┤
│  ARTEFATOS (.planning/)                 │
│  ROADMAP.md, PLAN.md, VERIFICATION.md   │
│  STATE.md, debug/, quick/               │
└─────────────────────────────────────────┘
```

### Regra de Ouro

> Se existe um comando GSD que faz o que o agente precisa → **usar o GSD**.
> Nunca recriar manualmente o que o motor ja oferece com rastreabilidade.

### Integracao OMEGA

Todo subcomando GSD que produz output executavel roda sob o protocolo OMEGA (`.claude/protocols/OMEGA.md`).

**Subcomandos com OMEGA ativo:**
| Subcomando | task_type OMEGA | Threshold |
|------------|----------------|-----------|
| `execute-phase` | implementation | >= 90 |
| `quick` | implementation | >= 90 |
| `verify-work` | validation | >= 95 |
| `plan-phase` | planning | >= 85 |
| `research-phase` | research | >= 80 |
| `map-codebase` | research | >= 80 |
| `audit-milestone` | validation | >= 95 |
| `debug` | implementation | >= 90 |

**Subcomandos SEM OMEGA (informativos):**
- `progress`, `pause-work`, `resume-work`, `check-todos`, `add-todo`

**Regra:** Agentes spawnados por subcomandos GSD DEVEM emitir OMEGA_STATUS block e seguir o loop de refinamento. O subcomando so e considerado concluido quando o dual-gate exit e satisfeito.

---

## Manifests por Agente

### PM (ATLAS) — Lifecycle & Orquestracao

| Comando GSD | Pre-condicao | Guard | Output |
|-------------|-------------|-------|--------|
| `/gsd:new-project` | Demanda com 3+ fases estimadas | Nenhum projeto ativo sem milestone concluido | PROJECT.md, ROADMAP.md |
| `/gsd:new-milestone` | Milestone anterior concluido ou primeiro milestone | Audit aprovado (se nao for primeiro) | ROADMAP.md atualizado |
| `/gsd:progress` | Projeto inicializado (.planning/ existe) | Nenhum | Status visual |
| `/gsd:audit-milestone` | Todas as fases do milestone executadas | Nenhum | Audit report |
| `/gsd:complete-milestone` | Audit aprovado | Verdict != BLOCKED | Milestone arquivado |
| `/gsd:pause-work` | Trabalho em andamento | Nenhum | STATE.md handoff |
| `/gsd:resume-work` | STATE.md com handoff existente | Nenhum | Contexto restaurado |
| `/gsd:add-todo` | Ideia fora do escopo atual | Nenhum | Todo registrado |
| `/gsd:check-todos` | Nenhum | Nenhum | Lista de pendencias |
| `/gsd:add-phase` | Roadmap existente | Nenhum | Fase adicionada ao final |
| `/gsd:insert-phase` | Roadmap existente, urgencia justificada | Nenhum | Fase inserida como decimal |
| `/gsd:remove-phase` | Fase futura (nao iniciada) | Nenhum | Fase removida, renumerada |
| `/DUARTEOS:squad:build-system` | PRD, workflow N8N, URL ou briefing recebido | Nenhum | Sistema completo |

**Autoridade especial:** PM pode invocar qualquer comando GSD se justificado. PM autoriza transicoes entre fases.

---

### Architect (NEXUS) — Estrutura & Planejamento

| Comando GSD | Pre-condicao | Guard | Output |
|-------------|-------------|-------|--------|
| `/gsd:map-codebase` | Antes de refactor grande ou inicio de projeto | Nenhum | 7 docs em .planning/codebase/ |
| `/gsd:plan-phase N` | Fase com 3+ tasks interdependentes | CONTEXT.md existe (ou sera criado) | PLAN.md files |
| `/gsd:research-phase N` | Tech nova ou integracao complexa | Nenhum | RESEARCH.md |
| `/gsd:list-phase-assumptions N` | Antes de planejar (expor premissas) | Nenhum | Lista de assumptions |
| `/gsd:add-phase` | Necessidade estrutural identificada | PM aprovou | Fase adicionada |
| `/gsd:insert-phase` | Dependencia critica descoberta | PM aprovou | Fase inserida |

**Guard critico:** Nunca planejar sem antes mapear codebase (se projeto brownfield).

---

### QA (SENTINEL) — Verificacao & Debug

| Comando GSD | Pre-condicao | Guard | Output |
|-------------|-------------|-------|--------|
| `/gsd:verify-work N` | Fase executada (commits existem) | Nenhum | UAT.md + diagnostico |
| `/gsd:debug "desc"` | Bug persistente (2+ tentativas falharam) | Nenhum | debug/{slug}.md com root cause |
| `/gsd:health` | Suspeita de inconsistencia em .planning/ | Nenhum | Diagnostico de saude |

**Guard critico:** Sempre verificar apos execute-phase. Nunca declarar fase concluida sem verify-work.

**OMEGA Gate (verify-work):** Verificacao roda com threshold de validation (>= 95). O agente verificador deve:
1. Emitir OMEGA_STATUS com evidencias de teste
2. Atingir score >= 95 com completion signals de testes/cobertura
3. Se nao atingir: documentar gaps e escalar

---

### Backend (FORGE) — Execucao Server-Side

| Comando GSD | Pre-condicao | Guard | Output |
|-------------|-------------|-------|--------|
| `/gsd:execute-phase N` | PLAN.md aprovado existe | PM autorizou execucao | Commits atomicos + SUMMARY.md |
| `/gsd:quick "desc"` | Task pequena (1-3 steps) | Nenhum | quick/{NNN}/ |
| `/gsd:quick --full "desc"` | Task pequena que precisa verificacao | Nenhum | quick/{NNN}/ + verificado |

**Guard critico:** Nunca executar sem PLAN.md. Cada task = 1 commit atomico.

**OMEGA Gate (execute-phase):** Cada wave de execucao dentro de uma fase roda sob OMEGA. O agente executor deve:
1. Emitir OMEGA_STATUS ao final de cada wave
2. Atingir score >= 90 (implementation) com >= 2 completion signals
3. Se nao atingir: loop de refinamento (max 3x) antes de avancar
4. Se circuit breaker abrir: escalar ao PM

**OMEGA Gate (quick):** Mesmo tasks rapidas rodam sob OMEGA com threshold de implementation (>= 90). A unica diferenca e que o loop e limitado a 2 iteracoes (em vez de 3) para manter a velocidade.

---

### Frontend (PRISM) — Execucao UI

| Comando GSD | Pre-condicao | Guard | Output |
|-------------|-------------|-------|--------|
| `/gsd:execute-phase N` | PLAN.md de UI aprovado existe | PM autorizou execucao | Commits atomicos + SUMMARY.md |
| `/gsd:quick "desc"` | Ajuste UI pequeno (1-3 steps) | Nenhum | quick/{NNN}/ |
| `/gsd:quick --full "desc"` | Componente que precisa verificacao | Nenhum | quick/{NNN}/ + verificado |

**Guard critico:** Nunca executar sem PLAN.md. Verificar mudancas visuais.

---

### Context Engineer (COMPASS) — Coerencia & Pesquisa

| Comando GSD | Pre-condicao | Guard | Output |
|-------------|-------------|-------|--------|
| `/gsd:discuss-phase N` | SEMPRE antes de planejar fase | Nenhum | CONTEXT.md |
| `/gsd:research-phase N` | Tech nova ou abordagem incerta | Nenhum | RESEARCH.md |
| `/gsd:settings` | Ajuste de profundidade de pesquisa | Nenhum | Config atualizado |

**Guard critico:** SEMPRE executar discuss-phase antes de plan-phase. CONTEXT.md alimenta o planner.

---

### Devil's Advocate (SHADOW) — Contestacao & Red Team

| Comando GSD | Pre-condicao | Guard | Output |
|-------------|-------------|-------|--------|
| `/gsd:list-phase-assumptions N` | SEMPRE antes de aprovar planos | Nenhum | Lista de premissas |
| `/DUARTEOS:squad:validate-plan` | PLAN.md existe para contestar | Nenhum | Verdict: APPROVED/CAVEATS/BLOCKED |

**Guard critico:** Nunca aprovar sem expor assumptions primeiro. Critica sem alternativa e INVALIDA.

---

### Squad (Orquestrador) — Coordenacao Multi-Agente

| Comando GSD | Pre-condicao | Guard | Output |
|-------------|-------------|-------|--------|
| `/DUARTEOS:squad:new-project` | Demanda grande recebida | Nenhum | Roadmap completo |
| `/DUARTEOS:squad:plan-phase N` | Fase do roadmap a planejar | Nenhum | PLAN.md via Architect+Context+Devil |
| `/DUARTEOS:squad:execute-phase N` | PLAN.md aprovados existem | Nenhum | Execucao via Backend+Frontend+QA |
| `/DUARTEOS:squad:verify-work N` | Fase executada | Nenhum | UAT via QA |
| `/DUARTEOS:squad:discuss-phase N` | Antes de planejar | Nenhum | CONTEXT.md via Context Engineer |
| `/DUARTEOS:squad:validate-plan` | PLAN.md existe | Nenhum | Verdict via Devil's Advocate |
| `/DUARTEOS:squad:audit` | Milestone completo | Nenhum | Audit via QA+Context+Devil |
| `/DUARTEOS:squad:quick "desc"` | Task ad-hoc | Nenhum | Execucao rapida |
| `/DUARTEOS:squad:debug "desc"` | Bug persistente | Nenhum | Debug cientifico |
| `/DUARTEOS:squad:progress` | Qualquer momento | Nenhum | Status consolidado |
| `/DUARTEOS:squad:pause` | Sessao encerrando | Nenhum | Handoff salvo |
| `/DUARTEOS:squad:resume` | Nova sessao | Nenhum | Contexto restaurado |
| `/DUARTEOS:squad:build-system` | PRD/N8N/URL recebido | Nenhum | Sistema completo |
| `/DUARTEOS:squad:map-codebase` | Codebase a analisar | Nenhum | 7 docs via Architect |
| `/DUARTEOS:squad:synapse` | Verificar estado dos agentes | Nenhum | Dashboard |

---

## Cadeia de Autorizacao

```
DECISAO DE EXECUCAO:
  Usuario pede algo
  → PM avalia escopo
  → Se escopo < 3 tasks: agente executa via /gsd:quick
  → Se escopo >= 3 tasks: PM inicia workflow formal

WORKFLOW FORMAL:
  PM autoriza → Context discuss → Architect plan → Devil validate
  → PM aprova plano → Backend/Frontend execute → QA verify
  → PM valida conclusao

ESCALACAO (via Escalation Router — OMEGA secao 4: Retry → Vertical → Horizontal → Human):
  Agente bloqueado → reporta ao PM
  PM bloqueado → reporta ao usuario
  Conflito entre agentes → PM decide (decisao final)
```

### Quem Autoriza O Que

| Acao | Autorizador |
|------|-------------|
| Iniciar projeto/milestone | PM |
| Planejar fase | PM (implicitamente ao atribuir) |
| Executar fase | PM (explicitamente) |
| Declarar fase concluida | QA (verify-work passou) + PM (valida) |
| Aprovar plano | Devil's Advocate (verdict != BLOCKED) + PM |
| Completar milestone | PM (apos audit aprovado) |
| Rollback | PM (unica autoridade) |
| Inserir/remover fase | PM |

---

## Workflow Recipes — Fluxos End-to-End

### Recipe 1: Nova Feature (Completa)

```
TRIGGER: Usuario descreve feature
FLUXO:
  1. PM avalia escopo
     → Se grande: /DUARTEOS:squad:new-project ou /gsd:add-phase
     → Se medio: /DUARTEOS:squad:discuss-phase N
  2. Context Engineer: /gsd:discuss-phase N → CONTEXT.md
  3. Architect: /gsd:research-phase N → RESEARCH.md (se tech nova)
  4. Architect: /gsd:plan-phase N → PLAN.md files
  5. Devil's Advocate: /DUARTEOS:squad:validate-plan → Verdict
     → Se BLOCKED: volta para step 4
     → Se CAVEATS: PM decide
  6. Backend/Frontend: /gsd:execute-phase N → commits atomicos
  7. QA: /gsd:verify-work N → UAT.md
     → Se falhou: QA cria fix-plan → volta para step 6
  8. PM: valida e fecha fase
```

### Recipe 2: Bug Fix

```
TRIGGER: Bug reportado
FLUXO:
  1. PM avalia severidade
     → Se critico: /gsd:quick --full "fix: descricao"
     → Se persistente: /gsd:debug "descricao"
  2. QA: /gsd:debug "desc" → root cause identificado
  3. Backend/Frontend: /gsd:quick "fix: descricao" → commit
  4. QA: valida fix
```

### Recipe 3: Refactoring

```
TRIGGER: Divida tecnica identificada ou melhoria estrutural
FLUXO:
  1. PM autoriza refactor
  2. Architect: /gsd:map-codebase → 7 docs de analise
  3. Architect: /gsd:plan-phase N → PLAN.md com mudancas
  4. Devil's Advocate: /gsd:list-phase-assumptions N → riscos
  5. Backend/Frontend: /gsd:execute-phase N → commits atomicos
  6. QA: /gsd:verify-work N → regressao verificada
  7. PM: valida conclusao
```

### Recipe 4: Novo Projeto do Zero

```
TRIGGER: PRD, briefing ou URL recebido
FLUXO:
  1. PM: /DUARTEOS:squad:new-project → roadmap completo
     OU
     PM: /DUARTEOS:squad:build-system → sistema completo (modo YOLO)
  2. Para cada fase do roadmap:
     a. /DUARTEOS:squad:discuss-phase N
     b. /DUARTEOS:squad:plan-phase N
     c. /DUARTEOS:squad:execute-phase N
     d. /DUARTEOS:squad:verify-work N
  3. /DUARTEOS:squad:audit → auditoria final
  4. /gsd:complete-milestone → milestone arquivado
```

### Recipe 5: Sessao de Trabalho (Retomada)

```
TRIGGER: Inicio de nova sessao
FLUXO:
  1. PM: /gsd:resume-work → contexto restaurado
  2. PM: /gsd:progress → status atual
  3. PM decide proximo passo (plan, execute, ou verify)
  4. Ao encerrar: /gsd:pause-work → handoff salvo
```

### Recipe 6: Task Rapida

```
TRIGGER: Pedido simples (1-3 steps)
FLUXO:
  1. PM avalia: cabe em quick?
     → Se sim: agente competente executa /gsd:quick "desc"
     → Se precisa verificacao: /gsd:quick --full "desc"
  2. Pronto. Sem burocracia.
```

---

## Regras de Invocacao

### DEVE invocar GSD quando:
- Task tem 3+ arquivos a modificar → `/gsd:plan-phase` ou `/gsd:execute-phase`
- Bug persistiu apos 2+ tentativas → `/gsd:debug`
- Codebase desconhecido → `/gsd:map-codebase`
- Fase foi executada → `/gsd:verify-work`
- Sessao encerrando com trabalho pendente → `/gsd:pause-work`
- Nova sessao com trabalho anterior → `/gsd:resume-work`
- Projeto novo com 3+ fases → `/gsd:new-project`

### NAO deve invocar GSD quando:
- Task trivial (1 arquivo, mudanca obvia) → agente faz direto
- Pergunta de esclarecimento → agente responde
- Analise sem acao → agente analisa
- Decisao arquitetural simples → agente decide

### Fallback
Se o GSD falhar ou nao se aplicar, o agente pode executar manualmente, mas deve:
1. Documentar por que GSD nao foi usado
2. Manter rastreabilidade equivalente
3. Registrar na memoria do agente

---

## Save-Context — Checkpoint Continuo

Apos cada operacao GSD que muda estado do projeto, o agente responsavel **DEVE** atualizar `.claude/session-context.md` com o estado atual.

### Operacoes que disparam save-context

| Operacao GSD | O que salvar no contexto |
|-------------|-------------------------|
| `new-project` | Milestone criado, roadmap gerado, total de fases |
| `discuss-phase N` | Fase N discutida, decisoes capturadas em CONTEXT.md |
| `plan-phase N` | Fase N planejada, quantidade de PLAN.md criados |
| `execute-phase N` | Fase N executada, commits realizados, resultado |
| `verify-work N` | Fase N verificada, resultado UAT (passou/falhou) |
| `audit-milestone` | Auditoria realizada, verdict |
| `complete-milestone` | Milestone concluido, proximo milestone |
| `debug "desc"` | Debug iniciado/concluido, root cause |
| `quick "desc"` | Task rapida executada, resultado |
| `add-phase` / `insert-phase` / `remove-phase` | Roadmap alterado, nova estrutura de fases |
| `pause-work` | Estado salvo para retomada |
| `resume-work` | Contexto restaurado, proximo passo |

### Formato do checkpoint

Atualizar as seguintes secoes de `.claude/session-context.md`:

```markdown
## Estado Atual
- **Milestone:** [nome/numero]
- **Fase atual:** [N — nome]
- **Status da fase:** [discussing | planning | executing | verifying | completed]
- **Ultima operacao:** [operacao GSD + data/hora]
- **Proximo passo:** [o que deve acontecer agora]
- **Bloqueios:** [nenhum | descricao]

## Artefatos Ativos
- **ROADMAP.md:** [existe | —]
- **PLAN.md ativos:** [lista dos PLAN.md da fase atual]
- **CONTEXT.md:** [existe | —]
- **VERIFICATION.md:** [existe | —]

## Decisoes Recentes
- [data] descricao da decisao
```

### Regras

- **OBRIGATORIO:** Todo agente que executa operacao da tabela acima DEVE salvar contexto
- **AUTOMATICO:** Nao depende do usuario pedir — e pos-acao implicita
- **INCREMENTAL:** Atualizar apenas as secoes relevantes, nao reescrever tudo
- **CONCISO:** Cada entrada no maximo 1-2 linhas. Estado, nao narrativa
- O save-context substitui o `pause-work` para checkpoints intermediarios — `pause-work` continua existindo para handoffs completos entre sessoes

---

## Synapse — Estado dos Agentes

Cada agente atualiza seu estado Synapse (`.claude/synapse/{agent}.yaml`) ao invocar GSD:

| Transicao | Estado Synapse |
|-----------|---------------|
| Agente ativado | `activated` |
| Invocou discuss/research | `analyzing` |
| Invocou plan-phase | `planning` |
| Invocou execute-phase/quick | `executing` |
| Invocou verify-work/audit | `reviewing` |
| Aguardando outro agente | `blocked` |
| Fase concluida | `completed` |

---

## Versionamento

| Versao | Data | Mudanca |
|--------|------|---------|
| 1.0.0 | 2026-02-24 | Protocolo inicial — manifests, cadeia de autorizacao, recipes |
| 1.1.0 | 2026-02-24 | Adicionado save-context — checkpoint continuo apos operacoes GSD |
| 1.2.0 | 2026-03-02 | Integracao OMEGA — quality gates com dual-gate exit em subcomandos GSD |
