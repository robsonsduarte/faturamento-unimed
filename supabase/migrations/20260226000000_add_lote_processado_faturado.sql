-- Adicionar novos status ao enum lote_status
ALTER TYPE lote_status ADD VALUE IF NOT EXISTS 'processado' AFTER 'aceito';
ALTER TYPE lote_status ADD VALUE IF NOT EXISTS 'faturado' AFTER 'processado';

-- Adicionar campo numero_fatura ao lote
ALTER TABLE lotes ADD COLUMN IF NOT EXISTS numero_fatura TEXT;
