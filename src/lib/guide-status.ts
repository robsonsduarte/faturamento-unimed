import type { GuideStatus } from '@/lib/constants'

/**
 * Computes guide status based on SAW + CPro data.
 *
 * Rules (em ordem de prioridade):
 *   CANCELADA — SAW status contains "CANCELADA"
 *   NEGADA    — SAW status contains "NEGADA"
 *   TOKEN     — tokenMessage = "Realize o check-in do Paciente" E CPro ainda nao cadastrou nada
 *   CPRO      — guia nao encontrada no ConsultorioPro (cadastrados null/0)
 *   COMPLETA  — qtd_cadastrada == qtd_realizada OR qtd_autorizada == qtd_realizada
 *   PENDENTE  — tem senha + data_autorizacao mas realizados < cadastrados
 *   TOKEN     — fallback (nenhuma condicao acima)
 */
export function computeGuideStatus(
  procedimentosCadastrados: number | null,
  procedimentosRealizados: number,
  quantidadeAutorizada: number | null,
  tokenMessage: string,
  senha: string | null,
  dataAutorizacao: string | null,
  sawStatus?: string | null
): GuideStatus {
  // 0a. CANCELADA — guia cancelada no SAW (prioridade maxima)
  if (sawStatus && sawStatus.toUpperCase().includes('CANCELADA')) {
    return 'CANCELADA'
  }

  // 0b. NEGADA — guia negada pela operadora no SAW
  if (sawStatus && sawStatus.toUpperCase().includes('NEGADA')) {
    return 'NEGADA'
  }

  // 1. TOKEN — paciente precisa fazer check-in biometrico
  //    Porem, se CPro ja tem procedimentos cadastrados, nao travar em TOKEN
  if (tokenMessage === 'Realize o check-in do Paciente') {
    if (procedimentosCadastrados == null || procedimentosCadastrados === 0) {
      return 'TOKEN'
    }
    // Com CPro, cai para as verificacoes COMPLETA/PENDENTE abaixo
  }

  // 2. CPRO — guia nao encontrada no ConsultorioPro
  //    Se CPro nao retornou dados, status e CPRO independente de qtd autorizada/realizada
  if (procedimentosCadastrados == null || procedimentosCadastrados === 0) {
    return 'CPRO'
  }

  // 3. COMPLETA — qtd cadastrada == realizada OU qtd autorizada == realizada
  if (procedimentosRealizados === procedimentosCadastrados) {
    return 'COMPLETA'
  }

  const completaByAutorizada =
    quantidadeAutorizada != null &&
    quantidadeAutorizada > 0 &&
    procedimentosRealizados === quantidadeAutorizada

  if (completaByAutorizada) {
    return 'COMPLETA'
  }

  // 4. PENDENTE — tem autorizacao mas falta completar cobrancas
  if (senha && dataAutorizacao && procedimentosRealizados < procedimentosCadastrados) {
    return 'PENDENTE'
  }

  // 5. Fallback
  return 'TOKEN'
}
