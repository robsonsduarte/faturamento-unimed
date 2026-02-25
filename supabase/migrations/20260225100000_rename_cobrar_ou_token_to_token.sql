-- Renomear o valor 'COBRAR_OU_TOKEN' do enum guide_status para 'TOKEN'
-- PostgreSQL nao suporta ALTER TYPE ... RENAME VALUE diretamente,
-- entao renomeamos via recriacao segura do enum.

-- 1. Remover o default temporariamente
ALTER TABLE guias ALTER COLUMN status DROP DEFAULT;

-- 2. Criar o novo enum
CREATE TYPE guide_status_new AS ENUM ('PENDENTE', 'CPRO', 'TOKEN', 'COMPLETA', 'PROCESSADA', 'FATURADA');

-- 3. Converter a coluna (COBRAR_OU_TOKEN vira TOKEN automaticamente)
ALTER TABLE guias ALTER COLUMN status TYPE guide_status_new
  USING CASE WHEN status::text = 'COBRAR_OU_TOKEN' THEN 'TOKEN'::guide_status_new ELSE status::text::guide_status_new END;

-- 4. Remover o enum antigo e renomear o novo
DROP TYPE guide_status;
ALTER TYPE guide_status_new RENAME TO guide_status;

-- 5. Restaurar o default
ALTER TABLE guias ALTER COLUMN status SET DEFAULT 'PENDENTE'::guide_status;
