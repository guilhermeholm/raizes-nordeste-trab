import { Request, Response, NextFunction } from 'express';
import { ForbiddenError, UnauthorizedError } from '../../domain/errors/HttpErrors';
import { PerfilUsuario } from '../../domain/enums';

export const roleMiddleware = (perfisPermitidos: PerfilUsuario[]) => {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) {
      throw new UnauthorizedError('Usuário não autenticado.');
    }
    if (!perfisPermitidos.includes(req.user.perfil)) {
      throw new ForbiddenError();
    }
    next();
  };
};
