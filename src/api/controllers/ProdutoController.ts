import { Request, Response } from 'express';
import { ProdutoService } from '../../application/services/ProdutoService';
import { ListarProdutosQuery } from '../../application/dtos/produto.dto';
import { auditContext } from '../middlewares/requestContextMiddleware';

export class ProdutoController {
  constructor(private readonly service = new ProdutoService()) {}

  listar = async (req: Request, res: Response) => {
    res.json(await this.service.listar(req.query as unknown as ListarProdutosQuery));
  };

  cardapio = async (req: Request, res: Response) => {
    const categoria = req.query.categoria as string | undefined;
    res.json(await this.service.cardapioPorUnidade(Number(req.params.unidadeId), categoria));
  };

  criar = async (req: Request, res: Response) => {
    res.status(201).json(await this.service.criar(req.body, auditContext(req)));
  };

  atualizar = async (req: Request, res: Response) => {
    res.json(await this.service.atualizar(Number(req.params.id), req.body, auditContext(req)));
  };
}
