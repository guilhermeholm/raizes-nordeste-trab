import { Request, Response } from 'express';
import { AuthService } from '../../application/services/AuthService';

export class AuthController {
  constructor(private readonly authService = new AuthService()) {}

  login = async (req: Request, res: Response) => {
    res.status(200).json(await this.authService.login(req.body));
  };

  refresh = async (req: Request, res: Response) => {
    res.status(200).json(await this.authService.refresh(req.user!.id));
  };
}
