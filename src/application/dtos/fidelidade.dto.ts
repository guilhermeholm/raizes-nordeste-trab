import { z } from 'zod';
import { paginationQuery } from '../utils/pagination';

export const acumularPontosSchema = z.object({
  body: z.object({ pedidoId: z.number({ error: 'Campo obrigatório.' }).int().positive() }),
});

export const resgatarPontosSchema = z.object({
  body: z.object({
    pontos: z.number({ error: 'Campo obrigatório.' }).int().positive({ error: 'Deve ser maior que zero.' }),
    descricao: z.string().trim().max(255).default('Resgate para desconto'),
  }),
});

export const historicoFidelidadeSchema = z.object({
  query: z.object({ ...paginationQuery, limit: paginationQuery.limit.default(20) }),
});

export const consentimentoFidelidadeSchema = z.object({
  body: z.object({ consentimento: z.boolean({ error: 'Campo obrigatório (true/false).' }) }),
});

export type ResgatarPontosDTO = z.infer<typeof resgatarPontosSchema>['body'];
