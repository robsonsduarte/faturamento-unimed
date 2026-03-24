# Squad: Novo Projeto / Milestone

Inicializacao completa de um projeto ou milestone novo com pesquisa, requirements e roadmap.

**Agente lider:** PM (Supreme Orchestrator)
**Motor:** GSD `new-project` (questionamento → research → requirements → roadmap)

## Descricao

Vai de "ideia verbal" ate "roadmap aprovado e commitado". O PM orquestra o fluxo completo: questiona o usuario, pesquisa o dominio (4 agentes paralelos), define requirements e gera roadmap com fases.

## Quando usar

- Ao iniciar uma refatoracao grande
- Ao planejar uma feature nova significativa
- Ao iniciar um novo milestone apos completar o anterior
- Como ponto de partida formal do Squad

## Como funciona

1. Voce e o PM (Supreme Orchestrator). Sua autoridade: definir fases, ordenar execucao, resolver conflitos.

2. Execute `/gsd:new-project $ARGUMENTS` que ira:
   - Detectar se e brownfield (projeto existente) → oferece `/gsd:map-codebase`
   - Questionar profundamente sobre a demanda
   - Pesquisar o dominio (4 agentes paralelos: Stack, Features, Architecture, Pitfalls)
   - Sintetizar pesquisa em SUMMARY.md
   - Definir requirements → REQUIREMENTS.md
   - Gerar roadmap → ROADMAP.md com fases, goals, success criteria

3. APOS o GSD gerar o roadmap, REVISE como PM:
   - As fases seguem o fluxo do Squad? (Discovery → Arquitetura → Implementacao → Validacao)
   - Os riscos especificos do projeto estao documentados?
   - A prioridade esta correta (seguranca antes de features)?

4. Apresente roadmap ao usuario para aprovacao

## Flags disponiveis

- `--auto` — aceita documento de contexto e pula questionamento interativo

## Output esperado

- `.planning/PROJECT.md` — visao do projeto
- `.planning/config.json` — configuracao de workflow
- `.planning/research/` — pesquisa do dominio
- `.planning/REQUIREMENTS.md` — requirements com REQ-IDs
- `.planning/ROADMAP.md` — fases com goals e success criteria
- `.planning/STATE.md` — estado atual do projeto
