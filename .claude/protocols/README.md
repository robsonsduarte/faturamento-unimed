# Protocolos DuarteOS

Documentos formais que definem regras, convencoes e processos do sistema.

## Documentos

| Protocolo | Descricao | Referenciado por |
|-----------|-----------|------------------|
| `CONSTITUTION.md` | Principios inviolaveis (seguranca, qualidade, etica, processo) | Todos os agentes |
| `GOVERNANCE.md` | Convencoes de nomenclatura e ciclo de vida de entidades | Todos os agentes |
| `CONFIG-PROTOCOL.md` | Sistema de configuracao em 4 camadas | Todos os agentes |
| `SYNAPSE.md` | Maquina de estados dos agentes | Todos os agentes |
| `QUALITY-GATES.md` | Pipeline de validacao com 9 gates | Hooks + agentes |
| `IDE-SYNC.md` | Sincronizacao de configs para multiplas IDEs | Comando sync-ide |
| `AGENT-GSD-PROTOCOL.md` | Integracao Agente ↔ GSD: manifests, guards, cadeia de autorizacao, workflows | Todos os agentes |

## Hierarquia

```
CONSTITUTION.md           ← Nivel mais alto: principios absolutos
  ↓
GOVERNANCE.md             ← Regras de nomenclatura e versionamento
  ↓
CONFIG-PROTOCOL.md        ← Como configurar o sistema (4 layers)
SYNAPSE.md                ← Como rastrear estado dos agentes
QUALITY-GATES.md          ← Como validar qualidade do codigo
IDE-SYNC.md               ← Como sincronizar configs entre IDEs
AGENT-GSD-PROTOCOL.md     ← Como agentes invocam o motor GSD
```

## Leitura Obrigatoria

No inicio de cada sessao, todo agente deve ler:
1. `CONSTITUTION.md` — sempre
2. `CONFIG-PROTOCOL.md` — para aplicar configuracoes corretas
3. `SYNAPSE.md` — para atualizar seu estado
4. `AGENT-GSD-PROTOCOL.md` — para saber seus subcomandos GSD

Os demais protocolos sao consultados sob demanda.
