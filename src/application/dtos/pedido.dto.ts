import { z } from 'zod';
import { CANAIS_PEDIDO, FORMAS_PAGAMENTO, STATUS_PEDIDO } from '../../domain/enums';
import { enumMsg, idParam } from './common.dto';
import { paginationQuery } from '../utils/pagination';

export const criarPedidoSchema = z.object({
  body: z.object({
    canalPedido: z.enum(CANAIS_PEDIDO, enumMsg(CANAIS_PEDIDO)),
    unidadeId: z.number({ error: 'Campo obrigatório.' }).int().positive(),
    itens: z
      .array(
        z.object({
          produtoId: z.number({ error: 'Campo obrigatório.' }).int().positive(),
          quantidade: z.number({ error: 'Campo obrigatório.' }).int().min(1, { error: 'Mínimo 1.' }),
        }),
        { error: 'Campo obrigatório. Informe ao menos um item.' },
      )
      .min(1, { error: 'Informe ao menos um item.' }),
    formaPagamento: z.enum(FORMAS_PAGAMENTO, enumMsg(FORMAS_PAGAMENTO)).default('MOCK'),
    observacao: z.string().trim().max(500).optional(),
    clienteId: z.number().int().positive().optional(),
  }),
});

export const listarPedidosSchema = z.object({
  query: z.object({
    ...paginationQuery,
    canalPedido: z.enum(CANAIS_PEDIDO, enumMsg(CANAIS_PEDIDO)).optional(),
    status: z.enum(STATUS_PEDIDO, enumMsg(STATUS_PEDIDO)).optional(),
    unidadeId: z.coerce.number().int().positive().optional(),
  }),
});

export const pedidoIdSchema = z.object({ params: idParam() });

export const atualizarStatusSchema = z.object({
  params: idParam(),
  body: z.object({
    status: z.enum(STATUS_PEDIDO, enumMsg(STATUS_PEDIDO)),
    motivo: z.string().trim().max(255).optional(),
  }),
});

export type CriarPedidoDTO = z.infer<typeof criarPedidoSchema>['body'];
export type ListarPedidosQuery = z.infer<typeof listarPedidosSchema>['query'];
export type AtualizarStatusDTO = z.infer<typeof atualizarStatusSchema>['body'];
