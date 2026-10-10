import { Request, Response } from 'express';
import { PagamentoService } from '../../application/services/PagamentoService';
import { auditContext } from '../middlewares/requestContextMiddleware';

export class PagamentoController {
  constructor(private readonly service = new PagamentoService()) {}

  processar = async (req: Request, res: Response) => {
    res.status(200).json(await this.service.processar(req.body, req.user!, auditContext(req)));
  };

  buscarPorPedido = async (req: Request, res: Response) => {
    res.json(await this.service.buscarPorPedido(Number(req.params.pedidoId), req.user!));
  };
}
