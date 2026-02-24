import { useQuery } from '@tanstack/react-query'
import { getLotes, getLote, type LoteFilters } from '@/lib/services/lotes'

export function useLotes(filters: LoteFilters = {}) {
  return useQuery({
    queryKey: ['lotes', filters],
    queryFn: () => getLotes(filters),
  })
}

export function useLote(id: string) {
  return useQuery({
    queryKey: ['lotes', id],
    queryFn: () => getLote(id),
    enabled: !!id,
  })
}
