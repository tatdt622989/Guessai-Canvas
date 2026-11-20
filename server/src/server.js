import http from 'node:http';
import mongoose from 'mongoose';
import { createAdminRouter } from './admin/router.js';
import { createAdminService } from './admin/service.js';
import { createAdminSessions } from './admin/sessions.js';
import { createApp } from './app.js';
import { createCanvasGenerator, createGeminiDrawer } from './canvas/generator.js';
import { ConfigError, loadConfig } from './config.js';
import { createGuestTokens } from './guestToken.js';
import { createHandoff } from './handoff.js';
import { createModels } from './models.js';
import { createRecaptcha } from './recaptcha.js';
import { createSocketServer } from './socket.js';
import { createUploads } from './uploads.js';

const main = async () => {
  let config;
  try {
    config = loadConfig();
  } catch (error) {
    if (error instanceof ConfigError) {
      console.error(`configuration error: ${error.message}`);
      process.exit(1);
    }
    throw error;
  }

  const connection = await mongoose.createConnection(config.mongodbUri).asPromise();
  const models = createModels(connection);
  const tokens = createGuestTokens({ secret: config.guestSecret, secure: config.production });

  // @google/genai adds about 25 MB, so it loads on the first canvas
  let gemini;
  const getGemini = async () => {
    if (!gemini) {
      const { GoogleGenAI, FunctionCallingConfigMode } = await import('@google/genai');
      gemini = { client: new GoogleGenAI({ apiKey: config.geminiApiKey }), FunctionCallingConfigMode };
    }
    return gemini;
  };
  const generator = createCanvasGenerator({ models, draw: createGeminiDrawer({ getGemini, model: config.geminiModel }) });
  const uploads = createUploads({ dir: config.uploadDir });

  // socket.io attaches to the HTTP server, which needs the app first; admin actions reach the
  // players through this reference once it is set
  let io;
  const adminConfigured = Boolean(config.adminPasswordHash && config.sessionSecret);
  const adminRouter = createAdminRouter({
    service: createAdminService({
      models,
      uploads,
      generateCanvas: () => generator.generate(io),
      notifyRanking: (ranking) => io?.emit('server ranking', ranking),
    }),
    sessions: adminConfigured
      ? createAdminSessions({ model: models.AdminSession, secret: config.sessionSecret, secure: config.production })
      : null,
    passwordHash: config.adminPasswordHash,
  });

  const app = createApp({
    config,
    models,
    tokens,
    recaptcha: createRecaptcha({ secret: config.recaptchaSecret }),
    uploads,
    handoffRouter: createHandoff({ models, tokens, publicOrigin: config.publicOrigin }).router(config.handoffEnabled),
    adminRouter,
    isHealthy: async () => connection.readyState === 1,
  });

  const httpServer = http.createServer(app);
  io = createSocketServer({
    httpServer, allowedOrigins: config.allowedOrigins, models, tokens, generator,
  });
  httpServer.listen(config.port, () => console.log(`Guessai on port ${config.port}`));

  const stop = () => httpServer.close(() => connection.close().finally(() => process.exit(0)));
  process.on('SIGTERM', stop);
  process.on('SIGINT', stop);
};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
