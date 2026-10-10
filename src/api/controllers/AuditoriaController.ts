import { Request, Response } from 'express';
import { AuditoriaService } from '../../application/services/AuditoriaService';
import { ListarAuditoriaQuery } from '../../application/dtos/auditoria.dto';

export class AuditoriaController {
  constructor(private readonly service = new AuditoriaService()) {}

  listar = async (req: Request, res: Response) => {
    res.json(await this.service.listar(req.query as unknown as ListarAuditoriaQuery));
  };
}
