# Task: Ops — Planejar Escalabilidade

## Objetivo
Identificar gargalos atuais do sistema, planejar estrategia de escalabilidade horizontal e vertical, implementar caching e CDN, e definir thresholds para acoes de escala, preparando o sistema para crescimento.

## Contexto
Usar quando o sistema esta se aproximando dos limites de capacidade, apos crescimento significativo de usuarios, ou como parte de planejamento para proxima fase do produto. Escalar prematuramente e desperdicio; escalar tarde demais e incidente. O objetivo e ter um plano pronto para executar ANTES de precisar.

## Pre-requisitos
- [ ] Metricas de uso atual disponiveis (requests/s, CPU, memoria, conexoes DB)
- [ ] Projecao de crescimento (quantos usuarios em 3/6/12 meses)
- [ ] Arquitetura atual documentada
- [ ] Orcamento para infraestrutura definido
- [ ] SLAs de performance definidos

## Passos

### 1. Mapear Arquitetura Atual
```
Topologia atual:
┌─────────────┐     ┌──────────────────┐     ┌───────────────┐
│  Cloudflare │────▶│  VPS (1 instancia)│────▶│   Supabase    │
│   (CDN)     │     │  Next.js + PM2   │     │  PostgreSQL   │
└─────────────┘     │  2 CPU / 4GB RAM │     │  + Storage    │
                    └──────────────────┘     └───────────────┘
                           │
                    ┌──────┴──────┐
                    │ Edge Funcs  │
                    │ (Supabase)  │
                    └─────────────┘

Capacidades atuais:
- Requests/s: ~200 (p95 < 500ms)
- Usuarios simultaneos: ~100
- Conexoes DB: 60 de 100 disponiveis
- CPU: media 45%, pico 80%
- Memoria: 2.8GB de 4GB usados
- Disco: 15GB de 50GB usados
```

### 2. Identificar Gargalos (Bottleneck Analysis)
```
Para cada componente, responder:
"Se eu 10x o trafego, o que quebra primeiro?"

1. CPU → Geracoes de AI sao CPU-intensive?
   → Nao, offloaded para Edge Functions. CPU e OK.

2. Memoria → Cache em memoria cresce com usuarios?
   → Sim. Rate limiter + credential cache usam ~200MB com 100 usuarios.
   → Projecao 1000 usuarios: ~500MB. Perigoso com 4GB total.

3. Conexoes DB → Pool esgota?
   → Sim. 60 de 100 usadas com 100 usuarios. 1000 usuarios = 600 (ESTOURA).
   → GARGALO #1

4. Disco → Arquivos temporarios (ffmpeg) acumulam?
   → Sim. 500MB/dia de temp files. Cleanup a cada 6h.
   → OK se cleanup funciona.

5. Bandwidth → Uploads/downloads de video?
   → Supabase Storage com CDN. OK.

6. Edge Functions → Limites de concorrencia?
   → Supabase Free: 100 invocacoes/s. Pro: ilimitado.
   → OK no plano Pro.

Resultado:
Gargalo #1: Conexoes de banco de dados
Gargalo #2: Memoria RAM
Gargalo #3: Single point of failure (1 servidor)
```

### 3. Planejar Escalabilidade Vertical
```
Escalabilidade vertical (servidor maior):

Fase atual: 2 CPU / 4GB RAM / 50GB SSD
  → Suporta: ~100 usuarios simultaneos

Fase 2: 4 CPU / 8GB RAM / 100GB SSD
  → Investimento: +R$50/mes
  → Suporta: ~300 usuarios simultaneos
  → Beneficio: Dobra conexoes, dobra cache, mais head room

Fase 3: 8 CPU / 16GB RAM / 200GB SSD
  → Investimento: +R$150/mes
  → Suporta: ~800 usuarios simultaneos

Limite vertical: ~1000 usuarios (apos isso, precisa horizontal)
```

### 4. Planejar Escalabilidade Horizontal
```
Escalabilidade horizontal (mais servidores):

Arquitetura target:
┌─────────────┐     ┌──────────────┐
│  Cloudflare │────▶│ Load Balancer │
│   (CDN)     │     │   (Nginx)    │
└─────────────┘     └──────┬───────┘
                     ┌─────┼─────┐
                     ▼     ▼     ▼
                   ┌───┐ ┌───┐ ┌───┐
                   │App│ │App│ │App│
                   │ 1 │ │ 2 │ │ 3 │
                   └─┬─┘ └─┬─┘ └─┬─┘
                     └─────┼─────┘
                           ▼
                    ┌─────────────┐     ┌──────────┐
                    │  PgBouncer  │────▶│ Supabase │
                    │(conn pool)  │     │ Postgres │
                    └─────────────┘     └──────────┘
                           │
                    ┌──────┴──────┐
                    │    Redis    │
                    │(cache/session)│
                    └─────────────┘

Prerequisitos para horizontal:
- [ ] Sessoes externalizadas (nao em memoria) → Redis
- [ ] Cache externalizado (nao in-memory) → Redis
- [ ] Uploads via Storage (nao filesystem local) → Supabase Storage
- [ ] Temp files limpos apos uso (nao depender de cleanup cron)
- [ ] Health check no load balancer
```

### 5. Implementar Caching
```
Camadas de cache:

1. CDN (Cloudflare):
   - Assets estaticos (JS, CSS, imagens): cache 1 ano (hash no nome)
   - Paginas publicas: cache 5 min (stale-while-revalidate)
   - API routes: NO cache (Cache-Control: no-store)
   - Config: Page Rules ou Cache Rules no Cloudflare Dashboard

2. Aplicacao (Redis ou in-memory):
   - Credenciais de admin: cache 5 min (ja implementado)
   - Planos de assinatura: cache 1 hora (muda raramente)
   - Perfil do usuario: cache 5 min (muda pouco)
   - Rate limiting: Redis para multi-instancia

3. Banco de dados:
   - Query results: materialized views para dashboards
   - Contagens: cache de COUNT(*) com invalidacao por trigger
   - Full-text search: indice GIN (nao recalcula a cada query)

4. Proxy reverso (Nginx):
   - Micro-caching de responses: 1 segundo (elimina thundering herd)
   - Buffer de uploads: evita pressao no Node.js
```

### 6. Configurar CDN
```
Cloudflare configuracao:

DNS:
- A record: app.example.com.br → IP do servidor (proxied, nuvem laranja)

SSL/TLS:
- Mode: Full (strict)
- Always Use HTTPS: On
- Min TLS Version: 1.2
- HSTS: On, max-age 1 year

Caching:
- Browser Cache TTL: Respect existing headers
- Cache Level: Standard

Page Rules:
1. *.example.com.br/api/* → Cache Level: Bypass
2. *.example.com.br/_next/static/* → Cache Level: Cache Everything, Edge TTL 1 month
3. *.example.com.br/* → Cache Level: Standard

Performance:
- Auto Minify: JS, CSS, HTML
- Brotli: On
- HTTP/2: On
- HTTP/3: On (experimental)
- Early Hints: On

Security:
- WAF: On (Managed Rules)
- Bot Fight Mode: On
- Rate Limiting: 100 requests/10s por IP para /api/*
```

### 7. Definir Thresholds e Plano de Acao
```
Thresholds de escalabilidade:

| Metrica | Normal | Atencao | Critico | Acao |
|---------|--------|---------|---------|------|
| CPU media | <50% | 50-75% | >75% | Vertical: mais CPU |
| Memoria | <70% | 70-85% | >85% | Vertical: mais RAM |
| Conexoes DB | <60% | 60-80% | >80% | PgBouncer + pool |
| Disco | <70% | 70-85% | >85% | Limpar + expandir |
| Latencia p95 | <500ms | 500ms-1s | >1s | Cache + indices |
| Error rate | <1% | 1-5% | >5% | Investigar + escalar |

Plano de acao por fase:
Fase 1 (agora): Otimizar (cache, indices, cleanup)
Fase 2 (500 usuarios): Vertical (8GB RAM, 4 CPU)
Fase 3 (1000 usuarios): PgBouncer + Redis externo
Fase 4 (5000 usuarios): Horizontal (2+ instancias + LB)
Fase 5 (10000+ usuarios): Kubernetes ou serverless
```

### 8. Documentar Plano
```markdown
## Plano de Escalabilidade

### Estado Atual
- 1 VPS (2 CPU / 4GB / 50GB)
- ~100 usuarios simultaneos suportados
- Gargalo principal: conexoes de banco

### Roadmap de Escala
| Fase | Trigger | Acao | Custo | Capacidade |
|------|---------|------|-------|-----------|
| 1 | Agora | Cache + indices | R$0 | +50% |
| 2 | CPU >75% | Upgrade VPS | +R$50/mes | 300 users |
| 3 | DB conn >80% | PgBouncer | +R$30/mes | 800 users |
| 4 | 1 server insuficiente | 2o servidor + LB | +R$200/mes | 2000 users |

### Decisao de Investimento
ROI por fase calculado baseado no MRR por usuario.
```

## Criterios de Aceite
- [ ] Arquitetura atual mapeada com capacidades
- [ ] Gargalos identificados e priorizados
- [ ] Plano vertical com 3 fases de upgrade
- [ ] Plano horizontal com prerequisitos listados
- [ ] Estrategia de caching multicamada definida
- [ ] CDN configurado e otimizado
- [ ] Thresholds de escala definidos com acoes
- [ ] Custo de cada fase estimado
- [ ] Plano documentado e revisado

## Entregaveis
- Documento de plano de escalabilidade
- Diagrama de arquitetura atual e target
- Configuracao de CDN
- Estrategia de caching implementavel
- Tabela de thresholds e acoes

## Verificacao
- [ ] Gargalo #1 tem solucao implementavel em <1 semana
- [ ] Plano suporta crescimento de 10x sem redesign
- [ ] Custos sao proporcionais ao crescimento de receita
- [ ] Nenhum single point of failure sem plano de redundancia
- [ ] Equipe sabe quando e como escalar cada fase
