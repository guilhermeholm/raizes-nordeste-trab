import 'express-async-errors';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import swaggerUi from 'swagger-ui-express';
import { env } from './config/env';
import { requestContextMiddleware } from './api/middlewares/requestContextMiddleware';
import { errorMiddleware, notFoundMiddleware } from './api/middlewares/errorMiddleware';
import { routes } from './api/routes';
import { openApiSpec } from './api/swagger/swagger';

const app = express();

app.set('trust proxy', 1);
app.use(helmet());
app.use(cors());
app.use(requestContextMiddleware);
app.use(express.json({ limit: '100kb' }));
app.use(
  rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 1000,
    skip: () => env.NODE_ENV === 'test',
    standardHeaders: 'draft-7',
    legacyHeaders: false,
  }),
);

app.get('/health', (_req, res) => {
  res.json({ status: 'OK', message: 'API Raízes do Nordeste operacional.', timestamp: new Date().toISOString() });
});

app.get('/api-docs.json', (_req, res) => res.json(openApiSpec));
app.use('/api-docs', helmet({ contentSecurityPolicy: false }), swaggerUi.serve, swaggerUi.setup(openApiSpec));

app.use('/', routes);

app.use(notFoundMiddleware);
app.use(errorMiddleware);

export { app };
