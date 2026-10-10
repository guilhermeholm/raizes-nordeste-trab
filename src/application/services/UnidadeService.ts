import { prisma } from '../../infrastructure/database/prisma';
import { NotFoundError } from '../../domain/errors/HttpErrors';
import { ListarUnidadesQuery } from '../dtos/unidade.dto';

export class UnidadeService {
  async listar(query: ListarUnidadesQuery) {
    const data = await prisma.unidade.findMany({
      where: {
        cidade: query.cidade,
        ativa: query.ativa ?? true,
      },
      orderBy: { id: 'asc' },
    });
    return { data };
  }

  async buscarPorId(id: number) {
    const unidade = await prisma.unidade.findUnique({ where: { id } });
    if (!unidade) throw new NotFoundError('Unidade não encontrada.', 'UNIDADE_NAO_ENCONTRADA');
    return unidade;
  }
}
