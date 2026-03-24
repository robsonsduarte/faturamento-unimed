# Squad: Retomar Trabalho

Restaura o estado da ultima sessao e continua de onde parou.

**Motor:** GSD `resume-work`

## Descricao

Le o handoff salvo por `/DUARTEOS:squad:pause` e restaura todo o contexto necessario para continuar o trabalho. Inclui: fase atual, progresso, decisoes tomadas e proximo passo.

## Quando usar

- Ao iniciar uma nova sessao de trabalho
- Apos ter usado `/DUARTEOS:squad:pause` anteriormente
- Quando o Claude Code foi reiniciado no meio de uma fase

## Como funciona

1. Execute `/gsd:resume-work`
2. O GSD restaura:
   - Estado da fase em andamento
   - Progresso de planos executados
   - Contexto acumulado
   - Proximo passo recomendado

## Output esperado

Contexto restaurado + recomendacao do proximo passo
