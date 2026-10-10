import { z } from 'zod';
import { booleanQuery, idParam } from './common.dto';
import { paginationQuery } from '../utils/pagination';

const produtoBody = z.object({
  nome: z.string({ error: 'Campo obrigatório.' }).trim().min(3, { error: 'Mínimo de 3 caracteres.' }),
  descricao: z.string().trim().optional(),
  categoria: z
    .string({ error: 'Campo obrigatório.' })
    .trim()
    .min(2)
    .transform((c) => c.toUpperCase()),
  preco: z.number({ error: 'Campo obrigatório (número).' }).positive({ error: 'Deve ser maior que zero.' }),
  sazonal: z.boolean().default(false),
  ativo: z.boolean().default(true),
  unidades: z.array(z.number().int().positive()).default([]),
});

export const criarProdutoSchema = z.object({ body: produtoBody });

export const atualizarProdutoSchema = z.object({
  params: idParam(),
  body: produtoBody
    .partial()
    .refine((b) => Object.keys(b).length > 0, { error: 'Informe ao menos um campo para atualizar.' }),
});

export const listarProdutosSchema = z.object({
  query: z.object({
    ...paginationQuery,
    categoria: z.string().optional(),
    ativo: booleanQuery.optional(),
  }),
});

export const cardapioUnidadeSchema = z.object({
  params: idParam('unidadeId'),
  query: z.object({ categoria: z.string().optional() }),
});

export type CriarProdutoDTO = z.infer<typeof criarProdutoSchema>['body'];
export type AtualizarProdutoDTO = z.infer<typeof atualizarProdutoSchema>['body'];
export type ListarProdutosQuery = z.infer<typeof listarProdutosSchema>['query'];
