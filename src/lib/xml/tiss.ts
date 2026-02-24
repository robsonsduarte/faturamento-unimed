import { XMLBuilder } from 'fast-xml-parser'
import { DEDICARE } from '@/lib/constants'
import type { Guia, Lote, Procedimento } from '@/lib/types'
import { createHash } from 'crypto'

const builder = new XMLBuilder({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  format: true,
  indentBy: '  ',
})

function buildProcedimento(proc: Procedimento, index: number) {
  return {
    sequencialItem: index + 1,
    dataExecucao: proc.data_execucao,
    horaInicial: proc.hora_inicio,
    horaFinal: proc.hora_fim,
    procedimento: {
      codigoTabela: proc.codigo_tabela ?? '22',
      codigoProcedimento: proc.codigo_procedimento,
      descricaoProcedimento: proc.descricao,
    },
    quantidadeExecutada: proc.quantidade_executada,
    reducaoAcrescimo: proc.reducao_acrescimo,
    valorUnitario: proc.valor_unitario?.toFixed(2),
    valorTotal: proc.valor_total?.toFixed(2),
    equipeSadt: {
      sequencialEquipe: 1,
      grauParticipacao: '00',
      codigoPrestadorNaOperadora: DEDICARE.CODIGO_PRESTADOR,
      nomeProf: proc.nome_profissional ?? DEDICARE.NOME_PRESTADOR,
      conselho: proc.conselho ?? 'CRFa',
      numeroConselho: proc.numero_conselho ?? '',
      UF: proc.uf ?? 'SP',
      CBOS: proc.cbos ?? '251510',
    },
  }
}

function buildGuia(guia: Guia, sequencial: number) {
  const procedimentos = guia.procedimentos ?? []
  return {
    guiaSP: {
      cabecalhoGuia: {
        registroANS: DEDICARE.REGISTRO_ANS,
        numeroGuiaPrestador: guia.guide_number_prestador ?? guia.guide_number,
        numeroGuiaOperadora: guia.guide_number,
        codigoPrestadorNaOperadora: DEDICARE.CODIGO_PRESTADOR,
        CNES: guia.cnes ?? DEDICARE.CNES,
        tipoAtendimento: guia.tipo_atendimento ?? '06',
        indicacaoAcidente: guia.indicacao_acidente ?? '9',
      },
      dadosBeneficiario: {
        numeroCarteira: guia.numero_carteira,
        atendimentoRN: 'N',
        nomeBeneficiario: guia.paciente,
      },
      dadosSolicitante: {
        codigoPrestadorNaOperadora: DEDICARE.CODIGO_PRESTADOR,
        nomePrestador: DEDICARE.NOME_PRESTADOR,
        CNES: DEDICARE.CNES,
      },
      dadosSolicitacao: {
        dataSolicitacao: guia.data_solicitacao ?? guia.data_autorizacao,
        indicacaoClinica: guia.indicacao_clinica ?? '',
      },
      dadosAutorizacao: {
        numeroGuiaOperadora: guia.guide_number,
        dataAutorizacao: guia.data_autorizacao,
        senha: guia.senha,
        dataValidadeSenha: guia.data_validade_senha,
      },
      procedimentosExecutados: {
        procedimentoExecutado: procedimentos.map((p, i) => buildProcedimento(p, i)),
      },
      valorTotal: {
        valorTotalGeral: guia.valor_total?.toFixed(2),
      },
      sequencialGuia: sequencial,
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
      '@_encoding': 'UTF-8',
    },
    'ans:mensagemTISS': {
      '@_xmlns:ans': 'http://www.ans.gov.br/padroes/tiss/schemas',
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
          'ans:guias': guias.map((g, i) => buildGuia(g, i + 1)),
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
