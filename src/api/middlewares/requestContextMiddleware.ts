import { Request, Response, NextFunction } from 'express';
import { randomUUID } from 'node:crypto';
import '../../types/express';
import { logger } from '../../infrastructure/logger/winston';
import { AuditContext } from '../../infrastructure/logger/AuditService';

export const requestContextMiddleware = (req: Request, res: Response, next: NextFunction) => {
  const header = req.header('x-request-id');
  req.requestId = header && header.length <= 100 ? header : randomUUID();
  res.setHeader('X-Request-Id', req.requestId);

  const inicio = Date.now();
  res.on('finish', () => {
    logger.http(`${req.method} ${req.originalUrl} ${res.statusCode} ${Date.now() - inicio}ms`, {
      requestId: req.requestId,
      usuarioId: req.user?.id,
    });
  });

  next();
};

export const auditContext = (req: Request): AuditContext => ({
  usuarioId: req.user?.id,
  ipOrigem: req.ip,
  requestId: req.requestId,
});
