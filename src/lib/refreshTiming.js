// Pure timing helpers for live refreshes. Kept free of React and socket imports
// so they can be unit tested directly. Randomness is injected as `random` in [0, 1).

export const IMMEDIATE_REFRESH_MS = 150;
export const SOCKET_REFRESH_JITTER_MS = 2500;
export const RESYNC_JITTER_MS = 3000;
export const LEADERBOARD_MIN_INTERVAL_MS = 25000;
export const POLL_BACKOFF_CAP_MS = 60000;
export const POLL_JITTER_RATIO = 0.3;

const clamp01 = (value) => Math.min(Math.max(Number(value) || 0, 0), 0.999999);

/** Delay for a socket-driven refresh: spreads a herd of clients across a 2.5s window. */
export function socketRefreshDelay(random = Math.random()) {
  return IMMEDIATE_REFRESH_MS + clamp01(random) * SOCKET_REFRESH_JITTER_MS;
}

/**
 * Merges the delay of a newly queued refresh into the delay already pending.
 * The first queued delay wins, so a burst of socket events does not keep
 * re-drawing jitter. An immediate (user) refresh pulls the pending one earlier.
 */
export function queueRefreshDelay(current, delay) {
  if (current == null) return delay;
  return delay <= IMMEDIATE_REFRESH_MS ? Math.min(current, delay) : current;
}

/** Random delay before a reconnect/room/visibility resync. */
export function resyncDelay(random = Math.random(), jitterMs = RESYNC_JITTER_MS) {
  return clamp01(random) * Math.max(0, jitterMs);
}

/** Doubles the poll interval, never below `base` and capped at POLL_BACKOFF_CAP_MS. */
export function nextPollBackoff(current, base, cap = POLL_BACKOFF_CAP_MS) {
  return Math.max(base, Math.min(current * 2, cap));
}

/** Applies +/- POLL_JITTER_RATIO to a poll interval. */
export function pollDelay(backoffMs, random = Math.random()) {
  const spread = (clamp01(random) * 2 - 1) * POLL_JITTER_RATIO;
  return Math.round(backoffMs * (1 + spread));
}

/**
 * Delay for a throttled leaderboard refetch. Never earlier than the jittered
 * delay, and never sooner than `minIntervalMs` after the previous fetch.
 */
export function leaderboardRefreshDelay(now, lastAt, jitterDelay, minIntervalMs = LEADERBOARD_MIN_INTERVAL_MS) {
  return Math.max(jitterDelay, lastAt + minIntervalMs - now);
}
