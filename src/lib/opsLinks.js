// URL and short-code helpers for e-ballots, venue check-in and personal passes.
// Pure: unit-tested in tests/opsLinks.test.mjs.

const trimSlash = (origin) => String(origin || "").replace(/\/+$/, "");

/** Public judge e-ballot link: <origin>/ballot/<token>. */
export function ballotUrl(origin, token) {
  if (!token) return "";
  return `${trimSlash(origin)}/ballot/${encodeURIComponent(token)}`;
}

/** Venue check-in link encoded in the Display / Desk QR: <origin>/checkin/<roundId>?c=<code>. */
export function venueCheckInUrl(origin, roundId, code) {
  if (!roundId || !code) return "";
  return `${trimSlash(origin)}/checkin/${encodeURIComponent(roundId)}?c=${encodeURIComponent(String(code).trim())}`;
}

/** Big, readable short code: upper-case, groups of 3–4 separated by a thin space. */
export function formatShortCode(code) {
  const raw = String(code ?? "").replace(/[\s-]+/g, "").toUpperCase();
  if (raw.length <= 4) return raw;
  const size = raw.length % 4 === 0 || raw.length > 9 ? 4 : 3;
  const groups = [];
  for (let i = 0; i < raw.length; i += size) groups.push(raw.slice(i, i + size));
  return groups.join(" ");
}

/** The QR payload for a personal pass: the opaque pass string itself (Desk scanner reads it verbatim). */
export function passQrValue(pass) {
  return String(pass ?? "").trim();
}

// ---- Return-to-after-sign-in for venue check-in links --------------------

export const RETURN_TO_KEY = "axiom.returnTo";
export const RETURN_TO_TTL_MS = 60 * 60 * 1000;

/** Only same-origin /checkin/<id> paths (with optional query) may be resumed. */
export function isResumablePath(path) {
  return typeof path === "string" && /^\/checkin\/[A-Za-z0-9_-]+(\?[^#\s]*)?$/.test(path);
}

export function encodeReturnTo(path, nowMs = Date.now()) {
  return isResumablePath(path) ? JSON.stringify({path, at: nowMs}) : null;
}

/** Parse a stored return-to record; null when missing, malformed, unsafe or expired. */
export function decodeReturnTo(raw, nowMs = Date.now()) {
  if (!raw) return null;
  try {
    const value = JSON.parse(raw);
    if (!value || !isResumablePath(value.path)) return null;
    if (!Number.isFinite(value.at) || nowMs - value.at > RETURN_TO_TTL_MS || value.at > nowMs + 60000) return null;
    return value.path;
  } catch {
    return null;
  }
}
