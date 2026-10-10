import { z } from 'zod';
import { paginationQuery } from '../utils/pagination';

export const listarAuditoriaSchema = z.object({
  query: z.object({
    ...paginationQuery,
    recurso: z.string().optional(),
    recursoId: z.coerce.number().int().positive().optional(),
    acao: z.string().optional(),
    usuarioId: z.coerce.number().int().positive().optional(),
  }),
});

export type ListarAuditoriaQuery = z.infer<typeof listarAuditoriaSchema>['query'];
