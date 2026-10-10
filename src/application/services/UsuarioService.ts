import bcrypt from 'bcryptjs';
import { createHash, randomBytes } from 'node:crypto';
import { Usuario } from '@prisma/client';
import { prisma } from '../../infrastructure/database/prisma';
import { AuditContext, auditService } from '../../infrastructure/logger/AuditService';
import { encrypt, mascararCpf } from '../../infrastructure/security/crypto';
import { ConflictError, ForbiddenError, NotFoundError } from '../../domain/errors/HttpErrors';
import { UsuarioAutenticado } from '../../types/express';
import { CriarUsuarioDTO, ListarUsuariosQuery } from '../dtos/usuario.dto';
import { paginate, paginated } from '../utils/pagination';

export function toUsuarioResponse(u: Usuario) {
  return {
    id: u.id,
    nome: u.nome,
    email: u.email,
    perfil: u.perfil,
    telefone: u.telefone,
    cpf: mascararCpf(u.cpf),
    ativo: u.ativo,
    criadoEm: u.criadoEm,
  };
}

export class UsuarioService {
  async criar(data: CriarUsuarioDTO, ator: UsuarioAutenticado | undefined, ctx: AuditContext) {
    if (data.perfil !== 'CLIENTE' && ator?.perfil !== 'ADMIN') {
      throw new ForbiddenError('Apenas ADMIN pode cadastrar usuários com perfil diferente de CLIENTE.');
    }

    const existente = await prisma.usuario.findUnique({ where: { email: data.email } });
    if (existente) {
      throw new ConflictError('E-mail já cadastrado.', 'EMAIL_DUPLICADO', [
        { field: 'email', issue: 'Já existe um usuário com este e-mail.' },
      ]);
    }

    const senhaHash = await bcrypt.hash(data.senha, 10);
    const { fidelizacao, marketing } = data.consentimentoLGPD;

    const usuario = await prisma.$transaction(async (tx) => {
      const novo = await tx.usuario.create({
        data: {
          nome: data.nome,
          email: data.email,
          senhaHash,
          perfil: data.perfil,
          telefone: data.telefone,
          cpf: data.cpf ? encrypt(data.cpf) : null,
        },
      });

      await tx.consentimentoLGPD.createMany({
        data: [
          { usuarioId: novo.id, finalidade: 'FIDELIZACAO', consentido: fidelizacao, ipOrigem: ctx.ipOrigem },
          { usuarioId: novo.id, finalidade: 'MARKETING', consentido: marketing, ipOrigem: ctx.ipOrigem },
        ],
      });

      if (novo.perfil === 'CLIENTE') {
        await tx.fidelidade.create({ data: { usuarioId: novo.id, consentimento: fidelizacao } });
      }

      await auditService.log(
        {
          ...ctx,
          usuarioId: ctx.usuarioId ?? novo.id,
          acao: 'USUARIO_CRIADO',
          recurso: 'usuario',
          recursoId: novo.id,
          detalhes: { perfil: novo.perfil, consentimentos: { fidelizacao, marketing } },
        },
        tx,
      );
      return novo;
    });

    return {
      id: usuario.id,
      nome: usuario.nome,
      email: usuario.email,
      perfil: usuario.perfil,
      criadoEm: usuario.criadoEm,
    };
  }

  async listar(query: ListarUsuariosQuery, ctx: AuditContext) {
    const where = { perfil: query.perfil };
    const [usuarios, total] = await Promise.all([
      prisma.usuario.findMany({ where, orderBy: { id: 'asc' }, ...paginate(query.page, query.limit) }),
      prisma.usuario.count({ where }),
    ]);
    await auditService.log({
      ...ctx,
      acao: 'DADOS_PESSOAIS_ACESSADOS',
      recurso: 'usuario',
      detalhes: { filtro: query, titulares: usuarios.map((u) => u.id) },
    });
    return paginated(usuarios.map(toUsuarioResponse), query.page, query.limit, total);
  }

  async buscarPorId(id: number, ator: UsuarioAutenticado, ctx: AuditContext) {
    if (!['ADMIN', 'GERENTE'].includes(ator.perfil) && ator.id !== id) {
      throw new ForbiddenError('Você só pode consultar os seus próprios dados.');
    }
    const usuario = await prisma.usuario.findUnique({ where: { id } });
    if (!usuario) throw new NotFoundError('Usuário não encontrado.', 'USUARIO_NAO_ENCONTRADO');
    if (ator.id !== id) {
      await auditService.log({ ...ctx, acao: 'DADOS_PESSOAIS_ACESSADOS', recurso: 'usuario', recursoId: id });
    }
    return toUsuarioResponse(usuario);
  }

  async anonimizar(id: number, ator: UsuarioAutenticado, ctx: AuditContext) {
    if (ator.perfil !== 'ADMIN' && ator.id !== id) {
      throw new ForbiddenError('Você só pode solicitar a exclusão da sua própria conta.');
    }
    const usuario = await prisma.usuario.findUnique({ where: { id } });
    if (!usuario) throw new NotFoundError('Usuário não encontrado.', 'USUARIO_NAO_ENCONTRADO');
    if (!usuario.ativo && usuario.nome.startsWith('ANONIMIZADO')) {
      throw new ConflictError('Usuário já anonimizado.', 'USUARIO_JA_ANONIMIZADO');
    }

    const hash = createHash('sha256').update(`${usuario.email}:${randomBytes(16).toString('hex')}`).digest('hex');
    const agora = new Date();

    await prisma.$transaction(async (tx) => {
      await tx.usuario.update({
        where: { id },
        data: {
          nome: `ANONIMIZADO_${hash.slice(0, 12)}`,
          email: `anonimizado_${hash.slice(0, 24)}@anonimo.invalid`,
          senhaHash: await bcrypt.hash(randomBytes(32).toString('hex'), 10),
          telefone: null,
          cpf: null,
          ativo: false,
        },
      });
      await tx.consentimentoLGPD.updateMany({
        where: { usuarioId: id, revogadoEm: null },
        data: { consentido: false, revogadoEm: agora },
      });
      await tx.fidelidade.updateMany({ where: { usuarioId: id }, data: { consentimento: false } });
      await auditService.log(
        { ...ctx, acao: 'USUARIO_ANONIMIZADO', recurso: 'usuario', recursoId: id, detalhes: { solicitadoPor: ator.id } },
        tx,
      );
    });

    return { id, anonimizado: true, anonimizadoEm: agora };
  }
}
