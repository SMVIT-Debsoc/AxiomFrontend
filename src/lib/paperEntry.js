// Keyboard paper-ballot entry: pure parsing / validation. Tested in tests/paperEntry.test.mjs.
import {findDebateByRoom, hasResult, missingBallots} from "./liveStations.js";

export function parseScore(value) {
  const text = String(value ?? "").trim().replace(",", ".");
  if (!text) return NaN;
  if (!/^-?\d+(\.\d+)?$/.test(text)) return NaN;
  return Number(text);
}

/** "1" / "g" → GOV, "2" / "o" → OPP, else null. */
export function parseWinnerKey(key) {
  const k = String(key || "").trim().toLowerCase();
  if (k === "1" || k === "g" || k === "gov") return 1;
  if (k === "2" || k === "o" || k === "opp") return 2;
  return null;
}

/**
 * Validate one row of the entry bar.
 * Returns {ok:true, debate, debater1Score, debater2Score, winnerId}
 *      or {ok:false, error, field, needsWinner?, debate?}
 */
export function resolvePaperEntry({debates, roomText, gov, opp, winnerChoice = null}) {
  const debate = findDebateByRoom(debates, roomText);
  if (!String(roomText || "").trim()) return {ok: false, field: "room", error: "Type a room"};
  if (!debate) return {ok: false, field: "room", error: `No single debate matches "${String(roomText).trim()}"`};
  const s1 = parseScore(gov);
  if (!Number.isFinite(s1)) return {ok: false, field: "gov", error: "GOV score must be a number", debate};
  const s2 = parseScore(opp);
  if (!Number.isFinite(s2)) return {ok: false, field: "opp", error: "OPP score must be a number", debate};
  let winnerId;
  if (s1 > s2) winnerId = debate.debater1Id;
  else if (s2 > s1) winnerId = debate.debater2Id;
  else if (winnerChoice === 1) winnerId = debate.debater1Id;
  else if (winnerChoice === 2) winnerId = debate.debater2Id;
  else return {ok: false, field: "winner", needsWinner: true, error: "Tie: press W then 1 (GOV) or 2 (OPP)", debate};
  return {ok: true, debate, debater1Score: s1, debater2Score: s2, winnerId};
}

/** Next missing room after `afterDebateId` in queue order (wraps), or null. */
export function nextMissingDebate(debates, round, afterDebateId) {
  const queue = missingBallots(debates, round).filter((d) => d.id !== afterDebateId && !hasResult(d));
  return queue[0] || null;
}

/** Keep the last `limit` entries, newest first, replacing an earlier entry for the same debate. */
export function pushRecent(list, entry, limit = 5) {
  return [entry, ...(list || []).filter((e) => e.debateId !== entry.debateId)].slice(0, limit);
}
