// Pure helpers for the projector Display (/admin/display). Unit-tested in tests/displayBoard.test.mjs.

const clean = (value) => String(value ?? "").trim();

/** First and last name of a debater object ({firstName, lastName} or {name}). */
export function splitName(person) {
  if (!person) return {first: "", last: ""};
  const first = clean(person.firstName);
  const last = clean(person.lastName);
  if (first || last) return {first, last};
  const parts = clean(person.name || person.email).split(/\s+/).filter(Boolean);
  if (parts.length <= 1) return {first: "", last: parts[0] || ""};
  return {first: parts.slice(0, -1).join(" "), last: parts[parts.length - 1]};
}

/** "Surname, First" — the way a hall scans a printed draw. */
export function surnameFirst(person) {
  const {first, last} = splitName(person);
  if (last && first) return `${last}, ${first}`;
  return last || first || "TBD";
}

const collator = typeof Intl !== "undefined" ? new Intl.Collator(undefined, {sensitivity: "base", numeric: true}) : null;
const compare = (a, b) => (collator ? collator.compare(a, b) : a.localeCompare(b));

/** Sort people by surname, then first name (case/accent-insensitive). Returns a new array. */
export function sortBySurname(list, pick = (item) => item) {
  return [...(list || [])].sort((a, b) => {
    const pa = splitName(pick(a));
    const pb = splitName(pick(b));
    return compare(pa.last || pa.first, pb.last || pb.first) || compare(pa.first, pb.first);
  });
}

/**
 * One row per debater: debater1 is GOV, debater2 is OPP. A debate without a
 * second debater (swing slot / bye) still lists its debater, opponent "—".
 * Sorted by surname so debaters find themselves alphabetically.
 */
export function drawRows(debates) {
  const rows = [];
  for (const debate of debates || []) {
    if (!debate) continue;
    const room = clean(debate.room?.name || debate.roomName) || "Room TBA";
    const sides = [
      [debate.debater1, debate.debater2, "GOV"],
      [debate.debater2, debate.debater1, "OPP"],
    ];
    for (const [self, opponent, side] of sides) {
      if (!self) continue;
      rows.push({
        key: `${debate.id}:${side}`,
        debateId: debate.id,
        person: self,
        name: surnameFirst(self),
        room,
        side,
        opponent: opponent ? fullName(opponent) : "—",
      });
    }
  }
  return sortBySurname(rows, (row) => row.person);
}

export function fullName(person) {
  const {first, last} = splitName(person);
  return [first, last].filter(Boolean).join(" ") || "TBD";
}

/** Split `items` into pages of `perPage` (min 1). Always returns at least one (possibly empty) page. */
export function paginate(items, perPage) {
  const size = Math.max(1, Math.floor(Number(perPage) || 1));
  const list = items || [];
  if (list.length === 0) return [[]];
  const pages = [];
  for (let i = 0; i < list.length; i += size) pages.push(list.slice(i, i + size));
  return pages;
}

/** Rows that fit a viewport: (height − reserved) / rowHeight, clamped to [minRows, maxRows]. */
export function rowsThatFit(viewportHeight, rowHeight, reserved = 0, {minRows = 4, maxRows = 40} = {}) {
  const usable = Number(viewportHeight) - Number(reserved);
  const rows = Math.floor(usable / Math.max(1, Number(rowHeight) || 1));
  if (!Number.isFinite(rows)) return minRows;
  return Math.min(maxRows, Math.max(minRows, rows));
}

/** Wraps a page index into range (auto-pagination loops back to page 1). */
export function wrapPage(index, pageCount) {
  const count = Math.max(1, Number(pageCount) || 1);
  return ((Math.floor(Number(index) || 0) % count) + count) % count;
}

/** Whole seconds until `expiresAt` (ISO string or ms), never negative. Null when unknown. */
export function secondsUntil(expiresAt, nowMs = Date.now()) {
  if (expiresAt == null || expiresAt === "") return null;
  const t = typeof expiresAt === "number" ? expiresAt : new Date(expiresAt).getTime();
  if (!Number.isFinite(t)) return null;
  return Math.max(0, Math.ceil((t - nowMs) / 1000));
}

/**
 * The round a Display should show: an explicit ?round= id if it exists, else
 * the latest ONGOING round, else the latest with a published draw, else the latest.
 */
export function pickDisplayRound(rounds, requestedId) {
  const list = [...(rounds || [])].sort((a, b) => (Number(a.roundNumber) || 0) - (Number(b.roundNumber) || 0));
  if (requestedId) {
    const match = list.find((r) => String(r.id) === String(requestedId));
    if (match) return match;
  }
  const latest = (predicate) => [...list].reverse().find(predicate) || null;
  return (
    latest((r) => String(r.status).toUpperCase() === "ONGOING") ||
    latest((r) => r.pairingsPublished) ||
    list[list.length - 1] ||
    null
  );
}
