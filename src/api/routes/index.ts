import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { env } from '../../config/env';
import { validate } from '../middlewares/validateMiddleware';
import { authMiddleware, optionalAuthMiddleware } from '../middlewares/authMiddleware';
import { roleMiddleware } from '../middlewares/roleMiddleware';
import { AppError } from '../../domain/errors/AppError';

import { AuthController } from '../controllers/AuthController';
import { UsuarioController } from '../controllers/UsuarioController';
import { UnidadeController } from '../controllers/UnidadeController';
import { ProdutoController } from '../controllers/ProdutoController';
import { EstoqueController } from '../controllers/EstoqueController';
import { PedidoController } from '../controllers/PedidoController';
import { PagamentoController } from '../controllers/PagamentoController';
import { FidelidadeController } from '../controllers/FidelidadeController';
import { AuditoriaController } from '../controllers/AuditoriaController';

import { loginSchema } from '../../application/dtos/auth.dto';
import { criarUsuarioSchema, listarUsuariosSchema, usuarioIdSchema } from '../../application/dtos/usuario.dto';
import { listarUnidadesSchema, unidadeIdSchema } from '../../application/dtos/unidade.dto';
import {
  atualizarProdutoSchema,
  cardapioUnidadeSchema,
  criarProdutoSchema,
  listarProdutosSchema,
} from '../../application/dtos/produto.dto';
import { estoqueUnidadeSchema, movimentacaoEstoqueSchema } from '../../application/dtos/estoque.dto';
import {
  atualizarStatusSchema,
  criarPedidoSchema,
  listarPedidosSchema,
  pedidoIdSchema,
} from '../../application/dtos/pedido.dto';
import { pagamentoPedidoSchema, processarPagamentoSchema } from '../../application/dtos/pagamento.dto';
import {
  acumularPontosSchema,
  consentimentoFidelidadeSchema,
  historicoFidelidadeSchema,
  resgatarPontosSchema,
} from '../../application/dtos/fidelidade.dto';
import { listarAuditoriaSchema } from '../../application/dtos/auditoria.dto';

const auth = new AuthController();
const usuarios = new UsuarioController();
const unidades = new UnidadeController();
const produtos = new ProdutoController();
const estoque = new EstoqueController();
const pedidos = new PedidoController();
const pagamentos = new PagamentoController();
const fidelidade = new FidelidadeController();
const auditoria = new AuditoriaController();

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  skip: () => env.NODE_ENV === 'test',
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  handler: (_req, _res, next) =>
    next(new AppError('Muitas tentativas de login. Tente novamente em 15 minutos.', 429, 'MUITAS_TENTATIVAS')),
});

const routes = Router();

routes.post('/auth/login', loginLimiter, validate(loginSchema), auth.login);
routes.post('/auth/refresh', authMiddleware, auth.refresh);

routes.post('/usuarios', optionalAuthMiddleware, validate(criarUsuarioSchema), usuarios.criar);
routes.get('/usuarios', authMiddleware, roleMiddleware(['ADMIN', 'GERENTE']), validate(listarUsuariosSchema), usuarios.listar);
routes.get('/usuarios/:id', authMiddleware, validate(usuarioIdSchema), usuarios.buscarPorId);
routes.delete('/usuarios/:id', authMiddleware, validate(usuarioIdSchema), usuarios.anonimizar);

routes.get('/unidades', validate(listarUnidadesSchema), unidades.listar);
routes.get('/unidades/:id', validate(unidadeIdSchema), unidades.buscarPorId);

routes.get('/produtos', validate(listarProdutosSchema), produtos.listar);
routes.get('/produtos/unidade/:unidadeId', validate(cardapioUnidadeSchema), produtos.cardapio);
routes.post('/produtos', authMiddleware, roleMiddleware(['ADMIN', 'GERENTE']), validate(criarProdutoSchema), produtos.criar);
routes.put('/produtos/:id', authMiddleware, roleMiddleware(['ADMIN', 'GERENTE']), validate(atualizarProdutoSchema), produtos.atualizar);

routes.get(
  '/estoque/unidade/:unidadeId',
  authMiddleware,
  roleMiddleware(['ADMIN', 'GERENTE', 'ATENDENTE']),
  validate(estoqueUnidadeSchema),
  estoque.listarPorUnidade,
);
routes.post('/estoque/movimentacao', authMiddleware, roleMiddleware(['ADMIN', 'GERENTE']), validate(movimentacaoEstoqueSchema), estoque.movimentar);

routes.post('/pedidos', authMiddleware, roleMiddleware(['CLIENTE', 'ATENDENTE']), validate(criarPedidoSchema), pedidos.criar);
routes.get('/pedidos', authMiddleware, validate(listarPedidosSchema), pedidos.listar);
routes.get('/pedidos/:id', authMiddleware, validate(pedidoIdSchema), pedidos.buscarPorId);
routes.patch(
  '/pedidos/:id/status',
  authMiddleware,
  roleMiddleware(['COZINHA', 'GERENTE', 'ADMIN']),
  validate(atualizarStatusSchema),
  pedidos.atualizarStatus,
);

routes.post('/pagamentos', authMiddleware, roleMiddleware(['CLIENTE', 'ATENDENTE']), validate(processarPagamentoSchema), pagamentos.processar);
routes.get('/pagamentos/pedido/:pedidoId', authMiddleware, validate(pagamentoPedidoSchema), pagamentos.buscarPorPedido);

routes.get('/fidelidade/saldo', authMiddleware, roleMiddleware(['CLIENTE']), fidelidade.saldo);
routes.post('/fidelidade/acumular', authMiddleware, roleMiddleware(['ADMIN']), validate(acumularPontosSchema), fidelidade.acumular);
routes.post('/fidelidade/resgatar', authMiddleware, roleMiddleware(['CLIENTE']), validate(resgatarPontosSchema), fidelidade.resgatar);
routes.get('/fidelidade/historico', authMiddleware, roleMiddleware(['CLIENTE']), validate(historicoFidelidadeSchema), fidelidade.historico);
routes.put(
  '/fidelidade/consentimento',
  authMiddleware,
  roleMiddleware(['CLIENTE']),
  validate(consentimentoFidelidadeSchema),
  fidelidade.consentimento,
);

routes.get('/auditoria', authMiddleware, roleMiddleware(['ADMIN']), validate(listarAuditoriaSchema), auditoria.listar);

export { routes };
