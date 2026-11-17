// Pure helpers that keep a live admin page consistent when a full refetch and
// realtime socket patches race each other.
//
// The problem: a refetch starts, a socket patch (another admin's ballot, a
// check-in) lands and is applied, then the refetch resolves with a snapshot
// taken *before* the patch and wipes it. The fix: every patch bumps a
// monotonically increasing epoch and records which entity it touched. A
// refetch remembers the epoch it started at; when it resolves, entities patched
// after that point are merged by newest `updatedAt` instead of overwritten.

/** Marker meaning "the whole collection was replaced by a patch". */
export const ALL = "*";

const MAX_ENTRIES = 2000;

export function createPatchLog() {
  let epoch = 0;
  let entries = [];
  return {
    /** Current epoch; pass the result to since() when the refetch resolves. */
    begin() {
      return epoch;
    },
    /** Record that `id` in `scope` was patched locally (socket or own mutation). */
    mark(scope, id = ALL) {
      epoch += 1;
      entries.push({epoch, scope, id});
      if (entries.length > MAX_ENTRIES) entries = entries.slice(-MAX_ENTRIES / 2);
      return epoch;
    },
    /** Set of ids in `scope` patched after `token`, or null when none were. */
    since(token, scope) {
      let ids = null;
      for (let i = entries.length - 1; i >= 0 && entries[i].epoch > token; i -= 1) {
        if (entries[i].scope !== scope) continue;
        (ids ??= new Set()).add(entries[i].id);
      }
      return ids;
    },
    get epoch() {
      return epoch;
    },
  };
}

function timeOf(value) {
  if (!value) return NaN;
  const ms = typeof value === "number" ? value : Date.parse(value);
  return Number.isFinite(ms) ? ms : NaN;
}

/**
 * Pick the newer of a server copy and a locally patched copy of one entity.
 * The local copy was patched after the refetch started, so without comparable
 * timestamps it wins; with them, the newer `updatedAt` wins (ties go to the server).
 */
export function pickNewer(server, local) {
  if (!local) return server;
  if (!server) return local;
  const s = timeOf(server.updatedAt);
  const l = timeOf(local.updatedAt);
  if (Number.isFinite(s) && Number.isFinite(l)) return s >= l ? server : local;
  return local;
}

/**
 * Merge a refetched list with the current local list.
 * - `patched` null/empty: the refetch is authoritative.
 * - `patched` contains ALL: a patch replaced the whole list after the refetch
 *   started; keep local.
 * - otherwise, entities patched since the refetch started are resolved with
 *   pickNewer(); patched entities the server lacks are kept (created after the
 *   snapshot); patched entities missing locally are dropped (deleted after it).
 */
export function mergeEntities(serverList, localList, patched, key = "id") {
  const server = Array.isArray(serverList) ? serverList : [];
  if (!patched || patched.size === 0) return server;
  const local = Array.isArray(localList) ? localList : [];
  if (patched.has(ALL)) return local;

  const localById = new Map(local.map((item) => [item?.[key], item]));
  const seen = new Set();
  const merged = [];
  for (const item of server) {
    const id = item?.[key];
    seen.add(id);
    if (!patched.has(id)) {
      merged.push(item);
      continue;
    }
    const localItem = localById.get(id);
    // Patched away (deleted) after the snapshot was taken: stay deleted.
    if (!localItem) continue;
    merged.push(pickNewer(item, localItem));
  }
  for (const item of local) {
    const id = item?.[key];
    if (!seen.has(id) && patched.has(id)) merged.push(item);
  }
  return merged;
}

/**
 * Merge a refetched record (e.g. the round) with the local record, keeping the
 * fields that were patched after the refetch started unless the server copy is
 * at least as new.
 */
export function mergeRecord(server, local, patchedFields) {
  if (!server) return local ?? server;
  if (!local || !patchedFields || patchedFields.size === 0) return server;
  if (patchedFields.has(ALL)) return pickNewer(server, local);
  const s = timeOf(server.updatedAt);
  const l = timeOf(local.updatedAt);
  if (Number.isFinite(s) && Number.isFinite(l) && s >= l) return server;
  const next = {...server};
  for (const field of patchedFields) {
    if (field in local) next[field] = local[field];
  }
  return next;
}

/** Insert or update one entity in a list (by key), keeping list order. */
export function upsertEntity(list, entity, key = "id") {
  if (!entity) return list;
  const id = entity[key];
  let found = false;
  const next = list.map((item) => {
    if (item?.[key] !== id) return item;
    found = true;
    return {...item, ...entity};
  });
  return found ? next : [...next, entity];
}

/**
 * True when a socket payload echoes a change made by THIS tab. Compared by the
 * per-tab client id (X-Client-Id -> `actorClientId`), not the user id, so the
 * same admin's other tabs still apply it. Without an actorClientId (older
 * server, participant self check-in) nothing is suppressed.
 */
export function isOwnEcho(data, clientId) {
  return Boolean(clientId && data?.actorClientId && data.actorClientId === clientId);
}

/** Socket metadata keys that must never be merged into an entity. */
export const META_KEYS = ["roundId", "eventId", "actorId", "actorClientId"];

/** Copy of a socket payload without routing/actor metadata. */
export function withoutMeta(data) {
  const fields = {...(data || {})};
  for (const key of META_KEYS) delete fields[key];
  return fields;
}

/**
 * Apply a list payload (pairings:generated, rooms:allocated, an allocate
 * response). Only a payload marked `complete: true` is the full list and may
 * replace local state; anything else is upserted by id so debates it lacks
 * (e.g. preserved ONGOING/COMPLETED ones from an older server) survive.
 */
export function applyListPayload(list, items, {complete = false, key = "id"} = {}) {
  if (!Array.isArray(items)) return list;
  if (complete) return items;
  return items.reduce((acc, item) => upsertEntity(acc, item, key), Array.isArray(list) ? list : []);
}

/** Patch-log ids touched by applyListPayload (ALL for a full replace). */
export function listPayloadIds(items, {complete = false, key = "id"} = {}) {
  if (complete) return ALL;
  return (Array.isArray(items) ? items : []).map((item) => item?.[key]);
}

/**
 * Adopt the server's `current` debate from a 409 BALLOT_CONFLICT (a flat row:
 * ids, no relations). Relations whose id changed are re-resolved from `rooms`
 * or cleared so the UI never shows a stale room/judge object.
 */
export function adoptDebateCurrent(debate, current, {rooms = []} = {}) {
  if (!current) return debate;
  if (!debate) return current;
  const next = {...debate, ...current};
  if ("roomId" in current && current.roomId !== debate.roomId) {
    next.room = current.roomId ? rooms.find((r) => r.id === current.roomId) || null : null;
  }
  if ("adjudicatorId" in current && current.adjudicatorId !== debate.adjudicatorId) {
    next.adjudicator = null;
  }
  return next;
}

export const DEBATE_CONFLICT_MESSAGE = "Another admin changed this debate";

/**
 * Re-label a 409 BALLOT_CONFLICT from a debate edit (judge/room) with the
 * admin-facing message, keeping status/code/data so useAdminMutation still
 * routes it to onConflict. Other errors are returned unchanged.
 */
export function relabelDebateConflict(err) {
  if (err?.status !== 409 || err?.code !== "BALLOT_CONFLICT") return err;
  const relabeled = new Error(`${DEBATE_CONFLICT_MESSAGE}. Showing their latest version.`);
  relabeled.status = err.status;
  relabeled.code = err.code;
  relabeled.data = err.data;
  return relabeled;
}
