import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { getGuias, getGuia, updateGuiaStatus, type GuiaFilters } from '@/lib/services/guias'
import type { Guia } from '@/lib/types'

export function useGuias(filters: GuiaFilters = {}) {
  return useQuery({
    queryKey: ['guias', filters],
    queryFn: () => getGuias(filters),
  })
}

export function useGuia(id: string) {
  return useQuery({
    queryKey: ['guias', id],
    queryFn: () => getGuia(id),
    enabled: !!id,
  })
}

export function useUpdateGuiaStatus() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: Guia['status'] }) =>
      updateGuiaStatus(id, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['guias'] })
      toast.success('Status atualizado com sucesso')
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : 'Erro ao atualizar status')
    },
  })
}
