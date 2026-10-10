import type { PerfilUsuario } from '../domain/enums';

export interface UsuarioAutenticado {
  id: number;
  perfil: PerfilUsuario;
}

declare global {
  namespace Express {
    interface Request {
      requestId: string;
      user?: UsuarioAutenticado;
    }
  }
}

export {};
