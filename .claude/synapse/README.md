# Synapse — Memoria Viva dos Agentes

Este diretorio armazena o estado, DNA cognitivo e conhecimento consolidado do ecossistema DuarteOS.

## Arquitetura

```
.claude/synapse/
  template.yaml              <- template de estado para agentes core
  {agent-id}.yaml            <- estado individual (criado automaticamente)

  minds/                     <- DNA incremental dos mind clones
    {nome}.yaml              <- DNA em 5 camadas + metadata + ingestion log
    _index.yaml              <- indice de todos os clones com status

  dossiers/                  <- dossies tematicos compilados
    {tema}.yaml              <- conhecimento consolidado por tema
    _index.yaml              <- indice de dossies disponiveis

  ingestion/                 <- log de ingestao de conteudo
    {YYYY-MM-DD}-{slug}.yaml <- registro de cada ingestao

  mind-template.yaml         <- template para DNA de mind clones
  dossier-template.yaml      <- template para dossies tematicos
```

## Camadas do Sistema

### 1. Estado dos Agentes (existente)

Cada agente core cria seu arquivo YAML ao ser ativado pela primeira vez.
O arquivo persiste entre sessoes para rastrear continuidade.

- **Template:** `template.yaml`
- **Formato:** `{agent-id}.yaml`
- **Protocolo:** `.claude/protocols/SYNAPSE.md`

### 2. DNA de Mind Clones (novo)

Cada mind clone tem um arquivo YAML com 5 camadas cognitivas:

| Camada | O que captura |
|--------|---------------|
| Filosofia | Crencas fundamentais, visao de mundo, principios inegociaveis |
| Frameworks | Passos-a-passo, modelos de decisao, estruturas de pensamento |
| Heuristicas | Atalhos mentais, regras de bolso, red flags |
| Metodologias | Processos repetiveis, ferramentas preferidas |
| Dilemas | Trade-offs tipicos, zonas cinza, evolucao de posicoes |

- **Template:** `mind-template.yaml`
- **Formato:** `minds/{nome}.yaml`
- **Indice:** `minds/_index.yaml`
- **Comando:** `/DUARTEOS:squad:clone-mind`

### 3. Dossies Tematicos (novo)

Conhecimento consolidado por tema, cruzando perspectivas de multiplos experts.

- **Template:** `dossier-template.yaml`
- **Formato:** `dossiers/{tema}.yaml`
- **Indice:** `dossiers/_index.yaml`
- **Comando:** `/DUARTEOS:squad:dossie` (futuro)

### 4. Log de Ingestao (novo)

Registro de cada conteudo processado para rastreabilidade completa.

- **Formato:** `ingestion/{YYYY-MM-DD}-{slug}.yaml`
- Cada entrada vincula: fonte, mind clone atualizado, camadas impactadas, insights extraidos

## Estados Possiveis (Agentes Core)

```
idle -> activated -> analyzing -> planning -> executing -> reviewing -> completed
                                                 |            |
                                              blocked <-> (retorna ao estado anterior)
```

## Protocolo

Veja `.claude/protocols/SYNAPSE.md` para regras completas de:
- Maquina de estados dos agentes
- Memoria incremental e DNA de mind clones
- Dossies tematicos e log de ingestao
