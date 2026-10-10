import { execSync } from 'node:child_process';

export default function globalSetup() {
  const env = { ...process.env, NODE_ENV: 'test', DATABASE_URL: 'file:./test.db' };
  execSync('npx prisma db push --force-reset --skip-generate', { env, stdio: 'ignore' });
  execSync('npx prisma db seed', { env, stdio: 'ignore' });
}
