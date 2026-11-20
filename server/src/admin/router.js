import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import { verifyPassword } from './password.js';
import { createLoginLimiter } from './rateLimit.js';
import { AdminInputError } from './service.js';
import { sameToken } from './sessions.js';
import {
  RANKING_CONFIRM_WORD, canvasesPage, errorPage, loginPage, messagesPage, notConfiguredPage, overviewPage,
  playersPage, rankingPage, themesPage,
} from './views.js';

/*
 * The admin pages under /admin (docs/server.md §6). Every POST must come from this site (Origin)
 * and carry the session's CSRF token; the login form, which has no session yet, needs the Origin.
 */

const ASSETS = path.join(path.dirname(fileURLToPath(import.meta.url)), 'assets');

export const ADMIN_CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self'",
  "img-src 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "base-uri 'none'",
  "object-src 'none'",
].join('; ');

/** Messages after a change. Only these keys are shown, so a link cannot put text on the page. */
const NOTICES = {
  signed_out: ['ok', '已登出。'],
  session_expired: ['error', '登入已逾時，請重新登入。'],
  theme_deleted: ['ok', '已刪除主題。'],
  canvas_deleted: ['ok', '已刪除畫布。'],
  canvas_generated: ['ok', '已產生新畫布，玩家畫面會自動更新。'],
  canvas_unsolved: ['error', '目前的畫布還沒有人解出，所以沒有產生新的。'],
  canvas_failed: ['error', '產生畫布失敗，請稍後再試。'],
  message_deleted: ['ok', '已刪除訊息。'],
  player_renamed: ['ok', '已改名。'],
  player_score_reset: ['ok', '已把分數歸零。'],
  player_deleted: ['ok', '已刪除玩家。'],
  ranking_reset: ['ok', '所有玩家的分數已歸零。'],
  ranking_not_confirmed: ['error', `沒有歸零：確認文字要輸入「${RANKING_CONFIRM_WORD}」。`],
  not_found: ['error', '找不到這筆資料，可能已經被刪除。'],
};

const noticeOf = (query) => {
  if (query.notice === 'themes_added') {
    const number = (name) => Math.max(0, Number.parseInt(query[name], 10) || 0);
    const invalid = number('invalid');
    return {
      kind: 'ok',
      text: `新增 ${number('added')} 個主題，略過 ${number('skipped')} 個重複的${invalid ? `，${invalid} 行格式不對` : ''}。`,
    };
  }
  const entry = NOTICES[query.notice];
  return entry ? { kind: entry[0], text: entry[1] } : undefined;
};

const textOf = (value) => (typeof value === 'string' ? value : '');

export const createAdminRouter = ({
  service, sessions, passwordHash, limiter = createLoginLimiter(),
}) => {
  const router = express.Router();
  const form = express.urlencoded({ extended: false, limit: '64kb' });

  router.use((req, res, next) => {
    res.set({
      'Content-Security-Policy': ADMIN_CSP,
      'Cache-Control': 'no-store',
      'X-Robots-Tag': 'noindex, nofollow',
      'Referrer-Policy': 'same-origin',
    });
    next();
  });

  router.use('/assets', express.static(ASSETS, { index: false, fallthrough: false }));

  if (!sessions || !passwordHash) {
    router.use((req, res) => res.status(503).type('html').send(notConfiguredPage()));
    return router;
  }

  // A form on another site cannot post here: browsers send Origin with every form POST
  const sameOrigin = (req, res, next) => {
    const expected = `${req.protocol}://${req.get('host')}`;
    if (req.get('origin') === expected) return next();
    return res.status(403).type('html').send(errorPage({ title: '無法處理', text: '這個要求不是從管理頁送出的。' }));
  };

  const wrap = (handler) => (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);

  const back = (res, location, notice, extra = {}) => {
    const query = new URLSearchParams({ ...extra, notice });
    res.redirect(303, `${location}?${query}`);
  };

  router.get('/login', wrap(async (req, res) => {
    if (await sessions.read(req)) return res.redirect(303, '/admin');
    return res.type('html').send(loginPage({ notice: noticeOf(req.query) }));
  }));

  router.post('/login', sameOrigin, form, wrap(async (req, res) => {
    if (!limiter.allow(req.ip)) {
      return res.status(429).type('html').send(loginPage({ notice: { kind: 'error', text: '嘗試太多次，請 15 分鐘後再試。' } }));
    }
    if (!await verifyPassword(textOf(req.body?.password), passwordHash)) {
      await service.logSignIn(false);
      return res.status(401).type('html').send(loginPage({ notice: { kind: 'error', text: '密碼不對。' } }));
    }
    limiter.reset(req.ip);
    await sessions.start(res);
    await service.logSignIn(true);
    return res.redirect(303, '/admin');
  }));

  // Everything below needs a session
  router.use(wrap(async (req, res, next) => {
    const session = await sessions.read(req);
    if (!session) {
      if (req.method === 'GET') return res.redirect(303, '/admin/login');
      return back(res, '/admin/login', 'session_expired');
    }
    req.adminSession = session;
    return next();
  }));

  const checkToken = (req, res, next) => {
    if (sameToken(req.adminSession.csrfToken, req.body?._csrf)) return next();
    return res.status(403).type('html').send(errorPage({
      title: '無法處理', text: '表單已經過期，請重新整理頁面再試一次。', csrfToken: req.adminSession.csrfToken,
    }));
  };
  router.use((req, res, next) => {
    if (req.method !== 'POST') return next();
    return sameOrigin(req, res, () => form(req, res, (error) => (error ? next(error) : checkToken(req, res, next))));
  });

  const view = (render, load) => wrap(async (req, res) => {
    const data = load ? await load(req) : {};
    res.type('html').send(render({ csrfToken: req.adminSession.csrfToken, notice: noticeOf(req.query), ...data }));
  });

  const keywordOf = (req) => textOf(req.query.q).trim().slice(0, 100);

  router.get('/', view(overviewPage, async () => ({ data: await service.overview() })));
  router.get('/themes', view(themesPage, async (req) => {
    const keyword = keywordOf(req);
    return { keyword, list: await service.listThemes({ page: req.query.page, keyword }) };
  }));
  router.get('/canvases', view(canvasesPage, async (req) => ({ list: await service.listCanvases({ page: req.query.page }) })));
  router.get('/messages', view(messagesPage, async (req) => ({ list: await service.listMessages({ page: req.query.page }) })));
  router.get('/players', view(playersPage, async (req) => {
    const keyword = keywordOf(req);
    return { keyword, list: await service.listPlayers({ page: req.query.page, keyword }) };
  }));
  router.get('/ranking', view(rankingPage));

  router.post('/logout', wrap(async (req, res) => {
    await service.logSignOut();
    await sessions.end(req, res);
    back(res, '/admin/login', 'signed_out');
  }));

  router.post('/themes', wrap(async (req, res) => {
    const { added, skipped, invalidLines } = await service.addThemes(textOf(req.body.themes));
    back(res, '/admin/themes', 'themes_added', {
      added: String(added), skipped: String(skipped), invalid: String(invalidLines.length),
    });
  }));

  const removal = (remove, location, notice) => wrap(async (req, res) => {
    back(res, location, await remove(req.params.id) ? notice : 'not_found');
  });
  router.post('/themes/:id/delete', removal(service.deleteTheme, '/admin/themes', 'theme_deleted'));
  router.post('/canvases/:id/delete', removal(service.deleteCanvas, '/admin/canvases', 'canvas_deleted'));
  router.post('/messages/:id/delete', removal(service.deleteMessage, '/admin/messages', 'message_deleted'));
  router.post('/players/:id/delete', removal(service.deletePlayer, '/admin/players', 'player_deleted'));
  router.post('/players/:id/reset-score', removal(service.resetPlayerScore, '/admin/players', 'player_score_reset'));

  router.post('/players/:id/rename', wrap(async (req, res) => {
    back(res, '/admin/players', await service.renamePlayer(req.params.id, req.body.name) ? 'player_renamed' : 'not_found');
  }));

  router.post('/canvases/generate', wrap(async (req, res) => {
    const result = await service.generateCanvas();
    let notice = 'canvas_failed';
    if (result.ok) notice = 'canvas_generated';
    else if (result.status === 409) notice = 'canvas_unsolved';
    back(res, '/admin', notice);
  }));

  router.post('/ranking/reset', wrap(async (req, res) => {
    if (textOf(req.body.confirm).trim() !== RANKING_CONFIRM_WORD) return back(res, '/admin/ranking', 'ranking_not_confirmed');
    await service.resetRanking();
    return back(res, '/admin/ranking', 'ranking_reset');
  }));

  router.use((req, res) => res.status(404).type('html').send(errorPage({
    title: '找不到頁面', text: '這個管理頁不存在。', csrfToken: req.adminSession?.csrfToken,
  })));

  // eslint-disable-next-line no-unused-vars
  router.use((error, req, res, next) => {
    // Missing assets, bodies too large or malformed
    const status = error.statusCode ?? error.status;
    if (Number.isInteger(status) && status >= 400 && status < 500) {
      return res.status(status).type('html').send(errorPage({ title: '無法處理', text: '找不到或無法處理這個要求。', csrfToken: req.adminSession?.csrfToken }));
    }
    if (error instanceof AdminInputError) {
      return res.status(400).type('html').send(errorPage({ title: '無法處理', text: error.message, csrfToken: req.adminSession?.csrfToken }));
    }
    console.error(error);
    return res.status(500).type('html').send(errorPage({ title: '發生錯誤', text: '伺服器發生錯誤，請稍後再試。', csrfToken: req.adminSession?.csrfToken }));
  });

  return router;
};
