import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';
import { env } from '../../config/env';

const KEY = createHash('sha256').update(env.DATA_ENCRYPTION_KEY).digest();

export function encrypt(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', KEY, iv);
  const data = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  return [iv, cipher.getAuthTag(), data].map((b) => b.toString('base64')).join('.');
}

export function decrypt(payload: string): string {
  const [iv, tag, data] = payload.split('.').map((p) => Buffer.from(p, 'base64'));
  const decipher = createDecipheriv('aes-256-gcm', KEY, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8');
}

export function mascararCpf(cpfCriptografado: string | null): string | null {
  if (!cpfCriptografado) return null;
  try {
    const cpf = decrypt(cpfCriptografado);
    return `***.***.${cpf.slice(6, 9)}-${cpf.slice(9)}`;
  } catch {
    return '***.***.***-**';
  }
}
