import crypto from 'node:crypto';
import express from 'express';
import { authRouter } from './routes/auth.routes.js';
import { apiRouter } from './routes/index.js';
import { rateLimit } from './middleware/rateLimit.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';

export function createApp() {
  const app = express();

  app.disable('x-powered-by');
  app.set('trust proxy', true);

  // Assign a trace id to every request (surfaced in error responses).
  app.use((req, _res, next) => {
    req.traceId = crypto.randomBytes(16).toString('hex');
    next();
  });

  // Body parsers — JSON and form-encoded (the token endpoint accepts form data).
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true }));

  // Rate limiting applies to all routes (uses user id once authenticated, else IP).
  app.use(rateLimit);

  // Health check (unauthenticated).
  app.get('/health', (_req, res) => res.json({ status: 'ok' }));

  // Routes — all mounted under /v1 per the OpenAPI servers.
  app.use('/v1/auth', authRouter);
  app.use('/v1', apiRouter);

  // 404 + error handling (must be last).
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
