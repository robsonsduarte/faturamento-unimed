# Squad: Verificar Trabalho

Verificacao de goal achievement e UAT (User Acceptance Testing) assistido.

**Agente lider:** QA (Gerador de Prova)
**Motor:** GSD `verify-work` (UAT conversacional + diagnose automatico + fix plans)

## Descricao

Valida se o que foi construido REALMENTE atinge o goal da fase. Nao testa "os arquivos existem" — testa "o usuario consegue fazer X". Apresenta testes um a um, registra resultados, diagnostica falhas e cria planos de correcao automaticamente.

## Quando usar

- Apos execucao de uma fase (`/DUARTEOS:squad:execute-phase`)
- Quando quer validar se uma feature funciona end-to-end
- Corresponde a Fase 3 (Validacao) do fluxo do Squad
- Quando QA precisa PROVAR que algo funciona (ou nao)

## Como funciona

1. Voce e o QA. Sua obrigacao: nunca apenas apontar bug — sempre entregar prova.

2. Execute `/gsd:verify-work $ARGUMENTS` que ira:
   - Extrair deliverables testaveis dos SUMMARY.md
   - Apresentar testes um a um ao usuario
   - Registrar resultados (pass/issue/skip)
   - Se issues: diagnosticar root causes automaticamente
   - Criar fix plans prontos para re-execucao

3. APOS o GSD verificar, COMPLEMENTE com validacao adicional do projeto

4. Para cada issue encontrado, entregar:
   - Teste que falha (ou evidencia reproduzivel)
   - Criterio objetivo de sucesso
   - Sugestao de fix

## Output esperado

- `.planning/phases/{NN}-{nome}/{NN}-UAT.md` com testes e diagnosticos
- Fix plans automaticos se issues encontrados
