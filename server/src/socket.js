import mongoose from 'mongoose';
import { Server } from 'socket.io';
import { GUEST_COOKIE, cookieFrom } from './guestToken.js';

/*
 * Chat and guessing over socket.io (docs/server.md §4), moved from 6yuwei_api/sockets/.
 * Anyone can listen; only players with a guest pass can send messages.
 */

export const SOCKET_PATH = '/api/guessai_canvas/socket.io/';
const MESSAGE_LIMIT = 12;
const MESSAGE_WINDOW_MS = 3 * 60 * 1000;
const POINTS = 100;
const GIVE_UP_MINUTES = 4;
const GIVE_UP_TRIES = 5;

const isCorrect = (text, canvas) => {
  const lower = text.toLowerCase();
  return lower === canvas.answerTW || lower === canvas.answerEN.toLowerCase() || lower === canvas.answerJP;
};

export const createSocketServer = ({
  httpServer, allowedOrigins, models, tokens, generator, now = () => Date.now(),
}) => {
  const { SimpleUser, GuessAICanvas, Messages } = models;
  const io = new Server(httpServer, {
    path: SOCKET_PATH,
    cors: { origin: allowedOrigins, credentials: true },
    // CORS does not cover WebSocket connections, so check the page they come from here
    allowRequest: (req, callback) => {
      const { origin } = req.headers;
      callback(null, !origin || allowedOrigins.includes(origin));
    },
  });

  const handleMessage = async (socket, userId, text) => {
    if (typeof text !== 'string' || !text.trim()) return;
    const user = await SimpleUser.findById(userId);
    if (!user) return;

    const recent = await Messages.countDocuments({ user: userId, createdAt: { $gte: new Date(now() - MESSAGE_WINDOW_MS) } });
    if (recent >= MESSAGE_LIMIT) {
      io.to(socket.id).emit('server message', { status: 'error', message: 'Please wait 3 minutes before sending another message.' });
      return;
    }

    const canvas = await GuessAICanvas.findOne().sort({ createdAt: -1 });
    const message = new Messages({ message: text, user: userId, isCorrect: false });
    const active = canvas && !canvas.solved;
    let correct = false;

    if (!active) {
      generator.generate(io);
    } else if (isCorrect(text, canvas)) {
      correct = true;
      message.isCorrect = true;
      user.score = (user.score || 0) + POINTS;
      await user.save();
      // Saved before generating, which only starts when the newest canvas is solved
      canvas.solved = true;
      canvas.correctRespondent = userId;
      await canvas.save();
      generator.generate(io);
      io.emit('server canvas', {
        status: 'loading',
        prevAnswer: { answerTW: canvas.answerTW, answerEN: canvas.answerEN, answerJP: canvas.answerJP },
        correctRespondent: { name: user.name, photo: user.photo },
      });
      io.emit('server ranking', await SimpleUser.find().sort({ score: -1 }).limit(30));
    }

    await message.save();

    if (active && !correct) {
      const minutes = Math.floor((now() - canvas.createdAt.getTime()) / 60000);
      const tries = await Messages.find({ createdAt: { $gte: canvas.createdAt } });
      if (!tries.some((t) => t.isCorrect) && minutes > GIVE_UP_MINUTES && tries.length > GIVE_UP_TRIES) {
        io.emit('server canvas', {
          status: 'loading',
          prevAnswer: { answerTW: canvas.answerTW, answerEN: canvas.answerEN, answerJP: canvas.answerJP },
          correctRespondent: null,
        });
        canvas.solved = true;
        await canvas.save();
        generator.generate(io);
      }
    }

    io.emit('server message', {
      user: { name: user.name, photo: user.photo },
      message: text,
      createdAt: message.createdAt,
      isCorrect: message.isCorrect,
    });
  };

  io.on('connection', (socket) => {
    const userId = tokens.verify(cookieFrom(socket.handshake.headers.cookie, GUEST_COOKIE));
    socket.on('client message', (text) => {
      if (!userId || !mongoose.isValidObjectId(userId)) return;
      handleMessage(socket, userId, text).catch((error) => console.error('message failed:', error));
    });
  });

  return io;
};
