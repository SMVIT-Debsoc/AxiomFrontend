// Pure helpers for the admin Live stations (Director / Desk / Results).
// No React, no DOM: everything here is unit-tested in tests/liveStations.test.mjs.

export const STATIONS = ["director", "desk", "results"];
export const STATION_LABELS = {director: "Director", desk: "Desk", results: "Results"};
export const PANELS = ["draw", "rooms", "publish", "motion", "ballot-links", "advance"];

/** Minutes without a ballot after the draw goes out before a debate counts as "silent". */
export const SILENT_AFTER_MINUTES = 20;

export function parseStation(value) {
  const v = String(value || "").toLowerCase();
  return STATIONS.includes(v) ? v : null;
}

export function parsePanel(value) {
  const v = String(value || "").toLowerCase();
  return PANELS.includes(v) ? v : null;
}

/** Director on laptops (≥1024px), Desk on phones/tablets. */
export function defaultStation(viewportWidth) {
  return Number(viewportWidth) >= 1024 ? "director" : "desk";
}

export const fullName = (u) => `${u?.firstName || ""} ${u?.lastName || ""}`.trim() || u?.name || u?.email || "Unknown";

/** First name for compact tiles; falls back to the first token of fullName. */
export function firstName(u) {
  if (!u) return "TBD";
  const first = String(u.firstName || "").trim();
  if (first) return first;
  const full = fullName(u);
  const parts = full.split(/\s+/);
  return parts[0] || full;
}

/** Surname for compact tiles; falls back to the only name we have. */
export function surname(u) {
  if (!u) return "TBD";
  const last = String(u.lastName || "").trim();
  if (last) return last;
  const full = fullName(u);
  const parts = full.split(/\s+/);
  return parts[parts.length - 1] || full;
}

export const judgeOf = (d) => d?.judgeName || (d?.adjudicator ? fullName(d.adjudicator) : "");
export const roomNameOf = (d) => d?.room?.name || "";

// Same ballotFlags value -> same array identity, so memoized tiles (RoomTile) keep their props stable.
const NO_FLAGS = Object.freeze([]);
const flagsByRef = new WeakMap();
const flagsByText = new Map();
const FLAGS_TEXT_CACHE_MAX = 500;

function parseFlags(flags) {
  if (Array.isArray(flags)) return flags.filter(Boolean).map(String);
  if (typeof flags === "string") return flags.split(",").map((f) => f.trim()).filter(Boolean);
  if (typeof flags === "object") return Object.keys(flags).filter((k) => flags[k]);
  return [];
}

export function flagsOf(debate) {
  const flags = debate?.ballotFlags;
  if (!flags) return NO_FLAGS;
  if (typeof flags === "object") {
    let parsed = flagsByRef.get(flags);
    if (!parsed) {
      parsed = parseFlags(flags);
      flagsByRef.set(flags, parsed);
    }
    return parsed;
  }
  if (typeof flags === "string") {
    let parsed = flagsByText.get(flags);
    if (!parsed) {
      if (flagsByText.size >= FLAGS_TEXT_CACHE_MAX) flagsByText.clear();
      parsed = Object.freeze(parseFlags(flags));
      flagsByText.set(flags, parsed);
    }
    return parsed;
  }
  return NO_FLAGS;
}

export const FLAG_LABELS = {
  tie_manual_winner: "Tie broken by hand",
  score_out_of_range: "Score out of range",
  large_margin: "Large margin",
  resubmitted_changed: "Judge changed their ballot",
  admin_overrode_eballot: "Admin overrode e-ballot",
  judge_name_mismatch: "Different judge name",
};

export function flagLabel(flag) {
  if (FLAG_LABELS[flag]) return FLAG_LABELS[flag];
  const text = String(flag || "").replace(/[_-]+/g, " ").trim();
  return text ? text[0].toUpperCase() + text.slice(1) : "Flagged";
}

function timeOf(value) {
  if (!value) return NaN;
  const ms = typeof value === "number" ? value : Date.parse(value);
  return Number.isFinite(ms) ? ms : NaN;
}

/**
 * When the draw for this debate went out. Preference order:
 *   round.pairingsPublishedAt | round.drawPublishedAt (if the backend sends it)
 *   → debate.startTime (scheduled slot from room allocation)
 *   → round.updatedAt, only when the draw is published (best available proxy).
 * Returns NaN when the draw is not published or nothing usable exists.
 */
export function drawPublishedAt(round, debate) {
  if (!round?.pairingsPublished) return NaN;
  const explicit = timeOf(round.pairingsPublishedAt || round.drawPublishedAt);
  const start = timeOf(debate?.startTime);
  if (Number.isFinite(explicit) && Number.isFinite(start)) return Math.max(explicit, start);
  if (Number.isFinite(explicit)) return explicit;
  if (Number.isFinite(start)) return start;
  return timeOf(round.updatedAt);
}

export const hasResult = (d) => d?.status === "COMPLETED";

/** Silent = draw published, no ballot yet, and ≥ SILENT_AFTER_MINUTES since the draw (or slot start). */
export function isSilent(debate, round, nowMs, minutes = SILENT_AFTER_MINUTES) {
  if (hasResult(debate)) return false;
  const at = drawPublishedAt(round, debate);
  if (!Number.isFinite(at)) return false;
  return nowMs - at >= minutes * 60000;
}

/** Minutes a missing ballot has been outstanding (0 if unknown). */
export function ballotAgeMinutes(debate, round, nowMs) {
  const at = drawPublishedAt(round, debate);
  if (!Number.isFinite(at)) return 0;
  return Math.max(0, Math.floor((nowMs - at) / 60000));
}

/**
 * One state per tile (colour = state only):
 *   flag    → needs a human (ballot flags, or silent ≥20 min)
 *   done    → ballot in
 *   live    → draw published, debate running
 *   waiting → not published yet
 */
export function debateState(debate, round, nowMs = Date.now()) {
  if (flagsOf(debate).length > 0) return "flag";
  if (hasResult(debate)) return "done";
  if (isSilent(debate, round, nowMs)) return "flag";
  if (round?.pairingsPublished || debate?.status === "ONGOING") return "live";
  return "waiting";
}

export const STATE_LABELS = {waiting: "Waiting", live: "Live", done: "Ballot in", flag: "Needs a look"};
const STATE_ORDER = {flag: 0, live: 1, waiting: 2, done: 3};

export function roundCounters({debates = [], round, presentCount = 0, totalCount = 0, nowMs = Date.now()}) {
  let ballots = 0;
  let flagged = 0;
  let silent = 0;
  for (const d of debates) {
    if (hasResult(d)) ballots += 1;
    if (flagsOf(d).length) flagged += 1;
    if (isSilent(d, round, nowMs)) silent += 1;
  }
  return {checkedIn: presentCount, eligible: totalCount, ballots, debates: debates.length, flagged, silent};
}

/** Natural compare so "Room 2" sorts before "Room 10"; empty values sort last. */
export function naturalCompare(a, b) {
  if (!a && !b) return 0;
  if (!a) return 1;
  if (!b) return -1;
  return String(a).localeCompare(String(b), undefined, {numeric: true, sensitivity: "base"});
}

export function sortDebates(list, key = "room", nowMs = Date.now(), round = null) {
  const items = [...(list || [])];
  const byRoom = (a, b) => naturalCompare(roomNameOf(a), roomNameOf(b));
  if (key === "state") {
    return items.sort((a, b) => (STATE_ORDER[debateState(a, round, nowMs)] - STATE_ORDER[debateState(b, round, nowMs)]) || byRoom(a, b));
  }
  if (key === "flags") {
    return items.sort((a, b) => (flagsOf(b).length - flagsOf(a).length) || byRoom(a, b));
  }
  if (key === "updated") {
    return items.sort((a, b) => ((timeOf(b.updatedAt) || 0) - (timeOf(a.updatedAt) || 0)) || byRoom(a, b));
  }
  return items.sort(byRoom);
}

export function debateMatches(debate, query) {
  const q = String(query || "").trim().toLowerCase();
  if (!q) return true;
  return [fullName(debate.debater1), fullName(debate.debater2), roomNameOf(debate), judgeOf(debate)]
    .join(" ").toLowerCase().includes(q);
}

export function userMatches(user, query) {
  const q = String(query || "").trim().toLowerCase();
  if (!q) return true;
  return [fullName(user), user?.college, user?.mobile, user?.usn, user?.email].join(" ").toLowerCase().includes(q);
}

/** Missing ballots, oldest draw first (unknown age last), then by room. */
export function missingBallots(debates, round) {
  return (debates || [])
    .filter((d) => !hasResult(d))
    .sort((a, b) => {
      const ta = drawPublishedAt(round, a);
      const tb = drawPublishedAt(round, b);
      const fa = Number.isFinite(ta);
      const fb = Number.isFinite(tb);
      if (fa && fb && ta !== tb) return ta - tb;
      if (fa !== fb) return fa ? -1 : 1;
      return naturalCompare(roomNameOf(a), roomNameOf(b));
    });
}

export function flaggedBallots(debates) {
  return (debates || []).filter((d) => flagsOf(d).length > 0);
}

/** Find a debate by room text ("12", "Room 12", "hall b"): exact name, then trailing number, then prefix. */
export function findDebateByRoom(debates, text) {
  const q = String(text || "").trim().toLowerCase();
  if (!q) return null;
  const list = (debates || []).filter((d) => roomNameOf(d));
  const exact = list.find((d) => roomNameOf(d).toLowerCase() === q);
  if (exact) return exact;
  if (/^\d+$/.test(q)) {
    const num = Number(q);
    const byNumber = list.filter((d) => {
      const m = roomNameOf(d).match(/(\d+)\s*$/);
      return m && Number(m[1]) === num;
    });
    if (byNumber.length === 1) return byNumber[0];
  }
  const prefix = list.filter((d) => roomNameOf(d).toLowerCase().startsWith(q));
  return prefix.length === 1 ? prefix[0] : null;
}

/** Ballot links response → [{debateId, roomName, debater1Name, debater2Name, judgeName, path}]. */
export function normalizeBallotLinks(res, origin = "") {
  const raw = res?.links || res?.data?.links || res?.ballotLinks || (Array.isArray(res?.data) ? res.data : null) || (Array.isArray(res) ? res : []);
  return (raw || []).map((l) => {
    let path = l.path || "";
    if (!path && l.url) {
      path = origin && String(l.url).startsWith(origin) ? String(l.url).slice(origin.length) : l.url;
    }
    if (!path && (l.token || l.ballotToken)) path = `/ballot/${encodeURIComponent(l.token || l.ballotToken)}`;
    return {
      debateId: l.debateId || l.id,
      roomName: l.roomName || l.room?.name || "",
      debater1Name: l.debater1Name || (l.debater1 ? fullName(l.debater1) : ""),
      debater2Name: l.debater2Name || (l.debater2 ? fullName(l.debater2) : ""),
      judgeName: l.judgeName || "",
      status: l.status || null,
      submitted: Boolean(l.submitted),
      resultSource: l.resultSource || null,
      path,
    };
  }).filter((l) => l.debateId && l.path);
}

/** Absolute URL for a path ("/ballot/x") or pass through a full URL. */
export function absoluteUrl(origin, path) {
  if (!path) return "";
  if (/^https?:\/\//i.test(path)) return path;
  return `${origin || ""}${path.startsWith("/") ? "" : "/"}${path}`;
}

/** Palette registration payload. */
export function commandContext(roundId, debates, people) {
  return {
    roundId,
    debates: (debates || []).map((d) => ({
      id: d.id,
      roomName: roomNameOf(d),
      debater1Name: fullName(d.debater1),
      debater2Name: fullName(d.debater2),
    })),
    people: (people || []).map((u) => ({userId: u.id, name: fullName(u)})),
  };
}

/** "Do this next" step index: 0 Check-in, 1 Draw, 2 Rooms, 3 Publish, 4 Ballots, 5 Advance. */
export function pipelineStep({debates = [], round}) {
  const hasDebates = debates.length > 0;
  const withRoom = debates.filter((d) => d.roomId && d.room).length;
  if (!hasDebates) return 0;
  if (withRoom === 0) return 1;
  if (withRoom < debates.length) return 2;
  if (!round?.pairingsPublished) return 3;
  if (debates.some((d) => !hasResult(d))) return 4;
  return 5;
}
