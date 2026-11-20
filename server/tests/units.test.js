import assert from 'node:assert/strict';
import { test } from 'node:test';
import jwt from 'jsonwebtoken';
import { hashPassword, parsePasswordHash, verifyPassword } from '../src/admin/password.js';
import { createLoginLimiter } from '../src/admin/rateLimit.js';
import { parseThemeLines } from '../src/admin/service.js';
import { adminCookieName, sameToken } from '../src/admin/sessions.js';
import { escape } from '../src/admin/views.js';
import { createCanvasGenerator, hideAnswer } from '../src/canvas/generator.js';
import { CANVAS_CSP } from '../src/canvas/pages.js';
import { ConfigError, loadConfig } from '../src/config.js';
import { cookieFrom, createGuestTokens } from '../src/guestToken.js';
import { safeReturnPath, withNoHandoff } from '../src/handoff.js';
import { createRecaptcha } from '../src/recaptcha.js';
import { safeFileName } from '../src/uploads.js';

const OLD_SECRET = 'the-old-6yuwei-api-secret-key';

test('a pass signed by the old 6yuwei_api is still accepted', () => {
  const tokens = createGuestTokens({ secret: OLD_SECRET, secure: true });
  // The exact call the old models/guessai_canvas.js made
  const old = jwt.sign({ userId: '64f1c2a0b1c2d3e4f5a6b7c8' }, OLD_SECRET, { expiresIn: '1y' });
  assert.equal(tokens.verify(old), '64f1c2a0b1c2d3e4f5a6b7c8');
  assert.equal(tokens.verify(tokens.issue('abc')), 'abc');
});

test('forged, expired and foreign passes are refused', () => {
  const tokens = createGuestTokens({ secret: OLD_SECRET, secure: true });
  assert.equal(tokens.verify(jwt.sign({ userId: 'x' }, 'another-secret')), null);
  assert.equal(tokens.verify(jwt.sign({ userId: 'x' }, OLD_SECRET, { expiresIn: -10 })), null);
  assert.equal(tokens.verify(jwt.sign({ userId: 'x' }, OLD_SECRET, { algorithm: 'HS512' })), null);
  assert.equal(tokens.verify(jwt.sign({ other: 1 }, OLD_SECRET)), null);
  assert.equal(tokens.verify(''), null);
});

test('the pass cookie is HttpOnly, Lax and lasts a year', () => {
  const { cookieOptions } = createGuestTokens({ secret: OLD_SECRET, secure: true });
  assert.deepEqual(cookieOptions, {
    httpOnly: true, secure: true, sameSite: 'lax', path: '/', maxAge: 365 * 24 * 60 * 60 * 1000,
  });
});

test('cookies are read from the header', () => {
  assert.equal(cookieFrom('a=1; guessai_canvas_access_token=abc.def; b=2', 'guessai_canvas_access_token'), 'abc.def');
  assert.equal(cookieFrom('xguessai_canvas_access_token=nope', 'guessai_canvas_access_token'), null);
  assert.equal(cookieFrom(undefined, 'x'), null);
});

test('the answer is hidden in every spelling, except JavaScript words', () => {
  const code = 'const Red Apple = 1; // red apple, RED APPLE, red-apple, red_apple, redapple, Redapple';
  const hidden = hideAnswer(code, 'Red Apple', () => 0);
  assert.equal(/red.?apple/i.test(hidden), false);
  assert.match(hidden, /aaaaa/);
  assert.equal(hideAnswer('new Date()', 'Date', () => 0), 'new Date()');
});

test('canvas pages run sandboxed without same-origin access', () => {
  assert.match(CANVAS_CSP, /sandbox allow-scripts$/);
  assert.doesNotMatch(CANVAS_CSP, /allow-same-origin/);
});

test('file names cannot leave the upload folder', () => {
  assert.equal(safeFileName('guessai-1-abc.png'), 'guessai-1-abc.png');
  ['../x.png', '..\\x.png', '.env', 'a/b.png', ''].forEach((name) => assert.equal(safeFileName(name), null));
});

test('reCAPTCHA needs success and a score of at least 0.5', async () => {
  const answer = (body, ok = true) => async () => ({ ok, json: async () => body });
  assert.deepEqual(await createRecaptcha({ secret: 's', fetchImpl: answer({ success: true, score: 0.9 }) })('t'), { ok: true });
  assert.deepEqual(await createRecaptcha({ secret: 's', fetchImpl: answer({ success: true, score: 0.3 }) })('t'), { ok: false, status: 403 });
  assert.deepEqual(await createRecaptcha({ secret: 's', fetchImpl: answer({}, false) })('t'), { ok: false, status: 500 });
  assert.deepEqual(await createRecaptcha({ secret: '' })('t'), { ok: false, status: 500 });
});

// A real hash of 'correct horse battery' made by scripts/hash-password.js
const ADMIN_HASH = 'scrypt:32768:8:1:v3ciBsyzBWNxmgRobcetGw:SN3MrYZF_qzUVGnHZaZL09SyDiUx0MF7QfYLePUQ3OY';
const ADMIN_ENV = { GUESSAI_ADMIN_PASSWORD_HASH: ADMIN_HASH, GUESSAI_SESSION_SECRET: 's'.repeat(32) };

test('configuration requires the origin, database and guest secret', () => {
  const env = { PUBLIC_ORIGIN: 'https://g.example.com/', MONGODB_URI: 'mongodb://x/y', GUESSAI_GUEST_SECRET: OLD_SECRET };
  const config = loadConfig({ ...env, ...ADMIN_ENV, NODE_ENV: 'production' });
  assert.equal(config.publicOrigin, 'https://g.example.com');
  assert.deepEqual(config.allowedOrigins, ['https://g.example.com']);
  ['PUBLIC_ORIGIN', 'MONGODB_URI', 'GUESSAI_GUEST_SECRET'].forEach((name) => {
    assert.throws(() => loadConfig({ ...env, [name]: '' }), ConfigError);
  });
});

test('production needs the admin settings; bad values stop the server', () => {
  const env = { PUBLIC_ORIGIN: 'https://g.example.com', MONGODB_URI: 'mongodb://x/y', GUESSAI_GUEST_SECRET: OLD_SECRET };
  assert.throws(() => loadConfig({ ...env, NODE_ENV: 'production' }), /required in production/);
  assert.throws(() => loadConfig({ ...env, ...ADMIN_ENV, NODE_ENV: 'production', GUESSAI_SESSION_SECRET: '' }), ConfigError);
  // Development may leave the admin off
  const dev = loadConfig(env);
  assert.equal(dev.adminPasswordHash, '');
  assert.equal(dev.handoffEnabled, false);
  assert.throws(() => loadConfig({ ...env, GUESSAI_ADMIN_PASSWORD_HASH: 'plain-password' }), /not a hash/);
  assert.throws(() => loadConfig({ ...env, ...ADMIN_ENV, GUESSAI_SESSION_SECRET: 'short' }), /at least 32/);
  assert.throws(() => loadConfig({ ...env, HANDOFF_ENABLED: 'yes' }), /true or false/);
  assert.equal(loadConfig({ ...env, HANDOFF_ENABLED: 'true' }).handoffEnabled, true);
});

test('admin passwords are checked against their scrypt hash', async () => {
  assert.equal(await verifyPassword('correct horse battery', ADMIN_HASH), true);
  assert.equal(await verifyPassword('wrong horse battery', ADMIN_HASH), false);
  assert.equal(await verifyPassword('', ADMIN_HASH), false);
  assert.equal(await verifyPassword('correct horse battery', 'plain'), false);
  const fresh = await hashPassword('another password', { N: 2 ** 14, r: 8, p: 1 });
  assert.notEqual(fresh, await hashPassword('another password', { N: 2 ** 14, r: 8, p: 1 }));
  assert.equal(await verifyPassword('another password', fresh), true);
  ['scrypt:1000:8:1:aaaaaaaaaaaaaaaaaaaaaa:bbbb', 'scrypt$32768$8$1$aaaaaaaaaaaaaaaaaaaaaa$bbbb', 'bcrypt$x', ''].forEach((value) => assert.equal(parsePasswordHash(value), null));
});

test('handoff return paths stay on this site', () => {
  assert.equal(safeReturnPath('/gallery/2?x=1#top'), '/gallery/2?x=1#top');
  ['//evil.example', 'https://evil.example', '/\\evil.example', 'gallery', '/a\nb', undefined, `/${'a'.repeat(600)}`]
    .forEach((value) => assert.equal(safeReturnPath(value), '/'));
  assert.equal(withNoHandoff('/'), '/?handoff=none');
  assert.equal(withNoHandoff('/gallery/2?x=1#top'), '/gallery/2?x=1&handoff=none#top');
});

test('theme lines take a comma, a tab or a bar between three names', () => {
  const { themes, invalidLines } = parseThemeLines('蘋果, Apple, りんご\n\n香蕉\tBanana\tバナナ\n狗｜Dog｜いぬ\n貓，Cat\n,,');
  assert.deepEqual(themes.map((theme) => theme.themeEN), ['Apple', 'Banana', 'Dog']);
  assert.deepEqual(invalidLines, [5, 6]);
});

test('the login limit counts per IP, and a correct password clears it', () => {
  let at = 0;
  const limiter = createLoginLimiter({ limit: 2, windowMs: 1000, now: () => at });
  assert.deepEqual([limiter.allow('a'), limiter.allow('a'), limiter.allow('a'), limiter.allow('b')], [true, true, false, true]);
  at = 1001;
  assert.equal(limiter.allow('a'), true);
  limiter.allow('a');
  limiter.reset('a');
  assert.equal(limiter.allow('a'), true);
});

test('admin cookies, tokens and escaping', () => {
  assert.equal(adminCookieName(true), '__Host-guessai_admin');
  assert.equal(adminCookieName(false), 'guessai_admin');
  assert.equal(sameToken('abc', 'abc'), true);
  assert.equal(sameToken('abc', 'abd'), false);
  assert.equal(sameToken('abc', undefined), false);
  assert.equal(escape('<a href="x">\'&'), '&#60;a href=&#34;x&#34;&#62;&#39;&#38;');
});

test('when the drawing fails, players are told and nothing is saved', async () => {
  const saved = [];
  const heard = [];
  const models = {
    GuessAICanvas: { findOne: () => ({ sort: async () => null }), create: async (doc) => saved.push(doc) },
    Theme: { countDocuments: async () => 1, findOne: () => ({ skip: async () => ({ themeEN: 'Apple' }) }) },
  };
  const generator = createCanvasGenerator({ models, draw: async () => null });
  const outcome = await generator.generate({ emit: (name, payload) => heard.push({ name, payload }) });
  assert.deepEqual(outcome, { ok: false, status: 502, error: 'Failed to generate canvas' });
  assert.deepEqual(heard, [{ name: 'server canvas', payload: { status: 'error', message: 'Failed to generate canvas' } }]);
  assert.equal(saved.length, 0);
});
