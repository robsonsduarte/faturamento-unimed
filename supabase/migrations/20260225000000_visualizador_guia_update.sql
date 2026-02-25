-- Migration: Visualizador RLS policies para fluxo "Atualizar dados" de guia unica
-- Fix 1 (CRITICA): policies separadas das de admin/operador existentes

-- Visualizador pode atualizar dados de guia unica (reimportacao via botao "Atualizar dados")
CREATE POLICY "Visualizador can update guias"
  ON guias FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'visualizador'));

-- Visualizador pode deletar procedimentos da guia (fluxo deleta antes de reinserir)
CREATE POLICY "Visualizador can delete procedimentos"
  ON procedimentos FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'visualizador'));

-- Visualizador pode inserir procedimentos da guia (fluxo insere apos deletar)
CREATE POLICY "Visualizador can insert procedimentos"
  ON procedimentos FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'visualizador'));
