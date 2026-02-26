# Task: Dev — Criar Hook React Customizado

## Objetivo
Criar um hook React customizado com interface tipada, gerenciamento de estado, side effects controlados, cleanup adequado e testes automatizados, encapsulando logica reutilizavel de forma composivel.

## Contexto
Usar quando logica de estado ou side effects precisa ser compartilhada entre componentes. Hooks substituem HOCs e render props como padrao de reutilizacao no React. O hook deve ser independente de UI (nao retorna JSX) e testavel isoladamente.

## Pre-requisitos
- [ ] Logica a ser encapsulada identificada (estado, fetching, subscricao, etc)
- [ ] Pelo menos 2 componentes que usarao o hook (justificar reutilizacao)
- [ ] Compreensao das regras de hooks do React (nao condicional, nao em loops)
- [ ] Dependencias externas identificadas (APIs, servicos, contextos)

## Passos

### 1. Definir Interface do Hook
Comece pelo contrato — o que o hook recebe e retorna:
```typescript
// src/hooks/use-debounced-search.ts

interface UseDebouncedSearchOptions {
  endpoint: string           // URL do endpoint de busca
  debounceMs?: number        // default: 300
  minLength?: number         // comprimento minimo para iniciar busca, default: 2
  initialQuery?: string      // query inicial
}

interface UseDebouncedSearchReturn<T> {
  // Estado
  query: string
  results: T[]
  isSearching: boolean
  error: string | null

  // Acoes
  setQuery: (query: string) => void
  clear: () => void
  retry: () => void
}

export function useDebouncedSearch<T>(
  options: UseDebouncedSearchOptions
): UseDebouncedSearchReturn<T>
```
Use generics quando o tipo de retorno varia por uso.

### 2. Implementar Estado Interno
```typescript
export function useDebouncedSearch<T>({
  endpoint,
  debounceMs = 300,
  minLength = 2,
  initialQuery = '',
}: UseDebouncedSearchOptions): UseDebouncedSearchReturn<T> {
  const [query, setQuery] = useState(initialQuery)
  const [results, setResults] = useState<T[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Para cancelamento de requests obsoletos
  const abortControllerRef = useRef<AbortController | null>(null)
```
Prefira `useState` para estado simples. Use `useReducer` se ha muitas transicoes de estado inter-relacionadas.

### 3. Implementar Side Effects
```typescript
  // Debounce e fetch
  useEffect(() => {
    // Nao buscar se query e muito curta
    if (query.length < minLength) {
      setResults([])
      setIsSearching(false)
      return
    }

    setIsSearching(true)
    setError(null)

    const timeoutId = setTimeout(async () => {
      // Cancelar request anterior
      abortControllerRef.current?.abort()
      const controller = new AbortController()
      abortControllerRef.current = controller

      try {
        const response = await fetch(
          `${endpoint}?q=${encodeURIComponent(query)}`,
          { signal: controller.signal }
        )

        if (!response.ok) throw new Error(`Busca falhou: ${response.status}`)

        const data = await response.json()
        setResults(data.results)
      } catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError') return
        setError(err instanceof Error ? err.message : 'Erro na busca')
        setResults([])
      } finally {
        setIsSearching(false)
      }
    }, debounceMs)

    // Cleanup: cancelar timeout e request
    return () => {
      clearTimeout(timeoutId)
      abortControllerRef.current?.abort()
    }
  }, [query, endpoint, debounceMs, minLength])
```

### 4. Implementar Cleanup
Cleanup e OBRIGATORIO para evitar memory leaks e requests orfaos:
```typescript
  // Cleanup geral ao desmontar
  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort()
    }
  }, [])
```

Situacoes que exigem cleanup:
- `setTimeout` / `setInterval` → `clearTimeout` / `clearInterval`
- `AbortController` → `.abort()`
- Event listeners → `removeEventListener`
- WebSocket → `.close()`
- Subscricoes (Supabase realtime, etc) → `.unsubscribe()`

### 5. Memoizar Callbacks e Valores
Use `useCallback` para funcoes retornadas (evitar re-renders desnecessarios):
```typescript
  const clear = useCallback(() => {
    setQuery('')
    setResults([])
    setError(null)
  }, [])

  const retry = useCallback(() => {
    // Forcar re-execucao do effect
    setQuery(prev => prev + '')  // trigger sem mudar valor visivel
  }, [])

  return {
    query,
    results,
    isSearching,
    error,
    setQuery,
    clear,
    retry,
  }
}
```
Use `useMemo` para valores computados caros.

### 6. Tratar Edge Cases
- **Componente desmonta durante fetch:** AbortController cancela o request
- **Multiplos fetches rapidos:** Debounce + abort do anterior
- **Erro de rede:** Estado de erro com opcao de retry
- **Query vazia:** Limpar resultados, nao fazer fetch
- **Rerender do pai:** `useCallback` evita re-execucao desnecessaria
- **StrictMode (dev):** Efeitos rodam 2x — cleanup deve ser idempotente

### 7. Escrever Testes
```typescript
// src/hooks/__tests__/use-debounced-search.test.ts
import { renderHook, act, waitFor } from '@testing-library/react'
import { useDebouncedSearch } from '../use-debounced-search'

// Mock do fetch
const mockFetch = vi.fn()
global.fetch = mockFetch

beforeEach(() => {
  vi.useFakeTimers()
  mockFetch.mockReset()
})

afterEach(() => {
  vi.useRealTimers()
})

describe('useDebouncedSearch', () => {
  it('inicia com estado vazio', () => {
    const { result } = renderHook(() =>
      useDebouncedSearch({ endpoint: '/api/search' })
    )

    expect(result.current.query).toBe('')
    expect(result.current.results).toEqual([])
    expect(result.current.isSearching).toBe(false)
    expect(result.current.error).toBeNull()
  })

  it('faz busca apos debounce', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ results: [{ id: 1, name: 'Item' }] }),
    })

    const { result } = renderHook(() =>
      useDebouncedSearch({ endpoint: '/api/search', debounceMs: 100 })
    )

    act(() => result.current.setQuery('teste'))

    // Antes do debounce
    expect(mockFetch).not.toHaveBeenCalled()

    // Apos debounce
    act(() => vi.advanceTimersByTime(100))

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/search?q=teste',
        expect.objectContaining({ signal: expect.any(AbortSignal) })
      )
      expect(result.current.results).toHaveLength(1)
    })
  })

  it('nao busca se query e menor que minLength', () => {
    const { result } = renderHook(() =>
      useDebouncedSearch({ endpoint: '/api/search', minLength: 3 })
    )

    act(() => result.current.setQuery('ab'))
    act(() => vi.advanceTimersByTime(300))

    expect(mockFetch).not.toHaveBeenCalled()
  })

  it('cancela request anterior ao mudar query', async () => { ... })
  it('trata erro de rede', async () => { ... })
  it('limpa estado ao chamar clear()', () => { ... })
  it('faz cleanup ao desmontar', () => { ... })
})
```

### 8. Verificar Tipagem e Lint
```bash
npx tsc --noEmit    # Zero erros de tipo
npm run lint         # Zero warnings
npx vitest run src/hooks/__tests__/use-debounced-search.test.ts
```

## Criterios de Aceite
- [ ] Interface do hook tipada com TypeScript (generics se aplicavel)
- [ ] Estado gerenciado corretamente (loading, error, data)
- [ ] Side effects com cleanup adequado (sem memory leaks)
- [ ] AbortController para cancelamento de requests
- [ ] Callbacks memoizados com useCallback
- [ ] Edge cases tratados (dismount, rapid updates, errors)
- [ ] Testes cobrem estado inicial, happy path, erros e cleanup
- [ ] Nenhum `any` no codigo
- [ ] Tipagem passa sem erros
- [ ] Lint passa sem warnings

## Entregaveis
- Arquivo do hook (`src/hooks/use-[nome].ts`)
- Arquivo de testes (`src/hooks/__tests__/use-[nome].test.ts`)
- Tipos exportados (se usados por consumidores)

## Verificacao
- [ ] Hook funciona em pelo menos 2 componentes diferentes
- [ ] Nao causa re-renders desnecessarios (verificar com React DevTools)
- [ ] Cleanup funciona (nenhum warning de "update on unmounted component")
- [ ] Testes automatizados passam
