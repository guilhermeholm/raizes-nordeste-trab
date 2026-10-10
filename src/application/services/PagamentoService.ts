import { prisma } from '../../infrastructure/database/prisma';
import { AuditContext, auditService } from '../../infrastructure/logger/AuditService';
import { PaymentGatewayMock, paymentGateway } from '../../infrastructure/payment/PaymentGatewayMock';
import { ConflictError, ForbiddenError, NotFoundError } from '../../domain/errors/HttpErrors';
import { PERFIS_FUNCIONARIOS } from '../../domain/enums';
import { UsuarioAutenticado } from '../../types/express';
import { ProcessarPagamentoDTO } from '../dtos/pagamento.dto';
import { estornarEstoque } from './PedidoService';
import { FidelidadeService, fidelidadeService } from './FidelidadeService';

export class PagamentoService {
  constructor(
    private readonly gateway: PaymentGatewayMock = paymentGateway,
    private readonly fidelidade: FidelidadeService = fidelidadeService,
  ) {}

  async processar(data: ProcessarPagamentoDTO, ator: UsuarioAutenticado, ctx: AuditContext) {
    const pedido = await prisma.pedido.findUnique({
      where: { id: data.pedidoId },
      include: { itens: true, pagamento: true },
    });
    if (!pedido) throw new NotFoundError('Pedido não encontrado.', 'PEDIDO_NAO_ENCONTRADO');
    if (ator.perfil === 'CLIENTE' && pedido.clienteId !== ator.id) {
      throw new ForbiddenError('Você não pode pagar um pedido de outro cliente.');
    }
    if (pedido.pagamento || pedido.status !== 'AGUARDANDO_PAGAMENTO') {
      throw new ConflictError(
        pedido.pagamento?.status === 'APROVADO' ? 'Este pedido já foi pago.' : 'Pedido não está aguardando pagamento.',
        'PAGAMENTO_JA_PROCESSADO',
        [{ field: 'pedidoId', issue: `Status atual do pedido: ${pedido.status}` }],
      );
    }

    const resposta = await this.gateway.processar({
      pedidoId: pedido.id,
      valor: pedido.total,
      formaPagamento: pedido.formaPagamento,
      cenario: data.cenario,
    });
    const aprovado = resposta.status === 'APROVADO';
    const novoStatus = aprovado ? 'CONFIRMADO' : 'PAGAMENTO_RECUSADO';

    return prisma.$transaction(async (tx) => {
      const pagamento = await tx.pagamento.create({
        data: {
          pedidoId: pedido.id,
          valor: pedido.total,
          status: resposta.status,
          gatewayTransacaoId: resposta.transacaoId,
          gatewayResponse: JSON.stringify(resposta.raw),
          processadoEm: resposta.processadoEm,
        },
      });

      const { count } = await tx.pedido.updateMany({
        where: { id: pedido.id, status: 'AGUARDANDO_PAGAMENTO' },
        data: { status: novoStatus },
      });
      if (count === 0) {
        throw new ConflictError('Pedido não está mais aguardando pagamento.', 'PAGAMENTO_JA_PROCESSADO');
      }

      if (!aprovado) {
        await estornarEstoque(tx, pedido, 'Estorno por pagamento recusado', ator.id);
      }

      await auditService.log(
        {
          ...ctx,
          acao: aprovado ? 'PAGAMENTO_APROVADO' : 'PAGAMENTO_RECUSADO',
          recurso: 'pagamento',
          recursoId: pagamento.id,
          detalhes: {
            pedidoId: pedido.id,
            valor: pedido.total,
            transacaoId: resposta.transacaoId,
            motivo: resposta.motivo,
            statusPedido: { de: pedido.status, para: novoStatus },
          },
        },
        tx,
      );

      const pontos = aprovado ? await this.fidelidade.acumularPorPedido(tx, pedido.id, ctx) : null;

      return {
        pagamentoId: pagamento.id,
        pedidoId: pedido.id,
        status: pagamento.status,
        valor: pagamento.valor,
        gatewayTransacaoId: pagamento.gatewayTransacaoId,
        ...(resposta.motivo && { motivo: resposta.motivo }),
        pedidoStatus: novoStatus,
        pontosFidelidade: pontos?.pontosAdicionados ?? 0,
        processadoEm: pagamento.processadoEm,
      };
    });
  }

  async buscarPorPedido(pedidoId: number, ator: UsuarioAutenticado) {
    const pedido = await prisma.pedido.findUnique({ where: { id: pedidoId }, include: { pagamento: true } });
    if (!pedido) throw new NotFoundError('Pedido não encontrado.', 'PEDIDO_NAO_ENCONTRADO');
    if (!PERFIS_FUNCIONARIOS.includes(ator.perfil) && pedido.clienteId !== ator.id) {
      throw new ForbiddenError('Você não tem acesso a este pagamento.');
    }
    if (!pedido.pagamento) throw new NotFoundError('Nenhum pagamento registrado para este pedido.', 'PAGAMENTO_NAO_ENCONTRADO');

    const p = pedido.pagamento;
    return {
      pagamentoId: p.id,
      pedidoId: p.pedidoId,
      status: p.status,
      valor: p.valor,
      gatewayTransacaoId: p.gatewayTransacaoId,
      gatewayResponse: p.gatewayResponse ? JSON.parse(p.gatewayResponse) : null,
      processadoEm: p.processadoEm,
      pedidoStatus: pedido.status,
    };
  }
}
