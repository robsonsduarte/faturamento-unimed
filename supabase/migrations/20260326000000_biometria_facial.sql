-- Biometria facial: fotos de pacientes para resolucao de token SAW

CREATE TABLE biometria_fotos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  numero_carteira TEXT NOT NULL UNIQUE,
  paciente_nome TEXT NOT NULL,
  photo_path TEXT NOT NULL,
  captured_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_biometria_fotos_carteira ON biometria_fotos(numero_carteira);

ALTER TABLE biometria_fotos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "biometria_fotos_read" ON biometria_fotos
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "biometria_fotos_manage" ON biometria_fotos
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'operador')));

CREATE TRIGGER biometria_fotos_updated_at
  BEFORE UPDATE ON biometria_fotos
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
