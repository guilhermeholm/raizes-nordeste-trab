import { CANAIS_PEDIDO, FORMAS_PAGAMENTO, PERFIS_USUARIO, STATUS_PEDIDO, TIPOS_MOV_ESTOQUE } from '../../domain/enums';

type Schema = Record<string, unknown>;

const ref = (name: string) => ({ $ref: `#/components/schemas/${name}` });
const json = (schema: Schema, example?: unknown) => ({
  content: { 'application/json': { schema, ...(example !== undefined && { example }) } },
});
const ok = (description: string, schema: Schema = { type: 'object' }, example?: unknown) => ({
  description,
  ...json(schema, example),
});
const err = (description: string) => ({ description, ...json(ref('Erro')) });
const body = (schema: Schema, example?: unknown) => ({ required: true, ...json(schema, example) });
const bearer = [{ bearerAuth: [] }];
const pathId = (name = 'id') => ({ name, in: 'path', required: true, schema: { type: 'integer' } });
const q = (name: string, schema: Schema = { type: 'string' }) => ({ name, in: 'query', required: false, schema });
const pageParams = [q('page', { type: 'integer', default: 1 }), q('limit', { type: 'integer', default: 10 })];

const E401 = err('Não autenticado (TOKEN_AUSENTE / TOKEN_INVALIDO)');
const E403 = err('Perfil sem permissão (ACESSO_NEGADO)');
const E404 = err('Recurso não encontrado');
const E422 = err('Falha de validação (VALIDACAO_FALHOU)');

export const openApiSpec = {
  openapi: '3.0.3',
  info: {
    title: 'API Raízes do Nordeste',
    version: '1.0.0',
    description:
      'API back-end da rede de lanchonetes Raízes do Nordeste: pedidos multicanal, estoque por unidade, ' +
      'pagamento mock, programa de fidelidade com consentimento LGPD e trilha de auditoria.\n\n' +
      '**Como testar:** execute `POST /auth/login` com um usuário do seed (ex.: `maria@email.com` / `Cliente@123`), ' +
      'copie o `accessToken` e clique em **Authorize**.\n\n' +
      'Todos os erros seguem o formato `{ error, message, details[], timestamp, path, requestId }`.',
  },
  servers: [{ url: 'http://localhost:3000', description: 'Local' }],
  tags: [
    { name: 'Auth' },
    { name: 'Usuários' },
    { name: 'Unidades' },
    { name: 'Produtos' },
    { name: 'Estoque' },
    { name: 'Pedidos', description: 'Fluxo crítico: pedido → pagamento → status' },
    { name: 'Pagamentos' },
    { name: 'Fidelidade' },
    { name: 'Auditoria' },
  ],
  components: {
    securitySchemes: { bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' } },
    schemas: {
      Erro: {
        type: 'object',
        properties: {
          error: { type: 'string', example: 'ESTOQUE_INSUFICIENTE' },
          message: { type: 'string', example: 'Não há quantidade suficiente para um ou mais itens.' },
          details: {
            type: 'array',
            items: { type: 'object', properties: { field: { type: 'string' }, issue: { type: 'string' } } },
          },
          timestamp: { type: 'string', format: 'date-time' },
          path: { type: 'string', example: '/pedidos' },
          requestId: { type: 'string', format: 'uuid' },
        },
      },
      Paginacao: {
        type: 'object',
        properties: {
          page: { type: 'integer' },
          limit: { type: 'integer' },
          total: { type: 'integer' },
          totalPages: { type: 'integer' },
        },
      },
      LoginResponse: {
        type: 'object',
        properties: {
          accessToken: { type: 'string' },
          tokenType: { type: 'string', example: 'Bearer' },
          expiresIn: { type: 'integer', example: 3600 },
          user: {
            type: 'object',
            properties: { id: { type: 'integer' }, nome: { type: 'string' }, perfil: { type: 'string', enum: PERFIS_USUARIO } },
          },
        },
      },
      Usuario: {
        type: 'object',
        properties: {
          id: { type: 'integer' },
          nome: { type: 'string' },
          email: { type: 'string' },
          perfil: { type: 'string', enum: PERFIS_USUARIO },
          telefone: { type: 'string', nullable: true },
          cpf: { type: 'string', nullable: true, example: '***.***.789-01', description: 'Sempre mascarado (LGPD)' },
          ativo: { type: 'boolean' },
          criadoEm: { type: 'string', format: 'date-time' },
        },
      },
      Unidade: {
        type: 'object',
        properties: {
          id: { type: 'integer' },
          nome: { type: 'string' },
          endereco: { type: 'string' },
          cidade: { type: 'string' },
          estado: { type: 'string' },
          ativa: { type: 'boolean' },
          cozinhaCompleta: { type: 'boolean' },
        },
      },
      Produto: {
        type: 'object',
        properties: {
          id: { type: 'integer' },
          nome: { type: 'string' },
          descricao: { type: 'string', nullable: true },
          categoria: { type: 'string' },
          preco: { type: 'number' },
          sazonal: { type: 'boolean' },
          ativo: { type: 'boolean' },
        },
      },
      ProdutoInput: {
        type: 'object',
        required: ['nome', 'categoria', 'preco'],
        properties: {
          nome: { type: 'string' },
          descricao: { type: 'string' },
          categoria: { type: 'string' },
          preco: { type: 'number' },
          sazonal: { type: 'boolean' },
          ativo: { type: 'boolean' },
          unidades: { type: 'array', items: { type: 'integer' }, description: 'IDs das unidades onde o produto será vendido' },
        },
      },
      Pedido: {
        type: 'object',
        properties: {
          pedidoId: { type: 'integer' },
          clienteId: { type: 'integer' },
          unidadeId: { type: 'integer' },
          status: { type: 'string', enum: STATUS_PEDIDO },
          canalPedido: { type: 'string', enum: CANAIS_PEDIDO },
          formaPagamento: { type: 'string', enum: FORMAS_PAGAMENTO },
          total: { type: 'number' },
          observacao: { type: 'string', nullable: true },
          itens: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                produtoId: { type: 'integer' },
                produtoNome: { type: 'string' },
                quantidade: { type: 'integer' },
                precoUnitario: { type: 'number' },
                subtotal: { type: 'number' },
              },
            },
          },
          criadoEm: { type: 'string', format: 'date-time' },
          atualizadoEm: { type: 'string', format: 'date-time' },
        },
      },
      PedidoInput: {
        type: 'object',
        required: ['canalPedido', 'unidadeId', 'itens'],
        properties: {
          canalPedido: { type: 'string', enum: CANAIS_PEDIDO },
          unidadeId: { type: 'integer' },
          itens: {
            type: 'array',
            minItems: 1,
            items: {
              type: 'object',
              required: ['produtoId', 'quantidade'],
              properties: { produtoId: { type: 'integer' }, quantidade: { type: 'integer', minimum: 1 } },
            },
          },
          formaPagamento: { type: 'string', enum: FORMAS_PAGAMENTO, default: 'MOCK' },
          observacao: { type: 'string' },
          clienteId: { type: 'integer', description: 'Apenas ATENDENTE: vincula o pedido a um cliente cadastrado' },
        },
      },
      Pagamento: {
        type: 'object',
        properties: {
          pagamentoId: { type: 'integer' },
          pedidoId: { type: 'integer' },
          status: { type: 'string', enum: ['APROVADO', 'RECUSADO'] },
          valor: { type: 'number' },
          gatewayTransacaoId: { type: 'string' },
          motivo: { type: 'string', description: 'Presente apenas em recusas' },
          pedidoStatus: { type: 'string', enum: ['CONFIRMADO', 'PAGAMENTO_RECUSADO'] },
          pontosFidelidade: { type: 'integer' },
          processadoEm: { type: 'string', format: 'date-time' },
        },
      },
      Saldo: {
        type: 'object',
        properties: {
          usuarioId: { type: 'integer' },
          pontosAcumulados: { type: 'integer' },
          pontosResgatados: { type: 'integer' },
          saldoPontos: { type: 'integer' },
          consentimento: { type: 'boolean' },
        },
      },
    },
  },
  paths: {
    '/auth/login': {
      post: {
        tags: ['Auth'],
        summary: 'Autenticar e obter token JWT',
        requestBody: body(
          {
            type: 'object',
            required: ['email', 'senha'],
            properties: { email: { type: 'string' }, senha: { type: 'string' } },
          },
          { email: 'maria@email.com', senha: 'Cliente@123' },
        ),
        responses: {
          200: ok('Autenticado', ref('LoginResponse')),
          401: err('CREDENCIAIS_INVALIDAS'),
          422: E422,
          429: err('MUITAS_TENTATIVAS (rate limit: 10/15min por IP)'),
        },
      },
    },
    '/auth/refresh': {
      post: {
        tags: ['Auth'],
        summary: 'Renovar token JWT',
        security: bearer,
        responses: { 200: ok('Novo token', ref('LoginResponse')), 401: E401 },
      },
    },
    '/usuarios': {
      post: {
        tags: ['Usuários'],
        summary: 'Cadastrar usuário (público para CLIENTE; ADMIN para demais perfis)',
        description: 'Registra consentimentos LGPD separados por finalidade (FIDELIZACAO, MARKETING). CPF é criptografado em repouso e nunca retornado.',
        security: [{}, { bearerAuth: [] }],
        requestBody: body(
          {
            type: 'object',
            required: ['nome', 'email', 'senha'],
            properties: {
              nome: { type: 'string' },
              email: { type: 'string' },
              senha: { type: 'string', description: 'Mín. 8 caracteres, com maiúscula, minúscula e número' },
              telefone: { type: 'string' },
              cpf: { type: 'string' },
              perfil: { type: 'string', enum: PERFIS_USUARIO, default: 'CLIENTE' },
              consentimentoLGPD: {
                type: 'object',
                properties: { fidelizacao: { type: 'boolean' }, marketing: { type: 'boolean' } },
              },
            },
          },
          {
            nome: 'Ana Souza',
            email: 'ana@email.com',
            senha: 'Cliente@123',
            telefone: '81988887777',
            cpf: '12345678901',
            consentimentoLGPD: { fidelizacao: true, marketing: false },
          },
        ),
        responses: {
          201: ok('Criado', ref('Usuario')),
          403: err('Perfil diferente de CLIENTE sem token ADMIN'),
          409: err('EMAIL_DUPLICADO'),
          422: E422,
        },
      },
      get: {
        tags: ['Usuários'],
        summary: 'Listar usuários (ADMIN, GERENTE)',
        security: bearer,
        parameters: [...pageParams, q('perfil', { type: 'string', enum: PERFIS_USUARIO })],
        responses: {
          200: ok('Lista paginada', {
            type: 'object',
            properties: { data: { type: 'array', items: ref('Usuario') }, pagination: ref('Paginacao') },
          }),
          401: E401,
          403: E403,
        },
      },
    },
    '/usuarios/{id}': {
      get: {
        tags: ['Usuários'],
        summary: 'Consultar usuário (ADMIN, GERENTE ou o próprio)',
        description: 'Acesso de terceiros a dados pessoais é registrado na auditoria (DADOS_PESSOAIS_ACESSADOS).',
        security: bearer,
        parameters: [pathId()],
        responses: { 200: ok('Usuário', ref('Usuario')), 401: E401, 403: E403, 404: E404 },
      },
      delete: {
        tags: ['Usuários'],
        summary: 'Excluir conta — anonimização LGPD (ADMIN ou o próprio)',
        description: 'Substitui dados pessoais por valores irreversíveis, revoga consentimentos e desativa a conta, preservando o histórico de pedidos.',
        security: bearer,
        parameters: [pathId()],
        responses: { 200: ok('Anonimizado'), 401: E401, 403: E403, 404: E404, 409: err('USUARIO_JA_ANONIMIZADO') },
      },
    },
    '/unidades': {
      get: {
        tags: ['Unidades'],
        summary: 'Listar unidades (público)',
        parameters: [q('cidade'), q('ativa', { type: 'boolean', default: true })],
        responses: {
          200: ok('Unidades', { type: 'object', properties: { data: { type: 'array', items: ref('Unidade') } } }),
        },
      },
    },
    '/unidades/{id}': {
      get: {
        tags: ['Unidades'],
        summary: 'Detalhe da unidade (público)',
        parameters: [pathId()],
        responses: { 200: ok('Unidade', ref('Unidade')), 404: E404 },
      },
    },
    '/produtos': {
      get: {
        tags: ['Produtos'],
        summary: 'Listar produtos (público)',
        parameters: [...pageParams, q('categoria'), q('ativo', { type: 'boolean' })],
        responses: {
          200: ok('Lista paginada', {
            type: 'object',
            properties: { data: { type: 'array', items: ref('Produto') }, pagination: ref('Paginacao') },
          }),
        },
      },
      post: {
        tags: ['Produtos'],
        summary: 'Criar produto (ADMIN, GERENTE)',
        security: bearer,
        requestBody: body(ref('ProdutoInput'), {
          nome: 'Cuscuz Recheado com Charque',
          descricao: 'Cuscuz de milho com charque desfiado e manteiga de garrafa',
          categoria: 'CUSCUZ',
          preco: 22.5,
          sazonal: false,
          unidades: [1, 2, 3],
        }),
        responses: { 201: ok('Criado', ref('Produto')), 401: E401, 403: E403, 422: E422 },
      },
    },
    '/produtos/{id}': {
      put: {
        tags: ['Produtos'],
        summary: 'Atualizar produto (ADMIN, GERENTE)',
        security: bearer,
        parameters: [pathId()],
        requestBody: body(ref('ProdutoInput'), { preco: 19.9 }),
        responses: { 200: ok('Atualizado', ref('Produto')), 401: E401, 403: E403, 404: E404, 422: E422 },
      },
    },
    '/produtos/unidade/{unidadeId}': {
      get: {
        tags: ['Produtos'],
        summary: 'Cardápio da unidade com disponibilidade (público)',
        parameters: [pathId('unidadeId'), q('categoria')],
        responses: { 200: ok('Cardápio'), 404: E404 },
      },
    },
    '/estoque/unidade/{unidadeId}': {
      get: {
        tags: ['Estoque'],
        summary: 'Estoque da unidade (ADMIN, GERENTE, ATENDENTE)',
        description: 'Status por item: OK, ESTOQUE_BAIXO (≤ mínimo) ou SEM_ESTOQUE.',
        security: bearer,
        parameters: [pathId('unidadeId')],
        responses: { 200: ok('Estoque'), 401: E401, 403: E403, 404: E404 },
      },
    },
    '/estoque/movimentacao': {
      post: {
        tags: ['Estoque'],
        summary: 'Registrar entrada/saída/ajuste (ADMIN, GERENTE)',
        description: 'ENTRADA soma, SAIDA subtrai, AJUSTE define a quantidade absoluta (inventário).',
        security: bearer,
        requestBody: body(
          {
            type: 'object',
            required: ['produtoId', 'unidadeId', 'tipo', 'quantidade'],
            properties: {
              produtoId: { type: 'integer' },
              unidadeId: { type: 'integer' },
              tipo: { type: 'string', enum: TIPOS_MOV_ESTOQUE },
              quantidade: { type: 'integer' },
              motivo: { type: 'string' },
            },
          },
          { produtoId: 1, unidadeId: 1, tipo: 'ENTRADA', quantidade: 100, motivo: 'Reposição semanal' },
        ),
        responses: {
          201: ok('Movimentação registrada'),
          401: E401,
          403: E403,
          404: E404,
          409: err('ESTOQUE_NEGATIVO'),
          422: E422,
        },
      },
    },
    '/pedidos': {
      post: {
        tags: ['Pedidos'],
        summary: 'Criar pedido (CLIENTE, ATENDENTE)',
        description:
          'Valida cardápio da unidade e estoque, calcula o total com o preço do banco e baixa o estoque de forma atômica. ' +
          'O pedido nasce em AGUARDANDO_PAGAMENTO.',
        security: bearer,
        requestBody: body(ref('PedidoInput'), {
          canalPedido: 'TOTEM',
          unidadeId: 1,
          itens: [
            { produtoId: 1, quantidade: 2 },
            { produtoId: 3, quantidade: 1 },
          ],
          formaPagamento: 'MOCK',
          observacao: 'Sem cebola na tapioca',
        }),
        responses: {
          201: ok('Pedido criado', ref('Pedido')),
          401: E401,
          403: E403,
          404: err('UNIDADE_NAO_ENCONTRADA / PRODUTO_NAO_ENCONTRADO'),
          409: err('ESTOQUE_INSUFICIENTE / PRODUTO_INDISPONIVEL / UNIDADE_INATIVA'),
          422: E422,
        },
      },
      get: {
        tags: ['Pedidos'],
        summary: 'Listar pedidos (CLIENTE vê só os seus; funcionários veem todos)',
        security: bearer,
        parameters: [
          ...pageParams,
          q('canalPedido', { type: 'string', enum: CANAIS_PEDIDO }),
          q('status', { type: 'string', enum: STATUS_PEDIDO }),
          q('unidadeId', { type: 'integer' }),
        ],
        responses: {
          200: ok('Lista paginada', {
            type: 'object',
            properties: { data: { type: 'array', items: ref('Pedido') }, pagination: ref('Paginacao') },
          }),
          401: E401,
        },
      },
    },
    '/pedidos/{id}': {
      get: {
        tags: ['Pedidos'],
        summary: 'Detalhe do pedido (dono ou funcionário)',
        security: bearer,
        parameters: [pathId()],
        responses: { 200: ok('Pedido', ref('Pedido')), 401: E401, 403: E403, 404: E404 },
      },
    },
    '/pedidos/{id}/status': {
      patch: {
        tags: ['Pedidos'],
        summary: 'Atualizar status (COZINHA, GERENTE, ADMIN)',
        description:
          'Transições: AGUARDANDO_PAGAMENTO→CANCELADO; CONFIRMADO→EM_PREPARO|CANCELADO; EM_PREPARO→PRONTO; ' +
          'PRONTO→ENTREGUE; PAGAMENTO_RECUSADO→CANCELADO. CONFIRMADO só via pagamento. Cancelamento devolve itens ao estoque.',
        security: bearer,
        parameters: [pathId()],
        requestBody: body(
          {
            type: 'object',
            required: ['status'],
            properties: { status: { type: 'string', enum: STATUS_PEDIDO }, motivo: { type: 'string' } },
          },
          { status: 'EM_PREPARO' },
        ),
        responses: {
          200: ok('Status atualizado', {
            type: 'object',
            properties: {
              pedidoId: { type: 'integer' },
              statusAnterior: { type: 'string' },
              statusAtual: { type: 'string' },
              atualizadoEm: { type: 'string', format: 'date-time' },
            },
          }),
          401: E401,
          403: E403,
          404: E404,
          409: err('TRANSICAO_STATUS_INVALIDA'),
          422: E422,
        },
      },
    },
    '/pagamentos': {
      post: {
        tags: ['Pagamentos'],
        summary: 'Processar pagamento via gateway mock (CLIENTE, ATENDENTE)',
        description:
          'Aprovado → pedido CONFIRMADO + pontos de fidelidade (1 ponto/R$). Recusado → PAGAMENTO_RECUSADO + estorno do estoque. ' +
          'Sem `cenario`, o mock aprova ~80% (valores > R$ 1.000 são recusados). Use `cenario` para resultados determinísticos.',
        security: bearer,
        requestBody: body(
          {
            type: 'object',
            required: ['pedidoId'],
            properties: { pedidoId: { type: 'integer' }, cenario: { type: 'string', enum: ['APROVAR', 'RECUSAR'] } },
          },
          { pedidoId: 1, cenario: 'APROVAR' },
        ),
        responses: {
          200: ok('Pagamento processado (aprovado ou recusado)', ref('Pagamento')),
          401: E401,
          403: E403,
          404: E404,
          409: err('PAGAMENTO_JA_PROCESSADO'),
          422: E422,
        },
      },
    },
    '/pagamentos/pedido/{pedidoId}': {
      get: {
        tags: ['Pagamentos'],
        summary: 'Consultar pagamento de um pedido (dono ou funcionário)',
        security: bearer,
        parameters: [pathId('pedidoId')],
        responses: { 200: ok('Pagamento'), 401: E401, 403: E403, 404: E404 },
      },
    },
    '/fidelidade/saldo': {
      get: {
        tags: ['Fidelidade'],
        summary: 'Saldo de pontos (CLIENTE)',
        security: bearer,
        responses: { 200: ok('Saldo', ref('Saldo')), 401: E401, 403: E403, 404: E404 },
      },
    },
    '/fidelidade/acumular': {
      post: {
        tags: ['Fidelidade'],
        summary: 'Acumular pontos de um pedido pago manualmente (ADMIN)',
        description: 'O acúmulo é automático na aprovação do pagamento; este endpoint serve para reprocessamento.',
        security: bearer,
        requestBody: body({ type: 'object', required: ['pedidoId'], properties: { pedidoId: { type: 'integer' } } }),
        responses: {
          200: ok('Pontos acumulados'),
          401: E401,
          403: E403,
          404: E404,
          409: err('PONTOS_JA_ACUMULADOS / PEDIDO_NAO_PAGO / SEM_CONSENTIMENTO_FIDELIDADE'),
        },
      },
    },
    '/fidelidade/resgatar': {
      post: {
        tags: ['Fidelidade'],
        summary: 'Resgatar pontos (CLIENTE) — 10 pontos = R$ 1,00 (simulado)',
        security: bearer,
        requestBody: body(
          {
            type: 'object',
            required: ['pontos'],
            properties: { pontos: { type: 'integer' }, descricao: { type: 'string' } },
          },
          { pontos: 10, descricao: 'Resgate para desconto' },
        ),
        responses: { 200: ok('Resgatado'), 401: E401, 403: E403, 409: err('SALDO_INSUFICIENTE'), 422: E422 },
      },
    },
    '/fidelidade/historico': {
      get: {
        tags: ['Fidelidade'],
        summary: 'Histórico de movimentações (CLIENTE)',
        security: bearer,
        parameters: pageParams,
        responses: { 200: ok('Lista paginada'), 401: E401, 403: E403 },
      },
    },
    '/fidelidade/consentimento': {
      put: {
        tags: ['Fidelidade'],
        summary: 'Conceder/revogar consentimento LGPD para fidelização (CLIENTE)',
        security: bearer,
        requestBody: body(
          { type: 'object', required: ['consentimento'], properties: { consentimento: { type: 'boolean' } } },
          { consentimento: true },
        ),
        responses: { 200: ok('Consentimento registrado'), 401: E401, 403: E403, 422: E422 },
      },
    },
    '/auditoria': {
      get: {
        tags: ['Auditoria'],
        summary: 'Consultar trilha de auditoria (ADMIN)',
        security: bearer,
        parameters: [...pageParams, q('recurso'), q('recursoId', { type: 'integer' }), q('acao'), q('usuarioId', { type: 'integer' })],
        responses: { 200: ok('Lista paginada'), 401: E401, 403: E403 },
      },
    },
  },
};
