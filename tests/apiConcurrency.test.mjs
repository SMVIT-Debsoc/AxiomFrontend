import {test, beforeEach, afterEach} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const apiSource = (await readFile(new URL('../src/services/api.js', import.meta.url), 'utf8'))
  .replaceAll('import.meta.env', '({VITE_API_URL: "https://fixture.invalid/api/"})')
  .replace('const isBrowser = typeof window !== "undefined";', 'const isBrowser = true;')
  .replace(/const isLocalhost =\s*isBrowser && \["localhost", "127\.0\.0\.1"\]\.includes\(window\.location\.hostname\);/, 'const isLocalhost = false;')
  .replaceAll('sessionStorage.getItem("isAdminSession")', 'null')
  .replaceAll('sessionStorage.getItem("adminSecretKey")', 'null');
const api = await import(`data:text/javascript;base64,${Buffer.from(apiSource).toString('base64')}`);

const originalFetch = globalThis.fetch;
const originalError = console.error;
let calls;
let handler;
const json = (value, status = 200) => new Response(JSON.stringify(value), {
  status, headers: {'Content-Type': 'application/json'},
});
const deferred = () => {
  let resolve;
  const promise = new Promise((r) => { resolve = r; });
  return {promise, resolve};
};

beforeEach(() => {
  calls = [];
  api.clearApiCache();
  console.error = () => {};
  globalThis.fetch = async (url, options = {}) => {
    calls.push({url, method: options.method, auth: options.headers?.Authorization, signal: options.signal});
    return handler(url, options);
  };
});
afterEach(() => {
  globalThis.fetch = originalFetch;
  console.error = originalError;
});

test('409 failures carry status, code and the server payload', async () => {
  const current = {id: 'd1', winnerId: 'u2', debater1Score: 70, debater2Score: 75, updatedAt: '2026-11-17T10:00:00Z'};
  handler = () => json({success: false, code: 'BALLOT_CONFLICT', message: 'Another admin saved first', current}, 409);
  const err = await api.AdminApi.submitResult('d1', {winnerId: 'u1', expectedUpdatedAt: 'x'}, 't').catch((e) => e);
  assert.equal(err.message, 'Another admin saved first');
  assert.equal(err.status, 409);
  assert.equal(err.code, 'BALLOT_CONFLICT');
  assert.deepEqual(err.data.current, current);
});

test('HTTP 200 with success:false also carries code and data', async () => {
  handler = () => json({success: false, code: 'DEBATE_LOCKED', error: 'Debate already started'});
  const err = await api.apiRequest('/check-in/round/r1/user/u1', 'PUT', {status: 'ABSENT'}, 't').catch((e) => e);
  assert.equal(err.message, 'Debate already started');
  assert.equal(err.status, 200);
  assert.equal(err.code, 'DEBATE_LOCKED');
  assert.equal(err.data.code, 'DEBATE_LOCKED');
});

test('identical concurrent GETs with the same auth share one request', async () => {
  const gate = deferred();
  handler = async () => { await gate.promise; return json({success: true, round: {id: 'r1'}}); };
  const a = api.apiRequest('/rounds/r1', 'GET', null, 'tok', {skipCache: true});
  const b = api.apiRequest('/rounds/r1', 'GET', null, 'tok', {skipCache: true});
  await Promise.resolve();
  gate.resolve();
  const [ra, rb] = await Promise.all([a, b]);
  assert.equal(calls.length, 1);
  assert.equal(ra.round.id, 'r1');
  assert.equal(rb.round.id, 'r1');
  assert.notEqual(ra, rb, 'each caller gets its own copy');
});

test('GET dedup is keyed by auth and endpoint, and ends when the request settles', async () => {
  handler = async () => json({success: true});
  await Promise.all([
    api.apiRequest('/rounds/r1', 'GET', null, 'tok-a', {skipCache: true}),
    api.apiRequest('/rounds/r1', 'GET', null, 'tok-b', {skipCache: true}),
    api.apiRequest('/rounds/r2', 'GET', null, 'tok-a', {skipCache: true}),
  ]);
  assert.equal(calls.length, 3);
  await api.apiRequest('/rounds/r1', 'GET', null, 'tok-a', {skipCache: true});
  assert.equal(calls.length, 4, 'a settled request is not reused');
});

test('mutations are never deduplicated', async () => {
  handler = async () => json({success: true});
  await Promise.all([
    api.apiRequest('/debates/d1', 'PUT', {judgeName: 'A'}, 't'),
    api.apiRequest('/debates/d1', 'PUT', {judgeName: 'A'}, 't'),
  ]);
  assert.equal(calls.length, 2);
});

test('a GET started after cache invalidation does not join the stale in-flight GET', async () => {
  const gate = deferred();
  handler = async () => { await gate.promise; return json({success: true, n: calls.length}); };
  const stale = api.apiRequest('/rounds/r1', 'GET', null, 'tok', {skipCache: true});
  api.clearApiCache('/rounds/r1');
  const fresh = api.apiRequest('/rounds/r1', 'GET', null, 'tok', {skipCache: true});
  gate.resolve();
  await Promise.all([stale, fresh]);
  assert.equal(calls.length, 2);
});

test('one caller aborting does not cancel the shared request for others', async () => {
  const gate = deferred();
  handler = async () => { await gate.promise; return json({success: true, ok: 1}); };
  const controller = new AbortController();
  const aborted = api.apiRequest('/rounds/r1', 'GET', null, 'tok', {skipCache: true, signal: controller.signal});
  const kept = api.apiRequest('/rounds/r1', 'GET', null, 'tok', {skipCache: true});
  controller.abort(new Error('left page'));
  await assert.rejects(aborted, /left page/);
  gate.resolve();
  assert.equal((await kept).ok, 1);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].signal.aborted, false);
});

test('pairing generation sends force only when asked; promotions send deltas', async () => {
  const bodies = [];
  handler = async (_url, options) => { bodies.push(options.body ? JSON.parse(options.body) : undefined); return json({success: true}); };
  await api.AdminApi.generateRound1Pairings('r1', 't');
  await api.AdminApi.generatePowerMatchPairings('r1', 't', {force: true});
  await api.AdminApi.updatePromotions('r1', {add: ['u1']}, 't');
  assert.deepEqual(bodies, [undefined, {force: true}, {add: ['u1'], remove: []}]);
  assert.match(calls[2].url, /\/admin\/rounds\/r1\/promote$/);
});

test('every request carries the per-tab X-Client-Id', async () => {
  const seen = [];
  handler = async (_url, options) => { seen.push(options.headers?.['X-Client-Id']); return json({success: true}); };
  await api.apiRequest('/rounds/r1', 'GET', null, 't', {skipCache: true});
  await api.AdminApi.updatePromotions('r1', {add: ['u1']}, 't');
  assert.equal(typeof api.CLIENT_ID, 'string');
  assert.ok(api.CLIENT_ID.length >= 8 && api.CLIENT_ID.length <= 64);
  assert.match(api.CLIENT_ID, /^[A-Za-z0-9_-]+$/);
  assert.deepEqual(seen, [api.CLIENT_ID, api.CLIENT_ID]);
});

test('allocateRooms sends onlyUnassigned only when asked; updateDebate sends expectedUpdatedAt when known', async () => {
  const bodies = [];
  handler = async (_url, options) => { bodies.push(JSON.parse(options.body)); return json({success: true}); };
  await api.AdminApi.allocateRooms('r1', {selectedRoomIds: ['a'], gap: 5}, 't');
  await api.AdminApi.allocateRooms('r1', {roomIds: ['b']}, 't', {onlyUnassigned: true});
  await api.AdminApi.updateDebate('d1', {judgeName: 'J'}, 't', {expectedUpdatedAt: '2026-11-17T10:00:00.000Z'});
  await api.AdminApi.updateDebate('d1', {judgeName: 'J'}, 't');
  assert.deepEqual(bodies, [
    {selectedRoomIds: ['a'], gap: 5, roomIds: ['a']},
    {roomIds: ['b'], onlyUnassigned: true},
    {judgeName: 'J', expectedUpdatedAt: '2026-11-17T10:00:00.000Z'},
    {judgeName: 'J'},
  ]);
  assert.match(calls[0].url, /\/pairing\/r1\/allocate-rooms$/);
  assert.equal(calls[2].method, 'PUT');
  assert.match(calls[2].url, /\/debates\/d1$/);
});
