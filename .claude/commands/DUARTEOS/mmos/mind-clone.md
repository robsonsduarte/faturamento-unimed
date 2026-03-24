# MMOS Mind Clone — Pipeline de Clonagem Mental de Alta Fidelidade

Crie um agente baseado na mente de um especialista real usando o pipeline MMOS v3 de 11 fases (0-10).

**Modo:** Pipeline sequencial — cada fase gera artefato antes de avancar
**Nivel:** Avancado — requer EXA MCP, Apify MCP, WebSearch (fallback), WebFetch
**Engine:** MMOS Engine v3.0.0
**DNA:** 6 Camadas Cognitivas + 4 Subcamadas + Associacoes Conceituais + Comunicacao Avancada
**Fidelidade-alvo:** >= 95% (formula: F = L*0.20 + B*0.30 + C*0.15 + K*0.20 + V*0.15)
**Estimativa pre-clone:** PCFE (Pre-Clone Fidelity Estimation) com gate humano antes do pipeline pesado
**Autoridades:** Allen (GTD), Forte (CODE), Deming (PDSA), Kahneman (Anti-Vies), Gawande (Gates)
**OMEGA:** Cada fase roda como task OMEGA com loop de refinamento (ver `.claude/protocols/OMEGA.md` Secao 20)
**Protocolo:** `.claude/protocols/MMOS-PIPELINE.md`

## Argumentos

$ARGUMENTS — nome do especialista a clonar (obrigatorio)

Se $ARGUMENTS estiver vazio, pergunte: "Qual especialista voce quer clonar? (nome completo)"

## Descricao

Este e o pipeline MMOS v3 de clonagem mental do DuarteOS. Ele combina:

- **11 fases** (0-10): Intake, Pesquisa, Analise Rapida, Estimativa PCFE, Gate Humano, Scaffold, Extracao, Inferencia, Mapeamento, Perfil, Recomendacao
- **Estimativa de fidelidade PRE-CLONE** (PCFE) — evita gastar tokens em clones inviaveis
- **Gate humano** — usuario decide GO/ENRIQUECER/ABORTAR antes do pipeline pesado
- **15 entidades de dados** distribuidas pelas fases
- **5 autoridades** integradas em cada fase
- **Gates Gawande DO-CONFIRM** entre cada transicao de fase
- **6a camada cognitiva:** Paradoxos Produtivos — contradicoes internas que tornam o clone humano
- **Formula de fidelidade composta** com 5 componentes (L, B, C, K, V)
- **Calibracao PCFE:** comparacao FE vs F real na Fase 9 para melhorar estimativas futuras
- **Synapse v3** para persistencia de DNA e indices
- **OMEGA v2** para loop de qualidade e circuit breaker

## Canonicalizacao de Entidades

1. **Normalizar nome:** remover acentos, lowercase, hifens entre palavras
   - "Alex Hormozi" -> `alex-hormozi`
   - "Naval Ravikant" -> `naval-ravikant`
2. **Resolver variacoes:** diferentes formas -> mesmo slug
   - "Hormozi", "Alex Hormozi", "Alex H." -> `alex-hormozi`
3. **Deteccao por contexto:** verificar `synapse/minds/*.yaml`
4. **Aliases:** "MrBeast" = "Jimmy Donaldson" -> `mrbeast`
5. **Nome canonico = slug do arquivo:** `.claude/synapse/minds/{slug}.yaml`
6. **Se ambiguo:** perguntar ao usuario

## As 6 Camadas do DNA Mental

| Camada | O que captura | Pergunta-chave |
|--------|-------------|----------------|
| **Filosofia** | Crencas fundamentais, visao de mundo, principios inegociaveis | "O que esta pessoa acredita ser verdade?" |
| **Frameworks** | Passos-a-passo, modelos de pensamento estruturados | "Como esta pessoa organiza e estrutura problemas?" |
| **Heuristicas** | Atalhos mentais, regras de bolso, padroes de decisao rapida | "Que atalhos mentais usa para decidir rapido?" |
| **Metodologias** | Processos repetiveis, sistemas formais, ferramentas | "Que sistemas formais segue consistentemente?" |
| **Dilemas** | Trade-offs, tensoes reconhecidas, zonas cinza, evolucao de posicoes | "Como lida com contradicoes e decisoes impossiveis?" |
| **Paradoxos Produtivos** | Contradicoes que coexistem e geram valor (CAMADA OURO — 35% do score) | "Que verdades aparentemente contraditorias ela sustenta simultaneamente?" |
| **Associações Conceituais** | Pontes entre conceitos aparentemente não relacionados | "Como conecta ideias de domínios diferentes?" |
| **Comunicação Avançada** | Estrutura retórica + estilometria quantitativa | "Como argumenta e qual seu estilo mensurável?" |

**Subcamadas v2.1 (dentro das camadas existentes):**
- **Filosofia:** hierarquia_valores (valores rankeados), conflitos_de_valor, motivacao_profunda (impulsores/medos)
- **Heurísticas:** modelo_social (teoria da mente simulada — confiança default, interpretação de crítica/elogio)

---

## Pipeline: 11 Fases (0-10) — MMOS Engine v3.0.0

```
+==========================================================================+
|                    MMOS ENGINE v3 — PIPELINE COMPLETO                    |
+==========================================================================+

  Fase 0: INTAKE ─── Fase 1: PESQUISA ─── Fase 2: ANALISE RAPIDA
                                                      │
  Fase 5: SCAFFOLD ◄── Fase 4: GATE HUMANO ◄── Fase 3: ESTIMATIVA PCFE
       │
  Fase 6: EXTRACAO ─── Fase 7: INFERENCIA ─── Fase 8: MAPEAMENTO
                                                      │
                   Fase 10: RECOMENDACAO ◄── Fase 9: PERFIL
                          │
                    CLONE COMPLETO (F >= 95%)
```

**Fases leves (0-5):** Pesquisa, estimativa, gate humano, scaffold
**Fases pesadas (6-10):** Pipeline completo com OMEGA (identicas as antigas Fases 1-5 do v2.1)

---

### FASE 0: INTAKE (Pre-Pipeline)

**Objetivo:** Receber input, canonicalizar nome, auto-detectar modo (greenfield/brownfield/skip/redirect), registrar dados opcionais.
**OMEGA:** NAO e task OMEGA — pre-condicao de entrada.

#### Procedimento

1. **Canonicalizar nome -> slug**
   - Aplicar regras de canonicalizacao (lowercase, sem acentos, hifens entre palavras)

2. **Auto-Deteccao Greenfield/Brownfield (v2.2)**

   Verificar AUTOMATICAMENTE o modo correto — elimina erro humano na escolha de comando.

   ```
   Passo 1: Verificar se .claude/synapse/minds/{slug}.yaml existe

   → NAO EXISTE: modo GREENFIELD
     Pipeline completo (Fases 0-10). Prosseguir normalmente.

   → EXISTE: verificar completeness
     |
     +-- Ler fidelidade do YAML (campo fidelity ou fidelity_score)
     |
     +-- Fidelidade >= 95% E sem fontes novas:
     |   → SKIP: Informar usuario:
     |     "Clone {slug} ja ativo com F={F}%. Nenhuma fonte nova detectada.
     |      Use /DUARTEOS:mmos:mind-update para enriquecer com novas fontes."
     |   → ENCERRAR pipeline
     |
     +-- Fidelidade >= 95% E fontes novas detectadas:
     |   (fontes novas = inbox/{slug}/ contem arquivos OU usuario forneceu URLs/dados)
     |   → REDIRECT: Informar usuario e redirecionar para mind-update:
     |     "Clone {slug} ja ativo com F={F}%. Fontes novas detectadas.
     |      Redirecionando para mind-update automaticamente."
     |   → Executar mind-update em vez de mind-clone
     |
     +-- Fidelidade < 95%:
         → BROWNFIELD: Retomar da ultima fase incompleta
           Detectar via: config.yaml do squad (campo last_completed_phase)
           Se campo ausente, inferir pela existencia de artefatos:
             - catalogo existe → fase 1 completa
             - MIUs existem → fase 6 completa
             - drivers existem → fase 7 completa
             - DNA existe → fase 8 completa
           Retomar da fase last_completed_phase + 1
           Informar: "Clone {slug} incompleto (F={F}%). Retomando da Fase {N}."
   ```

3. **Determinar categoria do squad** (apenas se GREENFIELD ou BROWNFIELD)
   - Categorias validas (kebab-case): copy, marketing, ux-design, ai, tech, business, content, product, saude, juridico
   - Se a categoria nao for clara ou ambigua: perguntar ao usuario

4. **Registrar dados opcionais fornecidos pelo usuario**
   - URLs de fontes fornecidas
   - Paths de arquivos locais
   - Textos colados diretamente
   - Qualquer material que o usuario tenha disponivel

5. **Decisao**
   - GREENFIELD: slug + categoria definidos → PROSSEGUIR para Fase 1
   - BROWNFIELD: slug + categoria definidos → PROSSEGUIR para fase de retomada
   - SKIP: clone ativo sem fontes novas → ENCERRAR
   - REDIRECT: clone ativo com fontes novas → EXECUTAR mind-update
   - Categoria indefinida: perguntar ao usuario

**Mudanca vs v2.1:** O APEX/ICP Gate foi removido desta fase. A avaliacao de viabilidade agora e feita de forma mais sofisticada nas Fases 1-3 (Pesquisa + Analise Rapida + Estimativa PCFE), culminando no Gate Humano da Fase 4.

**Mudanca v2.2:** Auto-deteccao greenfield/brownfield adicionada. O pipeline agora detecta automaticamente se deve criar, retomar, redirecionar ou pular — sem intervencao humana.

**NAO avance para Fase 1 sem slug e categoria definidos (exceto SKIP/REDIRECT).**

---

### FASE 1: PESQUISA

**Objetivo:** Pesquisar e catalogar todo material disponivel sobre a pessoa.
**OMEGA:** task_type=research, threshold=80, max_iterations=3

#### Procedimento

1. **Se usuario forneceu dados/URLs:** processar como fontes prioritarias
   - Fazer WebFetch de cada URL fornecida
   - Classificar e catalogar imediatamente

2. **Pesquisar fontes primarias** usando hierarquia de 3 tiers:

   **TIER 1 — EXA MCP Server (SEMPRE comecar aqui):**
   - Usar `mcp__exa__web_search_exa` para pesquisa semantica profunda
   - Queries recomendadas: nome completo + tipo de conteudo (livros, entrevistas, artigos, podcasts, etc.)
   - EXA retorna resultados semanticamente relevantes com alta qualidade
   - Executar multiplas queries variando o tipo de conteudo buscado:
     - `"{nome}" livros autorais OR books`
     - `"{nome}" entrevista profundidade OR interview`
     - `"{nome}" podcast OR palestra OR talk`
     - `"{nome}" artigo autoral OR blog post`
     - `"{nome}" tweet thread OR twitter`

   **TIER 2 — Apify (complementar/enriquecer):**
   - Usar `mcp__apify__search-actors` para encontrar actors relevantes (YouTube, Twitter, podcasts, etc.)
   - Usar `mcp__apify__call-actor` para executar scraping estruturado
   - Ideal para: transcricoes de videos do YouTube, threads do Twitter, episodios de podcasts
   - Usar `mcp__apify__get-actor-output` para coletar resultados

   **TIER 3 — WebSearch (FALLBACK — somente se Tier 1+2 insuficientes):**
   - Usar WebSearch APENAS se EXA + Apify nao retornaram fontes suficientes
   - Criterio: menos de 3 fontes primarias apos Tier 1+2
   - Documentar no catalogo que WebSearch foi usado como fallback e por que
   - Queries: nome completo + tipo de conteudo buscado

   **Tipos de fonte a buscar (em todos os tiers):**
   - Livros autorais (titulos, ISBN, links)
   - Videos/Podcasts longos (>30min)
   - Entrevistas em profundidade
   - Artigos/Blog posts autorais
   - Tweets/Threads substanciais
   - Palestras e apresentacoes

3. **Para CADA fonte encontrada (independente do tier):**
   - Usar WebFetch para extrair conteudo textual das URLs
   - Verificar que e fonte PRIMARIA (produzida pela propria pessoa)
   - REJEITAR fontes secundarias/interpretativas com log
   - Preservar material bruto intacto (Forte Layer 1)
   - Registrar qual tier originou a fonte no catalogo

4. **Catalogar cada fonte com metadados:**
   ```yaml
   fonte:
     tipo: "{livro|video|podcast|entrevista|artigo|tweet|palestra}"
     titulo: "{titulo}"
     url: "{URL}"
     duracao_estimada: "{curta<15min|media15-60min|longa>60min}"
     profundidade: "{superficial|media|profunda}"
     primaria: true  # so fontes primarias entram
     idioma: "{pt|en|es|...}"
     data_publicacao: "{YYYY-MM-DD}"
   ```

5. **Classificar e rejeitar fontes secundarias com log**

6. **Aplicar autoridades:**
   - **Allen:** Captura exaustiva agnostica — tudo entra sem filtro
   - **Forte:** Layer 1 — NUNCA editar material bruto
   - **Kahneman:** Anti-disponibilidade (nao priorizar YouTube), anti-ancoragem (nao comecar pela fonte mais famosa)

#### Targets de Distribuicao por Categoria (v2.2)

Apos coleta, verificar distribuicao das fontes contra os targets:

| Categoria    | Target % | Min absoluto | Justificativa |
|-------------|----------|-------------|---------------|
| Livros      | ~20%     | 4           | Profundidade maxima, pensamento estruturado |
| Entrevistas | ~30%     | 6           | Comportamento espontaneo, reacoes reais |
| Artigos     | ~25%     | 5           | Posicionamento autoral, argumentacao escrita |
| Podcasts    | ~15%     | 3           | Linguagem oral, estilo conversacional |
| Palestras   | ~10%     | 2           | Comunicacao publica, estrutura retorica |

**Regras:**
- Targets sao ORIENTACOES — adaptar ao perfil da pessoa (nem todos tem livros)
- **ALERTAR** se alguma categoria com material disponivel < 10% do total
- Se adaptacao necessaria, documentar redistribuicao no catalogo
- Registrar distribuicao real vs targets nos metadados da fase

#### Trigger Automatico de Enriquecimento (v2.2)

Apos coleta inicial, executar checks automaticos ANTES de avancar:

```yaml
ENRIQUECIMENTO_TRIGGER:
  checks:
    - condition: "total_fontes < 21"             # 70% de 30 (target minimo)
      action: "buscar mais fontes via Tier 1+2 (queries complementares)"
    - condition: "alguma_camada_dna < 3 fontes"  # cobertura minima por camada
      action: "buscar fontes especificas para camada deficiente"
    - condition: "ratio_primarias < 60%"          # pelo menos 60% devem ser primarias
      action: "buscar mais fontes primarias, descartar secundarias"
  max_loops: 2
  escalation: "Se apos 2 loops ainda insuficiente → prosseguir com nota de risco no catalogo"
```

**Procedimento de enriquecimento:**
1. Completar coleta inicial (passos 1-6 acima)
2. Contar fontes, verificar distribuicao, calcular ratio primarias
3. Se QUALQUER trigger ativo → executar busca complementar focada no gap
4. Re-verificar triggers
5. Se ainda ativo apos loop 2 → documentar risco e prosseguir

#### Gate Gawande 1->2

| # | Critico? | Check |
|---|----------|-------|
| 1 | **SIM** | ZERO fontes secundarias aceitas? |
| 2 | nao | Minimo 3 fontes encontradas? |
| 3 | nao | Material bruto preservado intacto? |
| 4 | nao | Distribuicao por categoria verificada? (v2.2) |
| 5 | nao | Triggers de enriquecimento executados? (v2.2) |

**Nota:** Coverage score >= 90% NAO e kill item aqui (como era no v2.1). A cobertura sera avaliada pela estimativa de fidelidade na Fase 3.

**NAO avance para Fase 2 sem gate aprovado.**

---

### FASE 2: ANALISE RAPIDA

**Objetivo:** Extrair amostra representativa de MIUs para alimentar a estimativa de fidelidade.
**OMEGA:** task_type=research, threshold=80, max_iterations=3

#### Procedimento

1. **Selecionar amostra representativa do material (nao exaustiva):**
   - 1-2 fontes de CADA tipo disponivel
   - Priorizar fontes mais longas/profundas
   - Maximo 30% do material total (economia de tokens)

2. **Extrair MIUs sample (20-50 MIUs)** com classificacao semantica

3. **Mapear cada MIU para a camada DNA que alimentaria:**
   ```yaml
   miu_sample:
     texto: "{MIU}"
     tipo_semantico: "{comportamental|linguistico|narrativo|decisorio|framework|interacao_social|argumentativo|associativo}"
     camada_dna: "{filosofia|frameworks|heuristicas|metodologias|dilemas|paradoxos|associacoes|comunicacao}"
     profundidade: "{superficial|media|profunda}"
     fonte: "{source_path}"
   ```

4. **Calcular metricas de cobertura:**
   - Quantas camadas DNA tem pelo menos 1 MIU?
   - Qual a distribuicao por camada?
   - Quantas fontes unicas alimentam cada camada?

**Gate:** Nao ha gate formal aqui — os dados fluem diretamente para a Fase 3.

---

### FASE 3: ESTIMATIVA DE FIDELIDADE (PCFE — Pre-Clone Fidelity Estimation)

**Objetivo:** Calcular fidelidade estimada ANTES de rodar o pipeline completo.
**OMEGA:** task_type=planning, threshold=85, max_iterations=3

#### 3.1 — Formula de Estimativa de Fidelidade (PCFE)

```
FE = (VS * 0.20) + (DS * 0.15) + (CS * 0.30) + (PS * 0.20) + (QS * 0.15)

VS = Volume Score       (0-100) — quantidade de material
DS = Diversity Score     (0-100) — diversidade de tipos de fonte
CS = Coverage Score      (0-100) — cobertura das camadas DNA
PS = Profundidade Score  (0-100) — profundidade vs superficialidade
QS = Quality Score       (0-100) — qualidade das fontes
```

#### 3.2 — Calculo de Cada Componente

**VS (Volume Score) — Peso: 20%**

Avalia a quantidade bruta de material disponivel.

| Material disponivel | Score |
|---------------------|-------|
| >= 15 fontes primarias | 100 |
| 10-14 fontes | 85 |
| 7-9 fontes | 70 |
| 4-6 fontes | 55 |
| 2-3 fontes | 35 |
| 1 fonte | 15 |
| 0 fontes | 0 |

Bonus: +5 por cada livro autoral (max +15). +3 por cada entrevista >60min (max +9).

**DS (Diversity Score) — Peso: 15%**

Avalia a variedade de tipos de fonte. Fontes diversas capturam facetas diferentes da mente.

| Criterio | Pontos |
|----------|--------|
| Livros autorais presentes | 15 |
| Videos/Podcasts longos (>30min) presentes | 15 |
| Entrevistas em profundidade presentes | 15 |
| Artigos/Blog posts autorais presentes | 15 |
| Tweets/Threads substanciais presentes | 10 |
| Palestras/Apresentacoes presentes | 10 |
| Material em multiplos idiomas | 10 |
| Span temporal >= 5 anos | 10 |

DS = SUM(pontos) (cap em 100)

**CS (Coverage Score) — Peso: 30% — MAIOR PESO**

Avalia a cobertura das 8 camadas do DNA + 4 subcamadas baseado nas MIUs sample.

| Camada DNA | Peso relativo | Como estimar cobertura |
|------------|--------------|------------------------|
| Filosofia (core) | 15% | MIUs com crencas, principios, visao de mundo |
| Filosofia (hierarquia_valores, motivacao_profunda) | 10% | MIUs com escolhas entre valores, medos, impulsores |
| Frameworks | 15% | MIUs com passos-a-passo, modelos de decisao |
| Heuristicas (core) | 10% | MIUs com regras de bolso, atalhos |
| Heuristicas (modelo_social) | 5% | MIUs com interacoes sociais, reacao a critica |
| Metodologias | 10% | MIUs com processos, ferramentas |
| Dilemas | 10% | MIUs com trade-offs, evolucao de posicao |
| Paradoxos Produtivos | 15% | MIUs com contradicoes internas (CAMADA OURO) |
| Associacoes Conceituais | 5% | MIUs com pontes entre dominios |
| Comunicacao Avancada | 5% | MIUs com padroes retoricos, estilometria |

Para cada camada:
- 0 MIUs na amostra: 0%
- 1-2 MIUs: 40%
- 3-5 MIUs: 70%
- 6+ MIUs: 100%

CS = SUM(cobertura_camada * peso_camada)

**PS (Profundidade Score) — Peso: 20%**

Avalia se o material vai alem da superficie.

| Criterio | Pontos |
|----------|--------|
| >= 3 fontes com profundidade "profunda" | 30 |
| >= 1 fonte com profundidade "profunda" | 15 |
| >= 5 fontes com profundidade "media" | 25 |
| >= 3 fontes com profundidade "media" | 15 |
| Fontes cobrem decisoes reais (nao so teoria) | 15 |
| Fontes cobrem momentos de fracasso/vulnerabilidade | 15 |
| Material inclui contradicoes/evolucao de posicao | 15 |

PS = SUM(pontos) (cap em 100)

Bonus: Se existe material de entrevistas longas (>60min): +10
Penalidade: Se >70% das fontes sao tweets/posts curtos: -20

**QS (Quality Score) — Peso: 15%**

Avalia a confiabilidade e riqueza das fontes.

| Criterio | Pontos |
|----------|--------|
| 100% fontes primarias (nenhuma secundaria) | 25 |
| >= 90% fontes primarias | 15 |
| Fontes verificaveis (URL/ISBN rastreavel) | 20 |
| Transcricoes completas (nao resumos) | 20 |
| Material recente (ultimos 3 anos) incluso | 15 |
| Material historico (>5 anos atras) incluso | 10 |
| Nenhuma fonte com paywall inacessivel | 10 |

QS = SUM(pontos) (cap em 100)

#### 3.3 — Interpretacao da Fidelidade Estimada

| FE Range | Classificacao | Recomendacao |
|----------|--------------|--------------|
| >= 85 | EXCELENTE | GO — alta probabilidade de clone >= 95% |
| 70-84 | BOM | GO COM RESSALVAS — clone viavel, pode nao atingir 95% |
| 55-69 | MODERADO | ENRIQUECER — pedir mais fontes antes de continuar |
| 40-54 | FRACO | ENRIQUECER OBRIGATORIO — material insuficiente |
| < 40 | INSUFICIENTE | ABORTAR — material muito escasso para clone |

#### 3.4 — Mapeamento FE -> F (Correlacao Estimada)

A FE (Fidelidade Estimada) NAO e o mesmo que F (Fidelidade Real). A relacao e:

```
F_estimado_min = FE * 0.85   (pior caso — material nao rende tanto)
F_estimado_max = FE * 1.10   (melhor caso — material rende mais que esperado)
F_provavel     = FE * 0.95   (caso tipico)
```

Exemplo: FE = 80 -> F provavel entre 68-88, media 76.

#### 3.5 — Identificacao de Gaps

Para cada camada DNA com CS < 40%, gerar um gap report:

```yaml
gaps:
  - camada: "paradoxos_produtivos"
    cobertura: 0%
    impacto: "CRITICO — 15% do CS, 35% do score de fidelidade final"
    recomendacao: "Buscar entrevistas longas onde discute contradicoes"
  - camada: "modelo_social"
    cobertura: 40%
    impacto: "MODERADO — afeta blind test de interacao"
    recomendacao: "Buscar debates ou interacoes publicas"
```

#### 3.6 — Artefato PCFE

Salvar estimativa em `data/processed/pcfe-{slug}.yaml`:

```yaml
pcfe:
  slug: "{slug}"
  timestamp: "{YYYY-MM-DD HH:MM}"
  version: "3.0"
  iteration: {1-3}  # qual loop de enriquecimento
  scores:
    VS: {0-100}
    DS: {0-100}
    CS: {0-100}
    PS: {0-100}
    QS: {0-100}
  FE: {0-100}
  classificacao: "{EXCELENTE|BOM|MODERADO|FRACO|INSUFICIENTE}"
  F_estimado_min: {FE * 0.85}
  F_estimado_max: {FE * 1.10}
  F_provavel: {FE * 0.95}
  fontes_total: {N}
  fontes_por_tipo: {mapa tipo -> count}
  camadas_cobertas: {N de 12}
  gaps: [{lista de gaps}]
  recomendacao: "{GO|GO_COM_RESSALVAS|ENRIQUECER|ENRIQUECER_OBRIGATORIO|ABORTAR}"
```

---

### FASE 4: GATE DE APROVACAO HUMANA

**Objetivo:** Apresentar estimativa e aguardar decisao humana.
**OMEGA:** NAO e task OMEGA — gate humano.

#### Formato de Apresentacao

```
============================================================
   ESTIMATIVA DE FIDELIDADE PRE-CLONE
============================================================

   Especialista: {Nome Completo}
   Categoria: {categoria}
   Slug: {slug}

   FIDELIDADE ESTIMADA: {FE}% ({classificacao})

   Breakdown:
   +-------------------------------+--------+---------+
   | Componente                    | Score  |  Peso   |
   +-------------------------------+--------+---------+
   | Volume (VS)                   | {VS}   |  20%    |
   | Diversidade (DS)              | {DS}   |  15%    |
   | Cobertura DNA (CS)            | {CS}   |  30%    |
   | Profundidade (PS)             | {PS}   |  20%    |
   | Qualidade (QS)                | {QS}   |  15%    |
   +-------------------------------+--------+---------+
   | FIDELIDADE ESTIMADA (FE)      | {FE}   | 100%    |
   +-------------------------------+--------+---------+

   Fidelidade Real Estimada:
   - Pior caso:  {F_min}%
   - Caso tipico: {F_provavel}%
   - Melhor caso: {F_max}%

   Fontes Encontradas: {N} ({N tipos diferentes})

   Gaps Identificados:
   {gap_list}

   Recomendacao: {GO | GO COM RESSALVAS | ENRIQUECER | ABORTAR}

============================================================
   OPCOES:
   [1] APROVAR — Iniciar pipeline completo
   [2] ENRIQUECER — Fornecer mais fontes e re-estimar
   [3] ABORTAR — Cancelar clonagem
============================================================

   Qual opcao? (1/2/3)
```

#### Fluxo por Opcao

- **[1] APROVAR:** Registrar decisao, avancar para Fase 5
- **[2] ENRIQUECER:** Pedir fontes adicionais ao usuario, voltar para Fase 1 (loop). O novo material e ADICIONADO ao catalogo existente (nao substitui). Re-rodar Fases 2-3 e apresentar nova estimativa. **Maximo 3 loops de enriquecimento.** Apos 3 tentativas, forcar decisao GO ou ABORTAR.
- **[3] ABORTAR:** Registrar motivo, encerrar pipeline

#### Logica de Recomendacao

- Se FE < 40: recomendar **ABORTAR** (material muito escasso)
- Se FE 40-69: recomendar **ENRIQUECER** (material insuficiente para 95%)
- Se FE >= 70: recomendar **APROVAR** (clone viavel)

**NAO avance para Fase 5 sem decisao humana registrada.**

---

### FASE 5: SCAFFOLD (Pos-Aprovacao)

**Objetivo:** Criar toda infraestrutura do squad antes do pipeline pesado.
**OMEGA:** task_type=implementation, threshold=90, max_iterations=3

#### Procedimento

1. **Criar diretorio squad completo (21+ dirs):**
   ```
   DUARTEOS/minds/{slug}/
   |-- agents/
   |-- artifacts/behavioral/
   |-- artifacts/cognitive/
   |-- artifacts/linguistic/
   |-- artifacts/narrative/
   |-- checklists/
   |-- data/raw/{articles,interviews,podcasts,books,tweets,videos,speeches}/
   |-- data/processed/
   |-- drivers/
   |-- frameworks/{slug}/
   |-- phrases/
   |-- system-components/
   |-- tasks/
   |-- voice/
   |-- config.yaml
   ```

2. **Criar config.yaml skeleton:**
   ```yaml
   clone:
     name: "{Nome}"
     slug: "{slug}"
     version: "0.1.0"
     pipeline_version: "3"
     created_at: "{timestamp}"
     fidelity_estimated: {FE}
     fidelity_score: null  # preenchido na Fase 9
     status: "scaffolding"
     category: "{categoria}"
   ```

3. **Criar DNA skeleton** em `.claude/synapse/minds/{slug}.yaml` (usando mind-template.yaml)

4. **Criar TASKS do pipeline:**
   ```
   tasks/
   |-- 01-extracao-completa-{slug}.md
   |-- 02-inferencia-drivers-{slug}.md
   |-- 03-mapeamento-sistemas-{slug}.md
   |-- 04-perfil-fidelidade-{slug}.md
   |-- 05-agente-operacional-{slug}.md
   |-- 06-squad-artifacts-{slug}.md
   ```

5. **Criar checklist personalizado:**
   ```
   checklists/{slug}-pipeline-checklist.yaml
   ```
   Com gates para cada fase restante (6-10).

6. **Mover artefato PCFE para squad:**
   - Copiar `data/processed/pcfe-{slug}.yaml` para `minds/{slug}/data/processed/`

#### Gate de Validacao

Verificar que todos os 21+ dirs existem e config.yaml e parseavel YAML.

**NAO avance para Fase 6 sem scaffold completo.**

---

### FASE 6: EXTRACAO (Completa)

**Objetivo:** Extrair TODAS as MIUs de TODAS as fontes. Pipeline completo de extracao.
**Nota:** O material ja foi coletado na Fase 1 (Pesquisa) e os diretorios ja existem (Fase 5 Scaffold).
**Entidade DB:** `contents`
**OMEGA:** task_type=research, threshold=80, max_iterations=3

#### Procedimento

1. **Complementar coleta se necessario:**
   - Verificar se material da Fase 1 esta completo em `data/raw/`
   - Se faltam fontes do catalogo: usar WebFetch para extrair conteudo restante
   - Preservar conteudo bruto intacto (Forte Layer 1)
   - Classificar por source_type e registrar em `data/raw/{tipo}/`

2. **Aplicar autoridades:**
   - **Allen:** Captura exaustiva agnostica — tudo entra sem filtro
   - **Forte:** Layer 1 — NUNCA editar material bruto
   - **Deming:** Coverage >= 90%? Diversity >= 4 tipos? Temporal span >= 50%?
   - **Kahneman:** Anti-disponibilidade (nao priorizar YouTube), anti-ancoragem (nao comecar pela fonte mais famosa)

3. **Calcular metricas:**
   - `coverage_score`: % fontes coletadas vs total existente
   - `source_diversity`: quantos tipos diferentes
   - `temporal_span`: % do periodo de atividade publica coberto

#### Gate Gawande 6->7

| # | Critico? | Check |
|---|----------|-------|
| 1 | **SIM** | Coverage score >= 90%? |
| 2 | nao | Minimo 4 tipos diferentes de fonte? |
| 3 | **SIM** | ZERO fontes secundarias/interpretativas? |
| 4 | nao | Material bruto preservado intacto? |
| 5 | nao | Span temporal documentado? |

**Se kill items (1, 3) falharem:** Task OMEGA fica blocked. Ampliar coleta.
**NAO avance para Fase 7 sem gate aprovado.**

---

### FASE 6 (continuacao): EXTRACAO DE MIUs

**Objetivo:** Extrair MIUs (Micro-Unidades Interpretativas Neurais) e fragmentos semanticos de TODO o material.
**Entidades DB:** `mius`, `fragments`
**OMEGA:** (mesmo da Fase 6 acima — task_type=research, threshold=80)

#### Procedimento (MIUs)

4. **Para cada conteudo coletado (contents):**
   - Extrair MIUs — fragmentos semanticos minimos com significado autonomo
   - Cortes sao SEMANTICOS, nao por tamanho
   - Cada MIU = 1 unidade de ensino completa

5. **Classificar cada MIU** por tipo semantico:
   - Comportamental / Linguistico / Narrativo / Decisorio / Framework
   - **Tipos adicionais:**
     - `interacao_social` — MIUs que revelam como interpreta intencoes dos outros, reage a critica/elogio, nivel de confianca default
     - `argumentativo` — MIUs que revelam estrutura retorica, sequencia argumentativa, preferencia de persuasao
     - `associativo` — MIUs que conectam conceitos de dominios aparentemente nao relacionados (pontes conceituais)

6. **Calculo de Estilometria:**
   - Sobre o corpus completo de MIUs, calcular metricas quantitativas:
     - Comprimento medio de frase (palavras)
     - Ratio de vocabulario tecnico vs coloquial
     - Frequencia de perguntas retoricas e imperativos
     - Frequencia de palavroes e expressoes coloquiais
     - Code-switching (alternancia de idiomas — portugues/ingles/etc.)
     - Marcadores discursivos recorrentes (ex: "olha", "tipo", "basicamente")
     - Cadencia geral (curta-rapida, longa-reflexiva, mista)
     - Pontuacao expressiva (uso de "!", "...", "—")
   - Registrar em `estilometria` no DNA YAML

7. **Validacao independente** (agente diferente do de extracao):
   - MIU tem significado autonomo? SIM -> validated | NAO -> rejected
   - Registrar razao de rejeicao
   - MIUs "boring" sao tao importantes quanto "dramatic" (Kahneman anti-saliencia)

8. **Progressive Summarization (Forte):**
   - Layer 1: texto bruto em `data/raw/`
   - Layer 2: MIUs extraidas (validated)
   - Layer 3: essencia destilada de cada MIU

9. **Calcular metricas:**
   - `fragmentation_quality`: % MIUs com significado autonomo (>= 95%)
   - `semantic_ratio`: % cortes semanticos vs arbitrarios (>= 90%)
   - `rejection_rate`: taxa documentada

#### Gate Gawande 6->7 (MIUs)

| # | Critico? | Check |
|---|----------|-------|
| 1 | **SIM** | Fragmentation quality >= 95%? |
| 2 | **SIM** | Progressive Summarization completa (layers 1-3)? |
| 3 | nao | Hook de validacao YAML executou sem erros? |
| 4 | nao | Taxa de rejeicao documentada e justificada? |
| 5 | nao | Assinatura de agente em cada MIU? |

**NAO avance para Fase 7 sem AMBOS os gates da Fase 6 aprovados (coleta + MIUs).**

---

### FASE 7: INFERENCIA

**Objetivo:** Inferir drivers/motivadores e criar evidencias MIU<->Driver. Calcular correlacoes. Classificar em tiers.
**Entidades DB:** `mind_drivers`, `miu_driver_evidence`, `driver_relationships`, `drivers`
**OMEGA:** task_type=mind_clone, threshold=95, max_iterations=3, model=Opus

#### Procedimento

1. **Motor de Inferencia:** Para cada MIU validada:
   - "Que motivador/driver explica este comportamento/declaracao/decisao?"
   - Gerar evidencia MIU<->Driver com strength e referencia exata

2. **Agregar evidencias por driver:**
   - Calcular forca (strength) e confianca (confidence)
   - Gerar mind_drivers

3. **Calcular correlacoes entre drivers:**
   - Gerar driver_relationships (correlacao -1.0 a 1.0)
   - Tipos: causal, correlacional, antagonico

4. **Classificar em tiers:**
   - Gold: alta forca + alta confianca + alta frequencia
   - Silver: media forca ou confianca
   - Bronze: evidencia presente mas limitada

5. **Kahneman — Base rate:**
   - Verificar frequencia na populacao geral antes de atribuir
   - Driver com 80% de prevalencia nao e diferenciador

6. **Kahneman — 3 agentes independentes:**
   - 3 inferencias independentes sobre mesmas MIUs
   - Comparar ANTES de mediacao
   - Concordancia >= 0.85

7. **Separar drivers em positivos e negativos (v2.1):**
   - **Impulsores:** drivers que movem para frente (legado, reconhecimento, provar algo, curiosidade)
   - **Medos:** drivers negativos que paralisam ou motivam por evitacao (fracasso, irrelevancia, mediocridade, perda de controle)
   - Registrar em `filosofia.motivacao_profunda` com intensidade e evidencia
   - Definir `recompensa_ideal`: como a pessoa define "sucesso" pessoal

8. **Rankear valores por evidencia de sacrificio/escolha (v2.1):**
   - Para cada valor/principio identificado, buscar evidencias de "quando colidiu com outro valor, qual venceu?"
   - Gerar `filosofia.hierarquia_valores` com rank numerico (1 = mais importante)
   - Registrar `conflitos_de_valor` com contexto e evidencia de cada resolucao

9. **Inferir associacoes conceituais por co-ocorrencia em MIUs (v2.1):**
   - Identificar pares de conceitos de dominios diferentes que co-ocorrem nas MIUs
   - Gerar `associacoes_conceituais.pontes` com frequencia e exemplos
   - Inferir `padrao_associativo` geral (analogico, metaforico, sistemico, interdisciplinar)

10. **Inferir modelo social (v2.1):**
    - A partir de MIUs tipo `interacao_social`, inferir:
      - `confianca_default`: nivel geral de confianca em outros (alta/media/baixa)
      - `como_interpreta_critica`: padrao de reacao a criticas (duvida legitima vs ataque vs feedback util)
      - `como_interpreta_elogio`: aceita vs desconfia vs redireciona
      - `padrao_atribuicao`: internaliza causas (merito/culpa propria) vs externaliza (ambiente/sorte)
    - Registrar interacoes observadas com situacao, interpretacao, reacao e evidencia

11. **Extrair DNA (6 camadas + subcamadas v2.1):**

   Nesta fase, popular o DNA em `.claude/synapse/minds/{slug}.yaml`:

   **Camada 1 — Filosofia:** Crencas core, visao de mundo, principios inegociaveis + hierarquia_valores, conflitos_de_valor, motivacao_profunda
   **Camada 2 — Frameworks:** Frameworks primarios, modelo de decisao
   **Camada 3 — Heuristicas:** Regras rapidas, vieses conhecidos, red flags + modelo_social
   **Camada 4 — Metodologias:** Processos, ferramentas preferidas
   **Camada 5 — Dilemas:** Trade-offs, zonas cinza, evolucoes de posicao
   **Camada 6 — Paradoxos Produtivos:** Contradicoes internas que coexistem
   **Associacoes Conceituais:** Pontes entre conceitos, padrao associativo
   **Comunicacao Avancada:** Estrutura retorica (formula argumentativa, sequencias) + estilometria (metricas quantitativas)

   Para cada entrada, incluir `source_path` e `evidencia`.
   **Paradoxos:** minimo 2, cada um com >= 3 fontes independentes.

12. **Pre-mortem (Kahneman):**
    - "Se este driver estiver errado, o que acontece com o clone?"
    - Mapear impacto de cada falso positivo e falso negativo

#### Gate Gawande 7->8

| # | Critico? | Check |
|---|----------|-------|
| 1 | **SIM** | Predictive accuracy >= 90%? |
| 2 | **SIM** | Cada mind_driver tem >= 2 evidencias? |
| 3 | nao | False positive rate < 5%? |
| 4 | **SIM** | 3 agentes independentes concordam (>= 0.85)? |
| 5 | nao | driver_relationships calculados? |
| 6 | nao | Drivers classificados em tiers? |

**NAO avance para Fase 8 sem gate aprovado.**

---

### FASE 8: MAPEAMENTO

**Objetivo:** Mapear a mente contra sistemas de classificacao e gerar scores por componente.
**Entidades DB:** `mapping_systems`, `system_components`, `component_driver_map`, `mind_component_scores`, `mind_system_mappings`
**OMEGA:** task_type=mind_clone, threshold=95, max_iterations=3

#### Procedimento

1. **Carregar sistemas de mapeamento:**
   - Big Five (Openness, Conscientiousness, Extraversion, Agreeableness, Neuroticism)
   - MBTI (16 tipos)
   - Eneagrama (9 tipos + asas)
   - Catalogo de 1000+ artefatos cognitivos

2. **Para cada componente de cada sistema:**
   - Usar drivers da mente (mind_drivers) + component_driver_map
   - Calcular score da mente neste componente
   - Registrar confidence e evidence_count

3. **Gerar mind_system_mappings:**
   - Perfil textual completo por sistema
   - Verificar consistencia cruzada (ex: INTJ com Openness baixo faz sentido?)

4. **Kahneman — Anti-halo:**
   - Score alto em um componente NAO influencia outros
   - Cada componente calculado INDEPENDENTEMENTE

5. **Gerar artefatos:**
   - `system-components/{mind-name}-system.yaml`
   - `artifacts/cognitive/` (cognitive-architecture, core-beliefs, artefatos-cognitivos)
   - `artifacts/behavioral/` (behavioral-patterns, compassion-triggers, contradictions)
   - `artifacts/linguistic/` (micro-units, signature-phrases, communication-templates)
   - `artifacts/narrative/` (storytelling-validation, self-told-story)

#### Gate Gawande 8->9

| # | Critico? | Check |
|---|----------|-------|
| 1 | **SIM** | Todos componentes relevantes tem score? |
| 2 | **SIM** | Consistencia interna >= 95%? |
| 3 | nao | Crossref com catalogo de artefatos completo? |
| 4 | nao | mind_system_mappings gerados para todos sistemas? |

**NAO avance para Fase 9 sem gate aprovado.**

---

### FASE 9: PERFIL

**Objetivo:** Agregar tudo no Perfil Final. A mente NASCE. Calcular fidelidade. Comparar FE vs F real.
**Entidades DB:** `minds`, `mind_tools`
**OMEGA:** task_type=mind_clone, threshold=95, max_iterations=3

#### Procedimento

1. **Gerar Perfil Agregado:**
   - Cruzar mind_component_scores + mind_system_mappings + mind_drivers
   - Gerar perfil unificado

2. **Calcular APEX score e metadados:**
   - score_apex, archetype, complexity_level, status

3. **Identificar mind_tools:**
   - Quais ferramentas cognitivas do catalogo a mente utiliza?
   - Com que proficiencia?
   - Vinculacao: inferido, declarado, observado

4. **Calcular Formula de Fidelidade:**
   ```
   F = (L x 0.20) + (B x 0.30) + (C x 0.15) + (K x 0.20) + (V x 0.15)

   L = Linguistic Accuracy   (0-100) — MIUs linguisticos + voice
   B = Behavioral Fidelity   (0-100) — drivers + scores (MAIOR PESO)
   C = Contradiction Handling (0-100) — paradoxos produtivos
   K = Knowledge/Framework    (0-100) — frameworks + mind_tools
   V = Voice Authenticity     (0-100) — voice + phrases + blind test

   Minimum per component: 85
   Minimum composite: 95
   ```

5. **Suite de 20 Testes Cegos Estruturados (v2.2):**

   Substitui o blind test vago por validacao reproduzivel com 20 prompts categorizados.

   **5a. Preparar 20 prompts personalizados** usando os templates abaixo, preenchidos com dados do DNA:

   ```yaml
   surface_prompts:  # 8 prompts — conhecimento e estilo basico
     - "Qual sua posicao sobre {tema_central_1}?"
     - "Explique {framework_principal} para um iniciante."
     - "Quais sao os maiores erros que as pessoas cometem em {area}?"
     - "O que voce aprendeu com {experiencia_marcante}?"
     - "Como voce descreveria seu metodo em uma frase?"
     - "Qual conselho daria para alguem comecando em {area}?"
     - "O que diferencia {area} hoje do que era ha 10 anos?"
     - "Qual e a habilidade mais subestimada em {area}?"

   deep_prompts:  # 6 prompts — profundidade e nuances
     - "Como voce reconcilia {crenca_A} com {crenca_B_aparentemente_oposta}?"
     - "Em que situacao {principio_central} NAO se aplica?"
     - "Qual foi a maior mudanca de opiniao que voce ja teve?"
     - "Se pudesse refazer {decisao_importante}, o que faria diferente?"
     - "O que a maioria das pessoas entende errado sobre {conceito}?"
     - "Qual e o maior risco nao-obvio em {area}?"

   paradox_prompts:  # 4 prompts — contradicoes produtivas
     - "Voce defende {posicao_A} mas tambem {posicao_B}. Como isso coexiste?"
     - "Seus criticos dizem que {critica_recorrente}. Eles tem razao?"
     - "{Paradoxo_1_do_DNA}: como voce vive com essa tensao?"
     - "Em que voce e hipocrita — e por que isso e necessario?"

   integration_prompts:  # 2 prompts — cenarios ineditos
     - "{Cenario_novo_nunca_visto}: como voce abordaria isso?"
     - "Um profissional de {area_diferente} pede seu conselho sobre {problema_cross_dominio}. O que voce diz?"
   ```

   **5b. Executar cada prompt** como se o agente clone ja estivesse ativo. Avaliar cada resposta:

   | Score | Criterio |
   |-------|----------|
   | 9-10 | Indistinguivel da pessoa real — tom, conteudo, nuances |
   | 7-8 | Consistente com DNA — pequenos desvios de estilo |
   | 5-6 | Conteudo correto mas tom/estilo generico |
   | 3-4 | Conteudo parcialmente correto, gaps visiveis |
   | 0-2 | Resposta generica/incorreta — clone falhou |

   **5c. Calcular Fidelidade de Teste:**

   ```
   Fidelidade_teste = (Media_geral * 0.60) + (Media_paradoxos * 0.30) + (Taxa_aprovacao * 0.10)

   Media_geral     = media aritmetica dos 20 scores (normalizada 0-100)
   Media_paradoxos = media dos 4 paradox scores (normalizada 0-100)
   Taxa_aprovacao  = % de respostas com score >= 7 (normalizada 0-100)
   ```

   **5d. Avaliar resultado:**
   - `Fidelidade_teste >= 94%` → PASS
   - `Fidelidade_teste 85-93%` → PASS COM ALERTA (documentar camadas fracas)
   - `Fidelidade_teste < 85%` → FAIL (retornar a fase correspondente)

   **Mapeamento de falha → fase de retorno:**

   | Categoria fraca | Camada DNA impactada | Retornar a |
   |-----------------|---------------------|------------|
   | Surface | Frameworks, Metodologias | Fase 6 (Extracao) |
   | Deep | Filosofia, Dilemas | Fase 7 (Inferencia) |
   | Paradox | Paradoxos Produtivos | Fase 7 (Inferencia) |
   | Integration | Associacoes Conceituais | Fase 8 (Mapeamento) |

   **5e. Registrar resultados** no config.yaml do squad:
   ```yaml
   blind_test_v2:
     total_prompts: 20
     scores_by_category:
       surface: [s1, s2, s3, s4, s5, s6, s7, s8]
       deep: [s1, s2, s3, s4, s5, s6]
       paradox: [s1, s2, s3, s4]
       integration: [s1, s2]
     media_geral: {valor}
     media_paradoxos: {valor}
     taxa_aprovacao: {valor}
     fidelidade_teste: {valor}
     resultado: "{PASS|PASS_COM_ALERTA|FAIL}"
   ```

   **Cenarios adicionais de blind test (v2.1 — mantidos como complemento):**

   | # | Tipo | O que testa | Como avaliar |
   |---|------|-------------|--------------|
   | A | **Provocacao/Critica** | Modelo social — como reage a critica direta | Resposta consistente com `modelo_social.como_interpreta_critica`? Tom preservado? |
   | B | **Argumento Complexo** | Estrutura retorica — como constroi argumentos | Sequencia retorica compativel com `estrutura_retorica.formula_padrao`? |
   | C | **Associacao Inesperada** | Pontes conceituais — conecta dominios diferentes | Tipo de ponte conceitual consistente com `associacoes_conceituais.padrao_associativo`? |

   **Estilometria no blind test:** Avaliar se a resposta gerada mantem metricas compativeis com o perfil estilometrico (comprimento de frase, cadencia, code-switching, marcadores discursivos).

6. **Noise audit (Kahneman):**
   - Re-executar perfil com mesmos inputs
   - Reprodutibilidade >= 0.90

7. **Pre-mortem final:**
   - "E 2027. Descobrimos que o clone e caricatura. O que deu errado?"
   - Documentar cenarios de falha

8. **Se fidelidade < 95%:**
   - NOTIFICAR usuario:
   ```
   FIDELIDADE ABAIXO DO THRESHOLD

   Clone: {Nome do Especialista}
   Fidelidade: {F}%
   Componentes: L={L}% B={B}% C={C}% K={K}% V={V}%
   Threshold minimo: 95%

   Opcoes:
   1. Aceitar como draft (nao produtivo)
   2. Fornecer mais fontes para enriquecer
   3. Revisar manualmente

   Qual opcao voce prefere? (1/2/3)
   ```

9. **Comparar FE vs F real (Calibracao PCFE):**

   Apos calcular F (fidelidade real), comparar com FE (fidelidade estimada da Fase 3):

   ```
   delta_estimativa = F - FE
   accuracy_estimativa = 100 - abs(delta_estimativa)
   ```

   - Se `accuracy_estimativa < 70%`: registrar anomalia para calibracao futura da PCFE
   - Se `accuracy_estimativa >= 90%`: estimativa foi excelente — registrar sucesso

   **Salvar em `.claude/omega/pcfe-calibration.yaml`:**
   ```yaml
   calibrations:
     - slug: "{slug}"
       timestamp: "{YYYY-MM-DD}"
       FE: {fidelidade estimada}
       F: {fidelidade real}
       delta: {F - FE}
       accuracy: {100 - abs(delta)}
       anomaly: {true se accuracy < 70%}
       notes: "{observacoes sobre a discrepancia}"
   ```

   **Salvar tambem no config.yaml do squad:**
   ```yaml
   pcfe_calibration:
     FE: {fidelidade estimada}
     F: {fidelidade real}
     delta: {F - FE}
     accuracy: {100 - abs(delta)}
   ```

   **Proposito:** Com dados suficientes de calibracao (5+ clones), sera possivel ajustar os pesos da PCFE para estimativas mais precisas.

#### Gate Gawande 9->10

| # | Critico? | Check |
|---|----------|-------|
| 1 | **SIM** | Fidelity score composto >= 95%? |
| 2 | **SIM** | Suite de 20 testes cegos executada com Fidelidade_teste >= 94%? (v2.2) |
| 3 | **SIM** | Pre-mortem executado e documentado? |
| 4 | nao | mind_tools populado com proficiency scores? |
| 5 | nao | config.yaml atualizado com status? |
| 6 | nao | Comparacao FE vs F registrada em pcfe-calibration.yaml? |
| 7 | nao | Resultados da suite de testes registrados em config.yaml? (v2.2) |

**NAO avance para Fase 10 sem gate aprovado.**

---

### FASE 10: RECOMENDACAO

**Objetivo:** Recomendar ferramentas cognitivas e identificar gaps. Transformar clone de retrato em sistema de crescimento.
**Entidades DB:** `tools`, `tool_driver_affinities`, `tool_relations`
**OMEGA:** task_type=mind_clone, threshold=95, max_iterations=3

#### Procedimento

1. **Match Engine:**
   - Cruzar mind_drivers com catalogo de ferramentas (tools)
   - Identificar ferramentas com alta afinidade que a mente NAO usa
   - Verificar pre-requisitos (tool_relations)

2. **Gerar Recommended Tools:**
   - Ordenar por relevancia x afinidade x viabilidade
   - Documentar por que cada ferramenta e relevante

3. **Gerar Development Gaps:**
   - Areas com drivers fortes mas ferramentas fracas/ausentes
   - Priorizar por impacto no perfil

4. **Gerar Agente Operacional (.md):**
   - Criar `DUARTEOS/{Categoria}/{slug}.md` (comando slash acessivel)
   - System prompt completo com: CORBS, behavioral patterns, voice, frameworks, paradoxos
   - Seguir checklist de criacao de agente (ver MMOS-PIPELINE.md Secao 15)
   - **INCLUIR secao "Bootstrap — Carregamento de Mente Completa"** antes de "Regras Finais":

     ```markdown
     ## Bootstrap — Carregamento de Mente Completa

     **PROTOCOLO OBRIGATORIO:** Antes de responder a QUALQUER pergunta como {Nome}, carregue a mente completa:

     1. Use `Glob` para `DUARTEOS/minds/{slug}/**/*.yaml`
     2. Use `Read` em paralelo para **TODOS** os arquivos YAML encontrados
     3. Use `Glob` para `DUARTEOS/minds/{slug}/tasks/*.md` e leia todos
     4. Integre os dados carregados com a identidade core acima

     Isto carrega as 6 camadas profundas do squad:
     - **Behavioral** — padroes comportamentais + comportamento situacional
     - **Cognitive** — arquitetura cognitiva + crencas core
     - **Linguistic** — micro-units de linguagem + templates comunicativos
     - **Narrative** — padroes de storytelling + self-narrative
     - **Drivers** — motivadores hierarquizados (gold/silver/bronze)
     - **Frameworks** — frameworks detalhados com steps, exemplos e anti-patterns

     **NAO responda sem completar o bootstrap.** Este .md e um resumo comprimido. A mente completa esta nos artifacts do squad.
     ```

   - Copiar para `DUARTEOS/minds/{slug}/agents/{slug}.md` (copia no minds dir)

5. **Popular TODOS os squad artifacts (9 tipos obrigatorios):**

   **Base path:** `DUARTEOS/minds/{slug}/`
   **Fonte de verdade:** `.claude/synapse/minds/{slug}.yaml` (DNA)
   **OMEGA:** Cada sub-item roda sob task_type=mind_clone, threshold=95

   #### 5.1 — Frameworks (`frameworks/{slug}/`)
   Para CADA framework em `DNA.frameworks.primarios[]`, gerar 1 YAML:

   **Arquivo:** `frameworks/{slug}/{framework-slug}.yaml`
   **Schema:**
   ```yaml
   # {Nome do Framework} — {slug}
   # Derivado de: .claude/synapse/minds/{slug}.yaml
   # Pipeline: MMOS Engine v3 — Fase 10
   # Gerado em: {timestamp}

   framework_identity:
     name: "{nome do framework}"
     slug: "{framework-slug}"
     mind: "{slug}"
     category: "{categoria}"
     source_path: "{DNA.frameworks.primarios[N].source_path}"

   descricao: "{resumo do que o framework resolve}"

   steps:
     - step: 1
       acao: "{passo 1}"
       detalhe: "{expansao com contexto do DNA}"
     - step: 2
       acao: "{passo 2}"
       detalhe: "{expansao}"

   quando_usar: "{contexto de uso}"

   exemplos_aplicacao:
     - cenario: "{situacao concreta derivada das MIUs}"
       resultado: "{o que acontece quando aplicado}"
       fonte: "{source_path da MIU}"

   anti_patterns:
     - "{situacao onde NAO usar este framework}"

   frameworks_relacionados:
     - name: "{outro framework do mesmo DNA}"
       relacao: "{complementar | prerequisito | alternativo}"
   ```

   **Regra:** len(frameworks YAML gerados) == len(DNA.frameworks.primarios).

   #### 5.2 — Drivers (`drivers/{slug}-drivers.yaml`)
   Consolidar todos os mind_drivers da Fase 7 com tiers e evidencias.

   **Arquivo:** `drivers/{slug}-drivers.yaml`
   **Schema:**
   ```yaml
   # {Nome} — Mind Drivers
   # Derivado de: .claude/synapse/minds/{slug}.yaml
   # Pipeline: MMOS Engine v3 — Fase 10
   # Gerado em: {timestamp}

   driver_identity:
     mind: "{slug}"
     name: "{Nome}"
     category: "{categoria}"
     total_drivers: {N}
     tier_distribution:
       gold: {N}
       silver: {N}
       bronze: {N}

   drivers:
     - name: "{nome do driver}"
       tier: "{gold | silver | bronze}"
       strength: {0.0-1.0}
       confidence: {0.0-1.0}
       frequency: "{quantas MIUs suportam}"
       descricao: "{o que motiva/impulsiona}"
       evidencias:
         - miu: "{resumo da MIU}"
           source_path: "{caminho da fonte}"
           strength: {0.0-1.0}
       relationships:
         - target: "{outro driver}"
           type: "{causal | correlacional | antagonico}"
           correlation: {-1.0 a 1.0}
   ```

   **Fonte dos dados:** Entidades `mind_drivers`, `miu_driver_evidence`, `driver_relationships` da Fase 7.

   #### 5.3 — Checklist (`checklists/{slug}-checklist.yaml`)
   Gates DO-CONFIRM especificos para validar output gerado por este clone.

   **Arquivo:** `checklists/{slug}-checklist.yaml`
   **Schema:**
   ```yaml
   # {Nome} — Quality Checklist
   # Pipeline: MMOS Engine v3 — Fase 10
   # Gerado em: {timestamp}

   checklist_identity:
     mind: "{slug}"
     name: "{Nome}"
     category: "{categoria}"
     type: "DO-CONFIRM"

   gates:
     voice_fidelity:
       descricao: "Output soa como {Nome} falaria?"
       kill_item: true
       checks:
         - "Tom descrito em voice.yaml presente?"
         - "Anti-patterns ausentes?"
         - "Frases-assinatura usadas quando contexto permite?"

     framework_usage:
       descricao: "Frameworks aplicados corretamente?"
       kill_item: false
       checks:
         - "Framework usado no contexto correto (quando_usar)?"
         - "Steps seguidos na ordem?"
         - "Nenhum framework inventado?"

     paradox_handling:
       descricao: "Paradoxos tratados com nuance?"
       kill_item: true
       checks:
         - "Lado A e lado B reconhecidos quando trigger ativado?"
         - "Resolucao emergente articulada?"
         - "Nenhum lado artificialmente eliminado?"

     behavioral_consistency:
       descricao: "Comportamento consistente com DNA?"
       kill_item: false
       checks:
         - "Heuristicas aplicadas nos triggers corretos?"
         - "Metodologias citadas com precisao?"

     knowledge_accuracy:
       descricao: "Conhecimento factual correto?"
       kill_item: true
       checks:
         - "Fatos sobre dominio de expertise corretos?"
         - "Nenhuma confabulacao?"

   scoring:
     threshold: 95
     weights:
       voice_fidelity: 25
       framework_usage: 20
       paradox_handling: 20
       behavioral_consistency: 20
       knowledge_accuracy: 15
   ```

   #### 5.4 — Tasks (`tasks/`)
   Criar 5+ tarefas onde esta mente excela, baseado em drivers gold + frameworks primarios.

   **Arquivo por task:** `tasks/{acao}-{slug}.md`
   **Schema por task:**
   ```markdown
   # {Acao} — {Nome}

   **Mind Clone:** {slug}
   **Dominio:** {DNA.identity.domain}
   **Dificuldade:** {basica | intermediaria | avancada}
   **Frameworks envolvidos:** {lista de frameworks relevantes}

   ## Descricao
   {O que esta task faz e por que {Nome} e a melhor mente para executa-la}

   ## Instrucoes para o Clone
   1. {Step 1 — baseado em frameworks e heuristicas do DNA}
   2. {Step 2}

   ## Exemplo de Input
   {Input hipotetico}

   ## Exemplo de Output Esperado
   {Output que {Nome} produziria, no tom e estilo corretos}

   ## Checklist de Qualidade
   - [ ] Voice fiel ao perfil?
   - [ ] Frameworks corretos aplicados?
   - [ ] Paradoxos tratados com nuance?
   ```

   **Regra:** Para cada driver tier=gold, 1 task. Para cada framework primario, 1 task. Minimo 5, maximo 15. Nomenclatura: `{verbo}-{objeto}-{slug}.md`

   #### 5.5 — Behavioral Artifacts (`artifacts/behavioral/`)

   **Arquivo 1:** `artifacts/behavioral/{slug}-behavioral-patterns.yaml`
   ```yaml
   behavioral_identity:
     mind: "{slug}"
     name: "{Nome}"

   patterns:
     - name: "{nome do padrao}"
       trigger: "{DNA.heuristicas.regras_rapidas[N].trigger}"
       response: "{DNA.heuristicas.regras_rapidas[N].acao}"
       intensity: "{alta | media | baixa}"
       frequency: "{sempre | frequente | situacional}"
       source_path: "{source_path}"

   under_pressure:
     descricao: "{como se comporta sob pressao}"
     patterns:
       - "{padrao 1}"
       - "{padrao 2}"

   blind_spots:
     - "{DNA.heuristicas.vieses_conhecidos[]}"
   ```

   **Arquivo 2:** `artifacts/behavioral/{slug}-situational-behavior.yaml`
   ```yaml
   situational_identity:
     mind: "{slug}"

   situations:
     - contexto: "{situacao especifica}"
       comportamento: "{como reage}"
       frameworks_ativados: ["{lista}"]
       heuristicas_ativadas: ["{lista}"]
       fonte: "{source_path}"
   ```

   #### 5.6 — Cognitive Artifacts (`artifacts/cognitive/`)

   **Arquivo 1:** `artifacts/cognitive/{slug}-cognitive-architecture.yaml`
   ```yaml
   cognitive_identity:
     mind: "{slug}"
     name: "{Nome}"

   architecture:
     primary_mode: "{como pensa — derivado de MBTI + Big Five}"
     decision_model: "{DNA.frameworks.modelo_decisao}"
     information_processing:
       intake: "{como absorve informacao}"
       filtering: "{como filtra/prioriza}"
       output: "{como externaliza decisoes}"

   mental_models:
     - name: "{framework ou heuristica}"
       usage_frequency: "{alta | media | baixa}"
       domain: "{onde aplica}"

   cognitive_biases:
     known:
       - bias: "{DNA.heuristicas.vieses_conhecidos[N]}"
         impact: "{como afeta output}"
     compensated:
       - bias: "{vieses compensados}"
         compensation: "{mecanismo}"
   ```

   **Arquivo 2:** `artifacts/cognitive/{slug}-core-beliefs.yaml`
   ```yaml
   core_beliefs_identity:
     mind: "{slug}"

   beliefs:
     - belief: "{DNA.filosofia.crencas_core[N].belief}"
       tier: "{tier}"
       evidencia: "{evidencia}"
       source_path: "{source_path}"
       implications:
         - "{como esta crenca afeta decisoes praticas}"

   worldview: "{DNA.filosofia.visao_de_mundo}"

   non_negotiables:
     - "{DNA.filosofia.principios_inegociaveis[]}"
   ```

   #### 5.7 — Linguistic Artifacts (`artifacts/linguistic/`)

   **Arquivo 1:** `artifacts/linguistic/{slug}-micro-units.yaml`
   ```yaml
   linguistic_identity:
     mind: "{slug}"
     name: "{Nome}"

   micro_units:
     - tipo: "{declaracao_absoluta | pergunta_retorica | analogia | reframe | metrica}"
       exemplo: "{frase ou construcao}"
       quando_usar: "{contexto de uso}"
       fonte: "{source_path}"

   vocabulary:
     preferred_terms:
       - term: "{palavra/expressao}"
         context: "{quando usa}"
     forbidden_terms:
       - term: "{palavra/expressao}"
         reason: "{por que evita}"
   ```

   **Arquivo 2:** `artifacts/linguistic/{slug}-communication-templates.yaml`
   ```yaml
   communication_templates_identity:
     mind: "{slug}"

   templates:
     - name: "{nome do template}"
       trigger: "{quando usar}"
       structure:
         - "{abertura}"
         - "{desenvolvimento}"
         - "{conclusao}"
       example: "{exemplo completo baseado em MIU real}"
       source_path: "{fonte}"
   ```

   #### 5.8 — Narrative Artifacts (`artifacts/narrative/`)

   **Arquivo 1:** `artifacts/narrative/{slug}-storytelling-patterns.yaml`
   ```yaml
   narrative_identity:
     mind: "{slug}"
     name: "{Nome}"

   patterns:
     - name: "{nome do padrao narrativo}"
       structure: "{como a historia e construida}"
       recurring_elements:
         - "{elemento recorrente}"
       example: "{exemplo extraido de MIU real}"
       quando_usar: "{contexto}"
       source_path: "{fonte}"

   recurring_narratives:
     - tema: "{tema recorrente}"
       versoes: {quantas vezes conta em fontes diferentes}
       variacao: "{como a narrativa varia}"
   ```

   **Arquivo 2:** `artifacts/narrative/{slug}-self-narrative.yaml`
   ```yaml
   self_narrative_identity:
     mind: "{slug}"

   origin_story: "{como a pessoa conta sua propria historia}"
   turning_points:
     - event: "{evento}"
       before: "{como era antes}"
       after: "{como ficou depois}"
       significance: "{por que importa}"
       source_path: "{fonte}"

   identity_anchors:
     - "{como se define}"

   legacy_narrative: "{como projeta seu legado}"
   ```

   #### 5.9 — Agent Copy (`agents/{slug}.md`)
   Copiar o agente `.md` gerado no item 4 para `agents/{slug}.md` dentro do squad dir.

6. **Persistir DNA no Synapse:**
   - Salvar `.claude/synapse/minds/{slug}.yaml` (versao final)
   - Atualizar `.claude/synapse/minds/_index.yaml`
   - Registrar em `.claude/synapse/ingestion/{YYYY-MM-DD}-{slug}.yaml`

7. **Atualizar config.yaml do squad:**
   ```yaml
   clone:
     name: "{Nome da Mente}"
     version: "1.0.0"
     pipeline_version: "3"
     created_at: "{timestamp}"
     fidelity_estimated: {FE}  # da Fase 3
     fidelity_score: {F}       # real, calculado na Fase 9
     status: "active"  # ou "draft" se F < 95
     archetype: "{frase}"
     category: "{categoria}"
   pcfe_calibration:
     FE: {FE}
     F: {F}
     delta: {F - FE}
     accuracy: {100 - abs(F - FE)}
   ```

8. **Gate Gawande — Squad Completeness (DO-CONFIRM):**

   Verificar que TODOS os squad artifacts foram gerados antes de considerar o clone completo.

   | # | Critico? | Check | Verificacao |
   |---|----------|-------|-------------|
   | 1 | **SIM** | Agent .md existe em `agents/{slug}.md`? | Confirmar arquivo |
   | 2 | **SIM** | Frameworks: count == DNA.frameworks.primarios.length? | Contar YAMLs em `frameworks/{slug}/` |
   | 3 | **SIM** | Drivers YAML existe com todos os tiers? | Confirmar `drivers/{slug}-drivers.yaml` |
   | 4 | **SIM** | Checklist existe com gates voice + paradox? | Confirmar `checklists/{slug}-checklist.yaml` |
   | 5 | nao | Tasks >= 5 geradas? | Contar arquivos em `tasks/` |
   | 6 | **SIM** | Behavioral artifacts (2 arquivos)? | Confirmar `artifacts/behavioral/` |
   | 7 | **SIM** | Cognitive artifacts (2 arquivos)? | Confirmar `artifacts/cognitive/` |
   | 8 | nao | Linguistic artifacts (2 arquivos)? | Confirmar `artifacts/linguistic/` |
   | 9 | nao | Narrative artifacts (2 arquivos)? | Confirmar `artifacts/narrative/` |
   | 10 | **SIM** | config.yaml tem `artifacts_completeness`? | Ver abaixo |

   **Se kill items (1-4, 6-7, 10) falharem:** Task OMEGA fica blocked. Gerar artifacts faltantes.
   **NAO declare clone completo sem gate aprovado.**

9. **Atualizar config.yaml com `artifacts_completeness`:**

   Adicionar ao `config.yaml` do squad:

   ```yaml
   artifacts_completeness:
     agent_md: true
     frameworks: "{N}/{N}"
     drivers: true
     checklist: true
     tasks: {N}
     behavioral: true
     cognitive: true
     linguistic: true
     narrative: true
     voice: true
     phrases: true
     system_components: true
     completeness_score: "{N}%"
     completeness_gate: "{PASSED | FAILED}"
   ```

   **Regra:** `completeness_gate` = PASSED somente se `completeness_score >= 85%` E todos kill items do Gate Gawande passaram.

---

## Artefatos Gerados

| Fase | Artefato | Caminho | Obrigatorio |
|------|----------|---------|-------------|
| 1 | Catalogo de fontes | `minds/{slug}/data/processed/catalogo-fontes.yaml` | SIM |
| 1 | Material bruto coletado | `minds/{slug}/data/raw/` | SIM |
| 2 | MIUs sample (20-50) | `minds/{slug}/data/processed/mius-sample.yaml` | SIM |
| 3 | Estimativa PCFE | `minds/{slug}/data/processed/pcfe-{slug}.yaml` | SIM |
| 5 | DNA skeleton | `.claude/synapse/minds/{slug}.yaml` | SIM |
| 5 | Config skeleton | `minds/{slug}/config.yaml` | SIM |
| 5 | Squad dirs (21+) | `minds/{slug}/` | SIM |
| 5 | Tasks do pipeline (6) | `minds/{slug}/tasks/` | SIM |
| 5 | Checklist do pipeline | `minds/{slug}/checklists/{slug}-pipeline-checklist.yaml` | SIM |
| 6 | MIUs completas + fragmentos | `minds/{slug}/data/processed/` | SIM |
| 7 | Drivers e evidencias | `minds/{slug}/drivers/{slug}-drivers.yaml` | SIM |
| 7 | DNA completo (6 camadas) | `.claude/synapse/minds/{slug}.yaml` | SIM |
| 8 | System components | `minds/{slug}/system-components/{slug}-system.yaml` | SIM |
| 9 | Calibracao PCFE | `.claude/omega/pcfe-calibration.yaml` | SIM |
| 10 | Agente operacional | `minds/{slug}/agents/{slug}.md` | SIM |
| 10 | Frameworks (1 por fw) | `minds/{slug}/frameworks/{slug}/{fw}.yaml` | SIM |
| 10 | Voice | `minds/{slug}/voice/{slug}-voice.yaml` | SIM |
| 10 | Phrases | `minds/{slug}/phrases/{slug}-phrases.yaml` | SIM |
| 10 | Checklist qualidade | `minds/{slug}/checklists/{slug}-checklist.yaml` | SIM |
| 10 | Tasks (5+) | `minds/{slug}/tasks/{acao}-{slug}.md` | NAO (warning) |
| 10 | Behavioral (2) | `minds/{slug}/artifacts/behavioral/` | SIM |
| 10 | Cognitive (2) | `minds/{slug}/artifacts/cognitive/` | SIM |
| 10 | Linguistic (2) | `minds/{slug}/artifacts/linguistic/` | NAO (warning) |
| 10 | Narrative (2) | `minds/{slug}/artifacts/narrative/` | NAO (warning) |
| 10 | Config completo | `minds/{slug}/config.yaml` | SIM |
| 10 | Indice Synapse | `.claude/synapse/minds/_index.yaml` | SIM |

**Campos cognitivos no DNA YAML (gerados nas Fases 6-7):**

| Componente | Campo no DNA | Gerado na Fase |
|------------|-------------|----------------|
| Estilometria Computacional | `comunicacao_avancada.estilometria` | Fase 6 (Extracao) |
| Estrutura Retorica | `comunicacao_avancada.estrutura_retorica` | Fase 7 (Inferencia) |
| Associacoes Conceituais | `associacoes_conceituais` | Fase 7 (Inferencia) |
| Hierarquia de Valores | `filosofia.hierarquia_valores` + `filosofia.conflitos_de_valor` | Fase 7 (Inferencia) |
| Motivacao Profunda | `filosofia.motivacao_profunda` | Fase 7 (Inferencia) |
| Modelo Social | `heuristicas.modelo_social` | Fase 7 (Inferencia) |

## Integracao OMEGA — Tabela de Referencia

| Fase | task_type OMEGA | threshold | max_iterations | Completion Signals |
|------|-----------------|-----------|----------------|-------------------|
| 0 - Intake | N/A | N/A | N/A | N/A (pre-condicao) |
| 1 - Pesquisa | research | 80 | 3 | `sources_validated`, `catalog_complete` |
| 2 - Analise Rapida | research | 80 | 3 | `mius_extracted`, `coverage_mapped` |
| 3 - Estimativa (PCFE) | planning | 85 | 3 | `fe_calculated`, `gaps_identified` |
| 4 - Aprovacao Humana | N/A | N/A | N/A | N/A (gate humano) |
| 5 - Scaffold | implementation | 90 | 3 | `files_created`, `schema_valid` |
| 6 - Extracao | research | 80 | 3 | `schema_valid`, `data_integrity` |
| 7 - Inferencia | mind_clone | 95 | 3 | `fidelity_check`, `evidence_linked` |
| 8 - Mapeamento | mind_clone | 95 | 3 | `mapping_complete`, `scores_calculated` |
| 9 - Perfil | mind_clone | 95 | 3 | `fidelity_check`, `tests_pass` |
| 10 - Recomendacao | mind_clone | 95 | 3 | `files_created`, `schema_valid` |

Cada fase emite OMEGA_STATUS com:
```
<!-- OMEGA_STATUS
agent: {agente}
task: "MMOS v3 Fase {N}: {nome}"
iteration: {N de 3}
task_type: {tipo}
score: {0-100}
evidence:
  - {evidencia especifica da fase}
completion_signals:
  - {sinais da fase}
exit_signal: {true|false}
-->
```

## Regras Criticas

1. **FONTES PRIMARIAS APENAS** — ZERO fontes secundarias/interpretativas
2. **FIDELIDADE >= 95%** — meta inegociavel. Se abaixo, notificar usuario
3. **PCFE ANTES DO PIPELINE** — estimar fidelidade e obter aprovacao humana ANTES das fases pesadas
4. **GATE HUMANO** — usuario decide GO/ENRIQUECER/ABORTAR na Fase 4 (max 3 loops)
5. **PARADOXOS = CAMADA OURO** — minimo 2, cada um com >= 3 fontes independentes
6. **GATES GAWANDE** — kill items bloqueiam avanco entre fases
7. **3 AGENTES INDEPENDENTES** — concordancia >= 0.85 na Fase 7
8. **BLIND TEST** — material nunca visto testa generalizacao na Fase 9
9. **CALIBRACAO PCFE** — comparar FE vs F real na Fase 9 e registrar em pcfe-calibration.yaml
10. **SOURCE_PATH** — todo insight deve ter rastreabilidade ate a fonte
11. **OMEGA LOOP** — cada fase roda sob OMEGA com circuit breaker
12. **SYNAPSE DNA** — persistencia em `.claude/synapse/minds/{slug}.yaml`
13. **EDIT > WRITE** — sempre preferir Edit para arquivos existentes
