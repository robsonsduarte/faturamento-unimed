# Task: DB — Configurar Row Level Security

## Objetivo
Configurar politicas de Row Level Security (RLS) no Supabase/PostgreSQL para garantir que cada usuario acesse apenas seus proprios dados, com testes de acesso por role e documentacao das policies.

## Contexto
Usar quando novas tabelas sao criadas ou quando o modelo de permissao precisa ser revisado. RLS e a camada de seguranca mais critica no Supabase — sem ela, qualquer usuario autenticado pode ler/modificar TODOS os dados via client-side queries. RLS DEVE estar habilitado em TODAS as tabelas que contem dados de usuario.

## Pre-requisitos
- [ ] Tabela alvo ja existe no banco
- [ ] Modelo de permissao definido (quem pode ler/escrever/deletar o que)
- [ ] Roles do sistema identificadas (anon, authenticated, service_role, admin)
- [ ] Supabase CLI configurado para testes locais

## Passos

### 1. Mapear Modelo de Permissao
Antes de escrever policies, documente a matriz de acesso:
```
Tabela: contents

| Operacao | anon | authenticated (dono) | authenticated (outro) | service_role | admin |
|----------|------|---------------------|----------------------|-------------|-------|
| SELECT   | Nao  | Sim (proprios)      | Nao                  | Sim (todos) | Sim   |
| INSERT   | Nao  | Sim (proprios)      | Nao                  | Sim         | Sim   |
| UPDATE   | Nao  | Sim (proprios)      | Nao                  | Sim         | Sim   |
| DELETE   | Nao  | Sim (proprios)      | Nao                  | Sim         | Sim   |

Regras especiais:
- Conteudos com status 'published' sao visiveis a todos os authenticated
- Admin pode ver e editar conteudos de qualquer usuario
- Service role bypassa RLS (para operacoes de sistema)
```

### 2. Habilitar RLS
```sql
-- SEMPRE habilitar RLS em tabelas com dados de usuario
ALTER TABLE contents ENABLE ROW LEVEL SECURITY;

-- Verificar que RLS esta habilitado
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
AND tablename = 'contents';
-- rowsecurity deve ser TRUE
```

### 3. Criar Policies de SELECT
```sql
-- Usuarios veem seus proprios conteudos
CREATE POLICY "users_select_own_contents"
  ON contents FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Conteudos publicados sao visiveis a todos (se aplicavel)
CREATE POLICY "published_contents_visible"
  ON contents FOR SELECT
  TO authenticated
  USING (status = 'published');

-- Admin ve todos os conteudos
CREATE POLICY "admin_select_all_contents"
  ON contents FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );
```

### 4. Criar Policies de INSERT
```sql
-- Usuarios podem criar conteudos para si mesmos
CREATE POLICY "users_insert_own_contents"
  ON contents FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Previne que usuario crie conteudo em nome de outro
-- O WITH CHECK garante que user_id = uid do token JWT
```

### 5. Criar Policies de UPDATE
```sql
-- Usuarios podem atualizar seus proprios conteudos
CREATE POLICY "users_update_own_contents"
  ON contents FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)       -- pode ver o registro?
  WITH CHECK (auth.uid() = user_id);  -- pode salvar a mudanca?

-- Admin pode atualizar qualquer conteudo
CREATE POLICY "admin_update_all_contents"
  ON contents FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  )
  WITH CHECK (true);
```

### 6. Criar Policies de DELETE
```sql
-- Usuarios podem deletar seus proprios conteudos
CREATE POLICY "users_delete_own_contents"
  ON contents FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Prevencao: NÃO criar policy de DELETE para anon
-- Service role ja bypassa RLS por padrao
```

### 7. Testar Policies
Teste CADA policy com CADA role:
```sql
-- =============================================
-- TESTES DE RLS
-- =============================================

-- Setup de teste
-- Criar 2 usuarios de teste com IDs conhecidos
-- user_a: 'aaaa-aaaa-aaaa-aaaa'
-- user_b: 'bbbb-bbbb-bbbb-bbbb'

-- Teste 1: Usuario A ve apenas seus conteudos
SET ROLE authenticated;
SET request.jwt.claims = '{"sub": "aaaa-aaaa-aaaa-aaaa", "role": "authenticated"}';

SELECT count(*) FROM contents;
-- Deve retornar APENAS conteudos do user_a

-- Teste 2: Usuario A NAO ve conteudos do user_b (exceto published)
SELECT count(*) FROM contents WHERE user_id = 'bbbb-bbbb-bbbb-bbbb';
-- Deve retornar apenas os publicados

-- Teste 3: Usuario A NAO pode inserir conteudo como user_b
INSERT INTO contents (user_id, title, status)
VALUES ('bbbb-bbbb-bbbb-bbbb', 'Hack', 'draft');
-- Deve FALHAR com "new row violates row-level security policy"

-- Teste 4: Usuario A NAO pode atualizar conteudo do user_b
UPDATE contents SET title = 'Hacked' WHERE user_id = 'bbbb-bbbb-bbbb-bbbb';
-- Deve atualizar 0 rows (filtrado pelo USING)

-- Teste 5: Admin ve todos os conteudos
SET request.jwt.claims = '{"sub": "admin-uuid", "role": "authenticated"}';
-- (admin-uuid deve ter role='admin' na tabela profiles)
SELECT count(*) FROM contents;
-- Deve retornar TODOS os conteudos

-- Teste 6: Anon nao ve nada
SET ROLE anon;
SELECT count(*) FROM contents;
-- Deve retornar 0

-- Cleanup
RESET ROLE;
```

### 8. Documentar Policies
```markdown
## Policies RLS — Tabela: contents

| Policy | Operacao | Role | Condicao |
|--------|----------|------|----------|
| users_select_own_contents | SELECT | authenticated | user_id = auth.uid() |
| published_contents_visible | SELECT | authenticated | status = 'published' |
| admin_select_all_contents | SELECT | authenticated | profile.role = 'admin' |
| users_insert_own_contents | INSERT | authenticated | user_id = auth.uid() |
| users_update_own_contents | UPDATE | authenticated | user_id = auth.uid() |
| admin_update_all_contents | UPDATE | authenticated | profile.role = 'admin' |
| users_delete_own_contents | DELETE | authenticated | user_id = auth.uid() |

### Observacoes
- service_role bypassa todas as policies (usado por Edge Functions)
- anon nao tem nenhuma policy (acesso bloqueado)
- Policies de SELECT sao OR (qualquer uma que permita, permite)
- Policies de INSERT/UPDATE/DELETE sao AND com WITH CHECK
```

## Criterios de Aceite
- [ ] RLS habilitado na tabela (`ALTER TABLE ... ENABLE ROW LEVEL SECURITY`)
- [ ] Policies criadas para SELECT, INSERT, UPDATE e DELETE
- [ ] Cada role tem acesso adequado (nao mais, nao menos)
- [ ] Anon nao tem acesso a dados de usuario
- [ ] Usuario nao pode acessar/modificar dados de outro usuario
- [ ] Admin tem acesso adequado (se aplicavel)
- [ ] Service role funciona normalmente (bypass RLS)
- [ ] Testes executados e documentados para cada cenario
- [ ] Nenhuma policy permite acesso indevido
- [ ] Policies documentadas com tabela de acesso

## Entregaveis
- Script SQL com policies (`supabase/migrations/[timestamp]_rls_[tabela].sql`)
- Script de testes de RLS
- Documentacao da matriz de acesso
- Script de rollback (DROP POLICY)

## Verificacao
- [ ] `supabase db lint` nao reporta tabelas sem RLS
- [ ] Testes de penetracao (usuario tentando acessar dados de outro) falham
- [ ] Aplicacao funciona normalmente com RLS ativo
- [ ] Edge Functions com service_role continuam funcionando
- [ ] Dashboard de usuario mostra apenas seus dados
