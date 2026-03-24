# MMOS ENGINE v2.1 — Pipeline de Clonagem Mental de Alta Fidelidade

**Versao:** 2.1.0
**Status:** Ativo
**Autor:** NEXUS (Architect)
**Data:** 2026-03-03
**Substitui:** MMOS Pipeline v1 (7 fases, sem autoridades, sem formula de fidelidade)
**Dependencias:** OMEGA.md (Secao 20-21), SYNAPSE.md (Secao 4)

---

## Definicao

MMOS Engine v2 e o **motor de extracao e clonagem de mentes** do DuarteOS, com fidelidade-alvo >= 95%.

- **Pipeline unico** para mind-create (do zero) e mind-update (incremental)
- **6 fases** reais (Coleta, Extracao, Inferencia, Mapeamento, Perfil, Recomendacao)
- **15 entidades de dados** distribuidas pelas fases
- **5 autoridades** integradas em cada fase (Allen, Forte, Deming, Kahneman, Gawande)
- Roda **DENTRO do OMEGA v2** (cada fase = task OMEGA com loop de refinamento)
- Alimenta **Synapse v3** (DNA + indices)

```
MMOS v2 = 6 Fases x 15 Entidades x 5 Autoridades x OMEGA Loop x Synapse DNA
```

---

## 1. Visao Geral do Pipeline

### 1.1 As 6 Fases

```
+========================================================================+
|                    MMOS ENGINE v2 — 6 FASES                            |
+========================================================================+

FASE 0 (Pre-Pipeline)
  APEX/ICP Gate ── viabilidade antes de gastar tokens
       |
       v
FASE 1: COLETA ─────────────────────────────────────────── [contents]
  ETL Pipeline: Podcasts, Artigos, Tweets, Entrevistas,
  Livros, Blog posts, Twitter threads, News sites
       |
   Gate Gawande 1->2 (DO-CONFIRM)
       |
       v
FASE 2: EXTRACAO ────────────────────────────── [mius, fragments]
  MIUs (Micro-Unidades Interpretativas Neurais)
  Progressive Summarization (Forte layers 1-3)
  Validacao: MIUs OK vs Rejeitados
       |
   Gate Gawande 2->3 (DO-CONFIRM)
       |
       v
FASE 3: INFERENCIA ──────── [mind_drivers, miu_driver_evidence,
  Motor de Inferencia              driver_relationships, drivers]
  MIUs -> Drivers/Motivadores
  Evidencias MIU<->Driver
  Correlacoes, Tiers (gold/silver/bronze)
  3 agentes independentes (concordancia >= 0.85)
       |
   Gate Gawande 3->4 (DO-CONFIRM)
       |
       v
FASE 4: MAPEAMENTO ──────── [mapping_systems, system_components,
  Big Five, MBTI, Eneagrama      component_driver_map,
  Catalogo 1000+ artefatos       mind_component_scores,
  Scores por componente           mind_system_mappings]
       |
   Gate Gawande 4->5 (DO-CONFIRM)
       |
       v
FASE 5: PERFIL ───────────────────────────── [minds, mind_tools]
  Perfil Agregado — a mente NASCE
  Formula de fidelidade calculada
  Blind test + Noise audit + Pre-mortem
       |
   Gate Gawande 5->6 (DO-CONFIRM)
       |
       v
FASE 6: RECOMENDACAO ──────── [tools, tool_driver_affinities,
  Match Engine                       tool_relations]
  Ferramentas recomendadas
  Development Gaps identificados
       |
       v
  CLONE COMPLETO (Fidelidade >= 95%)
```

### 1.2 As 15 Entidades de Dados

| # | Entidade | Fase | Tipo | Descricao |
|---|----------|------|------|-----------|
| 1 | `contents` | 1-Coleta | storage | Conteudos brutos coletados |
| 2 | `mius` | 2-Extracao | hot_compute | Micro-Unidades Interpretativas Neurais |
| 3 | `fragments` | 2-Extracao | storage | Fragmentos processados e indexados |
| 4 | `drivers` | 3-Inferencia | entity | Catalogo mestre de drivers/motivadores |
| 5 | `mind_drivers` | 3-Inferencia | hot_compute | Drivers atribuidos a uma mente |
| 6 | `miu_driver_evidence` | 3-Inferencia | evidence | Evidencias MIU<->Driver |
| 7 | `driver_relationships` | 3-Inferencia | relational | Correlacoes entre drivers |
| 8 | `mapping_systems` | 4-Mapeamento | catalog | Sistemas disponiveis (Big Five, MBTI, etc.) |
| 9 | `system_components` | 4-Mapeamento | storage | Componentes de cada sistema |
| 10 | `component_driver_map` | 4-Mapeamento | relational | Mapa componente<->driver |
| 11 | `mind_component_scores` | 4-Mapeamento | hot_compute | Scores da mente por componente |
| 12 | `mind_system_mappings` | 4-Mapeamento | storage | Perfis completos por sistema |
| 13 | `minds` | 5-Perfil | entity | A mente finalizada |
| 14 | `mind_tools` | 5-Perfil | relational | Ferramentas cognitivas da mente |
| 15 | `tools` | 6-Recomendacao | catalog | Catalogo de 1000+ artefatos cognitivos |
| — | `tool_driver_affinities` | 6-Recomendacao | hot_compute | Afinidade ferramenta<->driver |
| — | `tool_relations` | 6-Recomendacao | relational | Relacoes entre ferramentas |

> **Nota:** O spec original lista 15 entidades numeradas mais 2 auxiliares da Fase 6 (tool_driver_affinities e tool_relations), totalizando 17 tabelas no schema completo.

### 1.3 Mind-Create vs Mind-Update

| Aspecto | Mind-Create | Mind-Update |
|---------|------------|-------------|
| **Ponto de entrada** | Fase 0 (APEX/ICP gate) | Fase adequada ao novo material |
| **Pipeline** | Completo: Fase 0 -> 1 -> 2 -> 3 -> 4 -> 5 -> 6 | Parcial: entra na fase certa |
| **Fonte de dados** | WebSearch + WebFetch (pesquisa automatica) | Material fornecido (URL, arquivo, texto, inbox) |
| **DNA** | Criado do zero | Merge incremental (adiciona, nunca remove) |
| **Agente .md** | Gerado do zero | Editado cirurgicamente |
| **Protecao** | Validacao final >= 95% | Rollback automatico se fidelidade cai > 5% |
| **Prerequisito** | Nenhum | Clone deve existir |
| **Comando** | `/DUARTEOS:mmos:mind-clone` | `/DUARTEOS:mmos:mind-update` |

**Regra de ouro:** Se o slug existe em `.claude/synapse/minds/`, use `mind-update`. Se nao, use `mind-clone`.

---

## 2. As 5 Autoridades

O MMOS v2 integra 5 autoridades intelectuais cujos principios operam em CADA fase do pipeline. Cada autoridade resolve um problema diferente.

### 2.1 Allen (GTD) — Workflow

| Principio | Aplicacao no MMOS |
|-----------|-------------------|
| **Capture** | Captura exaustiva e agnostica na Fase 1 — todo material entra sem filtro |
| **Clarify** | Decisao binaria em cada item: MIU valida? Fonte primaria? Driver confirmado? |
| **Organize** | Classificacao por tipo semantico, contextos GTD (@validar, @inferir, @incubar) |
| **Reflect** | Weekly review: gaps de cobertura? Drivers incubados? Novas fontes? |
| **Engage** | Proxima acao clara: avancar para proxima fase ou ampliar fase atual |

**Papel por fase:**

| Fase | Aplicacao Allen |
|------|----------------|
| 1-Coleta | Captura exaustiva agnostica. Cada fonte = inbox. |
| 2-Extracao | Clarificacao: MIU tem significado autonomo? SIM -> valida, NAO -> rejeitada |
| 3-Inferencia | Classificacao: driver confirmado (>= 2 MIUs) ou incubado (1 MIU) |
| 4-Mapeamento | — (nao aplica diretamente) |
| 5-Perfil | — (nao aplica diretamente) |
| 6-Recomendacao | — (nao aplica diretamente) |

### 2.2 Forte (CODE) — Memoria

| Principio | Aplicacao no MMOS |
|-----------|-------------------|
| **Capture** | Layer 1: texto bruto integral em `data/raw/` |
| **Organize** | Layer 2: MIUs extraidas — trechos relevantes |
| **Distill** | Layer 3: essencia destilada de cada MIU |
| **Express** | Layer 4: insight acionavel — a mente NASCE na Fase 5 |

**Papel por fase:**

| Fase | Layer Forte | Descricao |
|------|-------------|-----------|
| 1-Coleta | Layer 1 (Capture) | Material bruto preservado intacto |
| 2-Extracao | Layer 2-3 (Organize + Distill) | MIUs + essencias destiladas |
| 3-Inferencia | Layer 4 (Distill -> Actionable) | Drivers geram regras operacionais |
| 4-Mapeamento | Destilacao | Milhares de MIUs -> dezenas de scores |
| 5-Perfil | Express | Conhecimento destilado vira entidade acionavel |
| 6-Recomendacao | PARA mapping | Areas, Recursos, Projetos, Arquivos |

**Intermediate Packets:** Cada MIU validada e um Intermediate Packet reutilizavel. MIUs alimentam multiplos drivers, frameworks e componentes.

**Regra critica:** NUNCA editar material bruto. Preservar integridade total na Layer 1.

### 2.3 Deming (PDSA) — Qualidade

O loop OMEGA e a implementacao direta do ciclo PDSA de Deming:

```
OMEGA LOOP          <->  DEMING PDSA
-----------------        ---------------
Config (threshold,       PLAN
  task_type, model)      (hipotese, metricas)

Execute (agente          DO
  implementa)            (executar plano)

Score (avaliar           STUDY
  evidencias, calcular   (medir resultado,
  score por checklist)   comparar com hipotese)

Feedback/Escalate        ACT
  (refinar, escalar,     (se abaixo: ajustar,
  ou finalizar)          se acima: padronizar)
```

**Hipoteses e metricas por fase:**

| Fase | Hipotese Deming | Metrica |
|------|----------------|---------|
| 1-Coleta | Fontes cobrem >= 90% do corpus | coverage_score >= 90% |
| 2-Extracao | Fragmentos representam micro-unidades semanticas reais | fragmentation_quality >= 95% |
| 3-Inferencia | Drivers predizem >= 90% dos comportamentos | predictive_accuracy >= 90% |
| 4-Mapeamento | Scores internamente consistentes | internal_consistency >= 95% |
| 5-Perfil | Perfil representa a mente com fidelidade | fidelity_score >= 95% |
| 6-Recomendacao | Recomendacoes sao relevantes e gaps sao reais | recommendation_relevance validada |

### 2.4 Kahneman — Anti-Vies

Protocolos anti-vies por fase:

| Fase | Vies Combatido | Protocolo |
|------|---------------|-----------|
| 1-Coleta | Disponibilidade | NAO priorizar fontes mais acessiveis (ex: YouTube) sobre menos acessiveis (ex: livros) |
| 1-Coleta | Ancoragem | NAO comecar pela fonte mais famosa da pessoa |
| 1-Coleta | Confirmacao | Documentar pre-concepcoes do operador e isola-las |
| 2-Extracao | Fragmentacao de julgamento | Agente de extracao NAO julga importancia — apenas corta |
| 2-Extracao | Avaliacao independente | Agente de validacao e DIFERENTE do agente de extracao |
| 2-Extracao | Saliencia | MIUs "boring" sao tao importantes quanto MIUs "dramatic" |
| 3-Inferencia | Base rate | Antes de atribuir driver, verificar frequencia na populacao geral |
| 3-Inferencia | Avaliacao independente | 3 agentes independentes executam inferencia. Concordancia >= 0.85 |
| 3-Inferencia | Pre-mortem | "Se este driver estiver errado, o que acontece com o clone?" |
| 4-Mapeamento | Halo effect | Score alto em um componente NAO influencia outros |
| 4-Mapeamento | Fragmentacao | Cada componente calculado INDEPENDENTEMENTE |
| 4-Mapeamento | Ancoragem | NAO comecar pelo sistema mais familiar do operador |
| 5-Perfil | Blind test | Material NUNCA visto — o clone generaliza? |
| 5-Perfil | Noise audit | Re-executar com mesmos inputs — reprodutibilidade >= 0.90 |
| 5-Perfil | Pre-mortem final | "E 2027. Descobrimos que o clone e caricatura. O que deu errado?" |
| 6-Recomendacao | Gap validation | Gap identificado e real ou artefato do mapeamento? |

### 2.5 Gawande — Gates (Checklists DO-CONFIRM)

Os gates Gawande operam ENTRE fases. Cada gate tem items criticos (kill_items, bloqueantes) e nao-criticos (warnings).

**Resumo de gates:**

| Gate | Posicao | Kill Items (bloqueantes) | Non-Critical (warnings) |
|------|---------|--------------------------|------------------------|
| 1->2 | Apos Coleta | Coverage >= 90%, Zero fontes secundarias | Min 4 tipos fonte, Material preservado, Span temporal |
| 2->3 | Apos Extracao | Fragmentation quality >= 95%, Progressive Summarization completa (layers 1-3) | YAML valido, Rejeicao documentada, Assinatura agente |
| 3->4 | Apos Inferencia | Predictive accuracy >= 90%, >= 2 evidencias/driver, 3 agentes concordam (>= 0.85) | False positive < 5%, Correlacoes documentadas, Tiers classificados |
| 4->5 | Apos Mapeamento | Todos componentes tem score, Consistencia interna >= 95% | Crossref com catalogo, Mappings gerados |
| 5->6 | Apos Perfil | Fidelity >= 95%, Blind test passou, Pre-mortem executado | mind_tools populado, config.yaml atualizado |

**Regras de interacao Gates Gawande <-> OMEGA:**

1. Kill items sao bloqueantes — se qualquer um falha, task OMEGA fica `blocked`
2. Warning items sao registrados em progress.log com tag `[GAWANDE_WARNING]`
3. Gates operam ENTRE fases — apos fase concluir e ANTES da proxima iniciar
4. Gate fallback — se nao pode ser verificado, tratado como WARNING. PM decide
5. Acumulacao — 3+ warnings no mesmo pipeline emitem alerta ao PM

Para detalhes de mapeamento Gates <-> OMEGA, ver `OMEGA.md` Secao 21.

---

## 3. Fase 1: COLETA

### Objetivo

Captar todo material bruto da mente-alvo via ETL Pipeline. Somente fontes primarias (produzidas pela propria pessoa).

### Inputs

Fontes aceitas: Podcasts, Artigos, Tweets, Entrevistas, Livros, Blog posts, Twitter threads, News sites.

**Regra critica:** ZERO fontes secundarias/interpretativas. Usar APENAS material produzido pela propria pessoa ou, no caso historico, o documento fonte original.

### Processo: ETL Pipeline

Cada tipo de fonte tem um analista especializado no Squad ETL:

| Analista ETL | Fonte | Output |
|-------------|-------|--------|
| Analista de YouTube | Videos, transcricoes | `data/raw/interviews/` |
| Analista de Medium | Artigos | `data/raw/articles/` |
| Analista de Livros | Livros autorais | `data/raw/books/` |
| Analista de Blog | Posts em blogs | `data/raw/blog-posts/` |
| Analista de Noticias | Sites de noticias | `data/raw/news-sites/` |
| Analista de Twitter | Threads | `data/raw/twitter-threads/` |
| Analista de Podcasts | Entrevistas audio | `data/raw/podcasts/` |

### Output

- **Entidade DB:** `contents`
- **Filesystem:** `data/raw/` populado com todos os materiais brutos categorizados

### Entidade: contents

```yaml
contents:
  description: "Conteudos brutos coletados de todas as fontes"
  type: "storage"
  fields:
    - id
    - mind_id
    - source_type         # podcast, artigo, tweet, entrevista, livro, blog, thread
    - source_url
    - raw_content
    - language
    - collected_at
    - collector_agent     # qual agente ETL coletou
```

### Aplicacao das 5 Autoridades

- **Allen:** Captura exaustiva agnostica. Cada fonte e uma inbox. Clarificacao: fonte primaria? Completo? Idioma correto?
- **Forte:** Layer 1 (Captured Notes) — tudo entra sem edicao. NUNCA editar material bruto.
- **Deming:** Hipotese: fontes cobrem >= 90%. Metricas: coverage, diversity >= 4 tipos, temporal_span >= 50%.
- **Kahneman:** Anti-disponibilidade, anti-ancoragem, anti-confirmacao.
- **Gawande:** Gate 1->2 (ver abaixo).

### Gate Gawande 1->2

```yaml
gate_1_2:
  type: "DO-CONFIRM"
  kill_items: [1, 3]
  items:
    - id: 1
      critical: true
      check: "Coverage score >= 90%?"
    - id: 2
      critical: false
      check: "Minimo 4 tipos diferentes de fonte?"
    - id: 3
      critical: true
      check: "ZERO fontes secundarias/interpretativas na base?"
    - id: 4
      critical: false
      check: "Material bruto preservado intacto?"
    - id: 5
      critical: false
      check: "Span temporal documentado?"
```

### Metricas

| Metrica | Threshold | Tipo |
|---------|-----------|------|
| coverage_score | >= 90% | Kill item |
| source_diversity | >= 4 tipos | Warning |
| temporal_span | >= 50% atividade publica | Warning |
| zero_secondary_sources | true | Kill item |

### OMEGA Integration

| Campo | Valor |
|-------|-------|
| task_type | research |
| threshold | 80 |
| max_iterations | 3 |
| OMEGA signals | `coverage_met`, `sources_validated` |

---

## 4. Fase 2: EXTRACAO

### Objetivo

Extrair Micro-Unidades Interpretativas Neurais (MIUs) e fragmentos semanticos do material bruto.

**Principio fundamental:** Cortes sao SEMANTICOS, nao por tamanho. Cada MIU = 1 unidade de ensino completa com significado autonomo.

### Inputs

- Entidade DB: `contents` (da Fase 1)

### Processo: Extracao Linguistica + Validacao

1. **Extracao:** Separar material bruto em MIUs — fragmentos semanticos minimos com significado autonomo
2. **Classificacao:** Cada MIU recebe tipo semantico: comportamental, linguistico, narrativo, decisorio, framework
3. **Validacao (agente independente):** MIU tem significado autonomo? SIM -> validated | NAO -> rejected

### Outputs

- **Entidades DB:** `mius`, `fragments`
- **Filesystem:** `data/processed/fragments/`, `data/processed/transcriptions/`

### Entidade: mius

```yaml
mius:
  description: "Micro-Unidades Interpretativas Neurais — fragmentos semanticos atomicos"
  type: "hot_compute"
  fields:
    - id
    - content_id           # FK -> contents
    - mind_id
    - text
    - semantic_type        # comportamental, linguistico, narrativo, decisorio, framework
    - timestamp_start      # para video/audio
    - timestamp_end
    - validation_status    # pending, validated, rejected
    - layer                # 1=raw, 2=fragment, 3=essence, 4=actionable (Forte)
```

### Entidade: fragments

```yaml
fragments:
  description: "Fragmentos processados e indexados"
  type: "storage"
  fields:
    - id
    - miu_id               # FK -> mius
    - content_id
    - fragment_text
    - context
    - tags
```

### Progressive Summarization (Forte)

| Layer | Conteudo | Localizacao |
|-------|----------|-------------|
| Layer 1 | Texto bruto integral | `data/raw/` |
| Layer 2 | MIUs extraidas — trechos relevantes | DB `mius` (validation_status=validated) |
| Layer 3 | Essencia destilada de cada MIU | Campo `essence` em `mius` |
| Layer 4 | Insight acionavel | Gerado na Fase 3 apos inferencia |

**Intermediate Packets:** Cada MIU validada e um Intermediate Packet reutilizavel que alimenta multiplos drivers, frameworks e componentes.

### Gate Gawande 2->3

```yaml
gate_2_3:
  type: "DO-CONFIRM"
  kill_items: [1, 2]
  items:
    - id: 1
      critical: true
      check: "Fragmentation quality >= 95%?"
    - id: 2
      critical: true
      check: "Progressive Summarization completa (layers 1-3)?"
    - id: 3
      critical: false
      check: "Hook de validacao YAML executou sem erros?"
    - id: 4
      critical: false
      check: "Taxa de rejeicao documentada e justificada?"
    - id: 5
      critical: false
      check: "Assinatura de agente em cada MIU?"
```

### Metricas

| Metrica | Threshold | Tipo |
|---------|-----------|------|
| fragmentation_quality | >= 95% | Kill item |
| semantic_ratio | >= 90% cortes semanticos vs arbitrarios | Warning |
| progressive_summarization | Layers 1-3 completas | Kill item |
| rejection_rate | Documentada e justificada | Warning |

### OMEGA Integration

| Campo | Valor |
|-------|-------|
| task_type | research |
| threshold | 80 |
| max_iterations | 3 |
| OMEGA signals | `schema_valid`, `data_integrity` |

---

## 5. Fase 3: INFERENCIA

### Objetivo

Inferir drivers/motivadores a partir das MIUs validadas. Criar evidencias MIU<->Driver. Calcular correlacoes entre drivers. Classificar em tiers de performance.

### Inputs

- Entidade DB: `mius` (validated, da Fase 2)

### Processo: Motor de Inferencia

```
Step 1: Para cada MIU validada, perguntar:
        "Que motivador/driver explica este comportamento/declaracao/decisao?"

Step 2: Gerar registros em miu_driver_evidence vinculando MIU <-> Driver
        com strength de evidencia e referencia exata a fonte.

Step 3: Agregar evidencias por driver -> calcular forca (strength) e
        confianca (confidence) -> gerar mind_drivers.

Step 4: Calcular correlacoes entre drivers da mente ->
        gerar driver_relationships.

Step 5: Classificar drivers em tiers de performance:
        - Gold: alta forca + alta confianca + alta frequencia
        - Silver: media forca ou confianca
        - Bronze: evidencia presente mas limitada
```

### Protocolo de Avaliacao Independente (Kahneman)

3 agentes independentes executam inferencia sobre as mesmas MIUs. Suas atribuicoes MIU->Driver sao comparadas ANTES de mediacao. Coeficiente de concordancia inter-agente >= 0.85.

**Base rate:** Antes de atribuir driver, verificar frequencia na populacao geral. Se 80% das pessoas tem "busca por significado", nao e diferenciador.

### Outputs

- **Entidades DB:** `mind_drivers`, `miu_driver_evidence`, `driver_relationships`, `drivers`
- **Filesystem:** `drivers/` (driver-map.yaml, driver-correlations.yaml, driver-strength.yaml, driver-network.yaml)

### Entidade: drivers

```yaml
drivers:
  description: "Catalogo mestre de drivers/motivadores"
  type: "entity"
  fields:
    - id
    - name
    - description
    - category               # cognitivo, emocional, comportamental, social
    - base_rate              # frequencia na populacao geral (Kahneman)
```

### Entidade: mind_drivers

```yaml
mind_drivers:
  description: "Drivers especificos atribuidos a uma mente"
  type: "hot_compute"
  fields:
    - id
    - mind_id
    - driver_id              # FK -> drivers
    - strength               # forca calculada
    - confidence             # confianca na inferencia
    - performance_tier       # gold, silver, bronze
```

### Entidade: miu_driver_evidence

```yaml
miu_driver_evidence:
  description: "Evidencias que ligam MIUs a drivers — rastreabilidade completa"
  type: "evidence"
  fields:
    - id
    - miu_id                 # FK -> mius
    - driver_id              # FK -> drivers
    - mind_id
    - evidence_text
    - evidence_strength      # quao forte e esta evidencia
    - source_reference       # citacao exata
```

### Entidade: driver_relationships

```yaml
driver_relationships:
  description: "Correlacoes e relacoes entre drivers"
  type: "relational"
  fields:
    - id
    - driver_a_id            # FK -> drivers
    - driver_b_id            # FK -> drivers
    - correlation            # -1.0 a 1.0
    - relationship_type      # causal, correlacional, antagonico
    - mind_id                # pode ser global ou per-mind
```

### Gate Gawande 3->4

```yaml
gate_3_4:
  type: "DO-CONFIRM"
  kill_items: [1, 2, 4]
  items:
    - id: 1
      critical: true
      check: "Predictive accuracy >= 90%?"
    - id: 2
      critical: true
      check: "Cada mind_driver tem >= 2 evidencias em miu_driver_evidence?"
    - id: 3
      critical: false
      check: "False positive rate < 5%?"
    - id: 4
      critical: true
      check: "3 agentes independentes concordam (>= 0.85)?"
    - id: 5
      critical: false
      check: "driver_relationships calculados e documentados?"
    - id: 6
      critical: false
      check: "Drivers classificados em tiers (gold/silver/bronze)?"
```

### Metricas

| Metrica | Threshold | Tipo |
|---------|-----------|------|
| predictive_accuracy | >= 90% | Kill item |
| false_positive_rate | < 5% | Warning |
| evidence_density | >= 2.0 MIUs por driver | Kill item |
| inter_agent_agreement | >= 0.85 | Kill item |

### OMEGA Integration

| Campo | Valor |
|-------|-------|
| task_type | mind_clone |
| threshold | 95 |
| max_iterations | 3 |
| model | Opus (obrigatorio) |
| OMEGA signals | `fidelity_check`, `evidence_linked` |

---

## 6. Fase 4: MAPEAMENTO

### Objetivo

Mapear a mente contra sistemas de classificacao (Big Five, MBTI, Eneagrama, catalogo de 1000+ artefatos cognitivos) e gerar scores por componente.

### Inputs

- Entidades DB: `mind_drivers`, `driver_relationships`, `mapping_systems`, `system_components`, `component_driver_map`

### Processo: Mapeamento

```
Step 1: Carregar mapping_systems disponiveis (Big Five, MBTI, Eneagrama,
        catalogo proprietario de 1000+ artefatos cognitivos).

Step 2: Para cada system_component, usar component_driver_map para
        calcular score da mente baseado nos mind_drivers identificados.

Step 3: Gerar mind_component_scores — pontuacao em cada dimensao
        de cada sistema (ex: Openness = 0.92, Conscientiousness = 0.78).

Step 4: Agregar scores em mind_system_mappings — perfil completo
        da mente em cada sistema de mapeamento.
```

### Outputs

- **Entidades DB:** `mind_component_scores`, `mind_system_mappings`
- **Filesystem:** `system-components/{mind-name}-system.yaml`, `artifacts/` populado

### Entidade: mapping_systems

```yaml
mapping_systems:
  description: "Sistemas de mapeamento disponiveis"
  type: "catalog"
  fields:
    - id
    - name                   # Big Five, MBTI, Eneagrama, etc.
    - version
    - components             # lista de componentes do sistema
```

### Entidade: system_components

```yaml
system_components:
  description: "Componentes individuais de cada sistema"
  type: "storage"
  fields:
    - id
    - mapping_system_id      # FK -> mapping_systems
    - name                   # ex: "Openness to Experience", "INTJ", "Tipo 5"
    - description
    - scale_min
    - scale_max
```

### Entidade: component_driver_map

```yaml
component_driver_map:
  description: "Mapa componente <-> driver"
  type: "relational"
  fields:
    - id
    - component_id           # FK -> system_components
    - driver_id              # FK -> drivers
    - affinity_score         # quao forte e a relacao
    - direction              # positivo, negativo
```

### Entidade: mind_component_scores

```yaml
mind_component_scores:
  description: "Scores da mente em cada componente"
  type: "hot_compute"
  fields:
    - id
    - mind_id
    - component_id           # FK -> system_components
    - score                  # valor no sistema (ex: 0.85 em Openness)
    - confidence
    - evidence_count         # quantas evidencias suportam
```

### Entidade: mind_system_mappings

```yaml
mind_system_mappings:
  description: "Mapeamentos completos da mente por sistema"
  type: "storage"
  fields:
    - id
    - mind_id
    - mapping_system_id      # FK -> mapping_systems
    - profile_summary        # perfil textual completo
    - calculated_at
```

### Gate Gawande 4->5

```yaml
gate_4_5:
  type: "DO-CONFIRM"
  kill_items: [1, 2]
  items:
    - id: 1
      critical: true
      check: "Todos os componentes relevantes tem score?"
    - id: 2
      critical: true
      check: "Consistencia interna entre sistemas >= 95%?"
    - id: 3
      critical: false
      check: "Cruzamento com catalogo de artefatos cognitivos completo?"
    - id: 4
      critical: false
      check: "mind_system_mappings gerados para todos os sistemas?"
```

### Metricas

| Metrica | Threshold | Tipo |
|---------|-----------|------|
| component_coverage | 100% | Kill item |
| internal_consistency | >= 95% | Kill item |
| catalog_crossref | Completo | Warning |

### OMEGA Integration

| Campo | Valor |
|-------|-------|
| task_type | mind_clone |
| threshold | 95 |
| max_iterations | 3 |
| OMEGA signals | `mapping_complete`, `scores_calculated` |

---

## 7. Fase 5: PERFIL

### Objetivo

Agregar tudo em um Perfil Agregado e gerar a entidade `minds` final. A mente NASCE nesta fase.

### Inputs

- Entidades DB: `mind_component_scores`, `mind_system_mappings`, `mind_drivers`, `driver_relationships`

### Processo: Perfil Agregado

```
Step 1: Cruzar mind_component_scores + mind_system_mappings + mind_drivers
        para gerar perfil unificado da mente.

Step 2: Calcular score_apex (relevancia), archetype, complexity_level, status.

Step 3: Gerar entidade em minds — a mente esta NASCIDA no sistema.

Step 4: Identificar mind_tools: quais ferramentas cognitivas do catalogo
        de 1000+ artefatos esta mente utiliza? Com que proficiencia?
```

### Outputs

- **Entidades DB:** `minds`, `mind_tools`
- **Filesystem:** config.yaml atualizado, artifacts/ completo

### Entidade: minds

```yaml
minds:
  description: "A mente finalizada — entidade principal do sistema"
  type: "entity"
  fields:
    - id
    - name
    - status                 # draft, active, premium, archived
    - score_apex
    - archetype
    - complexity_level
    - version
    - created_at
    - profile_aggregated     # perfil completo agregado
```

### Entidade: mind_tools

```yaml
mind_tools:
  description: "Ferramentas cognitivas que a mente utiliza"
  type: "relational"
  fields:
    - id
    - mind_id
    - tool_id                # FK -> tools
    - proficiency            # quao bem a mente usa esta ferramenta
    - evidence_count
    - source                 # como foi identificado: inferido, declarado, observado
```

### Validacao de Fidelidade (Kahneman)

1. **Blind test:** Apresentar material NUNCA visto. O clone generaliza corretamente? Se nao -> overfitting.
2. **Noise audit:** Re-executar com mesmos inputs. Varia significativamente? Reprodutibilidade >= 0.90.
3. **Pre-mortem final:** "E 2027. Descobrimos que o clone e caricatura. O que deu errado?" Documentar cenarios de falha.

### Formula de Fidelidade

Ver Secao 13 para formula completa. Threshold: composite >= 95%, nenhum componente abaixo de 85%.

### Gate Gawande 5->6

```yaml
gate_5_6:
  type: "DO-CONFIRM"
  kill_items: [1, 2, 3]
  items:
    - id: 1
      critical: true
      check: "Fidelity score composto >= 95%?"
    - id: 2
      critical: true
      check: "Blind test passou?"
    - id: 3
      critical: true
      check: "Pre-mortem executado e documentado?"
    - id: 4
      critical: false
      check: "mind_tools populado com proficiency scores?"
    - id: 5
      critical: false
      check: "config.yaml atualizado com status 'active'?"
```

### Metricas

| Metrica | Threshold | Tipo |
|---------|-----------|------|
| fidelity_score_composite | >= 95% | Kill item |
| no_component_below | 85% | Kill item |
| blind_test | Passed | Kill item |
| noise_audit_reproducibility | >= 0.90 | Warning |
| premortem | Executado e documentado | Kill item |

### OMEGA Integration

| Campo | Valor |
|-------|-------|
| task_type | mind_clone |
| threshold | 95 |
| max_iterations | 3 |
| OMEGA signals | `fidelity_check`, `tests_pass` |

---

## 8. Fase 6: RECOMENDACAO

### Objetivo

Dado uma mente ativa, recomendar ferramentas cognitivas para desenvolvimento e identificar gaps de capacidade. Transforma o clone de "retrato estatico" em "sistema de crescimento".

### Inputs

- Entidades DB: `minds`, `mind_tools`, `tools`, `tool_driver_affinities`, `tool_relations`

### Processo: Match Engine

```
Step 1: Carregar mind_drivers e mind_tools da mente.

Step 2: Cruzar drivers com tool_driver_affinities:
        "Quais ferramentas do catalogo tem alta afinidade com os
        drivers desta mente mas que ela AINDA NAO utiliza?"

Step 3: Verificar tool_relations para sequenciamento:
        "Esta ferramenta tem pre-requisitos? A mente ja domina?"

Step 4: Gerar Recommended Tools — ordenados por
        relevancia x afinidade x viabilidade (pre-reqs atendidos).

Step 5: Gerar Development Gaps — areas onde a mente tem drivers fortes
        mas ferramentas fracas ou ausentes.
```

### Outputs

- Recommended Tools (ferramentas que a mente deveria desenvolver)
- Development Gaps (lacunas identificadas no perfil cognitivo)

### Entidade: tools

```yaml
tools:
  description: "Catalogo mestre de ferramentas cognitivas"
  type: "catalog"
  fields:
    - id
    - name                   # ex: "First Principles", "Inversao", "Analogia"
    - category               # framework, heuristica, modelo mental
    - description
    - difficulty_level
    - prerequisites          # ferramentas que deve dominar antes
```

### Entidade: tool_driver_affinities

```yaml
tool_driver_affinities:
  description: "Afinidade entre ferramentas e drivers"
  type: "hot_compute"
  fields:
    - id
    - tool_id                # FK -> tools
    - driver_id              # FK -> drivers
    - affinity_score         # quao util e esta ferramenta para este driver
    - context                # em qual contexto a afinidade e valida
```

### Entidade: tool_relations

```yaml
tool_relations:
  description: "Relacoes entre ferramentas"
  type: "relational"
  fields:
    - id
    - tool_a_id              # FK -> tools
    - tool_b_id              # FK -> tools
    - relation_type          # prerequisite, complementary, alternative, synergistic
```

### Use Cases

| Use Case | Exemplo |
|----------|---------|
| **Operacao do clone** | Copywriter com driver forte "persuasao emocional" sem framework "fascinations" -> Recomenda `frameworks/bencivenga/fascinations.yaml` |
| **Desenvolvimento** | Mente com gap em "pensamento analitico" -> Recomenda First Principles, Inversao, Steel Manning |
| **Composicao de squad** | Mente tem gap X -> buscar mente com forca X no catalogo -> squad complementar |

### OMEGA Integration

| Campo | Valor |
|-------|-------|
| task_type | mind_clone |
| threshold | 95 |
| max_iterations | 3 |

---

## 9. Estrutura de Pastas por Squad

Baseado no padrao real do squad `copy/` do MMOS, a estrutura generica para QUALQUER squad:

```
DUARTEOS/minds/{slug}/
|-- agents/                          <- 1 arquivo .md por mente ativa
|   |-- {mind-name-1}.md
|   |-- {mind-name-2}.md
|   +-- {mind-name-n}.md
|
|-- archive/                         <- Versoes anteriores (PARA do Forte)
|   |-- agents/
|   +-- README.md
|
|-- authority/                       <- Provas sociais, credenciais
|
|-- checklists/                      <- Gates Gawande (READ-DO e DO-CONFIRM)
|   |-- {technique}-checklist.md     <- Checklists por tecnica/metodo
|   |-- {mind-name}-checklist.md     <- Checklists especificos por mente
|   |-- quality-checklist.md         <- Checklist geral de qualidade
|   +-- agent-creation-checklist.md  <- Checklist para criacao de agentes
|
|-- data/                            <- Base de conhecimento estatica
|   |-- {source}-dna.yaml            <- DNAs extraidos
|   |-- {domain}-kb.md               <- Knowledge bases do dominio
|   +-- {extraction}-extraction.md   <- Extracoes de metodologias
|
|-- docs/                            <- Documentacao do squad
|
|-- frameworks/                      <- Frameworks POR MENTE (1 diretorio cada)
|   +-- {mind-name}/
|       |-- {framework-1}.yaml
|       |-- {framework-2}.yaml
|       +-- {framework-n}.yaml
|
|-- lib/                             <- Biblioteca de carregamento e helpers
|   +-- loader.md
|
|-- phrases/                         <- Frases-assinatura extraidas
|
|-- projects/                        <- Projetos ativos
|
|-- reference/                       <- Material de referencia
|
|-- scripts/                         <- Hooks e automacoes
|
|-- swipe/                           <- Exemplos reais (swipe files)
|
|-- swipe-sources/                   <- Fontes e metadados dos swipes
|
|-- tasks/                           <- Tarefas executaveis (prompts de acao)
|   |-- analyze-mental-conversation.md
|   |-- audit-{technique}.md
|   |-- create-{deliverable}.md
|   +-- ... (20+ tasks por squad)
|
|-- templates/                       <- Templates reutilizaveis
|
|-- voice/                           <- Tom de voz por persona
|
+-- workflows/                       <- Pipelines multi-step
    |-- wf-{workflow-name}.yaml
    +-- ...
```

**Categorias validas (lowercase kebab-case):** copy, marketing, ux-design, ai, tech, business, content, product, saude, juridico

**Convencao de nomes:** `DUARTEOS/minds/{slug}/{diretorio}` — slug de mente em kebab-case.

---

## 10. Mind-Create vs Mind-Update

### Mind-Create: Pipeline Completo (Fase 0 -> 6)

```
/DUARTEOS:mmos:mind-clone {nome-do-especialista}
  |
  +-- Fase 0: APEX/ICP Gate (viabilidade)
  |   +-- Material suficiente? Score APEX >= 40/60?
  |   +-- ICP fit? Score >= 6/10?
  |   +-- Se NAO: ABORTAR com recomendacao
  |
  +-- Fase 1: Coleta (ETL Pipeline)
  +-- Fase 2: Extracao (MIUs + fragments)
  +-- Fase 3: Inferencia (drivers + evidencias)
  +-- Fase 4: Mapeamento (scores + systems)
  +-- Fase 5: Perfil (mente nasce, fidelidade calculada)
  +-- Fase 6: Recomendacao (tools + gaps)
  |
  +-- DNA persiste em .claude/synapse/minds/{slug}.yaml
  +-- Agente gerado em DUARTEOS/minds/{slug}/agents/{slug}.md
```

### Mind-Update: Ponto de Entrada Diferente

O mind-update usa o MESMO pipeline mas entra na fase adequada ao tipo de novo material:

| Tipo de Novo Material | Fase de Entrada | Exemplo |
|----------------------|-----------------|---------|
| Novas fontes brutas | Fase 1 (Coleta) | Novo podcast, novo livro |
| Novas MIUs ja extraidas | Fase 2 (Extracao) | Fragmentos pre-processados |
| Novo driver identificado | Fase 3 (Inferencia) | Driver manual ou cross-reference |
| Novo sistema de classificacao | Fase 4 (Mapeamento) | Novo framework de personalidade |
| Recalibracao de perfil | Fase 5 (Perfil) | Nova validacao com dados existentes |

**Na pratica do DuarteOS**, a maioria dos updates entra pela Fase 1 (novas fontes) e roda o pipeline parcial 1->2->3->DNA Merge->Regression.

### Regras de Merge Incremental

| Operacao | Regra | Exemplo |
|----------|-------|---------|
| **ADICIONAR** | Novos itens sao adicionados ao final de cada lista | Nova crenca -> append em `filosofia.crencas_core` |
| **NUNCA REMOVER** | Itens existentes NUNCA sao removidos, mesmo que contraditados | Crenca antiga permanece, nova e adicionada |
| **REFORCAR** | Itens existentes recebem novo `source_path` | `evidencia` atualizada com nova referencia |
| **PARADOXOS** | Novo paradoxo -> adicionar. Existente -> adicionar exemplo | Secao cresce monotonicamente |
| **EVOLUCAO** | Posicao mudou -> registrar em `dilemas.evolucao` | `de:` / `para:` / `quando:` / `motivo:` |
| **DEDUP** | NAO duplicar insight identico | Verificar similaridade antes de adicionar |

### Rollback Automatico

Se a fidelidade pos-update cai mais de 5% em relacao ao valor pre-update:

1. Restaurar backup automatico
2. Reverter agente .md
3. Registrar rollback no ingestion_log
4. Notificar usuario com diagnostico

**Se fidelidade < 95% mas queda <= 5%:** Warning + notificacao ao usuario com opcoes (aceitar, rollback, fornecer mais fontes).

### Classificacao de Insights (Delta Analysis)

| Tipo | Significado | Acao |
|------|-------------|------|
| **NOVO** | Insight inexistente no DNA atual | Adicionar como nova entrada |
| **REFORCO** | Confirma/fortalece existente | Incrementar peso/fonte |
| **EVOLUCAO** | Modifica/nuanca existente | Preservar ambas visoes com evidencia |

---

## 11. Integracao OMEGA v2

Cada fase MMOS roda como task OMEGA independente. O contrato completo esta em `OMEGA.md` Secao 20.

### Mapeamento Fase -> Task OMEGA

| Fase MMOS | Nome | task_type OMEGA | Threshold | max_iterations |
|-----------|------|----------------|-----------|----------------|
| 1 | Coleta | research | 80 | 3 |
| 2 | Extracao | research | 80 | 3 |
| 3 | Inferencia | mind_clone | 95 | 3 |
| 4 | Mapeamento | mind_clone | 95 | 3 |
| 5 | Perfil | mind_clone | 95 | 3 |
| 6 | Recomendacao | mind_clone | 95 | 3 |

### Fluxo OMEGA Completo

```
/DUARTEOS:mmos:mind-clone {nome}
  |
  +-- OMEGA inicializa pipeline MMOS
  |   +-- Carrega Synapse L0-L7 com contexto de mind clone
  |
  +-- FASE 1: Coleta (task_type: research, threshold: 80)
  |   +-- OMEGA loop: executa, score, feedback, repeat
  |   +-- Gate Gawande 1->2: kill items bloqueantes
  |   +-- Dual-gate met -> avanca
  |
  +-- FASE 2: Extracao (task_type: research, threshold: 80)
  |   +-- OMEGA loop
  |   +-- Gate Gawande 2->3
  |   +-- Dual-gate met -> avanca
  |
  +-- FASE 3: Inferencia (task_type: mind_clone, threshold: 95)
  |   +-- OMEGA loop (modelo: Opus obrigatorio)
  |   +-- Gate Gawande 3->4
  |   +-- Dual-gate met -> avanca
  |
  +-- FASE 4: Mapeamento (task_type: mind_clone, threshold: 95)
  |   +-- OMEGA loop
  |   +-- Gate Gawande 4->5
  |   +-- Dual-gate met -> avanca
  |
  +-- FASE 5: Perfil (task_type: mind_clone, threshold: 95)
  |   +-- OMEGA loop
  |   +-- Gate Gawande 5->6 (inclui blind test + pre-mortem)
  |   +-- Dual-gate met -> avanca
  |
  +-- FASE 6: Recomendacao (task_type: mind_clone, threshold: 95)
  |   +-- OMEGA loop
  |   +-- Dual-gate met -> clone completo
  |
  +-- OMEGA finaliza: atualiza Synapse, registra em progress.log
```

### Gates Gawande no OMEGA

Os gates Gawande mapeiam diretamente para o dual-gate exit do OMEGA:

- **Kill items (critical: true):** Mapeados como backpressure gates. Se falham -> task `blocked`.
- **Warning items (critical: false):** Registrados no progress.log. Nao impedem avanco.
- **Todos kill items passam:** Mapeados como `completion_signals` + `exit_signal: true` -> dual-gate met.

### Circuit Breaker

O circuit breaker do OMEGA protege contra loops no pipeline:

- **CLOSED:** Operacao normal
- **HALF_OPEN:** 2 iteracoes sem progresso — ultima tentativa
- **OPEN:** 3 iteracoes sem progresso — fase congelada, clone marcado DRAFT, revisao humana

### Mind Update no OMEGA

```
/DUARTEOS:mmos:mind-update {nome}
  |
  +-- OMEGA inicializa pipeline de update
  |
  +-- BACKUP automatico
  |
  +-- DELTA ANALYSIS (classifica: NOVO / REFORCO / EVOLUCAO)
  |
  +-- MERGE ADITIVO (nunca remove)
  |
  +-- REGRESSION CHECK (testes anteriores passam?)
  |
  +-- FIDELITY CHECK (delta <= 5%? Se nao -> AUTO-ROLLBACK)
  |
  +-- OMEGA finaliza: score >= 95 para aprovacao
```

---

## 12. Integracao Synapse v3

O Synapse v3 e o motor de contexto que armazena e injeta dados dos mind clones. O contrato completo esta em `SYNAPSE.md` Secao 4.

### DNA Persiste em Synapse

- **Localizacao:** `.claude/synapse/minds/{slug}.yaml`
- **Template:** `.claude/synapse/mind-template.yaml`
- **Schema:** 6 camadas DNA + 4 subcamadas + identity + ingestion_log + stats

### As 6 Camadas + 4 Subcamadas do DNA

| Camada | O Que Captura | Pergunta-Chave |
|--------|-------------|----------------|
| 1. Filosofia | Crencas fundamentais, visao de mundo | "O que esta pessoa acredita ser verdade?" |
|    1a. Hierarquia de Valores | Ranking de valores com resolucao de conflitos | "Qual valor vence quando dois colidem?" |
|    1b. Motivacao Profunda | Impulsores e medos — motores de comportamento | "O que move e o que paralisa?" |
| 2. Frameworks | Modelos de pensamento estruturados | "Como organiza e estrutura problemas?" |
| 3. Heuristicas | Atalhos mentais, regras de bolso | "Que atalhos mentais usa para decidir?" |
|    3a. Modelo Social | Teoria da mente — como modela intencoes dos outros | "Como interpreta criticas, elogios, provocacoes?" |
| 4. Associacoes Conceituais | Pontes entre conceitos nao relacionados | "Quando fala de X, conecta com Y — por que?" |
| 5. Metodologias | Processos repetiveis, sistemas formais | "Que sistemas formais segue?" |
| 6. Dilemas | Trade-offs, tensoes, evolucao de posicoes | "Como lida com contradicoes?" |
| 7. Paradoxos Produtivos | Contradicoes internas que geram valor | "Que verdades contraditorias sustenta simultaneamente?" |
| 8. Comunicacao Avancada | Estrutura retorica + estilometria computacional | "Qual a formula argumentativa e assinatura estilistica?" |

**Camada 7 (Paradoxos) e a "camada ouro"** — 35% do score de fidelidade. Minimo 2 paradoxos por clone, cada um com >= 3 fontes independentes.
**Camada 8 (Comunicacao Avancada)** — estilometria computacional fornece baseline quantitativo para V (Voice).

### Indices Atualizados Automaticamente

- `minds/_index.yaml` — indice de todos os clones
- Atualizado apos cada mind-clone e mind-update
- Campos: slug, name, domain, clone_file, versao_dna, ultima_atualizacao

### Squad State

- Artefatos de mind clones em `DUARTEOS/minds/{slug}/`
- Estado rastreado pelo Synapse via agent state tracking

### Ingestion Protocol

```
INGEST(source, mind_clone):
  1. Identificar mind clone alvo
  2. Ler DNA atual de minds/{slug}.yaml
  3. Processar conteudo -> extrair insights
  4. Para cada insight:
     a. Classificar em camada destino (1-6)
     b. Verificar duplicidade
     c. Adicionar incrementalmente (Edit, nunca Write)
     d. Registrar source_path
  5. Incrementar versao_dna
  6. Adicionar entrada no ingestion_log
  7. Registrar em .claude/synapse/ingestion/{YYYY-MM-DD}-{slug}.yaml
  8. Atualizar minds/_index.yaml
```

---

## 13. Formula de Fidelidade (Completa)

### Formula

```
F = (L x 0.20) + (B x 0.30) + (C x 0.15) + (K x 0.20) + (V x 0.15)
```

### Componentes

| Componente | Peso | Range | O Que Mede | Fontes de Medicao |
|-----------|------|-------|-----------|-------------------|
| **L** — Linguistic Accuracy | 20% | 0-100 | Precisao linguistica: MIUs linguisticos + voice | `artifacts/linguistic/` + `voice/` -> mius por semantic_type=linguistico |
| **B** — Behavioral Fidelity | **30%** | 0-100 | Fidelidade comportamental: drivers + scores (MAIOR PESO) | `artifacts/behavioral/` + `mind_drivers` -> `mind_component_scores` |
| **C** — Contradiction Handling | 15% | 0-100 | Paradoxos produtivos: contradicoes internas | Contradicoes mapeadas -> blind test com cenarios contraditorios |
| **K** — Knowledge/Framework Application | 20% | 0-100 | Profundidade de conhecimento: frameworks + tools | `frameworks/` + `mind_tools` -> teste de aplicacao em problema novo |
| **V** — Voice Authenticity | 15% | 0-100 | Autenticidade da voz narrativa | `voice/` + `phrases/` -> blind test texto clone vs texto real |

### Thresholds

| Threshold | Valor | Acao |
|-----------|-------|------|
| **Minimum per component** | 85 | Se qualquer componente < 85 -> retornar a fase responsavel |
| **Minimum composite** | 95 | Meta inegociavel para clone ativo |
| **Maximum component deviation** | 10 | Desvio maximo entre componentes |

### Regras de Fidelidade

1. **Se F >= 95 e todos componentes >= 85:** Clone ATIVO. Status = active.
2. **Se F >= 95 mas algum componente < 85:** Retornar a fase do componente fraco.
3. **Se F < 95:** Notificar usuario. Opcoes: aceitar como draft, fornecer mais fontes, revisar manualmente.
4. **Se F < 90:** Clone marcado DRAFT. Nao pode operar em producao.

---

## 14. Metricas Consolidadas

### Dashboard Completo

```yaml
metrics_dashboard:

  fase_1_coleta:
    coverage_score: ">= 90%"
    source_diversity: ">= 4 tipos"
    temporal_span: ">= 50% atividade publica"
    zero_secondary_sources: "true"
    omega_task_type: "research"
    omega_threshold: 80

  fase_2_extracao:
    fragmentation_quality: ">= 95%"
    semantic_ratio: ">= 0.90"
    progressive_summarization: "layers 1-3 completas"
    rejection_rate: "documentada e justificada"
    omega_task_type: "research"
    omega_threshold: 80

  fase_3_inferencia:
    predictive_accuracy: ">= 90%"
    false_positive_rate: "< 5%"
    evidence_density: ">= 2.0 MIUs por driver"
    inter_agent_agreement: ">= 0.85"
    omega_task_type: "mind_clone"
    omega_threshold: 95

  fase_4_mapeamento:
    component_coverage: "100%"
    internal_consistency: ">= 95%"
    catalog_crossref: "completo"
    omega_task_type: "mind_clone"
    omega_threshold: 95

  fase_5_perfil:
    fidelity_score_composite: ">= 95%"
    no_component_below: "85%"
    blind_test: "passed"
    noise_audit_reproducibility: ">= 0.90"
    premortem: "executed and documented"
    omega_task_type: "mind_clone"
    omega_threshold: 95

  fase_6_recomendacao:
    recommendation_relevance: "validated"
    gap_accuracy: "confirmed via blind test"
    tool_sequencing: "prerequisites verified"
    omega_task_type: "mind_clone"
    omega_threshold: 95
```

### Tabela Resumo

| Fase | Metrica Principal | Threshold | Kill Item? |
|------|------------------|-----------|------------|
| 1 | Coverage | >= 90% | SIM |
| 1 | Zero secondary | true | SIM |
| 2 | Fragmentation quality | >= 95% | SIM |
| 2 | Progressive sum. | Layers 1-3 | SIM |
| 3 | Predictive accuracy | >= 90% | SIM |
| 3 | Evidence density | >= 2.0 | SIM |
| 3 | Inter-agent agreement | >= 0.85 | SIM |
| 4 | Component coverage | 100% | SIM |
| 4 | Internal consistency | >= 95% | SIM |
| 5 | Fidelity composite | >= 95% | SIM |
| 5 | Min component | >= 85% | SIM |
| 5 | Blind test | Passed | SIM |
| 5 | Pre-mortem | Documented | SIM |
| 6 | Recommendation relevance | Validated | NAO |

---

## 15. Checklist de Criacao de Agente

Os 8 passos para transformar uma mente clonada em agente operacional:

### Pre-condicoes

- Mente existe em DB `minds` com status = 'active'
- Fidelity score >= 95%
- mind_tools populado

### Passos

| # | Acao | Detalhes | Output |
|---|------|---------|--------|
| 1 | Gerar arquivo do agente | System prompt completo: CORBS, behavioral patterns, communication templates, voice signature, framework references, contradiction handling | `DUARTEOS/minds/{mind-name}/agents/{mind-name}.md` |
| 2 | Criar checklists especificos | Gates de qualidade para tecnicas/metodos da mente | `checklists/{mind-name}-checklist.md` |
| 3 | Popular frameworks | Todos os frameworks extraidos em YAML, um arquivo por framework | `frameworks/{mind-name}/{framework}.yaml` |
| 4 | Extrair frases-assinatura | Assinaturas linguisticas, padroes, expressoes recorrentes | `phrases/{mind-name}-phrases.yaml` |
| 5 | Definir voice | Tom de voz calibrado com exemplos | `voice/{mind-name}-voice.yaml` |
| 6 | Criar tasks especificas | Tarefas onde esta mente excela | `tasks/{acao}-{mind-name}.md` |
| 7 | Testar agente | Cenario conhecido (comparar), cenario novo (consistencia), debate com outro agente (fidelidade) | `tests/results/{mind-name}/` |
| 8 | Documentar DNA/extracoes | Qualquer DNA ou extracao especifica em `data/` | `data/{source}-{mind-name}-dna.yaml` |

### loader.md

O `lib/loader.md` define a ordem de carregamento do squad:

```yaml
load_order:
  1: "agents/{active-agents}.md"
  2: "data/{knowledge-bases}"
  3: "frameworks/{relevant}/"
  4: "checklists/{task-specific}.md"
  5: "tasks/{current-task}.md"
  6: "voice/{relevant}.yaml"
  7: "templates/{if-needed}"

context_management:
  max_tokens: "Gerenciar janela de 200k tokens"
  priority: "Agente > Task > Checklist > Framework > Data"
  lazy_loading: "Frameworks e data so carregam quando task exige"
```

---

## 16. Camadas de Profundidade Cognitiva v3 — 6 Novos Componentes

**Adicionado em:** v2.1.0
**Motivacao:** Gap analysis vs PRD de Clonagem Neural e Semantica v2.0 (Manus AI)
**Impacto estimado:** +6-12% de fidelidade composite (de ~89% para ~95%+)

### 16.1 Componentes Adicionados

| # | Componente | Camada DNA | Impacto F | Fase de Extracao |
|---|-----------|-----------|-----------|------------------|
| 1 | Estilometria Computacional | `comunicacao_avancada.estilometria` | L +3-5%, V +2-3% | Fase 2 (MIUs → analise estatistica) |
| 2 | Associacoes Conceituais | `associacoes_conceituais` (nova) | B +3-5%, K +2-3% | Fase 3 (co-ocorrencia em MIUs) |
| 3 | Estrutura Retorica | `comunicacao_avancada.estrutura_retorica` | V +2-3%, B +1-2% | Fase 2 (MIUs narrativos) |
| 4 | Modelo de Recompensa e Medo | `filosofia.motivacao_profunda` | B +3-4% | Fase 3 (drivers positivos/negativos) |
| 5 | Hierarquia de Valores Rankeada | `filosofia.hierarquia_valores` | C +2-3%, B +1-2% | Fase 3 (analise de decisoes dificeis) |
| 6 | Teoria da Mente Simulada | `heuristicas.modelo_social` | B +3-5%, V +1-2% | Fase 2-3 (MIUs de interacao social) |

### 16.2 Integracao com Fases Existentes

**Fase 2 — Extracao (novos targets):**
- Ao extrair MIUs, classificar adicionalmente por: interacao_social (para modelo_social), argumentativo (para estrutura_retorica)
- Calcular metricas estilometricas sobre o corpus de MIUs linguisticos
- Identificar padroes de conexao conceitual recorrentes

**Fase 3 — Inferencia (novos targets):**
- Alem de drivers genericos, inferir: drivers motivacionais (impulsores vs medos), associacoes conceituais (pontes recorrentes), hierarquia de valores (baseada em decisoes relatadas)
- Separar drivers em positivos (impulsores) e negativos (medos/aversoes)
- Rankear valores fundamentais por evidencia de sacrificio

**Fase 5 — Perfil (validacao ampliada):**
- Blind test DEVE incluir cenarios de: provocacao (testa modelo_social), argumento complexo (testa estrutura_retorica), associacao inesperada (testa pontes conceituais)
- Estilometria usada como baseline quantitativa para validar V (Voice)

### 16.3 Impacto na Formula de Fidelidade

A formula F permanece: `F = (L*0.20) + (B*0.30) + (C*0.15) + (K*0.20) + (V*0.15)`

Os novos componentes enriquecem os INPUTS de cada dimensao:
- **L** recebe estilometria (metricas quantitativas complementam avaliacao qualitativa)
- **B** recebe modelo_social + motivacao_profunda + associacoes (comportamento mais profundo)
- **C** recebe hierarquia_valores (como resolve conflitos de principios)
- **K** recebe associacoes_conceituais (conexoes de conhecimento) + estrutura_retorica
- **V** recebe estilometria + estrutura_retorica (voz mais precisa)

### 16.4 Regras de Extracao

1. **Estilometria:** Extrair AUTOMATICAMENTE do corpus de MIUs. Nao depende de inferencia humana.
2. **Associacoes:** Minimo 3 pontes conceituais por clone. Se < 3: marcar como "material insuficiente".
3. **Estrutura Retorica:** Identificar pelo menos 1 formula argumentativa padrao por clone.
4. **Motivacao Profunda:** Minimo 1 impulsor + 1 medo. Se expert so mostra face positiva: documentar como "medo NAO identificado — necessita mais fontes".
5. **Hierarquia de Valores:** Rankear SOMENTE quando ha evidencia de escolha entre valores conflitantes. Se sem evidencia: manter como lista plana (compatibilidade com v2).
6. **Modelo Social:** Extrair de MIUs com tipo `interacao_social`. Se < 2 interacoes observadas: marcar campo como "dados insuficientes".

---

## Integracao Final: 5 Autoridades x 6 Fases x 15 Entidades

```
                    COLETA    EXTRACAO   INFERENCIA   MAPEAMENTO   PERFIL    RECOMENDACAO
                    Fase 1    Fase 2     Fase 3       Fase 4       Fase 5    Fase 6
                  +---------+----------+------------+------------+---------+-------------+
ALLEN (GTD)       |Captura  |Clarifica |Classifica  |    --      |   --    |    --       |
Workflow          |exaustiva|MIU<->tipo|driver->conf|            |         |             |
                  |agnostica|sem filtro|/incubar    |            |         |             |
                  +---------+----------+------------+------------+---------+-------------+
FORTE (CODE)      |Layer 1  |Layer 2-3 |Layer 4     |Destilacao  |EXPRESS  |   PARA      |
Memoria           |Capture  |Organize  |Distill     |Scores      |A mente  |   mapping   |
                  |         |+Distill  |Actionable  |            |nasce    |             |
                  +---------+----------+------------+------------+---------+-------------+
DEMING (PDSA)     |Coverage |Fragment  |Predictive  |Consistency |Fidelity |Relevance    |
Loops             |>=90%    |quality   |accuracy    |>=95%       |score    |Match        |
                  |         |>=95%     |>=90%       |            |>=95%    |accuracy     |
                  +---------+----------+------------+------------+---------+-------------+
GAWANDE           |Gate 1->2|Gate 2->3 |Gate 3->4   |Gate 4->5   |Gate 5->6|Gate Final   |
Checklists        |DO-CONF  |DO-CONF   |DO-CONF     |DO-CONF     |DO-CONF  |DO-CONF      |
                  |kill:1,3 |kill:1,2  |kill:1,2,4  |kill:1,2    |kill:1-3 |kill:1       |
                  +---------+----------+------------+------------+---------+-------------+
KAHNEMAN          |Anti     |Fragment. |Base rate   |Halo effect |Blind    |Gap          |
Anti-Vies         |confirm. |de julg.  |Independent |Independ.   |test     |validation   |
                  |Anti     |Saliencia |Pre-mortem  |            |Noise    |             |
                  |anchor   |Independ. |            |            |audit    |             |
                  +---------+----------+------------+------------+---------+-------------+

ENTIDADES DB:      contents  mius       mind_drivers  mapping_sys  minds     tools
                             fragments  miu_drv_evid  sys_compnts  mind_tools tool_drv_aff
                                        drv_relat     comp_drv_map           tool_relations
                                        drivers       mind_comp_sc
                                                      mind_sys_map
```

---

*MMOS Engine v2.1 — Pipeline de Clonagem Mental de Alta Fidelidade*
*6 fases reais x 15+ entidades DB x 5 autoridades x OMEGA v2 loop x Synapse v3 DNA*
*6 camadas + 4 subcamadas cognitivas (v2.1: +estilometria, +associacoes, +retorica, +motivacao, +hierarquia, +modelo_social)*
*Documento autocontido. Fonte de verdade: docs/mmos-extraction-engine-v2.md*
