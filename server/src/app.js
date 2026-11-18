import fs from 'node:fs';
import path from 'node:path';
import express from 'express';
import helmet from 'helmet';
import { createGameRouter } from './routes/game.js';

/*
 * One Express app for the whole site: the game API under /api/guessai_canvas and the built
 * frontend for every other path.
 */
export const createApp = ({
  config, models, tokens, recaptcha, uploads, isHealthy = async () => true,
}) => {
  const app = express();
  app.set('trust proxy', config.trustProxy);
  app.disable('x-powered-by');

  app.get('/healthz', async (req, res) => {
    const ok = await isHealthy().catch(() => false);
    res.status(ok ? 200 : 503).json({ status: ok ? 'ok' : 'degraded' });
  });

  // The canvas pages set their own sandbox policy, so the shared headers skip CSP
  app.use(helmet({ contentSecurityPolicy: false, crossOriginEmbedderPolicy: false }));

  app.use('/api/guessai_canvas', createGameRouter({
    models, tokens, recaptcha, uploads,
  }));
  app.use('/api', (req, res) => res.status(404).send('Not found'));

  const indexFile = path.join(config.staticDir, 'index.html');
  if (fs.existsSync(indexFile)) {
    app.use(express.static(config.staticDir, { index: false, maxAge: '1h' }));
    // The frontend routes in the browser, so unknown paths get the app
    app.get(/^(?!\/api\/).*/, (req, res) => {
      res.set('Cache-Control', 'no-cache');
      res.sendFile(indexFile);
    });
  }

  // eslint-disable-next-line no-unused-vars
  app.use((error, req, res, next) => {
    console.error(error);
    if (!res.headersSent) res.status(500).send('Server error');
  });

  return app;
};
