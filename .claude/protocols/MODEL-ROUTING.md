# Protocolo de Roteamento de Modelos — DuarteOS

**Versao:** 1.0.0
**Status:** Ativo
**Autor:** ATLAS (PM) por decisao do usuario

---

## Principio

Cada modelo Claude tem um custo-beneficio otimo para um tipo de operacao. O DuarteOS roteia automaticamente para o modelo correto, otimizando custo sem sacrificar qualidade.

```
COLETA (haiku) → PROCESSAMENTO (sonnet) → CRIACAO (opus)
```

---

## Tiers de Roteamento

### Tier 1 — COLETA → Haiku 4.5

**Quando usar:** Qualquer operacao que busca informacao externa.

| Operacao | Ferramenta |
|----------|-----------|
| Pesquisa web | `WebSearch` |
| Fetch de URL | `WebFetch` |
| Busca semantica | `mcp__exa__*` |
| Web scraping | `mcp__apify__*`, `mcp__web-scraper__*` |
| Fetch generico | `mcp__fetch__*` |
| Transcricao | `mcp__youtube-transcript__*` |

**Como aplicar:**
- Ao spawnar agente via `Agent` tool para tarefas de pesquisa/coleta, usar `model: "haiku"`
- Se o agente principal precisa fazer uma busca pontual (WebSearch, WebFetch), a busca roda no modelo atual — mas ao delegar pesquisa intensiva a um sub-agente, usar haiku

### Tier 2 — PROCESSAMENTO → Sonnet 4.6

**Quando usar:** Interpretar, analisar, sintetizar ou classificar dados ja coletados.

| Operacao | Exemplo |
|----------|---------|
| Sintetizar pesquisa | Consolidar resultados de multiplas fontes |
| Extrair insights | Analisar dados brutos e gerar conclusoes |
| Classificar conteudo | Categorizar, ranquear, filtrar informacoes |
| Processar MIUs | Transformar dados brutos em unidades interpretativas |
| Analisar dados | Estatisticas, correlacoes, padroes |

**Como aplicar:**
- Ao spawnar agente para processar dados coletados, usar `model: "sonnet"`
- Tasks de tipo `research` que envolvem ANALISE (nao coleta) usam sonnet

### Tier 3 — CRIACAO → Opus 4.6

**Quando usar:** Escrever codigo, tomar decisoes complexas, gerar artefatos finais.

| Operacao | Exemplo |
|----------|---------|
| Escrever codigo | TypeScript, SQL, CSS, configs |
| Arquitetura | Decisoes de design, trade-offs |
| Planejamento | Roadmaps, planos de fase |
| Dados complexos | DNA de mind clone, YAML estruturado |
| Orquestracao | PM delegando, decidindo, coordenando |
| Validacao critica | QA final, Devil's Advocate |

**Como aplicar:**
- Modelo default para agentes que escrevem codigo ou tomam decisoes
- O PM (ATLAS) sempre roda em opus (orquestracao e decisao complexa)

---

## Regras de Aplicacao

### 1. Spawning de Agentes

Ao usar a `Agent` tool, definir `model` conforme o tier:

```
# Pesquisa web → haiku
Agent(model: "haiku", prompt: "Pesquise sobre X usando WebSearch/Exa...")

# Processar resultados → sonnet
Agent(model: "sonnet", prompt: "Analise os dados coletados e sintetize...")

# Implementar → opus
Agent(model: "opus", prompt: "Implemente a feature X conforme o plano...")
```

### 2. Pipeline Multi-Etapa

Em pipelines como MMOS (mind clone), o roteamento segue a etapa:

```
Fase 0-2 (Pesquisa EXA/Apify)     → haiku
Fase 3-4 (Analise/PCFE)           → sonnet
Fase 5-10 (Scaffold/DNA/Agent)    → opus
```

### 3. Operacoes Hibridas

Se uma task mistura coleta + processamento:
- **Separar em sub-agentes** quando possivel (haiku coleta, sonnet processa)
- Se inseparavel, usar o tier MAIS ALTO necessario

### 4. Excecoes

- O PM (ATLAS) sempre roda em opus (precisa de raciocinio complexo para orquestrar)
- Validacao de seguranca (SPECTER) sempre em opus (critico demais para modelo menor)
- Em caso de duvida, subir um tier (nunca descer)

---

## Configuracao

Definido em `.claude/config/system.yaml` na chave `model_routing`.
Pode ser sobrescrito em `project.yaml` ou `user.yaml` por projeto.

---

## Impacto Estimado

- **Custo:** Reducao significativa em tasks de pesquisa intensiva (haiku ~10x mais barato que opus)
- **Velocidade:** Haiku responde mais rapido para buscas simples
- **Qualidade:** Opus reservado para onde realmente importa (codigo, decisoes)
