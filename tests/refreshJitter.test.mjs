import {test} from 'node:test';
import assert from 'node:assert/strict';
import {
  socketRefreshDelay,
  queueRefreshDelay,
  resyncDelay,
  nextPollBackoff,
  pollDelay,
  leaderboardRefreshDelay,
} from '../src/lib/refreshTiming.js';

test('socket refresh delay is 150ms + random * 2500ms', () => {
  assert.equal(socketRefreshDelay(0), 150);
  assert.equal(socketRefreshDelay(0.5), 1400);
  const max = socketRefreshDelay(0.9999999);
  assert.ok(max >= 150 && max < 2650, `delay ${max} out of range`);
});

test('queued refresh delays merge: first socket draw wins, immediate refresh pulls earlier', () => {
  assert.equal(queueRefreshDelay(null, 1800), 1800);
  assert.equal(queueRefreshDelay(1800, 2400), 1800);
  assert.equal(queueRefreshDelay(1800, 150), 150);
  assert.equal(queueRefreshDelay(150, 2000), 150);
});

test('resync delay is random within jitterMs and defaults to 3000ms', () => {
  assert.equal(resyncDelay(0, 3000), 0);
  assert.equal(resyncDelay(0.5, 3000), 1500);
  assert.equal(resyncDelay(0.5), 1500);
  assert.equal(resyncDelay(0.5, 0), 0);
  const big = resyncDelay(0.9999999);
  assert.ok(big >= 0 && big < 3000);
});

test('poll backoff doubles from the base interval and caps at 60000ms', () => {
  let backoff = 12000;
  const seen = [backoff];
  for (let i = 0; i < 5; i += 1) {
    backoff = nextPollBackoff(backoff, 12000);
    seen.push(backoff);
  }
  assert.deepEqual(seen, [12000, 24000, 48000, 60000, 60000, 60000]);
  assert.equal(nextPollBackoff(40000, 12000, 60000), 60000);
});

test('poll backoff never drops below the base interval', () => {
  assert.equal(nextPollBackoff(5000, 12000), 12000);
});

test('poll delay applies +/-30% jitter around the backoff', () => {
  assert.equal(pollDelay(10000, 0.5), 10000);
  assert.equal(pollDelay(10000, 0), 7000);
  const high = pollDelay(10000, 0.9999999);
  assert.ok(high >= 12900 && high <= 13000, `delay ${high} out of range`);
});

test('leaderboard refresh waits out the 25s minimum interval but never less than its jitter', () => {
  // No prior fetch: only the jitter applies.
  assert.equal(leaderboardRefreshDelay(100000, 0, 1500), 1500);
  // Fetched 10s ago: the 15s remainder exceeds the jitter.
  assert.equal(leaderboardRefreshDelay(100000, 90000, 1500), 15000);
  // Fetched 24s ago: remaining 1s is below the jitter, so the jitter wins.
  assert.equal(leaderboardRefreshDelay(100000, 76000, 2000), 2000);
  // Fetched long ago: jitter only.
  assert.equal(leaderboardRefreshDelay(100000, 1000, 800), 800);
});
