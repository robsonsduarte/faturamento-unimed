import { z } from 'zod'

export const loteCreateSchema = z.object({
  numero_lote: z.string().min(1, 'Numero do lote obrigatorio'),
  tipo: z.enum(['Local', 'Externo']),
  referencia: z.string().optional(),
  guia_ids: z.array(z.string().uuid()).min(1, 'Selecione ao menos uma guia'),
  observacoes: z.string().optional(),
})

export type LoteCreateInput = z.infer<typeof loteCreateSchema>

export const loteStatusSchema = z.object({
  status: z.enum(['rascunho', 'gerado', 'enviado', 'aceito', 'glosado', 'pago']),
  observacoes: z.string().optional(),
})

export type LoteStatusInput = z.infer<typeof loteStatusSchema>
