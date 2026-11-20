import crypto from 'node:crypto';
import { promisify } from 'node:util';

/*
 * The admin password hash (docs/server.md §6.1): scrypt, stored as
 * scrypt:<N>:<r>:<p>:<salt>:<hash> with base64url salt and hash. No `$`, which compose files and
 * Coolify would read as a variable.
 */

const scrypt = promisify(crypto.scrypt);
const PARAMS = { N: 2 ** 15, r: 8, p: 1 };
const KEY_LENGTH = 32;
const maxmemFor = (N, r) => 256 * N * r;

export const hashPassword = async (password, { N, r, p } = PARAMS) => {
  const salt = crypto.randomBytes(16);
  const hash = await scrypt(password, salt, KEY_LENGTH, { N, r, p, maxmem: maxmemFor(N, r) });
  return ['scrypt', N, r, p, salt.toString('base64url'), hash.toString('base64url')].join(':');
};

/** The parsed hash, or null when the value is not one hashPassword made. */
export const parsePasswordHash = (value) => {
  const parts = String(value ?? '').split(':');
  if (parts.length !== 6 || parts[0] !== 'scrypt') return null;
  const [N, r, p] = parts.slice(1, 4).map(Number);
  const salt = Buffer.from(parts[4], 'base64url');
  const hash = Buffer.from(parts[5], 'base64url');
  const powerOfTwo = Number.isInteger(N) && N >= 2 ** 14 && N <= 2 ** 20 && (N & (N - 1)) === 0;
  if (!powerOfTwo || !Number.isInteger(r) || r < 1 || r > 32 || !Number.isInteger(p) || p < 1 || p > 16) return null;
  if (salt.length < 16 || hash.length !== KEY_LENGTH) return null;
  return { N, r, p, salt, hash };
};

export const verifyPassword = async (password, stored) => {
  const parsed = parsePasswordHash(stored);
  if (!parsed || typeof password !== 'string' || password.length === 0 || password.length > 1024) return false;
  const { N, r, p, salt, hash } = parsed;
  const candidate = await scrypt(password, salt, KEY_LENGTH, { N, r, p, maxmem: maxmemFor(N, r) });
  return crypto.timingSafeEqual(candidate, hash);
};
