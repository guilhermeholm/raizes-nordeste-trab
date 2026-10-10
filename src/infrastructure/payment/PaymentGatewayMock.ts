import { randomUUID } from 'node:crypto';
import { env } from '../../config/env';

export type CenarioPagamento = 'APROVAR' | 'RECUSAR';

export interface SolicitacaoPagamento {
  pedidoId: number;
  valor: number;
  formaPagamento: string;
  cenario?: CenarioPagamento;
}

export interface RespostaGateway {
  status: 'APROVADO' | 'RECUSADO';
  transacaoId: string;
  motivo?: string;
  processadoEm: Date;
  raw: Record<string, unknown>;
}

const LIMITE_TRANSACAO = 1000;

export class PaymentGatewayMock {
  constructor(private readonly random: () => number = Math.random) {}

  async processar(req: SolicitacaoPagamento): Promise<RespostaGateway> {
    const transacaoId = `mock-txn-${randomUUID()}`;
    const processadoEm = new Date();

    let aprovado: boolean;
    let motivo: string | undefined;

    if (req.cenario === 'APROVAR') {
      aprovado = true;
    } else if (req.cenario === 'RECUSAR') {
      aprovado = false;
      motivo = 'Recusa forçada pelo cenário de teste (simulação mock)';
    } else if (req.valor > LIMITE_TRANSACAO) {
      aprovado = false;
      motivo = 'Valor excede o limite da transação (simulação mock)';
    } else {
      aprovado = this.random() < env.PAGAMENTO_TAXA_APROVACAO;
      if (!aprovado) motivo = 'Saldo insuficiente (simulação mock)';
    }

    const status = aprovado ? 'APROVADO' : 'RECUSADO';
    return {
      status,
      transacaoId,
      motivo,
      processadoEm,
      raw: {
        gateway: 'raizes-pay-mock',
        transacaoId,
        pedidoId: req.pedidoId,
        valor: req.valor,
        formaPagamento: req.formaPagamento,
        status,
        motivo: motivo ?? null,
        processadoEm: processadoEm.toISOString(),
      },
    };
  }
}

export const paymentGateway = new PaymentGatewayMock();
