-- Multi-user SAW: credenciais por usuario + sessoes isoladas

-- Tabela de credenciais SAW por usuario
CREATE TABLE saw_credentials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  usuario TEXT NOT NULL,
  senha TEXT NOT NULL,
  login_url TEXT NOT NULL DEFAULT 'https://saw.trixti.com.br/saw/Logar.do?method=abrirSAW',
  ativo BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id)
);

-- Adicionar user_id a saw_sessions para isolamento por usuario
ALTER TABLE saw_sessions ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES profiles(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_saw_sessions_user_id ON saw_sessions(user_id);

-- RLS para saw_credentials
ALTER TABLE saw_credentials ENABLE ROW LEVEL SECURITY;

-- Usuarios autenticados veem apenas suas proprias credenciais
CREATE POLICY "saw_credentials_select_own"
  ON saw_credentials FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

-- Admin pode ver/gerenciar todas
CREATE POLICY "saw_credentials_admin_all"
  ON saw_credentials FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

-- Operadores podem inserir/atualizar suas proprias
CREATE POLICY "saw_credentials_operador_manage_own"
  ON saw_credentials FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'operador'))
  );

CREATE POLICY "saw_credentials_operador_update_own"
  ON saw_credentials FOR UPDATE TO authenticated
  USING (
    auth.uid() = user_id
    AND EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'operador'))
  );

-- Trigger updated_at
CREATE TRIGGER saw_credentials_updated_at
  BEFORE UPDATE ON saw_credentials
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
