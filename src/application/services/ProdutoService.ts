import { prisma } from '../../infrastructure/database/prisma';
import { AuditContext, auditService } from '../../infrastructure/logger/AuditService';
import { NotFoundError, ValidationError } from '../../domain/errors/HttpErrors';
import { AtualizarProdutoDTO, CriarProdutoDTO, ListarProdutosQuery } from '../dtos/produto.dto';
import { paginate, paginated } from '../utils/pagination';

export class ProdutoService {
  async listar(query: ListarProdutosQuery) {
    const where = {
      categoria: query.categoria?.toUpperCase(),
      ativo: query.ativo,
    };
    const [data, total] = await Promise.all([
      prisma.produto.findMany({ where, orderBy: { id: 'asc' }, ...paginate(query.page, query.limit) }),
      prisma.produto.count({ where }),
    ]);
    return paginated(data, query.page, query.limit, total);
  }

  async cardapioPorUnidade(unidadeId: number, categoria?: string) {
    const unidade = await prisma.unidade.findUnique({ where: { id: unidadeId } });
    if (!unidade) throw new NotFoundError('Unidade não encontrada.', 'UNIDADE_NAO_ENCONTRADA');

    const vinculos = await prisma.produtoUnidade.findMany({
      where: { unidadeId, produto: { ativo: true, categoria: categoria?.toUpperCase() } },
      include: { produto: { include: { estoques: { where: { unidadeId } } } } },
      orderBy: { produtoId: 'asc' },
    });

    return {
      unidadeId: unidade.id,
      unidadeNome: unidade.nome,
      data: vinculos.map(({ produto, disponivel }) => {
        const quantidade = produto.estoques[0]?.quantidade ?? 0;
        return {
          id: produto.id,
          nome: produto.nome,
          descricao: produto.descricao,
          categoria: produto.categoria,
          preco: produto.preco,
          sazonal: produto.sazonal,
          disponivel,
          estoqueDisponivel: quantidade > 0,
          quantidadeEmEstoque: quantidade,
        };
      }),
    };
  }

  private async validarUnidades(ids: number[]) {
    if (ids.length === 0) return;
    const encontradas = await prisma.unidade.findMany({ where: { id: { in: ids } }, select: { id: true } });
    const faltantes = ids.filter((id) => !encontradas.some((u) => u.id === id));
    if (faltantes.length) {
      throw new ValidationError(
        'Unidades inexistentes informadas.',
        faltantes.map((id) => ({ field: 'unidades', issue: `Unidade ${id} não existe.` })),
      );
    }
  }

  async criar(data: CriarProdutoDTO, ctx: AuditContext) {
    const unidades = [...new Set(data.unidades)];
    await this.validarUnidades(unidades);

    const produto = await prisma.$transaction(async (tx) => {
      const novo = await tx.produto.create({
        data: {
          nome: data.nome,
          descricao: data.descricao,
          categoria: data.categoria,
          preco: data.preco,
          sazonal: data.sazonal,
          ativo: data.ativo,
        },
      });
      for (const unidadeId of unidades) {
        await tx.produtoUnidade.create({ data: { produtoId: novo.id, unidadeId } });
        await tx.estoque.create({ data: { produtoId: novo.id, unidadeId, quantidade: 0 } });
      }
      await auditService.log(
        { ...ctx, acao: 'PRODUTO_CRIADO', recurso: 'produto', recursoId: novo.id, detalhes: { ...data, unidades } },
        tx,
      );
      return novo;
    });

    return { ...produto, unidades };
  }

  async atualizar(id: number, data: AtualizarProdutoDTO, ctx: AuditContext) {
    const atual = await prisma.produto.findUnique({ where: { id } });
    if (!atual) throw new NotFoundError('Produto não encontrado.', 'PRODUTO_NAO_ENCONTRADO');

    const { unidades, ...campos } = data;
    if (unidades) await this.validarUnidades(unidades);

    return prisma.$transaction(async (tx) => {
      const produto = await tx.produto.update({ where: { id }, data: campos });

      if (unidades) {
        await tx.produtoUnidade.updateMany({
          where: { produtoId: id, unidadeId: { notIn: unidades } },
          data: { disponivel: false },
        });
        for (const unidadeId of unidades) {
          await tx.produtoUnidade.upsert({
            where: { produtoId_unidadeId: { produtoId: id, unidadeId } },
            create: { produtoId: id, unidadeId },
            update: { disponivel: true },
          });
          await tx.estoque.upsert({
            where: { produtoId_unidadeId: { produtoId: id, unidadeId } },
            create: { produtoId: id, unidadeId, quantidade: 0 },
            update: {},
          });
        }
      }

      await auditService.log(
        {
          ...ctx,
          acao: 'PRODUTO_ATUALIZADO',
          recurso: 'produto',
          recursoId: id,
          detalhes: { antes: { nome: atual.nome, preco: atual.preco, ativo: atual.ativo }, alteracoes: data },
        },
        tx,
      );
      return produto;
    });
  }
}
