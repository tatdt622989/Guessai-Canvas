import jwt from 'jsonwebtoken';

/*
 * The guest pass (docs/server.md §2): an HS256 JWT holding { userId }, kept in an HttpOnly cookie
 * for a year. The secret is the old 6yuwei_api SECRET_KEY, so passes issued before the move still work.
 */

export const GUEST_COOKIE = 'guessai_canvas_access_token';
const YEAR_MS = 365 * 24 * 60 * 60 * 1000;

export const createGuestTokens = ({ secret, secure }) => ({
  issue: (userId) => jwt.sign({ userId: String(userId) }, secret, { expiresIn: '1y', algorithm: 'HS256' }),

  /** The player id in a pass, or null when the pass is missing, expired or forged. */
  verify: (token) => {
    if (!token) return null;
    try {
      const { userId } = jwt.verify(token, secret, { algorithms: ['HS256'] });
      return typeof userId === 'string' ? userId : null;
    } catch {
      return null;
    }
  },

  cookieOptions: {
    httpOnly: true, secure, sameSite: 'lax', path: '/', maxAge: YEAR_MS,
  },
});

/** One cookie value from the Cookie header, without a parser dependency. */
export const cookieFrom = (header, name) => {
  const match = String(header ?? '').split(';').map((part) => part.trim())
    .find((part) => part.startsWith(`${name}=`));
  return match ? decodeURIComponent(match.slice(name.length + 1)) : null;
};
