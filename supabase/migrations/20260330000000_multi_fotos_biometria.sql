-- Allow multiple photos per patient (up to 5)
-- Remove unique constraint on numero_carteira
ALTER TABLE biometria_fotos DROP CONSTRAINT IF EXISTS biometria_fotos_numero_carteira_key;

-- Add sequence column (1-5)
ALTER TABLE biometria_fotos ADD COLUMN IF NOT EXISTS sequence INT NOT NULL DEFAULT 1;

-- Add composite unique constraint
ALTER TABLE biometria_fotos ADD CONSTRAINT biometria_fotos_carteira_seq UNIQUE (numero_carteira, sequence);

-- Update existing index
DROP INDEX IF EXISTS idx_biometria_fotos_carteira;
CREATE INDEX idx_biometria_fotos_carteira ON biometria_fotos (numero_carteira);
