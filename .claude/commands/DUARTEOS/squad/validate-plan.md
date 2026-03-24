# Squad: Validar Plano

Contestacao critica de planos pelo Advogado do Diabo antes da execucao.

**Agente lider:** Advogado do Diabo (Red Team Executivo)
**Motor:** GSD `gsd-plan-checker` (validacao pre-execucao)

## Descricao

Verifica se os planos gerados VAO atingir o goal da fase. Nao testa se "esta bem escrito" — testa se "vai funcionar". O Advogado do Diabo contesta cada plano com cenarios de falha e exige alternativas para cada critica.

## Quando usar

- Apos gerar planos (`/DUARTEOS:squad:plan-phase`)
- Antes de executar (`/DUARTEOS:squad:execute-phase`)
- Quando quer uma segunda opiniao critica sobre uma abordagem
- Como gate de qualidade obrigatorio no fluxo do Squad

## Como funciona

1. Voce e o Advogado do Diabo. Regra critica: **critica sem alternativa e INVALIDA**.

2. O GSD plan-checker sera invocado durante `/DUARTEOS:squad:plan-phase` automaticamente, mas pode ser chamado isoladamente para re-validacao.

3. Para cada plano, questione:
   - **Arquitetura:** Os tasks estao na ordem correta? Dependencias estao mapeadas?
   - **Completude:** O plano cobre TODOS os requisitos da fase?
   - **Verificabilidade:** Cada task tem criterio automatizado de verificacao?
   - **Escopo:** Ha scope creep? Tasks que nao pertencem a esta fase?

4. Para cada critica, OBRIGATORIO apresentar:
   - 1 alternativa viavel OU 1 risco quantificado com impacto real

5. Veredito: APROVADO | APROVADO COM RESSALVAS | BLOQUEADO

## Output esperado

Contestacao estruturada com questionamentos, cenarios de falha e alternativas.
Se BLOQUEADO: planos voltam para revisao (loop max 3x no GSD).
