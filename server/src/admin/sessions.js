import crypto from 'node:crypto';

/*
 * Admin sessions (docs/server.md §6.1). The cookie holds a random id; MongoDB holds only an HMAC
 * of it with GUESSAI_SESSION_SECRET, so a copy of the database cannot be used as a cookie, and a
 * new secret signs every admin out. Idle 30 minutes, at most 8 hours.
 */

export const IDLE_MS = 30 * 60 * 1000;
export const ABSOLUTE_MS = 8 * 60 * 60 * 1000;

export const adminCookieName = (secure) => (secure ? '__Host-guessai_admin' : 'guessai_admin');

const expiryOf = (createdAt, lastSeenAt) => new Date(Math.min(
  lastSeenAt.getTime() + IDLE_MS,
  createdAt.getTime() + ABSOLUTE_MS,
));

export const createAdminSessions = ({
  model, secret, secure, now = () => new Date(),
}) => {
  const cookieName = adminCookieName(secure);
  const cookieOptions = { httpOnly: true, secure, sameSite: 'strict', path: '/' };
  const idHashOf = (id) => crypto.createHmac('sha256', secret).update(id).digest('hex');
  const idOf = (req) => {
    const value = String(req.headers.cookie ?? '').split(';').map((part) => part.trim())
      .find((part) => part.startsWith(`${cookieName}=`));
    const id = value?.slice(cookieName.length + 1);
    return id && /^[A-Za-z0-9_-]{43}$/.test(id) ? id : null;
  };

  /** Starts a session and sets its cookie. Returns { csrfToken }. */
  const start = async (res) => {
    const id = crypto.randomBytes(32).toString('base64url');
    const at = now();
    const session = await model.create({
      idHash: idHashOf(id),
      csrfToken: crypto.randomBytes(32).toString('base64url'),
      createdAt: at,
      lastSeenAt: at,
      expiresAt: expiryOf(at, at),
    });
    res.cookie(cookieName, id, cookieOptions);
    return { csrfToken: session.csrfToken };
  };

  /** The live session of this request, kept alive for another 30 minutes, or null. */
  const read = async (req) => {
    const id = idOf(req);
    if (!id) return null;
    const at = now();
    const session = await model.findOne({ idHash: idHashOf(id), expiresAt: { $gt: at } });
    if (!session) return null;
    session.lastSeenAt = at;
    session.expiresAt = expiryOf(session.createdAt, at);
    await session.save();
    return { csrfToken: session.csrfToken, expiresAt: session.expiresAt };
  };

  const end = async (req, res) => {
    const id = idOf(req);
    if (id) await model.deleteOne({ idHash: idHashOf(id) });
    res.clearCookie(cookieName, cookieOptions);
  };

  return { start, read, end };
};

/** Compares a form's CSRF token with the session's, in constant time. */
export const sameToken = (expected, received) => {
  if (typeof expected !== 'string' || typeof received !== 'string') return false;
  const a = Buffer.from(expected);
  const b = Buffer.from(received);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
};
