import winston from 'winston';
import { env } from '../../config/env';

export const logger = winston.createLogger({
  level: env.LOG_LEVEL,
  silent: env.NODE_ENV === 'test',
  format: winston.format.combine(winston.format.timestamp(), winston.format.json()),
  defaultMeta: { service: 'raizes-do-nordeste-api' },
  transports: [
    new winston.transports.Console({
      format:
        env.NODE_ENV === 'production'
          ? winston.format.json()
          : winston.format.combine(winston.format.colorize(), winston.format.simple()),
    }),
  ],
});
