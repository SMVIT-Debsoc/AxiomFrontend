import test from "node:test";
import assert from "node:assert/strict";
import {getAnalyticsPath} from "../src/utils/analyticsPath.js";

test("analytics keeps static routes", () => {
    assert.equal(getAnalyticsPath("/login-select"), "/login-select");
    assert.equal(getAnalyticsPath("/dashboard/profile/"), "/dashboard/profile");
});

test("analytics replaces participant and admin record IDs with route labels", () => {
    assert.equal(getAnalyticsPath("/dashboard/events/event-123"), "/dashboard/events/[eventId]");
    assert.equal(getAnalyticsPath("/dashboard/events/event-123/rounds/round-456"), "/dashboard/events/[eventId]/rounds/[roundId]");
    assert.equal(getAnalyticsPath("/admin/results/result-789"), "/admin/results/[resultId]");
});

test("analytics collapses auth callback subpaths", () => {
    assert.equal(getAnalyticsPath("/sign-in/verify/email"), "/sign-in");
    assert.equal(getAnalyticsPath("/sign-up/callback"), "/sign-up");
});

test("analytics never reports unknown path segments", () => {
    assert.equal(getAnalyticsPath("/unexpected/private@example.com"), "/other");
});
