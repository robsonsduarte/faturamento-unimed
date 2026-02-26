import { XMLParser } from 'fast-xml-parser'
import type { SawXmlData, SawXmlProcedimento } from '@/lib/types'

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  removeNSPrefix: true,
})

function str(v: unknown): string {
  if (v == null) return ''
  return String(v).trim()
}

function num(v: unknown): number {
  const n = Number(v)
  return isNaN(n) ? 0 : n
}

function asArray<T>(v: T | T[] | undefined | null): T[] {
  if (v == null) return []
  return Array.isArray(v) ? v : [v]
}

export function parseSawXml(xmlContent: string): SawXmlData {
  const parsed = parser.parse(xmlContent)

  // Navigate to the guia — XML do SAW individual tem uma unica guiaSP-SADT
  const msg = parsed.mensagemTISS
  const loteGuias = msg?.prestadorParaOperadora?.loteGuias
  const guiasTISS = loteGuias?.guiasTISS
  const guiaRaw = guiasTISS?.['guiaSP-SADT']

  // Pode ser objeto (1 guia) ou array (N guias) — pegar a primeira
  const guia = Array.isArray(guiaRaw) ? guiaRaw[0] : guiaRaw
  if (!guia) throw new Error('Nenhuma guiaSP-SADT encontrada no XML')

  const sol = guia.dadosSolicitante ?? {}
  const exec = guia.dadosExecutante ?? {}
  const atend = guia.dadosAtendimento ?? {}
  const valTotal = guia.valorTotal ?? {}

  // Procedimentos
  const procsRaw = asArray(guia.procedimentosExecutados?.procedimentoExecutado)

  const procedimentos: SawXmlProcedimento[] = procsRaw.map((p: Record<string, unknown>) => {
    const proc = p.procedimento as Record<string, unknown> | undefined
    const equipe = p.equipeSadt as Record<string, unknown> | undefined
    const codProf = equipe?.codProfissional as Record<string, unknown> | undefined

    return {
      sequencialItem: num(p.sequencialItem),
      dataExecucao: str(p.dataExecucao),
      horaInicial: str(p.horaInicial),
      horaFinal: str(p.horaFinal),
      codigoTabela: str(proc?.codigoTabela),
      codigoProcedimento: str(proc?.codigoProcedimento),
      descricaoProcedimento: str(proc?.descricaoProcedimento),
      quantidadeExecutada: num(p.quantidadeExecutada),
      viaAcesso: str(p.viaAcesso),
      tecnicaUtilizada: str(p.tecnicaUtilizada),
      reducaoAcrescimo: str(p.reducaoAcrescimo),
      valorUnitario: str(p.valorUnitario),
      valorTotal: str(p.valorTotal),
      equipeSadt: {
        grauPart: str(equipe?.grauPart),
        cpfContratado: str(codProf?.cpfContratado),
        nomeProf: str(equipe?.nomeProf),
        conselho: str(equipe?.conselho),
        numeroConselhoProfissional: str(equipe?.numeroConselhoProfissional),
        UF: str(equipe?.UF),
        CBOS: str(equipe?.CBOS),
      },
    }
  })

  const profSol = sol.profissionalSolicitante ?? {}

  return {
    downloaded_at: new Date().toISOString(),
    dadosSolicitante: {
      codigoPrestadorNaOperadora: str(sol.contratadoSolicitante?.codigoPrestadorNaOperadora),
      nomeContratadoSolicitante: str(sol.nomeContratadoSolicitante),
      profissionalSolicitante: {
        nomeProfissional: str(profSol.nomeProfissional),
        conselhoProfissional: str(profSol.conselhoProfissional),
        numeroConselhoProfissional: str(profSol.numeroConselhoProfissional),
        UF: str(profSol.UF),
        CBOS: str(profSol.CBOS),
      },
    },
    dadosExecutante: {
      codigoPrestadorNaOperadora: str(exec.contratadoExecutante?.codigoPrestadorNaOperadora),
      CNES: str(exec.CNES),
    },
    dadosAtendimento: {
      tipoAtendimento: str(atend.tipoAtendimento),
      indicacaoAcidente: str(atend.indicacaoAcidente),
      tipoConsulta: str(atend.tipoConsulta),
      regimeAtendimento: str(atend.regimeAtendimento),
    },
    procedimentosExecutados: procedimentos,
    valorTotal: {
      valorProcedimentos: str(valTotal.valorProcedimentos),
      valorTotalGeral: str(valTotal.valorTotalGeral),
    },
  }
}
