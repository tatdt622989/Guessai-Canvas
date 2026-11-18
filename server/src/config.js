/**
 * Reads the environment (docs/server.md §8). Missing required values stop the server.
 */

export class ConfigError extends Error {}

const required = (env, name) => {
  const value = String(env[name] ?? '').trim();
  if (!value) throw new ConfigError(`${name} is required`);
  return value;
};

const DEV_ORIGINS = ['http://localhost:5173', 'http://localhost:5174', 'http://127.0.0.1:5173'];

export const loadConfig = (env = process.env, { cwd = process.cwd() } = {}) => {
  const production = env.NODE_ENV === 'production';
  const publicOrigin = new URL(required(env, 'PUBLIC_ORIGIN')).origin;
  const guestSecret = required(env, 'GUESSAI_GUEST_SECRET');
  if (guestSecret.length < 16) throw new ConfigError('GUESSAI_GUEST_SECRET is too short');

  return {
    production,
    port: Number(env.PORT ?? 3010),
    trustProxy: env.TRUST_PROXY === 'true',
    publicOrigin,
    allowedOrigins: production ? [publicOrigin] : [publicOrigin, ...DEV_ORIGINS],
    mongodbUri: required(env, 'MONGODB_URI'),
    guestSecret,
    geminiApiKey: env.GEMINI_API_KEY ?? '',
    geminiModel: env.GEMINI_MODEL || 'gemini-3.1-flash-lite-preview',
    recaptchaSecret: env.RECAPTCHA_SECRET_KEY ?? '',
    uploadDir: env.UPLOAD_DIR || '/data/uploads/img',
    staticDir: env.STATIC_DIR || `${cwd}/../dist`,
  };
};
