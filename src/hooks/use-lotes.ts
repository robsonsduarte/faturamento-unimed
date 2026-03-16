import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getLotes, getLote, updateLoteStatus, type LoteFilters } from '@/lib/services/lotes'

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

export function useUpdateLoteStatus() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({
      id,
      status,
      numeroFatura,
    }: {
      id: string
      status: 'processado' | 'faturado'
      numeroFatura?: string
    }) => updateLoteStatus(id, status, numeroFatura),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lotes'] })
      queryClient.invalidateQueries({ queryKey: ['guias'] })
    },
  })
}
