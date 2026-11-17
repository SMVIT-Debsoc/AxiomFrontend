// Compact relative times for feeds: "now", "45s", "2m", "3h", "2d". Pure.

export function relativeTime(value, nowMs = Date.now()) {
  const t = typeof value === "number" ? value : new Date(value).getTime();
  if (!Number.isFinite(t)) return "";
  const seconds = Math.max(0, Math.round((nowMs - t) / 1000));
  if (seconds < 10) return "now";
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  return `${Math.floor(hours / 24)}d`;
}

/** Up to two initials from a display name ("Riya Kapoor" → "RK"). */
export function initialsOf(name) {
  const parts = String(name || "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  return parts.slice(0, 2).map((p) => p[0]).join("").toUpperCase();
}

/** Merge feed items, newest first, deduped by id. */
export function mergeFeed(existing, incoming) {
  const seen = new Set();
  const out = [];
  for (const item of [...(incoming || []), ...(existing || [])]) {
    if (!item || item.id == null || seen.has(String(item.id))) continue;
    seen.add(String(item.id));
    out.push(item);
  }
  return out.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}
