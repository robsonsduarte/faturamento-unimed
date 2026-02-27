import { useQuery } from '@tanstack/react-query'
import { getReportData } from '@/lib/services/reports'

export function useReportData(mes?: string) {
  return useQuery({
    queryKey: ['reports', 'data', mes ?? 'todos'],
    queryFn: () => getReportData(mes),
    staleTime: 30 * 1000,
  })
}
