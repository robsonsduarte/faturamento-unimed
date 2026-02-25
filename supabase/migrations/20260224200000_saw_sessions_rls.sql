-- Fix: saw_sessions was missing RLS — cookies de sessao SAW expostos a qualquer usuario autenticado
ALTER TABLE saw_sessions ENABLE ROW LEVEL SECURITY;

-- Nenhum usuario autenticado pode ler/escrever saw_sessions diretamente
-- Acesso apenas via service_role (backend API routes)
CREATE POLICY "saw_sessions_deny_all" ON saw_sessions
  FOR ALL TO authenticated USING (false);

-- Permitir backend (service_role) inserir/atualizar via RLS bypass
-- O Supabase service_role ja bypassa RLS por padrao, entao nenhuma policy extra e necessaria
