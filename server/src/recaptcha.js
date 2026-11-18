/**
 * reCAPTCHA v3 check for new players. Returns { ok: true } or { ok: false, status }.
 */
export const createRecaptcha = ({ secret, fetchImpl = globalThis.fetch, minScore = 0.5 }) => async (token) => {
  if (!secret) return { ok: false, status: 500 };
  const form = new FormData();
  form.append('secret', secret);
  form.append('response', String(token ?? ''));
  try {
    const response = await fetchImpl('https://www.google.com/recaptcha/api/siteverify', { method: 'POST', body: form });
    if (!response.ok) return { ok: false, status: 500 };
    const { success, score } = await response.json();
    return success && score >= minScore ? { ok: true } : { ok: false, status: 403 };
  } catch {
    return { ok: false, status: 500 };
  }
};
