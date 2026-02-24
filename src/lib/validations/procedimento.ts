import { z } from 'zod'

export const procedimentoCreateSchema = z.object({
  sequencia: z.number().int().positive(),
  codigo_tabela: z.string().optional(),
  codigo_procedimento: z.string().min(1, 'Codigo obrigatorio'),
  descricao: z.string().optional(),
  data_execucao: z.string().min(1, 'Data de execucao obrigatoria'),
  hora_inicio: z.string().optional(),
  hora_fim: z.string().optional(),
  quantidade_executada: z.number().int().positive().default(1),
  via_acesso: z.string().optional(),
  tecnica_utilizada: z.string().optional(),
  reducao_acrescimo: z.number().default(1),
  valor_unitario: z.number().nonnegative().nullable().optional(),
  nome_profissional: z.string().optional(),
  conselho: z.string().optional(),
  numero_conselho: z.string().optional(),
  uf: z.string().max(2).optional(),
  cbos: z.string().optional(),
})

export type ProcedimentoCreateInput = z.infer<typeof procedimentoCreateSchema>

export const procedimentoUpdateSchema = procedimentoCreateSchema.partial().extend({
  status: z.enum(['Importado', 'Conferido', 'Faturado']).optional(),
})

export type ProcedimentoUpdateInput = z.infer<typeof procedimentoUpdateSchema>
