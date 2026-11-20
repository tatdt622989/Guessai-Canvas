/*
 * Login attempts per IP: 10 in 15 minutes (docs/server.md §6.1). A correct password clears the
 * count. Kept in memory; the service runs as one container, and a restart only gives an attacker
 * one more window.
 */

export const LOGIN_LIMIT = 10;
export const LOGIN_WINDOW_MS = 15 * 60 * 1000;

export const createLoginLimiter = ({ limit = LOGIN_LIMIT, windowMs = LOGIN_WINDOW_MS, now = () => Date.now() } = {}) => {
  const attempts = new Map();

  const prune = (at) => {
    attempts.forEach((entry, key) => { if (entry.resetAt <= at) attempts.delete(key); });
  };

  /** Counts one attempt. Returns true while the IP is under the limit. */
  const allow = (ip) => {
    const at = now();
    prune(at);
    const entry = attempts.get(ip) ?? { count: 0, resetAt: at + windowMs };
    entry.count += 1;
    attempts.set(ip, entry);
    return entry.count <= limit;
  };

  /** Forgets the IP's attempts; called after a correct password, so the admin is never locked out. */
  const reset = (ip) => attempts.delete(ip);

  return { allow, reset };
};
