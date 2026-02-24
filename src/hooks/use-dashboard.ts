import { useQuery } from '@tanstack/react-query'
import { getDashboardKPIs } from '@/lib/services/dashboard'

export function useDashboardKPIs() {
  return useQuery({
    queryKey: ['dashboard', 'kpis'],
    queryFn: getDashboardKPIs,
    staleTime: 30 * 1000,
  })
}
