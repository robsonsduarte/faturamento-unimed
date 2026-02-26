# Task: Dev — Integrar Servico Externo

## Objetivo
Implementar integracao com servico externo de forma robusta, com client tipado, tratamento de erros, retry com backoff, circuit breaker, mocking para testes e monitoramento.

## Contexto
Usar quando o sistema precisa se comunicar com uma API ou servico de terceiros (provedores de AI, gateways de pagamento, servicos de email, APIs de redes sociais, etc). A integracao deve ser resiliente a falhas do servico externo e nao propagar erros para o usuario final sem tratamento.

## Pre-requisitos
- [ ] Documentacao da API externa disponivel
- [ ] Credenciais de acesso (API keys, tokens) obtidas
- [ ] Ambiente de sandbox/teste do servico externo disponivel
- [ ] Limites de rate da API externa conhecidos
- [ ] Compreensao dos custos por chamada (se aplicavel)

## Passos

### 1. Criar Client Tipado
Encapsule toda comunicacao em um servico dedicado:
```typescript
// src/lib/services/external-service-client.ts
import { createLogger } from '@/lib/logger'

const logger = createLogger({ module: 'external-service' })

interface ExternalServiceConfig {
  apiKey: string
  baseUrl: string
  timeout?: number  // ms, default: 30000
}

interface GenerateResponse {
  id: string
  content: string
  usage: { tokens: number; cost_cents: number }
}

export class ExternalServiceClient {
  private config: ExternalServiceConfig

  constructor(config: ExternalServiceConfig) {
    this.config = { timeout: 30000, ...config }
  }

  async generate(prompt: string): Promise<GenerateResponse> {
    // implementacao
  }
}
```
Nunca chame a API externa diretamente de um route handler — sempre via client.

### 2. Implementar Tratamento de Erros
Crie erros tipados para cada cenario:
```typescript
export class ExternalServiceError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
    public readonly retryable: boolean,
    public readonly originalError?: unknown
  ) {
    super(message)
    this.name = 'ExternalServiceError'
  }
}

// No client:
async function callApi(endpoint: string, body: unknown): Promise<Response> {
  const response = await fetch(`${this.config.baseUrl}${endpoint}`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${this.config.apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(this.config.timeout),
  })

  if (!response.ok) {
    const isRetryable = [429, 500, 502, 503, 504].includes(response.status)
    throw new ExternalServiceError(
      `API retornou ${response.status}`,
      response.status,
      isRetryable,
    )
  }

  return response
}
```

### 3. Implementar Retry com Exponential Backoff
```typescript
async function withRetry<T>(
  fn: () => Promise<T>,
  options: { maxRetries: number; baseDelay: number; maxDelay: number }
): Promise<T> {
  const { maxRetries, baseDelay, maxDelay } = options

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn()
    } catch (error) {
      const isLast = attempt === maxRetries
      const isRetryable = error instanceof ExternalServiceError && error.retryable

      if (isLast || !isRetryable) throw error

      const delay = Math.min(baseDelay * Math.pow(2, attempt), maxDelay)
      const jitter = delay * (0.5 + Math.random() * 0.5)  // evitar thundering herd

      logger.warn({ attempt, delay: jitter, error: error.message }, 'Retentando chamada')
      await new Promise(resolve => setTimeout(resolve, jitter))
    }
  }

  throw new Error('Unreachable')
}
```
Configuracao sugerida: 2-3 retries, baseDelay 1000ms, maxDelay 10000ms.

### 4. Implementar Fallback (se aplicavel)
Quando ha provedores alternativos:
```typescript
async function generateWithFallback(prompt: string): Promise<GenerateResponse> {
  const providers = [primaryClient, fallbackClient1, fallbackClient2]

  for (const provider of providers) {
    try {
      return await withRetry(() => provider.generate(prompt), retryOptions)
    } catch (error) {
      logger.warn({ provider: provider.name, error }, 'Provider falhou, tentando proximo')
    }
  }

  throw new ExternalServiceError('Todos os provedores falharam', 503, false)
}
```

### 5. Implementar Cache (se aplicavel)
Para respostas idempotemtes:
```typescript
const cache = new Map<string, { data: GenerateResponse; expiresAt: number }>()
const CACHE_TTL = 5 * 60 * 1000  // 5 minutos

async function generateCached(prompt: string): Promise<GenerateResponse> {
  const cacheKey = createHash('sha256').update(prompt).digest('hex')
  const cached = cache.get(cacheKey)

  if (cached && cached.expiresAt > Date.now()) {
    logger.debug({ cacheKey }, 'Cache hit')
    return cached.data
  }

  const result = await generate(prompt)
  cache.set(cacheKey, { data: result, expiresAt: Date.now() + CACHE_TTL })
  return result
}
```

### 6. Armazenar Credenciais de Forma Segura
- Nunca hardcode API keys no codigo
- Use variaveis de ambiente ou banco de dados (tabela `api_credentials`)
- Para chaves rotativas, implemente refresh automatico
- Log NUNCA deve conter chaves (mascare: `key.slice(0, 8) + '...'`)

### 7. Criar Mocks para Testes
```typescript
// src/lib/services/__mocks__/external-service-client.ts
export const mockExternalClient = {
  generate: vi.fn().mockResolvedValue({
    id: 'mock-id',
    content: 'Conteudo mockado para testes',
    usage: { tokens: 100, cost_cents: 5 },
  }),
}

// No teste:
vi.mock('@/lib/services/external-service-client', () => ({
  ExternalServiceClient: vi.fn(() => mockExternalClient),
}))
```
Testes NUNCA devem chamar APIs externas reais.

### 8. Adicionar Monitoramento
Registre metricas de cada chamada:
```typescript
const end = timeOperation()
try {
  const result = await callApi(endpoint, body)
  const elapsed = end()
  logger.info({ endpoint, elapsed, tokens: result.usage.tokens }, 'Chamada API concluida')
  return result
} catch (error) {
  const elapsed = end()
  logger.error({ endpoint, elapsed, error }, 'Chamada API falhou')
  throw error
}
```

## Criterios de Aceite
- [ ] Client tipado com TypeScript (sem `any`)
- [ ] Erros tipados e categorizados (retryable vs fatal)
- [ ] Retry com exponential backoff implementado
- [ ] Timeout configurado para evitar requests infinitos
- [ ] Credenciais armazenadas de forma segura (nao no codigo)
- [ ] Mocks criados para testes
- [ ] Testes cobrem happy path, erros e retry
- [ ] Logs estruturados em cada chamada (sem expor credenciais)
- [ ] Rate limit do servico externo respeitado
- [ ] Fallback implementado (se ha alternativa disponivel)

## Entregaveis
- Client do servico externo (`src/lib/services/[servico]-client.ts`)
- Tipos/interfaces (`src/types/` ou inline)
- Mocks para testes (`__mocks__/`)
- Testes (`__tests__/`)
- Documentacao de configuracao (env vars necessarias)

## Verificacao
- [ ] Chamada funciona com credenciais reais em ambiente de dev/staging
- [ ] Retry funciona quando servico retorna 500/503
- [ ] Timeout dispara corretamente
- [ ] Testes passam com mocks (sem chamadas reais)
- [ ] Logs nao contem credenciais
