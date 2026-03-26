import { z } from 'zod'

export const capturarFotoSchema = z.object({
  guia_id: z.string().uuid('ID da guia invalido'),
  photo_base64: z.string().min(100, 'Foto invalida'),
})

export const resolverTokenSchema = z.object({
  guia_id: z.string().uuid('ID da guia invalido'),
})
