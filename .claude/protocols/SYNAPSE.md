# Protocolo Synapse — Memoria Viva dos Agentes

## Visao Geral

O Synapse e o sistema de memoria viva do ecossistema DuarteOS.
Alem de rastrear o estado dos agentes core, o Synapse armazena o DNA
cognitivo dos mind clones e consolida conhecimento em dossies tematicos.

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

### Registro OMEGA no Synapse

O Synapse registra o historico de scores OMEGA por agente como parte da memoria incremental. Cada agent state file (`.claude/synapse/{agente}.yaml`) pode incluir:

```yaml
omega_history:
  last_score: {0-100}
  last_task_type: "{type}"
  last_iteration: {1-3}
  last_result: "{completed|escalated|circuit_open}"
  session_scores:
    - date: "{YYYY-MM-DD}"
      task: "{descricao}"
      score: {N}
      result: "{completed|escalated}"
```

**Regras de registro:**
1. Atualizar `omega_history` apos cada task finalizada (completed ou escalated)
2. Manter apenas as ultimas 10 entradas em `session_scores` (FIFO)
3. Se um agente consistentemente fica abaixo do threshold (3+ vezes consecutivas), registrar flag `needs_attention: true`
4. Scores OMEGA sao READ-ONLY para o agente — apenas o protocolo OMEGA pode atualizar

**Uso:** O PM (ATLAS) pode consultar `omega_history` dos agentes para decidir delegacao. Um agente com historico de scores baixos em `implementation` pode ser substituido por outro para tasks criticas.

## Integracao com Squad

O PM (ATLAS) pode consultar `/DUARTEOS:squad:synapse` para ver o dashboard
de estados de todos os agentes e identificar gargalos.

---

## Memoria Incremental

O Synapse opera como memoria incremental — nunca sobrescreve, sempre adiciona.
Cada nova ingestao de conteudo (video, PDF, artigo, podcast) enriquece o DNA
existente do mind clone, adicionando crencas, frameworks e heuristicas sem
perder o historico anterior.

Principios:
- **Acumulativo:** cada ingestao adiciona, nunca substitui
- **Versionado:** `versao_dna` incrementa a cada atualizacao
- **Rastreavel:** cada insight vinculado a sua fonte original
- **Cross-source:** um mind clone pode ter DNA de multiplas fontes

Estrutura expandida:

```
.claude/synapse/
  template.yaml              <- template de estado (agentes core)
  {agent-id}.yaml            <- estado dos agentes core

  minds/                     <- DNA incremental dos mind clones
    {nome}.yaml              <- DNA em 6 camadas + metadata
    _index.yaml              <- indice de todos os clones

  dossiers/                  <- dossies tematicos compilados
    {tema}.yaml              <- conhecimento consolidado por tema
    _index.yaml              <- indice de dossies

  ingestion/                 <- log de ingestao de conteudo
    {YYYY-MM-DD}-{slug}.yaml <- registro de cada ingestao

  mind-template.yaml         <- template para DNA de mind clones
  dossier-template.yaml      <- template para dossies tematicos
```

## DNA de Mind Clones — 6 Camadas

Cada mind clone tem seu DNA estruturado em 6 camadas cognitivas
armazenadas em `.claude/synapse/minds/{nome}.yaml`.

### Camada 1: Filosofia

**O QUE a pessoa acredita ser verdade.**

Captura crencas fundamentais, visao de mundo e principios inegociaveis.
Esta camada define o "norte" do mind clone — suas convicoes mais profundas
que influenciam todas as outras decisoes.

Campos:
- `crencas_core` — lista de crencas com evidencia/fonte
- `visao_de_mundo` — como ve o mundo (otimista, realista, cetico, etc)
- `principios_inegociaveis` — linhas que nunca cruza

### Camada 2: Frameworks

**COMO a pessoa estrutura pensamento.**

Passos-a-passo e modelos mentais que o expert usa para resolver problemas.
Frameworks sao receitas replicaveis — se alguem seguir os mesmos passos,
tende a chegar a conclusoes similares.

Campos:
- `primarios` — lista de frameworks com nome, steps e quando usar
- `modelo_decisao` — como decide (dados vs intuicao, rapido vs deliberado)

### Camada 3: Heuristicas

**REGRAS DE BOLSO para decisoes rapidas.**

Atalhos mentais, padroes de reconhecimento e sinais de alerta.
Heuristicas sao o "fast thinking" do expert — respostas automaticas
baseadas em experiencia acumulada.

Campos:
- `regras_rapidas` — lista de trigger/acao/fonte
- `vieses_conhecidos` — vieses que o expert reconhece em si mesmo
- `red_flags` — sinais que fazem parar imediatamente

### Camada 4: Metodologias

**SISTEMAS e processos repetiveis.**

Diferente de frameworks (modelos mentais), metodologias sao processos
operacionais completos com etapas definidas e ferramentas especificas.

Campos:
- `processos` — lista de metodologias com nome, descricao e etapas
- `ferramentas_preferidas` — ferramentas/tecnicas que sempre recomenda

### Camada 5: Dilemas

**TENSOES que reconhece e como as resolve.**

Trade-offs tipicos, zonas cinza e evolucao de posicoes ao longo do tempo.
Esta camada captura a maturidade intelectual do expert — onde admite
incerteza e como mudou de opiniao.

Campos:
- `tradeoffs_tipicos` — lista de tensao/posicao/justificativa
- `zonas_cinza` — areas sem resposta definitiva
- `evolucao` — mudancas de posicao com periodo e motivo

### Camada 6: Paradoxos Produtivos

**CONTRADICOES internas que criam comportamento humano.**

Pessoas reais sao contraditorias — e isso e o que as torna autentificavelmente
humanas. Esta camada captura paradoxos produtivos: posicoes aparentemente
opostas que a pessoa sustenta simultaneamente em diferentes contextos.

Esta e a "camada ouro" da clonagem mental. Inspirada no conceito de
"Productive Paradoxes" do sistema MMOS (DNA Mental 8-Layer), adaptada
para o framework de 6 camadas do DuarteOS.

**Peso na fidelidade:** 35% do score total de validacao.

Campos:
- `paradoxos` — lista de paradoxos com:
  - `lado_a` / `lado_b` — as duas posicoes opostas
  - `trigger_a` / `trigger_b` — contextos que ativam cada lado
  - `resolucao` — como a pessoa reconcilia internamente
  - `exemplos` — evidencias com fonte e citacao
  - `valor_autenticidade` — quanto este paradoxo contribui para autenticidade
- `nota_camada` — observacao geral sobre os paradoxos deste expert

Requisitos de triangulacao:
- Minimo 2 paradoxos por clone
- Cada paradoxo precisa >= 3 fontes independentes
- Paradoxos com apenas 1 fonte sao marcados como "nao-confirmado"

Exemplos de paradoxos comuns:
- "Prega simplicidade, cria sistemas complexos" (contexto: teoria vs implementacao)
- "Defende humildade, demonstra confianca absoluta" (contexto: ensino vs debate)
- "Valoriza dados, decide por intuicao" (contexto: analise vs acao rapida)
- "Promove autonomia, centraliza decisoes criticas" (contexto: rotina vs crise)

## Dossies Tematicos

Dossies sao compilacoes de conhecimento por tema, cruzando perspectivas
de multiplos mind clones. Armazenados em `.claude/synapse/dossiers/{tema}.yaml`.

Diferente do DNA (que e por pessoa), dossies sao por assunto:
- **Fontes:** quais mind clones contribuiram e suas perspectivas
- **Consensos:** pontos onde a maioria concorda
- **Divergencias:** onde os experts discordam (posicao A vs B)
- **Frameworks combinados:** sinteses que misturam abordagens de varios experts
- **Recomendacao consolidada:** posicao final do dossie

Exemplo: um dossie sobre "Copywriting para SaaS" poderia cruzar
insights de Gary Halbert (persuasao direta), Eugene Schwartz (niveis
de consciencia) e Joseph Sugarman (slippery slide).

## Log de Ingestao

Cada conteudo processado gera um registro em `.claude/synapse/ingestion/`
com formato `{YYYY-MM-DD}-{slug}.yaml`.

Finalidades:
- **Rastreabilidade:** saber exatamente o que foi absorvido e quando
- **Dedup:** evitar processar o mesmo conteudo duas vezes
- **Auditoria:** vincular cada insight a sua fonte original
- **Metricas:** quantificar volume e qualidade de ingestao

Campos do registro:
- `date` — data da ingestao
- `source_type` — youtube, pdf, artigo, podcast, call, etc
- `source_url` — URL ou referencia da fonte
- `title` — titulo do conteudo
- `mind_clone` — qual clone foi atualizado
- `camadas_impactadas` — quais das 5 camadas receberam dados
- `insights` — lista de insights extraidos com camada destino
- `versao_dna_antes` — versao do DNA antes da ingestao
- `versao_dna_depois` — versao do DNA depois da ingestao

## Rastreabilidade de Fonte (Inbox → DNA)

Todo insight armazenado no Synapse deve ter rastreabilidade ate o material original.
O campo `source_path` em cada entrada do DNA aponta para o arquivo no inbox que originou o insight.

Cadeia de rastreabilidade:
```
Mind Clone (DNA YAML) → source_path → inbox/{autor}/{tipo}/{arquivo}.txt
                      → ingestion_log → date + title + source_path
```

Regras:
- **source_path obrigatorio** — todo insight novo DEVE incluir o caminho do arquivo fonte
- **Formato padrao:** `inbox/{autor-slug}/{TIPO}/{arquivo}.txt`
- **Apos processamento:** arquivo movido para `inbox/processed/{autor-slug}/`
- **Navegacao reversa:** dado qualquer insight, deve ser possivel chegar ao texto bruto original

Quando o conteudo vem de WebSearch/WebFetch (modo criacao), usar URL como referencia.
Quando vem do inbox (modo --update com arquivo local), usar `source_path` para o arquivo.

## Comandos Relacionados

| Comando | Descricao |
|---------|-----------|
| `/DUARTEOS:squad:synapse` | Dashboard de estado de todos os agentes |
| `/DUARTEOS:squad:clone-mind` | Ingestao de conteudo e geracao/atualizacao de DNA |
| `/DUARTEOS:squad:ingest` | Inbox/Caixa — ingestao local de conteudo |
| `/DUARTEOS:squad:dossie` | Compilacao de dossie tematico (futuro) |
| `/DUARTEOS:mmos:mind-clone` | Pipeline MMOS completo de clonagem (7 fases, 6 camadas, APEX/ICP) |
| `/DUARTEOS:mmos:mind-update` | Atualizacao incremental com rollback automatico |

## Integracao com clone-mind

O fluxo de ingestao via `/DUARTEOS:squad:clone-mind`:

```
1. Usuario fornece conteudo (URL, PDF, texto)
   |
2. clone-mind identifica o mind clone alvo
   |
3. Conteudo e processado e insights sao extraidos
   |
4. SE minds/{nome}.yaml existe:
   |   -> Edit incremental: adiciona novos insights nas camadas
   |   -> Incrementa versao_dna
   |   -> Adiciona entrada no ingestion_log interno
   |
5. SE minds/{nome}.yaml NAO existe:
   |   -> Copia mind-template.yaml como base
   |   -> Preenche identity + camadas com insights da primeira fonte
   |   -> versao_dna = 1
   |
6. Registra ingestao em ingestion/{YYYY-MM-DD}-{slug}.yaml
   |
7. Atualiza minds/_index.yaml com status do clone
```

Regras da integracao:
- **Nunca sobrescrever** — sempre adicionar incrementalmente
- **Sempre citar fonte** — todo insight deve ter referencia
- **Versionar** — incrementar `versao_dna` a cada atualizacao
- **Registrar** — toda ingestao gera log em `ingestion/`
- **Atualizar indice** — `minds/_index.yaml` reflete estado atual
