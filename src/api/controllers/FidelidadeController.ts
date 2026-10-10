import { Request, Response } from 'express';
import { fidelidadeService } from '../../application/services/FidelidadeService';
import { auditContext } from '../middlewares/requestContextMiddleware';

export class FidelidadeController {
  constructor(private readonly service = fidelidadeService) {}

  saldo = async (req: Request, res: Response) => {
    res.json(await this.service.saldo(req.user!.id));
  };

  acumular = async (req: Request, res: Response) => {
    res.json(await this.service.acumular(req.body.pedidoId, auditContext(req)));
  };

  resgatar = async (req: Request, res: Response) => {
    res.json(await this.service.resgatar(req.user!.id, req.body, auditContext(req)));
  };

  historico = async (req: Request, res: Response) => {
    const { page, limit } = req.query as unknown as { page: number; limit: number };
    res.json(await this.service.historico(req.user!.id, page, limit));
  };

  consentimento = async (req: Request, res: Response) => {
    res.json(await this.service.atualizarConsentimento(req.user!.id, req.body.consentimento, auditContext(req)));
  };
}
