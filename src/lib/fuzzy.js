// Small fuzzy matcher for the ⌘K command palette. Pure: unit-tested in tests/fuzzy.test.mjs.

const WORD_BREAK = /[\s\-_/·,.(]/;

const normalize = (value) =>
  String(value ?? "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "");

/**
 * Score how well `query` matches `text`. Higher is better; -1 means no match.
 * A contiguous substring always beats a scattered match; within each kind,
 * prefixes and word starts ("rm 12" → "Room 12") rank higher, and shorter
 * texts rank above longer ones.
 */
export function fuzzyScore(query, text) {
  const q = normalize(query).replace(/\s+/g, " ").trim();
  const t = normalize(text);
  if (!q) return 0;
  if (!t) return -1;

  const at = t.indexOf(q);
  if (at !== -1) {
    const wordStart = at === 0 || WORD_BREAK.test(t[at - 1]);
    return 1000 + (at === 0 ? 300 : wordStart ? 150 : 0) - Math.min(t.length, 200);
  }

  const chars = q.replace(/ /g, "");
  let score = 0;
  let from = 0;
  let previous = -2;
  for (const ch of chars) {
    const found = t.indexOf(ch, from);
    if (found === -1) return -1;
    score += 10;
    if (found === 0 || WORD_BREAK.test(t[found - 1])) score += 15;
    if (found === previous + 1) score += 8;
    previous = found;
    from = found + 1;
  }
  return score - Math.min(t.length, 200) / 10;
}

/**
 * Filter and rank `items` by `query`. `keys(item)` returns the strings to
 * match (the best one wins). Ties keep the original order.
 */
export function fuzzyFilter(items, query, keys = (item) => [item?.label], limit = 50) {
  const list = Array.isArray(items) ? items : [];
  if (!String(query ?? "").trim()) return list.slice(0, limit);
  const scored = [];
  list.forEach((item, index) => {
    let best = -1;
    for (const text of keys(item) || []) {
      const s = fuzzyScore(query, text);
      if (s > best) best = s;
    }
    if (best >= 0) scored.push({item, score: best, index});
  });
  scored.sort((a, b) => b.score - a.score || a.index - b.index);
  return scored.slice(0, limit).map((entry) => entry.item);
}
