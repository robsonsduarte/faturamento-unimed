# Task: DB — Otimizar Indices

## Objetivo
Identificar queries lentas, analisar planos de execucao, criar indices otimizados e validar melhoria de performance com evidencias mensuráveis.

## Contexto
Usar quando queries estao lentas, apos crescimento significativo de dados, ou como parte de auditoria periodica de performance. Indices aceleram leituras mas penalizam escritas e consomem espaco — cada indice deve ser justificado por um padrao de query real. Nao criar indices "preventivamente".

## Pre-requisitos
- [ ] Acesso ao banco com permissao para EXPLAIN ANALYZE
- [ ] Volume de dados significativo (>10k registros na tabela alvo)
- [ ] Queries lentas identificadas (via logs, pg_stat_statements, ou relato)
- [ ] Metricas de baseline documentadas

## Passos

### 1. Identificar Queries Lentas
```sql
-- Habilitar pg_stat_statements (se nao estiver habilitado)
CREATE EXTENSION IF NOT EXISTS pg_stat_statements;

-- Top 20 queries mais lentas (por tempo medio)
SELECT
  query,
  calls,
  round(mean_exec_time::numeric, 2) as avg_ms,
  round(total_exec_time::numeric, 2) as total_ms,
  rows
FROM pg_stat_statements
WHERE query NOT LIKE '%pg_stat%'
ORDER BY mean_exec_time DESC
LIMIT 20;

-- Top 20 queries que mais consomem tempo total
SELECT
  query,
  calls,
  round(mean_exec_time::numeric, 2) as avg_ms,
  round(total_exec_time::numeric / 1000, 2) as total_seconds,
  rows
FROM pg_stat_statements
WHERE calls > 100
ORDER BY total_exec_time DESC
LIMIT 20;
```

### 2. Analisar Plano de Execucao
Para cada query lenta, use EXPLAIN ANALYZE:
```sql
-- EXPLAIN ANALYZE mostra o plano REAL (executa a query)
EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT)
SELECT c.id, c.title, c.status, c.created_at, p.name as author
FROM contents c
JOIN profiles p ON p.id = c.user_id
WHERE c.user_id = '550e8400-e29b-41d4-a716-446655440000'
  AND c.status = 'published'
ORDER BY c.created_at DESC
LIMIT 20;

-- Resultado a analisar:
-- CUIDADO com:
-- "Seq Scan" em tabelas grandes (>10k rows) → indice necessario
-- "Sort" com alto custo → indice com ORDER BY pode ajudar
-- "Hash Join" vs "Nested Loop" → depende do volume
-- "Rows Removed by Filter: 50000" → indice filtraria antes
```

### 3. Identificar Indices Faltantes
Baseado no EXPLAIN, identifique:
```
Query: SELECT ... WHERE user_id = ? AND status = 'published' ORDER BY created_at DESC

Analise:
- Seq Scan on contents (rows=50000) → SEM indice em user_id + status
- Sort (cost=5000) → Sort em memoria por created_at
- Rows Removed by Filter: 49980 → Leu 50k para retornar 20

Indice sugerido:
CREATE INDEX idx_contents_user_status_date
ON contents (user_id, status, created_at DESC);

Justificativa:
- user_id: filtro de igualdade (primeiro na ordem)
- status: filtro de igualdade (segundo)
- created_at DESC: ORDER BY (elimina Sort separado)
```

### 4. Avaliar Indices Existentes
```sql
-- Listar indices existentes na tabela
SELECT
  indexname,
  indexdef,
  pg_size_pretty(pg_relation_size(indexname::regclass)) as size
FROM pg_indexes
WHERE tablename = 'contents'
ORDER BY pg_relation_size(indexname::regclass) DESC;

-- Verificar uso dos indices (indices nao usados podem ser removidos)
SELECT
  schemaname,
  relname as table_name,
  indexrelname as index_name,
  idx_scan as times_used,
  pg_size_pretty(pg_relation_size(indexrelname::regclass)) as size
FROM pg_stat_user_indexes
WHERE schemaname = 'public'
AND idx_scan = 0  -- indices NUNCA usados
ORDER BY pg_relation_size(indexrelname::regclass) DESC;
```

### 5. Criar Indices Otimizados
```sql
-- Indice composto para query frequente
-- CONCURRENTLY: nao bloqueia escrita durante criacao
CREATE INDEX CONCURRENTLY idx_contents_user_status_date
ON contents (user_id, status, created_at DESC);

-- Indice parcial (menor, mais eficiente para queries frequentes)
CREATE INDEX CONCURRENTLY idx_contents_user_published
ON contents (user_id, created_at DESC)
WHERE status = 'published';

-- Indice para busca full-text
CREATE INDEX CONCURRENTLY idx_contents_search
ON contents USING gin (to_tsvector('portuguese', title || ' ' || body));

-- Indice para JSONB (queries em campos JSON)
CREATE INDEX CONCURRENTLY idx_contents_metadata_tags
ON contents USING gin ((metadata->'tags'));
```

Regras de ouro:
- Colunas de igualdade primeiro, range/ORDER BY depois
- Filtros mais seletivos primeiro
- Use `CONCURRENTLY` em producao (nao bloqueia)
- Indices parciais (`WHERE`) para subsets frequentes

### 6. Validar Melhoria
Re-execute EXPLAIN ANALYZE apos criar o indice:
```sql
-- ANTES (sem indice):
-- Seq Scan on contents (cost=0.00..5234.00 rows=50000)
--   Filter: (user_id = '...' AND status = 'published')
--   Rows Removed by Filter: 49980
--   Planning Time: 0.15 ms
--   Execution Time: 45.23 ms

-- DEPOIS (com indice):
-- Index Scan using idx_contents_user_status_date on contents
--   Index Cond: (user_id = '...' AND status = 'published')
--   Planning Time: 0.12 ms
--   Execution Time: 0.85 ms

-- Melhoria: 45ms → 0.85ms (53x mais rapido)
```

### 7. Remover Indices Desnecessarios
```sql
-- Identificar indices redundantes (cobertos por outros mais abrangentes)
-- Ex: idx_contents_user_id e redundante se idx_contents_user_status_date existe
-- (o indice composto ja cobre queries por user_id sozinho)

-- Remover com seguranca
DROP INDEX CONCURRENTLY IF EXISTS idx_contents_user_id;

-- Verificar tamanho total de indices
SELECT
  pg_size_pretty(SUM(pg_relation_size(indexname::regclass))) as total_index_size
FROM pg_indexes
WHERE tablename = 'contents';
```

### 8. Documentar Resultado
```markdown
## Otimizacao de Indices — Tabela: contents

### Queries Otimizadas
| Query | Antes | Depois | Melhoria |
|-------|-------|--------|----------|
| Listar conteudos por usuario | 45ms | 0.85ms | 53x |
| Buscar por tag | 120ms | 3.2ms | 37x |
| Full-text search | 250ms | 15ms | 17x |

### Indices Criados
| Indice | Tipo | Tamanho | Justificativa |
|--------|------|---------|---------------|
| idx_contents_user_status_date | B-tree composto | 12MB | Queries de listagem por usuario |
| idx_contents_search | GIN (tsvector) | 8MB | Busca full-text |

### Indices Removidos
| Indice | Motivo |
|--------|--------|
| idx_contents_user_id | Redundante (coberto por composto) |

### Impacto
- Espaco adicional: +20MB de indices
- Impacto em escritas: +2ms por INSERT (aceitavel)
- Melhoria em leituras: -50ms media
```

## Criterios de Aceite
- [ ] Queries lentas identificadas com evidencia (pg_stat_statements ou EXPLAIN)
- [ ] EXPLAIN ANALYZE executado antes e depois de cada indice
- [ ] Melhoria mensuravel documentada (tempo antes vs depois)
- [ ] Indices criados com CONCURRENTLY (nao bloquear producao)
- [ ] Indices redundantes identificados e removidos
- [ ] Nenhum indice criado sem query que o justifique
- [ ] Impacto em escritas avaliado e aceitavel
- [ ] Documentacao com tabela de resultados

## Entregaveis
- Script SQL de criacao de indices (migracao)
- Script SQL de remocao de indices redundantes
- Relatorio com EXPLAIN ANALYZE antes/depois
- Documentacao de indices criados e justificativas

## Verificacao
- [ ] Queries alvo executam dentro do target de latencia
- [ ] Indices estao sendo usados (verificar pg_stat_user_indexes apos deploy)
- [ ] Escrita nao degradou significativamente
- [ ] Espaco de disco dentro do esperado
