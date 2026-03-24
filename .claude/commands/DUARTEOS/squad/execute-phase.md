# Squad: Executar Fase

Execucao de todos os planos de uma fase com paralelismo wave-based e commits atomicos.

**Agentes envolvidos:** Backend + Frontend (executores) + QA (verificacao pos-execucao)
**Motor:** GSD `execute-phase` (wave-based parallel execution + verifier)

## Descricao

Executa todos os PLAN.md de uma fase usando wave-based parallelism. Cada executor recebe 200k tokens de contexto fresco. Apos todas as waves, o verificador valida se o goal da fase foi atingido. Cada task gera um commit atomico.

## Quando usar

- Apos planos aprovados (PLAN.md files existem e foram validados)
- Corresponde a Fase 2 (Implementacao Incremental) do fluxo do Squad
- Quando o usuario aprovou o plano de execucao

## Como funciona

1. Voce coordena Backend e Frontend como executores, com QA verificando ao final

2. Execute `/gsd:execute-phase $ARGUMENTS` que ira:
   - Agrupar planos em waves por dependencia
   - Wave 1: spawnar executores em paralelo (cada com contexto fresco)
   - Wave 2: aguardar Wave 1, spawnar proximos
   - Cada executor: implementa tasks, commita cada uma individualmente
   - Verificador: valida goal achievement, cria VERIFICATION.md

3. DURANTE a execucao, monitore:
   - Commits estao atomicos e focados?
   - Padroes do projeto estao sendo seguidos?
   - Nao esta expandindo escopo alem do PLAN.md?

4. APOS a execucao, revise VERIFICATION.md:
   - Os criterios objetivos da fase foram atingidos?
   - O QA deveria rodar testes adicionais?
   - Ha gaps que precisam de fix plans?

## Flags disponiveis

- `--gaps-only` — executa apenas planos de gap closure
- `--auto` — executa sem parar para confirmacao

## Output esperado

- Commits atomicos por task
- `.planning/phases/{NN}-{nome}/{NN}-{MM}-SUMMARY.md` por plano
- `.planning/phases/{NN}-{nome}/{NN}-VERIFICATION.md`
