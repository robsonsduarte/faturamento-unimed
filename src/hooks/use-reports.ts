import { useQuery } from '@tanstack/react-query'
import { getReportData } from '@/lib/services/reports'

export function useReportData() {
  return useQuery({
    queryKey: ['reports', 'data'],
    queryFn: getReportData,
    staleTime: 30 * 1000,
  })
}
