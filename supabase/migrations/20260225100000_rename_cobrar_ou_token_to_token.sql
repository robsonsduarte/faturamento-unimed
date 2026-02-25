-- Renomear o valor 'COBRAR_OU_TOKEN' do enum guide_status para 'TOKEN'
-- PostgreSQL nao suporta ALTER TYPE ... RENAME VALUE diretamente,
-- entao renomeamos via recriacao segura do enum.

-- 1. Atualizar todas as guias que usam o valor antigo
UPDATE guias SET status = 'TOKEN' WHERE status = 'COBRAR_OU_TOKEN';

-- 2. Remover o default temporariamente
ALTER TABLE guias ALTER COLUMN status DROP DEFAULT;

-- 3. Criar o novo enum
CREATE TYPE guide_status_new AS ENUM ('PENDENTE', 'CPRO', 'TOKEN', 'COMPLETA', 'PROCESSADA', 'FATURADA');

-- 4. Converter a coluna para o novo enum
ALTER TABLE guias ALTER COLUMN status TYPE guide_status_new USING status::text::guide_status_new;

-- 5. Remover o enum antigo e renomear o novo
DROP TYPE guide_status;
ALTER TYPE guide_status_new RENAME TO guide_status;

-- 6. Restaurar o default
ALTER TABLE guias ALTER COLUMN status SET DEFAULT 'PENDENTE'::guide_status;
