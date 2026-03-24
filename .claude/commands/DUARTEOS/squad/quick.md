# Squad: Task Rapida

Executa uma tarefa ad-hoc pequena com garantias de qualidade GSD.

**Motor:** GSD `quick` (planner → executor → optional verifier)

## Roteamento de Agente

Este comando e roteado pelo PM (ATLAS) para o agente mais adequado:
- **Task de backend** (API, DB, logica de negocio) → FORGE (Backend)
- **Task de frontend** (UI, componentes, estilos) → PRISM (Frontend)
- **Task de infraestrutura** (Docker, CI/CD, deploy) → VAULT (DevOps)
- **Task full-stack** (DB a UI) → BRIDGE (Fullstack)

O PM NAO executa a task — spawna o agente correto com o contexto da demanda.

## Descricao

Para tarefas pequenas que nao justificam uma fase completa. Cria um plano simples (1-3 tasks), executa com commits atomicos e opcionalmente verifica o resultado. Rastreado em STATE.md para historico.

## Quando usar

- Bug fix simples e pontual
- Adicionar campo no banco + ajustar UI
- Qualquer task que cabe em 1-3 passos atomicos
- Quando nao quer overhead de fase completa

## Como funciona

1. Execute `/gsd:quick $ARGUMENTS` onde $ARGUMENTS descreve a tarefa

2. O GSD ira:
   - Calcular proximo numero sequencial
   - Spawnar `gsd-planner` em modo quick (1 plano, 1-3 tasks)
   - Spawnar `gsd-executor` para executar
   - Se `--full`: tambem plan-checker + verifier

## Flags disponiveis

- `--full` — adiciona plan-checker (max 2 iteracoes) + verificacao pos-execucao

## Exemplos de uso

```
/DUARTEOS:squad:quick corrigir validacao de input no endpoint X
/DUARTEOS:squad:quick adicionar campo Y na tabela Z
/DUARTEOS:squad:quick --full implementar helper para formatacao de dados
```

## Output esperado

- `.planning/quick/{NNN}-{slug}/` com PLAN.md + SUMMARY.md
- Commits atomicos
- VERIFICATION.md (se --full)
