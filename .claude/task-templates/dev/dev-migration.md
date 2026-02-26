# Task: Dev — Executar Migracao de Dados/Schema

## Objetivo
Executar uma migracao de dados ou schema de banco com script versionado, validacao de integridade, procedimento de rollback testado e zero perda de dados.

## Contexto
Usar quando o banco de dados precisa ser alterado: novas tabelas, colunas, indices, constraints, ou transformacao de dados existentes. Diferente de `spec-migration-plan` (que planeja migracoes de sistema inteiro), esta task e para migracoes de banco especificas e atomicas. Cada migracao deve ser reversivel e independente.

## Pre-requisitos
- [ ] Schema atual compreendido (tabelas, relacoes, RLS policies)
- [ ] Mudanca necessaria bem definida
- [ ] Acesso ao banco de desenvolvimento e staging
- [ ] Backup recente do banco disponivel
- [ ] Nenhuma outra migracao pendente (evitar conflitos)

## Passos

### 1. Criar Arquivo de Migracao
Siga o padrao de nomenclatura com timestamp:
```sql
-- supabase/migrations/20240115120000_add_notifications_table.sql

-- Descricao: Criar tabela de notificacoes para o sistema de alertas
-- Autor: [nome]
-- Ticket: [referencia]
-- Reversivel: Sim
```

### 2. Escrever DDL (Schema Up)
```sql
-- ============================================
-- UP: Aplicar migracao
-- ============================================

-- Criar tabela
CREATE TABLE IF NOT EXISTS notifications (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  type VARCHAR(50) NOT NULL CHECK (type IN ('info', 'warning', 'error', 'success')),
  title VARCHAR(200) NOT NULL,
  message TEXT,
  read BOOLEAN DEFAULT FALSE,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indices (criados separadamente para clareza)
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread ON notifications(user_id, read)
  WHERE read = FALSE;
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at DESC);

-- Trigger para updated_at
CREATE OR REPLACE FUNCTION update_notifications_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_notifications_updated_at
  BEFORE UPDATE ON notifications
  FOR EACH ROW
  EXECUTE FUNCTION update_notifications_updated_at();

-- Comentarios na tabela (documentacao viva)
COMMENT ON TABLE notifications IS 'Notificacoes do sistema para usuarios';
COMMENT ON COLUMN notifications.type IS 'Tipo visual: info, warning, error, success';
COMMENT ON COLUMN notifications.metadata IS 'Dados extras em JSON (link, action, etc)';
```

### 3. Configurar RLS (Row Level Security)
```sql
-- Habilitar RLS
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Usuarios veem apenas suas proprias notificacoes
CREATE POLICY "users_view_own_notifications"
  ON notifications FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Usuarios podem marcar suas notificacoes como lidas
CREATE POLICY "users_update_own_notifications"
  ON notifications FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Apenas service role pode inserir/deletar (sistema cria notificacoes)
CREATE POLICY "service_manage_notifications"
  ON notifications FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
```

### 4. Escrever DDL (Schema Down / Rollback)
```sql
-- ============================================
-- DOWN: Reverter migracao
-- ============================================

-- Remover policies
DROP POLICY IF EXISTS "users_view_own_notifications" ON notifications;
DROP POLICY IF EXISTS "users_update_own_notifications" ON notifications;
DROP POLICY IF EXISTS "service_manage_notifications" ON notifications;

-- Remover trigger e funcao
DROP TRIGGER IF EXISTS trigger_notifications_updated_at ON notifications;
DROP FUNCTION IF EXISTS update_notifications_updated_at();

-- Remover tabela (CASCADE remove indices automaticamente)
DROP TABLE IF EXISTS notifications CASCADE;
```

### 5. Migracao de Dados (se aplicavel)
Quando dados existentes precisam ser transformados:
```sql
-- Migrar dados de formato antigo para novo
-- IMPORTANTE: Fazer em batches para tabelas grandes

DO $$
DECLARE
  batch_size INT := 1000;
  total_updated INT := 0;
  rows_affected INT;
BEGIN
  LOOP
    UPDATE old_table
    SET new_column = transform_function(old_column)
    WHERE new_column IS NULL
    LIMIT batch_size;

    GET DIAGNOSTICS rows_affected = ROW_COUNT;
    total_updated := total_updated + rows_affected;

    RAISE NOTICE 'Migrados: % registros (total: %)', rows_affected, total_updated;

    EXIT WHEN rows_affected = 0;

    -- Pausa para nao sobrecarregar o banco
    PERFORM pg_sleep(0.1);
  END LOOP;
END $$;
```

### 6. Testar em Desenvolvimento
```bash
# Resetar banco local e aplicar todas as migracoes
npx supabase db reset

# Ou aplicar apenas a nova migracao
npx supabase migration up

# Verificar que a tabela foi criada corretamente
npx supabase db lint
```

### 7. Validar Integridade
Apos aplicar a migracao, execute validacoes:
```sql
-- Verificar que a tabela existe com colunas corretas
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'notifications'
ORDER BY ordinal_position;

-- Verificar RLS esta habilitado
SELECT tablename, rowsecurity
FROM pg_tables
WHERE tablename = 'notifications';

-- Verificar policies existem
SELECT policyname, cmd, roles
FROM pg_policies
WHERE tablename = 'notifications';

-- Verificar indices existem
SELECT indexname, indexdef
FROM pg_indexes
WHERE tablename = 'notifications';

-- Se houve migracao de dados, verificar contagem
SELECT COUNT(*) FROM notifications WHERE [condicao_esperada];
```

### 8. Testar Rollback
```bash
# Aplicar rollback
psql -f rollback.sql

# Verificar que a tabela foi removida
# Re-aplicar migracao para confirmar que funciona apos rollback
```

## Criterios de Aceite
- [ ] Arquivo de migracao com nomenclatura padrao (timestamp)
- [ ] DDL Up cria todos os objetos necessarios (tabela, indices, triggers)
- [ ] DDL Down reverte completamente a migracao
- [ ] RLS configurado com policies adequadas
- [ ] Migracao de dados em batches (se aplicavel)
- [ ] Testado em ambiente de desenvolvimento
- [ ] Rollback testado e funcional
- [ ] Validacao de integridade executada
- [ ] Sem breaking changes em queries existentes
- [ ] Comentarios documentam a tabela e colunas importantes

## Entregaveis
- Arquivo de migracao SQL (up)
- Arquivo de rollback SQL (down)
- Script de validacao de integridade
- Script de migracao de dados (se aplicavel)

## Verificacao
- [ ] `supabase db reset` passa sem erros
- [ ] Aplicacao funciona normalmente com o novo schema
- [ ] RLS bloqueia acesso indevido (testar com usuario diferente)
- [ ] Rollback restaura o estado anterior completamente
- [ ] Performance das queries nao degradou
