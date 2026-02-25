-- Adicionar coluna tipo_guia na tabela guias
-- Classifica guias como 'Local' (carteira prefix 0865 ou 865) ou 'Intercambio'
ALTER TABLE guias ADD COLUMN IF NOT EXISTS tipo_guia TEXT DEFAULT 'Intercambio';

-- Preencher guias existentes com base no numero_carteira
-- Strip non-digits, check if starts with 0865 or 865
UPDATE guias
SET tipo_guia = CASE
  WHEN regexp_replace(COALESCE(numero_carteira, ''), '\D', '', 'g') ~ '^0?865' THEN 'Local'
  ELSE 'Intercambio'
END;
