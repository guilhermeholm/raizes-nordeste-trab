import { PaymentGatewayMock } from '../../src/infrastructure/payment/PaymentGatewayMock';
import { calcularPontos } from '../../src/application/services/FidelidadeService';
import { TRANSICOES_STATUS_PEDIDO } from '../../src/domain/enums';
import { decrypt, encrypt, mascararCpf } from '../../src/infrastructure/security/crypto';

describe('PaymentGatewayMock', () => {
  const base = { pedidoId: 1, valor: 50, formaPagamento: 'MOCK' };

  it('aprova quando o cenário APROVAR é informado', async () => {
    const r = await new PaymentGatewayMock(() => 0.99).processar({ ...base, cenario: 'APROVAR' });
    expect(r.status).toBe('APROVADO');
    expect(r.transacaoId).toMatch(/^mock-txn-/);
  });

  it('recusa quando o cenário RECUSAR é informado', async () => {
    const r = await new PaymentGatewayMock(() => 0).processar({ ...base, cenario: 'RECUSAR' });
    expect(r.status).toBe('RECUSADO');
    expect(r.motivo).toBeDefined();
  });

  it('recusa valores acima do limite de R$ 1.000', async () => {
    const r = await new PaymentGatewayMock(() => 0).processar({ ...base, valor: 1500 });
    expect(r.status).toBe('RECUSADO');
  });

  it('usa a taxa de aprovação (80%) quando não há cenário', async () => {
    expect((await new PaymentGatewayMock(() => 0.5).processar(base)).status).toBe('APROVADO');
    expect((await new PaymentGatewayMock(() => 0.9).processar(base)).status).toBe('RECUSADO');
  });
});

describe('Regras de domínio', () => {
  it('fidelidade: 1 ponto por real inteiro', () => {
    expect(calcularPontos(60.3)).toBe(60);
    expect(calcularPontos(0.99)).toBe(0);
  });

  it('máquina de estados do pedido não permite pular etapas', () => {
    expect(TRANSICOES_STATUS_PEDIDO.CONFIRMADO).toContain('EM_PREPARO');
    expect(TRANSICOES_STATUS_PEDIDO.EM_PREPARO).not.toContain('ENTREGUE');
    expect(TRANSICOES_STATUS_PEDIDO.AGUARDANDO_PAGAMENTO).not.toContain('CONFIRMADO');
    expect(TRANSICOES_STATUS_PEDIDO.ENTREGUE).toHaveLength(0);
  });

  it('CPF é criptografado de forma reversível e exibido mascarado', () => {
    const cifrado = encrypt('12345678901');
    expect(cifrado).not.toContain('12345678901');
    expect(decrypt(cifrado)).toBe('12345678901');
    expect(mascararCpf(cifrado)).toBe('***.***.789-01');
    expect(mascararCpf(null)).toBeNull();
  });
});
