-- Adiciona coluna mes_referencia para controlar o mes de competencia da guia
-- Backfill: usa o mes do created_at para guias existentes
ALTER TABLE guias ADD COLUMN mes_referencia TEXT;
UPDATE guias SET mes_referencia = TO_CHAR(created_at, 'YYYY-MM') WHERE mes_referencia IS NULL;
ALTER TABLE guias ALTER COLUMN mes_referencia SET NOT NULL;
ALTER TABLE guias ALTER COLUMN mes_referencia SET DEFAULT TO_CHAR(NOW(), 'YYYY-MM');
CREATE INDEX idx_guias_mes_referencia ON guias (mes_referencia);
