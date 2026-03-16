import { z } from 'zod'

export const userInviteSchema = z.object({
  email: z.string().email('Email invalido'),
  full_name: z.string().min(2, 'Nome deve ter pelo menos 2 caracteres'),
  password: z.string().min(8, 'Senha deve ter pelo menos 8 caracteres'),
  role: z.enum(['admin', 'operador', 'visualizador']).default('visualizador'),
})

export type UserInviteInput = z.infer<typeof userInviteSchema>
