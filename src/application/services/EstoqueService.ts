import { prisma } from '../../infrastructure/database/prisma';
import { AuditContext, auditService } from '../../infrastructure/logger/AuditService';
import { ConflictError, NotFoundError } from '../../domain/errors/HttpErrors';
import { MovimentacaoEstoqueDTO } from '../dtos/estoque.dto';

export class EstoqueService {
  async listarPorUnidade(unidadeId: number) {
    const unidade = await prisma.unidade.findUnique({ where: { id: unidadeId } });
    if (!unidade) throw new NotFoundError('Unidade não encontrada.', 'UNIDADE_NAO_ENCONTRADA');

    const estoques = await prisma.estoque.findMany({
      where: { unidadeId },
      include: { produto: { select: { nome: true } } },
      orderBy: { produtoId: 'asc' },
    });

    return {
      unidadeId,
      unidadeNome: unidade.nome,
      data: estoques.map((e) => ({
        produtoId: e.produtoId,
        produtoNome: e.produto.nome,
        quantidade: e.quantidade,
        quantidadeMinima: e.quantidadeMinima,
        status: e.quantidade === 0 ? 'SEM_ESTOQUE' : e.quantidade <= e.quantidadeMinima ? 'ESTOQUE_BAIXO' : 'OK',
        atualizadoEm: e.atualizadoEm,
      })),
    };
  }

  async movimentar(data: MovimentacaoEstoqueDTO, ctx: AuditContext) {
    return prisma.$transaction(async (tx) => {
      const estoque = await tx.estoque.findUnique({
        where: { produtoId_unidadeId: { produtoId: data.produtoId, unidadeId: data.unidadeId } },
      });
      if (!estoque) {
        throw new NotFoundError('Produto não está vinculado ao estoque desta unidade.', 'ESTOQUE_NAO_ENCONTRADO');
      }

      let novaQuantidade = estoque.quantidade;
      if (data.tipo === 'ENTRADA') novaQuantidade += data.quantidade;
      if (data.tipo === 'SAIDA') novaQuantidade -= data.quantidade;
      if (data.tipo === 'AJUSTE') novaQuantidade = data.quantidade;

      if (novaQuantidade < 0) {
        throw new ConflictError('A movimentação deixaria o estoque negativo.', 'ESTOQUE_NEGATIVO', [
          { field: 'quantidade', issue: `Disponível: ${estoque.quantidade}` },
        ]);
      }

      const { count } = await tx.estoque.updateMany({
        where: { id: estoque.id, quantidade: estoque.quantidade },
        data: { quantidade: novaQuantidade },
      });
      if (count === 0) {
        throw new ConflictError('O estoque foi alterado por outra operação. Tente novamente.', 'CONFLITO_CONCORRENCIA');
      }

      const mov = await tx.movimentacaoEstoque.create({
        data: {
          estoqueId: estoque.id,
          produtoId: data.produtoId,
          unidadeId: data.unidadeId,
          tipo: data.tipo,
          quantidade: data.quantidade,
          motivo: data.motivo,
          usuarioId: ctx.usuarioId,
        },
      });

      await auditService.log(
        {
          ...ctx,
          acao: 'ESTOQUE_MOVIMENTADO',
          recurso: 'estoque',
          recursoId: estoque.id,
          detalhes: { ...data, de: estoque.quantidade, para: novaQuantidade },
        },
        tx,
      );

      return {
        id: mov.id,
        estoqueAtual: novaQuantidade,
        movimentacao: { tipo: mov.tipo, quantidade: mov.quantidade, motivo: mov.motivo, criadaEm: mov.criadaEm },
      };
    });
  }
}
