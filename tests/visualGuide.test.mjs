import {test} from "node:test";
import assert from "node:assert/strict";
import {GUIDE_STEPS, getStepCopy, readTourProgress, writeTourProgress} from "../src/lib/visualGuide.js";

test("the tour introduces joining, check-in, matchup and results in tournament order", () => {
  assert.deepEqual(GUIDE_STEPS.map(({id}) => id), [
    "overview", "events", "enrollment", "check-in", "matchup", "rounds", "results", "profile",
  ]);
  assert.ok(GUIDE_STEPS.every(({title, text}) => title && text));
});

test("check-in instructions reflect live status and missing rounds", () => {
  const step = GUIDE_STEPS.find(({id}) => id === "check-in");
  assert.match(getStepCopy(step, "open", true), /Tap Check In Now/);
  assert.match(getStepCopy(step, "upcoming", true), /opening time/);
  assert.match(getStepCopy(step, "closed", true), /closing time has passed/);
  assert.match(getStepCopy(step, "present", true), /Presence Verified/);
  assert.match(getStepCopy(step, "unavailable", true), /Tap Retry/);
  assert.match(getStepCopy(step, undefined, false), /When a round is available/);
});

test("tour progress is isolated by account and tolerates storage failures", () => {
  const values = new Map();
  const storage = {getItem: values.get.bind(values), setItem: values.set.bind(values)};
  writeTourProgress("one", "check-in", storage);
  assert.equal(readTourProgress("one", storage), "check-in");
  assert.equal(readTourProgress("two", storage), null);
  writeTourProgress("one", "finished", storage);
  assert.equal(readTourProgress("one", storage), "finished");
  writeTourProgress("two", "invalid-step", storage);
  assert.equal(readTourProgress("two", storage), null);
  const restricted = {getItem() { throw Error("SecurityError"); }, setItem() { throw Error("QuotaExceededError"); }};
  assert.equal(readTourProgress("one", restricted), null);
  assert.doesNotThrow(() => writeTourProgress("one", "dismissed", restricted));
});
