import { useQuery } from '@tanstack/react-query'
import { getDashboardKPIs } from '@/lib/services/dashboard'

export function useDashboardKPIs(mes?: string) {
  return useQuery({
    queryKey: ['dashboard', 'kpis', mes ?? 'todos'],
    queryFn: () => getDashboardKPIs(mes),
    staleTime: 30 * 1000,
  })
}
