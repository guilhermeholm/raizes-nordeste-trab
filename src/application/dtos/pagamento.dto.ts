import { z } from 'zod';
import { idParam } from './common.dto';

export const processarPagamentoSchema = z.object({
  body: z.object({
    pedidoId: z.number({ error: 'Campo obrigatório.' }).int().positive(),
    cenario: z.enum(['APROVAR', 'RECUSAR'], { error: 'Valores: APROVAR, RECUSAR' }).optional(),
  }),
});

export const pagamentoPedidoSchema = z.object({ params: idParam('pedidoId') });

export type ProcessarPagamentoDTO = z.infer<typeof processarPagamentoSchema>['body'];
