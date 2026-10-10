import { prisma } from '../../src/infrastructure/database/prisma';
import { api, bearer, expectErroPadrao, login } from '../helpers';

let tokenCliente: string;
let tokenCozinha: string;
let tokenAdmin: string;
let pedidoId: number;

beforeAll(async () => {
  [tokenCliente, tokenCozinha, tokenAdmin] = await Promise.all([login('maria'), login('cozinha'), login('admin')]);
});

afterAll(() => prisma.$disconnect());

describe('Plano de testes T01–T12', () => {
  it('T01 - login de cliente com sucesso', async () => {
    const res = await api().post('/auth/login').send({ email: 'maria@email.com', senha: 'Cliente@123' });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ tokenType: 'Bearer', expiresIn: 3600, user: { perfil: 'CLIENTE' } });
    expect(res.body.accessToken).toEqual(expect.any(String));
  });

  it('T02 - login com senha incorreta → 401 CREDENCIAIS_INVALIDAS', async () => {
    const res = await api().post('/auth/login').send({ email: 'maria@email.com', senha: 'SenhaErrada' });
    expect(res.status).toBe(401);
    expectErroPadrao(res.body, 'CREDENCIAIS_INVALIDAS');
  });

  it('T03 - rota protegida sem token → 401 TOKEN_AUSENTE', async () => {
    const res = await api().get('/fidelidade/saldo');
    expect(res.status).toBe(401);
    expectErroPadrao(res.body, 'TOKEN_AUSENTE');
  });

  it('T04 - perfil sem permissão → 403 ACESSO_NEGADO', async () => {
    const res = await api()
      .post('/produtos')
      .set(bearer(tokenCliente))
      .send({ nome: 'Novo Produto', categoria: 'TAPIOCA', preco: 10 });
    expect(res.status).toBe(403);
    expectErroPadrao(res.body, 'ACESSO_NEGADO');
  });

  it('T05 - consultar cardápio da unidade', async () => {
    const res = await api().get('/produtos/unidade/1');
    expect(res.status).toBe(200);
    expect(res.body.unidadeId).toBe(1);
    expect(res.body.data.length).toBeGreaterThan(0);
    expect(res.body.data[0]).toHaveProperty('estoqueDisponivel');
  });

  it('T06 - pedido sem campos obrigatórios → 422 com details', async () => {
    const res = await api().post('/pedidos').set(bearer(tokenCliente)).send({ unidadeId: 1 });
    expect(res.status).toBe(422);
    expectErroPadrao(res.body, 'VALIDACAO_FALHOU');
    const campos = res.body.details.map((d: { field: string }) => d.field);
    expect(campos).toEqual(expect.arrayContaining(['canalPedido', 'itens']));
  });

  it('T07 - pedido com estoque insuficiente → 409 ESTOQUE_INSUFICIENTE', async () => {
    const res = await api()
      .post('/pedidos')
      .set(bearer(tokenCliente))
      .send({ canalPedido: 'APP', unidadeId: 1, itens: [{ produtoId: 1, quantidade: 999 }] });
    expect(res.status).toBe(409);
    expectErroPadrao(res.body, 'ESTOQUE_INSUFICIENTE');
    expect(res.body.details[0]).toEqual({ field: 'itens[0].quantidade', issue: 'Disponível: 50' });
  });

  it('T08 - criar pedido válido → 201 AGUARDANDO_PAGAMENTO e baixa de estoque', async () => {
    const res = await api()
      .post('/pedidos')
      .set(bearer(tokenCliente))
      .send({
        canalPedido: 'APP',
        unidadeId: 1,
        itens: [
          { produtoId: 1, quantidade: 2 },
          { produtoId: 3, quantidade: 1 },
        ],
        formaPagamento: 'MOCK',
      });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ status: 'AGUARDANDO_PAGAMENTO', canalPedido: 'APP', total: 60.3 });
    pedidoId = res.body.pedidoId;

    const estoque = await prisma.estoque.findUnique({ where: { produtoId_unidadeId: { produtoId: 1, unidadeId: 1 } } });
    expect(estoque?.quantidade).toBe(48);
  });

  it('T09 - processar pagamento mock → APROVADO e pedido CONFIRMADO', async () => {
    const res = await api().post('/pagamentos').set(bearer(tokenCliente)).send({ pedidoId, cenario: 'APROVAR' });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ status: 'APROVADO', pedidoStatus: 'CONFIRMADO', valor: 60.3, pontosFidelidade: 60 });
  });

  it('T10 - saldo de fidelidade incrementado após pagamento', async () => {
    const res = await api().get('/fidelidade/saldo').set(bearer(tokenCliente));
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ pontosAcumulados: 60, saldoPontos: 60, consentimento: true });
  });

  it('T11 - cozinha atualiza status para EM_PREPARO', async () => {
    const res = await api().patch(`/pedidos/${pedidoId}/status`).set(bearer(tokenCozinha)).send({ status: 'EM_PREPARO' });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ pedidoId, statusAnterior: 'CONFIRMADO', statusAtual: 'EM_PREPARO' });
  });

  it('T12 - auditoria registra a mudança de status feita pela cozinha', async () => {
    const res = await api()
      .get(`/auditoria?recurso=pedido&recursoId=${pedidoId}&acao=STATUS_PEDIDO_ALTERADO`)
      .set(bearer(tokenAdmin));
    expect(res.status).toBe(200);
    expect(res.body.data[0]).toMatchObject({
      acao: 'STATUS_PEDIDO_ALTERADO',
      detalhes: { de: 'CONFIRMADO', para: 'EM_PREPARO' },
      usuario: { perfil: 'COZINHA' },
      requestId: expect.any(String),
    });
  });
});

describe('Regras adicionais do fluxo crítico', () => {
  it('não permite pagar o mesmo pedido duas vezes (409)', async () => {
    const res = await api().post('/pagamentos').set(bearer(tokenCliente)).send({ pedidoId });
    expect(res.status).toBe(409);
    expectErroPadrao(res.body, 'PAGAMENTO_JA_PROCESSADO');
  });

  it('bloqueia transição de status inválida (EM_PREPARO → ENTREGUE)', async () => {
    const res = await api().patch(`/pedidos/${pedidoId}/status`).set(bearer(tokenCozinha)).send({ status: 'ENTREGUE' });
    expect(res.status).toBe(409);
    expectErroPadrao(res.body, 'TRANSICAO_STATUS_INVALIDA');
  });

  it('pagamento recusado marca PAGAMENTO_RECUSADO e devolve o estoque', async () => {
    const antes = await prisma.estoque.findUnique({ where: { produtoId_unidadeId: { produtoId: 2, unidadeId: 1 } } });
    const pedido = await api()
      .post('/pedidos')
      .set(bearer(tokenCliente))
      .send({ canalPedido: 'WEB', unidadeId: 1, itens: [{ produtoId: 2, quantidade: 3 }] });
    expect(pedido.status).toBe(201);

    const res = await api()
      .post('/pagamentos')
      .set(bearer(tokenCliente))
      .send({ pedidoId: pedido.body.pedidoId, cenario: 'RECUSAR' });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ status: 'RECUSADO', pedidoStatus: 'PAGAMENTO_RECUSADO', pontosFidelidade: 0 });

    const depois = await prisma.estoque.findUnique({ where: { produtoId_unidadeId: { produtoId: 2, unidadeId: 1 } } });
    expect(depois?.quantidade).toBe(antes?.quantidade);
  });

  it('cliente não vê pedido de outro cliente (403)', async () => {
    const tokenJoao = await login('joao');
    const res = await api().get(`/pedidos/${pedidoId}`).set(bearer(tokenJoao));
    expect(res.status).toBe(403);
  });

  it('cliente lista apenas os próprios pedidos', async () => {
    const tokenJoao = await login('joao');
    const res = await api().get('/pedidos').set(bearer(tokenJoao));
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(0);
  });

  it('pedidos simultâneos não vendem acima do estoque (Bolo de Macaxeira: 2 unidades)', async () => {
    const criar = () =>
      api()
        .post('/pedidos')
        .set(bearer(tokenCliente))
        .send({ canalPedido: 'TOTEM', unidadeId: 1, itens: [{ produtoId: 6, quantidade: 1 }] });
    const respostas = await Promise.all([criar(), criar(), criar(), criar()]);
    const status = respostas.map((r) => r.status).sort();
    expect(status.filter((s) => s === 201)).toHaveLength(2);
    expect(status.filter((s) => s === 409)).toHaveLength(2);

    const estoque = await prisma.estoque.findUnique({ where: { produtoId_unidadeId: { produtoId: 6, unidadeId: 1 } } });
    expect(estoque?.quantidade).toBe(0);
  });

  it('produto indisponível na unidade (cozinha compacta) → 409 PRODUTO_INDISPONIVEL', async () => {
    const res = await api()
      .post('/pedidos')
      .set(bearer(tokenCliente))
      .send({ canalPedido: 'PICKUP', unidadeId: 3, itens: [{ produtoId: 5, quantidade: 1 }] });
    expect(res.status).toBe(409);
    expectErroPadrao(res.body, 'PRODUTO_INDISPONIVEL');
  });

  it('produto inexistente → 404 PRODUTO_NAO_ENCONTRADO', async () => {
    const res = await api()
      .post('/pedidos')
      .set(bearer(tokenCliente))
      .send({ canalPedido: 'APP', unidadeId: 1, itens: [{ produtoId: 9999, quantidade: 1 }] });
    expect(res.status).toBe(404);
    expectErroPadrao(res.body, 'PRODUTO_NAO_ENCONTRADO');
  });

  it('unidade inexistente → 404 UNIDADE_NAO_ENCONTRADA', async () => {
    const res = await api()
      .post('/pedidos')
      .set(bearer(tokenCliente))
      .send({ canalPedido: 'APP', unidadeId: 999, itens: [{ produtoId: 1, quantidade: 1 }] });
    expect(res.status).toBe(404);
    expectErroPadrao(res.body, 'UNIDADE_NAO_ENCONTRADA');
  });

  it('quantidade negativa e canal inválido → 422', async () => {
    const res = await api()
      .post('/pedidos')
      .set(bearer(tokenCliente))
      .send({ canalPedido: 'FAX', unidadeId: 1, itens: [{ produtoId: 1, quantidade: -2 }] });
    expect(res.status).toBe(422);
    const campos = res.body.details.map((d: { field: string }) => d.field);
    expect(campos).toEqual(expect.arrayContaining(['canalPedido', 'itens[0].quantidade']));
  });

  it('filtra pedidos por canal (?canalPedido=APP)', async () => {
    const res = await api().get('/pedidos?canalPedido=APP').set(bearer(tokenAdmin));
    expect(res.status).toBe(200);
    expect(res.body.data.length).toBeGreaterThan(0);
    expect(res.body.data.every((p: { canalPedido: string }) => p.canalPedido === 'APP')).toBe(true);
  });

  it('cancelamento de pedido confirmado devolve itens ao estoque', async () => {
    const pedido = await api()
      .post('/pedidos')
      .set(bearer(tokenCliente))
      .send({ canalPedido: 'BALCAO', unidadeId: 2, itens: [{ produtoId: 8, quantidade: 4 }] });
    await api().post('/pagamentos').set(bearer(tokenCliente)).send({ pedidoId: pedido.body.pedidoId, cenario: 'APROVAR' });

    const res = await api()
      .patch(`/pedidos/${pedido.body.pedidoId}/status`)
      .set(bearer(tokenAdmin))
      .send({ status: 'CANCELADO', motivo: 'Cliente desistiu' });
    expect(res.status).toBe(200);

    const estoque = await prisma.estoque.findUnique({ where: { produtoId_unidadeId: { produtoId: 8, unidadeId: 2 } } });
    expect(estoque?.quantidade).toBe(36);
  });
});
