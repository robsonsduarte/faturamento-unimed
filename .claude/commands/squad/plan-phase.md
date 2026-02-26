# Squad: Planejar Fase

Planejamento completo de uma fase do roadmap com pesquisa, planos executaveis e validacao.

**Agentes envolvidos:** Arquiteto (estrutura) + Context Engineer (coerencia) + Advogado do Diabo (contestacao)
**Motor:** GSD `plan-phase` (researcher → planner → plan-checker loop)

## Descricao

Cria PLAN.md executaveis para uma fase do roadmap. Segue o loop de qualidade: Research → Plan → Verify → Revision (max 3x). Cada plano tem tasks atomicas com criterios de verificacao automatizados.

## Quando usar

- Apos o roadmap estar definido e a fase escolhida
- Quando uma fase precisa de planejamento detalhado antes da execucao
- Corresponde a Fase 1 (Arquitetura) do fluxo do Squad

## Como funciona

1. Voce opera com 3 lentes cognitivas simultaneas:
   - **Arquiteto:** estrutura dos planos, dependencias, wave ordering
   - **Context Engineer:** coerencia com Context Map
   - **Advogado do Diabo:** valida planos antes da execucao (via plan-checker)

2. Primeiro, se nao existir CONTEXT.md da fase, execute `/gsd:discuss-phase $ARGUMENTS` para capturar decisoes

3. Depois, execute `/gsd:plan-phase $ARGUMENTS` que ira:
   - Pesquisar implementacao da fase (gsd-phase-researcher)
   - Criar PLAN.md files com tasks atomicas (gsd-planner)
   - Validar planos contra o goal (gsd-plan-checker)
   - Loop de revisao se necessario (max 3 iteracoes)

4. APOS o GSD gerar os planos, REVISE com perspectiva do projeto

5. Apresente os planos ao usuario com trade-offs e riscos

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
