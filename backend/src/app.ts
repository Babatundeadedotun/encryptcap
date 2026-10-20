import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import { env } from './config/env.js';
import { authRouter } from './routes/auth.routes.js';
import { accountsRouter } from './routes/accounts.routes.js';
import { articlesRouter } from './routes/articles.routes.js';
import { requestsRouter } from './routes/requests.routes.js';
import { subscribersRouter } from './routes/subscribers.routes.js';
import { errorHandler, notFound } from './middleware/error.js';
import { TIERS } from './services/domain.js';

export function createApp() {
  const app = express();

  // Behind a proxy (Render, Fly, Heroku) so secure cookies and rate-limit
  // client IPs are read correctly.
  app.set('trust proxy', 1);

  const allowedOrigins = env.clientOrigin.split(',').map((o) => o.trim());

  app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
  app.use(cors({ origin: allowedOrigins, credentials: true }));
  /*
   * Cross-site request forgery guard.
   *
   * The session cookie has to be SameSite=None, because the site (Netlify) and
   * the API (Render) sit on different domains — so the browser will attach it to
   * requests started by *any* site. CORS is not a defence here: it stops another
   * origin reading the response, but the request still runs, and a state-changing
   * request that runs is the whole attack.
   *
   * So anything that changes state must carry an Origin the API recognises.
   * Reads are exempt, and a missing Origin is allowed because browsers always
   * send one on a cross-site write, while server-to-server callers send none.
   */
  app.use((req, res, next) => {
    if (req.method === 'GET' || req.method === 'HEAD' || req.method === 'OPTIONS') {
      next();
      return;
    }

    const origin = req.get('origin');
    if (origin && !allowedOrigins.includes(origin)) {
      res.status(403).json({ error: 'That request came from an origin this API does not serve.' });
      return;
    }

    next();
  });

  app.use(express.json({ limit: '1mb' }));
  app.use(cookieParser());
  if (!env.isProd) app.use(morgan('dev'));

  app.use(
    rateLimit({
      windowMs: 60 * 1000,
      limit: 300,
      standardHeaders: 'draft-7',
      legacyHeaders: false,
    }),
  );

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true, env: env.nodeEnv, time: new Date().toISOString() });
  });

  /** Tier definitions drive the public pricing page, so they come from one place. */
  app.get('/api/tiers', (_req, res) => {
    res.json({ tiers: Object.values(TIERS) });
  });

  app.use('/api/auth', authRouter);
  app.use('/api/accounts', accountsRouter);
  app.use('/api/articles', articlesRouter);
  app.use('/api/capital-requests', requestsRouter);
  app.use('/api/subscribers', subscribersRouter);

  app.use(notFound);
  app.use(errorHandler);

  return app;
}
