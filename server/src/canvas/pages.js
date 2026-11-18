/*
 * The canvas pages. A canvas is HTML and script written by AI, so these pages are sandboxed:
 * without allow-same-origin they run as an opaque origin and cannot read the guest pass.
 */

export const CANVAS_CSP = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  "frame-ancestors 'self'",
  'sandbox allow-scripts',
].join('; ');

const BASE_STYLE = `
    body, html { margin: 0; padding: 0; width: 100%; height: 100%; overflow: hidden; }
    canvas { display: block; margin: 0 auto; width: 100%; height: 100%; object-fit: contain; }`;

const document = (style, body) => `<!DOCTYPE html>
<html lang="zh-tw">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>guessAI Canvas</title>
</head>
<style>${style}
</style>
<body>
${body}
</body>
</html>`;

/** Shown while no canvas is active: an invisible page. */
export const emptyCanvasPage = () => document('\n    body, html { opacity: 0; }', '');

export const currentCanvasPage = (code) => document(`${BASE_STYLE}\n    body, html { background-color: #eae0d5; }`, code);

export const galleryCanvasPage = (code) => document(`${BASE_STYLE}\n    body, html { background-color: #EAE0D5 !important; }`, code);
