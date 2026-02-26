# Task: Dev — Implementar Feature Completa End-to-End

## Objetivo
Implementar uma feature completa cobrindo backend (API, banco, servicos), frontend (UI, estado, navegacao) e testes, entregando funcionalidade pronta para producao.

## Contexto
Usar quando uma feature precisa ser implementada de ponta a ponta. Diferente de `dev-api-endpoint` (so backend) ou `dev-component` (so UI), esta task cobre o ciclo completo. Ideal para features que envolvem nova tela + novo endpoint + novo schema. Requer spec ou PRD ja definidos.

## Pre-requisitos
- [ ] Especificacao da feature disponivel (spec-feature ou PRD)
- [ ] Schema de banco definido (ou incluir nesta task)
- [ ] Contrato de API definido (ou incluir nesta task)
- [ ] Design/wireframe disponivel (ou componentes existentes suficientes)
- [ ] Branch de desenvolvimento criada

## Passos

### 1. Planejar a Ordem de Implementacao
Sempre de baixo para cima:
```
1. Banco de dados (migrations, seeds)
2. Backend (API routes, servicos, validacao)
3. Frontend (componentes, paginas, hooks)
4. Integracao (conectar frontend ao backend)
5. Testes (unit, integration)
6. Polimento (loading states, erros, edge cases)
```
Isso permite testar cada camada isoladamente.

### 2. Implementar Camada de Banco
```sql
-- Migracao
CREATE TABLE feature_items (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  title VARCHAR(200) NOT NULL,
  content TEXT,
  status VARCHAR(20) DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'archived')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS
ALTER TABLE feature_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_crud_own_items"
  ON feature_items FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Indices
CREATE INDEX idx_feature_items_user ON feature_items(user_id, created_at DESC);
```

### 3. Implementar Servico de Backend
Crie um servico que encapsula a logica de negocio:
```typescript
// src/lib/services/feature-items.ts
import { createServiceClient } from '@/lib/supabase/server'
import { createLogger } from '@/lib/logger'

const logger = createLogger({ module: 'feature-items' })

export async function createFeatureItem(userId: string, data: CreateItemInput) {
  const supabase = createServiceClient()

  const { data: item, error } = await supabase
    .from('feature_items')
    .insert({ user_id: userId, ...data })
    .select()
    .single()

  if (error) {
    logger.error({ error, userId }, 'Falha ao criar item')
    throw new Error(`Falha ao criar item: ${error.message}`)
  }

  logger.info({ itemId: item.id, userId }, 'Item criado')
  return item
}
```

### 4. Implementar API Routes
```typescript
// src/app/api/feature-items/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createFeatureItem, listFeatureItems } from '@/lib/services/feature-items'
import { z } from 'zod'

const createSchema = z.object({
  title: z.string().min(1).max(200),
  content: z.string().optional(),
})

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })

  const items = await listFeatureItems(user.id)
  return NextResponse.json({ items })
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })

  const body = await request.json()
  const parsed = createSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'VALIDATION_ERROR', details: parsed.error.flatten().fieldErrors },
      { status: 400 }
    )
  }

  const item = await createFeatureItem(user.id, parsed.data)
  return NextResponse.json({ item }, { status: 201 })
}
```

### 5. Criar Hook de Estado
```typescript
// src/hooks/use-feature-items.ts
'use client'

import { useState, useEffect, useCallback } from 'react'

interface UseFeatureItemsReturn {
  items: FeatureItem[]
  isLoading: boolean
  error: string | null
  create: (data: CreateItemInput) => Promise<FeatureItem>
  refresh: () => Promise<void>
}

export function useFeatureItems(): UseFeatureItemsReturn {
  const [items, setItems] = useState<FeatureItem[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchItems = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const response = await fetch('/api/feature-items')
      if (!response.ok) throw new Error('Falha ao carregar itens')
      const data = await response.json()
      setItems(data.items)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro desconhecido')
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => { fetchItems() }, [fetchItems])

  const create = useCallback(async (data: CreateItemInput) => {
    const response = await fetch('/api/feature-items', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })
    if (!response.ok) throw new Error('Falha ao criar item')
    const { item } = await response.json()
    setItems(prev => [item, ...prev])
    return item
  }, [])

  return { items, isLoading, error, create, refresh: fetchItems }
}
```

### 6. Implementar Componentes de UI
Siga a hierarquia:
1. Componentes atomicos (se necessario)
2. Componentes compostos (formularios, cards, listas)
3. Pagina completa

```typescript
// src/app/dashboard/feature-items/page.tsx
'use client'

import { useFeatureItems } from '@/hooks/use-feature-items'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

export default function FeatureItemsPage() {
  const { items, isLoading, error, create } = useFeatureItems()

  if (isLoading) return <LoadingSkeleton />
  if (error) return <ErrorState message={error} />
  if (items.length === 0) return <EmptyState />

  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white">Meus Itens</h1>
        <Button onClick={() => { /* abrir modal de criacao */ }}>
          Novo Item
        </Button>
      </header>
      <div className="grid gap-4">
        {items.map(item => <ItemCard key={item.id} item={item} />)}
      </div>
    </div>
  )
}
```

### 7. Tratar Estados de UI
Implemente TODOS os estados:
- **Loading:** skeleton shimmer (nao spinner generico)
- **Empty:** ilustracao + mensagem + CTA para criar primeiro item
- **Error:** mensagem de erro + botao de retry
- **Success:** feedback visual (toast) apos criar/editar/deletar
- **Confirmacao:** dialog antes de acoes destrutivas (deletar)

### 8. Escrever Testes
```typescript
// Teste do servico
describe('createFeatureItem', () => {
  it('deve criar item com dados validos', async () => { ... })
  it('deve falhar com userId invalido', async () => { ... })
})

// Teste do hook
describe('useFeatureItems', () => {
  it('deve carregar items ao montar', async () => { ... })
  it('deve adicionar item criado a lista', async () => { ... })
})

// Teste da API
describe('POST /api/feature-items', () => {
  it('deve retornar 201 para input valido', async () => { ... })
  it('deve retornar 400 para input invalido', async () => { ... })
  it('deve retornar 401 sem autenticacao', async () => { ... })
})
```

### 9. Verificacao Final
```bash
npx tsc --noEmit      # Zero erros de tipo
npm run lint           # Zero warnings
npx vitest run         # Todos os testes passando
npm run build          # Build funciona
```

## Criterios de Aceite
- [ ] Migracao de banco aplicada e reversivel
- [ ] RLS configurado corretamente
- [ ] API endpoints funcionais com validacao e auth
- [ ] Hook gerencia estado corretamente (loading, error, data)
- [ ] UI implementada com todos os estados (loading, empty, error, success)
- [ ] Feedback visual para acoes do usuario (toasts, loading no botao)
- [ ] Testes cobrem camada de servico, API e hook
- [ ] Tipagem passa sem erros
- [ ] Lint passa sem warnings
- [ ] Navegacao e roteamento funcionam

## Entregaveis
- Migracao SQL (up + down)
- Servico de backend
- API routes
- Hook React
- Componentes de UI
- Pagina completa
- Testes

## Verificacao
- [ ] Fluxo completo funciona de ponta a ponta (criar, listar, editar, deletar)
- [ ] Funciona em mobile e desktop
- [ ] Performance aceitavel (pagina carrega em <2s)
- [ ] Erros sao tratados graciosamente (nunca tela branca)
