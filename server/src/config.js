/**
 * Reads the environment (docs/server.md §8). Missing required values stop the server.
 */
import { parsePasswordHash } from './admin/password.js';

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

  // The admin pages need both values; without them /admin answers that it is not set up.
  // Production refuses to start without them, so a deploy cannot leave the admin off by mistake.
  const adminPasswordHash = String(env.GUESSAI_ADMIN_PASSWORD_HASH ?? '').trim();
  const sessionSecret = String(env.GUESSAI_SESSION_SECRET ?? '').trim();
  if (adminPasswordHash && !parsePasswordHash(adminPasswordHash)) {
    throw new ConfigError('GUESSAI_ADMIN_PASSWORD_HASH is not a hash from scripts/hash-password.js');
  }
  if (sessionSecret && sessionSecret.length < 32) throw new ConfigError('GUESSAI_SESSION_SECRET must be at least 32 characters');
  if (production && (!adminPasswordHash || !sessionSecret)) {
    throw new ConfigError('GUESSAI_ADMIN_PASSWORD_HASH and GUESSAI_SESSION_SECRET are required in production');
  }
  if (env.HANDOFF_ENABLED !== undefined && !['true', 'false'].includes(env.HANDOFF_ENABLED)) {
    throw new ConfigError('HANDOFF_ENABLED must be true or false');
  }

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
    adminPasswordHash,
    sessionSecret,
    handoffEnabled: env.HANDOFF_ENABLED === 'true',
  };
};
