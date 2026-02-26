# Task: Ops — Configurar Monitoramento

## Objetivo
Configurar sistema de monitoramento completo com metricas de aplicacao, infraestrutura e negocio, alertas escalonados, dashboards visuais e procedimento de on-call.

## Contexto
Usar ao configurar novo ambiente de producao ou revisar monitoramento existente. Monitoramento responde a pergunta "a aplicacao esta saudavel AGORA?". Sem ele, voce so descobre problemas quando usuarios reclamam (tarde demais). Os tres pilares: metricas (numeros), logs (eventos) e traces (fluxos).

## Pre-requisitos
- [ ] Aplicacao em producao (ou staging)
- [ ] Acesso administrativo ao servidor
- [ ] Ferramenta de monitoramento escolhida (Datadog, Grafana, UptimeRobot, etc)
- [ ] Canal de alertas configurado (Slack, email, PagerDuty)
- [ ] SLAs definidos (uptime, latencia, error rate)

## Passos

### 1. Definir Metricas Essenciais
```
Metricas de Aplicacao (RED):
- Rate: Requests por segundo (por endpoint)
- Errors: Taxa de erro (5xx / total, por endpoint)
- Duration: Latencia (p50, p95, p99, por endpoint)

Metricas de Infraestrutura (USE):
- Utilization: CPU%, Memoria%, Disco%
- Saturation: Load average, fila de conexoes DB
- Errors: OOM kills, disk full, connection refused

Metricas de Negocio:
- Usuarios ativos (DAU/WAU/MAU)
- Geracoes de conteudo por hora
- Creditos consumidos por dia
- Taxa de conversao (free → pago)
- Tempo de resposta de AI (p95)

Metricas de Dependencias:
- Supabase: latencia, error rate, connections
- AI providers: latencia, error rate, custo
- Stripe: webhooks recebidos, falhas
```

### 2. Implementar Health Check
```typescript
// src/app/api/health/route.ts
import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

export async function GET() {
  const checks: Record<string, { status: string; latency?: number }> = {}
  const start = Date.now()

  // Check: Banco de dados
  try {
    const dbStart = Date.now()
    const supabase = createServiceClient()
    await supabase.from('profiles').select('id').limit(1)
    checks.database = { status: 'ok', latency: Date.now() - dbStart }
  } catch {
    checks.database = { status: 'error' }
  }

  // Check: Memoria
  const memUsage = process.memoryUsage()
  checks.memory = {
    status: memUsage.heapUsed / memUsage.heapTotal > 0.9 ? 'warning' : 'ok',
    latency: Math.round(memUsage.heapUsed / 1024 / 1024), // MB
  }

  const allOk = Object.values(checks).every(c => c.status === 'ok')

  return NextResponse.json({
    status: allOk ? 'ok' : 'degraded',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    checks,
    responseTime: Date.now() - start,
  }, {
    status: allOk ? 200 : 503,
  })
}
```

### 3. Configurar Coleta de Metricas
```typescript
// src/lib/metrics.ts
import { createLogger } from '@/lib/logger'

const logger = createLogger({ module: 'metrics' })

// Middleware para registrar metricas de request
export function logRequestMetrics(
  method: string,
  path: string,
  statusCode: number,
  duration: number
) {
  logger.info({
    type: 'request_metric',
    method,
    path,
    statusCode,
    duration,
    timestamp: new Date().toISOString(),
  }, `${method} ${path} ${statusCode} ${duration}ms`)
}

// No API route:
export async function GET(request: NextRequest) {
  const start = Date.now()
  try {
    const result = await processRequest()
    logRequestMetrics('GET', '/api/content', 200, Date.now() - start)
    return NextResponse.json(result)
  } catch (error) {
    logRequestMetrics('GET', '/api/content', 500, Date.now() - start)
    throw error
  }
}
```

### 4. Configurar Alertas
```
Alertas Criticos (notificar imediatamente):
- Health check falhou por 3 checagens consecutivas
- Error rate > 10% por 5 minutos
- CPU > 95% por 10 minutos
- Memoria > 90% por 5 minutos
- Disco > 90%
- Processo PM2 reiniciou inesperadamente
- Zero requests por 5 minutos (durante horario comercial)

Alertas de Aviso (notificar em canal):
- Latencia p95 > 2x baseline por 15 minutos
- Error rate > 5% por 10 minutos
- CPU > 80% por 30 minutos
- Memoria > 80% por 15 minutos
- Disco > 80%
- Certificado SSL expira em <14 dias

Alertas Informativos (log apenas):
- Deploy realizado
- Backup concluido
- Migracao aplicada
- Novo usuario registrado
```

### 5. Criar Dashboard
```
Dashboard Principal:
┌─────────────────────────────────────────────────────┐
│ STATUS: ✅ Todos os servicos operacionais           │
│ Uptime: 99.98% (ultimos 30 dias)                   │
├─────────────────┬───────────────────────────────────┤
│ Requests/min    │ Error Rate                        │
│ [===== 250] ▲   │ [= 0.2%] ✓                       │
├─────────────────┼───────────────────────────────────┤
│ Latencia p95    │ Usuarios Ativos                   │
│ [=== 180ms] ✓   │ [======= 42] ▲                   │
├─────────────────┼───────────────────────────────────┤
│ CPU             │ Memoria                           │
│ [==== 45%]  ✓   │ [===== 62%] ✓                    │
├─────────────────┴───────────────────────────────────┤
│ Ultimos Erros:                                      │
│ 14:23 - POST /api/generate - 500 (timeout)         │
│ 14:20 - GET /api/library - 500 (db connection)     │
└─────────────────────────────────────────────────────┘
```

### 6. Configurar Monitoramento Externo
```bash
# UptimeRobot / Better Uptime / Pingdom
# Monitoramento externo (de fora da rede)

Endpoints a monitorar:
- https://app.example.com/api/health (30s interval)
- https://app.example.com/ (1min interval)
- https://app.example.com/auth/login (5min interval)

Configuracao:
- Timeout: 10 segundos
- Retries: 3 antes de alertar
- Regioes: Brasil + US East (para detectar problemas de rede)
- Alerta: Slack + Email + SMS (para criticos)
```

### 7. Configurar Log Aggregation
```typescript
// Logs estruturados com Pino
// Ja configurado em src/lib/logger.ts

// Enviar para servico de log (Datadog, Logflare, etc)
// via pino-transport ou drain de logs do servidor

// Em producao, configurar:
// - Rotacao de logs (max 100MB por arquivo, 7 dias retencao)
// - Parsing de logs estruturados (JSON)
// - Busca e filtro por modulo, nivel, request_id
// - Correlacao de logs entre servicos (request_id)
```

### 8. Documentar Procedimento de On-Call
```markdown
## Procedimento de On-Call

### Quando e Acionado
- Alerta critico disparado
- Usuario reporta sistema indisponivel
- Monitoramento externo detecta downtime

### Primeiro Respondente
1. Verificar status page (UptimeRobot)
2. Verificar health check: `curl https://app.example.com/api/health`
3. Verificar logs: `pm2 logs --lines 100`
4. Verificar recursos: `htop`, `df -h`
5. Verificar banco: Supabase Dashboard → Database → Health

### Escalonamento
| Tempo | Acao |
|-------|------|
| 0-5min | Primeiro respondente investiga |
| 5-15min | Se nao resolvido, escalar para CTO |
| 15-30min | Considerar rollback |
| 30min+ | Comunicar usuarios, ativar pagina de manutencao |

### Numeros de Emergencia
| Pessoa | Contato | Horario |
|--------|---------|---------|
| Dev 1 | +55... | 08-22h |
| Dev 2 | +55... | 08-22h |
| CTO | +55... | 24h |
```

## Criterios de Aceite
- [ ] Health check endpoint implementado e funcional
- [ ] Metricas RED (Rate, Errors, Duration) sendo coletadas
- [ ] Metricas USE (Utilization, Saturation, Errors) sendo coletadas
- [ ] Alertas criticos configurados com notificacao imediata
- [ ] Alertas de aviso configurados com notificacao em canal
- [ ] Dashboard operacional com metricas principais
- [ ] Monitoramento externo configurado (uptime check)
- [ ] Logs estruturados com agregacao
- [ ] Procedimento de on-call documentado
- [ ] Escalonamento definido com contatos

## Entregaveis
- Health check endpoint
- Configuracao de coleta de metricas
- Regras de alertas documentadas
- Dashboard (ou configuracao para criar)
- Monitoramento externo configurado
- Procedimento de on-call

## Verificacao
- [ ] Health check retorna status correto
- [ ] Alerta dispara quando servico cai (testar parando PM2)
- [ ] Dashboard mostra metricas em tempo real
- [ ] Monitoramento externo detecta downtime em <2 minutos
- [ ] Equipe sabe como agir quando recebe alerta
