// Needs MongoDB; skipped unless GUESSAI_TEST_MONGO_URL is set. Uses only the guessai_test_admin
// database and drops it before and after.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { after, before, test } from 'node:test';
import mongoose from 'mongoose';
import { hashPassword } from '../src/admin/password.js';
import { createLoginLimiter } from '../src/admin/rateLimit.js';
import { createAdminRouter } from '../src/admin/router.js';
import { createAdminService } from '../src/admin/service.js';
import { ABSOLUTE_MS, IDLE_MS, createAdminSessions } from '../src/admin/sessions.js';
import { createApp } from '../src/app.js';
import { createCanvasGenerator } from '../src/canvas/generator.js';
import { createGuestTokens } from '../src/guestToken.js';
import { createModels } from '../src/models.js';
import { createUploads } from '../src/uploads.js';

const url = process.env.GUESSAI_TEST_MONGO_URL;
const PASSWORD = 'a long admin password';
const SESSION_SECRET = 'x'.repeat(40);

let connection;
let models;
let uploadDir;
let servers = [];
let base;
let clock = Date.now();
const rankings = [];

const listen = async (app) => {
  const server = http.createServer(app);
  await new Promise((resolve) => { server.listen(0, '127.0.0.1', resolve); });
  servers.push(server);
  return `http://127.0.0.1:${server.address().port}`;
};

const appWith = ({ passwordHash, sessions, limiter }) => {
  const uploads = createUploads({ dir: uploadDir });
  const generator = createCanvasGenerator({ models, draw: async (theme) => `<canvas></canvas><script>/* ${theme} */</script>` });
  return createApp({
    config: { trustProxy: false, staticDir: fs.mkdtempSync(path.join(os.tmpdir(), 'guessai-web-')) },
    models,
    tokens: createGuestTokens({ secret: 'the-old-6yuwei-api-secret-key', secure: false }),
    recaptcha: async () => ({ ok: false, status: 403 }),
    uploads,
    adminRouter: createAdminRouter({
      service: createAdminService({
        models, uploads, generateCanvas: () => generator.generate(), notifyRanking: (list) => rankings.push(list),
      }),
      sessions,
      passwordHash,
      limiter,
    }),
  });
};

before(async () => {
  if (!url) return;
  connection = await mongoose.createConnection(url, { dbName: 'guessai_test_admin' }).asPromise();
  await connection.dropDatabase();
  models = createModels(connection);
  await models.AdminSession.init();
  uploadDir = fs.mkdtempSync(path.join(os.tmpdir(), 'guessai-up-'));
  const sessions = createAdminSessions({
    model: models.AdminSession, secret: SESSION_SECRET, secure: false, now: () => new Date(clock),
  });
  base = await listen(appWith({ passwordHash: await hashPassword(PASSWORD), sessions }));
});

after(async () => {
  servers.forEach((server) => server.close());
  servers = [];
  if (connection) {
    await connection.dropDatabase();
    await connection.close();
  }
});

/** A browser for one admin: keeps the session cookie and sends this site's Origin on POST. */
const browser = (site = base) => {
  let cookie = '';
  const request = async (target, { method = 'GET', form, origin = site } = {}) => {
    const headers = { cookie };
    let body;
    if (form) {
      body = new URLSearchParams(form).toString();
      headers['content-type'] = 'application/x-www-form-urlencoded';
    }
    if (method === 'POST' && origin) headers.origin = origin;
    const response = await fetch(`${site}${target}`, {
      method, body, headers, redirect: 'manual',
    });
    const set = response.headers.getSetCookie().find((value) => value.startsWith('guessai_admin='));
    if (set) cookie = set.split(';')[0].endsWith('=') ? '' : set.split(';')[0];
    return response;
  };
  const csrf = async () => {
    const html = await (await request('/admin')).text();
    return html.match(/name="_csrf" value="([^"]+)"/)[1];
  };
  const post = async (target, form = {}) => request(target, { method: 'POST', form: { _csrf: await csrf(), ...form } });
  return {
    request, csrf, post, get cookie() { return cookie; },
  };
};

const signedIn = async () => {
  const admin = browser();
  const response = await admin.request('/admin/login', { method: 'POST', form: { password: PASSWORD } });
  assert.equal(response.status, 303);
  return admin;
};

const noticeOf = (response) => new URL(response.headers.get('location'), base).searchParams.get('notice');

test('nothing is reachable without signing in', { skip: !url }, async () => {
  const guest = browser();
  for (const page of ['/admin', '/admin/themes', '/admin/canvases', '/admin/messages', '/admin/players', '/admin/ranking']) {
    // eslint-disable-next-line no-await-in-loop
    const response = await guest.request(page);
    assert.equal(response.status, 303, page);
    assert.equal(response.headers.get('location'), '/admin/login');
  }
  const post = await guest.request('/admin/ranking/reset', { method: 'POST', form: { confirm: '重設排行榜' } });
  assert.equal(post.headers.get('location'), '/admin/login?notice=session_expired');

  const login = await guest.request('/admin/login');
  assert.equal(login.status, 200);
  assert.match(login.headers.get('content-security-policy'), /default-src 'self'/);
  assert.match(login.headers.get('content-security-policy'), /frame-ancestors 'none'/);
  assert.equal(login.headers.get('cache-control'), 'no-store');
  assert.equal(login.headers.get('x-robots-tag'), 'noindex, nofollow');
  assert.match(await login.text(), /<meta name="robots" content="noindex, nofollow">/);
});

test('a wrong password, a missing Origin or another site is refused', { skip: !url }, async () => {
  const guest = browser();
  const wrong = await guest.request('/admin/login', { method: 'POST', form: { password: 'not it' } });
  assert.equal(wrong.status, 401);
  assert.match(await wrong.text(), /密碼不對/);
  assert.equal(guest.cookie, '');

  const noOrigin = await guest.request('/admin/login', { method: 'POST', form: { password: PASSWORD }, origin: null });
  assert.equal(noOrigin.status, 403);
  const foreign = await guest.request('/admin/login', { method: 'POST', form: { password: PASSWORD }, origin: 'https://evil.example' });
  assert.equal(foreign.status, 403);
  assert.equal(guest.cookie, '');
  assert.ok(await models.AdminLog.exists({ action: 'login.failed' }));
});

test('the right password starts a strict, HttpOnly session', { skip: !url }, async () => {
  const guest = browser();
  const response = await guest.request('/admin/login', { method: 'POST', form: { password: PASSWORD } });
  assert.equal(response.headers.get('location'), '/admin');
  const cookie = response.headers.getSetCookie().find((value) => value.startsWith('guessai_admin='));
  assert.match(cookie, /HttpOnly/i);
  assert.match(cookie, /SameSite=Strict/i);
  // The database holds an HMAC of the id, not the id
  const id = guest.cookie.split('=')[1];
  assert.equal(await models.AdminSession.countDocuments({ idHash: id }), 0);
  const overview = await guest.request('/admin');
  assert.equal(overview.status, 200);
  assert.match(await overview.text(), /總覽/);
  assert.equal((await guest.request('/admin/login')).headers.get('location'), '/admin');
});

test('login attempts are limited per IP', { skip: !url }, async () => {
  const site = await listen(appWith({
    passwordHash: await hashPassword(PASSWORD),
    sessions: createAdminSessions({ model: models.AdminSession, secret: SESSION_SECRET, secure: false }),
    limiter: createLoginLimiter({ limit: 3 }),
  }));
  const guest = browser(site);
  const statuses = [];
  for (let i = 0; i < 4; i += 1) {
    // eslint-disable-next-line no-await-in-loop
    statuses.push((await guest.request('/admin/login', { method: 'POST', form: { password: 'wrong' } })).status);
  }
  assert.deepEqual(statuses, [401, 401, 401, 429]);
  // Even the right password waits
  assert.equal((await guest.request('/admin/login', { method: 'POST', form: { password: PASSWORD } })).status, 429);
});

test('a form without the session token changes nothing', { skip: !url }, async () => {
  const admin = await signedIn();
  await models.SimpleUser.create({ name: 'csrf', score: 10 });
  const forged = await admin.request('/admin/ranking/reset', { method: 'POST', form: { _csrf: 'forged', confirm: '重設排行榜' } });
  assert.equal(forged.status, 403);
  const missing = await admin.request('/admin/ranking/reset', { method: 'POST', form: { confirm: '重設排行榜' } });
  assert.equal(missing.status, 403);
  const foreign = await admin.request('/admin/ranking/reset', {
    method: 'POST', form: { _csrf: await admin.csrf(), confirm: '重設排行榜' }, origin: 'https://evil.example',
  });
  assert.equal(foreign.status, 403);
  assert.equal((await models.SimpleUser.findOne({ name: 'csrf' })).score, 10);
  await models.SimpleUser.deleteMany({ name: 'csrf' });
});

test('themes: add many, skip known Chinese names and bad lines, delete one', { skip: !url }, async () => {
  const admin = await signedIn();
  await models.Theme.create({ themeTW: '蘋果', themeEN: 'Apple', themeJP: 'りんご' });
  const added = await admin.post('/admin/themes', {
    themes: '蘋果, Apple, りんご\n香蕉\tBanana\tバナナ\n貓|Cat|ねこ\n貓, Cat, 猫\n只有一欄\n\n狗，Dog，いぬ',
  });
  const location = new URL(added.headers.get('location'), base);
  assert.deepEqual(Object.fromEntries(location.searchParams), {
    added: '3', skipped: '2', invalid: '1', notice: 'themes_added',
  });
  assert.match(await (await admin.request(`${location.pathname}${location.search}`)).text(), /新增 3 個主題，略過 2 個重複的，1 行格式不對/);
  assert.deepEqual((await models.Theme.find().sort({ themeTW: 1 })).map((theme) => theme.themeEN).sort(), ['Apple', 'Banana', 'Cat', 'Dog']);

  const list = await (await admin.request('/admin/themes?q=bana')).text();
  assert.match(list, /香蕉/);
  assert.doesNotMatch(list, /蘋果<\/td>/);

  const banana = await models.Theme.findOne({ themeTW: '香蕉' });
  assert.equal(noticeOf(await admin.post(`/admin/themes/${banana.id}/delete`)), 'theme_deleted');
  assert.equal(noticeOf(await admin.post(`/admin/themes/${banana.id}/delete`)), 'not_found');
  assert.equal(noticeOf(await admin.post('/admin/themes/not-an-id/delete')), 'not_found');
  assert.equal(await models.Theme.countDocuments(), 3);
});

test('canvases: generate now, refuse while one is unsolved, list, preview link, delete', { skip: !url }, async () => {
  const admin = await signedIn();
  await models.GuessAICanvas.deleteMany({});
  assert.equal(noticeOf(await admin.post('/admin/canvases/generate')), 'canvas_generated');
  assert.equal(await models.GuessAICanvas.countDocuments(), 1);
  assert.equal(noticeOf(await admin.post('/admin/canvases/generate')), 'canvas_unsolved');
  assert.equal(await models.GuessAICanvas.countDocuments(), 1);

  const canvas = await models.GuessAICanvas.findOne();
  const page = await (await admin.request('/admin/canvases')).text();
  assert.match(page, /進行中/);
  assert.ok(page.includes(`/api/guessai_canvas/canvas/${canvas.id}/`));
  assert.equal(noticeOf(await admin.post(`/admin/canvases/${canvas.id}/delete`)), 'canvas_deleted');
  assert.equal(await models.GuessAICanvas.countDocuments(), 0);
  assert.ok(await models.AdminLog.exists({ action: 'canvas.generate', detail: 'ok' }));
});

test('chat: list and delete one message', { skip: !url }, async () => {
  const admin = await signedIn();
  const player = await models.SimpleUser.create({ name: '聊天的人', score: 0 });
  const message = await models.Messages.create({ message: '<b>hi</b>', user: player._id, isCorrect: false });
  const page = await (await admin.request('/admin/messages')).text();
  assert.match(page, /&#60;b&#62;hi&#60;\/b&#62;/);
  assert.match(page, /聊天的人/);
  assert.equal(noticeOf(await admin.post(`/admin/messages/${message.id}/delete`)), 'message_deleted');
  assert.equal(await models.Messages.countDocuments({ _id: message._id }), 0);
  await player.deleteOne();
});

test('players: search, rename, reset one score, delete with photo and messages', { skip: !url }, async () => {
  const admin = await signedIn();
  fs.writeFileSync(path.join(uploadDir, 'guessai-1-aa.png'), 'png');
  const player = await models.SimpleUser.create({ name: '要處理的玩家', score: 500, photo: 'guessai-1-aa.png' });
  await models.SimpleUser.create({ name: '別人', score: 50 });
  await models.Messages.create({ message: 'hello', user: player._id, isCorrect: false });

  const found = await (await admin.request(`/admin/players?q=${encodeURIComponent('要處理')}`)).text();
  assert.match(found, /要處理的玩家/);
  assert.doesNotMatch(found, /別人/);

  assert.equal(noticeOf(await admin.post(`/admin/players/${player.id}/rename`, { name: '  新名字 ' })), 'player_renamed');
  assert.equal((await models.SimpleUser.findById(player.id)).name, '新名字');
  const empty = await admin.post(`/admin/players/${player.id}/rename`, { name: '   ' });
  assert.equal(empty.status, 400);
  assert.equal((await admin.post(`/admin/players/${player.id}/rename`, { name: 'x'.repeat(51) })).status, 400);

  rankings.length = 0;
  assert.equal(noticeOf(await admin.post(`/admin/players/${player.id}/reset-score`)), 'player_score_reset');
  assert.equal((await models.SimpleUser.findById(player.id)).score, 0);
  assert.equal(rankings.length, 1);

  assert.equal(noticeOf(await admin.post(`/admin/players/${player.id}/delete`)), 'player_deleted');
  assert.equal(await models.SimpleUser.countDocuments({ _id: player._id }), 0);
  assert.equal(await models.Messages.countDocuments({ user: player._id }), 0);
  assert.equal(fs.existsSync(path.join(uploadDir, 'guessai-1-aa.png')), false);
  assert.equal(rankings.length, 2);
});

test('ranking: reset only after typing the confirmation', { skip: !url }, async () => {
  const admin = await signedIn();
  await models.SimpleUser.create([{ name: 'a', score: 100 }, { name: 'b', score: 200 }]);
  assert.equal(noticeOf(await admin.post('/admin/ranking/reset', { confirm: '好' })), 'ranking_not_confirmed');
  assert.equal(await models.SimpleUser.countDocuments({ score: { $gt: 0 } }), 3);
  assert.equal(noticeOf(await admin.post('/admin/ranking/reset', { confirm: ' 重設排行榜 ' })), 'ranking_reset');
  assert.equal(await models.SimpleUser.countDocuments({ score: { $gt: 0 } }), 0);
  assert.ok(await models.AdminLog.exists({ action: 'ranking.reset' }));
});

test('every change is in the admin log, which the overview shows', { skip: !url }, async () => {
  const admin = await signedIn();
  const actions = new Set((await models.AdminLog.find()).map((entry) => entry.action));
  ['login', 'login.failed', 'theme.add', 'theme.delete', 'canvas.generate', 'canvas.delete', 'message.delete',
    'player.rename', 'player.reset_score', 'player.delete', 'ranking.reset'].forEach((action) => assert.ok(actions.has(action), action));
  assert.match(await (await admin.request('/admin')).text(), /ranking\.reset/);
});

test('sessions end after 30 idle minutes, after 8 hours, and on logout', { skip: !url }, async () => {
  const idle = await signedIn();
  clock += IDLE_MS - 1000;
  assert.equal((await idle.request('/admin')).status, 200);
  clock += IDLE_MS - 1000;
  // Each visit keeps it alive
  assert.equal((await idle.request('/admin')).status, 200);
  clock += IDLE_MS + 1;
  assert.equal((await idle.request('/admin')).headers.get('location'), '/admin/login');

  const long = await signedIn();
  for (let spent = 0; spent < ABSOLUTE_MS; spent += IDLE_MS - 60_000) {
    clock += IDLE_MS - 60_000;
    // eslint-disable-next-line no-await-in-loop
    await long.request('/admin');
  }
  assert.equal((await long.request('/admin')).headers.get('location'), '/admin/login');
  clock = Date.now();

  const admin = await signedIn();
  const out = await admin.post('/admin/logout');
  assert.equal(out.headers.get('location'), '/admin/login?notice=signed_out');
  assert.equal(admin.cookie, '');
  assert.equal(await models.AdminLog.countDocuments({ action: 'logout' }), 1);
});

test('without the admin settings, /admin says it is not set up', { skip: !url }, async () => {
  const site = await listen(appWith({ passwordHash: '', sessions: null }));
  const response = await fetch(`${site}/admin/login`);
  assert.equal(response.status, 503);
  assert.match(await response.text(), /管理頁還沒設定/);
});

test('the admin stylesheet and script are served from this site', { skip: !url }, async () => {
  assert.equal((await fetch(`${base}/admin/assets/admin.css`)).status, 200);
  assert.equal((await fetch(`${base}/admin/assets/admin.js`)).status, 200);
  assert.equal((await fetch(`${base}/admin/assets/missing.js`)).status, 404);
});
