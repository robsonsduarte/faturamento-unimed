import type { GuideStatus } from '@/lib/constants'

/**
 * Computes guide status based on SAW + CPro data.
 *
 * Rules:
 *   TOKEN     — campo senha = "Realize o check-in do Paciente"
 *   COMPLETA  — qtd_cadastrada == qtd_realizada OR qtd_autorizada == qtd_realizada
 *   CPRO      — guia nao encontrada no ConsultorioPro (cadastrados null/0)
 *   PENDENTE  — tem senha + data_autorizacao mas realizados < cadastrados
 *   TOKEN     — fallback (nenhuma condicao acima)
 */
export function computeGuideStatus(
  procedimentosCadastrados: number | null,
  procedimentosRealizados: number,
  quantidadeAutorizada: number | null,
  tokenMessage: string,
  senha: string | null,
  dataAutorizacao: string | null
): GuideStatus {
  // 1. TOKEN — paciente precisa fazer check-in biometrico
  if (tokenMessage === 'Realize o check-in do Paciente') {
    return 'TOKEN'
  }

  // 2. COMPLETA — qtd cadastrada == realizada OU qtd autorizada == realizada
  const completaByCpro =
    procedimentosCadastrados != null &&
    procedimentosCadastrados > 0 &&
    procedimentosRealizados === procedimentosCadastrados

  const completaByAutorizada =
    quantidadeAutorizada != null &&
    quantidadeAutorizada > 0 &&
    procedimentosRealizados === quantidadeAutorizada

  if (completaByCpro || completaByAutorizada) {
    return 'COMPLETA'
  }

  // 3. CPRO — guia nao encontrada no ConsultorioPro
  if (procedimentosCadastrados == null || procedimentosCadastrados === 0) {
    return 'CPRO'
  }

  // 4. PENDENTE — tem autorizacao mas falta completar cobrancas
  if (senha && dataAutorizacao && procedimentosRealizados < procedimentosCadastrados) {
    return 'PENDENTE'
  }

  // 5. Fallback
  return 'TOKEN'
}
