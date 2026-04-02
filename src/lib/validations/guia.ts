import { z } from 'zod'

export const guiaUpdateSchema = z.object({
  guide_number_prestador: z.string().optional(),
  status: z
    .enum(['PENDENTE', 'CPRO', 'TOKEN', 'COMPLETA', 'PROCESSADA', 'FATURADA'])
    .optional(),
  paciente: z.string().optional(),
  numero_carteira: z.string().optional(),
  senha: z.string().optional(),
  data_autorizacao: z.string().nullable().optional(),
  data_validade_senha: z.string().nullable().optional(),
  quantidade_solicitada: z.number().int().positive().nullable().optional(),
  quantidade_autorizada: z.number().int().positive().nullable().optional(),
  nome_profissional: z.string().optional(),
  indicacao_clinica: z.string().optional(),
  tipo_atendimento: z.string().optional(),
  indicacao_acidente: z.string().optional(),
  lote_id: z.string().uuid().nullable().optional(),
  mes_referencia: z.string().regex(/^\d{4}-\d{2}$/).optional(),
})

export type GuiaUpdateInput = z.infer<typeof guiaUpdateSchema>

export const guiaStatusSchema = z.object({
  status: z.enum([
    'PENDENTE',
    'CPRO',
    'TOKEN',
    'COMPLETA',
    'PROCESSADA',
    'FATURADA',
  ]),
})

export type GuiaStatusInput = z.infer<typeof guiaStatusSchema>

export const guiaImportarSchema = z.object({
  guide_numbers: z.array(z.string()).min(1).optional(),
  periodo_inicio: z.string().optional(),
  periodo_fim: z.string().optional(),
})

export type GuiaImportarInput = z.infer<typeof guiaImportarSchema>
