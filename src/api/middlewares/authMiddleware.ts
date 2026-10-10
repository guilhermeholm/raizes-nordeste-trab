import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import '../../types/express';
import { env } from '../../config/env';
import { UnauthorizedError } from '../../domain/errors/HttpErrors';
import { PerfilUsuario } from '../../domain/enums';

function extrairUsuario(authHeader: string) {
  const [scheme, token] = authHeader.split(' ');
  if (scheme !== 'Bearer' || !token) {
    throw new UnauthorizedError('Formato do token inválido. Use: Bearer <token>.', 'TOKEN_INVALIDO');
  }
  try {
    const decoded = jwt.verify(token, env.JWT_SECRET) as jwt.JwtPayload;
    return { id: Number(decoded.sub), perfil: decoded.perfil as PerfilUsuario };
  } catch {
    throw new UnauthorizedError('Token inválido ou expirado.', 'TOKEN_INVALIDO');
  }
}

export const authMiddleware = (req: Request, _res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    throw new UnauthorizedError('Token de autenticação ausente.', 'TOKEN_AUSENTE');
  }
  req.user = extrairUsuario(authHeader);
  next();
};

export const optionalAuthMiddleware = (req: Request, _res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;
  if (authHeader) req.user = extrairUsuario(authHeader);
  next();
};
