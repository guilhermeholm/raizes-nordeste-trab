import { Prisma, Pedido, ItemPedido } from '@prisma/client';
import { prisma } from '../../infrastructure/database/prisma';
import { AuditContext, auditService } from '../../infrastructure/logger/AuditService';
import { ConflictError, ForbiddenError, NotFoundError } from '../../domain/errors/HttpErrors';
import { ErrorDetail } from '../../domain/errors/AppError';
import { PERFIS_FUNCIONARIOS, StatusPedido, TRANSICOES_STATUS_PEDIDO } from '../../domain/enums';
import { UsuarioAutenticado } from '../../types/express';
import { AtualizarStatusDTO, CriarPedidoDTO, ListarPedidosQuery } from '../dtos/pedido.dto';
import { money, paginate, paginated } from '../utils/pagination';

export function toPedidoResponse(p: Pedido & { itens: (ItemPedido & { produto?: { nome: string } })[] }) {
  return {
    pedidoId: p.id,
    clienteId: p.clienteId,
    unidadeId: p.unidadeId,
    status: p.status,
    canalPedido: p.canalPedido,
    formaPagamento: p.formaPagamento,
    total: p.total,
    observacao: p.observacao,
    itens: p.itens.map((i) => ({
      produtoId: i.produtoId,
      produtoNome: i.produto?.nome,
      quantidade: i.quantidade,
      precoUnitario: i.precoUnitario,
      subtotal: i.subtotal,
    })),
    criadoEm: p.criadoEm,
    atualizadoEm: p.atualizadoEm,
  };
}

export async function estornarEstoque(
  tx: Prisma.TransactionClient,
  pedido: Pedido & { itens: ItemPedido[] },
  motivo: string,
  usuarioId?: number,
) {
  for (const item of pedido.itens) {
    const estoque = await tx.estoque.update({
      where: { produtoId_unidadeId: { produtoId: item.produtoId, unidadeId: pedido.unidadeId } },
      data: { quantidade: { increment: item.quantidade } },
    });
    await tx.movimentacaoEstoque.create({
      data: {
        estoqueId: estoque.id,
        produtoId: item.produtoId,
        unidadeId: pedido.unidadeId,
        tipo: 'ENTRADA',
        quantidade: item.quantidade,
        motivo: `${motivo} (pedido #${pedido.id})`,
        usuarioId,
      },
    });
  }
}

export class PedidoService {
  async criar(data: CriarPedidoDTO, ator: UsuarioAutenticado, ctx: AuditContext) {
    let clienteId = ator.id;
    if (data.clienteId && data.clienteId !== ator.id) {
      if (ator.perfil === 'CLIENTE') {
        throw new ForbiddenError('Clientes só podem criar pedidos para si mesmos.');
      }
      const cliente = await prisma.usuario.findUnique({ where: { id: data.clienteId } });
      if (!cliente || !cliente.ativo) throw new NotFoundError('Cliente não encontrado.', 'CLIENTE_NAO_ENCONTRADO');
      clienteId = cliente.id;
    }

    const unidade = await prisma.unidade.findUnique({ where: { id: data.unidadeId } });
    if (!unidade) throw new NotFoundError('Unidade não encontrada.', 'UNIDADE_NAO_ENCONTRADA');
    if (!unidade.ativa) throw new ConflictError('Unidade inativa no momento.', 'UNIDADE_INATIVA');

    const itens = new Map<number, { quantidade: number; indice: number }>();
    data.itens.forEach((item, indice) => {
      const atual = itens.get(item.produtoId);
      itens.set(item.produtoId, { quantidade: (atual?.quantidade ?? 0) + item.quantidade, indice: atual?.indice ?? indice });
    });
    const produtoIds = [...itens.keys()];

    const resultado = await prisma.$transaction(async (tx) => {
      const vinculos = await tx.produtoUnidade.findMany({
        where: { unidadeId: data.unidadeId, produtoId: { in: produtoIds } },
        include: { produto: { include: { estoques: { where: { unidadeId: data.unidadeId } } } } },
      });

      const existentes = await tx.produto.findMany({ where: { id: { in: produtoIds } }, select: { id: true } });
      const inexistentes = produtoIds.filter((id) => !existentes.some((p) => p.id === id));
      if (inexistentes.length) {
        throw new NotFoundError(`Produto(s) não encontrado(s): ${inexistentes.join(', ')}.`, 'PRODUTO_NAO_ENCONTRADO');
      }

      const indisponiveis: ErrorDetail[] = [];
      for (const [produtoId, { indice }] of itens) {
        const v = vinculos.find((x) => x.produtoId === produtoId);
        if (!v || !v.disponivel || !v.produto.ativo) {
          indisponiveis.push({ field: `itens[${indice}].produtoId`, issue: `Produto ${produtoId} indisponível nesta unidade.` });
        }
      }
      if (indisponiveis.length) {
        throw new ConflictError('Um ou mais produtos não estão disponíveis nesta unidade.', 'PRODUTO_INDISPONIVEL', indisponiveis);
      }

      const faltas: ErrorDetail[] = [];
      for (const [produtoId, { quantidade, indice }] of itens) {
        const disponivel = vinculos.find((x) => x.produtoId === produtoId)!.produto.estoques[0]?.quantidade ?? 0;
        if (disponivel < quantidade) {
          faltas.push({ field: `itens[${indice}].quantidade`, issue: `Disponível: ${disponivel}` });
        }
      }
      if (faltas.length) {
        throw new ConflictError('Não há quantidade suficiente para um ou mais itens.', 'ESTOQUE_INSUFICIENTE', faltas);
      }

      const linhas = produtoIds.map((produtoId) => {
        const { quantidade } = itens.get(produtoId)!;
        const precoUnitario = vinculos.find((x) => x.produtoId === produtoId)!.produto.preco;
        return { produtoId, quantidade, precoUnitario, subtotal: money(precoUnitario * quantidade) };
      });
      const total = money(linhas.reduce((acc, l) => acc + l.subtotal, 0));

      for (const l of linhas) {
        const { count } = await tx.estoque.updateMany({
          where: { produtoId: l.produtoId, unidadeId: data.unidadeId, quantidade: { gte: l.quantidade } },
          data: { quantidade: { decrement: l.quantidade } },
        });
        if (count === 0) {
          throw new ConflictError('Não há quantidade suficiente para um ou mais itens.', 'ESTOQUE_INSUFICIENTE', [
            { field: `itens[${itens.get(l.produtoId)!.indice}].quantidade`, issue: 'Estoque alterado durante o pedido.' },
          ]);
        }
      }

      const pedido = await tx.pedido.create({
        data: {
          clienteId,
          unidadeId: data.unidadeId,
          canalPedido: data.canalPedido,
          formaPagamento: data.formaPagamento,
          observacao: data.observacao,
          total,
          status: 'AGUARDANDO_PAGAMENTO',
          itens: { create: linhas },
        },
        include: { itens: { include: { produto: { select: { nome: true } } } } },
      });

      for (const l of linhas) {
        const estoque = vinculos.find((x) => x.produtoId === l.produtoId)!.produto.estoques[0];
        await tx.movimentacaoEstoque.create({
          data: {
            estoqueId: estoque.id,
            produtoId: l.produtoId,
            unidadeId: data.unidadeId,
            tipo: 'SAIDA',
            quantidade: l.quantidade,
            motivo: `Venda (pedido #${pedido.id})`,
            usuarioId: ator.id,
          },
        });
      }

      await auditService.log(
        {
          ...ctx,
          acao: 'PEDIDO_CRIADO',
          recurso: 'pedido',
          recursoId: pedido.id,
          detalhes: { canalPedido: pedido.canalPedido, unidadeId: pedido.unidadeId, total, clienteId },
        },
        tx,
      );

      return pedido;
    });

    return toPedidoResponse(resultado);
  }

  async listar(query: ListarPedidosQuery, ator: UsuarioAutenticado) {
    const where: Prisma.PedidoWhereInput = {
      canalPedido: query.canalPedido,
      status: query.status,
      unidadeId: query.unidadeId,
      clienteId: ator.perfil === 'CLIENTE' ? ator.id : undefined,
    };
    const [pedidos, total] = await Promise.all([
      prisma.pedido.findMany({
        where,
        include: { itens: { include: { produto: { select: { nome: true } } } } },
        orderBy: { id: 'desc' },
        ...paginate(query.page, query.limit),
      }),
      prisma.pedido.count({ where }),
    ]);
    return paginated(pedidos.map(toPedidoResponse), query.page, query.limit, total);
  }

  async buscarPorId(id: number, ator: UsuarioAutenticado) {
    const pedido = await prisma.pedido.findUnique({
      where: { id },
      include: {
        itens: { include: { produto: { select: { nome: true } } } },
        pagamento: true,
      },
    });
    if (!pedido) throw new NotFoundError('Pedido não encontrado.', 'PEDIDO_NAO_ENCONTRADO');
    if (!PERFIS_FUNCIONARIOS.includes(ator.perfil) && pedido.clienteId !== ator.id) {
      throw new ForbiddenError('Você não tem acesso a este pedido.');
    }
    return {
      ...toPedidoResponse(pedido),
      pagamento: pedido.pagamento
        ? { pagamentoId: pedido.pagamento.id, status: pedido.pagamento.status, processadoEm: pedido.pagamento.processadoEm }
        : null,
    };
  }

  async atualizarStatus(id: number, data: AtualizarStatusDTO, ator: UsuarioAutenticado, ctx: AuditContext) {
    return prisma.$transaction(async (tx) => {
      const pedido = await tx.pedido.findUnique({ where: { id }, include: { itens: true } });
      if (!pedido) throw new NotFoundError('Pedido não encontrado.', 'PEDIDO_NAO_ENCONTRADO');

      const statusAnterior = pedido.status as StatusPedido;
      const permitidos = TRANSICOES_STATUS_PEDIDO[statusAnterior];
      if (!permitidos.includes(data.status)) {
        throw new ConflictError(
          `Transição de status inválida: ${statusAnterior} → ${data.status}.`,
          'TRANSICAO_STATUS_INVALIDA',
          [{ field: 'status', issue: `Transições permitidas a partir de ${statusAnterior}: ${permitidos.join(', ') || 'nenhuma'}` }],
        );
      }

      const { count } = await tx.pedido.updateMany({
        where: { id, status: statusAnterior },
        data: { status: data.status },
      });
      if (count === 0) {
        throw new ConflictError('O pedido foi alterado por outra operação. Tente novamente.', 'CONFLITO_CONCORRENCIA');
      }

      const estoqueEstornado = data.status === 'CANCELADO' && statusAnterior !== 'PAGAMENTO_RECUSADO';
      if (estoqueEstornado) {
        await estornarEstoque(tx, pedido, 'Estorno por cancelamento', ator.id);
      }

      await auditService.log(
        {
          ...ctx,
          acao: data.status === 'CANCELADO' ? 'PEDIDO_CANCELADO' : 'STATUS_PEDIDO_ALTERADO',
          recurso: 'pedido',
          recursoId: id,
          detalhes: { de: statusAnterior, para: data.status, motivo: data.motivo, perfil: ator.perfil, estoqueEstornado },
        },
        tx,
      );

      const atualizado = await tx.pedido.findUniqueOrThrow({ where: { id } });
      return {
        pedidoId: id,
        statusAnterior,
        statusAtual: atualizado.status,
        atualizadoEm: atualizado.atualizadoEm,
      };
    });
  }
}
