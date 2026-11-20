// MIG-05: the game's data from the old 6yuwei database (src/migration.js, scripts/migrate.js).
// Needs MongoDB; skipped unless GUESSAI_TEST_MONGO_URL is set. Uses only the guessai_test_migrate
// and guessai_test_migrate_old databases.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { after, before, test } from 'node:test';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import { createGuestTokens } from '../src/guestToken.js';
import { COLLECTIONS, copyCollections, copyPhotos } from '../src/migration.js';
import { createModels } from '../src/models.js';

const url = process.env.GUESSAI_TEST_MONGO_URL;
const skip = url ? false : 'needs MongoDB: GUESSAI_TEST_MONGO_URL=mongodb://127.0.0.1:27017/ npm test';
const OLD_DB = 'guessai_test_migrate_old';
const NEW_DB = 'guessai_test_migrate';
const SCRIPT = fileURLToPath(new URL('../scripts/migrate.js', import.meta.url));
const OLD_SECRET = 'the-old-api-secret-key-for-tests';

let client;
let oldDb;
let db;
let dir;
const { ObjectId } = mongoose.Types;

before(async () => {
  if (!url) return;
  client = await new mongoose.mongo.MongoClient(url).connect();
  oldDb = client.db(OLD_DB);
  db = client.db(NEW_DB);
  dir = await fs.mkdtemp(path.join(os.tmpdir(), 'guessai-migrate-'));
});

after(async () => {
  if (client) {
    await oldDb.dropDatabase();
    await db.dropDatabase();
    await client.close();
  }
  if (dir) await fs.rm(dir, { recursive: true, force: true });
});

const seed = async () => {
  await oldDb.dropDatabase();
  await db.dropDatabase();
  const player = { _id: new ObjectId(), name: '老玩家', photo: 'p1.png', score: 300, createdAt: new Date('2025-01-01'), updatedAt: new Date('2025-02-01') };
  const other = { _id: new ObjectId(), name: '沒頭像', score: 10 };
  const lost = { _id: new ObjectId(), name: '頭像不見了', photo: 'gone.png', score: 0 };
  const sneaky = { _id: new ObjectId(), name: '奇怪的檔名', photo: '../../etc/passwd', score: 0 };
  const canvas = { _id: new ObjectId(), canvas: '<canvas></canvas>', answerTW: '蘋果', answerEN: 'apple', answerJP: 'りんご', correctRespondent: player._id, solved: true };
  await oldDb.collection('simpleusers').insertMany([player, other, lost, sneaky]);
  await oldDb.collection('guessaicanvas').insertOne(canvas);
  await oldDb.collection('messages').insertMany([
    { _id: new ObjectId(), message: '是蘋果嗎', user: player._id, isCorrect: true },
    { _id: new ObjectId(), message: '香蕉', user: other._id, isCorrect: false },
  ]);
  await oldDb.collection('themes').insertMany([{ _id: new ObjectId(), themeTW: '貓', themeEN: 'cat', themeJP: 'ねこ' }]);
  // Unrelated old data stays out of the new database
  await oldDb.collection('users').insertOne({ _id: new ObjectId(), email: 'someone@example.com' });
  const oldPhotos = path.join(dir, 'old-img');
  const uploadDir = path.join(dir, 'new-img');
  await fs.rm(oldPhotos, { recursive: true, force: true });
  await fs.rm(uploadDir, { recursive: true, force: true });
  await fs.mkdir(oldPhotos, { recursive: true });
  const bytes = crypto.randomBytes(128);
  await fs.writeFile(path.join(oldPhotos, 'p1.png'), bytes);
  return {
    player, canvas, oldPhotos, uploadDir, bytes,
  };
};

test('the four collections are copied as they are, once, and an old pass finds its player', { skip }, async () => {
  const { player, canvas } = await seed();

  const dry = await copyCollections({ oldDb, db, dryRun: true });
  assert.equal(dry.simpleusers.wouldCopy, 4);
  assert.equal(await db.collection('simpleusers').countDocuments(), 0, 'a dry run writes nothing');

  const report = await copyCollections({ oldDb, db });
  assert.deepEqual(Object.fromEntries(COLLECTIONS.map((name) => [name, report[name].copied])), {
    simpleusers: 4, messages: 2, guessaicanvas: 1, themes: 1,
  });
  COLLECTIONS.forEach((name) => assert.deepEqual(report[name].missing, []));
  assert.deepEqual(await db.collection('simpleusers').findOne({ _id: player._id }), player, 'every field, dates included');
  assert.equal(String((await db.collection('guessaicanvas').findOne({ _id: canvas._id })).correctRespondent), String(player._id));
  assert.equal(await db.collection('users').countDocuments(), 0);

  // The new service reads the moved player through its own models, from a pass the old API signed
  const connection = await mongoose.createConnection(`${url}${NEW_DB}`).asPromise();
  try {
    const models = createModels(connection);
    const tokens = createGuestTokens({ secret: OLD_SECRET });
    const oldPass = jwt.sign({ userId: String(player._id) }, OLD_SECRET, { expiresIn: '1y' });
    const userId = tokens.verify(oldPass);
    assert.equal(userId, String(player._id));
    const found = await models.SimpleUser.findById(userId);
    assert.equal(found.name, '老玩家');
    assert.equal(found.score, 300);
  } finally {
    await connection.close();
  }

  // A player who changed after the move keeps the change when it runs again
  await db.collection('simpleusers').updateOne({ _id: player._id }, { $set: { score: 400 } });
  const again = await copyCollections({ oldDb, db });
  assert.equal(again.simpleusers.copied, 0);
  assert.equal(again.simpleusers.existing, 4);
  assert.equal((await db.collection('simpleusers').findOne({ _id: player._id })).score, 400);
  // The old data is untouched
  assert.equal((await oldDb.collection('simpleusers').findOne({ _id: player._id })).score, 300);
});

test('player photos are copied under the same names; missing and odd names are reported', { skip }, async () => {
  const {
    player, oldPhotos, uploadDir, bytes,
  } = await seed();
  const dry = await copyPhotos({
    oldDb, oldPhotos, uploadDir, dryRun: true,
  });
  assert.equal(dry.copied, 1);
  await assert.rejects(fs.readdir(uploadDir), { code: 'ENOENT' });

  const report = await copyPhotos({ oldDb, oldPhotos, uploadDir });
  assert.equal(report.photos, 3);
  assert.equal(report.copied, 1);
  assert.deepEqual(report.missingFile.map((m) => m.photo), ['gone.png']);
  assert.deepEqual(report.refused.map((r) => r.photo), ['../../etc/passwd']);
  assert.deepEqual(await fs.readFile(path.join(uploadDir, player.photo)), bytes);
  assert.deepEqual(await fs.readFile(path.join(oldPhotos, player.photo)), bytes, 'the old photo stays');

  // A photo already in the new place is not overwritten
  await fs.writeFile(path.join(uploadDir, player.photo), 'changed');
  const again = await copyPhotos({ oldDb, oldPhotos, uploadDir });
  assert.equal(again.copied, 0);
  assert.equal(again.existing, 1);
  assert.equal(await fs.readFile(path.join(uploadDir, player.photo), 'utf8'), 'changed');
});

test('scripts/migrate.js copies both and prints a report', { skip }, async () => {
  const { oldPhotos, uploadDir } = await seed();
  const env = {
    PATH: process.env.PATH, OLD_MONGODB_URI: `${url}${OLD_DB}`, MONGODB_URI: `${url}${NEW_DB}`, UPLOAD_DIR: uploadDir,
  };
  const run = (...args) => spawnSync(process.execPath, [SCRIPT, ...args], { encoding: 'utf8', env });
  assert.equal(run().status, 2, '--photos is required');
  const dry = run('--photos', oldPhotos, '--dry-run');
  assert.equal(dry.status, 0, dry.stderr);
  assert.equal(JSON.parse(dry.stdout).collections.messages.wouldCopy, 2);
  const real = run('--photos', oldPhotos);
  assert.equal(real.status, 0, real.stderr);
  const report = JSON.parse(real.stdout);
  assert.equal(report.collections.themes.copied, 1);
  assert.equal(report.photos.copied, 1);
});
