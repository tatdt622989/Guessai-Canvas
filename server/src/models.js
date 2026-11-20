import mongoose from 'mongoose';

/*
 * The four collections moved from the 6yuwei database (docs/server.md §7). Collection names are
 * pinned to the names Mongoose gave them there, so the moved data is found without renaming.
 */

const simpleUserSchema = new mongoose.Schema({
  name: String,
  photo: String,
  score: Number,
}, { timestamps: true, collection: 'simpleusers' });

const canvasSchema = new mongoose.Schema({
  canvas: String,
  answerTW: String,
  answerEN: String,
  answerJP: String,
  correctRespondent: { type: mongoose.Schema.Types.ObjectId, ref: 'SimpleUser' },
  solved: Boolean,
}, { timestamps: true, collection: 'guessaicanvas' });

const messageSchema = new mongoose.Schema({
  message: String,
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'SimpleUser' },
  isCorrect: Boolean,
}, { timestamps: true, collection: 'messages' });

const themeSchema = new mongoose.Schema({
  themeTW: String,
  themeEN: String,
  themeJP: String,
}, { timestamps: true, collection: 'themes' });

/*
 * New collections (docs/server.md §7). Each expires through a TTL index on expiresAt; MongoDB
 * removes expired documents about once a minute, so the code also checks expiresAt itself.
 */

const handoffCodeSchema = new mongoose.Schema({
  codeHash: { type: String, required: true, unique: true },
  userId: { type: mongoose.Schema.Types.ObjectId, required: true },
  expiresAt: { type: Date, required: true, expires: 0 },
}, { collection: 'handoff_codes', versionKey: false });

const adminSessionSchema = new mongoose.Schema({
  idHash: { type: String, required: true, unique: true },
  csrfToken: { type: String, required: true },
  createdAt: { type: Date, required: true },
  lastSeenAt: { type: Date, required: true },
  expiresAt: { type: Date, required: true, expires: 0 },
}, { collection: 'admin_sessions', versionKey: false });

const adminLogSchema = new mongoose.Schema({
  action: { type: String, required: true },
  target: String,
  detail: String,
}, { timestamps: { createdAt: true, updatedAt: false }, collection: 'admin_logs', versionKey: false });

/** Models bound to one connection, so tests can use their own database. */
export const createModels = (connection) => ({
  SimpleUser: connection.model('SimpleUser', simpleUserSchema),
  GuessAICanvas: connection.model('GuessAICanvas', canvasSchema),
  Messages: connection.model('Messages', messageSchema),
  Theme: connection.model('Theme', themeSchema),
  HandoffCode: connection.model('HandoffCode', handoffCodeSchema),
  AdminSession: connection.model('AdminSession', adminSessionSchema),
  AdminLog: connection.model('AdminLog', adminLogSchema),
});
