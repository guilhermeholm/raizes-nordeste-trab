import { z } from 'zod';
import { PERFIS_USUARIO } from '../../domain/enums';
import { enumMsg, idParam } from './common.dto';
import { paginationQuery } from '../utils/pagination';

const senhaForte = z
  .string({ error: 'Campo obrigatório.' })
  .min(8, { error: 'A senha deve ter no mínimo 8 caracteres.' })
  .regex(/[A-Z]/, { error: 'A senha deve conter ao menos uma letra maiúscula.' })
  .regex(/[a-z]/, { error: 'A senha deve conter ao menos uma letra minúscula.' })
  .regex(/\d/, { error: 'A senha deve conter ao menos um número.' });

export const criarUsuarioSchema = z.object({
  body: z.object({
    nome: z.string({ error: 'Campo obrigatório.' }).trim().min(3, { error: 'Mínimo de 3 caracteres.' }),
    email: z.email({ error: 'E-mail inválido.' }).toLowerCase(),
    senha: senhaForte,
    telefone: z.string().regex(/^\d{10,11}$/, { error: 'Informe DDD + número, apenas dígitos.' }).optional(),
    cpf: z.string().regex(/^\d{11}$/, { error: 'CPF deve conter 11 dígitos.' }).optional(),
    perfil: z.enum(PERFIS_USUARIO, enumMsg(PERFIS_USUARIO)).default('CLIENTE'),
    consentimentoLGPD: z
      .object({
        fidelizacao: z.boolean().default(false),
        marketing: z.boolean().default(false),
      })
      .default({ fidelizacao: false, marketing: false }),
  }),
});

export const listarUsuariosSchema = z.object({
  query: z.object({
    ...paginationQuery,
    perfil: z.enum(PERFIS_USUARIO, enumMsg(PERFIS_USUARIO)).optional(),
  }),
});

export const usuarioIdSchema = z.object({ params: idParam() });

export type CriarUsuarioDTO = z.infer<typeof criarUsuarioSchema>['body'];
export type ListarUsuariosQuery = z.infer<typeof listarUsuariosSchema>['query'];
