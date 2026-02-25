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

function extractCpf(guia: Guia): string | null {
  const cpro = guia.cpro_data as Record<string, unknown> | null
  const prof = cpro?.profissional as Record<string, unknown> | null
  return typeof prof?.cpf === 'string' ? prof.cpf : null
}

function buildProcedimento(proc: Procedimento, index: number, cpfProfissional: string | null) {
  return {
    [ans('sequencialItem')]: index + 1,
    [ans('dataExecucao')]: proc.data_execucao,
    [ans('horaInicial')]: proc.hora_inicio,
    [ans('horaFinal')]: proc.hora_fim,
    [ans('procedimento')]: {
      [ans('codigoTabela')]: proc.codigo_tabela ?? '22',
      [ans('codigoProcedimento')]: proc.codigo_procedimento,
      [ans('descricaoProcedimento')]: proc.descricao,
    },
    [ans('quantidadeExecutada')]: proc.quantidade_executada,
    [ans('viaAcesso')]: proc.via_acesso ?? '1',
    [ans('tecnicaUtilizada')]: proc.tecnica_utilizada ?? '1',
    [ans('reducaoAcrescimo')]: proc.reducao_acrescimo?.toFixed(1) ?? '1.0',
    [ans('valorUnitario')]: proc.valor_unitario?.toFixed(2),
    [ans('valorTotal')]: proc.valor_total?.toFixed(2),
    [ans('equipeSadt')]: {
      [ans('grauPart')]: '12',
      [ans('codProfissional')]: {
        [ans('cpfContratado')]: cpfProfissional ?? '',
      },
      [ans('nomeProf')]: proc.nome_profissional ?? DEDICARE.NOME_PRESTADOR,
      [ans('conselho')]: proc.conselho ?? '09',
      [ans('numeroConselhoProfissional')]: proc.numero_conselho ?? '',
      [ans('UF')]: proc.uf ?? '29',
      [ans('CBOS')]: proc.cbos ?? '251510',
    },
  }
}

function buildGuia(guia: Guia) {
  const procedimentos = guia.procedimentos ?? []
  const cpf = extractCpf(guia)

  // Sum procedure values for valorTotal section
  const valorProcedimentos = procedimentos.reduce((sum, p) => sum + (p.valor_total ?? 0), 0)

  // Professional data from first procedure (for dadosSolicitante)
  const firstProc = procedimentos[0]

  return {
    [ans('guiaSP-SADT')]: {
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
        [ans('numeroCarteira')]: guia.numero_carteira,
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
          [ans('UF')]: firstProc?.uf ?? '29',
          [ans('CBOS')]: firstProc?.cbos ?? '251510',
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
        [ans('tipoAtendimento')]: guia.tipo_atendimento ?? '03',
        [ans('indicacaoAcidente')]: guia.indicacao_acidente ?? '9',
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
        [ans('valorTotalGeral')]: (guia.valor_total ?? valorProcedimentos).toFixed(2),
      },
    },
  }
}

export function gerarXmlTiss(lote: Lote): string {
  const guias = lote.guias ?? []
  const dataAtual = new Date().toISOString().split('T')[0]
  const horaAtual = new Date().toTimeString().slice(0, 8)

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
          'ans:guiasTISS': guias.map((g) => buildGuia(g)),
        },
      },
      'ans:epilogo': {
        'ans:hash': '',
      },
    },
  }

  const xml = builder.build(xmlObj) as string
  const hash = createHash('md5').update(xml).digest('hex')
  return xml.replace('<ans:hash></ans:hash>', `<ans:hash>${hash}</ans:hash>`)
}
