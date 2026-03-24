# Protocolo OMEGA — Motor de Qualidade Continua

**Versao:** 1.1.0
**Status:** Ativo
**Autor:** NEXUS (Architect)
**Dependencias:** CONSTITUTION.md, AGENT-GSD-PROTOCOL.md, QUALITY-GATES.md, SYNAPSE.md

---

## Definicao

OMEGA e o controle de qualidade continuo que roda em background em TODA task de QUALQUER agente, forcando um loop de refinamento ate atingir o threshold ou escalar ao humano ou a outro agente para continuacao da task — que pode ser executada por um ou mais agentes de forma horizontal (paralela) ou vertical (sequencial).

OMEGA nao e um agente. OMEGA e um protocolo que envolve a execucao de todos os agentes. Todo output de todo agente passa pelo crivo OMEGA antes de ser considerado finalizado.

---

## Principios Fundamentais

1. **Nenhuma task e concluida sem validacao OMEGA.** Nao importa o agente, nao importa a complexidade — o loop roda.
2. **Evidencia sobre auto-relato.** Scores de qualidade sao calculados com base em evidencias verificaveis, nao na afirmacao do agente de que "esta bom".
3. **Escalacao e normal, nao falha.** Escalar ao humano ou a outro agente e o comportamento correto quando o threshold nao e atingido. Nao e erro.
4. **Contexto fresco por iteracao.** Cada iteracao do loop de refinamento opera com contexto revisado, evitando vieses de ancoragem.
5. **Transparencia total.** Todo score, toda decisao, toda escalacao e registrada em log append-only.

---

## 1. OMEGA Core Loop

### Algoritmo Principal

```
// OMEGA_LIFECYCLE: wrapper que adiciona PRE-EXEC e POST-EXEC ao loop.
// Ver Secao 11 para detalhes completos do Task Lifecycle Protocol.
OMEGA_LIFECYCLE(task, agent):
  // PRE-EXEC (Secao 11.1)
  task_dir = create_task_artifacts(task, agent)  // TASK.md + CHECKLIST.md em .planning/tasks/
  update_task_status(task_dir, "in_progress")

  // OMEGA LOOP (abaixo)
  result = OMEGA_LOOP(task, agent)

  // POST-EXEC (Secao 11.3)
  mark_checklist(task_dir, result)              // [x] para itens cumpridos
  update_task_result(task_dir, result)           // ## Resultado no TASK.md
  save_to_memory(task_dir, result)               // session-context.md + HISTORY.md
  IF result.status == COMPLETED:
    cleanup_task_dir(task_dir)                   // Deletar dir (HISTORY permanece)

// OMEGA_LOOP: core loop de qualidade (3 iteracoes max).
```

```
OMEGA_LOOP(task, agent):
  iteration = 0
  max_iterations = 3
  status = RUNNING

  // Nota: max_iterations = 3 e o padrao. Ver excecao abaixo para /gsd:quick.

  WHILE iteration < max_iterations AND status == RUNNING:
    iteration += 1

    // 1. Agente executa a task
    output = agent.execute(task)

    // 2. Agente emite OMEGA_STATUS block
    omega_status = agent.emit_omega_status(output)

    // 3. Calcular score baseado em evidencias
    score = evaluate_evidence(output, task.type)

    // 4. Registrar no progress log
    append_progress(task, iteration, score, omega_status)

    // 5. Verificar exit conditions (dual-gate)
    IF dual_gate_met(omega_status, score, task.type):
      status = COMPLETED
      BREAK

    // 6. Verificar circuit breaker
    IF circuit_breaker.state == OPEN:
      status = CIRCUIT_OPEN
      BREAK

    // 7. Feedback para proxima iteracao
    feedback = generate_refinement_feedback(output, score, task.type)
    task.context = task.context + feedback

  // 8. Pos-loop: decidir destino
  IF status == COMPLETED:
    finalize(task, output, score)
  ELSE:
    escalate(task, iteration, score)
```

> **Excecao:** O subcomando `/gsd:quick` usa `max_iterations = 2` para manter velocidade. Ver `AGENT-GSD-PROTOCOL.md` para detalhes.

### Como OMEGA Envolve Toda Execucao

OMEGA nao e invocado separadamente. Ele e o wrapper implicito de toda task delegada por ATLAS (PM) ou executada por qualquer agente. O fluxo real e:

```
┌──────────────────────────────────────────────────────────┐
│  ATLAS delega task ao agente                             │
│    │                                                     │
│    ▼                                                     │
│  ┌─────────────────────────────────────────────────────┐ │
│  │  OMEGA LOOP                                         │ │
│  │                                                     │ │
│  │  Iteracao 1: Agente executa → Score → Threshold?    │ │
│  │    │ NAO                                   │ SIM    │ │
│  │    ▼                                       ▼        │ │
│  │  Iteracao 2: Feedback → Re-executa → Score → ?      │ │
│  │    │ NAO                              │ SIM         │ │
│  │    ▼                                  ▼             │ │
│  │  Iteracao 3: Feedback → Re-executa → Score → ?      │ │
│  │    │ NAO                              │ SIM         │ │
│  │    ▼                                  ▼             │ │
│  │  ESCALACAO                        COMPLETED         │ │
│  └─────────────────────────────────────────────────────┘ │
│    │                                     │               │
│    ▼                                     ▼               │
│  Router de Escalacao              Output finalizado      │
└──────────────────────────────────────────────────────────┘
```

### OMEGA_STATUS Block

Todo agente DEVE emitir um bloco OMEGA_STATUS no final de TODA resposta que envolva execucao de task. Este bloco e o contrato entre o agente e o protocolo OMEGA.

Formato obrigatorio:

```
<!-- OMEGA_STATUS
agent: {CODENAME}
task: {descricao curta da task}
iteration: {N de max_iterations}
task_type: {research | planning | implementation | validation | mind_clone | mind_update}
score: {0-100}
evidence:
  - {evidencia 1: o que foi verificado e resultado}
  - {evidencia 2: o que foi verificado e resultado}
  - {evidencia N}
completion_signals:
  - {sinal 1: tests_pass | lint_clean | types_check | files_created | coverage_met | ...}
  - {sinal 2}
exit_signal: {true | false}
blockers:
  - {bloqueio 1, se houver}
delta:
  files_modified: {N}
  files_created: {N}
  git_sha_before: {sha}
  git_sha_after: {sha}
  tests_added: {N}
  tests_passing: {N}/{total}
notes: {observacoes relevantes}
-->
```

> **Valores default:** Quando `git_sha_before`/`git_sha_after` nao estao disponiveis (codigo nao commitado), use `"uncommitted"`. Quando `tests_added`/`tests_passing` nao se aplicam (task sem testes), use `"N/A"`.

Regras do OMEGA_STATUS:
- **Obrigatorio** em toda resposta de execucao. Omitir o bloco e violacao do protocolo.
- **Posicao:** sempre no final da resposta, apos todo o conteudo.
- **Score deve ser justificado** pelas evidencias listadas. Score sem evidencia = 0.
- **exit_signal** so pode ser `true` se o agente genuinamente acredita que a task esta concluida.
- **Formato HTML comment** para nao poluir output visivel, mas ser parseavel.

### Dual-Gate Exit (Condicao de Saida)

Para uma task ser considerada COMPLETA, ambos os gates devem ser satisfeitos simultaneamente:

**Gate 1 — Score Threshold:**
O score calculado por evidencias deve atingir ou superar o threshold do tipo de task (ver secao 2).

**Gate 2 — Completion Signals:**
Pelo menos 2 sinais de completude devem estar presentes no `completion_signals`, E o campo `exit_signal` deve ser `true`.

Sinais de completude validos:

| Sinal | Descricao | Verificacao |
|-------|-----------|-------------|
| `tests_pass` | Todos os testes passam | `npm test` ou equivalente |
| `lint_clean` | Zero erros de linter | `eslint` / `biome` |
| `types_check` | TypeScript compila sem erros | `tsc --noEmit` |
| `files_created` | Arquivos esperados existem | Verificacao de filesystem |
| `coverage_met` | Cobertura de testes atinge threshold | Coverage report |
| `build_success` | Build completa sem erros | `npm run build` |
| `no_regressions` | Testes existentes continuam passando | Test suite completa |
| `docs_updated` | Documentacao atualizada conforme mudancas | Verificacao manual |
| `schema_valid` | YAML/JSON valida contra schema | Validador |
| `fidelity_check` | Fidelidade do mind clone verificada | Protocolo MMOS |
| `security_clear` | Sem vulnerabilidades introduzidas | Security gate |
| `incremental_edit` | Apenas trechos necessarios foram editados | Diff analysis |

Logica de saida:

```
dual_gate_met(omega_status, score, task_type):
  gate_1 = score >= THRESHOLDS[task_type]
  gate_2 = len(omega_status.completion_signals) >= 2
           AND omega_status.exit_signal == true
  RETURN gate_1 AND gate_2
```

Se Gate 1 passa mas Gate 2 falha: agente deve listar sinais faltantes e tentar obte-los.
Se Gate 2 passa mas Gate 1 falha: agente deve identificar evidencias faltantes para aumentar score.
Se ambos falham: proxima iteracao com feedback especifico.

---

## 2. Quality Gates — Thresholds por Tipo de Task

### Tabela de Thresholds

| Tipo de Task | Threshold Minimo | Descricao | Exemplos |
|-------------|-----------------|-----------|----------|
| `research` | 80 | Pesquisa, analise, mapeamento | map-codebase, discuss-phase, research-phase |
| `planning` | 85 | Planejamento, design, arquitetura | plan-phase, new-project, roadmap |
| `implementation` | 90 | Codigo, configs, infraestrutura | execute-phase, quick, bug fix |
| `validation` | 95 | Testes, QA, auditoria, verificacao | verify-work, audit, code review |
| `mind_clone` | 95 | Clonagem mental, DNA, dossies | clone-mind, mind-update, dossie |
| `mind_update` | 95 | Atualizacao incremental de DNA Synapse | mind-update, clone-mind --update |

### Calculo de Score por Evidencia

O score NAO e auto-declarado pelo agente. E calculado com base em evidencias verificaveis. Cada tipo de task tem um checklist de evidencias com peso.

> **Nota:** Os criterios e pesos abaixo sao referencia. A **fonte de verdade** para cada task_type e o arquivo de checklist correspondente em `.claude/omega/checklists/{task_type}.md`. Em caso de divergencia, o checklist prevalece.

#### Research (threshold: 80)

| Evidencia | Peso | Criterio |
|-----------|------|----------|
| Fontes consultadas (>= 3) | 20 | Multiplas fontes verificaveis |
| Cobertura do escopo pedido | 25 | Todos os topicos solicitados foram cobertos |
| Profundidade da analise | 20 | Nao superficial, com detalhes acionaveis |
| Alternativas consideradas | 15 | Nao apenas a primeira opcao |
| Trade-offs documentados | 10 | Pros/cons explicitados |
| Formato estruturado | 10 | Markdown limpo, secoes claras |

#### Planning (threshold: 85)

| Evidencia | Peso | Criterio |
|-----------|------|----------|
| Tasks decompostas e atomicas | 20 | Cada task e independente e executavel |
| Dependencias mapeadas | 15 | Ordem de execucao clara |
| Riscos identificados | 15 | Pelo menos 3 riscos com mitigacao |
| Criterios de sucesso definidos | 15 | Como saber que esta pronto |
| Estimativa de complexidade | 10 | Score 1-10 por task |
| Artefatos de saida listados | 10 | Quais arquivos serao criados/modificados |
| Validacao do Devil's Advocate | 15 | SHADOW revisou e aprovou |

#### Implementation (threshold: 90)

| Evidencia | Peso | Criterio |
|-----------|------|----------|
| Testes passam (`npm test`) | 20 | Exit code 0 |
| TypeScript compila (`tsc --noEmit`) | 15 | Zero erros |
| Lint limpo | 10 | Zero erros (warnings aceitaveis) |
| Desenvolvimento incremental | 15 | Edit > Write, trechos > arquivos inteiros |
| Commits atomicos | 10 | 1 mudanca logica por commit |
| Sem regressoes | 15 | Testes existentes nao quebraram |
| Cobertura de testes para codigo novo | 15 | Funcoes novas tem testes |

#### Validation (threshold: 95)

| Evidencia | Peso | Criterio |
|-----------|------|----------|
| Todos os testes executados | 20 | Nenhum skip, nenhum todo |
| Cobertura >= threshold do projeto | 15 | Conforme project.yaml |
| Cenarios de borda testados | 15 | Null, empty, overflow, concurrent |
| Regressao verificada | 15 | Suite completa passou |
| Security scan limpo | 10 | Sem vulnerabilidades novas |
| Performance baseline mantida | 10 | Sem degradacao significativa |
| Artefato de verificacao gerado | 15 | VERIFICATION.md ou UAT.md |

#### Mind Clone (threshold: 95)

| Evidencia | Peso | Criterio |
|-----------|------|----------|
| 6 camadas DNA preenchidas | 15 | Filosofia, Frameworks, Heuristicas, Metodologias, Dilemas, Paradoxos |
| Fontes rastreadas (source_path) | 15 | Cada insight com origem verificavel |
| >= 2 paradoxos com >= 3 fontes | 15 | Triangulacao conforme protocolo MMOS |
| YAML valido e schema-compliant | 10 | Parseia sem erro |
| Fidelidade de voz verificada | 15 | Output soa como a pessoa real |
| Consistencia interna | 10 | Sem contradicoes nao-documentadas |
| Incrementalidade respeitada | 10 | DNA existente nao foi sobrescrito |
| Log de ingestao registrado | 10 | Entrada em ingestion/ criada |

### Regras de Scoring

1. **Score = soma dos pesos das evidencias CUMPRIDAS.** Evidencia nao verificavel = 0 pontos.
2. **Evidencia parcial = metade do peso.** Ex: 3 de 5 testes passam = metade do peso de "testes passam".
3. **Evidencia fabricada = violacao constitucional.** Artigo 3.1 — nenhum output enganoso.
4. **Agente pode contestar score** na proxima iteracao com novas evidencias.
5. **Score de iteracao anterior nao se acumula.** Cada iteracao e avaliada independentemente.

---

## 3. Circuit Breaker

### Modelo de 3 Estados

O circuit breaker protege contra loops infinitos, thrashing (mesma mudanca indo e voltando) e desperdicio de recursos. Opera com 3 estados:

```
                   2 no-progress consecutivos
  ┌────────┐  ─────────────────────────────────→  ┌─────────────┐
  │ CLOSED │                                       │  HALF_OPEN  │
  │ (normal)│  ←─────────────────────────────────  │ (cautela)   │
  └────────┘     progresso detectado               └─────────────┘
                                                          │
                                              3 no-progress total
                                              OU 5 same-error
                                                          │
                                                          ▼
                                                   ┌──────────┐
                                                   │   OPEN   │
                                                   │ (parado) │
                                                   └──────────┘
                                                          │
                                                   30min cooldown
                                                          │
                                                          ▼
                                                   ┌─────────────┐
                                                   │  HALF_OPEN  │
                                                   │ (re-tentativa)│
                                                   └─────────────┘
```

### Definicoes

**No-progress:** Uma iteracao onde:
- O score nao aumentou em relacao a iteracao anterior
- Nenhum arquivo foi modificado (delta.files_modified == 0)
- O git SHA nao mudou (delta.git_sha_before == delta.git_sha_after)

**Same-error:** O mesmo erro aparece em 2+ iteracoes consecutivas (mesma mensagem, mesmo arquivo, mesma linha).

**Thrashing:** Alternar entre dois estados sem convergir. Detectado quando iteracao N desfaz o que iteracao N-1 fez.

### Transicoes

| De | Para | Condicao | Acao |
|----|------|----------|------|
| CLOSED | HALF_OPEN | 2 iteracoes consecutivas sem progresso | Log warning. Proximo iteration e a ultima chance. |
| HALF_OPEN | CLOSED | Progresso detectado na proxima iteracao | Reset contador. Continua normalmente. |
| HALF_OPEN | OPEN | 3 no-progress total OU 5 same-error OU thrashing detectado | PARA execucao. Escala imediatamente. |
| OPEN | HALF_OPEN | 30 minutos de cooldown transcorridos | Permite UMA nova tentativa. |

### Persistencia de Estado

O estado do circuit breaker e persistido em `.claude/omega/state.json`:

```json
{
  "circuit_breaker": {
    "state": "CLOSED",
    "no_progress_count": 0,
    "same_error_count": 0,
    "same_error_signature": null,
    "last_transition": "2026-03-02T14:30:00Z",
    "cooldown_until": null,
    "history": [
      {
        "from": "CLOSED",
        "to": "HALF_OPEN",
        "at": "2026-03-02T14:25:00Z",
        "reason": "2 consecutive no-progress on task: implement auth middleware",
        "task_id": "auth-middleware-001"
      }
    ]
  }
}
```

### 13 Condicoes de Terminacao

Alem do circuit breaker, OMEGA encerra o loop se qualquer destas condicoes for verdadeira:

| # | Condicao | Tipo | Acao |
|---|---------|------|------|
| 1 | Score >= threshold | Sucesso | Finalizar task |
| 2 | Max iterations atingido (3) | Limite | Escalar |
| 3 | Circuit breaker OPEN | Protecao | Escalar com cooldown |
| 4 | Stale loop (mesmo output 2x) | Thrashing | Escalar com diagnostico |
| 5 | Same error 5x | Bug sistematico | Escalar a agente diferente |
| 6 | Violacao constitucional detectada | Seguranca | PARAR. Reportar a ATLAS. |
| 7 | Context utilization >= 75% | Recurso | Auto-checkpoint e escalar |
| 8 | Dependencia externa bloqueante | Bloqueio | Marcar blocked, notificar PM |
| 9 | Agente reporta impossibilidade | Honestidade | Escalar com justificativa |
| 10 | Rate limit atingido (100 calls/hora) | Protecao | Cooldown automatico |
| 11 | Conflito entre agentes | Deadlock | PM (ATLAS) arbitra |
| 12 | Task cancelada pelo usuario | Manual | Abort limpo com log |
| 13 | Custo acumulado excede budget | Recurso | Parar, reportar ao usuario |

> **Nota sobre `/gsd:quick`:** Com `max_iterations = 2`, o circuit breaker nao atinge estado OPEN durante execucao de tasks quick. A protecao contra loops travados neste subcomando e o proprio limite de iteracoes, nao o circuit breaker.

---

## 4. Escalation Router

### Fluxo de Escalacao

Quando OMEGA determina que o agente atual nao consegue atingir o threshold, a escalacao segue 4 niveis progressivos:

```
Nivel 1: RETRY (mesma agent, nova iteracao)
  │ falhou apos 3 iteracoes
  ▼
Nivel 2: VERTICAL (outro agente assume)
  │ outro agente tambem nao resolve
  ▼
Nivel 3: HORIZONTAL (multiplos agentes em paralelo)
  │ nenhum agente resolve
  ▼
Nivel 4: HUMAN (usuario decide)
```

### Nivel 1 — Retry (Mesma Agente)

- **Quando:** Iteracoes 1, 2 e 3 do OMEGA loop
- **O que acontece:** O agente recebe feedback especifico sobre o que falta para atingir o threshold
- **Contexto:** Cada iteracao recebe o delta entre score atual e threshold, mais as evidencias faltantes
- **Principio:** Contexto fresco — cada iteracao revisa o output anterior, nao opera cegamente

Formato do feedback injetado:

```
OMEGA_FEEDBACK (Iteracao {N}/{max}):
- Score atual: {score}/{threshold}
- Evidencias faltantes:
  - {evidencia}: {o que falta}
- Completion signals faltantes:
  - {sinal}: {como obter}
- Recomendacao: {acao especifica}
```

### Nivel 2 — Vertical (Outro Agente Assume)

- **Quando:** Apos 3 iteracoes sem atingir threshold
- **Quem decide:** ATLAS (PM) escolhe o agente substituto baseado na natureza do gap
- **Handoff:** O novo agente recebe: task original + output das 3 iteracoes + scores + feedback OMEGA
- **Principio:** Fresh reviewer — o novo agente nao tem ancoragem no trabalho anterior

Tabela de routing vertical:

| Gap Identificado | Agente Substituto | Justificativa |
|-----------------|-------------------|---------------|
| Arquitetura inadequada | NEXUS (Architect) | Redesign necessario |
| Implementacao com bugs | FORGE / PRISM | Especialista no dominio |
| Testes insuficientes | SENTINEL (QA) | Foco em validacao |
| Contexto faltante | COMPASS (Context) | Pesquisa adicional |
| Vulnerabilidade encontrada | SPECTER (Security) | Auditoria especializada |
| Problema fullstack | BRIDGE (Fullstack) | Visao end-to-end |
| Problema de infra | VAULT (DevOps) | Especialista ops |
| Fidelidade de clone baixa | COMPASS + mind-clone v2 | Re-ingestao com mais fontes |

### Nivel 3 — Horizontal (Multiplos Agentes em Paralelo)

- **Quando:** Agente substituto (nivel 2) tambem nao atinge threshold apos 3 iteracoes
- **O que acontece:** ATLAS spawna 2-3 agentes em paralelo, cada um com abordagem diferente
- **Resultado:** ATLAS compara outputs e seleciona o melhor (ou combina)
- **Limite:** Maximo 3 agentes em paralelo para nao fragmentar contexto

Cenarios tipicos de escalacao horizontal:

| Cenario | Agentes Paralelos | Abordagem |
|---------|-------------------|-----------|
| Bug complexo | FORGE + SENTINEL + NEXUS | FORGE: fix direto, SENTINEL: debug cientifico, NEXUS: refactor |
| Feature fullstack | FORGE + PRISM + BRIDGE | Backend + Frontend + Integracao |
| Design review | NEXUS + SHADOW + COMPASS | Arquitetura + Contestacao + Contexto |
| Mind clone complexo | COMPASS + LENS + agente-dominio | Contexto + Dados + Especialista |

### Nivel 4 — Human (Usuario Decide)

- **Quando:** Niveis 1-3 falharam, OU circuit breaker esta OPEN, OU custo excede budget
- **O que o usuario recebe:**

```
OMEGA ESCALACAO — Decisao Necessaria

Task: {descricao}
Agente(s) que tentaram: {lista}
Iteracoes totais: {N}
Melhor score atingido: {score}/{threshold}

Evidencias obtidas:
  [x] {evidencia cumprida}
  [ ] {evidencia faltante}

Gap principal: {o que impede atingir threshold}

Opcoes:
  1. ACCEPT  — aceitar output atual como esta (score {score})
  2. CONTINUE — mais {N} iteracoes com agente {sugestao}
  3. CANCEL  — cancelar task, registrar como incompleta
  4. ADJUST  — ajustar threshold ou escopo da task
```

### Tabela de Decisao de Escalacao

| Condicao | Acao |
|----------|------|
| Score < threshold E iteracao < 3 | Retry (Nivel 1) |
| Score < threshold E iteracao == 3 | Vertical (Nivel 2) |
| Vertical falhou | Horizontal (Nivel 3) |
| Horizontal falhou | Human (Nivel 4) |
| Circuit breaker OPEN | Human (Nivel 4) |
| Violacao constitucional | STOP + Human |
| Context >= 75% | Auto-checkpoint + continuar em nova sessao |
| Rate limit | Cooldown 15min + retry |
| Conflito entre agentes | PM arbitra |

---

## 5. Agent Signature

### Assinatura Obrigatoria

Todo output que modifica estado do projeto (codigo, config, docs, artefatos) DEVE incluir uma assinatura do agente responsavel. A assinatura permite rastrear quem fez o que em caso de falha.

Formato da assinatura:

```
<!-- OMEGA_SIGNATURE
agent: {CODENAME}
role: {PM | Architect | Backend | Frontend | QA | Context | Devil | SystemBuilder | ...}
task: {descricao curta}
timestamp: {ISO 8601}
omega_iteration: {N}
omega_score: {score}
git_sha: {sha do commit, se aplicavel}
-->
```

### Onde a Assinatura Aparece

| Tipo de Output | Onde Assinar |
|----------------|-------------|
| Commit de codigo | Mensagem do commit (Co-Authored-By + OMEGA metadata) |
| Artefato .planning/ | Header do arquivo markdown |
| YAML (Synapse, DNA) | Campo `last_modified_by` no YAML |
| Resposta ao usuario | OMEGA_STATUS block (que ja contem agent) |
| Decisao arquitetural | ADR ou comentario no codigo |

### Regras de Assinatura

1. **Nao falsificar.** Cada agente assina apenas seu proprio trabalho. Nunca assinar em nome de outro.
2. **Nao omitir.** Ausencia de assinatura em artefato e violacao do protocolo OMEGA.
3. **Imutavel apos assinatura.** Se o artefato precisa ser modificado, nova assinatura e adicionada (nao substituida).
4. **Cadeia de custodia.** Para tasks que passaram por escalacao, todas as assinaturas da cadeia sao preservadas.

### Rastreabilidade de Falhas

Quando um bug ou problema e encontrado, a cadeia de rastreabilidade e:

```
Bug detectado
  → git blame: qual commit introduziu
    → OMEGA_SIGNATURE no commit: qual agente
      → OMEGA progress.log: qual task, qual iteracao, qual score
        → OMEGA_STATUS: quais evidencias foram checadas
          → Root cause: qual evidencia falhou ou foi insuficiente
```

---

## 6. Progress Tracking

### Git SHA Comparison

A cada iteracao, OMEGA compara o estado do repositorio para determinar se houve progresso real:

```
progress_detected(before, after):
  // Progresso em codigo
  sha_changed = before.git_sha != after.git_sha

  // Progresso em arquivos
  files_changed = after.files_modified > 0 OR after.files_created > 0

  // Progresso em score
  score_improved = after.score > before.score

  // Qualquer uma indica progresso
  RETURN sha_changed OR files_changed OR score_improved
```

### Metricas Rastreadas

| Metrica | Como Medir | Onde Registrar |
|---------|-----------|----------------|
| Git SHA antes/depois | `git rev-parse HEAD` | OMEGA_STATUS.delta |
| Arquivos modificados | `git diff --stat` | OMEGA_STATUS.delta |
| Arquivos criados | `git status --short` | OMEGA_STATUS.delta |
| Testes adicionados | Contagem de `it()` / `test()` / `describe()` | OMEGA_STATUS.delta |
| Testes passando | `npm test` exit code + contagem | OMEGA_STATUS.delta |
| Score por iteracao | Calculo de evidencias | progress.log |
| Tempo por iteracao | Timestamp inicio/fim | progress.log |
| Custo estimado por iteracao | Modelo usado + tokens estimados | progress.log |

### Cumulative Progress Log

Arquivo: `.claude/omega/progress.log`

Este arquivo e **append-only** — nunca editado, apenas adicionado. Cada entrada segue o formato:

```
=== OMEGA ENTRY ===
timestamp: 2026-03-02T14:30:00Z
task: implement auth middleware
task_type: implementation
agent: FORGE
iteration: 2/3
score: 78/90
circuit_breaker: CLOSED
git_sha: abc1234 → def5678
files_modified: 3
files_created: 1
tests_added: 5
tests_passing: 12/12
completion_signals: [tests_pass, types_check]
exit_signal: false
feedback: "Faltam evidencias: lint_clean (2 warnings), coverage_met (novo codigo sem teste para edge case null input)"
escalation: none
duration_seconds: 45
=== END ENTRY ===
```

### Regras do Progress Log

1. **Append-only.** Nunca editar ou deletar entradas anteriores.
2. **Uma entrada por iteracao.** Cada passagem pelo OMEGA loop gera exatamente uma entrada.
3. **Entradas de escalacao.** Quando escalacao ocorre, uma entrada adicional e registrada com `escalation: {nivel}`.
4. **Rotacao.** Quando o arquivo exceder 10.000 linhas, mover para `progress.log.{timestamp}` e iniciar novo.
5. **Leitura pelo PM.** ATLAS pode consultar o progress log para diagnosticar gargalos e patterns.

---

## 7. Backpressure

### Conceito

Backpressure e o mecanismo que impede uma task de avancar quando pre-condicoes nao foram cumpridas. No OMEGA, backpressure opera como transformacao de eventos: um sinal de "done" e convertido em "blocked" se evidencias faltam.

```
Evento original:    task.done
Verificacao OMEGA:  evidencias insuficientes
Evento transformado: task.blocked (reason: "testes nao passam")
```

### Gates Bloqueantes

Estes gates DEVEM passar antes que uma task de implementacao seja considerada concluida. Nao ha excecao.

| Gate | Verificacao | Comando | Bloqueante |
|------|-----------|---------|------------|
| TypeScript Compilation | Zero erros de tipo | `tsc --noEmit` | SIM |
| Lint | Zero erros (warnings aceitaveis) | `eslint .` / `biome check .` | SIM |
| Tests Pass | Todos os testes passam | `npm test` | SIM |
| No Regressions | Testes existentes nao quebraram | Comparacao com test suite anterior | SIM |
| YAML Validation | Arquivos YAML sao validos | Parser YAML sem erros | SIM (para mind clones) |
| Incremental Edit | Usou Edit, nao Write para existentes | Diff analysis | SIM |

### Gates de Aviso (nao-bloqueantes)

| Gate | Verificacao | Comando | Bloqueante |
|------|-----------|---------|------------|
| Coverage | Cobertura acima do threshold | Coverage report | NAO (aviso) |
| Bundle Size | Build dentro do limite | Build + size check | NAO (aviso) |
| Docs | Documentacao atualizada | Verificacao manual | NAO (aviso) |
| Architecture | Arquivos nos diretorios corretos | Path analysis | NAO (aviso) |

### Integracao com Quality Gates Existentes

OMEGA respeita e complementa o pipeline de 9 Quality Gates definido em `QUALITY-GATES.md`. A relacao e:

| Quality Gate | OMEGA Role |
|-------------|-----------|
| Gate 1 (Security) | OMEGA bloqueia se security gate falha |
| Gate 2 (Auto-Lint) | OMEGA conta lint_clean como completion signal |
| Gate 3 (Architecture) | OMEGA registra warnings no progress log |
| Gate 4 (Pre-Commit) | OMEGA valida antes de permitir exit_signal |
| Gate 5 (Coverage) | OMEGA usa coverage como evidencia de scoring |
| Gate 6 (Docs) | OMEGA registra como aviso, nao bloqueia |
| Gate 7 (Dependency) | OMEGA bloqueia se vulnerabilidades criticas |
| Gate 8 (Bundle Size) | OMEGA registra como aviso |
| Gate 9 (Session Memory) | OMEGA usa para auto-checkpoint |

### Event Transformation (Backpressure como Eventos)

Quando um agente declara uma task como concluida, OMEGA transforma o evento baseado nas evidencias:

| Evento Original | Condicao | Evento Transformado |
|----------------|----------|-------------------|
| `task.done` | Score >= threshold E dual-gate met | `task.completed` (aceito) |
| `task.done` | Score < threshold | `task.needs_refinement` (volta ao loop) |
| `task.done` | Gate bloqueante falha | `task.blocked` (backpressure) |
| `task.done` | Circuit breaker OPEN | `task.escalated` (router de escalacao) |
| `build.done` | Testes nao passam | `build.blocked` (backpressure) |
| `review.done` | Evidencias insuficientes | `review.incomplete` (mais verificacao) |

### YAML Validation para Mind Clones

Para tasks do tipo `mind_clone`, OMEGA aplica validacoes especificas nos artefatos YAML:

| Validacao | Criterio | Acao se Falhar |
|-----------|----------|----------------|
| YAML parseia sem erro | Parser nao retorna erro | Bloqueante — corrigir sintaxe |
| Campos obrigatorios presentes | identity, camadas 1-6, metadata | Bloqueante — preencher campos |
| source_path em cada insight | Rastreabilidade presente | Bloqueante — adicionar fonte |
| versao_dna incrementada | versao_dna_depois > versao_dna_antes | Bloqueante — incrementar |
| Minimo 2 paradoxos (camada 6) | len(paradoxos) >= 2 | Aviso — adicionar se possivel |
| Triangulacao (3 fontes/paradoxo) | Cada paradoxo com >= 3 fontes | Aviso — marcar como nao-confirmado |

---

## 8. Model Routing

### Roteamento por Complexidade

OMEGA determina qual modelo usar baseado na complexidade estimada da task. Isso otimiza custo e velocidade sem sacrificar qualidade onde importa.

| Complexidade | Score | Modelo | Latencia | Custo | Casos de Uso |
|-------------|-------|--------|----------|-------|-------------|
| Baixa | 1-4 | Haiku | Rapido | Baixo | Formatacao, correcoes triviais, queries simples |
| Media | 5-6 | Sonnet | Medio | Medio | Implementacao padrao, testes, CRUD, refactoring simples |
| Alta | 7-10 | Opus | Lento | Alto | Arquitetura, seguranca, debug complexo, mind clones |

### Calculo de Complexidade

A complexidade e estimada antes do inicio do OMEGA loop, baseado em fatores da task:

| Fator | Peso | 1 (baixo) | 5 (medio) | 10 (alto) |
|-------|------|-----------|-----------|-----------|
| Arquivos envolvidos | 20% | 1 arquivo | 3-5 arquivos | 10+ arquivos |
| Interdependencias | 20% | Independente | 2-3 dependencias | Cadeia longa |
| Dominio tecnico | 20% | CRUD, config | API, integracao | Seguranca, crypto, concorrencia |
| Impacto em caso de erro | 20% | Cosmetico | Funcional | Dados, seguranca, financeiro |
| Novidade | 20% | Pattern conhecido | Variacao de pattern | Problema inedito |

Formula: `complexity = sum(fator * peso) / sum(pesos)`, arredondado para inteiro.

### Routing por Tipo de Task

Alem da complexidade, certos tipos de task tem routing pre-definido:

| Tipo de Task | Modelo Minimo | Justificativa |
|-------------|---------------|---------------|
| `validation` | Sonnet | Testes e verificacao precisam de atencao |
| `mind_clone` | Opus | Fidelidade cognitiva exige capacidade maxima |
| Escalacao nivel 2+ | Opus | Problemas que ja falharam precisam do melhor |
| Contestacao (SHADOW) | Opus | Devil's advocate precisa de profundidade |
| Security audit | Opus | Risco alto demais para modelos menores |

### Regras de Routing

1. **O modelo sugerido e o MINIMO.** O agente pode usar modelo superior se julgar necessario.
2. **Escalacao aumenta modelo.** Cada nivel de escalacao pode subir o modelo.
3. **Mind clones sempre Opus.** Sem excecao — fidelidade cognitiva nao admite atalhos.
4. **Override manual.** O usuario pode forcar qualquer modelo para qualquer task.
5. **Log de routing.** Cada decisao de routing e registrada no progress log.

---

## 9. State Persistence

### Arquitetura de Estado

OMEGA persiste seu estado em 3 locais:

```
.claude/omega/
  state.json         ← Estado atual do loop (circuit breaker, task corrente)
  progress.log       ← Log append-only de todas as iteracoes
  checkpoints/       ← Snapshots automaticos em momentos criticos
    {timestamp}.json  ← Checkpoint individual
```

### state.json — Estado Corrente

```json
{
  "version": "1.0.0",
  "last_updated": "2026-03-02T14:30:00Z",
  "current_task": {
    "id": "auth-middleware-001",
    "description": "Implement auth middleware for API routes",
    "type": "implementation",
    "agent": "FORGE",
    "iteration": 2,
    "max_iterations": 3,
    "score": 78,
    "threshold": 90,
    "started_at": "2026-03-02T14:00:00Z",
    "completion_signals": ["tests_pass", "types_check"],
    "exit_signal": false
  },
  "circuit_breaker": {
    "state": "CLOSED",
    "no_progress_count": 0,
    "same_error_count": 0,
    "same_error_signature": null,
    "last_transition": "2026-03-02T14:00:00Z",
    "cooldown_until": null,
    "history": []
  },
  "escalation": {
    "level": 1,
    "agents_tried": ["FORGE"],
    "total_iterations": 2,
    "best_score": 78,
    "best_agent": "FORGE",
    "best_iteration": 2
  },
  "rate_limiter": {
    "calls_this_hour": 42,
    "hour_started": "2026-03-02T14:00:00Z",
    "max_calls_per_hour": 100
  },
  "session": {
    "context_utilization_percent": 45,
    "auto_checkpoint_threshold": 75,
    "last_checkpoint": null
  }
}
```

### Auto-Checkpoint a 75% Context

Quando a utilizacao de contexto atinge 75%, OMEGA dispara um auto-checkpoint:

1. Salvar `state.json` completo em `checkpoints/{timestamp}.json`
2. Salvar resumo da task corrente no `progress.log`
3. Gerar handoff com todas as informacoes necessarias para continuar:

```json
{
  "checkpoint_type": "auto_context_75",
  "timestamp": "2026-03-02T15:00:00Z",
  "task": { "...estado completo..." },
  "resume_instructions": "Continuar task {id} na iteracao {N}. Score atual: {score}. Faltam: {evidencias}.",
  "files_in_progress": ["src/middleware/auth.ts", "tests/auth.test.ts"],
  "git_sha": "abc1234",
  "progress_log_line": 423
}
```

Apos o checkpoint, OMEGA pode:
- Continuar na mesma sessao se contexto suficiente
- Escalar a nova sessao do mesmo agente com handoff
- Escalar ao PM para decisao

### Limpeza de Estado

| Evento | Acao |
|--------|------|
| Task completada | Mover `current_task` para historico no progress.log. Limpar `current_task` em state.json. |
| Task cancelada | Registrar cancelamento no progress.log. Limpar state.json. |
| Sessao encerrada | Auto-checkpoint. Estado persiste para resume. |
| Circuit breaker reset | Zerar contadores. Manter historico. |
| Rotacao de log | Mover progress.log para progress.log.{timestamp}. Criar novo. |

### Integracao com GSD State

OMEGA state complementa (nao substitui) o estado GSD em `.planning/`. A relacao e:

| Aspecto | GSD | OMEGA |
|---------|-----|-------|
| Escopo | Projeto, milestones, fases | Task individual |
| Granularidade | Fase inteira | Cada iteracao da task |
| Autor | PM (ATLAS) | Protocolo automatico |
| Persistencia | .planning/ | .claude/omega/ |
| Leitura | Agentes e PM | OMEGA loop + PM |

---

## 10. Integracao com Agentes DuarteOS

### ATLAS (PM) — Orquestrador do OMEGA

ATLAS e o unico agente com autoridade para:

| Acao | Contexto |
|------|----------|
| Configurar thresholds por task | Pode ajustar threshold se justificado |
| Decidir nivel de escalacao | Aceitar output abaixo do threshold ou escalar |
| Cancelar OMEGA loop | Se o custo excede o beneficio |
| Override de circuit breaker | Em emergencia, pode forcar re-tentativa |
| Routing de escalacao vertical | Escolher qual agente substituto |
| Spawnar escalacao horizontal | Decidir quais agentes rodam em paralelo |
| Consultar progress log | Diagnosticar gargalos e patterns |

**ATLAS NAO executa tasks.** ATLAS apenas orquestra. O OMEGA loop roda dentro de cada agente executor.

### Fluxo ATLAS + OMEGA

```
1. Usuario pede algo
2. ATLAS avalia escopo e complexidade
3. ATLAS delega ao agente com task_type e complexity definidos
4. OMEGA loop inicia dentro do agente delegado
5. Se o agente resolve: OMEGA finaliza, ATLAS recebe confirmacao
6. Se escalacao necessaria:
   a. OMEGA notifica ATLAS com score + gap
   b. ATLAS decide: retry / vertical / horizontal / human
   c. ATLAS executa a decisao
   d. OMEGA loop reinicia no novo contexto
7. ATLAS registra resultado no session-context.md
```

### FORGE / PRISM / BRIDGE — Agentes Executores

Agentes que escrevem codigo interagem com OMEGA assim:

| Momento | Acao do Agente | Acao OMEGA |
|---------|---------------|-----------|
| Inicio da task | Recebe task + OMEGA context | Inicializa loop, registra iteracao 1 |
| Durante execucao | Escreve codigo, roda testes | Monitora progresso (SHA, files) |
| Final da execucao | Emite OMEGA_STATUS block | Calcula score, verifica dual-gate |
| Se score < threshold | Recebe OMEGA_FEEDBACK | Incrementa iteracao |
| Se score >= threshold | Recebe confirmacao | Finaliza loop, registra em log |

Exemplo de workflow FORGE com OMEGA:

```
FORGE recebe: "Implementar auth middleware"
  Iteracao 1:
    - FORGE implementa auth.ts + auth.test.ts
    - OMEGA_STATUS: score 72/90 (testes passam mas lint tem erros, sem coverage para edge cases)
    - OMEGA: threshold nao atingido. Feedback: "Corrigir lint errors em auth.ts:23,45. Adicionar teste para input null."
  Iteracao 2:
    - FORGE corrige lint, adiciona teste
    - OMEGA_STATUS: score 88/90 (quase la, falta incremental_edit — usou Write em vez de Edit)
    - OMEGA: threshold nao atingido. Feedback: "Arquivo auth.test.ts foi reescrito com Write. Usar Edit."
  Iteracao 3:
    - FORGE usa Edit para corrigir
    - OMEGA_STATUS: score 92/90, completion_signals: [tests_pass, types_check, lint_clean], exit_signal: true
    - OMEGA: dual-gate met. Task concluida.
```

### SENTINEL (QA) — Validador Reforçado por OMEGA

SENTINEL e o agente que mais se beneficia do OMEGA, pois validacao exige o threshold mais alto (95).

| Interacao SENTINEL + OMEGA | Detalhe |
|---------------------------|---------|
| Threshold elevado | 95 — margem minima para erro |
| Evidencias rigorosas | Todos os testes, cenarios de borda, regressao |
| Fresh reviewer | Quando SENTINEL escala, novo SENTINEL instance sem ancoragem |
| Backpressure forte | SENTINEL pode bloquear release se evidencias faltam |

### COMPASS (Context Engineer) — Pesquisa com Quality Gate

COMPASS opera com threshold 80 (research), mas OMEGA garante que a pesquisa e suficiente:

| Evidencia | Verificacao |
|-----------|-------------|
| Fontes consultadas | >= 3 fontes distintas |
| Cobertura do escopo | Todos topicos pedidos cobertos |
| Trade-offs documentados | Pelo menos 2 alternativas com pros/cons |
| Formato estruturado | Markdown limpo com secoes |

### SHADOW (Devil's Advocate) — Contestacao no Loop

SHADOW nao tem OMEGA loop proprio (nao executa tasks). Mas SHADOW influencia OMEGA:

| Influencia | Como |
|-----------|------|
| Validacao de plano | Score de planning inclui "validacao do Devil's Advocate" (peso 15) |
| Contestacao de evidencias | SHADOW pode questionar se evidencias sao genuinas |
| Anti-anchoring | SHADOW instance fresca para cada contestacao |
| Veto | SHADOW pode bloquear task (BLOCKED verdict) — OMEGA trata como Gate falho |

### MMOS Mind-Clone Pipeline + OMEGA

O pipeline MMOS de clonagem mental opera em 7 fases. OMEGA aplica quality gate em CADA fase:

| Fase MMOS | OMEGA Task Type | Threshold | Gate Especifico |
|-----------|----------------|-----------|-----------------|
| 1. Pesquisa e Coleta | research | 80 | >= 3 fontes, cobertura de topicos |
| 2. Analise e Extracao | research | 80 | Insights extraidos com fonte |
| 3. Estruturacao DNA | mind_clone | 95 | 6 camadas preenchidas |
| 3.5. Synapse Sync | mind_clone | 95 | YAML valido, versao incrementada |
| 4. Validacao de Fidelidade | validation | 95 | Score de fidelidade, paradoxos |
| 5. Persona Assembly | mind_clone | 95 | Persona coerente, voice check |
| 6. Teste Funcional | validation | 95 | 5+ perguntas respondidas "in character" |
| 7. Publicacao | implementation | 90 | Arquivo no diretorio correto, index atualizado |

Para tasks de mind clone, OMEGA adiciona validacoes especificas:

```
OMEGA_MIND_CLONE_VALIDATION:
  - DNA YAML parseia sem erro
  - Todas as 6 camadas presentes e nao-vazias
  - source_path em cada insight
  - versao_dna incrementada corretamente
  - >= 2 paradoxos com >= 3 fontes (ou marcados nao-confirmado)
  - Consistencia interna (sem contradicoes nao-documentadas)
  - Fidelidade de voz: output soa como a pessoa
  - Log de ingestao registrado em ingestion/
```

---

## 11. Task Lifecycle Protocol (Pre-Execution → Execution → Memory)

### Principio

Nenhuma task existe sem registro. Nenhuma task termina sem memoria. O lifecycle completo e:

```
PRE-EXEC → OMEGA LOOP → POST-EXEC → MEMORY → CLEANUP
```

Este protocolo e **OBRIGATORIO e DEFAULT**. Todo agente, todo orquestrador, toda task — sem excecao. O lifecycle envolve o OMEGA loop (Secao 1) como fase de execucao, mas adiciona planejamento antes e memoria depois.

### 11.1 PRE-EXEC — Planejamento Obrigatorio

**ANTES** de iniciar qualquer execucao, o agente (ou orquestrador que delega) DEVE criar artefatos de planejamento.

#### Estrutura em .planning/tasks/

```
.planning/tasks/{NNN}-{agent}-{slug}/
├── TASK.md        # Definicao da task + output esperado
└── CHECKLIST.md   # Criterios de validacao
```

Onde:
- `{NNN}` = numero sequencial auto-incrementado, 3 digitos zero-padded (001, 002, ..., 999)
- `{agent}` = codename do agente executor (FORGE, PRISM, ATLAS, COMPASS, etc.)
- `{slug}` = descricao-curta-em-kebab-case (max 40 chars)

#### Numeracao Sequencial

1. Ler `.planning/tasks/` para encontrar o maior NNN existente (via Glob `*-*-*/TASK.md`)
2. Proximo = maior + 1
3. Se vazio: comecar em 001
4. Formato: 3 digitos zero-padded (001, 002, ..., 999)

#### TASK.md — Template

```markdown
# Task {NNN}: {Titulo}

## Metadata
- **Agent:** {CODENAME}
- **Task Type:** {research|planning|implementation|validation|mind_clone|mind_update}
- **Threshold:** {score minimo do OMEGA para este task_type}
- **Created:** {YYYY-MM-DD HH:mm}
- **Status:** pending

## Objetivo
{O que precisa ser feito — 1-3 frases claras e especificas}

## Output Esperado
{O que sera produzido — lista concreta de artefatos, arquivos, resultados}

## Contexto
{Background relevante — links para arquivos, decisoes anteriores, dependencias}

## Dependencias
{Tasks que devem estar completas antes desta — "Nenhuma" se independente}
```

**Output Esperado por tipo de agente:**

| Agente | Output tipico |
|--------|--------------|
| FORGE | API endpoint, testes, types, migrations |
| PRISM | Componente, testes, estilos, acessibilidade |
| NEXUS | Plano arquitetural, diagramas, decisoes |
| COMPASS | Pesquisa com 5+ fontes, trade-offs documentados |
| SENTINEL | Relatorio de validacao, cenarios testados |
| MMOS | DNA YAML, agente .md, squad artifacts |
| ATLAS | Decomposicao em sub-tasks, delegacao |

#### CHECKLIST.md — Template

```markdown
# Checklist: Task {NNN}

## Gate Items (kill — task falha se qualquer um falhar)
- [ ] {criterio obrigatorio 1}
- [ ] {criterio obrigatorio 2}
- [ ] {criterio obrigatorio N}

## Quality Items (warning — task passa mas com alerta)
- [ ] {criterio de qualidade 1}
- [ ] {criterio de qualidade 2}

## Output Verification
- [ ] {artefato 1 existe e e valido}
- [ ] {artefato 2 existe e e valido}
```

**Gate items devem ser derivados do OMEGA quality gate correspondente ao task_type.** Exemplo: para `implementation`, gates incluem "TypeScript strict", "testes passam", "sem secrets hardcoded". Para `mind_clone`, gates incluem "6 camadas DNA", "fidelidade >= 95%".

#### Regras de Criacao

| Cenario | Quem cria | Quantas tasks |
|---------|-----------|---------------|
| ATLAS delega a 1 agente | ATLAS cria 1 TASK.md + CHECKLIST.md | 1 |
| ATLAS delega a N agentes em paralelo | ATLAS cria N tasks individuais | N |
| Agente trabalha solo (sem orquestrador) | Agente cria sua propria task | 1 |
| Task complexa decomponivel | Orquestrador cria N sub-tasks com dependencias | N |
| Pipeline mind-clone/mind-update | Pipeline cria 1 task por step/fase | 5-6 |

### 11.2 OMEGA LOOP (Execucao)

Apos PRE-EXEC concluido, o **OMEGA loop roda normalmente** conforme Secao 1 deste protocolo. Nenhuma mudanca no loop de execucao.

O agente DEVE atualizar o campo `Status` no TASK.md durante a execucao:

| Transicao | Quando |
|-----------|--------|
| `pending` → `in_progress` | Ao iniciar execucao |
| `in_progress` → `completed` | Ao passar dual-gate (score >= threshold + signals + exit_signal) |
| `in_progress` → `failed` | Ao circuit breaker OPEN ou max_iterations sem threshold |
| `in_progress` → `escalated` | Ao escalar para outro agente ou humano |

### 11.3 POST-EXEC — Validacao e Memoria

Apos o OMEGA loop finalizar (qualquer status terminal: COMPLETED, FAILED, ou ESCALATED):

#### Passo 1 — Marcar Checklist

Atualizar `CHECKLIST.md` marcando `[x]` para itens cumpridos, mantendo `[ ]` para nao-cumpridos. Isso cria um registro auditavel do que passou e do que falhou.

#### Passo 2 — Registrar Resultado

Adicionar secao `## Resultado` ao final do `TASK.md`:

```markdown
## Resultado
- **Status:** {completed|failed|escalated}
- **Score Final:** {score}/100 (threshold: {threshold})
- **Iteracoes:** {N}/3
- **Arquivos Modificados:** {lista ou "nenhum"}
- **Arquivos Criados:** {lista ou "nenhum"}
- **Resumo:** {1-3 frases do que foi feito e resultado}
- **Completed:** {YYYY-MM-DD HH:mm}
```

#### Passo 3 — Salvar na Memoria

**3a. Session Context** — Append na secao "Decisoes Recentes" do `.claude/session-context.md`:

```
- [{YYYY-MM-DD}] Task {NNN} ({AGENT}): {titulo} — {status} ({score}/{threshold}). {resumo 1 frase}.
```

**3b. Task History** — Append em `.planning/tasks/HISTORY.md`:

```
| {NNN} | {YYYY-MM-DD HH:mm} | {AGENT} | {titulo} | {status} | {score}/{threshold} | {resumo 1 frase} |
```

`HISTORY.md` e o **registro permanente**. Nunca deletado. Legivel por qualquer sessao futura ou agente. Serve como fonte de verdade para "o que foi feito neste projeto".

#### Passo 4 — Cleanup

| Status da task | Acao |
|----------------|------|
| `completed` | Deletar diretorio `.planning/tasks/{NNN}-{agent}-{slug}/` |
| `failed` | Manter diretorio (para diagnostico e retry) |
| `escalated` | Manter diretorio (para o proximo agente ter contexto) |

**HISTORY.md nunca e deletado**, independente do status.

### 11.4 Excecoes

| Cenario | Comportamento PRE-EXEC |
|---------|----------------------|
| Task trivial (estimada < 30 segundos) | PRE-EXEC simplificado: 1 linha no TASK.md, CHECKLIST.md opcional |
| Exploracao/pesquisa rapida (Read, Glob, Grep) | NAO cria task — ferramentas de leitura nao sao execucao |
| OMEGA desabilitado (`omega.enabled: false`) | PRE-EXEC ainda roda — task lifecycle e independente do quality loop |
| Agente em modo conversacional (sem tool calls) | NAO cria task — conversacao nao e execucao |
| Sub-task de pipeline (ex: step interno de mind-clone) | Task criada pelo pipeline, nao por cada sub-operacao |

**Regra geral:** Se o agente vai usar Edit, Write, ou Bash para MODIFICAR algo, cria task. Se so vai ler/pesquisar, nao cria.

### 11.5 Diagrama Completo

```
Usuario pede algo
    │
    ▼
ATLAS avalia escopo
    │
    ├─ Simples → Agente solo
    │               │
    │               ▼
    │         ┌─ PRE-EXEC ─────────────────────────────────┐
    │         │  Criar TASK.md + CHECKLIST.md               │
    │         │  Status: pending → in_progress              │
    │         └────────────────────────────────────────────┘
    │               │
    │               ▼
    │         ┌─ OMEGA LOOP (Secao 1) ─────────────────────┐
    │         │  Iter 1 → Score → Threshold? → Feedback    │
    │         │  Iter 2 → Score → Threshold? → Feedback    │
    │         │  Iter 3 → Score → Threshold? → Escalar     │
    │         └────────────────────────────────────────────┘
    │               │
    │               ▼
    │         ┌─ POST-EXEC ────────────────────────────────┐
    │         │  1. Marcar CHECKLIST.md                     │
    │         │  2. Registrar resultado em TASK.md          │
    │         │  3. Salvar em session-context + HISTORY.md  │
    │         │  4. Cleanup (se completed)                  │
    │         └────────────────────────────────────────────┘
    │
    ├─ Complexo → ATLAS decompoe em N sub-tasks
    │               │
    │               ▼
    │         PRE-EXEC × N (cada sub-task com TASK.md + CHECKLIST.md)
    │               │
    │               ▼
    │         OMEGA LOOP × N (sequencial ou paralelo)
    │               │
    │               ▼
    │         POST-EXEC × N (checklist + memoria + cleanup por task)
    │
    └─ Conversacional → Sem task (resposta direta, sem lifecycle)
```

---

## Apendice A — Glossario

| Termo | Definicao |
|-------|-----------|
| **OMEGA Loop** | O ciclo de execucao-avaliacao-refinamento que roda em toda task |
| **OMEGA_STATUS** | Bloco de metadados que todo agente emite ao final da execucao |
| **Dual-Gate** | Condicao de saida que exige score >= threshold E >= 2 completion signals + exit_signal |
| **Circuit Breaker** | Mecanismo de protecao contra loops infinitos (CLOSED/HALF_OPEN/OPEN) |
| **Backpressure** | Transformacao de evento "done" em "blocked" quando evidencias faltam |
| **Escalacao Vertical** | Outro agente assume a task que o agente atual nao resolveu |
| **Escalacao Horizontal** | Multiplos agentes tentam em paralelo |
| **Fresh Reviewer** | Principio de usar instancia sem ancoragem no trabalho anterior |
| **No-progress** | Iteracao onde score nao aumentou, nenhum arquivo mudou e SHA nao mudou |
| **Thrashing** | Alternar entre dois estados sem convergir |
| **Completion Signal** | Evidencia verificavel de que um aspecto da task esta concluido |
| **Progress Log** | Arquivo append-only com historico de todas as iteracoes OMEGA |
| **Auto-Checkpoint** | Snapshot automatico quando context utilization atinge 75% |
| **Model Routing** | Roteamento de task para modelo (Haiku/Sonnet/Opus) baseado em complexidade |

---

## Apendice B — Referencia Rapida para Agentes

### Checklist: O Que Todo Agente Deve Fazer

0. **ANTES** de executar: criar TASK.md + CHECKLIST.md em `.planning/tasks/` (Secao 11)
1. Ler este protocolo no inicio de cada sessao que envolva execucao de tasks
2. Emitir OMEGA_STATUS block ao final de toda resposta de execucao
3. Incluir OMEGA_SIGNATURE em todo artefato que modifique estado
4. Respeitar thresholds — nao declarar "feito" se score < threshold
5. Aceitar feedback OMEGA — iterar ate atingir threshold ou ser escalado
6. Registrar progresso — SHA, files, tests no delta do OMEGA_STATUS
7. Reportar blockers — nao tentar resolver sozinho alem de 3 iteracoes
8. Usar Edit > Write — desenvolvimento incremental e evidencia verificada pelo OMEGA
9. **DEPOIS** de executar: marcar checklist, salvar resumo na memoria, cleanup `.planning/` (Secao 11)

### Template OMEGA_STATUS (copiar e preencher)

```
<!-- OMEGA_STATUS
agent: {CODENAME}
task: {descricao}
iteration: {N de max_iterations}
task_type: {research | planning | implementation | validation | mind_clone | mind_update}
score: {0-100}
evidence:
  - {evidencia 1}
  - {evidencia 2}
completion_signals:
  - {sinal 1}
  - {sinal 2}
exit_signal: {true | false}
blockers:
  - {bloqueio, se houver}
delta:
  files_modified: {N}
  files_created: {N}
  git_sha_before: {sha}
  git_sha_after: {sha}
  tests_added: {N}
  tests_passing: {N}/{total}
notes: {observacoes}
-->
```

> **Valores default:** Quando `git_sha_before`/`git_sha_after` nao estao disponiveis (codigo nao commitado), use `"uncommitted"`. Quando `tests_added`/`tests_passing` nao se aplicam (task sem testes), use `"N/A"`.

### Diagrama de Decisao Rapida

```
Recebi uma task?
  │
  ├─ SIM → PRE-EXEC: Criar TASK.md + CHECKLIST.md em .planning/tasks/ (Secao 11)
  │         │
  │         ├─ Executar task → Emitir OMEGA_STATUS ao final (obrigatorio)
  │         │
  │         ├─ Score >= threshold? → SIM + 2 signals + exit_signal → DONE
  │         │                      → NAO → proxima iteracao
  │         │
  │         ├─ 3 iteracoes sem sucesso? → ESCALAR (nao insistir)
  │         │
  │         ├─ Circuit breaker OPEN? → PARAR (aguardar cooldown ou escalacao)
  │         │
  │         └─ POST-EXEC: Marcar checklist → Salvar memoria → Cleanup (Secao 11)
  │
  └─ NAO (conversacao/leitura) → Responder diretamente (sem task lifecycle)
```

---

## Apendice C — Mapa de Integracao

### OMEGA no Ecossistema DuarteOS

```
┌─────────────────────────────────────────────────────────────────┐
│  USUARIO                                                        │
│  Demanda → ATLAS (PM) → Delega task                            │
├─────────────────────────────────────────────────────────────────┤
│  OMEGA LAYER (este protocolo)                                   │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │  OMEGA Loop                                             │    │
│  │  [Execute → Score → Threshold? → Feedback → Repeat]    │    │
│  │                                                         │    │
│  │  Integracoes:                                           │    │
│  │  ├─ QUALITY-GATES.md (9 gates existentes)              │    │
│  │  ├─ CONSTITUTION.md (principios inviolaveis)           │    │
│  │  ├─ SYNAPSE.md (estado dos agentes + DNA)              │    │
│  │  ├─ AGENT-GSD-PROTOCOL.md (workflow de execucao)       │    │
│  │  └─ MMOS-PIPELINE.md (mind clone phases)               │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                 │
├─────────────────────────────────────────────────────────────────┤
│  AGENTES (cerebro — executam DENTRO do OMEGA loop)             │
│  NEXUS, FORGE, PRISM, SENTINEL, COMPASS, SHADOW,              │
│  TITAN, SPARK, LENS, VAULT, SPECTER, BRIDGE                    │
├─────────────────────────────────────────────────────────────────┤
│  GSD ENGINE (maos — artefatos rastreados)                      │
│  .planning/, commits, ROADMAP, PLAN, VERIFICATION              │
├─────────────────────────────────────────────────────────────────┤
│  TASK LIFECYCLE (planejamento + memoria — Secao 11)            │
│  .planning/tasks/{NNN}/ (TASK.md, CHECKLIST.md)                │
│  .planning/tasks/HISTORY.md (log permanente, nunca deletado)   │
├─────────────────────────────────────────────────────────────────┤
│  OMEGA STATE (persistencia)                                     │
│  .claude/omega/state.json, progress.log, checkpoints/          │
└─────────────────────────────────────────────────────────────────┘
```

### Dependencias entre Protocolos

| Protocolo | OMEGA Depende De | Depende de OMEGA |
|-----------|-----------------|------------------|
| CONSTITUTION.md | SIM — principios inviolaveis sao hard stops | NAO |
| QUALITY-GATES.md | SIM — gates existentes sao completion signals | SIM — OMEGA orquestra gates |
| AGENT-GSD-PROTOCOL.md | SIM — workflow de execucao e o que OMEGA envolve | SIM — GSD tasks passam por OMEGA |
| SYNAPSE.md | SIM — estado do agente informa o loop | SIM — OMEGA atualiza estado |
| GOVERNANCE.md | SIM — convencoes de nomenclatura | NAO |
| MMOS-PIPELINE.md | SIM — fases de mind clone informam thresholds | SIM — cada fase passa por OMEGA |

---

## Apendice D — Cenarios de Uso

### Cenario 1: Task Simples que Passa na Primeira Iteracao

```
ATLAS delega: "Adicionar campo email ao schema User"
Agente: FORGE
Complexidade: 2 → Modelo: Haiku

Iteracao 1:
  FORGE: adiciona campo, atualiza tipo, adiciona teste
  OMEGA_STATUS: score 94/90, signals: [tests_pass, types_check, lint_clean, incremental_edit], exit_signal: true
  OMEGA: dual-gate met. Task concluida em 1 iteracao.
```

### Cenario 2: Task que Precisa de Refinamento

```
ATLAS delega: "Implementar rate limiting no API gateway"
Agente: FORGE
Complexidade: 7 → Modelo: Opus

Iteracao 1:
  FORGE: implementa rate limiter basico
  OMEGA_STATUS: score 65/90
  OMEGA_FEEDBACK: "Faltam: testes para edge cases, lint errors, nao tratou cenario de distributed rate limiting"

Iteracao 2:
  FORGE: adiciona testes, corrige lint, adiciona Redis adapter
  OMEGA_STATUS: score 82/90
  OMEGA_FEEDBACK: "Faltam: teste de concorrencia, coverage para fallback path"

Iteracao 3:
  FORGE: adiciona teste de concorrencia, cobre fallback
  OMEGA_STATUS: score 93/90, signals: [tests_pass, types_check, lint_clean, coverage_met], exit_signal: true
  OMEGA: dual-gate met. Task concluida em 3 iteracoes.
```

### Cenario 3: Task que Escala Verticalmente

```
ATLAS delega: "Refatorar sistema de permissoes para RBAC"
Agente: FORGE
Complexidade: 9 → Modelo: Opus

Iteracao 1-3: FORGE tenta, melhor score = 72/90 (arquitetura inadequada)

OMEGA escala verticalmente: gap = arquitetura
ATLAS redireciona para NEXUS (Architect)

NEXUS redesenha a arquitetura, gera PLAN.md

ATLAS redireciona para FORGE com novo plano
FORGE implementa seguindo o plano de NEXUS

Iteracao 1 (nova tentativa):
  FORGE: implementa RBAC conforme plano
  OMEGA_STATUS: score 91/90, dual-gate met
  OMEGA: Task concluida apos escalacao vertical.
```

### Cenario 4: Circuit Breaker Ativado

```
ATLAS delega: "Integrar API externa XYZ"
Agente: FORGE

Iteracao 1: score 45. API retorna 500.
Iteracao 2: score 45. Mesmo erro. (no-progress #1)
  Circuit breaker: CLOSED → HALF_OPEN

Iteracao 3: score 45. Mesmo erro. (no-progress #2, same-error #3)
  Circuit breaker: HALF_OPEN → OPEN

OMEGA: Circuit breaker OPEN. Escalacao ao usuario.

OMEGA ESCALACAO:
  Task: Integrar API externa XYZ
  Melhor score: 45/90
  Gap: API externa retornando 500 — dependencia fora do controle
  Opcoes: 1) ACCEPT 2) CONTINUE (apos API resolver) 3) CANCEL 4) ADJUST
```

### Cenario 5: Mind Clone com OMEGA

```
ATLAS delega: "Criar mind clone para novo expert — Fase 3 (DNA)"
Agente: COMPASS
Task type: mind_clone
Complexity: 8 → Modelo: Opus

Iteracao 1:
  COMPASS: gera DNA com 5 camadas preenchidas, faltando paradoxos
  OMEGA_STATUS: score 78/95
  OMEGA_FEEDBACK: "Camada 6 (Paradoxos) vazia. Minimo 2 paradoxos requeridos."

Iteracao 2:
  COMPASS: adiciona 2 paradoxos, mas 1 tem apenas 1 fonte
  OMEGA_STATUS: score 88/95
  OMEGA_FEEDBACK: "Paradoxo 2 com apenas 1 fonte — precisa >= 3 para confirmacao."

Iteracao 3:
  COMPASS: adiciona fontes ao paradoxo 2, marca como confirmado
  OMEGA_STATUS: score 96/95, signals: [schema_valid, fidelity_check], exit_signal: true
  OMEGA: dual-gate met. Mind clone concluido.
```

---

## Apendice E — Configuracao

### Parametros Configuraveis

Arquivo: `.claude/config/project.yaml` (secao `omega`)

```yaml
omega:
  enabled: true
  max_iterations: 3
  thresholds:
    research: 80
    planning: 85
    implementation: 90
    validation: 95
    mind_clone: 95
  circuit_breaker:
    no_progress_trigger: 2
    open_trigger: 3
    same_error_trigger: 5
    cooldown_minutes: 30
  rate_limiter:
    max_calls_per_hour: 100
  auto_checkpoint:
    context_threshold_percent: 75
  progress_log:
    max_lines: 10000
    rotation: true
  model_routing:
    low_complexity: "haiku"
    medium_complexity: "sonnet"
    high_complexity: "opus"
    low_max: 4
    medium_max: 6
```

### Desabilitando OMEGA

Para desabilitar OMEGA (nao recomendado), setar `omega.enabled: false` no `project.yaml`. Isso desativa o loop, mas mantem os quality gates existentes (QUALITY-GATES.md) ativos.

**Aviso:** Desabilitar OMEGA remove o loop de refinamento e a escalacao automatica. Tasks serao consideradas completas na primeira tentativa, sem verificacao de evidencias. Use apenas para debug ou sessoes interativas de exploracao.

---

## Versionamento

| Versao | Data | Mudanca |
|--------|------|---------|
| 1.0.0 | 2026-03-02 | Protocolo inicial — core loop, quality gates, circuit breaker, escalation router, progress tracking, backpressure, model routing, state persistence, integracao com agentes |
| 1.1.0 | 2026-03-03 | Task Lifecycle Protocol — PRE-EXEC obrigatorio (TASK.md + CHECKLIST.md em .planning/tasks/), POST-EXEC com memoria (session-context + HISTORY.md), cleanup automatico (Secao 11) |
