import request from 'supertest';
import { app } from '../src/app';

export const api = () => request(app);

export const CREDENCIAIS = {
  admin: { email: 'admin@raizes.com', senha: 'Admin@123' },
  gerente: { email: 'gerente@raizes.com', senha: 'Gerente@123' },
  atendente: { email: 'atendente@raizes.com', senha: 'Atend@123' },
  cozinha: { email: 'cozinha@raizes.com', senha: 'Cozinha@123' },
  maria: { email: 'maria@email.com', senha: 'Cliente@123' },
  joao: { email: 'joao@email.com', senha: 'Cliente@123' },
};

export async function login(quem: keyof typeof CREDENCIAIS): Promise<string> {
  const res = await api().post('/auth/login').send(CREDENCIAIS[quem]);
  if (res.status !== 200) throw new Error(`Login falhou para ${quem}: ${res.status}`);
  return res.body.accessToken;
}

export const bearer = (token: string) => ({ Authorization: `Bearer ${token}` });

export function expectErroPadrao(body: Record<string, unknown>, error: string) {
  expect(body).toMatchObject({ error, message: expect.any(String), details: expect.any(Array) });
  expect(body.timestamp).toEqual(expect.any(String));
  expect(body.path).toEqual(expect.any(String));
  expect(body.requestId).toEqual(expect.any(String));
}
