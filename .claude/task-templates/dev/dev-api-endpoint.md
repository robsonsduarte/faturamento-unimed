# Task: Dev — Implementar Endpoint de API

## Objetivo
Implementar um endpoint de API completo com rota, validacao de entrada, logica de negocio, tratamento de erros, rate limiting, autenticacao e testes automatizados.

## Contexto
Usar quando um novo endpoint precisa ser criado ou um existente precisa ser significativamente alterado. Segue o padrao Next.js App Router com route handlers. O endpoint deve ser production-ready ao final: validado, testado, logado e documentado.

## Pre-requisitos
- [ ] Contrato de API definido (request/response schemas)
- [ ] Banco de dados com tabelas necessarias ja existentes
- [ ] Autenticacao configurada no projeto
- [ ] Entendimento do padrao de API existente no projeto

## Passos

### 1. Criar Arquivo de Rota
Siga o padrao Next.js App Router:
```
src/app/api/[dominio]/[acao]/route.ts
```
Exporte funcoes nomeadas para cada metodo HTTP:
```typescript
export async function GET(request: NextRequest) { ... }
export async function POST(request: NextRequest) { ... }
```

### 2. Implementar Validacao de Entrada
Use Zod para validar body, query params e path params:
```typescript
import { z } from 'zod'

const requestSchema = z.object({
  title: z.string().min(1).max(200),
  niche: z.enum(['neuro', 'mental', 'nutri', 'reab', 'dermato', 'odonto']),
  options: z.object({
    tone: z.enum(['formal', 'casual', 'tecnico']).default('casual'),
    max_length: z.number().min(100).max(2000).default(500),
  }).optional(),
})

// No handler:
const body = await request.json()
const parsed = requestSchema.safeParse(body)
if (!parsed.success) {
  return NextResponse.json(
    { error: 'VALIDATION_ERROR', message: 'Dados invalidos', details: parsed.error.flatten().fieldErrors },
    { status: 400 }
  )
}
```

### 3. Implementar Autenticacao e Autorizacao
```typescript
import { createClient } from '@/lib/supabase/server'

const supabase = await createClient()
const { data: { user }, error } = await supabase.auth.getUser()

if (!user) {
  return NextResponse.json(
    { error: 'UNAUTHORIZED', message: 'Autenticacao necessaria' },
    { status: 401 }
  )
}

// Se requer role especifica:
const { data: profile } = await supabase
  .from('profiles')
  .select('role')
  .eq('id', user.id)
  .single()

if (profile?.role !== 'admin') {
  return NextResponse.json(
    { error: 'FORBIDDEN', message: 'Acesso negado' },
    { status: 403 }
  )
}
```

### 4. Implementar Logica de Negocio
- Separe a logica em funcoes/servicos reutilizaveis (nao no handler diretamente)
- Use transacoes do banco quando multiplas operacoes precisam ser atomicas
- Trate casos de borda: recurso nao encontrado, conflito, estado invalido
- Use o logger para registrar operacoes significativas:
```typescript
import { createLogger } from '@/lib/logger'
const logger = createLogger({ module: 'api-content-generate' })

logger.info({ userId: user.id, niche: parsed.data.niche }, 'Iniciando geracao de conteudo')
```

### 5. Implementar Rate Limiting
```typescript
import { checkRateLimit, getRateLimitIdentifier, RATE_LIMIT_PRESETS } from '@/lib/rate-limiter'

const identifier = getRateLimitIdentifier(request)
const rateLimit = checkRateLimit(identifier, RATE_LIMIT_PRESETS.moderate)

if (!rateLimit.allowed) {
  return NextResponse.json(
    { error: 'RATE_LIMITED', message: 'Muitas requisicoes. Tente novamente em breve.' },
    { status: 429, headers: { 'Retry-After': String(rateLimit.retryAfter) } }
  )
}
```

### 6. Implementar Tratamento de Erros
Envolva toda a logica em try/catch com erros tipados:
```typescript
try {
  // ... logica
  return NextResponse.json(result, { status: 200 })
} catch (error) {
  logError('Falha ao processar requisicao', error, { userId: user?.id })

  if (error instanceof NotFoundError) {
    return NextResponse.json(
      { error: 'NOT_FOUND', message: error.message },
      { status: 404 }
    )
  }

  return NextResponse.json(
    { error: 'INTERNAL_ERROR', message: 'Erro interno do servidor' },
    { status: 500 }
  )
}
```

### 7. Escrever Testes
Crie testes unitarios para:
- Validacao de entrada (body valido, body invalido, campos faltando)
- Autenticacao (sem token, token invalido, token expirado)
- Autorizacao (role incorreta)
- Logica de negocio (happy path, edge cases)
- Tratamento de erros (banco indisponivel, servico externo falhando)

```typescript
describe('POST /api/content/generate', () => {
  it('deve retornar 400 para body invalido', async () => { ... })
  it('deve retornar 401 sem autenticacao', async () => { ... })
  it('deve retornar 200 e conteudo gerado para input valido', async () => { ... })
})
```

### 8. Verificar Tipagem e Lint
```bash
npx tsc --noEmit    # zero erros de tipo
npm run lint         # zero warnings/errors
```

## Criterios de Aceite
- [ ] Endpoint responde no path correto com metodo HTTP adequado
- [ ] Validacao rejeita input invalido com mensagem clara (400)
- [ ] Autenticacao e verificada (401 sem token)
- [ ] Autorizacao e verificada quando aplicavel (403 sem permissao)
- [ ] Rate limiting implementado e configurado
- [ ] Erros sao logados com contexto (logger, nao console.log)
- [ ] Resposta de sucesso segue o schema definido
- [ ] Testes cobrem happy path e pelo menos 3 cenarios de erro
- [ ] Tipagem passa sem erros (`tsc --noEmit`)
- [ ] Lint passa sem warnings (`npm run lint`)

## Entregaveis
- Arquivo de rota (`src/app/api/[dominio]/[acao]/route.ts`)
- Servico de logica de negocio (se aplicavel)
- Schema Zod de validacao
- Arquivo de testes
- Tipos TypeScript atualizados (se necessario)

## Verificacao
- [ ] Teste manual com curl ou Postman confirma comportamento esperado
- [ ] Testes automatizados passam
- [ ] Log esta aparecendo corretamente no console/Pino
- [ ] Endpoint e consistente com outros endpoints existentes no projeto
