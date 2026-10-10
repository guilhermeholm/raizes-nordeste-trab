import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { Prisma } from '@prisma/client';
import { AppError, ErrorDetail } from '../../domain/errors/AppError';
import { logger } from '../../infrastructure/logger/winston';

const LOCAIS_REQUEST = new Set(['body', 'query', 'params']);

function formatarCampo(path: PropertyKey[]): string {
  const partes = LOCAIS_REQUEST.has(String(path[0])) ? path.slice(1) : path;
  return partes.reduce<string>((acc, p) => {
    if (typeof p === 'number') return `${acc}[${p}]`;
    return acc ? `${acc}.${String(p)}` : String(p);
  }, '');
}

function responder(
  req: Request,
  res: Response,
  status: number,
  error: string,
  message: string,
  details: ErrorDetail[] = [],
) {
  return res.status(status).json({
    error,
    message,
    details,
    timestamp: new Date().toISOString(),
    path: req.originalUrl,
    requestId: req.requestId,
  });
}

export const errorMiddleware = (err: Error, req: Request, res: Response, _next: NextFunction) => {
  if (err instanceof AppError) {
    return responder(req, res, err.statusCode, err.errorCode, err.message, err.details);
  }

  if (err instanceof ZodError) {
    const details = err.issues.map((issue) => ({
      field: formatarCampo(issue.path) || '(body)',
      issue: issue.message,
    }));
    return responder(req, res, 422, 'VALIDACAO_FALHOU', 'Dados inválidos na requisição.', details);
  }

  if (err instanceof SyntaxError && 'body' in err) {
    return responder(req, res, 400, 'JSON_INVALIDO', 'O corpo da requisição não é um JSON válido.');
  }

  if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
    return responder(req, res, 409, 'REGISTRO_DUPLICADO', 'Já existe um registro com estes dados.');
  }

  logger.error('Erro não tratado', { requestId: req.requestId, message: err.message, stack: err.stack });
  return responder(req, res, 500, 'ERRO_INTERNO', 'Ocorreu um erro interno no servidor.');
};

export const notFoundMiddleware = (req: Request, res: Response) =>
  responder(req, res, 404, 'ROTA_NAO_ENCONTRADA', `Rota ${req.method} ${req.path} não encontrada.`);
