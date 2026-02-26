# Protocolo Synapse — Maquina de Estados dos Agentes

## Visao Geral

O Synapse e o sistema de rastreamento de estado dos agentes DuarteOS.
Cada agente mantem um arquivo YAML em `.claude/synapse/{agent-id}.yaml`
que registra seu estado atual, task em execucao e historico de transicoes.

## Estados

| Estado | Descricao | Indicador |
|--------|-----------|-----------|
| `idle` | Sem task atribuida, aguardando ativacao | ⚪ |
| `activated` | Invocado, carregando contexto (constitution, config, memory) | 🔵 |
| `analyzing` | Lendo codigo, mapeando estado atual do sistema | 🟡 |
| `planning` | Definindo plano de acao, avaliando abordagens | 🟠 |
| `executing` | Implementando: escrevendo codigo, criando arquivos | 🟢 |
| `reviewing` | Validando resultado: testes, lint, verificacao visual | 🟣 |
| `blocked` | Esperando input externo, outro agente, ou recurso indisponivel | 🔴 |
| `completed` | Task finalizada com sucesso | ✅ |

## Transicoes Validas

```
idle → activated → analyzing → planning → executing → reviewing → completed
                                              ↕           ↕
                                           blocked ←→ (retorna ao estado anterior)
```

Regras:
- Toda sessao comeca em `idle` → `activated`
- `blocked` pode ocorrer a partir de qualquer estado ativo
- De `blocked`, retorna ao estado anterior quando desbloqueado
- `completed` e estado terminal — nova task reinicia em `idle`
- Transicoes devem ser registradas com timestamp

## Formato do Arquivo de Estado

`.claude/synapse/{agent-id}.yaml`:

```yaml
agent: {CODENAME}
state: idle
task: null
started: null
last_transition: null
transitions: []
blocked_by: null
notes: null
```

## Como Agentes Devem Atualizar

1. Ao ser invocado: `state: activated`, registrar task e timestamp
2. Ao mudar de fase: adicionar entrada em `transitions` com `{from, to, at, reason}`
3. Ao bloquear: `state: blocked`, preencher `blocked_by` com motivo
4. Ao desbloquear: voltar ao estado anterior, limpar `blocked_by`
5. Ao concluir: `state: completed`, registrar resultado em `notes`
6. Ao encerrar sessao: manter ultimo estado (nao resetar para idle)

## Integracao com Squad

O PM (ATLAS) pode consultar `/squad:synapse` para ver o dashboard
de estados de todos os agentes e identificar gargalos.
