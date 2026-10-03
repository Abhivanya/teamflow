import cookieParser from 'cookie-parser';
import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import pinoHttp from 'pino-http';
import { env } from './config/env';
import { logger } from './config/logger';
import { errorHandler } from './middleware/errorHandler';
import { requestId } from './middleware/requestId';
import { requireClientHeader } from './middleware/clientHeader';
import { authRoutes } from './routes/auth.routes';
import { apiRoutes } from './routes/api.routes';

export const metrics = { requests: 0, serverErrors: 0 };

export function createApp() {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', 1);
  app.use(helmet());
  app.use(requestId);
  if (env.NODE_ENV !== 'test') {
    app.use(pinoHttp({ logger, customProps: (req) => ({ requestId: (req as express.Request).requestId }) }));
  }
  app.use(cors({ origin: env.CLIENT_URL, credentials: true }));
  app.use(express.json({ limit: '1mb' }));
  app.use(cookieParser());
  app.use((req, res, next) => {
    metrics.requests += 1;
    res.on('finish', () => {
      if (res.statusCode >= 500) metrics.serverErrors += 1;
    });
    next();
  });
  app.use(requireClientHeader);

  app.get('/api/health', (_req, res) => {
    res.json({
      data: {
        ok: true,
        uptime: Math.round(process.uptime()),
        requests: metrics.requests,
        serverErrors: metrics.serverErrors,
      },
    });
  });

  app.use('/api/auth', authRoutes);
  app.use('/api', apiRoutes);
  app.use(errorHandler);
  return app;
}
