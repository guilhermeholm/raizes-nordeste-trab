import { z } from 'zod';
import dotenv from 'dotenv';

dotenv.config({ quiet: true });

const envSchema = z.object({
  PORT: z.coerce.number().default(3000),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  DATABASE_URL: z.string().default('file:./dev.db'),
  JWT_SECRET: z.string().min(16).default('secret_dev_raizes_nordeste_2026'),
  JWT_EXPIRES_IN: z.coerce.number().int().positive().default(3600),
  LGPD_DATA_RETENTION_DAYS: z.coerce.number().default(365),
  LOG_LEVEL: z.string().default('info'),
  DATA_ENCRYPTION_KEY: z.string().min(16).default('dev_data_key_raizes_nordeste_2026'),
  PAGAMENTO_TAXA_APROVACAO: z.coerce.number().min(0).max(1).default(0.8),
});

const _env = envSchema.safeParse(process.env);

if (!_env.success) {
  console.error('Variáveis de ambiente inválidas:', z.treeifyError(_env.error));
  process.exit(1);
}

export const env = _env.data;
