/**
 * Supabase Database types — manually generated from SQL schema.
 *
 * Source: supabase/migrations/20260224000000_initial_schema.sql
 *         supabase/migrations/20260224100000_integracoes.sql
 *
 * Keep in sync with schema changes. Regenerate with `supabase gen types` when CLI access is available.
 */

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          full_name: string
          email: string
          avatar_url: string | null
          role: 'admin' | 'operador' | 'visualizador'
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          full_name: string
          email: string
          avatar_url?: string | null
          role?: 'admin' | 'operador' | 'visualizador'
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          full_name?: string
          email?: string
          avatar_url?: string | null
          role?: 'admin' | 'operador' | 'visualizador'
          created_at?: string
          updated_at?: string
        }
      }
      prestadores: {
        Row: {
          id: string
          nome: string
          codigo_prestador: string
          registro_ans: string
          cnes: string
          cnpj: string | null
          padrao_tiss: string
          created_at: string
        }
        Insert: {
          id?: string
          nome: string
          codigo_prestador: string
          registro_ans: string
          cnes: string
          cnpj?: string | null
          padrao_tiss?: string
          created_at?: string
        }
        Update: {
          id?: string
          nome?: string
          codigo_prestador?: string
          registro_ans?: string
          cnes?: string
          cnpj?: string | null
          padrao_tiss?: string
          created_at?: string
        }
      }
      lotes: {
        Row: {
          id: string
          numero_lote: string
          tipo: 'Local' | 'Externo'
          referencia: string | null
          quantidade_guias: number
          valor_total: number
          xml_content: string | null
          xml_hash: string | null
          status: 'rascunho' | 'gerado' | 'enviado' | 'aceito' | 'glosado' | 'pago'
          data_envio: string | null
          data_resposta: string | null
          observacoes: string | null
          created_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          numero_lote: string
          tipo?: 'Local' | 'Externo'
          referencia?: string | null
          quantidade_guias?: number
          valor_total?: number
          xml_content?: string | null
          xml_hash?: string | null
          status?: 'rascunho' | 'gerado' | 'enviado' | 'aceito' | 'glosado' | 'pago'
          data_envio?: string | null
          data_resposta?: string | null
          observacoes?: string | null
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          numero_lote?: string
          tipo?: 'Local' | 'Externo'
          referencia?: string | null
          quantidade_guias?: number
          valor_total?: number
          xml_content?: string | null
          xml_hash?: string | null
          status?: 'rascunho' | 'gerado' | 'enviado' | 'aceito' | 'glosado' | 'pago'
          data_envio?: string | null
          data_resposta?: string | null
          observacoes?: string | null
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      guias: {
        Row: {
          id: string
          guide_number: string
          guide_number_prestador: string | null
          status: 'PENDENTE' | 'CPRO' | 'TOKEN' | 'COMPLETA' | 'PROCESSADA' | 'FATURADA'
          status_xml: 'PENDENTE' | 'PROCESSADA' | 'ERRO'
          provider: string | null
          paciente: string | null
          numero_carteira: string | null
          senha: string | null
          data_autorizacao: string | null
          data_validade_senha: string | null
          data_solicitacao: string | null
          quantidade_solicitada: number | null
          quantidade_autorizada: number | null
          procedimentos_realizados: number
          procedimentos_cadastrados: number
          codigo_prestador: string | null
          nome_profissional: string | null
          cnes: string | null
          valor_total: number
          user_id: string | null
          indicacao_clinica: string | null
          tipo_atendimento: string | null
          indicacao_acidente: string | null
          tipo_guia: string
          lote_id: string | null
          token_biometrico: boolean
          data_token: string | null
          saw_data: Json | null
          cpro_data: Json | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          guide_number: string
          guide_number_prestador?: string | null
          status?: 'PENDENTE' | 'CPRO' | 'TOKEN' | 'COMPLETA' | 'PROCESSADA' | 'FATURADA'
          status_xml?: 'PENDENTE' | 'PROCESSADA' | 'ERRO'
          provider?: string | null
          paciente?: string | null
          numero_carteira?: string | null
          senha?: string | null
          data_autorizacao?: string | null
          data_validade_senha?: string | null
          data_solicitacao?: string | null
          quantidade_solicitada?: number | null
          quantidade_autorizada?: number | null
          procedimentos_realizados?: number
          procedimentos_cadastrados?: number
          codigo_prestador?: string | null
          nome_profissional?: string | null
          cnes?: string | null
          valor_total?: number
          user_id?: string | null
          indicacao_clinica?: string | null
          tipo_atendimento?: string | null
          indicacao_acidente?: string | null
          tipo_guia?: string
          lote_id?: string | null
          token_biometrico?: boolean
          data_token?: string | null
          saw_data?: Json | null
          cpro_data?: Json | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          guide_number?: string
          guide_number_prestador?: string | null
          status?: 'PENDENTE' | 'CPRO' | 'TOKEN' | 'COMPLETA' | 'PROCESSADA' | 'FATURADA'
          status_xml?: 'PENDENTE' | 'PROCESSADA' | 'ERRO'
          provider?: string | null
          paciente?: string | null
          numero_carteira?: string | null
          senha?: string | null
          data_autorizacao?: string | null
          data_validade_senha?: string | null
          data_solicitacao?: string | null
          quantidade_solicitada?: number | null
          quantidade_autorizada?: number | null
          procedimentos_realizados?: number
          procedimentos_cadastrados?: number
          codigo_prestador?: string | null
          nome_profissional?: string | null
          cnes?: string | null
          valor_total?: number
          user_id?: string | null
          indicacao_clinica?: string | null
          tipo_atendimento?: string | null
          indicacao_acidente?: string | null
          tipo_guia?: string
          lote_id?: string | null
          token_biometrico?: boolean
          data_token?: string | null
          saw_data?: Json | null
          cpro_data?: Json | null
          created_at?: string
          updated_at?: string
        }
      }
      procedimentos: {
        Row: {
          id: string
          guia_id: string
          chave: string | null
          sequencia: number
          codigo_tabela: string | null
          codigo_procedimento: string | null
          descricao: string | null
          data_execucao: string | null
          hora_inicio: string | null
          hora_fim: string | null
          quantidade_executada: number
          via_acesso: string | null
          tecnica_utilizada: string | null
          reducao_acrescimo: number
          valor_unitario: number | null
          valor_total: number | null
          nome_profissional: string | null
          conselho: string | null
          numero_conselho: string | null
          uf: string | null
          cbos: string | null
          status: 'Importado' | 'Conferido' | 'Faturado'
          created_at: string
        }
        Insert: {
          id?: string
          guia_id: string
          chave?: string | null
          sequencia: number
          codigo_tabela?: string | null
          codigo_procedimento?: string | null
          descricao?: string | null
          data_execucao?: string | null
          hora_inicio?: string | null
          hora_fim?: string | null
          quantidade_executada?: number
          via_acesso?: string | null
          tecnica_utilizada?: string | null
          reducao_acrescimo?: number
          valor_unitario?: number | null
          valor_total?: number | null
          nome_profissional?: string | null
          conselho?: string | null
          numero_conselho?: string | null
          uf?: string | null
          cbos?: string | null
          status?: 'Importado' | 'Conferido' | 'Faturado'
          created_at?: string
        }
        Update: {
          id?: string
          guia_id?: string
          chave?: string | null
          sequencia?: number
          codigo_tabela?: string | null
          codigo_procedimento?: string | null
          descricao?: string | null
          data_execucao?: string | null
          hora_inicio?: string | null
          hora_fim?: string | null
          quantidade_executada?: number
          via_acesso?: string | null
          tecnica_utilizada?: string | null
          reducao_acrescimo?: number
          valor_unitario?: number | null
          valor_total?: number | null
          nome_profissional?: string | null
          conselho?: string | null
          numero_conselho?: string | null
          uf?: string | null
          cbos?: string | null
          status?: 'Importado' | 'Conferido' | 'Faturado'
          created_at?: string
        }
      }
      cobrancas: {
        Row: {
          id: string
          guia_id: string | null
          lote_id: string | null
          tipo: 'normal' | 'recurso_glosa' | 'complementar'
          valor_cobrado: number | null
          valor_pago: number | null
          valor_glosado: number | null
          motivo_glosa: string | null
          data_cobranca: string | null
          data_pagamento: string | null
          status: 'pendente' | 'enviada' | 'paga' | 'glosada' | 'recurso'
          created_at: string
        }
        Insert: {
          id?: string
          guia_id?: string | null
          lote_id?: string | null
          tipo?: 'normal' | 'recurso_glosa' | 'complementar'
          valor_cobrado?: number | null
          valor_pago?: number | null
          valor_glosado?: number | null
          motivo_glosa?: string | null
          data_cobranca?: string | null
          data_pagamento?: string | null
          status?: 'pendente' | 'enviada' | 'paga' | 'glosada' | 'recurso'
          created_at?: string
        }
        Update: {
          id?: string
          guia_id?: string | null
          lote_id?: string | null
          tipo?: 'normal' | 'recurso_glosa' | 'complementar'
          valor_cobrado?: number | null
          valor_pago?: number | null
          valor_glosado?: number | null
          motivo_glosa?: string | null
          data_cobranca?: string | null
          data_pagamento?: string | null
          status?: 'pendente' | 'enviada' | 'paga' | 'glosada' | 'recurso'
          created_at?: string
        }
      }
      tokens_biometricos: {
        Row: {
          id: string
          guia_id: string | null
          paciente_nome: string | null
          numero_carteira: string | null
          token: string
          validado: boolean
          data_validacao: string | null
          ip_origem: string | null
          user_agent: string | null
          created_at: string
        }
        Insert: {
          id?: string
          guia_id?: string | null
          paciente_nome?: string | null
          numero_carteira?: string | null
          token: string
          validado?: boolean
          data_validacao?: string | null
          ip_origem?: string | null
          user_agent?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          guia_id?: string | null
          paciente_nome?: string | null
          numero_carteira?: string | null
          token?: string
          validado?: boolean
          data_validacao?: string | null
          ip_origem?: string | null
          user_agent?: string | null
          created_at?: string
        }
      }
      saw_sessions: {
        Row: {
          id: string
          cookies: Json | null
          valida: boolean
          expires_at: string | null
          created_at: string
        }
        Insert: {
          id?: string
          cookies?: Json | null
          valida?: boolean
          expires_at?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          cookies?: Json | null
          valida?: boolean
          expires_at?: string | null
          created_at?: string
        }
      }
      audit_log: {
        Row: {
          id: string
          user_id: string | null
          action: string
          entity_type: string | null
          entity_id: string | null
          details: Json | null
          ip_address: string | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id?: string | null
          action: string
          entity_type?: string | null
          entity_id?: string | null
          details?: Json | null
          ip_address?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string | null
          action?: string
          entity_type?: string | null
          entity_id?: string | null
          details?: Json | null
          ip_address?: string | null
          created_at?: string
        }
      }
      integracoes: {
        Row: {
          id: string
          slug: string
          nome: string
          config: Json
          ativo: boolean
          updated_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          slug: string
          nome: string
          config?: Json
          ativo?: boolean
          updated_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          slug?: string
          nome?: string
          config?: Json
          ativo?: boolean
          updated_by?: string | null
          created_at?: string
          updated_at?: string
        }
      }
    }
    Enums: {
      guide_status: 'PENDENTE' | 'CPRO' | 'TOKEN' | 'COMPLETA' | 'PROCESSADA' | 'FATURADA'
      xml_status: 'PENDENTE' | 'PROCESSADA' | 'ERRO'
      lote_status: 'rascunho' | 'gerado' | 'enviado' | 'aceito' | 'glosado' | 'pago'
      cobranca_status: 'pendente' | 'enviada' | 'paga' | 'glosada' | 'recurso'
      cobranca_tipo: 'normal' | 'recurso_glosa' | 'complementar'
      user_role: 'admin' | 'operador' | 'visualizador'
      proc_status: 'Importado' | 'Conferido' | 'Faturado'
      lote_tipo: 'Local' | 'Externo'
    }
  }
}
