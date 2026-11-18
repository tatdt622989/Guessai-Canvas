import assert from 'node:assert/strict';
import { test } from 'node:test';
import jwt from 'jsonwebtoken';
import { hideAnswer } from '../src/canvas/generator.js';
import { CANVAS_CSP } from '../src/canvas/pages.js';
import { ConfigError, loadConfig } from '../src/config.js';
import { cookieFrom, createGuestTokens } from '../src/guestToken.js';
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

test('configuration requires the origin, database and guest secret', () => {
  const env = { PUBLIC_ORIGIN: 'https://g.example.com/', MONGODB_URI: 'mongodb://x/y', GUESSAI_GUEST_SECRET: OLD_SECRET };
  const config = loadConfig({ ...env, NODE_ENV: 'production' });
  assert.equal(config.publicOrigin, 'https://g.example.com');
  assert.deepEqual(config.allowedOrigins, ['https://g.example.com']);
  ['PUBLIC_ORIGIN', 'MONGODB_URI', 'GUESSAI_GUEST_SECRET'].forEach((name) => {
    assert.throws(() => loadConfig({ ...env, [name]: '' }), ConfigError);
  });
});
