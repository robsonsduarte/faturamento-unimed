# Task: DB — Popular Banco com Dados

## Objetivo
Criar scripts de seed reprodutiveis para popular o banco com dados realistas de desenvolvimento, fixtures para testes e dados iniciais obrigatorios, com opcao de cleanup.

## Contexto
Usar quando o banco precisa de dados para desenvolvimento local, demonstracoes, testes de carga, ou dados iniciais obrigatorios (enums, configuracoes, planos). Seeds devem ser idempotemtes (rodar 2x nao duplica dados) e realistas (volumes e distribuicoes semelhantes a producao).

## Pre-requisitos
- [ ] Schema do banco definido e migracoes aplicadas
- [ ] Entidades e relacoes compreendidas
- [ ] Volume desejado de dados definido
- [ ] Regras de negocio que afetam dados conhecidas (ex: todo usuario tem perfil)

## Passos

### 1. Categorizar Tipos de Seed
Separe seeds por proposito:
```
1. Dados Obrigatorios (required seed):
   - Planos de assinatura
   - Nichos de saude
   - Tags padrao
   - Configuracoes do sistema
   → Rodados em producao tambem

2. Dados de Desenvolvimento (dev seed):
   - Usuarios de teste com diferentes roles
   - Conteudos de exemplo em diferentes status
   - Historico de uso simulado
   → Apenas em dev/staging

3. Dados de Carga (load seed):
   - Milhares de registros para teste de performance
   - Distribuicao realista por nicho, status, data
   → Apenas para testes de performance

4. Fixtures de Teste (test fixtures):
   - Dados minimos para cada cenario de teste
   - Deterministicos (mesmos IDs, mesmos valores)
   → Usados em testes automatizados
```

### 2. Criar Seed de Dados Obrigatorios
```sql
-- supabase/seed.sql (ou scripts/seed-required.sql)

-- =============================================
-- SEED: Dados obrigatorios (rodar em todos os ambientes)
-- =============================================

-- Planos de assinatura
INSERT INTO subscription_plans (id, name, slug, price_cents, credits_monthly, features)
VALUES
  ('plan-free', 'Gratuito', 'free', 0, 10, '{"video": false, "carousel": true}'),
  ('plan-pro', 'Profissional', 'pro', 9900, 100, '{"video": true, "carousel": true}'),
  ('plan-enterprise', 'Enterprise', 'enterprise', 29900, 500, '{"video": true, "carousel": true, "api": true}')
ON CONFLICT (id) DO UPDATE SET
  price_cents = EXCLUDED.price_cents,
  credits_monthly = EXCLUDED.credits_monthly,
  features = EXCLUDED.features;

-- Tags padrao
INSERT INTO tags (name, slug, color) VALUES
  ('Educativo', 'educativo', '#3B82F6'),
  ('Motivacional', 'motivacional', '#10B981'),
  ('Informativo', 'informativo', '#8B5CF6'),
  ('Dica Rapida', 'dica-rapida', '#F59E0B')
ON CONFLICT (slug) DO NOTHING;
```

### 3. Criar Seed de Desenvolvimento
```sql
-- scripts/seed-dev.sql

-- =============================================
-- SEED: Dados de desenvolvimento
-- Prerequisito: seed-required.sql ja executado
-- =============================================

-- Usuarios de teste
-- NOTA: Criar via Supabase Auth API, nao diretamente na tabela
-- Use o script TS abaixo para criar via API

-- Conteudos de exemplo
DO $$
DECLARE
  user_id UUID := 'dev-user-uuid';  -- UUID do usuario de teste
  niches TEXT[] := ARRAY['neuro', 'mental', 'nutri', 'reab', 'dermato', 'odonto'];
  statuses TEXT[] := ARRAY['draft', 'published', 'archived'];
  i INT;
BEGIN
  FOR i IN 1..50 LOOP
    INSERT INTO contents (
      user_id,
      title,
      body,
      niche,
      status,
      created_at
    ) VALUES (
      user_id,
      'Conteudo de teste #' || i,
      'Este e um conteudo de exemplo para desenvolvimento. ' ||
      'Gerado automaticamente pelo seed script. ' ||
      'Nicho: ' || niches[1 + (i % array_length(niches, 1))],
      niches[1 + (i % array_length(niches, 1))],
      statuses[1 + (i % array_length(statuses, 1))],
      NOW() - (i || ' days')::INTERVAL  -- distribuir no tempo
    )
    ON CONFLICT DO NOTHING;
  END LOOP;
END $$;
```

### 4. Criar Script TypeScript para Seeds Complexos
Quando SQL puro nao e suficiente (ex: criar usuarios via Auth API):
```typescript
// scripts/seed-dev.ts
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const TEST_USERS = [
  { email: 'admin@test.com', password: 'Test123!', role: 'admin', name: 'Admin Teste' },
  { email: 'user@test.com', password: 'Test123!', role: 'user', name: 'Usuario Teste' },
  { email: 'pro@test.com', password: 'Test123!', role: 'user', name: 'Usuario Pro' },
]

async function seedUsers() {
  for (const user of TEST_USERS) {
    // Criar usuario via Auth
    const { data, error } = await supabase.auth.admin.createUser({
      email: user.email,
      password: user.password,
      email_confirm: true,
    })

    if (error && !error.message.includes('already registered')) {
      console.error(`Erro ao criar ${user.email}:`, error.message)
      continue
    }

    const userId = data?.user?.id
    if (!userId) continue

    // Atualizar perfil
    await supabase.from('profiles').upsert({
      id: userId,
      name: user.name,
      role: user.role,
      niche: 'mental',
    })

    console.log(`Usuario criado: ${user.email} (${user.role})`)
  }
}

async function main() {
  console.log('Iniciando seed de desenvolvimento...')
  await seedUsers()
  console.log('Seed concluido!')
}

main().catch(console.error)
```

### 5. Criar Fixtures para Testes
```typescript
// src/lib/__tests__/fixtures/database.ts

export const TEST_USER_ID = '00000000-0000-0000-0000-000000000001'
export const TEST_ADMIN_ID = '00000000-0000-0000-0000-000000000002'

export async function seedTestFixtures(supabase: SupabaseClient) {
  // Perfis
  await supabase.from('profiles').upsert([
    { id: TEST_USER_ID, name: 'Test User', role: 'user', niche: 'mental' },
    { id: TEST_ADMIN_ID, name: 'Test Admin', role: 'admin', niche: 'neuro' },
  ])

  // Conteudos do usuario
  await supabase.from('contents').upsert([
    { id: 'content-001', user_id: TEST_USER_ID, title: 'Draft', status: 'draft' },
    { id: 'content-002', user_id: TEST_USER_ID, title: 'Published', status: 'published' },
  ])
}

export async function cleanupTestFixtures(supabase: SupabaseClient) {
  // Limpar na ordem correta (FKs)
  await supabase.from('content_tags').delete().in('content_id', ['content-001', 'content-002'])
  await supabase.from('contents').delete().in('id', ['content-001', 'content-002'])
  await supabase.from('profiles').delete().in('id', [TEST_USER_ID, TEST_ADMIN_ID])
}
```

### 6. Garantir Idempotencia
Seeds devem ser seguros para rodar multiplas vezes:
```sql
-- CERTO: upsert com ON CONFLICT
INSERT INTO tags (name, slug) VALUES ('Educativo', 'educativo')
ON CONFLICT (slug) DO NOTHING;

-- CERTO: verificar antes de inserir
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM subscription_plans WHERE slug = 'free') THEN
    INSERT INTO subscription_plans (name, slug, price_cents) VALUES ('Gratuito', 'free', 0);
  END IF;
END $$;

-- ERRADO: insert puro (duplica dados)
INSERT INTO tags (name, slug) VALUES ('Educativo', 'educativo');
```

### 7. Criar Script de Cleanup
```sql
-- scripts/cleanup-dev.sql

-- =============================================
-- CLEANUP: Remover dados de desenvolvimento
-- CUIDADO: Nao executar em producao!
-- =============================================

-- Verificar ambiente
DO $$
BEGIN
  IF current_setting('app.environment', true) = 'production' THEN
    RAISE EXCEPTION 'PROIBIDO: Nao execute cleanup em producao!';
  END IF;
END $$;

-- Limpar na ordem correta (respeitar FKs)
DELETE FROM content_tags WHERE content_id IN (
  SELECT id FROM contents WHERE user_id IN (
    SELECT id FROM profiles WHERE email LIKE '%@test.com'
  )
);
DELETE FROM contents WHERE user_id IN (
  SELECT id FROM profiles WHERE email LIKE '%@test.com'
);
-- Profiles e auth.users: deletar via Supabase Admin API
```

### 8. Documentar Uso
```markdown
## Seeds Disponiveis

### Seed obrigatorio (todos os ambientes)
psql $DATABASE_URL -f supabase/seed.sql

### Seed de desenvolvimento
npx tsx scripts/seed-dev.ts

### Cleanup de desenvolvimento
psql $DATABASE_URL -f scripts/cleanup-dev.sql

### Seed de carga (performance testing)
npx tsx scripts/seed-load.ts --count=10000

### Credenciais de teste
| Email | Senha | Role |
|-------|-------|------|
| admin@test.com | Test123! | admin |
| user@test.com | Test123! | user |
```

## Criterios de Aceite
- [ ] Seeds categorizados por proposito (obrigatorio, dev, carga, fixtures)
- [ ] Seeds sao idempotemtes (rodar 2x nao duplica)
- [ ] Dados sao realistas (nomes, volumes, distribuicoes)
- [ ] Script de cleanup funciona sem afetar dados de producao
- [ ] Fixtures de teste sao determinísticas (mesmos IDs sempre)
- [ ] Seeds respeitam constraints e RLS
- [ ] Documentacao de como rodar cada seed
- [ ] Seeds de producao nao contem dados de teste

## Entregaveis
- Script SQL de seed obrigatorio (`supabase/seed.sql`)
- Script TS de seed de desenvolvimento (`scripts/seed-dev.ts`)
- Fixtures de teste (`src/lib/__tests__/fixtures/database.ts`)
- Script de cleanup (`scripts/cleanup-dev.sql`)
- Documentacao de uso

## Verificacao
- [ ] `supabase db reset` executa seeds sem erros
- [ ] Seeds podem ser executados multiplas vezes sem duplicacao
- [ ] Aplicacao funciona normalmente com dados de seed
- [ ] Testes usam fixtures sem depender de seed externo
