import { z } from 'zod';
import { TIPOS_MOV_ESTOQUE } from '../../domain/enums';
import { enumMsg, idParam } from './common.dto';

export const estoqueUnidadeSchema = z.object({ params: idParam('unidadeId') });

export const movimentacaoEstoqueSchema = z.object({
  body: z
    .object({
      produtoId: z.number({ error: 'Campo obrigatório.' }).int().positive(),
      unidadeId: z.number({ error: 'Campo obrigatório.' }).int().positive(),
      tipo: z.enum(TIPOS_MOV_ESTOQUE, enumMsg(TIPOS_MOV_ESTOQUE)),
      quantidade: z.number({ error: 'Campo obrigatório.' }).int().min(0),
      motivo: z.string().trim().max(255).optional(),
    })
    .refine((b) => b.tipo === 'AJUSTE' || b.quantidade > 0, {
      error: 'Para ENTRADA/SAIDA a quantidade deve ser maior que zero.',
      path: ['quantidade'],
    }),
});

export type MovimentacaoEstoqueDTO = z.infer<typeof movimentacaoEstoqueSchema>['body'];
