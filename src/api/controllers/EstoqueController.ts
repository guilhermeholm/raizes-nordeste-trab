import { Request, Response } from 'express';
import { EstoqueService } from '../../application/services/EstoqueService';
import { auditContext } from '../middlewares/requestContextMiddleware';

export class EstoqueController {
  constructor(private readonly service = new EstoqueService()) {}

  listarPorUnidade = async (req: Request, res: Response) => {
    res.json(await this.service.listarPorUnidade(Number(req.params.unidadeId)));
  };

  movimentar = async (req: Request, res: Response) => {
    res.status(201).json(await this.service.movimentar(req.body, auditContext(req)));
  };
}
