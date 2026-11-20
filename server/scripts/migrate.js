#!/usr/bin/env node
/*
 * MIG-05 on the cut-over day (docs/server.md §7). Run with --dry-run first:
 *
 *   OLD_MONGODB_URI=... MONGODB_URI=... node scripts/migrate.js --photos <old uploads/guessai_canvas/img> [--dry-run]
 *
 * OLD_MONGODB_URI is the old 6yuwei database, which is only read; MONGODB_URI is guessai_canvas.
 * Photos go to UPLOAD_DIR (default /data/uploads/img). Nothing is deleted, and a document or
 * photo that is already there is never overwritten.
 */
import process from 'node:process';
import mongoose from 'mongoose';
import { copyCollections, copyPhotos } from '../src/migration.js';

const { MongoClient } = mongoose.mongo;

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const at = args.indexOf('--photos');
const oldPhotos = at >= 0 ? args[at + 1] : undefined;
const missing = ['OLD_MONGODB_URI', 'MONGODB_URI'].filter((name) => !process.env[name]);
if (missing.length || !oldPhotos) {
  process.stderr.write(`needs ${[...missing, ...(oldPhotos ? [] : ['--photos <folder>'])].join(', ')}\n`);
  process.exit(2);
}

const old = await new MongoClient(process.env.OLD_MONGODB_URI).connect();
const target = await new MongoClient(process.env.MONGODB_URI).connect();
let exitCode = 0;
try {
  const collections = await copyCollections({ oldDb: old.db(), db: target.db(), dryRun });
  const photos = await copyPhotos({
    oldDb: old.db(), oldPhotos, uploadDir: process.env.UPLOAD_DIR || '/data/uploads/img', dryRun,
  });
  if (Object.values(collections).some((c) => c.missing.length)) exitCode = 1;
  process.stdout.write(`${JSON.stringify({ dryRun, collections, photos }, null, 2)}\n`);
} finally {
  await old.close();
  await target.close();
}
process.exit(exitCode);
