# Squad: Discutir Fase

Captura decisoes de implementacao antes de planejar — elimina ambiguidade.

**Agente Lider:** COMPASS (Context Engineer)
**Invocacao:** PM (ATLAS) spawna COMPASS via Task tool para executar este comando
**Motor:** GSD `discuss-phase` (questionamento interativo de gray areas)

## Descricao

Identifica "gray areas" de uma fase (decisoes que impactam a implementacao) e conduz questionamento estruturado para capturar as preferencias do usuario. Produz CONTEXT.md que alimenta pesquisador e planejador.

## Quando usar

- Antes de planejar uma fase (SEMPRE recomendado)
- Quando ha decisoes de UX, comportamento ou escopo nao resolvidas
- Quando o Context Engineer precisa eliminar ambiguidade
- Para fases com multiplas abordagens possiveis

## Como funciona

1. COMPASS conduz a discussao como Context Engineer: identifica ambiguidades, mapeia gray areas e captura decisoes que definem o contexto da fase.

2. Execute `/gsd:discuss-phase $ARGUMENTS` que ira:
   - Analisar a fase para identificar gray areas
   - Apresentar areas de decisao (multiSelect)
   - Para cada area: 4 perguntas com opcoes rapidas
   - Produzir CONTEXT.md com todas as decisoes

3. DURANTE a discussao, aplique perspectiva do projeto:
   - Como isso afeta os usuarios finais?
   - Qual o impacto na arquitetura existente?
   - Ha implicacoes de seguranca ou performance?

4. Capture decisoes que o GSD nao perguntaria (especificas do dominio)

## Flags disponiveis

- `--auto` — extrai decisoes de documento fornecido sem questionamento interativo

## Output esperado

- `.planning/phases/{NN}-{nome}/{NN}-CONTEXT.md` com decisoes capturadas
