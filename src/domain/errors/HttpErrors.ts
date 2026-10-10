import { AppError, ErrorDetail } from './AppError';

export class NotFoundError extends AppError {
  constructor(message = 'Recurso não encontrado.', errorCode = 'NAO_ENCONTRADO') {
    super(message, 404, errorCode);
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = 'Não autenticado.', errorCode = 'NAO_AUTENTICADO') {
    super(message, 401, errorCode);
  }
}

export class ForbiddenError extends AppError {
  constructor(message = 'Você não tem permissão para acessar este recurso.', errorCode = 'ACESSO_NEGADO') {
    super(message, 403, errorCode);
  }
}

export class ConflictError extends AppError {
  constructor(message: string, errorCode = 'CONFLITO', details: ErrorDetail[] = []) {
    super(message, 409, errorCode, details);
  }
}

export class ValidationError extends AppError {
  constructor(message: string, details: ErrorDetail[] = []) {
    super(message, 422, 'VALIDACAO_FALHOU', details);
  }
}
