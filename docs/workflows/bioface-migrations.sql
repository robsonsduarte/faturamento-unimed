-- ============================================================
-- BIOFACE N8N — Migrations Consolidadas
-- Executar na ordem no Supabase SQL Editor
-- ============================================================

-- 1) Colunas de controle N8N em biometria_fotos
-- ============================================================
ALTER TABLE biometria_fotos
  ADD COLUMN IF NOT EXISTS processing_status TEXT DEFAULT 'pending_ai'
    CHECK (processing_status IN (
      'pending_ai', 'processing', 'quality_rejected',
      'completed', 'failed', 'skipped'
    )),
  ADD COLUMN IF NOT EXISTS operator_id       TEXT,
  ADD COLUMN IF NOT EXISTS quality_score     NUMERIC,
  ADD COLUMN IF NOT EXISTS quality_reason    TEXT,
  ADD COLUMN IF NOT EXISTS n8n_started_at    TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS n8n_completed_at  TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS n8n_error         TEXT;

CREATE INDEX IF NOT EXISTS idx_biometria_fotos_processing
  ON biometria_fotos(processing_status)
  WHERE processing_status IN ('pending_ai', 'processing', 'failed');


-- 2) Tabela patient_photos (fotos com fundo processadas)
-- ============================================================
CREATE TABLE IF NOT EXISTS patient_photos (
  id                UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  biometria_foto_id UUID NOT NULL REFERENCES biometria_fotos(id) ON DELETE CASCADE,
  guia_id           UUID NOT NULL,
  numero_carteira   TEXT NOT NULL,
  operator_id       TEXT,
  background_name   TEXT NOT NULL,
  storage_path      TEXT NOT NULL,
  public_url        TEXT NOT NULL,
  url_expires_at    TIMESTAMPTZ,
  selected          BOOLEAN DEFAULT FALSE,
  status            TEXT DEFAULT 'ready',
  created_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_patient_photos_guia
  ON patient_photos(guia_id);
CREATE INDEX IF NOT EXISTS idx_patient_photos_biometria
  ON patient_photos(biometria_foto_id);
CREATE INDEX IF NOT EXISTS idx_patient_photos_selected
  ON patient_photos(guia_id, selected) WHERE selected = TRUE;

-- RLS
ALTER TABLE patient_photos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "operadores veem patient_photos das suas guias" ON patient_photos;
CREATE POLICY "operadores veem patient_photos das suas guias"
  ON patient_photos FOR ALL
  USING (
    operator_id = auth.uid()::text
    OR EXISTS (
      SELECT 1 FROM guias g
      WHERE g.id = patient_photos.guia_id
        AND g.user_id = auth.uid()
    )
  );


-- 3) Novos tipos de notificação
-- ============================================================
-- Se houver CHECK constraint existente no campo type da tabela notifications:
DO $$
BEGIN
  -- Tenta remover constraint existente (ignora se não existir)
  ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_type_check;
  
  -- Recria com todos os tipos
  ALTER TABLE notifications
    ADD CONSTRAINT notifications_type_check
    CHECK (type IN (
      'bioface_received',
      'ai_photos_ready',
      'ai_quality_rejected',
      'ai_processing_failed'
    ));
EXCEPTION
  WHEN others THEN
    -- Se a coluna type não tiver constraint, tudo bem
    RAISE NOTICE 'Constraint de tipo não alterada: %', SQLERRM;
END $$;


-- 4) Bucket patients no Storage (executar via API ou Dashboard)
-- ============================================================
-- No Supabase Dashboard: Storage → New Bucket
-- Nome: patients
-- Public: false (signed URLs)
-- Ou via SQL:
INSERT INTO storage.buckets (id, name, public)
VALUES ('patients', 'patients', false)
ON CONFLICT (id) DO NOTHING;

-- Policy para service_role ter acesso total ao bucket patients
CREATE POLICY "service_role full access patients"
  ON storage.objects FOR ALL
  USING (bucket_id = 'patients')
  WITH CHECK (bucket_id = 'patients');


-- 5) Query de monitoramento (referência)
-- ============================================================
-- SELECT
--   processing_status,
--   COUNT(*) as total,
--   AVG(EXTRACT(EPOCH FROM (n8n_completed_at - n8n_started_at))) as avg_seconds,
--   AVG(quality_score) as avg_quality
-- FROM biometria_fotos
-- WHERE created_at > NOW() - INTERVAL '24 hours'
-- GROUP BY processing_status
-- ORDER BY total DESC;
