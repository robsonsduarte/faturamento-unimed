# Squad: Debug Sistematico

Investigacao de bugs com metodo cientifico e estado persistente.

**Motor:** GSD `debug` (gsd-debugger com sessoes persistentes)

## Agente Lider: SENTINEL (QA)

Este comando e executado pelo SENTINEL (QA). O PM (ATLAS) invoca este comando SPAWNANDO o SENTINEL. O SENTINEL lidera a investigacao cientifica do bug usando o motor GSD. O PM NUNCA executa debug diretamente — ele delega ao SENTINEL e aguarda o relatorio.

## Descricao

Debug sistematico que mantem estado de investigacao entre sessoes. Usa metodo cientifico: hipotese → teste → conclusao. Inclui protecoes contra bias cognitivo (confirmation bias, anchoring, sunk cost). O estado persiste em `.planning/debug/` para retomar investigacao.

## Quando usar

- Quando um bug e complexo e nao obvio
- Quando ja tentou corrigir 2x sem sucesso (regra do 2x)
- Quando o bug envolve multiplos modulos
- Quando precisa de investigacao estruturada com evidencia

## Como funciona

1. Execute `/gsd:debug $ARGUMENTS` onde $ARGUMENTS descreve o bug

2. O debugger ira:
   - Criar sessao persistente em `.planning/debug/{slug}.md`
   - Seguir metodo cientifico: observar → hipotese → testar → concluir
   - Manter historico de hipoteses testadas (evita repetir)
   - Documentar root cause com evidencia
   - Sugerir fix com criterio de verificacao

3. Protecoes anti-bias integradas:
   - **Confirmation Bias:** testa hipotese contraria tambem
   - **Anchoring:** nao se prende a primeira hipotese
   - **Sunk Cost:** abandona linha de investigacao apos 3 tentativas falhas
   - **Availability Bias:** considera causas menos obvias

## Output esperado

- `.planning/debug/{slug}.md` com investigacao completa
- Root cause documentado com evidencia
- Sugestao de fix com criterio de verificacao
