# Task: DB — Criar Migracao de Banco

## Objetivo
Criar uma migracao de banco de dados segura e reversivel, com DDL validado, scripts up/down, politicas RLS configuradas e validacao de integridade pos-aplicacao.

## Contexto
Usar quando o schema do banco precisa ser alterado: criar tabelas, adicionar colunas, modificar constraints, criar indices ou alterar tipos. Cada migracao deve ser atomica (uma mudanca logica), reversivel (down script funcional) e segura (nao perde dados, nao quebra queries existentes).

## Pre-requisitos
- [ ] Mudanca de schema definida e justificada
- [ ] Schema atual compreendido (tabelas relacionadas, constraints, indices)
- [ ] Supabase CLI instalado e configurado
- [ ] Banco de desenvolvimento disponivel
- [ ] Nenhuma migracao pendente nao aplicada

## Passos

### 1. Planejar a Migracao
Antes de escrever SQL, documente:
```
Objetivo: Adicionar suporte a tags em conteudos
Tabelas afetadas: contents (existente), content_tags (nova), tags (nova)
Tipo: DDL (criacao de tabelas) + indice
Risco: Baixo (nao altera tabelas existentes)
Downtime: Nenhum (operacao nao bloqueante)
Dados existentes afetados: Nao
```

### 2. Criar Arquivo de Migracao
```bash
# Gerar arquivo com timestamp
npx supabase migration new add_content_tags
# Cria: supabase/migrations/[timestamp]_add_content_tags.sql
```

### 3. Escrever Script UP
```sql
-- =================================================================
-- Migracao: Adicionar sistema de tags para conteudos
-- Autor: [nome]
-- Data: [data]
-- =================================================================

-- Tabela de tags (catalogo)
CREATE TABLE IF NOT EXISTS tags (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name VARCHAR(50) NOT NULL,
  slug VARCHAR(50) NOT NULL UNIQUE,
  color VARCHAR(7) DEFAULT '#6B7280',  -- hex color
  created_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE tags IS 'Catalogo de tags para classificacao de conteudos';

-- Tabela associativa (many-to-many)
CREATE TABLE IF NOT EXISTS content_tags (
  content_id UUID NOT NULL REFERENCES contents(id) ON DELETE CASCADE,
  tag_id UUID NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (content_id, tag_id)  -- previne duplicatas
);

COMMENT ON TABLE content_tags IS 'Associacao entre conteudos e tags';

-- Indices para queries comuns
CREATE INDEX IF NOT EXISTS idx_content_tags_content ON content_tags(content_id);
CREATE INDEX IF NOT EXISTS idx_content_tags_tag ON content_tags(tag_id);
CREATE INDEX IF NOT EXISTS idx_tags_slug ON tags(slug);

-- =========================================
-- RLS (Row Level Security)
-- =========================================

-- Tags: leitura publica, escrita apenas service role
ALTER TABLE tags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anyone_can_read_tags"
  ON tags FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "service_manages_tags"
  ON tags FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Content Tags: segue permissao do conteudo pai
ALTER TABLE content_tags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_manage_own_content_tags"
  ON content_tags FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM contents
      WHERE contents.id = content_tags.content_id
      AND contents.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM contents
      WHERE contents.id = content_tags.content_id
      AND contents.user_id = auth.uid()
    )
  );

CREATE POLICY "service_manages_content_tags"
  ON content_tags FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- =========================================
-- Seed de tags padrao
-- =========================================
INSERT INTO tags (name, slug, color) VALUES
  ('Educativo', 'educativo', '#3B82F6'),
  ('Motivacional', 'motivacional', '#10B981'),
  ('Informativo', 'informativo', '#8B5CF6'),
  ('Dica Rapida', 'dica-rapida', '#F59E0B'),
  ('Caso Clinico', 'caso-clinico', '#EF4444'),
  ('Mito vs Fato', 'mito-vs-fato', '#EC4899')
ON CONFLICT (slug) DO NOTHING;
```

### 4. Escrever Script DOWN
```sql
-- =================================================================
-- ROLLBACK: Remover sistema de tags
-- =================================================================

-- Remover policies
DROP POLICY IF EXISTS "users_manage_own_content_tags" ON content_tags;
DROP POLICY IF EXISTS "service_manages_content_tags" ON content_tags;
DROP POLICY IF EXISTS "anyone_can_read_tags" ON tags;
DROP POLICY IF EXISTS "service_manages_tags" ON tags;

-- Remover tabelas (ordem importa por causa das FKs)
DROP TABLE IF EXISTS content_tags CASCADE;
DROP TABLE IF EXISTS tags CASCADE;
```

### 5. Validar SQL Localmente
```bash
# Resetar banco local e aplicar todas as migracoes (incluindo a nova)
npx supabase db reset

# Verificar lint do banco
npx supabase db lint

# Verificar que a migracao pode ser aplicada limpa
npx supabase migration up
```

### 6. Testar Queries
Apos aplicar, valide que as queries esperadas funcionam:
```sql
-- Inserir tag em conteudo
INSERT INTO content_tags (content_id, tag_id)
SELECT 'content-uuid', id FROM tags WHERE slug = 'educativo';

-- Buscar conteudos por tag
SELECT c.* FROM contents c
JOIN content_tags ct ON ct.content_id = c.id
JOIN tags t ON t.id = ct.tag_id
WHERE t.slug = 'educativo'
AND c.user_id = 'user-uuid';

-- Buscar tags de um conteudo
SELECT t.* FROM tags t
JOIN content_tags ct ON ct.tag_id = t.id
WHERE ct.content_id = 'content-uuid';

-- Verificar que RLS funciona (como usuario autenticado, nao ve tags de outros)
SET ROLE authenticated;
SET request.jwt.claims = '{"sub": "user-uuid"}';
SELECT * FROM content_tags;  -- deve retornar apenas tags do usuario
```

### 7. Testar Rollback
```bash
# Aplicar rollback
psql $DATABASE_URL -f rollback.sql

# Verificar que tabelas foram removidas
psql $DATABASE_URL -c "\dt tags"
psql $DATABASE_URL -c "\dt content_tags"

# Re-aplicar migracao (deve funcionar limpo)
npx supabase migration up
```

### 8. Documentar
Adicione comentario no inicio do arquivo de migracao com:
- O que muda
- Por que muda
- Como reverter
- Queries de validacao

## Criterios de Aceite
- [ ] Arquivo de migracao com timestamp e nome descritivo
- [ ] DDL correto e testado (CREATE, ALTER, INDEX)
- [ ] RLS habilitado com policies adequadas
- [ ] Script DOWN reverte completamente a migracao
- [ ] `supabase db reset` passa sem erros
- [ ] `supabase db lint` sem warnings
- [ ] Queries comuns validadas apos aplicacao
- [ ] Rollback testado e funcional
- [ ] Sem breaking changes em queries ou servicos existentes
- [ ] Comentarios documentam tabelas e colunas importantes

## Entregaveis
- Arquivo de migracao (`supabase/migrations/[timestamp]_[nome].sql`)
- Script de rollback (pode ser inline no mesmo arquivo como comentario)
- Queries de validacao documentadas

## Verificacao
- [ ] Migracao aplica sem erros em banco limpo
- [ ] Migracao aplica sem erros em banco com dados existentes
- [ ] RLS testado com diferentes roles (anon, authenticated, service_role)
- [ ] Rollback restaura estado anterior sem resíduos
- [ ] Aplicacao funciona normalmente apos migracao
