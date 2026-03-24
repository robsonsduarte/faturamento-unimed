# Squad: Synapse — Dashboard de Estado dos Agentes

Mostra o estado atual de todos os agentes do squad DuarteOS.

## Uso

```
/DUARTEOS:squad:synapse              — dashboard completo
/DUARTEOS:squad:synapse [agent-id]   — estado de um agente especifico
```

## Como funciona

1. Leia todos os arquivos `.yaml` em `.claude/synapse/` (exceto template.yaml)
2. Para cada arquivo, extraia: agent, state, task, started, blocked_by
3. Apresente em formato tabular:

```
| Agente   | Estado     | Task                | Inicio | Bloqueado por |
|----------|------------|---------------------|--------|---------------|
| ATLAS    | idle       | —                   | —      | —             |
| NEXUS    | executing  | auth system         | 10:00  | —             |
| FORGE    | blocked    | API endpoints       | 09:30  | NEXUS         |
| PRISM    | reviewing  | dashboard UI        | 09:45  | —             |
| SENTINEL | completed  | test suite auth     | 08:00  | —             |
```

4. Resumo:
   - Total de agentes rastreados
   - Agentes ativos (nao-idle)
   - Agentes bloqueados (com motivo)
   - Ultimo agente a completar task

5. Se houver agentes `blocked`:
   - Identifique a causa do bloqueio
   - Sugira acoes de desbloqueio
   - Se bloqueado por outro agente, indique qual task precisa ser concluida primeiro

## Acoes Disponiveis

Apos mostrar o dashboard, pergunte ao usuario:
- Desbloquear um agente? (requer resolver a dependencia)
- Resetar estado de um agente? (volta para idle)
- Ver historico de transicoes de um agente?
