import { z } from 'zod';
import { booleanQuery, idParam } from './common.dto';

export const listarUnidadesSchema = z.object({
  query: z.object({
    cidade: z.string().optional(),
    ativa: booleanQuery.optional(),
  }),
});

export const unidadeIdSchema = z.object({ params: idParam() });

export type ListarUnidadesQuery = z.infer<typeof listarUnidadesSchema>['query'];
