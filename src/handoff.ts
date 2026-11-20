/*
 * Moving the guest pass from api.6yuwei.com (server docs/server.md §5). A player without a pass
 * on this site is sent once to the old API domain, which sends them back with their old pass
 * moved here, or with ?handoff=none. Each browser goes at most once: the flag is written before
 * leaving, and a browser that cannot keep it never leaves. Removed on day 90 with the server part.
 */

const HANDOFF_URL = (import.meta.env.VITE_HANDOFF_URL || "").trim();
export const HANDOFF_DONE_KEY = "guessai_handoff_done";

function rememberHandoff(): boolean {
  try {
    if (localStorage.getItem(HANDOFF_DONE_KEY)) return false;
    localStorage.setItem(HANDOFF_DONE_KEY, new Date().toISOString());
    return localStorage.getItem(HANDOFF_DONE_KEY) !== null;
  } catch {
    return false;
  }
}

/**
 * Removes ?handoff=none from the address bar. Returns true when the page came back from a
 * handoff that found no pass, so the sign-up dialog should show.
 */
export function takeHandoffResult(): boolean {
  const url = new URL(window.location.href);
  if (url.searchParams.get("handoff") !== "none") return false;
  rememberHandoff();
  url.searchParams.delete("handoff");
  window.history.replaceState(window.history.state, "", `${url.pathname}${url.search}${url.hash}`);
  return true;
}

/** Sends a player without a pass to the old API domain once. Returns true when the page is leaving. */
export function startHandoffOnce(): boolean {
  if (!HANDOFF_URL || !rememberHandoff()) return false;
  const target = new URL(HANDOFF_URL);
  const { pathname, search, hash } = window.location;
  target.searchParams.set("return", `${pathname}${search}${hash}`);
  window.location.assign(target.toString());
  return true;
}
