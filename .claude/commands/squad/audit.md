# Squad: Auditar Milestone

Verifica se o milestone atingiu sua definition of done.

**Agentes envolvidos:** QA (prova) + Context Engineer (coerencia) + Advogado do Diabo (contestacao)
**Motor:** GSD `audit-milestone`

## Descricao

Auditoria completa de um milestone antes de marca-lo como concluido. Verifica se todas as fases passaram, requirements foram atendidos e o produto esta em estado shipavel. Aplica os 3 agentes de validacao do Squad simultaneamente.

## Quando usar

- Antes de completar um milestone
- Quando quer validar se o projeto esta pronto para producao
- Como gate final de qualidade do Squad

## Como funciona

1. Execute `/gsd:audit-milestone`

2. O GSD verifica:
   - Todas as fases completas
   - Requirements tracados
   - Verificacoes passaram

3. COMPLEMENTE com validacao do Squad:

   **QA (Gerador de Prova):**
   - Lint passa?
   - Type check passa?
   - Testes existentes passam?
   - Seguranca validada?

   **Context Engineer:**
   - Coerencia entre modulos?
   - Contexto propagado corretamente?
   - Sem drift semantico?

   **Advogado do Diabo:**
   - O que pode quebrar em producao?
   - Migracao de banco segura?
   - Feature flags para rollback?

4. Veredito: APROVADO | REQUER CORRECOES

## Output esperado

Relatorio de auditoria consolidado com 3 perspectivas + veredito final
