import { prisma } from '../../infrastructure/database/prisma';
import { ListarAuditoriaQuery } from '../dtos/auditoria.dto';
import { paginate, paginated } from '../utils/pagination';

export class AuditoriaService {
  async listar(query: ListarAuditoriaQuery) {
    const where = {
      recurso: query.recurso,
      recursoId: query.recursoId,
      acao: query.acao,
      usuarioId: query.usuarioId,
    };
    const [logs, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        include: { usuario: { select: { nome: true, perfil: true } } },
        orderBy: { id: 'desc' },
        ...paginate(query.page, query.limit),
      }),
      prisma.auditLog.count({ where }),
    ]);
    const data = logs.map((l) => ({ ...l, detalhes: l.detalhes ? JSON.parse(l.detalhes) : null }));
    return paginated(data, query.page, query.limit, total);
  }
}
