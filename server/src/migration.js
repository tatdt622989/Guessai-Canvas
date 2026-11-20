import { copyFile, mkdir, stat } from 'node:fs/promises';
import path from 'node:path';

/*
 * MIG-05: the game's data from the old 6yuwei database into guessai_canvas (docs/server.md §7).
 * The four collections keep their names, fields and _ids, so old passes and every reference
 * between them keep working. Player photos are copied with their names unchanged.
 *
 * The old data is only read and nothing is deleted. Only what is missing is added: a document
 * or photo already in the new place is never overwritten, so running it again changes nothing.
 */

export const COLLECTIONS = ['simpleusers', 'messages', 'guessaicanvas', 'themes'];

const safeName = (name) => {
  const value = String(name ?? '');
  return value && value === path.basename(value) && !value.startsWith('.') ? value : null;
};

/** Copies the four collections. Returns { [name]: { old, copied, existing, missing } }. */
export const copyCollections = async ({ oldDb, db, dryRun = false }) => {
  const report = {};
  for (const name of COLLECTIONS) {
    const docs = await oldDb.collection(name).find({}).toArray();
    const target = db.collection(name);
    const present = new Set((await target.find({}, { projection: { _id: 1 } }).toArray()).map(({ _id }) => String(_id)));
    const toCopy = docs.filter((doc) => !present.has(String(doc._id)));
    if (!dryRun && toCopy.length) {
      await target.bulkWrite(toCopy.map(({ _id, ...doc }) => ({
        updateOne: { filter: { _id }, update: { $setOnInsert: doc }, upsert: true },
      })), { ordered: false });
    }
    const after = dryRun ? present : new Set((await target.find({}, { projection: { _id: 1 } }).toArray()).map(({ _id }) => String(_id)));
    report[name] = {
      old: docs.length,
      [dryRun ? 'wouldCopy' : 'copied']: toCopy.length,
      existing: docs.length - toCopy.length,
      missing: dryRun ? [] : docs.filter((doc) => !after.has(String(doc._id))).map((doc) => String(doc._id)),
    };
  }
  return report;
};

/** Copies the photo of every old player into uploadDir. Returns { photos, copied, existing, missingFile, refused }. */
export const copyPhotos = async ({
  oldDb, oldPhotos, uploadDir, dryRun = false,
}) => {
  const players = await oldDb.collection('simpleusers').find({ photo: { $type: 'string', $ne: '' } }, { projection: { photo: 1 } }).toArray();
  const report = {
    photos: players.length, copied: 0, existing: 0, missingFile: [], refused: [],
  };
  if (!dryRun) await mkdir(uploadDir, { recursive: true });
  for (const { _id, photo } of players) {
    const name = safeName(photo);
    if (!name) {
      report.refused.push({ id: String(_id), photo });
      continue;
    }
    const exists = await stat(path.join(uploadDir, name)).then(() => true, () => false);
    if (exists) {
      report.existing += 1;
      continue;
    }
    const source = path.join(oldPhotos, name);
    if (!(await stat(source).then((s) => s.isFile(), () => false))) {
      report.missingFile.push({ id: String(_id), photo: name });
      continue;
    }
    if (!dryRun) await copyFile(source, path.join(uploadDir, name));
    report.copied += 1;
  }
  return report;
};
