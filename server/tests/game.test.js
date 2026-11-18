// Needs MongoDB. Skipped unless GUESSAI_TEST_MONGO_URL is set, for example
// GUESSAI_TEST_MONGO_URL=mongodb://127.0.0.1:27017/guessai_test npm test
import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { after, before, test } from 'node:test';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import { io as connect } from 'socket.io-client';
import { createApp } from '../src/app.js';
import { createCanvasGenerator } from '../src/canvas/generator.js';
import { createGuestTokens } from '../src/guestToken.js';
import { createModels } from '../src/models.js';
import { SOCKET_PATH, createSocketServer } from '../src/socket.js';
import { createUploads } from '../src/uploads.js';

const url = process.env.GUESSAI_TEST_MONGO_URL;
const SECRET = 'the-old-6yuwei-api-secret-key';
// The smallest valid PNG
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=', 'base64');

let connection;
let models;
let server;
let io;
let base;
let uploadDir;
let staticDir;
const drawn = [];

before(async () => {
  if (!url) return;
  connection = await mongoose.createConnection(url).asPromise();
  await connection.dropDatabase();
  models = createModels(connection);
  uploadDir = fs.mkdtempSync(path.join(os.tmpdir(), 'guessai-up-'));
  staticDir = fs.mkdtempSync(path.join(os.tmpdir(), 'guessai-web-'));
  fs.writeFileSync(path.join(staticDir, 'index.html'), '<!doctype html><div id="root"></div>');

  const tokens = createGuestTokens({ secret: SECRET, secure: false });
  const draw = async (theme) => {
    drawn.push(theme);
    return `<canvas id="c"></canvas><script>/* ${theme} */</script>`;
  };
  const generator = createCanvasGenerator({ models, draw });
  const app = createApp({
    config: { trustProxy: false, staticDir },
    models,
    tokens,
    recaptcha: async (token) => (token === 'good' ? { ok: true } : { ok: false, status: 403 }),
    uploads: createUploads({ dir: uploadDir }),
  });
  server = http.createServer(app);
  await new Promise((resolve) => { server.listen(0, '127.0.0.1', resolve); });
  base = `http://127.0.0.1:${server.address().port}`;
  io = createSocketServer({
    httpServer: server, allowedOrigins: [base], models, tokens, generator,
  });
  await models.Theme.create({ themeTW: '蘋果', themeEN: 'Apple', themeJP: 'りんご' });
});

after(async () => {
  io?.close();
  server?.close();
  if (connection) {
    await connection.dropDatabase();
    await connection.close();
  }
});

const cookieOf = (response) => response.headers.getSetCookie().find((c) => c.startsWith('guessai_canvas_access_token='))?.split(';')[0];

const newPlayer = async (name, { token = 'good', photo = true } = {}) => {
  const form = new FormData();
  form.append('name', name);
  form.append('token', token);
  if (photo) form.append('photo', new Blob([PNG], { type: 'image/png' }), 'me.png');
  return fetch(`${base}/api/guessai_canvas/simple_user/`, { method: 'POST', body: form });
};

test('a new player gets a pass and can read and update themselves', { skip: !url }, async () => {
  const created = await newPlayer('小明');
  assert.equal(created.status, 200);
  const body = await created.json();
  assert.equal(body.name, '小明');
  assert.equal(body.score, 0);
  assert.match(body.photo, /^guessai-\d+-[a-f0-9]+\.png$/);
  const cookie = cookieOf(created);
  assert.ok(cookie);
  assert.match(created.headers.getSetCookie()[0], /HttpOnly/i);

  const me = await fetch(`${base}/api/guessai_canvas/simple_user/`, { headers: { cookie } });
  assert.equal((await me.json()).name, '小明');

  const photo = await fetch(`${base}/api/guessai_canvas/user_photo/${body.photo}/`);
  assert.equal(photo.status, 200);

  const form = new FormData();
  form.append('photo', new Blob([PNG], { type: 'image/png' }), 'new.png');
  const updated = await fetch(`${base}/api/guessai_canvas/simple_user/`, { method: 'PUT', body: form, headers: { cookie } });
  const { simpleUser } = await updated.json();
  assert.notEqual(simpleUser.photo, body.photo);
  assert.equal(fs.existsSync(path.join(uploadDir, body.photo)), false);
});

test('a pass from the old 6yuwei_api finds the moved player', { skip: !url }, async () => {
  const player = await models.SimpleUser.create({ name: '老玩家', score: 300 });
  const old = jwt.sign({ userId: player.id }, SECRET, { expiresIn: '1y' });
  const me = await fetch(`${base}/api/guessai_canvas/simple_user/`, { headers: { cookie: `guessai_canvas_access_token=${old}` } });
  assert.equal((await me.json()).score, 300);
});

test('failed reCAPTCHA, missing name and bad files are refused and leave no file behind', { skip: !url }, async () => {
  const before = fs.readdirSync(uploadDir).length;
  assert.equal((await newPlayer('x', { token: 'bad' })).status, 403);
  assert.equal((await newPlayer('')).status, 400);
  const form = new FormData();
  form.append('name', 'x');
  form.append('token', 'good');
  form.append('photo', new Blob(['not an image'], { type: 'text/plain' }), 'a.txt');
  assert.equal((await fetch(`${base}/api/guessai_canvas/simple_user/`, { method: 'POST', body: form })).status, 400);
  assert.equal(fs.readdirSync(uploadDir).length, before);
  assert.equal((await fetch(`${base}/api/guessai_canvas/simple_user/`)).status, 403);
  assert.equal((await fetch(`${base}/api/guessai_canvas/user_photo/..%2Fsecret/`)).status, 404);
});

test('chat: a correct guess scores, solves the canvas and starts the next one', { skip: !url }, async () => {
  const solver = await newPlayer('猜題王', { photo: false });
  const cookie = cookieOf(solver);
  // No canvas yet: the first message starts one
  await models.GuessAICanvas.deleteMany({});

  const socket = connect(base, { path: SOCKET_PATH, extraHeaders: { cookie, origin: base }, transports: ['websocket'] });
  const events = [];
  socket.onAny((name, payload) => events.push({ name, payload }));
  await new Promise((resolve) => { socket.on('connect', resolve); });

  const waitFor = (predicate) => new Promise((resolve, reject) => {
    const started = Date.now();
    const check = () => {
      const found = events.find(predicate);
      if (found) return resolve(found);
      if (Date.now() - started > 3000) return reject(new Error('timed out'));
      return setTimeout(check, 20);
    };
    check();
  });

  socket.emit('client message', 'hello');
  await waitFor((e) => e.name === 'server canvas' && e.payload.status === 'done');
  const canvas = await models.GuessAICanvas.findOne().sort({ createdAt: -1 });
  assert.equal(canvas.solved, false);
  assert.doesNotMatch(canvas.canvas, /apple/i);

  socket.emit('client message', 'APPLE');
  const solved = await waitFor((e) => e.name === 'server canvas' && e.payload.status === 'loading');
  assert.deepEqual(solved.payload.correctRespondent.name, '猜題王');
  await waitFor((e) => e.name === 'server ranking');
  const message = await waitFor((e) => e.name === 'server message' && e.payload.message === 'APPLE');
  assert.equal(message.payload.isCorrect, true);
  assert.equal((await models.SimpleUser.findOne({ name: '猜題王' })).score, 100);
  socket.close();
});

test('listeners without a pass cannot send messages', { skip: !url }, async () => {
  const count = await models.Messages.countDocuments();
  const socket = connect(base, { path: SOCKET_PATH, extraHeaders: { origin: base }, transports: ['websocket'] });
  await new Promise((resolve) => { socket.on('connect', resolve); });
  socket.emit('client message', 'spam');
  await new Promise((resolve) => { setTimeout(resolve, 200); });
  assert.equal(await models.Messages.countDocuments(), count);
  socket.close();
});

test('sockets from other sites are refused', { skip: !url }, async () => {
  const socket = connect(base, { path: SOCKET_PATH, extraHeaders: { origin: 'https://evil.example' }, transports: ['polling'], reconnection: false });
  const error = await new Promise((resolve) => { socket.on('connect_error', resolve); });
  assert.ok(error);
  socket.close();
});

test('canvas pages are sandboxed; gallery and ranking answer as before', { skip: !url }, async () => {
  const page = await fetch(`${base}/api/guessai_canvas/canvas/`);
  assert.match(page.headers.get('content-security-policy'), /sandbox allow-scripts/);
  const [first] = await models.GuessAICanvas.find().sort({ createdAt: 1 });
  const gallery = await fetch(`${base}/api/guessai_canvas/canvas/${first.id}/`);
  assert.equal(gallery.status, 200);
  assert.match(gallery.headers.get('content-security-policy'), /sandbox allow-scripts/);
  assert.equal((await fetch(`${base}/api/guessai_canvas/canvas/not-an-id/`)).status, 404);

  const list = await (await fetch(`${base}/api/guessai_canvas/canvas_list/?page=1&keyword=蘋果`)).json();
  assert.deepEqual(Object.keys(list).sort(), ['canvasList', 'currentPage', 'resultTotal', 'resultTotalPage', 'solvedProbability', 'total']);
  assert.equal((await fetch(`${base}/api/guessai_canvas/canvas_list/?page=0`)).status, 404);

  const ranking = await (await fetch(`${base}/api/guessai_canvas/ranking/`)).json();
  assert.equal(ranking[0].score, 300);
  const messages = await (await fetch(`${base}/api/guessai_canvas/msg_list/`)).json();
  assert.equal(messages.at(-1).message, 'APPLE');
  assert.equal(messages.at(-1).user.name, '猜題王');
});

test('the built frontend is served for app paths, not for unknown API paths', { skip: !url }, async () => {
  const page = await fetch(`${base}/gallery`);
  assert.match(await page.text(), /id="root"/);
  assert.equal((await fetch(`${base}/api/guessai_canvas/theme/`, { method: 'POST' })).status, 404);
  assert.equal((await fetch(`${base}/api/guessai_canvas/generate/`)).status, 404);
});
