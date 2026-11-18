/*
 * Canvas generation, moved from 6yuwei_api/controllers/guessai_canvas.js. Picks a random theme,
 * asks Gemini for canvas code, hides the answer inside the code, and saves the canvas. Only one
 * generation runs at a time, and none starts while an unsolved canvas exists.
 */

const RESERVED_WORDS = new Set([
  'abstract', 'arguments', 'await', 'boolean', 'break', 'byte', 'case', 'catch', 'char', 'class',
  'const', 'continue', 'debugger', 'default', 'delete', 'do', 'double', 'else', 'enum', 'eval',
  'export', 'extends', 'false', 'final', 'finally', 'float', 'for', 'function', 'goto', 'if',
  'implements', 'import', 'in', 'instanceof', 'int', 'interface', 'let', 'long', 'native', 'new',
  'null', 'package', 'private', 'protected', 'public', 'return', 'short', 'static', 'super',
  'switch', 'synchronized', 'this', 'throw', 'throws', 'transient', 'true', 'try', 'typeof', 'var',
  'void', 'volatile', 'while', 'with', 'yield', 'math', 'array', 'date',
]);

const escapeRegex = (value) => String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const randomWord = (random) => Array.from({ length: 5 }, () => 'abcdefghijklmnopqrstuvwxyz'[Math.floor(random() * 26)]).join('');

/**
 * Replaces every spelling of the English answer in the code with a random word, so players
 * cannot read the answer from the page source. Answers that are JavaScript words are left alone,
 * because replacing them would break the code.
 */
export const hideAnswer = (code, answerEN, random = Math.random) => {
  const lower = answerEN.toLowerCase();
  if (RESERVED_WORDS.has(lower)) return code;
  const compact = lower.replace(' ', '');
  const spellings = [
    answerEN,
    lower,
    lower.charAt(0).toUpperCase() + lower.slice(1),
    answerEN.toUpperCase(),
    lower.replace(' ', '-'),
    lower.replace(' ', '_'),
    compact,
    compact.charAt(0).toUpperCase() + compact.slice(1),
  ];
  const replacement = randomWord(random);
  return spellings.reduce((result, spelling) => result.replace(new RegExp(escapeRegex(spelling), 'g'), replacement), code);
};

const PROMPT = (themeEN) => `Create HTML canvas code with '${themeEN}' as the theme, within the constraint of 5000 characters.
          Emphasize the need for the drawing to be as intricate and lifelike as possible.
          Do not include any image URLs, or JavaScript comments in the code.`;

const SYSTEM = 'As an HTML canvas expert and a code artist specializing in theme-based creations, with a keen emphasis on both the aesthetic intricacies and the security of the generated code, I strive to bring forth a unique fusion of technology and artistry.';

/**
 * Asks Gemini for canvas code. Returns the code, or null after two failed attempts.
 * gemini is { client, FunctionCallingConfigMode } from @google/genai.
 */
export const createGeminiDrawer = ({ getGemini, model }) => async (themeEN) => {
  const { client, FunctionCallingConfigMode } = await getGemini();
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      // eslint-disable-next-line no-await-in-loop
      const response = await client.models.generateContent({
        model,
        contents: [{ role: 'user', parts: [{ text: PROMPT(themeEN) }] }],
        config: {
          systemInstruction: SYSTEM,
          tools: [{
            functionDeclarations: [{
              name: 'canvasDraw',
              description: 'Generate a canvas image with a 16:9 aspect ratio using only the <script> and <canvas> tags in HTML. Do not include any JavaScript comments in the code.',
              parametersJsonSchema: {
                type: 'object',
                properties: {
                  code: { type: 'string', description: 'HTML code that must and only include the <script> and <canvas> tags.' },
                },
                required: ['code'],
              },
            }],
          }],
          toolConfig: {
            functionCallingConfig: { mode: FunctionCallingConfigMode.ANY, allowedFunctionNames: ['canvasDraw'] },
          },
        },
      });
      const call = response.functionCalls?.[0];
      if (call?.name === 'canvasDraw' && typeof call.args?.code === 'string' && call.args.code) return call.args.code;
    } catch (error) {
      console.error(`canvas attempt ${attempt + 1} failed:`, error.message);
    }
  }
  return null;
};

const result = (ok, status, error = null) => ({ ok, status, error });

/**
 * generate(io?) creates the next canvas. io, when given, hears 'server canvas' when it is done
 * or failed. Returns { ok, status, error }.
 */
export const createCanvasGenerator = ({ models, draw }) => {
  const { GuessAICanvas, Theme } = models;
  let running = false;

  const fail = (io, status, error) => {
    io?.emit('server canvas', { status: 'error', message: error });
    return result(false, status, error);
  };

  const generate = async (io) => {
    if (running) return result(false, 409, 'Canvas generation is already in progress');
    running = true;
    try {
      const latest = await GuessAICanvas.findOne().sort({ createdAt: -1 });
      if (latest && !latest.solved) return result(false, 409, 'Canvas generation is already in progress');

      const themeCount = await Theme.countDocuments();
      if (!themeCount) return fail(io, 500, 'No canvas theme available');
      const theme = await Theme.findOne().skip(Math.floor(Math.random() * themeCount));
      if (!theme) return fail(io, 500, 'Canvas theme not found');

      // On failure nothing is saved, so the next chat message starts another try
      const code = await draw(theme.themeEN);
      if (!code) return result(false, 502, 'Failed to generate canvas');

      try {
        await GuessAICanvas.create({
          canvas: hideAnswer(code, theme.themeEN),
          answerTW: theme.themeTW,
          answerEN: theme.themeEN,
          answerJP: theme.themeJP,
          solved: false,
        });
      } catch {
        return fail(io, 500, 'Failed to save generated canvas');
      }
      io?.emit('server canvas', { status: 'done' });
      return result(true, 200);
    } catch (error) {
      console.error('canvas generation failed:', error);
      return result(false, 500, 'Unexpected error');
    } finally {
      running = false;
    }
  };

  return { generate };
};
