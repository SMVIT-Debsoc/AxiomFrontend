import { test } from "node:test";
import assert from "node:assert/strict";
import {
  GUIDE_STEPS,
  VISUAL_GUIDE_STORAGE_KEY,
  isGuideDismissed,
  markGuideDismissed,
  resetGuideDismissed,
} from "../src/lib/visualGuide.js";

function createMemoryStorage() {
  const store = new Map();
  return {
    getItem: (key) => (store.has(key) ? store.get(key) : null),
    setItem: (key, val) => store.set(key, String(val)),
    removeItem: (key) => store.delete(key),
  };
}

test("GUIDE_STEPS provides 4 complete steps with catchphrases and clear navigation cues", () => {
  assert.equal(GUIDE_STEPS.length, 4);
  for (let i = 0; i < GUIDE_STEPS.length; i++) {
    const step = GUIDE_STEPS[i];
    assert.equal(step.numeral, `0${i + 1}`);
    assert.ok(step.id && step.title && step.catchphrase && step.instruction && step.destination);
  }
  assert.equal(GUIDE_STEPS[0].catchphrase, "No check-in, no mic.");
  assert.match(GUIDE_STEPS[3].instruction, /QUALIFIED/);
});

test("dismissal storage helpers persist and reset safely", () => {
  const mem = createMemoryStorage();
  assert.equal(isGuideDismissed(mem), false);

  markGuideDismissed(mem);
  assert.equal(mem.getItem(VISUAL_GUIDE_STORAGE_KEY), "true");
  assert.equal(isGuideDismissed(mem), true);

  resetGuideDismissed(mem);
  assert.equal(isGuideDismissed(mem), false);
});

test("dismissal helpers handle throwing or null storage gracefully", () => {
  const brokenStorage = {
    getItem() {
      throw new Error("SecurityError");
    },
    setItem() {
      throw new Error("QuotaExceededError");
    },
    removeItem() {
      throw new Error("SecurityError");
    },
  };

  assert.equal(isGuideDismissed(null), false);
  assert.equal(isGuideDismissed(brokenStorage), false);
  assert.doesNotThrow(() => markGuideDismissed(brokenStorage));
  assert.doesNotThrow(() => resetGuideDismissed(brokenStorage));
});
