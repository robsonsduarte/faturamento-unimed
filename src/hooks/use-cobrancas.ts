import { useQuery } from '@tanstack/react-query'
import { getCobrancas, getCobrancasResumo, type CobrancaFilters } from '@/lib/services/cobrancas'

export function useCobrancas(filters: CobrancaFilters = {}) {
  return useQuery({
    queryKey: ['cobrancas', filters],
    queryFn: () => getCobrancas(filters),
  })
}

export function useCobrancasResumo(mes?: string) {
  return useQuery({
    queryKey: ['cobrancas', 'resumo', mes ?? 'todos'],
    queryFn: () => getCobrancasResumo(mes),
  })
}
