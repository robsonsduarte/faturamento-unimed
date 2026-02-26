---
status: diagnosed
trigger: "Cannot read properties of null (reading 'toFixed') em producao"
created: 2026-02-26T00:00:00Z
updated: 2026-02-26T00:00:00Z
---

## Current Focus

hypothesis: CONFIRMADA - valorProcedimentos pode ser null em tiss.ts linhas 344 e 353
test: Analise estatica do codigo + schema do banco
expecting: Caminho onde null atinge .toFixed() sem guarda
next_action: Aplicar fix nas linhas vulneraveis

## Symptoms

expected: Valores monetarios formatados corretamente com toFixed()
actual: TypeError - Cannot read properties of null (reading 'toFixed')
errors: Cannot read properties of null (reading 'toFixed')
reproduction: Gerar XML TISS para lote contendo guia cujos procedimentos tem valor_total=NULL no DB E guia.valor_total=0
started: Desconhecido (container reiniciou, logs antigos perdidos)

## Eliminated

- hypothesis: Erro em frontend (formatCurrency nas paginas dashboard)
  evidence: formatCurrency usa Intl.NumberFormat.format() que nao chama toFixed e trata null como NaN
  timestamp: 2026-02-26

- hypothesis: Erro em buildProcedimento (linhas 159-160)
  evidence: Usa fallback chain (proc.valor_total ?? valorPerProc ?? 0).toFixed(2) - 0 e o fallback final, nunca null
  timestamp: 2026-02-26

- hypothesis: Erro em formatDecimal2 (linhas 181-186)
  evidence: Funcao tem guards para typeof + fallback numerico, nunca chama toFixed em null
  timestamp: 2026-02-26

## Evidence

- timestamp: 2026-02-26
  checked: Container Docker faturamento-unimed logs
  found: Container reiniciado 18min atras, apenas 28 linhas de log, nenhum erro toFixed nos logs atuais
  implication: Logs antigos perdidos no restart, erro ocorreu antes do restart

- timestamp: 2026-02-26
  checked: Todas as 12 chamadas a .toFixed() no codebase src/
  found: 3 locais em tiss.ts sem null guard adequado (linhas 272, 344, 353)
  implication: Erro vem da geracao de XML TISS

- timestamp: 2026-02-26
  checked: Schema DB - procedimentos.valor_total e DECIMAL(10,2) SEM DEFAULT e SEM NOT NULL
  found: procedimentos.valor_total pode ser NULL no banco (tipado como number|null em TypeScript)
  implication: Quando todos os procs tem valor_total=NULL, dbValorSum = 0

- timestamp: 2026-02-26
  checked: Schema DB - guias.valor_total e DECIMAL(10,2) DEFAULT 0
  found: Supabase retorna DECIMAL como string ou number dependendo do driver/versao
  implication: guia.valor_total pode chegar como null se importacao nao setou valor

- timestamp: 2026-02-26
  checked: Linha 272 de tiss.ts - valorProcedimentos assignment
  found: "const valorProcedimentos = dbValorSum > 0 ? dbValorSum : guia.valor_total"
  implication: Se dbValorSum=0 (procs sem valor), valorProcedimentos = guia.valor_total que pode ser null/0

- timestamp: 2026-02-26
  checked: Linha 344 - valorProcedimentos.toFixed(2)
  found: Chamado sem null guard quando hasValue(xml?.valorTotal.valorProcedimentos) e false
  implication: Se valorProcedimentos e null, CRASH aqui

- timestamp: 2026-02-26
  checked: Linha 353 - (guia.valor_total || valorProcedimentos).toFixed(2)
  found: Se guia.valor_total=0 (falsy), cai para valorProcedimentos que pode ser null
  implication: Segundo ponto de crash - guia.valor_total=0 e valorProcedimentos=null

## Resolution

root_cause: |
  Em src/lib/xml/tiss.ts, funcao buildGuiaContent():

  LINHA 272: `const valorProcedimentos = dbValorSum > 0 ? dbValorSum : guia.valor_total`
  Quando dbValorSum=0 (todos procedimentos com valor_total=NULL no DB), valorProcedimentos recebe guia.valor_total.
  Embora o schema tenha DEFAULT 0, o valor pode chegar como null via Supabase (importacao parcial, ou DECIMAL->null).

  LINHA 344: `valorProcedimentos.toFixed(2)` — sem null guard
  LINHA 353: `(guia.valor_total || valorProcedimentos).toFixed(2)` — operador || trata 0 como falsy,
  entao se guia.valor_total=0, cai para valorProcedimentos que tambem pode ser null.

  Cenario que reproduz: Guia com valor_total=0 ou null, procedimentos sem valores individuais,
  SAW XML sem valorProcedimentos valido → toFixed chamado em null → TypeError.

fix:
verification:
files_changed: []
