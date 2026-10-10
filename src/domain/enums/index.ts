export const PERFIS_USUARIO = ['ADMIN', 'GERENTE', 'ATENDENTE', 'COZINHA', 'CLIENTE'] as const;
export type PerfilUsuario = (typeof PERFIS_USUARIO)[number];

export const CANAIS_PEDIDO = ['APP', 'TOTEM', 'BALCAO', 'PICKUP', 'WEB'] as const;
export type CanalPedido = (typeof CANAIS_PEDIDO)[number];

export const STATUS_PEDIDO = [
  'AGUARDANDO_PAGAMENTO',
  'CONFIRMADO',
  'EM_PREPARO',
  'PRONTO',
  'ENTREGUE',
  'CANCELADO',
  'PAGAMENTO_RECUSADO',
] as const;
export type StatusPedido = (typeof STATUS_PEDIDO)[number];

export const FORMAS_PAGAMENTO = ['PIX', 'CARTAO_CREDITO', 'CARTAO_DEBITO', 'MOCK'] as const;
export type FormaPagamento = (typeof FORMAS_PAGAMENTO)[number];

export const STATUS_PAGAMENTO = ['PENDENTE', 'APROVADO', 'RECUSADO', 'ERRO'] as const;
export type StatusPagamento = (typeof STATUS_PAGAMENTO)[number];

export const TIPOS_MOV_ESTOQUE = ['ENTRADA', 'SAIDA', 'AJUSTE'] as const;
export type TipoMovimentacaoEstoque = (typeof TIPOS_MOV_ESTOQUE)[number];

export const TIPOS_MOV_FIDELIDADE = ['ACUMULO', 'RESGATE'] as const;
export type TipoMovimentacaoFidelidade = (typeof TIPOS_MOV_FIDELIDADE)[number];

export const PERFIS_FUNCIONARIOS: PerfilUsuario[] = ['ADMIN', 'GERENTE', 'ATENDENTE', 'COZINHA'];

export const TRANSICOES_STATUS_PEDIDO: Record<StatusPedido, StatusPedido[]> = {
  AGUARDANDO_PAGAMENTO: ['CANCELADO'],
  CONFIRMADO: ['EM_PREPARO', 'CANCELADO'],
  EM_PREPARO: ['PRONTO'],
  PRONTO: ['ENTREGUE'],
  ENTREGUE: [],
  CANCELADO: [],
  PAGAMENTO_RECUSADO: ['CANCELADO'],
};
