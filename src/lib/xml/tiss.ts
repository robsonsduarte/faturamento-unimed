import { XMLBuilder } from 'fast-xml-parser'
import { DEDICARE } from '@/lib/constants'
import type { Guia, Lote, Procedimento, SawXmlProcedimento } from '@/lib/types'
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

/** Sanitize text for TISS XML — remove accents and characters that Unimed rejects */
function sanitize(val: string | null | undefined): string {
  if (!val) return ''
  return val
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/&/g, 'E')
    .replace(/</g, '')
    .replace(/>/g, '')
    .replace(/"/g, '')
    .replace(/'/g, '')
}

/** Pad numeric TISS domain code to 2 digits with leading zero (e.g. "7" → "07") */
function padCode2(val: string | null | undefined, fallback: string): string {
  const v = val?.trim()
  if (!v) return fallback
  if (/^\d{1,2}$/.test(v)) return v.padStart(2, '0')
  return v
}

/** Fallback professional data for procedure equipeSadt */
interface ProfFallback {
  cpf: string
  nome: string
  conselho: string
  numeroConselho: string
  uf: string
  cbos: string
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
  const lower = trimmed.toLowerCase()
  if (lower.includes('tuss') || lower.includes('procedimento') || lower.includes('evento')) return '22'
  if (lower.includes('material') || lower.includes('opme')) return '18'
  if (lower.includes('diaria') || lower.includes('taxa')) return '19'
  if (lower.includes('medicamento')) return '20'
  return '22' // Fallback: TUSS
}

/** Normalize CBOS: SAW may store text description, TISS requires numeric CBO-S code.
 *  Codes sourced from app_occupations table (TISS/CBO-S standard). */
function normalizeCbos(cbos: string | null | undefined, fallback = '251510'): string {
  if (!cbos) return fallback
  const trimmed = cbos.trim()
  if (/^\d{4,6}$/.test(trimmed)) return trimmed
  const lower = trimmed.toLowerCase()
  if (lower.includes('musicoterapeut')) return '226305'
  if (lower.includes('neuropsicopedag')) return '239440'
  if (lower.includes('psicopedagog')) return '239425'
  if (lower.includes('psicanalista')) return '251550'
  if (lower.includes('neuropsic')) return '251545'
  if (lower.includes('psicomotric')) return '223915'
  if (lower.includes('logo cl') || lower.includes('psicologo') || lower.includes('psicólogo')) return '251510'
  if (lower.includes('fonoaudi')) return '223810'
  if (lower.includes('nutricionista') || lower.includes('nutri')) return '223710'
  if (lower.includes('terapeuta ocup')) return '223905'
  if (lower.includes('fisioterapeut')) return '223605'
  return fallback
}

/** Normalize tipoAtendimento: SAW stores text, Unimed expects SAW numeric codes */
function normalizeTipoAtendimento(valor: string | null | undefined): string {
  if (!valor) return '04' // Default: Consulta (contexto clinica terapeutica)
  const trimmed = valor.trim()
  if (/^\d{1,2}$/.test(trimmed)) return trimmed.padStart(2, '0')
  const lower = trimmed.toLowerCase()
  // SAW codes (from SAW dropdown, NOT standard TISS Tabela 50)
  if (lower.includes('remoção') || lower.includes('remocao')) return '01'
  if (lower.includes('pequena cirurgia')) return '02'
  if (lower.includes('outras terapias')) return '03'
  if (lower.includes('consulta')) return '04'
  if (lower.includes('quimioterapia')) return '08'
  if (lower.includes('radioterapia')) return '09'
  if (lower.includes('trs') || lower.includes('renal substitutiva')) return '10'
  if (lower.includes('pequeno atendimento') || lower.includes('sutura')) return '13'
  if (lower.includes('exame')) return '23'
  // Generic fallback: "terapia" without "quimio/radio/renal" → Outras Terapias
  if (lower.includes('terapia')) return '03'
  return '04'
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
  return '9'
}

/** Extract professional data from ConsultorioPro (cpro_data) — authoritative for equipe */
function extractCproProfissional(guia: Guia): {
  cpf: string | null
  nome: string | null
  conselho: string | null
  numeroConselho: string | null
  uf: string | null
  cbos: string | null
} {
  const cpro = guia.cpro_data as Record<string, unknown> | null
  const prof = cpro?.profissional as Record<string, unknown> | null
  return {
    cpf: typeof prof?.cpf === 'string' ? prof.cpf : null,
    nome: typeof prof?.nome === 'string' ? prof.nome : null,
    conselho: typeof prof?.conselho === 'string' ? prof.conselho : null,
    numeroConselho: typeof prof?.numeroConselho === 'string' ? prof.numeroConselho : null,
    uf: typeof prof?.uf === 'string' ? prof.uf : null,
    cbos: typeof prof?.cbos === 'string' ? prof.cbos : null,
  }
}

function buildEquipeSadt(
  cpf: string,
  nome: string,
  conselho: string,
  numeroConselho: string,
  uf: string,
  cbos: string,
) {
  // TISS requires cpfContratado to be 11 digits — use zeros as fallback for missing CPF
  const cpfNorm = cpf && cpf.trim().length >= 11 ? cpf.trim() : '00000000000'
  return {
    [ans('grauPart')]: '12',
    [ans('codProfissional')]: {
      [ans('cpfContratado')]: cpfNorm,
    },
    [ans('nomeProf')]: sanitize(nome) || 'NAO INFORMADO',
    [ans('conselho')]: padCode2(conselho, '09'),
    [ans('numeroConselhoProfissional')]: numeroConselho || '0',
    [ans('UF')]: normalizeUf(uf),
    [ans('CBOS')]: normalizeCbos(cbos),
  }
}

function buildProcedimento(proc: Procedimento, index: number, fb: ProfFallback, valorPerProc?: number) {
  return {
    [ans('sequencialItem')]: index + 1,
    [ans('dataExecucao')]: proc.data_execucao,
    [ans('horaInicial')]: proc.hora_inicio,
    [ans('horaFinal')]: proc.hora_fim,
    [ans('procedimento')]: {
      [ans('codigoTabela')]: normalizeCodigoTabela(proc.codigo_tabela),
      [ans('codigoProcedimento')]: proc.codigo_procedimento,
      [ans('descricaoProcedimento')]: sanitize(proc.descricao),
    },
    [ans('quantidadeExecutada')]: proc.quantidade_executada,
    [ans('viaAcesso')]: proc.via_acesso ?? '1',
    [ans('tecnicaUtilizada')]: proc.tecnica_utilizada ?? '1',
    [ans('reducaoAcrescimo')]: proc.reducao_acrescimo?.toFixed(1) ?? '1.0',
    [ans('valorUnitario')]: (proc.valor_unitario ?? valorPerProc ?? 0).toFixed(2),
    [ans('valorTotal')]: (proc.valor_total ?? valorPerProc ?? 0).toFixed(2),
    [ans('equipeSadt')]: buildEquipeSadt(
      proc.nome_profissional ? (fb.cpf) : fb.cpf,
      sanitize(proc.nome_profissional ?? fb.nome),
      proc.conselho ?? fb.conselho,
      proc.numero_conselho ?? fb.numeroConselho,
      proc.uf ?? fb.uf,
      proc.cbos ?? fb.cbos,
    ),
  }
}

/** Check if a string value is meaningful (not empty, not "0") */
function hasValue(v: string | null | undefined): boolean {
  if (!v) return false
  const trimmed = v.trim()
  return trimmed !== '' && trimmed !== '0' && trimmed !== '0.00'
}

/** Format a numeric value as decimal with 2 places (e.g. "30.36"), fallback to "0.00" */
function formatDecimal2(v: string | number | null | undefined, fallback: number = 0): string {
  if (typeof v === 'number') return v.toFixed(2)
  if (typeof v === 'string') {
    const n = parseFloat(v)
    if (!isNaN(n) && n > 0) return n.toFixed(2)
  }
  return fallback.toFixed(2)
}

/** Build a procedure entry from SAW XML data, merging with DB procedure for values */
function buildProcedimentoFromXml(
  proc: SawXmlProcedimento,
  index: number,
  fb: ProfFallback,
  dbProc?: Procedimento,
  valorPerProc?: number,
) {
  const eq = proc.equipeSadt

  // SAW XML is authoritative for structure; DB is authoritative for values
  // Fallback chain: SAW XML → DB procedure → guia.valor_total / proc_count
  const valorUnit = hasValue(proc.valorUnitario)
    ? proc.valorUnitario
    : formatDecimal2(dbProc?.valor_unitario, valorPerProc ?? 0)
  const valorTot = hasValue(proc.valorTotal)
    ? proc.valorTotal
    : formatDecimal2(dbProc?.valor_total, valorPerProc ?? 0)
  const reducao = hasValue(proc.reducaoAcrescimo)
    ? parseFloat(proc.reducaoAcrescimo).toFixed(1)
    : (dbProc?.reducao_acrescimo?.toFixed(1) ?? '1.0')

  return {
    [ans('sequencialItem')]: proc.sequencialItem > 0 ? proc.sequencialItem : index + 1,
    [ans('dataExecucao')]: proc.dataExecucao,
    [ans('horaInicial')]: proc.horaInicial,
    [ans('horaFinal')]: proc.horaFinal,
    [ans('procedimento')]: {
      [ans('codigoTabela')]: proc.codigoTabela,
      [ans('codigoProcedimento')]: proc.codigoProcedimento,
      [ans('descricaoProcedimento')]: sanitize(proc.descricaoProcedimento),
    },
    [ans('quantidadeExecutada')]: proc.quantidadeExecutada || 1,
    [ans('viaAcesso')]: proc.viaAcesso || '1',
    [ans('tecnicaUtilizada')]: proc.tecnicaUtilizada || '1',
    [ans('reducaoAcrescimo')]: reducao,
    [ans('valorUnitario')]: valorUnit,
    [ans('valorTotal')]: valorTot,
    // CPro is authoritative for equipe — SAW XML is fallback only
    [ans('equipeSadt')]: buildEquipeSadt(
      fb.cpf || eq.cpfContratado,
      sanitize(fb.nome || eq.nomeProf),
      fb.conselho || eq.conselho,
      fb.numeroConselho || eq.numeroConselhoProfissional,
      fb.uf || eq.UF,
      fb.cbos || eq.CBOS,
    ),
  }
}

/** Returns the INNER content of a guiaSP-SADT (without the wrapper tag) */
function buildGuiaContent(guia: Guia) {
  const xml = guia.saw_xml_data
  const procedimentos = guia.procedimentos ?? []
  const cproProfissional = extractCproProfissional(guia)

  // Professional data from first procedure (for dadosSolicitante + fallback)
  const firstProc = procedimentos[0]

  // Build professional data — CPro is authoritative, DB procedure is fallback
  const profFallback: ProfFallback = {
    cpf: cproProfissional.cpf ?? '',
    nome: cproProfissional.nome ?? firstProc?.nome_profissional ?? guia.nome_profissional ?? '',
    conselho: cproProfissional.conselho ?? firstProc?.conselho ?? '09',
    numeroConselho: cproProfissional.numeroConselho ?? firstProc?.numero_conselho ?? '',
    uf: cproProfissional.uf ?? firstProc?.uf ?? '',
    cbos: cproProfissional.cbos ?? firstProc?.cbos ?? '',
  }

  // Calculate per-procedure value from guia total when individual values are missing
  const xmlProcCount = xml?.procedimentosExecutados.length ?? 0
  const dbProcCount = procedimentos.length
  const procCount = xmlProcCount > 0 ? xmlProcCount : dbProcCount
  const valorPerProc = procCount > 0 && guia.valor_total > 0
    ? Math.round((guia.valor_total / procCount) * 100) / 100
    : 0

  // When saw_xml_data exists, use SAW XML structure merged with DB values
  const procsContent = xml && xmlProcCount > 0
    ? xml.procedimentosExecutados.map((p, i) => buildProcedimentoFromXml(p, i, profFallback, procedimentos[i], valorPerProc))
    : procedimentos.map((p, i) => buildProcedimento(p, i, profFallback, valorPerProc))

  // Sum procedure values for valorTotal section — prefer DB values, fallback to guia total
  const dbValorSum = procedimentos.reduce((sum, p) => sum + (p.valor_total ?? 0), 0)
  const valorProcedimentos = dbValorSum > 0 ? dbValorSum : (guia.valor_total ?? 0)

  // Resolve solicitante professional fields — saw_xml_data with padding, then fallback
  const solNome = xml?.dadosSolicitante.profissionalSolicitante.nomeProfissional || profFallback.nome
  const solConselho = padCode2(
    xml?.dadosSolicitante.profissionalSolicitante.conselhoProfissional || profFallback.conselho,
    '09',
  )
  const solNumero = xml?.dadosSolicitante.profissionalSolicitante.numeroConselhoProfissional || profFallback.numeroConselho
  const solUf = normalizeUf(xml?.dadosSolicitante.profissionalSolicitante.UF || profFallback.uf)
  const solCbos = normalizeCbos(xml?.dadosSolicitante.profissionalSolicitante.CBOS || profFallback.cbos)

  // Resolve dadosAtendimento — saw_xml_data with padding, then fallback
  // Use hasValue() to skip SAW XML "0" placeholder values
  const xmlTipoAtend = hasValue(xml?.dadosAtendimento.tipoAtendimento) ? xml!.dadosAtendimento.tipoAtendimento : null
  const tipoAtend = padCode2(xmlTipoAtend, normalizeTipoAtendimento(guia.tipo_atendimento))
  const indAcidente = xml?.dadosAtendimento.indicacaoAcidente || normalizeIndicacaoAcidente(guia.indicacao_acidente)
  const tipoConsulta = xml?.dadosAtendimento.tipoConsulta || '2'
  const xmlRegime = hasValue(xml?.dadosAtendimento.regimeAtendimento) ? xml!.dadosAtendimento.regimeAtendimento : null
  const regimeAtend = padCode2(xmlRegime, '01')

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
        [ans('nomeProfissional')]: sanitize(solNome),
        [ans('conselhoProfissional')]: solConselho,
        [ans('numeroConselhoProfissional')]: solNumero,
        [ans('UF')]: solUf,
        [ans('CBOS')]: solCbos,
      },
    },
    [ans('dadosSolicitacao')]: {
      [ans('dataSolicitacao')]: guia.data_solicitacao ?? guia.data_autorizacao,
      [ans('caraterAtendimento')]: '1',
      [ans('indicacaoClinica')]: sanitize(guia.indicacao_clinica),
    },
    [ans('dadosExecutante')]: {
      [ans('contratadoExecutante')]: {
        [ans('codigoPrestadorNaOperadora')]: DEDICARE.CODIGO_PRESTADOR,
      },
      [ans('CNES')]: DEDICARE.CNES,
    },
    [ans('dadosAtendimento')]: {
      [ans('tipoAtendimento')]: tipoAtend,
      [ans('indicacaoAcidente')]: indAcidente,
      [ans('tipoConsulta')]: tipoConsulta,
      [ans('regimeAtendimento')]: regimeAtend,
    },
    [ans('procedimentosExecutados')]: {
      [ans('procedimentoExecutado')]: procsContent,
    },
    [ans('valorTotal')]: {
      [ans('valorProcedimentos')]: hasValue(xml?.valorTotal.valorProcedimentos)
        ? xml!.valorTotal.valorProcedimentos
        : (valorProcedimentos ?? 0).toFixed(2),
      [ans('valorDiarias')]: '0.00',
      [ans('valorTaxasAlugueis')]: '0.00',
      [ans('valorMateriais')]: '0.00',
      [ans('valorMedicamentos')]: '0.00',
      [ans('valorOPME')]: '0.00',
      [ans('valorGasesMedicinais')]: '0.00',
      [ans('valorTotalGeral')]: hasValue(xml?.valorTotal.valorTotalGeral)
        ? xml!.valorTotal.valorTotalGeral
        : (guia.valor_total ?? valorProcedimentos ?? 0).toFixed(2),
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
  // Decode XML entities to match PHP behavior (e.g. &amp; → &)
  const textContent = (xml.match(/>[^<]+</g) ?? [])
    .map(s => s.slice(1, -1))
    .filter(s => s.trim() !== '')
    .join('')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
  const hash = createHash('md5').update(textContent).digest('hex')

  return xml.replace('<ans:hash></ans:hash>', `<ans:hash>${hash}</ans:hash>`)
}
