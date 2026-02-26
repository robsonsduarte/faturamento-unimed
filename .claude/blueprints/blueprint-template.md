# Blueprint: {{PROJECT_NAME}}

**Gerado por:** DuarteOS Input Analyzer
**Data:** {{DATE}}
**Input:** {{INPUT_TYPE}} — {{INPUT_SOURCE}}

## Stack

| Camada | Tecnologia |
|--------|-----------|
| Framework | Next.js 15 (App Router) |
| Linguagem | TypeScript (strict) |
| Styling | Tailwind CSS v4 + shadcn/ui |
| Auth | Supabase Auth |
| Database | Supabase (PostgreSQL) |
| Forms | react-hook-form + zod |
| Toasts | sonner |
| Animations | framer-motion |

## Data Models

### [Entidade 1]
| Campo | Tipo | Descricao |
|-------|------|-----------|
| id | uuid | Primary key |
| created_at | timestamptz | Data de criacao |
| updated_at | timestamptz | Data de atualizacao |
| user_id | uuid (FK) | Dono do registro |
| ... | ... | ... |

## Roles & Permissions

| Role | Acesso |
|------|--------|
| admin | Tudo |
| user | CRUD proprio + leitura publica |

## Pages

| Rota | Descricao | Auth |
|------|-----------|------|
| / | Landing page | Nao |
| /auth/login | Login | Nao |
| /auth/register | Cadastro | Nao |
| /dashboard | Dashboard principal | Sim |
| /dashboard/[entidade] | Lista de [entidade] | Sim |
| /dashboard/[entidade]/new | Criar [entidade] | Sim |
| /dashboard/[entidade]/[id] | Detalhe de [entidade] | Sim |
| /dashboard/settings | Configuracoes do usuario | Sim |

## API Routes

| Metodo | Rota | Descricao |
|--------|------|-----------|
| GET | /api/[entidade] | Listar (com paginacao) |
| POST | /api/[entidade] | Criar |
| GET | /api/[entidade]/[id] | Detalhar |
| PUT | /api/[entidade]/[id] | Atualizar |
| DELETE | /api/[entidade]/[id] | Deletar |

## Design

### Paleta de Cores
| Uso | Cor | Hex |
|-----|-----|-----|
| Background | Slate 950 | #020617 |
| Surface | Slate 900 | #0f172a |
| Primary | Emerald 500 | #10b981 |
| Text | Slate 100 | #f1f5f9 |
| Muted | Slate 400 | #94a3b8 |
| Danger | Red 500 | #ef4444 |
| Warning | Amber 500 | #f59e0b |
| Success | Green 500 | #22c55e |

### Tipografia
- **Font:** Inter
- **Headings:** font-bold
- **Body:** font-normal
- **Small:** text-sm text-slate-400

### Layout
- **Desktop:** Sidebar (240px) + Main content
- **Mobile:** Bottom nav + Full-width content
- **Max-width:** 1280px
- **Spacing:** p-6 gap-6 (consistente)

## Features (MVP)

1. [ ] Auth (login, registro, forgot-password)
2. [ ] Dashboard com metricas basicas
3. [ ] CRUD completo de [entidade principal]
4. [ ] Perfil do usuario + settings
5. [ ] Responsivo mobile

## Features (Nice-to-have)

1. [ ] Dark/light mode toggle
2. [ ] Exportar dados (CSV)
3. [ ] Notificacoes por email
4. [ ] Multi-tenancy

## Database Schema (SQL)

```sql
-- Profiles (extends Supabase auth.users)
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  avatar_url TEXT,
  role TEXT DEFAULT 'user' CHECK (role IN ('user', 'admin')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view own profile"
  ON profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  USING (auth.uid() = id);

-- [Adicionar tabelas do dominio aqui]
```

## Success Criteria

- [ ] `npm run dev` funciona sem erros
- [ ] Login/registro funcional
- [ ] CRUD da entidade principal funcional
- [ ] Design coerente e responsivo
- [ ] TypeScript sem erros (`tsc --noEmit`)
- [ ] Zero `any` no codigo
