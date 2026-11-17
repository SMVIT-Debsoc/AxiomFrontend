// Advance (best-loser promotion) maths. Tested in tests/promotionCut.test.mjs.
import {fullName} from "./liveStations.js";

export const TARGET_OPTIONS = ["auto", 8, 16, 32, 64, 128, "custom"];

/** Smallest power of two ≥ winners (0 → 0). */
export function autoTarget(winners) {
  const n = Math.max(0, Math.floor(Number(winners) || 0));
  if (n <= 1) return n;
  return 2 ** Math.ceil(Math.log2(n));
}

/** Resolve the selected target ("auto" | number | custom value) to a number. */
export function resolveTarget(choice, winners, custom) {
  if (choice === "auto" || choice == null || choice === "") return autoTarget(winners);
  if (choice === "custom") {
    const c = Math.floor(Number(custom));
    return Number.isFinite(c) && c > 0 ? c : autoTarget(winners);
  }
  const n = Math.floor(Number(choice));
  return Number.isFinite(n) && n > 0 ? n : autoTarget(winners);
}

/** Losers to save so winners + saved = target, clamped to the candidates we have. */
export function slotsToFill(target, winners, candidateCount) {
  const want = Math.max(0, Math.floor(Number(target) || 0) - Math.max(0, Math.floor(Number(winners) || 0)));
  return Math.min(want, Math.max(0, Math.floor(Number(candidateCount) || 0)));
}

export function clampCut(cut, candidateCount) {
  const n = Math.floor(Number(cut) || 0);
  return Math.min(Math.max(0, n), Math.max(0, candidateCount));
}

/**
 * Normalize OpsApi.getPromotionProposal. Tolerant of shapes:
 *   {proposal: {...}} | {data: {...}} | {...}
 * with candidates in `ranked` | `candidates` | `losers`, and
 * winners in `winnersCount` | `winners` (array or number).
 */
export function normalizeProposal(res) {
  const p = res?.proposal || res?.data || res || {};
  const raw = p.ranked || p.candidates || p.losers || p.bestLosers || [];
  const candidates = raw.map((c, i) => {
    const user = c.user || c;
    return {
      userId: c.userId || user.id,
      name: c.name || fullName(user),
      college: c.college || user.college || "",
      score: c.score ?? c.totalScore ?? null,
      margin: c.margin ?? null,
      rank: c.rank ?? i + 1,
      isPromoted: Boolean(c.isPromoted ?? c.promoted),
      roomName: c.roomName || "",
      debateId: c.debateId || null,
      opponentScore: c.opponentScore ?? null,
      cumulativeWins: c.cumulativeWins ?? null,
      cumulativeScore: c.cumulativeScore ?? null,
      cumulativeMargin: c.cumulativeMargin ?? null,
    };
  }).filter((c) => c.userId);
  const winnerRows = Array.isArray(p.winners)
    ? p.winners.map((w) => {
        const user = w.user || w;
        return {
          userId: w.userId || user.id,
          name: w.name || fullName(user),
          college: w.college || user.college || "",
          score: w.score ?? w.totalScore ?? null,
          margin: w.margin ?? null,
          isPromoted: Boolean(w.isPromoted ?? w.promoted),
          roomName: w.roomName || "",
          debateId: w.debateId || null,
          opponentScore: w.opponentScore ?? null,
          cumulativeWins: w.cumulativeWins ?? null,
          cumulativeScore: w.cumulativeScore ?? null,
        };
      }).filter((w) => w.userId)
    : [];
  const otherPromoted = Array.isArray(p.otherPromoted)
    ? p.otherPromoted.map((o) => ({
        userId: o.userId || o.id,
        name: o.name || fullName(o),
        college: o.college || "",
      })).filter((o) => o.userId)
    : [];
  const winners = Array.isArray(p.winners) ? p.winners.length : Number(p.winnersCount ?? p.winners ?? 0) || 0;
  const targetSize = Number(p.targetSize ?? p.target ?? 0) || null;
  // Backend: cutIndex (= needed) is the number of candidates above the line; clamped below.
  const suggested = p.cutIndex ?? p.needed ?? p.suggestedCount ?? p.cut ?? p.promoteCount ?? p.slots;
  return {
    candidates,
    winnerRows,
    otherPromoted,
    winners,
    targetSize,
    autoTargetSize: Number(p.autoTargetSize ?? 0) || null,
    needed: Number.isFinite(Number(p.needed)) ? Number(p.needed) : null,
    pendingResults: Number(p.pendingResults ?? 0) || 0,
    targetMode: p.targetMode || (p.autoTarget || p.advanceTarget === null ? "auto" : p.advanceTarget != null ? "fixed" : null),
    suggestedCut: Number.isFinite(Number(suggested)) ? clampCut(suggested, candidates.length) : null,
    promotedIds: Array.isArray(p.promotedIds) ? p.promotedIds : candidates.filter((c) => c.isPromoted).map((c) => c.userId),
    hasExplicitPromotions: Boolean(p.hasExplicitPromotions),
  };
}

/** Delta for "Advance N above the line": add above, remove below (only ones currently advanced). */
export function promotionDelta(candidates, cut, promotedIds) {
  const promoted = new Set(promotedIds || []);
  const above = (candidates || []).slice(0, cut).map((c) => c.userId);
  const below = (candidates || []).slice(cut).map((c) => c.userId);
  return {
    add: above.filter((id) => !promoted.has(id)),
    remove: below.filter((id) => promoted.has(id)),
  };
}
