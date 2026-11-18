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

/** Models bound to one connection, so tests can use their own database. */
export const createModels = (connection) => ({
  SimpleUser: connection.model('SimpleUser', simpleUserSchema),
  GuessAICanvas: connection.model('GuessAICanvas', canvasSchema),
  Messages: connection.model('Messages', messageSchema),
  Theme: connection.model('Theme', themeSchema),
});
