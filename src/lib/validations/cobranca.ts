import { z } from 'zod'

export const cobrancaCreateSchema = z.object({
  guia_id: z.string().uuid().nullable().optional(),
  lote_id: z.string().uuid().nullable().optional(),
  tipo: z.enum(['normal', 'recurso_glosa', 'complementar']).default('normal'),
  valor_cobrado: z.number().positive().nullable().optional(),
  data_cobranca: z.string().optional(),
  observacoes: z.string().optional(),
})

export type CobrancaCreateInput = z.infer<typeof cobrancaCreateSchema>

export const cobrancaUpdateSchema = z.object({
  valor_pago: z.number().nonnegative().nullable().optional(),
  valor_glosado: z.number().nonnegative().nullable().optional(),
  motivo_glosa: z.string().nullable().optional(),
  data_pagamento: z.string().nullable().optional(),
  status: z
    .enum(['pendente', 'enviada', 'paga', 'glosada', 'recurso'])
    .optional(),
})

export type CobrancaUpdateInput = z.infer<typeof cobrancaUpdateSchema>
