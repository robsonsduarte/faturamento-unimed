# Squad: Planejar Fase

Planejamento completo de uma fase do roadmap com pesquisa, planos executaveis e validacao.

**Agente Lider:** ATLAS (PM) — orquestra o pipeline via Task tool
**Pipeline:** COMPASS (Context Engineer) → NEXUS (Architect) → SHADOW (Devil's Advocate)
**Motor:** GSD `plan-phase` (researcher → planner → plan-checker loop)

## Criterios de Handoff Verificavel

Cada etapa do pipeline SO avanca quando seus criterios de saida sao atendidos. ATLAS verifica ANTES de spawnar o proximo agente.

### COMPASS → NEXUS
- [ ] CONTEXT.md foi criado (arquivo existe)
- [ ] Secao "Decisoes Resolvidas" presente com pelo menos 1 decisao
- [ ] Secao "Gray Areas Abertas" presente (pode estar vazia se tudo foi resolvido)
- [ ] Se gray areas abertas restam: ATLAS decide se avanca ou retorna ao COMPASS

### NEXUS → SHADOW
- [ ] PLAN.md foi criado (arquivo existe)
- [ ] Cada task tem: descricao, criterio de aceite, estimativa de complexidade
- [ ] PLAN.md referencia o CONTEXT.md (decisoes respeitadas)

### SHADOW → ATLAS (resultado final)
- [ ] Verdict emitido: APPROVED / CAVEATS / BLOCKED
- [ ] Se CAVEATS: cada caveat tem severidade (low/medium/high)
- [ ] Se BLOCKED: cada blocker tem justificativa especifica

Se qualquer criterio falhar → ATLAS NAO avanca. Retorna ao agente anterior com feedback especifico.

## Descricao

Cria PLAN.md executaveis para uma fase do roadmap. Segue o loop de qualidade: Research → Plan → Verify → Revision (max 3x). Cada plano tem tasks atomicas com criterios de verificacao automatizados.

## Quando usar

- Apos o roadmap estar definido e a fase escolhida
- Quando uma fase precisa de planejamento detalhado antes da execucao
- Corresponde a Fase 1 (Arquitetura) do fluxo do Squad

## Como funciona

**Pipeline sequencial (ATLAS orquestra via Task tool):**

1. **COMPASS (Context Engineer)** — Se CONTEXT.md da fase NAO existe, ATLAS spawna COMPASS para executar `/gsd:discuss-phase $ARGUMENTS` e produzir CONTEXT.md com decisoes capturadas.

2. **NEXUS (Architect)** — ATLAS spawna NEXUS para criar PLAN.md usando CONTEXT.md + ROADMAP.md. NEXUS executa `/gsd:plan-phase $ARGUMENTS` que ira:
   - Pesquisar implementacao da fase (gsd-phase-researcher)
   - Criar PLAN.md files com tasks atomicas (gsd-planner)
   - Estruturar dependencias e wave ordering

3. **SHADOW (Devil's Advocate)** — ATLAS spawna SHADOW para validar/contestar o plano. SHADOW executa o plan-checker do GSD e avalia:
   - Planos cobrem o goal da fase?
   - Ha riscos nao mapeados ou dependencias ocultas?
   - Tasks sao realmente atomicas e verificaveis?

4. **Loop de Revisao em 2 Niveis** — Quando SHADOW identifica problemas, ATLAS classifica o tipo antes de rotear o feedback:

   **Tipo A — Plano inadequado** (problema no PLAN.md):
   - Feedback retorna ao NEXUS (Step 2)
   - NEXUS revisa o plano mantendo o CONTEXT.md intacto
   - Exemplos: tasks mal definidas, riscos nao cobertos, dependencias faltando

   **Tipo B — Contexto insuficiente** (problema no CONTEXT.md):
   - Feedback retorna ao COMPASS (Step 1)
   - COMPASS re-captura decisoes especificas com o usuario
   - Exemplos: gray area nao resolvida que afeta o plano, premissa incorreta no contexto, decisao de escopo ambigua

   **Limite total:** 3 iteracoes do loop (contando ambos os tipos). Apos 3 iteracoes sem convergencia, ATLAS apresenta divergencias ao usuario com diagnostico estruturado.

5. **ATLAS apresenta** plano aprovado ao usuario com trade-offs e riscos identificados

> **IMPORTANTE:** ATLAS (PM) NUNCA executa os passos diretamente — apenas orquestra spawns. Cada agente opera com sua especializacao exclusiva.

## Flags disponiveis

- `--research` — forca pesquisa mesmo se RESEARCH.md ja existe
- `--skip-research` — pula pesquisa
- `--gaps` — planeja apenas gaps encontrados em verificacao anterior
- `--skip-verify` — pula plan-checker
- `--auto` — executa sem parar para confirmacao

## Output esperado

`.planning/phases/{NN}-{nome}/` com:
- `{NN}-CONTEXT.md` (decisoes de implementacao)
- `{NN}-RESEARCH.md` (pesquisa tecnica)
- `{NN}-{01..N}-PLAN.md` (planos executaveis com waves)
