import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import multer from 'multer';

/*
 * Player photos: jpg, png, gif or webp up to 5 MB, saved under a random name. At most five
 * uploads per IP per day (the rule the old API had).
 */

export const INVALID_IMAGE_MESSAGE = 'Only jpg, jpeg, png, gif, and webp images are allowed.';
const MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/gif', 'image/webp']);
const EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.gif', '.webp']);
const MAX_BYTES = 5 * 1024 * 1024;
export const DAILY_UPLOADS = 5;

const extensionOf = (name = '') => {
  const extension = path.extname(name).toLowerCase();
  return EXTENSIONS.has(extension) ? extension : '';
};

/** The name when it is a plain file name, or null when it could reach another folder. */
export const safeFileName = (name) => {
  const value = String(name ?? '');
  const plain = value === path.basename(value) && !value.includes('\\') && !value.startsWith('.');
  return value && plain ? value : null;
};

export const createUploads = ({ dir, now = () => new Date() }) => {
  fs.mkdirSync(dir, { recursive: true });

  const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, dir),
    filename: (req, file, cb) => {
      const extension = extensionOf(file.originalname);
      if (!extension) return cb(new Error(INVALID_IMAGE_MESSAGE), null);
      return cb(null, `guessai-${Date.now()}-${crypto.randomBytes(8).toString('hex')}${extension}`);
    },
  });

  const upload = multer({
    storage,
    limits: { fileSize: MAX_BYTES },
    fileFilter: (req, file, cb) => {
      if (!MIME_TYPES.has((file.mimetype || '').toLowerCase()) || !extensionOf(file.originalname)) {
        req.fileError = INVALID_IMAGE_MESSAGE;
        return cb(null, false);
      }
      return cb(null, true);
    },
  });

  /** Middleware: parses one optional `photo` field (and the other form fields). */
  const receivePhoto = (req, res, next) => upload.single('photo')(req, res, (error) => {
    if (error instanceof multer.MulterError && error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).send('Image must be 5MB or smaller.');
    }
    if (error) return res.status(400).send(error.message || 'Upload failed');
    return next();
  });

  const remove = async (filename) => {
    const name = safeFileName(filename);
    if (!name) return;
    await fs.promises.unlink(path.join(dir, name)).catch((error) => {
      if (error.code !== 'ENOENT') console.error(error);
    });
  };

  // Daily count per IP, kept in memory like the old API
  const counters = new Map();
  const dayKey = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Taipei' }).format(now());
  const limitDaily = async (req, res, next) => {
    if (!req.file) return next();
    const day = dayKey();
    counters.forEach((value, key) => { if (!key.endsWith(`:${day}`)) counters.delete(key); });
    const key = `${req.ip}:${day}`;
    const count = counters.get(key) ?? 0;
    if (count >= DAILY_UPLOADS) {
      await remove(req.file.filename);
      return res.status(429).send(`You can upload up to ${DAILY_UPLOADS} images per day from the same IP.`);
    }
    counters.set(key, count + 1);
    return next();
  };

  const send = (res, filename) => {
    const name = safeFileName(filename);
    if (!name) return res.status(404).send('File not found');
    res.set('Cache-Control', 'no-cache');
    return res.sendFile(name, { root: dir }, (error) => {
      if (error && !res.headersSent) res.status(404).send('File not found');
    });
  };

  return {
    receivePhoto, limitDaily, remove, send,
  };
};
