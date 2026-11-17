// Per-round "advance target": how many debaters go through to the next round.
// null on the server = auto (smallest power of two ≥ winners). Pure; tested in tests/opsHelpers.test.mjs.

export const ADVANCE_PRESETS = [8, 16, 32, 64, 128];

/** Server value → form string ("" = auto). */
export function advanceTargetToForm(value) {
  const n = Number(value);
  return value == null || value === "" || !Number.isFinite(n) || n <= 0 ? "" : String(Math.round(n));
}

/** Form string → server value (null = auto). */
export function advanceTargetToPayload(value) {
  const text = String(value ?? "").trim();
  if (!text) return null;
  const n = Number(text);
  return Number.isInteger(n) && n > 0 ? n : null;
}

/** Error message for an invalid custom target, or null. */
export function advanceTargetError(value) {
  const text = String(value ?? "").trim();
  if (!text) return null;
  const n = Number(text);
  if (!Number.isInteger(n) || n < 2) return "Advance target must be a whole number of at least 2 (or Auto).";
  if (n > 4096) return "Advance target is too large.";
  return null;
}

/** "auto" | "8" … "128" | "custom" — which choice a form value shows as. */
export function advanceTargetChoice(value) {
  const text = String(value ?? "").trim();
  if (!text) return "auto";
  return ADVANCE_PRESETS.map(String).includes(text) ? text : "custom";
}

/** Short label for lists: "Auto" or "Top 16". */
export function advanceTargetLabel(value) {
  const n = advanceTargetToPayload(value);
  return n == null ? "Auto" : `Top ${n}`;
}
