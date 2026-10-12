import {test, beforeEach, afterEach} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

// Load the real fetch wrapper with only Vite's environment expression substituted.
const source = (await readFile(new URL('../src/services/api.js', import.meta.url), 'utf8'))
  .replaceAll('import.meta.env', '({VITE_API_URL: "https://fixture.invalid/api/"})');
const api = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
const originalFetch = globalThis.fetch;
const originalError = console.error;
const originalWarn = console.warn;
let calls;
let responses;
beforeEach(() => {
  calls = [];
  responses = [];
  api.setApiAuthRefreshProvider(null);
  console.error = () => {};
  console.warn = () => {};
  globalThis.fetch = async (url, options) => {
    calls.push({url, ...structuredClone(options)});
    const response = responses.shift();
    if (response instanceof Error) throw response;
    assert.ok(response, 'Unexpected extra request');
    return response;
  };
});
afterEach(() => {
  globalThis.fetch = originalFetch;
  console.error = originalError;
  console.warn = originalWarn;
  api.setApiAuthRefreshProvider(null);
});
const json = (value, status = 200) => new Response(JSON.stringify(value), {
  status, headers: {'Content-Type': 'application/json'},
});

test('profile request uses the configured URL and HTTP-only session cookies', async () => {
  responses.push(json({success: true, user: {id: 'u1'}}));
  assert.equal((await api.UserApi.getProfile()).user.id, 'u1');
  assert.equal(calls[0].url, 'https://fixture.invalid/api/users/me');
  assert.equal(calls[0].credentials, 'include');
  assert.equal(calls[0].headers.Authorization, undefined);
});
test('public admin-key validation also sends cookies without bearer credentials', async () => {
  responses.push(json({success: true, valid: false}));
  await api.AdminApi.validateKey('test-only-key');
  assert.equal(calls[0].credentials, 'include');
  assert.equal(calls[0].headers.Authorization, undefined);
  assert.deepEqual(JSON.parse(calls[0].body), {secretKey: 'test-only-key'});
});
test('401 revalidates Better Auth session once and retries with cookies', async () => {
  let count = 0;
  api.setApiAuthRefreshProvider(async () => { count++; return true; });
  responses.push(json({error: 'expired'}, 401), json({success: true}));
  await api.EventApi.list();
  assert.equal(calls.length, 2);
  assert.equal(count, 1);
  assert.equal(calls[1].credentials, 'include');
  assert.equal(calls[1].headers.Authorization, undefined);
});
test('persistent 401 terminates after one session refresh', async () => {
  api.setApiAuthRefreshProvider(async () => true);
  responses.push(json({error: 'expired'}, 401), json({error: 'still expired'}, 401));
  await assert.rejects(api.EventApi.list(), /still expired/);
  assert.equal(calls.length, 2);
});
test('403 is surfaced without silently changing identity', async () => {
  responses.push(json({error: 'Forbidden'}, 403));
  await assert.rejects(api.AdminApi.getDashboard(), /Forbidden/);
  assert.equal(calls.length, 1);
});
test('HTTP 200 with success false is rejected', async () => {
  responses.push(json({success: false, error: 'Enrollment closed'}));
  await assert.rejects(api.EventApi.enroll('e1'), /Enrollment closed/);
});
test('HTML masquerading as API success is rejected', async () => {
  responses.push(new Response('<!DOCTYPE html><html>login</html>', {headers: {'Content-Type':'text/html'}}));
  await assert.rejects(api.EventApi.list(), /Session expired or connection lost/);
});
test('invalid JSON content is rejected', async () => {
  responses.push(new Response('invalid', {headers: {'Content-Type':'application/octet-stream'}}));
  await assert.rejects(api.EventApi.list(), /invalid content/);
});
test('network failure reaches the caller', async () => {
  responses.push(new Error('offline fixture'));
  await assert.rejects(api.EventApi.list(), /offline fixture/);
});
test('session refresh failure preserves the original 401 response', async () => {
  api.setApiAuthRefreshProvider(async () => {throw new Error('session unavailable');});
  responses.push(json({error: 'expired'}, 401));
  await assert.rejects(api.UserApi.getProfile(), /expired/);
  assert.equal(calls.length, 1);
});
const contracts = [
  ['profile update', () => api.UserApi.updateProfile({college:'Test College', mobile:'9999999999'}, 't'), '/users/profile', 'PUT', {college:'Test College', mobile:'9999999999'}],
  ['event creation', () => api.AdminApi.createEvent({name:'Audit Event'}, 't'), '/events', 'POST', {name:'Audit Event'}],
  ['event update', () => api.AdminApi.updateEvent('e1', {status:'ONGOING'}, 't'), '/events/e1', 'PUT', {status:'ONGOING'}],
  ['event deletion', () => api.AdminApi.deleteEvent('e1', 't'), '/events/e1', 'DELETE', undefined],
  ['event enrollment', () => api.EventApi.enroll('e1', 't'), '/events/e1/enroll', 'POST', undefined],
  ['enrollment verification', () => api.EventApi.getEnrollmentStatus('e1', 't'), '/events/e1/enrollment-status', 'GET', undefined],
  ['manual enrollment', () => api.EventApi.enrollUserManual('e1','u1','t'), '/events/e1/enroll-manual', 'POST', {userId:'u1'}],
  ['round creation', () => api.AdminApi.createRound({eventId:'e1'}, 't'), '/rounds', 'POST', {eventId:'e1'}],
  ['participant check-in', () => api.CheckInApi.checkIn('r1','t'), '/check-in', 'POST', {roundId:'r1'}],
  ['check-in verification', () => api.CheckInApi.getMyStatus('r1','t'), '/check-in/round/r1/me', 'GET', undefined],
  ['round-one pairings', () => api.AdminApi.generateRound1Pairings('r1','t'), '/pairing/r1/round1', 'POST', undefined],
  ['power-match pairings', () => api.AdminApi.generatePowerMatchPairings('r1','t'), '/pairing/r1/power-match', 'POST', undefined],
  ['room allocation', () => api.AdminApi.allocateRooms('r1',{selectedRoomIds:['room1']},'t'), '/pairing/r1/allocate-rooms', 'POST', {selectedRoomIds:['room1'],roomIds:['room1']}],
  ['result submission', () => api.AdminApi.submitResult('d1',{winnerId:'u1',debater1Score:80,debater2Score:75},'t'), '/debates/d1/result', 'POST', {winnerId:'u1',debater1Score:80,debater2Score:75}],
  ['promotion', () => api.AdminApi.promoteDebaters('r1',['u1'],'t'), '/admin/rounds/r1/promote', 'POST', {userIds:['u1']}],
  ['publish results', () => api.AdminApi.publishResults('r1',true,'t'), '/admin/rounds/r1/publish', 'POST', {published:true}],
];
for (const [name, run, path, method, body] of contracts) test(`${name}: request contract`, async () => {
  responses.push(json({success: true}));
  await run();
  assert.equal(calls[0].url, `https://fixture.invalid/api${path}`);
  assert.equal(calls[0].method, method);
  assert.deepEqual(calls[0].body ? JSON.parse(calls[0].body) : undefined, body);
});
