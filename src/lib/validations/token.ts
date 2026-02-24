import { z } from 'zod'

export const tokenValidarSchema = z.object({
  guia_id: z.string().uuid('ID da guia invalido'),
  token: z.string().min(1, 'Token obrigatorio'),
  paciente_nome: z.string().min(1, 'Nome do paciente obrigatorio'),
  numero_carteira: z.string().min(1, 'Numero da carteira obrigatorio'),
})

export type TokenValidarInput = z.infer<typeof tokenValidarSchema>
