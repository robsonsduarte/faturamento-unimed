# Protocolo do Process Chief — Regra Obrigatoria

> **REGRA ABSOLUTA:** Toda e qualquer tarefa — sem excecao — DEVE passar pelo crivo do Process Chief antes de ser executada por qualquer agente.

## O Que E o Process Chief

O Process Chief e um agente baseado na mente de W. Edwards Deming que integra as 5 lentes do Conselho de Process (Deming, Allen, Forte, Gawande, Kahneman). Sua funcao e garantir que toda tarefa tenha processo definido, metricas claras, e quality gate OMEGA.

**Arquivo do agente:** `.claude/commands/agents/process-chief.md`
**Conselho completo:** `.claude/commands/DUARTEOS/conselho/process.md`

## Fluxo Obrigatorio — ATLAS + Process Chief

```
USUARIO pede tarefa
  |
  v
ATLAS (PM) recebe demanda
  |
  v
ATLAS spawna PROCESS CHIEF (obrigatorio)
  |
  v
PROCESS CHIEF:
  1. Classifica demanda (tipo, escala, risco)
  2. Verifica processo existente em .claude/protocols/processes/
  3. Desenha Process Card OU seleciona Quick Process
  4. Define parametros OMEGA (task_type, threshold)
  5. Retorna: Process Card + instrucoes
  |
  v
ATLAS recebe Process Card
  |
  v
ATLAS delega ao agente correto COM processo anexado
  |
  v
AGENTE executa seguindo o processo
  |
  v
OMEGA valida qualidade (quality gate)
  |
  v
PROCESS CHIEF valida aderencia (process gate — se risco >= medio)
  |
  v
ATLAS entrega ao usuario
```

## Niveis de Intervencao

| Escala da tarefa | Risco | Process Chief faz... |
|-----------------|-------|----------------------|
| Micro (<30min) | Baixo | Quick Process (3-5 steps + checkpoint) |
| Micro (<30min) | Medio+ | Process Card simplificada |
| Tarefa (30min-4h) | Baixo | Process Card padrao |
| Tarefa (30min-4h) | Medio | Process Card + bias alerts |
| Tarefa (30min-4h) | Alto | Process Card + premortem + Conselho parcial (2-3 membros) |
| Projeto (>4h) | Qualquer | Conselho completo (5 membros) |
| Projeto | Critico | Conselho completo + noise audit + piloto |

## Como ATLAS Spawna o Process Chief

```
Agent tool → subagent_type: "general-purpose"
name: "Process Chief"
prompt: "Voce e o Process Chief. Leia `.claude/commands/agents/process-chief.md` e
`.claude/protocols/PROCESS-CHIEF.md`. Carregue a mente de Deming.

DEMANDA: {descricao da tarefa}
CONTEXTO: {contexto relevante}
AGENTE DESTINO: {backend|frontend|architect|qa|etc}

Retorne:
1. Classificacao (tipo, escala, risco)
2. Process Card ou Quick Process
3. Parametros OMEGA
4. Alertas de vieses (se aplicavel)
5. Premortem (se risco >= medio)"
```

## Processos Reutilizaveis

Processos que se repetem devem ser salvos em `.claude/protocols/processes/` para reutilizacao:

```
.claude/protocols/processes/
  |-- feature-implementation.yaml
  |-- bug-fix.yaml
  |-- code-review.yaml
  |-- design-component.yaml
  |-- api-endpoint.yaml
  |-- database-migration.yaml
  |-- mind-clone.yaml  (ja existe: MMOS-PIPELINE.md)
  |-- research-task.yaml
  |-- documentation.yaml
```

Quando um processo e usado 3+ vezes com sucesso, ele e PADRONIZADO e salvo aqui.

## Ciclo PDSA de Melhoria

Apos cada execucao, o Process Chief registra:

```yaml
pdsa_record:
  processo: "{nome}"
  data: "{YYYY-MM-DD}"
  predicao: "{o que esperavamos}"
  resultado: "{o que aconteceu}"
  aprendizado: "{o que aprendemos}"
  acao: "padronizar | revisar | escalar | quarentena"
  variacao: "dentro_limites | fora_limites"
```

Processos fora de controle por 3 ciclos → quarentena → redesign obrigatorio.

## Regras Inegociaveis

1. **Sem processo = sem execucao.** Nenhum agente recebe tarefa sem Process Card ou Quick Process.
2. **OMEGA em tudo.** Todo processo inclui quality gate com threshold definido.
3. **Processo e hipotese.** Revisavel via PDSA, nunca dogma.
4. **Sistema > Parte.** Nunca otimizar uma parte destruindo o todo.
5. **O trabalhador nao e o problema.** Se o processo falha, o processo precisa mudar.
6. **Dados > Opiniao.** Variacao medida, nao impressoes coletadas.
7. **Reutilizar > Criar.** Sempre verificar processos existentes antes de desenhar novos.
8. **Constancia de proposito.** Processos nao mudam por modismo, mudam por evidencia.
