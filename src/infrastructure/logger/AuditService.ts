import { Prisma } from '@prisma/client';
import { prisma } from '../database/prisma';
import { logger } from './winston';

export interface AuditContext {
  usuarioId?: number;
  ipOrigem?: string;
  requestId?: string;
}

export interface AuditEntry extends AuditContext {
  acao: string;
  recurso: string;
  recursoId?: number;
  detalhes?: Record<string, unknown>;
}

type DbClient = Prisma.TransactionClient | typeof prisma;

export class AuditService {

  async log(entry: AuditEntry, db: DbClient = prisma) {
    try {
      await db.auditLog.create({
        data: {
          acao: entry.acao,
          recurso: entry.recurso,
          recursoId: entry.recursoId,
          usuarioId: entry.usuarioId,
          detalhes: entry.detalhes ? JSON.stringify(entry.detalhes) : undefined,
          ipOrigem: entry.ipOrigem,
          requestId: entry.requestId,
        },
      });
      logger.info(`[AUDIT] ${entry.acao} ${entry.recurso}#${entry.recursoId ?? '-'}`, {
        usuarioId: entry.usuarioId,
        requestId: entry.requestId,
      });
    } catch (err) {
      if (db !== prisma) throw err;
      logger.error('Falha ao registrar log de auditoria', { err, entry });
    }
  }
}

export const auditService = new AuditService();
