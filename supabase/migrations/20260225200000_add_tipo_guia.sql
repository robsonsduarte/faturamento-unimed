-- Adicionar coluna tipo_guia na tabela guias
-- Classifica guias como 'Local' (carteira prefix 0865) ou 'Intercambio'
ALTER TABLE guias ADD COLUMN tipo_guia TEXT DEFAULT 'Intercambio';

-- Preencher guias existentes com base no numero_carteira
UPDATE guias
SET tipo_guia = CASE
  WHEN lpad(regexp_replace(COALESCE(numero_carteira, ''), '\D', '', 'g'), 14, '0') LIKE '0865%' THEN 'Local'
  ELSE 'Intercambio'
END;
