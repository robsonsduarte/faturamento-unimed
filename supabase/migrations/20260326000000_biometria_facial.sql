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

-- Token requests: rastreia solicitacoes de token via WhatsApp
CREATE TABLE token_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  guia_id UUID REFERENCES guias(id),
  guide_number TEXT NOT NULL,
  paciente_nome TEXT,
  phone_whatsapp TEXT NOT NULL,
  method TEXT NOT NULL CHECK (method IN ('aplicativo', 'sms')),
  session_id TEXT NOT NULL,
  status TEXT DEFAULT 'waiting' CHECK (status IN ('waiting', 'processing', 'completed', 'failed', 'expired')),
  token_received TEXT,
  error_message TEXT,
  expires_at TIMESTAMPTZ NOT NULL,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_token_requests_phone ON token_requests(phone_whatsapp, status);
CREATE INDEX idx_token_requests_session ON token_requests(session_id);

ALTER TABLE token_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "token_requests_read" ON token_requests
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "token_requests_manage" ON token_requests
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'operador')));

-- Service role (webhook) needs full access
CREATE POLICY "token_requests_service" ON token_requests
  FOR ALL TO service_role USING (true);

CREATE TRIGGER token_requests_updated_at
  BEFORE UPDATE ON token_requests
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
