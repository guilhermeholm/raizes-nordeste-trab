import { Request, Response } from 'express';
import { PedidoService } from '../../application/services/PedidoService';
import { ListarPedidosQuery } from '../../application/dtos/pedido.dto';
import { auditContext } from '../middlewares/requestContextMiddleware';

export class PedidoController {
  constructor(private readonly service = new PedidoService()) {}

  criar = async (req: Request, res: Response) => {
    res.status(201).json(await this.service.criar(req.body, req.user!, auditContext(req)));
  };

  listar = async (req: Request, res: Response) => {
    res.json(await this.service.listar(req.query as unknown as ListarPedidosQuery, req.user!));
  };

  buscarPorId = async (req: Request, res: Response) => {
    res.json(await this.service.buscarPorId(Number(req.params.id), req.user!));
  };

  atualizarStatus = async (req: Request, res: Response) => {
    res.json(await this.service.atualizarStatus(Number(req.params.id), req.body, req.user!, auditContext(req)));
  };
}
