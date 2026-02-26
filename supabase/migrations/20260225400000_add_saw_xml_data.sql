-- Coluna para armazenar dados parseados do XML TISS oficial baixado do SAW
ALTER TABLE guias ADD COLUMN IF NOT EXISTS saw_xml_data JSONB;
