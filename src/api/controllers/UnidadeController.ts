import { Request, Response } from 'express';
import { UnidadeService } from '../../application/services/UnidadeService';
import { ListarUnidadesQuery } from '../../application/dtos/unidade.dto';

export class UnidadeController {
  constructor(private readonly service = new UnidadeService()) {}

  listar = async (req: Request, res: Response) => {
    res.json(await this.service.listar(req.query as unknown as ListarUnidadesQuery));
  };

  buscarPorId = async (req: Request, res: Response) => {
    res.json(await this.service.buscarPorId(Number(req.params.id)));
  };
}
