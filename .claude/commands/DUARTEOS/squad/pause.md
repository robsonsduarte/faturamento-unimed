# Squad: Pausar Trabalho

Salva o estado atual para retomar depois sem perda de contexto.

**Motor:** GSD `pause-work`

## Descricao

Cria um handoff completo com: onde parou, o que foi feito, o que falta, decisoes tomadas e contexto necessario para retomar. Essencial quando precisa parar no meio de uma fase.

## Quando usar

- Ao encerrar uma sessao de trabalho no meio de uma fase
- Quando precisa trocar de contexto temporariamente
- Antes de fechar o Claude Code com trabalho em andamento

## Como funciona

1. Execute `/gsd:pause-work`
2. O GSD salva estado em `.planning/STATE.md` com:
   - Ponto exato onde parou
   - Arquivo de resume para retomar
   - Contexto acumulado da sessao

## Para retomar

Use `/DUARTEOS:squad:resume`

## Output esperado

`.planning/STATE.md` atualizado com handoff completo
