# Synapse — Estado dos Agentes

Este diretorio armazena o estado atual de cada agente DuarteOS.

## Estrutura

```
.claude/synapse/
  template.yaml     — template para novos agentes
  {agent-id}.yaml   — estado individual (criado automaticamente)
```

## Arquivos de Estado

Cada agente cria seu proprio arquivo ao ser ativado pela primeira vez.
O arquivo persiste entre sessoes para rastrear continuidade.

## Protocolo

Veja `.claude/protocols/SYNAPSE.md` para regras completas.

## Estados Possiveis

```
idle → activated → analyzing → planning → executing → reviewing → completed
                                            ↕
                                          blocked
```
