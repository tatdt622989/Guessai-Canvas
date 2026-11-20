import express from 'express';
import mongoose from 'mongoose';
import xss from 'xss';
import { CANVAS_CSP, currentCanvasPage, emptyCanvasPage, galleryCanvasPage } from '../canvas/pages.js';
import { GUEST_COOKIE, cookieFrom } from '../guestToken.js';

/*
 * The game API under /api/guessai_canvas (docs/server.md §3). Paths, requests and answers are the
 * ones the old 6yuwei_api served, so the frontend works unchanged.
 */

const isText = (value) => typeof value === 'string' && value.trim() !== '';
const escapeRegex = (value) => String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const PAGE_SIZE = 12;

export const createGameRouter = ({
  models, tokens, recaptcha, uploads,
}) => {
  const { SimpleUser, GuessAICanvas, Messages } = models;
  const router = express.Router();

  const playerOf = async (req) => {
    const userId = tokens.verify(cookieFrom(req.headers.cookie, GUEST_COOKIE));
    if (!userId || !mongoose.isValidObjectId(userId)) return null;
    return SimpleUser.findById(userId);
  };

  // Multer saves the file before these checks, so a refused request removes it
  const refuse = async (req, res, status, message) => {
    await uploads.remove(req.file?.filename);
    return res.status(status).send(message);
  };

  router.post('/simple_user/', uploads.receivePhoto, uploads.limitDaily, async (req, res) => {
    if (req.fileError) return refuse(req, res, 400, req.fileError);
    const check = await recaptcha(req.body?.token);
    if (!check.ok) return refuse(req, res, check.status, 'Recaptcha failed');
    const { name } = req.body;
    if (!isText(name)) return refuse(req, res, 400, 'Name is required');

    let player;
    try {
      player = await SimpleUser.create({ name, photo: req.file?.filename, score: 0 });
    } catch (error) {
      console.error('player creation failed:', error);
      return refuse(req, res, 500, 'Registration Failure');
    }
    res.cookie(GUEST_COOKIE, tokens.issue(player.id), tokens.cookieOptions);
    return res.json({
      message: 'Registration Success', id: player.id, name: player.name, photo: player.photo, score: player.score,
    });
  });

  router.get('/simple_user/', async (req, res) => {
    if (!cookieFrom(req.headers.cookie, GUEST_COOKIE)) return res.status(403).send('No token');
    const player = await playerOf(req);
    if (!player) return res.status(403).send('Please login first');
    return res.json(player);
  });

  router.put('/simple_user/', uploads.receivePhoto, uploads.limitDaily, async (req, res) => {
    if (req.fileError) return refuse(req, res, 400, req.fileError);
    if (!cookieFrom(req.headers.cookie, GUEST_COOKIE)) return refuse(req, res, 403, 'No token');
    const player = await playerOf(req);
    if (!player) return refuse(req, res, 403, 'Please login first');
    if (req.file?.filename) {
      await uploads.remove(player.photo);
      player.photo = req.file.filename;
    }
    await player.save();
    return res.json({ message: 'success', simpleUser: player });
  });

  router.get('/user_photo/:filename/', (req, res) => uploads.send(res, req.params.filename));

  router.get('/msg_list/', async (req, res) => {
    const list = await Messages.find().populate('user').sort({ createdAt: -1 }).limit(1000);
    // The chat shows each sender's name, so messages of a deleted player are left out
    return res.json(list.filter((message) => message.user).reverse());
  });

  const canvasHeaders = (res) => res.set({
    'Content-Security-Policy': CANVAS_CSP,
    'Content-Type': 'text/html; charset=utf-8',
    'Cache-Control': 'no-store',
  });

  router.get('/canvas/', async (req, res) => {
    const canvas = await GuessAICanvas.findOne().sort({ createdAt: -1 });
    canvasHeaders(res);
    return res.send(!canvas || canvas.solved ? emptyCanvasPage() : currentCanvasPage(canvas.canvas));
  });

  router.get('/canvas/:id/', async (req, res) => {
    const canvas = mongoose.isValidObjectId(req.params.id) ? await GuessAICanvas.findById(req.params.id) : null;
    if (!canvas) return res.status(404).send('Not found');
    canvasHeaders(res);
    return res.send(galleryCanvasPage(canvas.canvas));
  });

  router.get('/ranking/', async (req, res) => res.json(await SimpleUser.find().sort({ score: -1 }).limit(30)));

  router.get('/canvas_list/', async (req, res) => {
    const page = req.query.page === undefined ? 1 : Number(req.query.page);
    if (!Number.isInteger(page) || page < 1) return res.status(404).send('Not found');

    const newest = await GuessAICanvas.findOne().sort({ createdAt: -1 });
    if (!newest) {
      return res.json({
        canvasList: [], currentPage: page, solvedProbability: 0, resultTotal: 0, resultTotalPage: 0, total: 0,
      });
    }
    // The canvas being played is not shown in the gallery
    const others = { _id: { $ne: newest._id } };
    const total = await GuessAICanvas.countDocuments(others);
    const solved = await GuessAICanvas.countDocuments({ ...others, correctRespondent: { $exists: true } });
    const query = { ...others };
    const keyword = typeof req.query.keyword === 'string' ? req.query.keyword : '';
    if (keyword) {
      const pattern = escapeRegex(xss(keyword));
      query.$or = ['answerTW', 'answerEN', 'answerJP'].map((field) => ({ [field]: { $regex: pattern, $options: 'i' } }));
    }
    const resultTotal = await GuessAICanvas.countDocuments(query);
    const canvases = await GuessAICanvas.find(query).sort({ createdAt: -1 }).skip((page - 1) * PAGE_SIZE).limit(PAGE_SIZE);
    // The gallery marks a canvas solved when it has a respondent. A deleted player still solved it.
    const solvers = new Map((await SimpleUser.find({ _id: { $in: canvases.map((c) => c.correctRespondent).filter(Boolean) } }))
      .map((player) => [player.id, player]));
    const canvasList = canvases.map((canvas) => {
      const item = canvas.toJSON();
      if (canvas.correctRespondent) {
        const id = String(canvas.correctRespondent);
        item.correctRespondent = solvers.get(id)?.toJSON() ?? { _id: id, name: '', photo: '' };
      }
      return item;
    });

    return res.json({
      canvasList,
      currentPage: page,
      solvedProbability: total ? Number(((solved / total) * 100).toFixed(2)) : 0,
      resultTotal,
      resultTotalPage: Math.ceil(resultTotal / PAGE_SIZE),
      total,
    });
  });

  return router;
};
