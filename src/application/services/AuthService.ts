import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prisma } from '../../infrastructure/database/prisma';
import { env } from '../../config/env';
import { LoginDTO } from '../dtos/auth.dto';
import { UnauthorizedError } from '../../domain/errors/HttpErrors';
import { PerfilUsuario } from '../../domain/enums';

export class AuthService {
  private gerarToken(usuario: { id: number; nome: string; perfil: string }) {
    const accessToken = jwt.sign({ perfil: usuario.perfil }, env.JWT_SECRET, {
      subject: String(usuario.id),
      expiresIn: env.JWT_EXPIRES_IN,
      algorithm: 'HS256',
    });

    return {
      accessToken,
      tokenType: 'Bearer',
      expiresIn: env.JWT_EXPIRES_IN,
      user: { id: usuario.id, nome: usuario.nome, perfil: usuario.perfil as PerfilUsuario },
    };
  }

  async login(data: LoginDTO) {
    const usuario = await prisma.usuario.findUnique({ where: { email: data.email.toLowerCase() } });

    const senhaValida = usuario ? await bcrypt.compare(data.senha, usuario.senhaHash) : false;
    if (!usuario || !usuario.ativo || !senhaValida) {
      throw new UnauthorizedError('E-mail ou senha inválidos.', 'CREDENCIAIS_INVALIDAS');
    }

    return this.gerarToken(usuario);
  }

  async refresh(usuarioId: number) {
    const usuario = await prisma.usuario.findUnique({ where: { id: usuarioId } });
    if (!usuario || !usuario.ativo) {
      throw new UnauthorizedError('Usuário inativo ou inexistente.', 'TOKEN_INVALIDO');
    }
    return this.gerarToken(usuario);
  }
}
