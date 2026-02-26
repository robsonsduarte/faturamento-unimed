# Task: Dev — Criar Componente UI

## Objetivo
Criar um componente React reutilizavel com tipagem completa, estados visuais definidos, variantes, acessibilidade e testes, seguindo os padroes do design system do projeto.

## Contexto
Usar quando um novo componente de interface precisa ser criado. O componente deve seguir os padroes shadcn/ui e Radix UI do projeto. Componentes devem ser composiveis, acessiveis e testaveis. Priorize reutilizacao de componentes existentes em `src/components/ui/`.

## Pre-requisitos
- [ ] Design ou wireframe do componente definido
- [ ] Componentes UI existentes revisados (evitar duplicacao)
- [ ] Props e variantes planejadas
- [ ] Estados visuais identificados (default, hover, active, disabled, loading, error)

## Passos

### 1. Definir Interface do Componente
Comece pela API publica (props):
```typescript
interface ContentCardProps {
  // Dados
  title: string
  description?: string
  status: 'draft' | 'published' | 'archived'
  createdAt: Date

  // Variantes visuais
  variant?: 'default' | 'compact' | 'featured'
  size?: 'sm' | 'md' | 'lg'

  // Interacoes
  onEdit?: () => void
  onDelete?: () => void
  onClick?: () => void

  // Estado
  isLoading?: boolean
  disabled?: boolean

  // Composicao
  className?: string
  children?: React.ReactNode
}
```
Regras:
- Dados obrigatorios, variantes opcionais com defaults
- Callbacks seguem padrao `on[Evento]`
- Sempre aceitar `className` para customizacao

### 2. Implementar o Componente
```typescript
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'

const variantStyles = {
  default: 'border border-slate-700 bg-slate-800/50',
  compact: 'border border-slate-700/50 bg-slate-900',
  featured: 'border-2 border-emerald-500/30 bg-gradient-to-br from-slate-800 to-slate-900',
} as const

export function ContentCard({
  title,
  description,
  status,
  variant = 'default',
  size = 'md',
  isLoading = false,
  disabled = false,
  onEdit,
  onDelete,
  onClick,
  className,
  children,
}: ContentCardProps) {
  return (
    <div
      className={cn(
        'rounded-lg p-4 transition-colors',
        variantStyles[variant],
        onClick && !disabled && 'cursor-pointer hover:border-slate-600',
        disabled && 'opacity-50 cursor-not-allowed',
        className
      )}
      onClick={disabled ? undefined : onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick && !disabled ? 0 : undefined}
    >
      {/* ... conteudo */}
    </div>
  )
}
```

### 3. Implementar Estados Visuais
Garanta que cada estado tenha tratamento visual:
- **Default:** aparencia padrao
- **Hover:** feedback visual ao passar o mouse (use `hover:`)
- **Active/Pressed:** feedback ao clicar (use `active:`)
- **Focus:** anel de foco visivel (use `focus-visible:ring-2 focus-visible:ring-emerald-500`)
- **Disabled:** opacidade reduzida, cursor `not-allowed`, interacoes bloqueadas
- **Loading:** skeleton ou spinner, interacoes bloqueadas
- **Error:** borda/texto em vermelho, mensagem de erro visivel
- **Empty:** placeholder quando nao ha dados

### 4. Garantir Acessibilidade
- Elementos interativos tem `role` adequado (button, link, tab, etc.)
- Imagens tem `alt` descritivo
- Contraste minimo 4.5:1 para texto (WCAG AA)
- Navegacao por teclado funciona (Tab, Enter, Escape)
- `aria-label` para acoes sem texto visivel
- `aria-disabled` em vez de remover do DOM quando desabilitado
- Focus ring visivel em `focus-visible:` (nunca `focus:`)

### 5. Implementar Variantes com cn()
Use `cn()` do `@/lib/utils` para classes condicionais:
```typescript
// Nunca faca isso:
className={`text-sm ${variant === 'featured' ? 'text-emerald-400' : 'text-slate-300'}`}

// Faca assim:
className={cn(
  'text-sm',
  variant === 'featured' ? 'text-emerald-400' : 'text-slate-300'
)}
```
Para Button, NUNCA sobreponha cores via className — use o prop `variant`.

### 6. Compor com Componentes Existentes
Reutilize componentes de `src/components/ui/`:
```typescript
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
```
Nunca use `<button>`, `<input>`, `<select>`, `<label>` ou `<textarea>` nativos.

### 7. Escrever Testes
Teste com React Testing Library:
```typescript
import { render, screen, fireEvent } from '@testing-library/react'
import { ContentCard } from './content-card'

describe('ContentCard', () => {
  it('renderiza titulo e descricao', () => {
    render(<ContentCard title="Meu Post" description="Descricao" status="draft" createdAt={new Date()} />)
    expect(screen.getByText('Meu Post')).toBeInTheDocument()
    expect(screen.getByText('Descricao')).toBeInTheDocument()
  })

  it('chama onClick quando clicado', () => {
    const handleClick = vi.fn()
    render(<ContentCard title="Post" status="draft" createdAt={new Date()} onClick={handleClick} />)
    fireEvent.click(screen.getByRole('button'))
    expect(handleClick).toHaveBeenCalledOnce()
  })

  it('nao chama onClick quando desabilitado', () => {
    const handleClick = vi.fn()
    render(<ContentCard title="Post" status="draft" createdAt={new Date()} onClick={handleClick} disabled />)
    fireEvent.click(screen.getByText('Post'))
    expect(handleClick).not.toHaveBeenCalled()
  })

  it('exibe skeleton quando loading', () => { ... })
  it('aplica variante featured corretamente', () => { ... })
})
```

### 8. Verificar Tipagem e Lint
```bash
npx tsc --noEmit    # zero erros de tipo
npm run lint         # zero warnings (incluindo regras do design system)
```

## Criterios de Aceite
- [ ] Props tipadas com TypeScript (interface exportada)
- [ ] Todos os estados visuais implementados (default, hover, focus, disabled, loading, error)
- [ ] Variantes funcionam corretamente
- [ ] Acessivel por teclado (Tab, Enter, Escape)
- [ ] Focus ring usa `focus-visible:` (nao `focus:`)
- [ ] Usa componentes shadcn/ui (nao elementos nativos)
- [ ] Button nao tem override de cor via className
- [ ] `cn()` usado para classes condicionais
- [ ] Testes cobrem renderizacao, interacao e estados
- [ ] Tipagem passa sem erros
- [ ] Lint passa sem warnings

## Entregaveis
- Arquivo do componente (`.tsx`)
- Arquivo de testes (`__tests__/` ou `.test.tsx`)
- Tipos exportados (se reutilizados por outros componentes)

## Verificacao
- [ ] Componente renderiza corretamente em todas as variantes
- [ ] Navegacao por teclado funciona
- [ ] Testes automatizados passam
- [ ] Visual e consistente com o restante da interface
