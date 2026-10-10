import { prisma } from '../../src/infrastructure/database/prisma';
import { api, bearer, expectErroPadrao, login } from '../helpers';

let tokenAdmin: string;
let tokenGerente: string;

beforeAll(async () => {
  [tokenAdmin, tokenGerente] = await Promise.all([login('admin'), login('gerente')]);
});

afterAll(() => prisma.$disconnect());

describe('Usuários e LGPD', () => {
  let novoId: number;
  let tokenNovo: string;

  it('cadastro público de cliente registra consentimentos e não retorna CPF/senha', async () => {
    const res = await api()
      .post('/usuarios')
      .send({
        nome: 'Ana Souza',
        email: 'ana@email.com',
        senha: 'Cliente@123',
        cpf: '12345678901',
        consentimentoLGPD: { fidelizacao: true, marketing: false },
      });
    expect(res.status).toBe(201);
    expect(res.body).not.toHaveProperty('cpf');
    expect(res.body).not.toHaveProperty('senhaHash');
    novoId = res.body.id;

    const consentimentos = await prisma.consentimentoLGPD.findMany({ where: { usuarioId: novoId } });
    expect(consentimentos.map((c) => [c.finalidade, c.consentido])).toEqual(
      expect.arrayContaining([
        ['FIDELIZACAO', true],
        ['MARKETING', false],
      ]),
    );
    const salvo = await prisma.usuario.findUnique({ where: { id: novoId } });
    expect(salvo?.cpf).not.toContain('12345678901');
  });

  it('e-mail duplicado → 409', async () => {
    const res = await api().post('/usuarios').send({ nome: 'Ana 2', email: 'ana@email.com', senha: 'Cliente@123' });
    expect(res.status).toBe(409);
    expectErroPadrao(res.body, 'EMAIL_DUPLICADO');
  });

  it('cadastro público não pode criar ADMIN', async () => {
    const res = await api()
      .post('/usuarios')
      .send({ nome: 'Hacker', email: 'h@x.com', senha: 'Senha@123', perfil: 'ADMIN' });
    expect(res.status).toBe(403);
  });

  it('senha fraca → 422', async () => {
    const res = await api().post('/usuarios').send({ nome: 'Fulano', email: 'f@x.com', senha: '123' });
    expect(res.status).toBe(422);
  });

  it('consulta de usuário retorna CPF mascarado e registra o acesso (LGPD)', async () => {
    const res = await api().get(`/usuarios/${novoId}`).set(bearer(tokenGerente));
    expect(res.status).toBe(200);
    expect(res.body.cpf).toBe('***.***.789-01');

    const log = await prisma.auditLog.findFirst({
      where: { acao: 'DADOS_PESSOAIS_ACESSADOS', recursoId: novoId },
    });
    expect(log).not.toBeNull();
  });

  it('listagem paginada restrita a ADMIN/GERENTE', async () => {
    const res = await api().get('/usuarios?perfil=CLIENTE&limit=2').set(bearer(tokenAdmin));
    expect(res.status).toBe(200);
    expect(res.body.pagination).toMatchObject({ page: 1, limit: 2 });
    expect(res.body.data[0]).not.toHaveProperty('senhaHash');
  });

  it('usuário pode revogar consentimento de fidelização', async () => {
    tokenNovo = (await api().post('/auth/login').send({ email: 'ana@email.com', senha: 'Cliente@123' })).body.accessToken;
    const res = await api().put('/fidelidade/consentimento').set(bearer(tokenNovo)).send({ consentimento: false });
    expect(res.status).toBe(200);
    expect(res.body.consentimento).toBe(false);
  });

  it('exclusão de conta anonimiza os dados e bloqueia login', async () => {
    const res = await api().delete(`/usuarios/${novoId}`).set(bearer(tokenNovo));
    expect(res.status).toBe(200);
    const u = await prisma.usuario.findUnique({ where: { id: novoId } });
    expect(u).toMatchObject({ ativo: false, cpf: null });
    expect(u?.nome).toMatch(/^ANONIMIZADO_/);

    const loginRes = await api().post('/auth/login').send({ email: 'ana@email.com', senha: 'Cliente@123' });
    expect(loginRes.status).toBe(401);
  });

  it('refresh de token', async () => {
    const res = await api().post('/auth/refresh').set(bearer(tokenAdmin));
    expect(res.status).toBe(200);
    expect(res.body.accessToken).toEqual(expect.any(String));
  });

  it('token inválido → 401 TOKEN_INVALIDO', async () => {
    const res = await api().get('/usuarios').set(bearer('abc.def.ghi'));
    expect(res.status).toBe(401);
    expectErroPadrao(res.body, 'TOKEN_INVALIDO');
  });
});

describe('Unidades e produtos', () => {
  it('lista unidades com filtro por cidade', async () => {
    const res = await api().get('/unidades?cidade=Recife');
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(2);
  });

  it('unidade inexistente → 404', async () => {
    const res = await api().get('/unidades/999');
    expect(res.status).toBe(404);
    expectErroPadrao(res.body, 'UNIDADE_NAO_ENCONTRADA');
  });

  it('gerente cria produto vinculado às unidades e atualiza o preço', async () => {
    const criado = await api()
      .post('/produtos')
      .set(bearer(tokenGerente))
      .send({ nome: 'Tapioca de Frango', categoria: 'tapioca', preco: 17.5, unidades: [1, 2] });
    expect(criado.status).toBe(201);
    expect(criado.body.categoria).toBe('TAPIOCA');

    const atualizado = await api().put(`/produtos/${criado.body.id}`).set(bearer(tokenGerente)).send({ preco: 19.9 });
    expect(atualizado.status).toBe(200);
    expect(atualizado.body.preco).toBe(19.9);
  });

  it('listagem de produtos paginada e filtrada', async () => {
    const res = await api().get('/produtos?categoria=SUCO');
    expect(res.status).toBe(200);
    expect(res.body.data.every((p: { categoria: string }) => p.categoria === 'SUCO')).toBe(true);
  });
});

describe('Estoque', () => {
  it('consulta estoque da unidade com status ESTOQUE_BAIXO', async () => {
    const res = await api().get('/estoque/unidade/1').set(bearer(tokenGerente));
    expect(res.status).toBe(200);
    expect(res.body.data[0]).toHaveProperty('status');
  });

  it('entrada de estoque incrementa a quantidade e é auditada', async () => {
    const res = await api()
      .post('/estoque/movimentacao')
      .set(bearer(tokenGerente))
      .send({ produtoId: 9, unidadeId: 1, tipo: 'ENTRADA', quantidade: 10, motivo: 'Reposição' });
    expect(res.status).toBe(201);
    expect(res.body.estoqueAtual).toBe(34 + 10);

    const log = await prisma.auditLog.findFirst({ where: { acao: 'ESTOQUE_MOVIMENTADO' }, orderBy: { id: 'desc' } });
    expect(log).not.toBeNull();
  });

  it('saída que deixaria estoque negativo → 409', async () => {
    const res = await api()
      .post('/estoque/movimentacao')
      .set(bearer(tokenGerente))
      .send({ produtoId: 9, unidadeId: 1, tipo: 'SAIDA', quantidade: 1000 });
    expect(res.status).toBe(409);
    expectErroPadrao(res.body, 'ESTOQUE_NEGATIVO');
  });

  it('ajuste define a quantidade absoluta', async () => {
    const res = await api()
      .post('/estoque/movimentacao')
      .set(bearer(tokenAdmin))
      .send({ produtoId: 9, unidadeId: 1, tipo: 'AJUSTE', quantidade: 7, motivo: 'Inventário' });
    expect(res.status).toBe(201);
    expect(res.body.estoqueAtual).toBe(7);
  });
});

describe('Fidelidade', () => {
  it('resgate acima do saldo → 409 SALDO_INSUFICIENTE', async () => {
    const token = await login('joao');
    const res = await api().post('/fidelidade/resgatar').set(bearer(token)).send({ pontos: 50 });
    expect(res.status).toBe(409);
    expectErroPadrao(res.body, 'SALDO_INSUFICIENTE');
  });

  it('acúmulo, resgate e histórico de pontos', async () => {
    const token = await login('joao');
    const pedido = await api()
      .post('/pedidos')
      .set(bearer(token))
      .send({ canalPedido: 'APP', unidadeId: 2, itens: [{ produtoId: 5, quantidade: 2 }] });
    const pg = await api().post('/pagamentos').set(bearer(token)).send({ pedidoId: pedido.body.pedidoId, cenario: 'APROVAR' });
    expect(pg.body.pontosFidelidade).toBe(65);

    const dup = await api().post('/fidelidade/acumular').set(bearer(tokenAdmin)).send({ pedidoId: pedido.body.pedidoId });
    expect(dup.status).toBe(409);
    expectErroPadrao(dup.body, 'PONTOS_JA_ACUMULADOS');

    const resgate = await api().post('/fidelidade/resgatar').set(bearer(token)).send({ pontos: 30 });
    expect(resgate.status).toBe(200);
    expect(resgate.body).toMatchObject({ pontosResgatados: 30, saldoAtual: 35, descontoConcedido: 3 });

    const hist = await api().get('/fidelidade/historico').set(bearer(token));
    expect(hist.body.data.map((m: { tipo: string }) => m.tipo)).toEqual(['RESGATE', 'ACUMULO']);
  });
});

describe('Infra', () => {
  it('rota inexistente → 404 no padrão de erro', async () => {
    const res = await api().get('/nao-existe');
    expect(res.status).toBe(404);
    expectErroPadrao(res.body, 'ROTA_NAO_ENCONTRADA');
  });

  it('JSON malformado → 400', async () => {
    const res = await api().post('/auth/login').set('Content-Type', 'application/json').send('{"email":');
    expect(res.status).toBe(400);
    expectErroPadrao(res.body, 'JSON_INVALIDO');
  });

  it('propaga X-Request-Id e expõe a especificação OpenAPI', async () => {
    const res = await api().get('/api-docs.json').set('X-Request-Id', 'teste-123');
    expect(res.headers['x-request-id']).toBe('teste-123');
    expect(res.body.openapi).toBe('3.0.3');
    expect(Object.keys(res.body.paths).length).toBeGreaterThanOrEqual(20);
  });
});
