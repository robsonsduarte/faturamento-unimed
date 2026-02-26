# Blueprint: Faturamento Unimed — DEDICARE

**Gerado por:** DuarteOS Input Analyzer (Squad Build System)
**Data:** 2026-02-24
**Input:** N8N Workflows (5 arquivos) + briefing verbal
**Prestador:** DEDICARE Servicos de Fonoaudiologia, Psicologia e Nutricao

---

## Resumo Executivo

Sistema web completo para gestao de faturamento de guias Unimed, substituindo a orquestracao via N8N + Google Sheets por uma aplicacao web com dashboard, gestao de guias, geracao de XML TISS, validacao biometrica e controle de cobrancas. O sistema integra com o portal SAW (Unimed), ConsultorioPro e gera XMLs no padrao TISS 4.02.00 da ANS.

---

## Stack

| Camada | Tecnologia |
|--------|-----------|
| Framework | Next.js 15 (App Router) |
| Linguagem | TypeScript (strict) |
| Styling | Tailwind CSS v4 + shadcn/ui |
| Auth | Supabase Auth |
| Database | Supabase (PostgreSQL) |
| ORM | Supabase Client + RLS |
| Forms | react-hook-form + zod |
| State | nuqs (URL state) + React Query |
| Tables | TanStack Table |
| Toasts | sonner |
| Animations | framer-motion |
| XML | fast-xml-parser (geracao TISS) |
| Cache | Redis (sessao SAW) |
| Cron/Jobs | Supabase Edge Functions + pg_cron |
| Deploy | Vercel |

---

## Data Models

### profiles
| Campo | Tipo | Descricao |
|-------|------|-----------|
| id | uuid (PK, FK auth.users) | ID do usuario |
| full_name | text | Nome completo |
| email | text | Email |
| avatar_url | text | URL do avatar |
| role | enum('admin','operador','visualizador') | Papel no sistema |
| created_at | timestamptz | Criacao |
| updated_at | timestamptz | Atualizacao |

### prestadores
| Campo | Tipo | Descricao |
|-------|------|-----------|
| id | uuid (PK) | ID |
| nome | text | Nome do prestador (ex: DEDICARE) |
| codigo_prestador | text | Codigo na operadora (97498504) |
| registro_ans | text | Registro ANS (339679) |
| cnes | text | CNES (9794220) |
| cnpj | text | CNPJ |
| padrao_tiss | text | Versao TISS (4.02.00) |
| created_at | timestamptz | Criacao |

### guias
| Campo | Tipo | Descricao |
|-------|------|-----------|
| id | uuid (PK) | ID interno |
| guide_number | text (unique) | Numero da guia operadora |
| guide_number_prestador | text | Numero guia prestador |
| status | enum | Status geral (PENDENTE, CPRO, COBRAR_OU_TOKEN, COMPLETA, PROCESSADA, FATURADA) |
| status_xml | enum | Status XML (PENDENTE, PROCESSADA, ERRO) |
| provider | text | Convenio |
| paciente | text | Nome do beneficiario |
| numero_carteira | text | Numero da carteira |
| senha | text | Senha da autorizacao |
| data_autorizacao | date | Data de autorizacao |
| data_validade_senha | date | Validade da senha |
| data_solicitacao | date | Data da solicitacao |
| quantidade_solicitada | int | Qtd solicitada |
| quantidade_autorizada | int | Qtd autorizada |
| procedimentos_realizados | int | Qtd de procedimentos realizados |
| procedimentos_cadastrados | int | Qtd cadastrados no ConsultorioPro |
| codigo_prestador | text | Codigo do prestador |
| nome_profissional | text | Nome do profissional |
| cnes | text | CNES |
| valor_total | decimal(10,2) | Valor total da guia |
| user_id | uuid (FK profiles) | Profissional responsavel |
| indicacao_clinica | text | Indicacao clinica |
| tipo_atendimento | text | Tipo de atendimento |
| indicacao_acidente | text | Indicacao de acidente |
| lote_id | uuid (FK lotes) | Lote de faturamento |
| token_biometrico | boolean | Se validou token biometrico |
| data_token | timestamptz | Data da validacao biometrica |
| saw_data | jsonb | Dados brutos do SAW |
| cpro_data | jsonb | Dados brutos do ConsultorioPro |
| created_at | timestamptz | Criacao |
| updated_at | timestamptz | Atualizacao |

### procedimentos
| Campo | Tipo | Descricao |
|-------|------|-----------|
| id | uuid (PK) | ID |
| guia_id | uuid (FK guias) | Guia pai |
| chave | text (unique) | Chave unica (guia-sequencia) |
| sequencia | int | Ordem do procedimento |
| codigo_tabela | text | Codigo da tabela |
| codigo_procedimento | text | Codigo do procedimento |
| descricao | text | Descricao do procedimento |
| data_execucao | date | Data de execucao |
| hora_inicio | time | Hora inicio |
| hora_fim | time | Hora fim |
| quantidade_executada | int | Quantidade executada |
| via_acesso | text | Via de acesso |
| tecnica_utilizada | text | Tecnica utilizada |
| reducao_acrescimo | decimal | Fator reducao/acrescimo |
| valor_unitario | decimal(10,2) | Valor unitario |
| valor_total | decimal(10,2) | Valor total |
| nome_profissional | text | Nome do profissional |
| conselho | text | Conselho (CRFa, CRP, etc) |
| numero_conselho | text | Numero no conselho |
| uf | text | UF |
| cbos | text | CBOS |
| status | enum | Status (Importado, Conferido, Faturado) |
| created_at | timestamptz | Criacao |

### lotes
| Campo | Tipo | Descricao |
|-------|------|-----------|
| id | uuid (PK) | ID |
| numero_lote | text (unique) | Numero do lote |
| tipo | enum('Local','Externo') | Tipo |
| referencia | text | Mes/ano referencia (ex: 2026-02) |
| quantidade_guias | int | Total de guias no lote |
| valor_total | decimal(10,2) | Valor total do lote |
| xml_content | text | XML TISS gerado |
| xml_hash | text | Hash de verificacao |
| status | enum('rascunho','gerado','enviado','aceito','glosado','pago') | Status |
| data_envio | timestamptz | Data de envio |
| data_resposta | timestamptz | Data de resposta |
| observacoes | text | Observacoes |
| created_by | uuid (FK profiles) | Quem criou |
| created_at | timestamptz | Criacao |
| updated_at | timestamptz | Atualizacao |

### cobrancas
| Campo | Tipo | Descricao |
|-------|------|-----------|
| id | uuid (PK) | ID |
| guia_id | uuid (FK guias) | Guia relacionada |
| lote_id | uuid (FK lotes) | Lote |
| tipo | enum('normal','recurso_glosa','complementar') | Tipo cobranca |
| valor_cobrado | decimal(10,2) | Valor cobrado |
| valor_pago | decimal(10,2) | Valor pago |
| valor_glosado | decimal(10,2) | Valor glosado |
| motivo_glosa | text | Motivo da glosa |
| data_cobranca | date | Data da cobranca |
| data_pagamento | date | Data do pagamento |
| status | enum('pendente','enviada','paga','glosada','recurso') | Status |
| created_at | timestamptz | Criacao |

### tokens_biometricos
| Campo | Tipo | Descricao |
|-------|------|-----------|
| id | uuid (PK) | ID |
| guia_id | uuid (FK guias) | Guia validada |
| paciente_nome | text | Nome do paciente |
| numero_carteira | text | Carteira do paciente |
| token | text | Token biometrico |
| validado | boolean | Se foi validado |
| data_validacao | timestamptz | Data/hora da validacao |
| ip_origem | text | IP de origem |
| user_agent | text | Navegador |
| created_at | timestamptz | Criacao |

### saw_sessions
| Campo | Tipo | Descricao |
|-------|------|-----------|
| id | uuid (PK) | ID |
| cookies | jsonb | Cookies da sessao SAW |
| valida | boolean | Se esta valida |
| expires_at | timestamptz | Expiracao |
| created_at | timestamptz | Criacao |

### audit_log
| Campo | Tipo | Descricao |
|-------|------|-----------|
| id | uuid (PK) | ID |
| user_id | uuid (FK profiles) | Usuario |
| action | text | Acao (guide.read, lote.generate, xml.send) |
| entity_type | text | Tipo da entidade |
| entity_id | uuid | ID da entidade |
| details | jsonb | Detalhes da acao |
| ip_address | text | IP |
| created_at | timestamptz | Timestamp |

---

## Roles & Permissions

| Role | Acesso |
|------|--------|
| admin | Tudo — configuracoes, usuarios, credenciais, relatorios |
| operador | CRUD de guias, gerar lotes, enviar XML, cobrancas |
| visualizador | Somente leitura — dashboard, guias, relatorios |

---

## Pages

| Rota | Descricao | Auth | Role |
|------|-----------|------|------|
| / | Landing/redirect para /dashboard | - | - |
| /auth/login | Login | Nao | - |
| /auth/register | Registro (invite-only) | Nao | - |
| /auth/forgot-password | Recuperar senha | Nao | - |
| /dashboard | Dashboard com KPIs e metricas | Sim | Todos |
| /dashboard/guias | Lista de guias (filtros, busca, paginacao) | Sim | Todos |
| /dashboard/guias/[id] | Detalhe da guia (dados SAW + CPro + procedimentos) | Sim | Todos |
| /dashboard/guias/importar | Importar guias (trigger coleta SAW) | Sim | operador+ |
| /dashboard/lotes | Lista de lotes de faturamento | Sim | Todos |
| /dashboard/lotes/[id] | Detalhe do lote (guias, XML, status) | Sim | Todos |
| /dashboard/lotes/novo | Gerar novo lote de faturamento | Sim | operador+ |
| /dashboard/xml | Gerador XML TISS (preview + download) | Sim | operador+ |
| /dashboard/cobrancas | Gestao de cobrancas e glosas | Sim | operador+ |
| /dashboard/tokens | Validacao de token biometrico | Sim | operador+ |
| /dashboard/relatorios | Relatorios (producao, financeiro, glosas) | Sim | Todos |
| /dashboard/configuracoes | Configuracoes do sistema | Sim | admin |
| /dashboard/configuracoes/prestador | Dados do prestador | Sim | admin |
| /dashboard/configuracoes/integracoes | SAW, CPro, Google Sheets credentials | Sim | admin |
| /dashboard/configuracoes/usuarios | Gestao de usuarios | Sim | admin |

---

## API Routes

### Guias
| Metodo | Rota | Descricao |
|--------|------|-----------|
| GET | /api/guias | Listar guias (paginacao, filtros por status, periodo) |
| GET | /api/guias/[id] | Detalhar guia com procedimentos |
| POST | /api/guias/importar | Trigger importacao do SAW |
| PUT | /api/guias/[id] | Atualizar guia |
| PUT | /api/guias/[id]/status | Alterar status da guia |
| DELETE | /api/guias/[id] | Remover guia |

### Procedimentos
| Metodo | Rota | Descricao |
|--------|------|-----------|
| GET | /api/guias/[id]/procedimentos | Listar procedimentos da guia |
| POST | /api/guias/[id]/procedimentos | Adicionar procedimento |
| PUT | /api/procedimentos/[id] | Atualizar procedimento |
| DELETE | /api/procedimentos/[id] | Remover procedimento |

### Lotes
| Metodo | Rota | Descricao |
|--------|------|-----------|
| GET | /api/lotes | Listar lotes |
| POST | /api/lotes | Criar novo lote |
| GET | /api/lotes/[id] | Detalhar lote |
| POST | /api/lotes/[id]/gerar-xml | Gerar XML TISS do lote |
| GET | /api/lotes/[id]/download-xml | Download do XML |
| PUT | /api/lotes/[id]/status | Atualizar status do lote |

### Cobrancas
| Metodo | Rota | Descricao |
|--------|------|-----------|
| GET | /api/cobrancas | Listar cobrancas |
| POST | /api/cobrancas | Criar cobranca |
| PUT | /api/cobrancas/[id] | Atualizar cobranca |
| GET | /api/cobrancas/resumo | Resumo financeiro |

### Token Biometrico
| Metodo | Rota | Descricao |
|--------|------|-----------|
| POST | /api/tokens/validar | Validar token biometrico |
| GET | /api/tokens | Listar validacoes |
| GET | /api/tokens/guia/[id] | Validacoes de uma guia |

### Integracoes
| Metodo | Rota | Descricao |
|--------|------|-----------|
| POST | /api/integracoes/saw/login | Login no SAW |
| POST | /api/integracoes/saw/ler-guia | Ler guia do SAW |
| POST | /api/integracoes/cpro/buscar | Buscar dados ConsultorioPro |
| GET | /api/integracoes/saw/status | Status da sessao SAW |

### Dashboard
| Metodo | Rota | Descricao |
|--------|------|-----------|
| GET | /api/dashboard/kpis | KPIs do dashboard |
| GET | /api/dashboard/producao | Dados de producao mensal |
| GET | /api/dashboard/financeiro | Dados financeiros |

---

## Design

### Paleta de Cores (tema saude/Unimed)
| Uso | Cor | Hex |
|-----|-----|-----|
| Background | Slate 950 | #020617 |
| Surface | Slate 900 | #0f172a |
| Card | Slate 800 | #1e293b |
| Primary | Emerald 500 | #10b981 |
| Primary Hover | Emerald 400 | #34d399 |
| Secondary | Sky 500 | #0ea5e9 |
| Text | Slate 50 | #f8fafc |
| Text Muted | Slate 400 | #94a3b8 |
| Danger | Red 500 | #ef4444 |
| Warning | Amber 500 | #f59e0b |
| Success | Green 500 | #22c55e |
| Info | Blue 500 | #3b82f6 |

### Tipografia
- **Font:** Inter (sans-serif)
- **Headings:** font-bold tracking-tight
- **Body:** font-normal text-slate-200
- **Small/Labels:** text-sm text-slate-400
- **Monospace (numeros):** font-mono (guide numbers, valores)

### Layout
- **Desktop:** Sidebar colapsavel (240px / 64px) + Main content
- **Tablet:** Sidebar colapsada por padrao
- **Mobile:** Bottom nav + Full-width content
- **Max-width:** 1400px (content area)
- **Spacing:** p-6 gap-6 consistente

---

## Features (MVP)

1. [ ] Auth completo (login, registro invite-only, forgot-password, middleware)
2. [ ] Dashboard com KPIs (guias pendentes, processadas, faturadas, valor total)
3. [ ] Gestao de guias (CRUD, filtros por status/periodo, busca, paginacao)
4. [ ] Detalhe de guia (dados SAW, CPro, procedimentos, timeline de status)
5. [ ] Importacao de guias (coleta automatizada via API SAW + CPro)
6. [ ] Gestao de procedimentos (parse XML, valores, validacao)
7. [ ] Criacao de lotes de faturamento (agrupar guias, calcular totais)
8. [ ] Geracao de XML TISS 4.02.00 (completo, validado, download)
9. [ ] Controle de status (pipeline visual: PENDENTE → FATURADA)
10. [ ] Configuracoes do prestador (dados ANS, CNES, profissionais)
11. [ ] Gestao de sessao SAW (login, cache Redis, status)
12. [ ] Audit log (rastreabilidade de todas as acoes)
13. [ ] Responsivo mobile-first

## Features (Fase 2 — Novas)

1. [ ] Validacao por token biometrico (paciente valida presenca)
2. [ ] Gestao de cobrancas (valores cobrados, pagos, glosados)
3. [ ] Recurso de glosa (workflow de contestacao)
4. [ ] Relatorios avancados (producao por profissional, financeiro mensal, glosas)
5. [ ] Exportar dados (CSV, PDF)
6. [ ] Notificacoes (guias expirando, lotes pendentes, pagamentos recebidos)
7. [ ] Google Sheets sync bi-direcional (manter compatibilidade)
8. [ ] Multi-prestador (suporte a mais de um prestador)

---

## Database Schema (SQL)

```sql
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

-- Lotes
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

-- RLS Policies (authenticated users can read all, write based on role)
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
```

---

## Constantes do Dominio (extraidas dos workflows)

```typescript
export const DEDICARE = {
  REGISTRO_ANS: '339679',
  CODIGO_PRESTADOR: '97498504',
  NOME_PRESTADOR: 'DEDICARE SERVICOS DE FONOAUDIOLOGIA PSICOLOGIA E NUTRICAO',
  CNES: '9794220',
  PADRAO_TISS: '4.02.00',
} as const;

export const VALORES_PROCEDIMENTO = {
  fonoaudiologia: 35.00,
  psicomotricidade: 70.00,
  default: 30.36,
} as const;

export const GUIDE_STATUS_FLOW = [
  'PENDENTE',
  'CPRO',
  'COBRAR_OU_TOKEN',
  'COMPLETA',
  'PROCESSADA',
  'FATURADA',
] as const;
```

---

## Success Criteria

- [ ] `npm run dev` funciona sem erros
- [ ] Login/registro funcional com RBAC
- [ ] Dashboard com KPIs reais (guias, lotes, valores)
- [ ] CRUD completo de guias com filtros e busca
- [ ] Visualizacao de procedimentos por guia
- [ ] Geracao de lote de faturamento funcional
- [ ] XML TISS 4.02.00 gerado corretamente (validavel)
- [ ] Download de XML funcional
- [ ] Pipeline visual de status das guias
- [ ] Tela de validacao biometrica funcional
- [ ] Tela de cobrancas funcional
- [ ] Design coerente, dark mode, responsivo
- [ ] TypeScript sem erros (`tsc --noEmit`)
- [ ] Zero `any` no codigo
