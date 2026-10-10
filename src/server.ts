import { app } from './app';
import { env } from './config/env';
import { prisma } from './infrastructure/database/prisma';
import { logger } from './infrastructure/logger/winston';

const server = app.listen(env.PORT, () => {
  logger.info(`Servidor rodando na porta ${env.PORT} em modo ${env.NODE_ENV}`);
  logger.info(`Swagger: http://localhost:${env.PORT}/api-docs`);
  logger.info(`Healthcheck: http://localhost:${env.PORT}/health`);
});

const shutdown = (signal: string) => {
  logger.info(`${signal} Encerrando...`);
  server.close(async () => {
    await prisma.$disconnect();
    process.exit(0);
  });
};

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
