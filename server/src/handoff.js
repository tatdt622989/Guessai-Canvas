import crypto from 'node:crypto';
import express from 'express';
import mongoose from 'mongoose';
import { GUEST_COOKIE, cookieFrom } from './guestToken.js';

/*
 * Moves a guest pass from api.6yuwei.com to this site (docs/server.md §5). The old pass is a
 * cookie of api.6yuwei.com, so the reverse proxy there sends /guessai_canvas/handoff to this
 * service. That step trades the pass for a one-time code, and /api/guessai_canvas/handoff/complete
 * on this site trades the code for a new pass. Removed on day 90 (HANDOFF_ENABLED=false).
 */

export const HANDOFF_START_PATH = '/guessai_canvas/handoff';
export const HANDOFF_COMPLETE_PATH = '/api/guessai_canvas/handoff/complete';
export const CODE_TTL_MS = 60 * 1000;

const hashCode = (code) => crypto.createHash('sha256').update(code).digest('hex');

/** A path on this site to come back to; anything else becomes `/`. */
export const safeReturnPath = (value) => {
  if (typeof value !== 'string' || value.length > 512) return '/';
  if (!value.startsWith('/') || value.startsWith('//')) return '/';
  if (value.includes('\\') || /[\u0000-\u001f\u007f]/.test(value)) return '/';
  return value;
};

/** The return path with ?handoff=none added, which tells the frontend not to try again. */
export const withNoHandoff = (returnPath) => {
  const url = new URL(returnPath, 'http://site.invalid');
  url.searchParams.set('handoff', 'none');
  return `${url.pathname}${url.search}${url.hash}`;
};

const queryText = (req, name) => (typeof req.query[name] === 'string' ? req.query[name] : undefined);

export const createHandoff = ({
  models, tokens, publicOrigin, now = () => new Date(), log = (entry) => console.log(JSON.stringify(entry)),
}) => {
  const { HandoffCode, SimpleUser } = models;
  // Only counts are kept: never a pass, a code or a player id (§5.2)
  const counts = { started: 0, startFailed: 0, completed: 0, completeFailed: 0 };
  const count = (name) => {
    counts[name] += 1;
    log({ event: 'guessai_handoff', step: name, total: counts[name] });
  };

  const noStore = (res) => res.set({ 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer' });

  /** Runs on api.6yuwei.com (through the proxy): reads the old pass only, never other cookies. */
  const start = async (req, res) => {
    noStore(res);
    const returnPath = safeReturnPath(queryText(req, 'return'));
    const fail = () => {
      count('startFailed');
      res.redirect(302, `${publicOrigin}${withNoHandoff(returnPath)}`);
    };

    const userId = tokens.verify(cookieFrom(req.headers.cookie, GUEST_COOKIE));
    if (!userId || !mongoose.isValidObjectId(userId)) return fail();
    if (!await SimpleUser.exists({ _id: userId })) return fail();

    const code = crypto.randomBytes(32).toString('base64url');
    await HandoffCode.create({
      codeHash: hashCode(code), userId, expiresAt: new Date(now().getTime() + CODE_TTL_MS),
    });
    count('started');
    // The old cookie stays: a rollback to the old system still needs it (§5.2)
    const next = new URL(HANDOFF_COMPLETE_PATH, publicOrigin);
    next.searchParams.set('code', code);
    next.searchParams.set('return', returnPath);
    return res.redirect(302, next.toString());
  };

  /** Runs on this site: one code, used once, within 60 seconds, gives a new pass. */
  const complete = async (req, res) => {
    noStore(res);
    const returnPath = safeReturnPath(queryText(req, 'return'));
    const fail = () => {
      count('completeFailed');
      res.redirect(302, withNoHandoff(returnPath));
    };

    const code = queryText(req, 'code');
    if (!code || code.length > 100) return fail();
    // Deleted in the same step as it is read, so two requests cannot both use it
    const found = await HandoffCode.findOneAndDelete({ codeHash: hashCode(code), expiresAt: { $gt: now() } });
    if (!found) return fail();
    const player = await SimpleUser.findById(found.userId);
    if (!player) return fail();

    res.cookie(GUEST_COOKIE, tokens.issue(player.id), tokens.cookieOptions);
    count('completed');
    return res.redirect(302, returnPath);
  };

  const wrap = (handler) => (req, res, next) => handler(req, res).catch(next);

  /** Routes for the app root. When the move has ended, both paths answer 404. */
  const router = (enabled) => {
    const routes = express.Router();
    if (enabled) {
      routes.get(HANDOFF_START_PATH, wrap(start));
      routes.get(HANDOFF_COMPLETE_PATH, wrap(complete));
    } else {
      routes.all([HANDOFF_START_PATH, HANDOFF_COMPLETE_PATH], (req, res) => res.status(404).send('Not found'));
    }
    return routes;
  };

  return { router, counts };
};
