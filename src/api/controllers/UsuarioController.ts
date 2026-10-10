import { Request, Response } from 'express';
import { UsuarioService } from '../../application/services/UsuarioService';
import { ListarUsuariosQuery } from '../../application/dtos/usuario.dto';
import { auditContext } from '../middlewares/requestContextMiddleware';

export class UsuarioController {
  constructor(private readonly service = new UsuarioService()) {}

  criar = async (req: Request, res: Response) => {
    res.status(201).json(await this.service.criar(req.body, req.user, auditContext(req)));
  };

  listar = async (req: Request, res: Response) => {
    res.json(await this.service.listar(req.query as unknown as ListarUsuariosQuery, auditContext(req)));
  };

  buscarPorId = async (req: Request, res: Response) => {
    res.json(await this.service.buscarPorId(Number(req.params.id), req.user!, auditContext(req)));
  };

  anonimizar = async (req: Request, res: Response) => {
    res.json(await this.service.anonimizar(Number(req.params.id), req.user!, auditContext(req)));
  };
}
