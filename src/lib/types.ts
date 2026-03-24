export interface Profile {
  id: string
  full_name: string
  email: string
  avatar_url: string | null
  role: 'admin' | 'operador' | 'visualizador'
  created_at: string
  updated_at: string
}

export interface Prestador {
  id: string
  nome: string
  codigo_prestador: string
  registro_ans: string
  cnes: string
  cnpj: string | null
  padrao_tiss: string
  created_at: string
}

export interface Guia {
  id: string
  guide_number: string
  guide_number_prestador: string | null
  status: 'PENDENTE' | 'CPRO' | 'TOKEN' | 'COMPLETA' | 'PROCESSADA' | 'FATURADA' | 'CANCELADA'
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
  tipo_guia: 'Local' | 'Intercambio'
  lote_id: string | null
  token_biometrico: boolean
  data_token: string | null
  saw_data: Record<string, unknown> | null
  cpro_data: Record<string, unknown> | null
  saw_xml_data: SawXmlData | null
  created_at: string
  updated_at: string
  procedimentos?: Procedimento[]
}

export interface Procedimento {
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

export interface Lote {
  id: string
  numero_lote: string
  tipo: 'Local' | 'Externo'
  referencia: string | null
  quantidade_guias: number
  valor_total: number
  xml_content: string | null
  xml_hash: string | null
  status: 'rascunho' | 'gerado' | 'enviado' | 'aceito' | 'processado' | 'faturado' | 'glosado' | 'pago'
  numero_fatura: string | null
  data_envio: string | null
  data_resposta: string | null
  observacoes: string | null
  created_by: string | null
  created_at: string
  updated_at: string
  guias?: Guia[]
}

export interface Cobranca {
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

export interface TokenBiometrico {
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

export interface DashboardKPIs {
  total_guias: number
  guias_pendentes: number
  guias_cpro: number
  guias_token: number
  guias_completas: number
  guias_processadas: number
  guias_faturadas: number
  valor_total_guias: number
  valor_completas: number
  valor_processado: number
  valor_total_faturado: number
  valor_total_pago: number
  valor_total_glosado: number
  lotes_abertos: number
}

export interface GuiaStatusCount {
  count: number
  valor: number
}

export interface LoteStatusCount {
  count: number
  valor: number
}

export interface ReportData {
  // Guias
  total_guias: number
  valor_total_guias: number
  guias_por_status: Record<string, GuiaStatusCount>
  guias_sem_lote: number
  valor_guias_sem_lote: number
  guias_canceladas: number

  // Lotes
  total_lotes: number
  valor_total_lotes: number
  lotes_por_status: Record<string, LoteStatusCount>

  // Financeiro (cobrancas)
  total_cobrado: number
  total_pago: number
  total_glosado: number
  a_receber: number
  total_cobrancas: number
  cobrancas_pagas: number
}

export interface ApiError {
  error: string
  details?: string
}

export interface PaginatedResponse<T> {
  data: T[]
  count: number
  page: number
  pageSize: number
}

export interface Integracao {
  id: string
  slug: string
  nome: string
  config: Record<string, string>
  ativo: boolean
  updated_by: string | null
  created_at: string
  updated_at: string
}

export interface SawConfig {
  api_url: string
  login_url: string
  usuario: string
  senha: string
  cookie_key: string
}

export interface SawCredentials {
  id: string
  user_id: string
  usuario: string
  senha: string
  login_url: string
  ativo: boolean
  created_at: string
  updated_at: string
}

export interface CproConfig {
  api_url: string
  api_key: string
  company: string
}

export interface SawXmlProcedimento {
  sequencialItem: number
  dataExecucao: string
  horaInicial: string
  horaFinal: string
  codigoTabela: string
  codigoProcedimento: string
  descricaoProcedimento: string
  quantidadeExecutada: number
  viaAcesso: string
  tecnicaUtilizada: string
  reducaoAcrescimo: string
  valorUnitario: string
  valorTotal: string
  equipeSadt: {
    grauPart: string
    cpfContratado: string
    nomeProf: string
    conselho: string
    numeroConselhoProfissional: string
    UF: string
    CBOS: string
  }
}

export interface SawXmlData {
  downloaded_at: string
  dadosSolicitante: {
    codigoPrestadorNaOperadora: string
    nomeContratadoSolicitante: string
    profissionalSolicitante: {
      nomeProfissional: string
      conselhoProfissional: string
      numeroConselhoProfissional: string
      UF: string
      CBOS: string
    }
  }
  dadosExecutante: {
    codigoPrestadorNaOperadora: string
    CNES: string
  }
  dadosAtendimento: {
    tipoAtendimento: string
    indicacaoAcidente: string
    tipoConsulta: string
    regimeAtendimento: string
  }
  procedimentosExecutados: SawXmlProcedimento[]
  valorTotal: {
    valorProcedimentos: string
    valorTotalGeral: string
  }
}

export interface ImportLog {
  timestamp: string
  type: 'info' | 'success' | 'error' | 'processing'
  message: string
  guide_number?: string
}
