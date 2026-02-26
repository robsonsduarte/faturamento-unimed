import { z } from 'zod'

export const loteCreateSchema = z.object({
  numero_lote: z.string().min(1, 'Numero do lote obrigatorio'),
  tipo: z.enum(['Local', 'Externo']),
  referencia: z.string().optional(),
  guia_ids: z.array(z.string().uuid()).min(1, 'Selecione ao menos uma guia'),
  observacoes: z.string().optional(),
})

export type LoteCreateInput = z.infer<typeof loteCreateSchema>

export const loteStatusSchema = z
  .object({
    status: z.enum(['rascunho', 'gerado', 'enviado', 'aceito', 'processado', 'faturado', 'glosado', 'pago']),
    observacoes: z.string().optional(),
    numero_fatura: z.string().min(1, 'Numero da fatura obrigatorio').optional(),
  })
  .superRefine((data, ctx) => {
    if (data.status === 'faturado' && !data.numero_fatura) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['numero_fatura'],
        message: 'numero_fatura e obrigatorio quando status e faturado',
      })
    }
  })

export type LoteStatusInput = z.infer<typeof loteStatusSchema>
