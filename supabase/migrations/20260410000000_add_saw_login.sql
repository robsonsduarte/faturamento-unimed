-- Track which SAW user/login emitted each guide
ALTER TABLE guias ADD COLUMN IF NOT EXISTS saw_login TEXT;

CREATE INDEX IF NOT EXISTS idx_guias_saw_login ON guias (saw_login) WHERE saw_login IS NOT NULL;

-- Backfill: assume guias pre-existentes foram emitidas com o login atual da integracao SAW global
UPDATE guias
SET saw_login = (SELECT config->>'usuario' FROM integracoes WHERE slug = 'saw' LIMIT 1)
WHERE saw_login IS NULL;
