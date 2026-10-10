import { z } from 'zod';

export const loginSchema = z.object({
  body: z.object({
    email: z.email({ error: 'E-mail inválido.' }),
    senha: z.string({ error: 'Campo obrigatório.' }).min(1, { error: 'Campo obrigatório.' }),
  }),
});

export type LoginDTO = z.infer<typeof loginSchema>['body'];
