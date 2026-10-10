import { Prisma } from '@prisma/client';
import { prisma } from '../../infrastructure/database/prisma';
import { AuditContext, auditService } from '../../infrastructure/logger/AuditService';
import { ConflictError, NotFoundError } from '../../domain/errors/HttpErrors';
import { ResgatarPontosDTO } from '../dtos/fidelidade.dto';
import { paginate, paginated } from '../utils/pagination';

export const calcularPontos = (valor: number) => Math.floor(valor);

const STATUS_PEDIDO_PAGO = ['CONFIRMADO', 'EM_PREPARO', 'PRONTO', 'ENTREGUE'];

export class FidelidadeService {
  async acumularPorPedido(tx: Prisma.TransactionClient, pedidoId: number, ctx: AuditContext) {
    const pedido = await tx.pedido.findUnique({ where: { id: pedidoId } });
    if (!pedido) throw new NotFoundError('Pedido não encontrado.', 'PEDIDO_NAO_ENCONTRADO');
    if (!STATUS_PEDIDO_PAGO.includes(pedido.status)) {
      throw new ConflictError('Somente pedidos pagos geram pontos.', 'PEDIDO_NAO_PAGO');
    }

    const fidelidade = await tx.fidelidade.findUnique({ where: { usuarioId: pedido.clienteId } });
    if (!fidelidade || !fidelidade.consentimento) return null;

    const jaAcumulado = await tx.movimentacaoFidelidade.findFirst({
      where: { fidelidadeId: fidelidade.id, pedidoId, tipo: 'ACUMULO' },
    });
    if (jaAcumulado) {
      throw new ConflictError('Os pontos deste pedido já foram acumulados.', 'PONTOS_JA_ACUMULADOS');
    }

    const pontos = calcularPontos(pedido.total);
    const descricao = `Acúmulo pedido #${pedidoId}`;
    const atualizada = await tx.fidelidade.update({
      where: { id: fidelidade.id },
      data: { pontosAcumulados: { increment: pontos }, saldoPontos: { increment: pontos } },
    });
    await tx.movimentacaoFidelidade.create({
      data: { fidelidadeId: fidelidade.id, tipo: 'ACUMULO', pontos, descricao, pedidoId },
    });
    await auditService.log(
      { ...ctx, acao: 'PONTOS_ACUMULADOS', recurso: 'fidelidade', recursoId: fidelidade.id, detalhes: { pedidoId, pontos } },
      tx,
    );

    return { pontosAdicionados: pontos, saldoAtual: atualizada.saldoPontos, descricao };
  }

  async acumular(pedidoId: number, ctx: AuditContext) {
    const resultado = await prisma.$transaction((tx) => this.acumularPorPedido(tx, pedidoId, ctx));
    if (!resultado) {
      throw new ConflictError(
        'Cliente não participa do programa de fidelidade ou não consentiu (LGPD).',
        'SEM_CONSENTIMENTO_FIDELIDADE',
      );
    }
    return resultado;
  }

  private async obter(usuarioId: number) {
    const fidelidade = await prisma.fidelidade.findUnique({ where: { usuarioId } });
    if (!fidelidade) throw new NotFoundError('Programa de fidelidade não encontrado para este usuário.', 'FIDELIDADE_NAO_ENCONTRADA');
    return fidelidade;
  }

  async saldo(usuarioId: number) {
    const f = await this.obter(usuarioId);
    return {
      usuarioId,
      pontosAcumulados: f.pontosAcumulados,
      pontosResgatados: f.pontosResgatados,
      saldoPontos: f.saldoPontos,
      consentimento: f.consentimento,
    };
  }

  async resgatar(usuarioId: number, data: ResgatarPontosDTO, ctx: AuditContext) {
    const f = await this.obter(usuarioId);
    if (!f.consentimento) {
      throw new ConflictError('É necessário consentir com o programa de fidelidade.', 'SEM_CONSENTIMENTO_FIDELIDADE');
    }

    return prisma.$transaction(async (tx) => {
      const { count } = await tx.fidelidade.updateMany({
        where: { id: f.id, saldoPontos: { gte: data.pontos } },
        data: { saldoPontos: { decrement: data.pontos }, pontosResgatados: { increment: data.pontos } },
      });
      if (count === 0) {
        throw new ConflictError('Saldo de pontos insuficiente.', 'SALDO_INSUFICIENTE', [
          { field: 'pontos', issue: `Saldo disponível: ${f.saldoPontos}` },
        ]);
      }
      await tx.movimentacaoFidelidade.create({
        data: { fidelidadeId: f.id, tipo: 'RESGATE', pontos: data.pontos, descricao: data.descricao },
      });
      await auditService.log(
        { ...ctx, acao: 'PONTOS_RESGATADOS', recurso: 'fidelidade', recursoId: f.id, detalhes: { pontos: data.pontos } },
        tx,
      );
      const atualizada = await tx.fidelidade.findUniqueOrThrow({ where: { id: f.id } });
      return {
        pontosResgatados: data.pontos,
        saldoAtual: atualizada.saldoPontos,
        descontoConcedido: data.pontos / 10,
      };
    });
  }

  async historico(usuarioId: number, page: number, limit: number) {
    const f = await this.obter(usuarioId);
    const where = { fidelidadeId: f.id };
    const [data, total] = await Promise.all([
      prisma.movimentacaoFidelidade.findMany({ where, orderBy: { id: 'desc' }, ...paginate(page, limit) }),
      prisma.movimentacaoFidelidade.count({ where }),
    ]);
    return paginated(data, page, limit, total);
  }

  async atualizarConsentimento(usuarioId: number, consentimento: boolean, ctx: AuditContext) {
    return prisma.$transaction(async (tx) => {
      const f = await tx.fidelidade.upsert({
        where: { usuarioId },
        create: { usuarioId, consentimento },
        update: { consentimento },
      });
      const agora = new Date();
      await tx.consentimentoLGPD.updateMany({
        where: { usuarioId, finalidade: 'FIDELIZACAO', revogadoEm: null },
        data: { revogadoEm: agora },
      });
      await tx.consentimentoLGPD.create({
        data: { usuarioId, finalidade: 'FIDELIZACAO', consentido: consentimento, ipOrigem: ctx.ipOrigem },
      });
      await auditService.log(
        {
          ...ctx,
          acao: consentimento ? 'CONSENTIMENTO_CONCEDIDO' : 'CONSENTIMENTO_REVOGADO',
          recurso: 'consentimento',
          recursoId: usuarioId,
          detalhes: { finalidade: 'FIDELIZACAO' },
        },
        tx,
      );
      return { usuarioId, finalidade: 'FIDELIZACAO', consentimento: f.consentimento, registradoEm: agora };
    });
  }
}

export const fidelidadeService = new FidelidadeService();
