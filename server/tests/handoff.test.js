// Needs MongoDB; skipped unless GUESSAI_TEST_MONGO_URL is set. Uses only the guessai_test_handoff
// database and drops it before and after.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { after, before, test } from 'node:test';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import { createApp } from '../src/app.js';
import { createGuestTokens } from '../src/guestToken.js';
import { CODE_TTL_MS, HANDOFF_COMPLETE_PATH, createHandoff } from '../src/handoff.js';
import { createModels } from '../src/models.js';
import { createUploads } from '../src/uploads.js';

const url = process.env.GUESSAI_TEST_MONGO_URL;
const SECRET = 'the-old-6yuwei-api-secret-key';
const SITE = 'https://guessai.test';

let connection;
let models;
let servers = [];
let base;
let closedBase;
let player;
let clock = Date.now();
const logs = [];

const listen = async (app) => {
  const server = http.createServer(app);
  await new Promise((resolve) => { server.listen(0, '127.0.0.1', resolve); });
  servers.push(server);
  return `http://127.0.0.1:${server.address().port}`;
};

before(async () => {
  if (!url) return;
  connection = await mongoose.createConnection(url, { dbName: 'guessai_test_handoff' }).asPromise();
  await connection.dropDatabase();
  models = createModels(connection);
  await models.HandoffCode.init();
  const tokens = createGuestTokens({ secret: SECRET, secure: false });
  const handoff = createHandoff({
    models, tokens, publicOrigin: SITE, now: () => new Date(clock), log: (entry) => logs.push(entry),
  });
  const appWith = (enabled) => createApp({
    config: { trustProxy: false, staticDir: fs.mkdtempSync(path.join(os.tmpdir(), 'guessai-web-')) },
    models,
    tokens,
    recaptcha: async () => ({ ok: false, status: 403 }),
    uploads: createUploads({ dir: fs.mkdtempSync(path.join(os.tmpdir(), 'guessai-up-')) }),
    handoffRouter: handoff.router(enabled),
  });
  base = await listen(appWith(true));
  closedBase = await listen(appWith(false));
  player = await models.SimpleUser.create({ name: '老玩家', score: 300 });
});

after(async () => {
  servers.forEach((server) => server.close());
  servers = [];
  if (connection) {
    await connection.dropDatabase();
    await connection.close();
  }
});

const oldPass = (userId, secret = SECRET) => jwt.sign({ userId: String(userId) }, secret, { expiresIn: '1y' });
const get = (target, cookie) => fetch(target, { redirect: 'manual', headers: cookie ? { cookie } : {} });
const start = (cookie, returnPath = '/gallery/2') => get(`${base}/guessai_canvas/handoff?return=${encodeURIComponent(returnPath)}`, cookie);
const passOf = (response) => response.headers.getSetCookie()
  .find((value) => value.startsWith('guessai_canvas_access_token='));
/** The complete URL from a start redirect, pointed at the test server instead of the site. */
const completeUrlOf = (response) => {
  const location = new URL(response.headers.get('location'));
  assert.equal(location.origin, SITE);
  assert.equal(location.pathname, HANDOFF_COMPLETE_PATH);
  return `${base}${location.pathname}${location.search}`;
};

test('an old pass moves to this site and keeps the player', { skip: !url }, async () => {
  const started = await start(`other_site_session=secret; guessai_canvas_access_token=${oldPass(player.id)}`);
  assert.equal(started.status, 302);
  assert.equal(started.headers.get('cache-control'), 'no-store');
  // The old cookie is not cleared
  assert.equal(passOf(started), undefined);
  const completeUrl = completeUrlOf(started);
  assert.equal(new URL(completeUrl).searchParams.get('return'), '/gallery/2');

  const done = await get(completeUrl);
  assert.equal(done.status, 302);
  assert.equal(done.headers.get('location'), '/gallery/2');
  const pass = passOf(done);
  assert.match(pass, /HttpOnly/i);
  assert.match(pass, /SameSite=Lax/i);

  const me = await get(`${base}/api/guessai_canvas/simple_user/`, pass.split(';')[0]);
  const body = await me.json();
  assert.equal(body.name, '老玩家');
  assert.equal(body.score, 300);

  // The database holds a hash, never the code itself
  const code = new URL(completeUrl).searchParams.get('code');
  assert.equal(await models.HandoffCode.countDocuments(), 0);
  assert.ok(!logs.some((entry) => JSON.stringify(entry).includes(code)));
});

test('without a pass, or with a bad one, the player is sent back with handoff=none', { skip: !url }, async () => {
  const missing = await start();
  assert.equal(missing.headers.get('location'), `${SITE}/gallery/2?handoff=none`);

  const forged = await start(`guessai_canvas_access_token=${oldPass(player.id, 'another-secret-value')}`);
  assert.equal(forged.headers.get('location'), `${SITE}/gallery/2?handoff=none`);

  const gone = await start(`guessai_canvas_access_token=${oldPass(new mongoose.Types.ObjectId())}`);
  assert.equal(gone.headers.get('location'), `${SITE}/gallery/2?handoff=none`);

  const notAnId = await start(`guessai_canvas_access_token=${oldPass('not-an-id')}`);
  assert.equal(notAnId.headers.get('location'), `${SITE}/gallery/2?handoff=none`);
  assert.equal(await models.HandoffCode.countDocuments(), 0);
});

test('a code works once', { skip: !url }, async () => {
  const completeUrl = completeUrlOf(await start(`guessai_canvas_access_token=${oldPass(player.id)}`));
  const [first, second] = await Promise.all([get(completeUrl), get(completeUrl)]);
  const moved = [first, second].filter((response) => passOf(response));
  assert.equal(moved.length, 1);
  const refused = first === moved[0] ? second : first;
  assert.equal(refused.headers.get('location'), '/gallery/2?handoff=none');

  const third = await get(completeUrl);
  assert.equal(passOf(third), undefined);
  assert.equal(third.headers.get('location'), '/gallery/2?handoff=none');
});

test('a code older than 60 seconds is refused', { skip: !url }, async () => {
  const completeUrl = completeUrlOf(await start(`guessai_canvas_access_token=${oldPass(player.id)}`));
  clock += CODE_TTL_MS + 1;
  try {
    const late = await get(completeUrl);
    assert.equal(passOf(late), undefined);
    assert.equal(late.headers.get('location'), '/gallery/2?handoff=none');
  } finally {
    clock = Date.now();
  }
});

test('made-up codes are refused', { skip: !url }, async () => {
  for (const code of ['', 'nope', 'x'.repeat(500)]) {
    // eslint-disable-next-line no-await-in-loop
    const response = await get(`${base}${HANDOFF_COMPLETE_PATH}?code=${code}&return=/`);
    assert.equal(passOf(response), undefined);
    assert.equal(response.headers.get('location'), '/?handoff=none');
  }
});

test('return paths to other sites become /', { skip: !url }, async () => {
  for (const target of ['//evil.example/x', 'https://evil.example/', '/\\evil.example', 'gallery']) {
    // eslint-disable-next-line no-await-in-loop
    const response = await start(undefined, target);
    assert.equal(response.headers.get('location'), `${SITE}/?handoff=none`);
  }
  const completeUrl = completeUrlOf(await start(`guessai_canvas_access_token=${oldPass(player.id)}`, '//evil.example'));
  assert.equal(new URL(completeUrl).searchParams.get('return'), '/');
  const done = await get(completeUrl.replace('return=%2F', 'return=%2F%2Fevil.example'));
  assert.equal(done.headers.get('location'), '/');
});

test('the logs hold counts only', { skip: !url }, async () => {
  assert.ok(logs.length > 0);
  logs.forEach((entry) => assert.deepEqual(Object.keys(entry).sort(), ['event', 'step', 'total']));
});

test('after the move ends, both paths answer 404', { skip: !url }, async () => {
  assert.equal((await get(`${closedBase}/guessai_canvas/handoff?return=/`, `guessai_canvas_access_token=${oldPass(player.id)}`)).status, 404);
  assert.equal((await get(`${closedBase}${HANDOFF_COMPLETE_PATH}?code=abc`)).status, 404);
});
