import { XMLBuilder } from 'fast-xml-parser'
import { DEDICARE } from '@/lib/constants'
import type { Guia, Lote, Procedimento } from '@/lib/types'
import { createHash } from 'crypto'

const builder = new XMLBuilder({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  format: true,
  indentBy: '    ',
})

/** Prefix helper — all TISS elements require the ans: namespace */
function ans(tag: string): string {
  return `ans:${tag}`
}

/** IBGE numeric codes for Brazilian states (required by TISS XSD) */
const UF_IBGE: Record<string, string> = {
  AC: '12', AL: '27', AM: '13', AP: '16', BA: '29',
  CE: '23', DF: '53', ES: '32', GO: '52', MA: '21',
  MG: '31', MS: '50', MT: '51', PA: '15', PB: '25',
  PE: '26', PI: '22', PR: '41', RJ: '33', RN: '24',
  RO: '11', RR: '14', RS: '43', SC: '42', SE: '28',
  SP: '35', TO: '17',
}

/** Normalize UF: accepts abbreviation (BA) or numeric (29), always returns numeric IBGE code */
function normalizeUf(uf: string | null | undefined): string {
  if (!uf) return '29' // Default: Bahia
  const trimmed = uf.trim()
  if (/^\d{2}$/.test(trimmed)) return trimmed
  return UF_IBGE[trimmed.toUpperCase()] ?? '29'
}

/** Normalize codigoTabela: data may store text description, TISS requires numeric code */
function normalizeCodigoTabela(codigo: string | null | undefined): string {
  if (!codigo) return '22' // Default: TUSS
  const trimmed = codigo.trim()
  if (/^\d{2}$/.test(trimmed)) return trimmed
  // Map known text descriptions to numeric codes
  const lower = trimmed.toLowerCase()
  if (lower.includes('tuss') || lower.includes('procedimento') || lower.includes('evento')) return '22'
  if (lower.includes('material') || lower.includes('opme')) return '18'
  if (lower.includes('diaria') || lower.includes('taxa')) return '19'
  if (lower.includes('medicamento')) return '20'
  return '22' // Fallback: TUSS
}

/** Normalize CBOS: SAW may store text description, TISS requires numeric CBO-S code */
function normalizeCbos(cbos: string | null | undefined, fallback = '251510'): string {
  if (!cbos) return fallback
  const trimmed = cbos.trim()
  if (/^\d{4,6}$/.test(trimmed)) return trimmed
  const lower = trimmed.toLowerCase()
  if (lower.includes('psicopedagog')) return '239425'
  if (lower.includes('psicanalista')) return '251545'
  if (lower.includes('psicomotric')) return '239440'
  if (lower.includes('logo cl') || lower.includes('psicologo') || lower.includes('psicólogo')) return '251510'
  if (lower.includes('fonoaudi')) return '223810'
  if (lower.includes('nutri')) return '223505'
  if (lower.includes('terapeuta ocup')) return '223905'
  if (lower.includes('fisioterapeut')) return '223605'
  return fallback
}

/** Normalize tipoAtendimento: SAW may store text, TISS requires numeric code (Tabela 50) */
function normalizeTipoAtendimento(valor: string | null | undefined): string {
  if (!valor) return '03' // Default: Outras Terapias (contexto clínica terapêutica)
  const trimmed = valor.trim()
  if (/^\d{2}$/.test(trimmed)) return trimmed
  const lower = trimmed.toLowerCase()
  if (lower.includes('remoção') || lower.includes('remocao')) return '01'
  if (lower.includes('outras despesas')) return '02'
  if (lower.includes('consulta')) return '03'
  if (lower.includes('exame')) return '04'
  if (lower.includes('atendimento domiciliar') || lower.includes('domiciliar')) return '05'
  if (lower.includes('internação') || lower.includes('internacao')) return '06'
  if (lower.includes('quimioterapia')) return '07'
  if (lower.includes('radioterapia')) return '08'
  if (lower.includes('trs') || lower.includes('renal substitutiva')) return '09'
  if (lower.includes('pronto socorro') || lower.includes('urgência') || lower.includes('urgencia')) return '10'
  if (lower.includes('pequena cirurgia')) return '11'
  if (lower.includes('saúde ocupacional') || lower.includes('saude ocupacional')) return '12'
  if (lower.includes('sadt internado')) return '13'
  if (lower.includes('hospital dia') || lower.includes('hospital-dia')) return '14'
  if (lower.includes('terapia') || lower.includes('outras terapias')) return '03'
  return '03' // Fallback: Outras Terapias
}

/** Normalize indicacaoAcidente: SAW may store text, TISS requires numeric code (0-2,9) */
function normalizeIndicacaoAcidente(valor: string | null | undefined): string {
  if (!valor) return '9'
  const trimmed = valor.trim()
  if (/^\d$/.test(trimmed)) return trimmed
  const lower = trimmed.toLowerCase()
  if (lower.includes('trabalho')) return '0'
  if (lower.includes('trânsito') || lower.includes('transito')) return '1'
  if (lower.includes('não acidente') || lower.includes('nao acidente')) return '9'
  return '9' // Default: Não acidente (contexto clínica terapêutica)
}

function extractCpf(guia: Guia): string | null {
  const cpro = guia.cpro_data as Record<string, unknown> | null
  const prof = cpro?.profissional as Record<string, unknown> | null
  return typeof prof?.cpf === 'string' ? prof.cpf : null
}

function buildProcedimento(proc: Procedimento, index: number, cpfProfissional: string | null) {
  // XSD order: sequencialItem → dataExecucao → horaInicial → horaFinal → procedimento →
  // quantidadeExecutada → viaAcesso → tecnicaUtilizada → reducaoAcrescimo → valorUnitario →
  // valorTotal → equipeSadt
  return {
    [ans('sequencialItem')]: index + 1,
    [ans('dataExecucao')]: proc.data_execucao,
    [ans('horaInicial')]: proc.hora_inicio,
    [ans('horaFinal')]: proc.hora_fim,
    [ans('procedimento')]: {
      [ans('codigoTabela')]: normalizeCodigoTabela(proc.codigo_tabela),
      [ans('codigoProcedimento')]: proc.codigo_procedimento,
      [ans('descricaoProcedimento')]: proc.descricao,
    },
    [ans('quantidadeExecutada')]: proc.quantidade_executada,
    [ans('viaAcesso')]: proc.via_acesso ?? '1',
    [ans('tecnicaUtilizada')]: proc.tecnica_utilizada ?? '1',
    [ans('reducaoAcrescimo')]: proc.reducao_acrescimo?.toFixed(1) ?? '1.0',
    [ans('valorUnitario')]: (proc.valor_unitario ?? 0).toFixed(2),
    [ans('valorTotal')]: (proc.valor_total ?? 0).toFixed(2),
    [ans('equipeSadt')]: {
      [ans('grauPart')]: '12',
      [ans('codProfissional')]: {
        [ans('cpfContratado')]: cpfProfissional ?? '',
      },
      [ans('nomeProf')]: proc.nome_profissional ?? DEDICARE.NOME_PRESTADOR,
      [ans('conselho')]: proc.conselho ?? '09',
      [ans('numeroConselhoProfissional')]: proc.numero_conselho ?? '',
      [ans('UF')]: normalizeUf(proc.uf),
      [ans('CBOS')]: normalizeCbos(proc.cbos),
    },
  }
}

/** Returns the INNER content of a guiaSP-SADT (without the wrapper tag) */
function buildGuiaContent(guia: Guia) {
  const procedimentos = guia.procedimentos ?? []
  const cpf = extractCpf(guia)

  // Sum procedure values for valorTotal section
  const valorProcedimentos = procedimentos.reduce((sum, p) => sum + (p.valor_total ?? 0), 0)

  // Professional data from first procedure (for dadosSolicitante)
  const firstProc = procedimentos[0]

  return {
    [ans('cabecalhoGuia')]: {
      [ans('registroANS')]: DEDICARE.REGISTRO_ANS,
      [ans('numeroGuiaPrestador')]: guia.guide_number_prestador ?? guia.guide_number,
    },
    [ans('dadosAutorizacao')]: {
      [ans('numeroGuiaOperadora')]: guia.guide_number,
      [ans('dataAutorizacao')]: guia.data_autorizacao,
      [ans('senha')]: guia.senha,
      [ans('dataValidadeSenha')]: guia.data_validade_senha,
    },
    [ans('dadosBeneficiario')]: {
      [ans('numeroCarteira')]: (guia.numero_carteira ?? '').padStart(17, '0'),
      [ans('atendimentoRN')]: 'N',
    },
    [ans('dadosSolicitante')]: {
      [ans('contratadoSolicitante')]: {
        [ans('codigoPrestadorNaOperadora')]: DEDICARE.CODIGO_PRESTADOR,
      },
      [ans('nomeContratadoSolicitante')]: DEDICARE.NOME_PRESTADOR,
      [ans('profissionalSolicitante')]: {
        [ans('nomeProfissional')]: firstProc?.nome_profissional ?? guia.nome_profissional ?? '',
        [ans('conselhoProfissional')]: firstProc?.conselho ?? '09',
        [ans('numeroConselhoProfissional')]: firstProc?.numero_conselho ?? '',
        [ans('UF')]: normalizeUf(firstProc?.uf),
        [ans('CBOS')]: normalizeCbos(firstProc?.cbos),
      },
    },
    [ans('dadosSolicitacao')]: {
      [ans('dataSolicitacao')]: guia.data_solicitacao ?? guia.data_autorizacao,
      [ans('caraterAtendimento')]: '1',
      [ans('indicacaoClinica')]: guia.indicacao_clinica ?? '',
    },
    [ans('dadosExecutante')]: {
      [ans('contratadoExecutante')]: {
        [ans('codigoPrestadorNaOperadora')]: DEDICARE.CODIGO_PRESTADOR,
      },
      [ans('CNES')]: guia.cnes ?? DEDICARE.CNES,
    },
    [ans('dadosAtendimento')]: {
      [ans('tipoAtendimento')]: normalizeTipoAtendimento(guia.tipo_atendimento),
      [ans('indicacaoAcidente')]: normalizeIndicacaoAcidente(guia.indicacao_acidente),
      [ans('tipoConsulta')]: '2',
      [ans('regimeAtendimento')]: '01',
    },
    [ans('procedimentosExecutados')]: {
      [ans('procedimentoExecutado')]: procedimentos.map((p, i) => buildProcedimento(p, i, cpf)),
    },
    [ans('valorTotal')]: {
      [ans('valorProcedimentos')]: valorProcedimentos.toFixed(2),
      [ans('valorDiarias')]: '0.00',
      [ans('valorTaxasAlugueis')]: '0.00',
      [ans('valorMateriais')]: '0.00',
      [ans('valorMedicamentos')]: '0.00',
      [ans('valorOPME')]: '0.00',
      [ans('valorGasesMedicinais')]: '0.00',
      [ans('valorTotalGeral')]: (guia.valor_total || valorProcedimentos).toFixed(2),
    },
  }
}

export function gerarXmlTiss(lote: Lote): string {
  const guias = (lote.guias ?? []).filter((g) => (g.procedimentos ?? []).length > 0)

  if (guias.length === 0) {
    throw new Error('Lote sem guias com procedimentos. Nao e possivel gerar XML TISS.')
  }

  const dataAtual = new Date().toISOString().split('T')[0]
  const horaAtual = new Date().toTimeString().slice(0, 8)

  // Build guia contents — each item becomes a <ans:guiaSP-SADT> inside a SINGLE <ans:guiasTISS>
  const guiasContent = guias.map((g) => buildGuiaContent(g))

  const xmlObj = {
    '?xml': {
      '@_version': '1.0',
      '@_encoding': 'ISO-8859-1',
      '@_standalone': 'yes',
    },
    'ans:mensagemTISS': {
      '@_xmlns:ans': 'http://www.ans.gov.br/padroes/tiss/schemas',
      '@_xmlns:ds': 'http://www.w3.org/2000/09/xmldsig#',
      'ans:cabecalho': {
        'ans:identificacaoTransacao': {
          'ans:tipoTransacao': 'ENVIO_LOTE_GUIAS',
          'ans:sequencialTransacao': lote.numero_lote,
          'ans:dataRegistroTransacao': dataAtual,
          'ans:horaRegistroTransacao': horaAtual,
        },
        'ans:origem': {
          'ans:identificacaoPrestador': {
            'ans:codigoPrestadorNaOperadora': DEDICARE.CODIGO_PRESTADOR,
          },
        },
        'ans:destino': {
          'ans:registroANS': DEDICARE.REGISTRO_ANS,
        },
        'ans:Padrao': DEDICARE.PADRAO_TISS,
      },
      'ans:prestadorParaOperadora': {
        'ans:loteGuias': {
          'ans:numeroLote': lote.numero_lote,
          'ans:guiasTISS': {
            'ans:guiaSP-SADT': guiasContent,
          },
        },
      },
      'ans:epilogo': {
        'ans:hash': '',
      },
    },
  }

  const xml = builder.build(xmlObj) as string

  // TISS hash = md5 of textContent (PHP DOMDocument::textContent)
  // Extract only text values between XML tags, ignoring whitespace-only nodes
  const textContent = (xml.match(/>[^<]+</g) ?? [])
    .map(s => s.slice(1, -1))
    .filter(s => s.trim() !== '')
    .join('')
  const hash = createHash('md5').update(textContent).digest('hex')

  return xml.replace('<ans:hash></ans:hash>', `<ans:hash>${hash}</ans:hash>`)
}
