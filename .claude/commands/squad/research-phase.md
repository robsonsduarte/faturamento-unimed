# Squad: Pesquisar Fase

Pesquisa aprofundada de implementacao de uma fase antes de planejar.

**Agente lider:** Context Engineer (Engenheiro de Coerencia)
**Motor:** GSD `research-phase` (gsd-phase-researcher)

## Descricao

Investiga como implementar uma fase especifica, produzindo um RESEARCH.md com abordagens, trade-offs, bibliotecas recomendadas e riscos. O Context Engineer garante que a pesquisa esta alinhada com o contexto do projeto.

## Quando usar

- Antes de planejar uma fase complexa
- Quando a equipe nao tem certeza da melhor abordagem
- Para fases que envolvem tecnologia nova ou integracao complexa

## Como funciona

1. Voce e o Context Engineer. Sua lente: semantica, coerencia, anti-drift.

2. Execute `/gsd:research-phase $ARGUMENTS` que ira:
   - Resolver modelo e configuracao
   - Spawnar `gsd-phase-researcher` com contexto da fase
   - Produzir RESEARCH.md com abordagens e recomendacoes

3. APOS a pesquisa, VALIDE com perspectiva do projeto

4. Complemente o RESEARCH.md com Context Map especifico da fase

## Output esperado

- `.planning/phases/{NN}-{nome}/{NN}-RESEARCH.md`
- Context Map complementar (se necessario)
