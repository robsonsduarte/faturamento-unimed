# Task: QA — Teste de Performance

## Objetivo
Executar testes de performance para estabelecer baseline, identificar gargalos, validar SLAs e propor otimizacoes concretas com evidencias mensuráveis.

## Contexto
Usar antes de lancamentos, apos mudancas que afetam performance (queries, algoritmos, cache), ou quando usuarios reportam lentidao. O teste de performance nao e opcional para features que lidam com volume (listagens, buscas, geracoes em batch, uploads). Resultados devem ser reprodutiveis e comparaveis.

## Pre-requisitos
- [ ] SLAs/targets de performance definidos (latencia p50/p95/p99, throughput)
- [ ] Ambiente de teste representativo (dados realistas em volume)
- [ ] Ferramentas de profiling disponiveis (DevTools, EXPLAIN ANALYZE, etc)
- [ ] Baseline anterior (se existir) para comparacao
- [ ] Monitoramento ativo para coletar metricas

## Passos

### 1. Definir Metricas e Targets
```
Metricas de API:
| Endpoint | p50 Target | p95 Target | p99 Target | Throughput Min |
|----------|-----------|-----------|-----------|---------------|
| GET /api/content | <100ms | <300ms | <500ms | 100 req/s |
| POST /api/content/generate | <5s | <15s | <30s | 10 req/s |
| GET /api/library | <200ms | <500ms | <1s | 50 req/s |

Metricas de Frontend:
| Pagina | LCP Target | FID Target | CLS Target | TTI Target |
|--------|-----------|-----------|-----------|-----------|
| Dashboard | <2.5s | <100ms | <0.1 | <3s |
| Geracao de conteudo | <2s | <100ms | <0.1 | <2.5s |

Metricas de Banco:
| Query | Tempo Target | Rows Scanned Max |
|-------|-------------|-----------------|
| Listar conteudos do usuario | <50ms | <1000 |
| Busca full-text | <200ms | <10000 |
```

### 2. Preparar Ambiente de Teste
```
Dados de teste:
- 1000 usuarios simulados
- 50.000 registros de conteudo
- 10.000 imagens no storage
- Distribuicao realista por niche e status

Configuracao:
- Mesmo hardware/specs que producao (ou proporcional)
- Banco com dados seed representativos
- Cache limpo antes de cada rodada
- Sem outros processos competindo por recursos
```

### 3. Executar Profiling de Banco
```sql
-- Identificar queries mais lentas
SELECT
  query,
  calls,
  mean_exec_time,
  total_exec_time,
  rows
FROM pg_stat_statements
ORDER BY mean_exec_time DESC
LIMIT 20;

-- Analisar query especifica
EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT)
SELECT c.*, p.name as author_name
FROM contents c
JOIN profiles p ON p.id = c.user_id
WHERE c.user_id = 'uuid-here'
  AND c.status = 'published'
ORDER BY c.created_at DESC
LIMIT 20;

-- Resultado esperado:
-- Index Scan using idx_contents_user_status on contents (cost=0.42..8.45 rows=20)
-- Se aparecer "Seq Scan" em tabela grande → indice necessario
```

### 4. Executar Load Test na API
```javascript
// Usando autocannon, k6, ou artillery
// Exemplo com script conceitual:

// Cenario 1: Carga normal (baseline)
// 50 usuarios simultaneos por 60 segundos
{
  scenarios: {
    baseline: {
      executor: 'constant-vus',
      vus: 50,
      duration: '60s',
    }
  }
}

// Cenario 2: Pico de carga
// Rampa de 10 a 200 usuarios em 120 segundos
{
  scenarios: {
    spike: {
      executor: 'ramping-vus',
      stages: [
        { duration: '30s', target: 50 },
        { duration: '30s', target: 200 },
        { duration: '30s', target: 200 },
        { duration: '30s', target: 0 },
      ],
    }
  }
}

// Cenario 3: Stress test
// Aumentar ate encontrar o limite
// Quando error rate > 5% ou p99 > SLA → limite atingido
```

### 5. Analisar Resultados
```
Resultados do Load Test:

Cenario Baseline (50 VUs, 60s):
| Endpoint | p50 | p95 | p99 | Req/s | Error Rate |
|----------|-----|-----|-----|-------|------------|
| GET /api/content | 85ms | 250ms | 420ms | 120 | 0% |
| POST /api/generate | 4.2s | 12s | 28s | 8 | 2% |
| GET /api/library | 150ms | 380ms | 750ms | 65 | 0% |

Status vs Target:
✅ GET /api/content — Todos os targets atingidos
⚠️ POST /api/generate — p99 proximo do limite (28s vs 30s target)
⚠️ GET /api/library — p99 acima do target (750ms vs 500ms target)

Cenario Spike (200 VUs):
- Error rate subiu para 8% acima de 150 VUs
- p99 do GET /api/library subiu para 2.5s
- Banco atingiu max connections (100) em 180 VUs
```

### 6. Profiling de Frontend
```
Usar Chrome DevTools Performance tab:
1. Gravar carregamento da pagina
2. Identificar:
   - Long tasks (>50ms)
   - Layout shifts (CLS)
   - Largest Contentful Paint (LCP)
   - JavaScript heap size

Lighthouse score:
- Performance: [score]
- First Contentful Paint: [tempo]
- Speed Index: [tempo]
- Largest Contentful Paint: [tempo]
- Total Blocking Time: [tempo]
- Cumulative Layout Shift: [score]
```

### 7. Propor Otimizacoes
Para cada gargalo identificado, proponha solucao concreta:
```
Gargalo #1: GET /api/library p99 = 750ms (target: 500ms)
- Causa: Full table scan na tabela library (sem indice em user_id + status)
- Solucao: CREATE INDEX idx_library_user_status ON library(user_id, status, created_at DESC)
- Impacto estimado: p99 deve cair para <200ms
- Esforco: P (pequeno, 1 migracao)

Gargalo #2: Banco atinge max connections em 180 VUs
- Causa: Cada request abre nova conexao (sem connection pooling)
- Solucao: Implementar PgBouncer ou usar Supabase connection pooler
- Impacto estimado: Suportar 500+ VUs com mesmas specs
- Esforco: M (medio, configuracao de infra)

Gargalo #3: Dashboard LCP = 3.2s (target: 2.5s)
- Causa: Bundle JS de 450kb bloqueando renderizacao
- Solucao: Code splitting com next/dynamic para componentes pesados
- Impacto estimado: LCP deve cair para <2s
- Esforco: P (pequeno, lazy loading de 3 componentes)
```

### 8. Documentar Relatorio
```markdown
## Relatorio de Performance

**Data:** 2024-01-15
**Ambiente:** Staging (2 CPU, 4GB RAM, PostgreSQL 16)
**Volume de dados:** 50k registros

### Resumo Executivo
- 2 de 3 endpoints dentro do SLA
- Frontend dentro dos targets de Core Web Vitals
- Limite de carga: ~150 usuarios simultaneos (target: 200)

### Gargalos Identificados
1. [CRITICO] Indice faltando em library (correcao trivial)
2. [IMPORTANTE] Connection pooling necessario para escalar
3. [MELHORIA] Code splitting para reduzir LCP

### Plano de Acao
| Acao | Prioridade | Esforco | Impacto |
|------|-----------|---------|---------|
| Criar indice | P0 | P | Alto |
| Connection pooling | P1 | M | Alto |
| Code splitting | P2 | P | Medio |
```

## Criterios de Aceite
- [ ] Metricas e targets definidos antes dos testes
- [ ] Load test executado em pelo menos 2 cenarios (baseline + spike)
- [ ] Queries lentas identificadas com EXPLAIN ANALYZE
- [ ] Frontend avaliado com Lighthouse e DevTools
- [ ] Gargalos documentados com causa raiz
- [ ] Otimizacoes propostas com impacto e esforco estimados
- [ ] Relatorio com decisao de go/no-go baseada nos SLAs
- [ ] Resultados sao reprodutiveis

## Entregaveis
- Relatorio de performance completo
- Scripts de load test reutilizaveis
- Lista de otimizacoes priorizadas
- Baseline documentado para comparacao futura

## Verificacao
- [ ] Todos os targets de SLA atingidos (ou desvios documentados e aceitos)
- [ ] Otimizacoes criticas implementadas e validadas
- [ ] Resultados salvos como baseline para proxima rodada
- [ ] Nenhuma regressao de performance introduzida
