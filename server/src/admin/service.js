import mongoose from 'mongoose';

/*
 * What the admin pages do (docs/server.md §6.2). The router only reads forms and renders; the
 * rules live here. Every change writes one admin_logs entry.
 */

export const PAGE_SIZE = 50;
export const MAX_THEME_LINES = 500;
export const MAX_NAME_LENGTH = 50;
const THEME_SEPARATOR = /\s*(?:\t|,|，|\||｜)\s*/;

const escapeRegex = (value) => String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const pageOf = (value) => {
  const page = Number(value);
  return Number.isInteger(page) && page >= 1 ? page : 1;
};

/**
 * Reads one theme per line: Chinese, English, Japanese, separated by a tab, a comma or a bar.
 * Returns { themes, invalidLines } with 1-based line numbers.
 */
export const parseThemeLines = (text) => {
  const themes = [];
  const invalidLines = [];
  String(text ?? '').split(/\r?\n/).forEach((line, index) => {
    if (!line.trim()) return;
    const parts = line.trim().split(THEME_SEPARATOR);
    if (parts.length !== 3 || parts.some((part) => !part || part.length > 100)) {
      invalidLines.push(index + 1);
      return;
    }
    const [themeTW, themeEN, themeJP] = parts;
    themes.push({ themeTW, themeEN, themeJP });
  });
  return { themes, invalidLines };
};

export class AdminInputError extends Error {}

export const createAdminService = ({
  models, uploads, generateCanvas, notifyRanking = () => {},
}) => {
  const {
    SimpleUser, GuessAICanvas, Messages, Theme, AdminLog,
  } = models;

  const log = (action, target, detail) => AdminLog.create({ action, target, detail });

  const paged = async (Model, filter, page, sort, populate) => {
    const total = await Model.countDocuments(filter);
    const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
    const current = Math.min(pageOf(page), pages);
    let query = Model.find(filter).sort(sort).skip((current - 1) * PAGE_SIZE).limit(PAGE_SIZE);
    if (populate) query = query.populate(populate);
    return {
      items: await query, total, page: current, pages,
    };
  };

  const findById = async (Model, id) => (mongoose.isValidObjectId(id) ? Model.findById(id) : null);

  const topPlayers = () => SimpleUser.find().sort({ score: -1 }).limit(30);

  return {
    overview: async () => {
      const latest = await GuessAICanvas.findOne().sort({ createdAt: -1 });
      return {
        players: await SimpleUser.estimatedDocumentCount(),
        canvases: await GuessAICanvas.estimatedDocumentCount(),
        themes: await Theme.estimatedDocumentCount(),
        messages: await Messages.estimatedDocumentCount(),
        latest,
        logs: await AdminLog.find().sort({ createdAt: -1 }).limit(20),
      };
    },

    listThemes: ({ page, keyword }) => {
      const filter = keyword
        ? { $or: ['themeTW', 'themeEN', 'themeJP'].map((field) => ({ [field]: { $regex: escapeRegex(keyword), $options: 'i' } })) }
        : {};
      return paged(Theme, filter, page, { createdAt: -1 });
    },

    /** Adds themes from text. A Chinese name that already exists is skipped (the old rule). */
    addThemes: async (text) => {
      const { themes, invalidLines } = parseThemeLines(text);
      if (themes.length + invalidLines.length > MAX_THEME_LINES) {
        throw new AdminInputError(`一次最多 ${MAX_THEME_LINES} 行`);
      }
      const known = new Set((await Theme.find({}, { themeTW: 1 })).map((theme) => theme.themeTW));
      const fresh = themes.filter((theme) => {
        if (known.has(theme.themeTW)) return false;
        known.add(theme.themeTW);
        return true;
      });
      if (fresh.length) {
        await Theme.insertMany(fresh);
        await log('theme.add', `${fresh.length}`, fresh.map((theme) => theme.themeTW).join('、').slice(0, 500));
      }
      return { added: fresh.length, skipped: themes.length - fresh.length, invalidLines };
    },

    deleteTheme: async (id) => {
      const theme = await findById(Theme, id);
      if (!theme) return false;
      await theme.deleteOne();
      await log('theme.delete', theme.id, theme.themeTW);
      return true;
    },

    listCanvases: ({ page }) => paged(GuessAICanvas, {}, page, { createdAt: -1 }, 'correctRespondent'),

    deleteCanvas: async (id) => {
      const canvas = await findById(GuessAICanvas, id);
      if (!canvas) return false;
      await canvas.deleteOne();
      await log('canvas.delete', canvas.id, canvas.answerTW);
      return true;
    },

    /** Starts a new canvas now. Returns the generator's { ok, status, error }. */
    generateCanvas: async () => {
      const result = await generateCanvas();
      await log('canvas.generate', '', result.ok ? 'ok' : `${result.status} ${result.error}`);
      return result;
    },

    listMessages: ({ page }) => paged(Messages, {}, page, { createdAt: -1 }, 'user'),

    deleteMessage: async (id) => {
      const message = await findById(Messages, id);
      if (!message) return false;
      await message.deleteOne();
      await log('message.delete', message.id, String(message.message ?? '').slice(0, 200));
      return true;
    },

    listPlayers: ({ page, keyword }) => {
      const filter = keyword ? { name: { $regex: escapeRegex(keyword), $options: 'i' } } : {};
      return paged(SimpleUser, filter, page, { score: -1, createdAt: 1 });
    },

    renamePlayer: async (id, name) => {
      const value = String(name ?? '').trim();
      if (!value || value.length > MAX_NAME_LENGTH) throw new AdminInputError(`暱稱要 1 到 ${MAX_NAME_LENGTH} 個字`);
      const player = await findById(SimpleUser, id);
      if (!player) return false;
      const before = player.name;
      player.name = value;
      await player.save();
      await log('player.rename', player.id, `${before} → ${value}`);
      return true;
    },

    resetPlayerScore: async (id) => {
      const player = await findById(SimpleUser, id);
      if (!player) return false;
      const before = player.score ?? 0;
      player.score = 0;
      await player.save();
      await log('player.reset_score', player.id, `${player.name}：${before} → 0`);
      notifyRanking(await topPlayers());
      return true;
    },

    /** Deletes the player, their photo and their chat messages (the chat cannot show a missing player). */
    deletePlayer: async (id) => {
      const player = await findById(SimpleUser, id);
      if (!player) return false;
      const { deletedCount } = await Messages.deleteMany({ user: player._id });
      await player.deleteOne();
      await uploads.remove(player.photo);
      await log('player.delete', player.id, `${player.name}（訊息 ${deletedCount} 則）`);
      notifyRanking(await topPlayers());
      return true;
    },

    resetRanking: async () => {
      const { modifiedCount } = await SimpleUser.updateMany({ score: { $ne: 0 } }, { $set: { score: 0 } });
      await log('ranking.reset', '', `${modifiedCount} 位玩家`);
      notifyRanking(await topPlayers());
      return modifiedCount;
    },

    logSignIn: (success) => log(success ? 'login' : 'login.failed'),
    logSignOut: () => log('logout'),
  };
};
