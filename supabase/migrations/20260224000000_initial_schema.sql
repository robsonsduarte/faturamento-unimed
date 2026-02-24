-- Enums
CREATE TYPE guide_status AS ENUM ('PENDENTE', 'CPRO', 'COBRAR_OU_TOKEN', 'COMPLETA', 'PROCESSADA', 'FATURADA');
CREATE TYPE xml_status AS ENUM ('PENDENTE', 'PROCESSADA', 'ERRO');
CREATE TYPE lote_status AS ENUM ('rascunho', 'gerado', 'enviado', 'aceito', 'glosado', 'pago');
CREATE TYPE cobranca_status AS ENUM ('pendente', 'enviada', 'paga', 'glosada', 'recurso');
CREATE TYPE cobranca_tipo AS ENUM ('normal', 'recurso_glosa', 'complementar');
CREATE TYPE user_role AS ENUM ('admin', 'operador', 'visualizador');
CREATE TYPE proc_status AS ENUM ('Importado', 'Conferido', 'Faturado');
CREATE TYPE lote_tipo AS ENUM ('Local', 'Externo');

-- Profiles (extends Supabase auth.users)
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  email TEXT NOT NULL,
  avatar_url TEXT,
  role user_role DEFAULT 'operador',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Prestadores
CREATE TABLE prestadores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  codigo_prestador TEXT NOT NULL,
  registro_ans TEXT NOT NULL,
  cnes TEXT NOT NULL,
  cnpj TEXT,
  padrao_tiss TEXT DEFAULT '4.02.00',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Lotes (antes de guias por causa da FK)
CREATE TABLE lotes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  numero_lote TEXT UNIQUE NOT NULL,
  tipo lote_tipo DEFAULT 'Local',
  referencia TEXT,
  quantidade_guias INT DEFAULT 0,
  valor_total DECIMAL(10,2) DEFAULT 0,
  xml_content TEXT,
  xml_hash TEXT,
  status lote_status DEFAULT 'rascunho',
  data_envio TIMESTAMPTZ,
  data_resposta TIMESTAMPTZ,
  observacoes TEXT,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Guias
CREATE TABLE guias (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  guide_number TEXT UNIQUE NOT NULL,
  guide_number_prestador TEXT,
  status guide_status DEFAULT 'PENDENTE',
  status_xml xml_status DEFAULT 'PENDENTE',
  provider TEXT,
  paciente TEXT,
  numero_carteira TEXT,
  senha TEXT,
  data_autorizacao DATE,
  data_validade_senha DATE,
  data_solicitacao DATE,
  quantidade_solicitada INT,
  quantidade_autorizada INT,
  procedimentos_realizados INT DEFAULT 0,
  procedimentos_cadastrados INT DEFAULT 0,
  codigo_prestador TEXT,
  nome_profissional TEXT,
  cnes TEXT,
  valor_total DECIMAL(10,2) DEFAULT 0,
  user_id UUID REFERENCES profiles(id),
  indicacao_clinica TEXT,
  tipo_atendimento TEXT,
  indicacao_acidente TEXT,
  lote_id UUID REFERENCES lotes(id),
  token_biometrico BOOLEAN DEFAULT FALSE,
  data_token TIMESTAMPTZ,
  saw_data JSONB,
  cpro_data JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Procedimentos
CREATE TABLE procedimentos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  guia_id UUID NOT NULL REFERENCES guias(id) ON DELETE CASCADE,
  chave TEXT UNIQUE,
  sequencia INT NOT NULL,
  codigo_tabela TEXT,
  codigo_procedimento TEXT,
  descricao TEXT,
  data_execucao DATE,
  hora_inicio TIME,
  hora_fim TIME,
  quantidade_executada INT DEFAULT 1,
  via_acesso TEXT,
  tecnica_utilizada TEXT,
  reducao_acrescimo DECIMAL DEFAULT 1,
  valor_unitario DECIMAL(10,2),
  valor_total DECIMAL(10,2),
  nome_profissional TEXT,
  conselho TEXT,
  numero_conselho TEXT,
  uf TEXT,
  cbos TEXT,
  status proc_status DEFAULT 'Importado',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Cobrancas
CREATE TABLE cobrancas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  guia_id UUID REFERENCES guias(id),
  lote_id UUID REFERENCES lotes(id),
  tipo cobranca_tipo DEFAULT 'normal',
  valor_cobrado DECIMAL(10,2),
  valor_pago DECIMAL(10,2),
  valor_glosado DECIMAL(10,2),
  motivo_glosa TEXT,
  data_cobranca DATE,
  data_pagamento DATE,
  status cobranca_status DEFAULT 'pendente',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tokens Biometricos
CREATE TABLE tokens_biometricos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  guia_id UUID REFERENCES guias(id),
  paciente_nome TEXT,
  numero_carteira TEXT,
  token TEXT NOT NULL,
  validado BOOLEAN DEFAULT FALSE,
  data_validacao TIMESTAMPTZ,
  ip_origem TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Sessoes SAW
CREATE TABLE saw_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cookies JSONB,
  valida BOOLEAN DEFAULT TRUE,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Audit Log
CREATE TABLE audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id),
  action TEXT NOT NULL,
  entity_type TEXT,
  entity_id UUID,
  details JSONB,
  ip_address TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_guias_status ON guias(status);
CREATE INDEX idx_guias_status_xml ON guias(status_xml);
CREATE INDEX idx_guias_guide_number ON guias(guide_number);
CREATE INDEX idx_guias_lote_id ON guias(lote_id);
CREATE INDEX idx_procedimentos_guia_id ON procedimentos(guia_id);
CREATE INDEX idx_lotes_status ON lotes(status);
CREATE INDEX idx_cobrancas_status ON cobrancas(status);
CREATE INDEX idx_audit_log_user ON audit_log(user_id);
CREATE INDEX idx_audit_log_created ON audit_log(created_at);

-- RLS
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE guias ENABLE ROW LEVEL SECURITY;
ALTER TABLE procedimentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE lotes ENABLE ROW LEVEL SECURITY;
ALTER TABLE cobrancas ENABLE ROW LEVEL SECURITY;
ALTER TABLE tokens_biometricos ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Authenticated users can read profiles"
  ON profiles FOR SELECT TO authenticated USING (true);

CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE TO authenticated USING (auth.uid() = id);

CREATE POLICY "Authenticated users can read guias"
  ON guias FOR SELECT TO authenticated USING (true);

CREATE POLICY "Operadores can insert guias"
  ON guias FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'operador')));

CREATE POLICY "Operadores can update guias"
  ON guias FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'operador')));

CREATE POLICY "Authenticated users can read procedimentos"
  ON procedimentos FOR SELECT TO authenticated USING (true);

CREATE POLICY "Operadores can manage procedimentos"
  ON procedimentos FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'operador')));

CREATE POLICY "Authenticated users can read lotes"
  ON lotes FOR SELECT TO authenticated USING (true);

CREATE POLICY "Operadores can manage lotes"
  ON lotes FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'operador')));

CREATE POLICY "Authenticated users can read cobrancas"
  ON cobrancas FOR SELECT TO authenticated USING (true);

CREATE POLICY "Operadores can manage cobrancas"
  ON cobrancas FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'operador')));

CREATE POLICY "Authenticated users can read audit_log"
  ON audit_log FOR SELECT TO authenticated USING (true);

CREATE POLICY "System can insert audit_log"
  ON audit_log FOR INSERT TO authenticated WITH CHECK (true);

-- Seed prestador DEDICARE
INSERT INTO prestadores (nome, codigo_prestador, registro_ans, cnes, padrao_tiss)
VALUES ('DEDICARE SERVICOS DE FONOAUDIOLOGIA PSICOLOGIA E NUTRICAO', '97498504', '339679', '9794220', '4.02.00');

-- Trigger para auto-create profile on signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, full_name, email, role)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', ''), NEW.email, 'operador');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- Trigger para updated_at
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER guias_updated_at BEFORE UPDATE ON guias
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER lotes_updated_at BEFORE UPDATE ON lotes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER profiles_updated_at BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
