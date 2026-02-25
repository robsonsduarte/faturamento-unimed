CREATE TABLE integracoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT UNIQUE NOT NULL,
  nome TEXT NOT NULL,
  config JSONB NOT NULL DEFAULT '{}',
  ativo BOOLEAN DEFAULT TRUE,
  updated_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE integracoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read integracoes"
  ON integracoes FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins can manage integracoes"
  ON integracoes FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

CREATE TRIGGER integracoes_updated_at BEFORE UPDATE ON integracoes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Seed SAW config (credentials must be set via admin UI after deploy)
INSERT INTO integracoes (slug, nome, config) VALUES (
  'saw',
  'Portal SAW (Unimed)',
  '{"api_url": "http://puppeteer-api:3001", "login_url": "https://saw.trixti.com.br/saw/Logar.do?method=abrirSAW", "usuario": "", "senha": "", "cookie_key": "saw_session_cookies"}'::jsonb
);

INSERT INTO integracoes (slug, nome, config) VALUES (
  'cpro',
  'ConsultorioPro',
  '{"api_url": "https://177.136.241.79", "api_key": "", "company": "1"}'::jsonb
);
