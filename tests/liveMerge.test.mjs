import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createPatchLog, mergeEntities, mergeRecord, pickNewer, upsertEntity, isOwnEcho, ALL, applyListPayload, listPayloadIds, withoutMeta, adoptDebateCurrent, relabelDebateConflict} from '../src/lib/liveMerge.js';

test('refetch without patches since it started is authoritative', () => {
  const log = createPatchLog();
  const started = log.begin();
  const local = [{id: 'd1', winnerId: 'stale'}];
  const server = [{id: 'd1', winnerId: 'u1'}, {id: 'd2'}];
  assert.equal(log.since(started, 'debate'), null);
  assert.deepEqual(mergeEntities(server, local, log.since(started, 'debate')), server);
});

test('socket patch applied after refetch started survives the older snapshot', () => {
  const log = createPatchLog();
  const started = log.begin();
  // another admin's ballot lands while the round GET is in flight
  log.mark('debate', 'd1');
  const local = [{id: 'd1', status: 'COMPLETED', winnerId: 'u1', debater1Score: 80}, {id: 'd2', status: 'PENDING'}];
  const server = [{id: 'd1', status: 'PENDING', winnerId: null}, {id: 'd2', status: 'PENDING', judgeName: 'J'}];
  const merged = mergeEntities(server, local, log.since(started, 'debate'));
  assert.equal(merged[0].status, 'COMPLETED');
  assert.equal(merged[0].winnerId, 'u1');
  assert.equal(merged[1].judgeName, 'J', 'unpatched entities still take the server copy');
});

test('newest updatedAt wins when both copies carry timestamps', () => {
  const older = {id: 'd1', updatedAt: '2026-11-17T10:00:00.000Z', winnerId: 'a'};
  const newer = {id: 'd1', updatedAt: '2026-11-17T10:00:05.000Z', winnerId: 'b'};
  assert.equal(pickNewer(newer, older), newer);
  assert.equal(pickNewer(older, newer), newer);
  const log = createPatchLog();
  const started = log.begin();
  log.mark('debate', 'd1');
  assert.equal(mergeEntities([newer], [older], log.since(started, 'debate'))[0].winnerId, 'b');
});

test('patch-created entities are kept and patch-deleted entities stay deleted', () => {
  const log = createPatchLog();
  const started = log.begin();
  log.mark('checkIn', 'u3'); // new check-in arrived
  log.mark('checkIn', 'u2'); // removed locally
  const local = [{userId: 'u1', status: 'PRESENT'}, {userId: 'u3', status: 'PRESENT'}];
  const server = [{userId: 'u1', status: 'PRESENT'}, {userId: 'u2', status: 'PRESENT'}];
  const merged = mergeEntities(server, local, log.since(started, 'checkIn'), 'userId');
  assert.deepEqual(merged.map((c) => c.userId), ['u1', 'u3']);
});

test('whole-list replacement after refetch start keeps the local list', () => {
  const log = createPatchLog();
  const started = log.begin();
  log.mark('debate', ALL); // pairings:generated replaced everything
  const local = [{id: 'new1'}];
  assert.equal(mergeEntities([{id: 'old1'}], local, log.since(started, 'debate')), local);
});

test('patches before the refetch started do not affect it; scopes are separate', () => {
  const log = createPatchLog();
  log.mark('debate', 'd1');
  const started = log.begin();
  log.mark('checkIn', 'u1');
  assert.equal(log.since(started, 'debate'), null);
  assert.deepEqual([...log.since(started, 'checkIn')], ['u1']);
});

test('round record keeps patched fields unless the server copy is newer', () => {
  const fields = new Set(['pairingsPublished']);
  const local = {id: 'r1', pairingsPublished: true, motion: 'old'};
  const server = {id: 'r1', pairingsPublished: false, motion: 'new'};
  assert.deepEqual(mergeRecord(server, local, fields), {id: 'r1', pairingsPublished: true, motion: 'new'});
  const newerServer = {...server, updatedAt: '2026-11-17T10:00:10Z'};
  assert.equal(mergeRecord(newerServer, {...local, updatedAt: '2026-11-17T10:00:00Z'}, fields), newerServer);
  assert.equal(mergeRecord(server, local, null), server);
});

test('upsert and own-echo helpers', () => {
  assert.deepEqual(upsertEntity([{id: 'a', x: 1}], {id: 'a', y: 2}), [{id: 'a', x: 1, y: 2}]);
  assert.deepEqual(upsertEntity([{id: 'a'}], {id: 'b'}).map((d) => d.id), ['a', 'b']);
});

test('own-echo is per tab: compares actorClientId, never the user id', () => {
  // Same tab -> suppressed.
  assert.equal(isOwnEcho({actorId: 'user_1', actorClientId: 'tab-a'}, 'tab-a'), true);
  // Same admin, other tab -> applied.
  assert.equal(isOwnEcho({actorId: 'user_1', actorClientId: 'tab-b'}, 'tab-a'), false);
  // Older server (actorId only) or no client id -> never suppressed.
  assert.equal(isOwnEcho({actorId: 'tab-a'}, 'tab-a'), false);
  assert.equal(isOwnEcho({}, 'tab-a'), false);
  assert.equal(isOwnEcho({actorClientId: 'tab-a'}, null), false);
  assert.equal(isOwnEcho(null, 'tab-a'), false);
});

test('withoutMeta strips routing and actor fields before merging into a record', () => {
  assert.deepEqual(
    withoutMeta({roundId: 'r', eventId: 'e', actorId: 'u', actorClientId: 'c', status: 'COMPLETED', updatedAt: 't'}),
    {status: 'COMPLETED', updatedAt: 't'},
  );
  assert.deepEqual(withoutMeta(undefined), {});
});

test('list payloads replace only when complete, otherwise upsert by id', () => {
  const local = [
    {id: 'done', status: 'COMPLETED', debater1Score: 75},
    {id: 'old', status: 'SCHEDULED'},
  ];
  const partial = [{id: 'old', status: 'SCHEDULED', roomId: 'r1'}, {id: 'new', status: 'SCHEDULED'}];

  // Partial payload (older server): the preserved COMPLETED debate survives.
  const upserted = applyListPayload(local, partial);
  assert.deepEqual(upserted.map((d) => d.id), ['done', 'old', 'new']);
  assert.equal(upserted[0].debater1Score, 75);
  assert.equal(upserted[1].roomId, 'r1');
  assert.deepEqual(listPayloadIds(partial), ['old', 'new']);

  // Complete payload: authoritative, removed debates go away.
  const full = [{id: 'done', status: 'COMPLETED'}, {id: 'new', status: 'SCHEDULED'}];
  assert.equal(applyListPayload(local, full, {complete: true}), full);
  assert.equal(listPayloadIds(full, {complete: true}), ALL);

  // Junk payloads leave the list alone.
  assert.equal(applyListPayload(local, undefined), local);
});

test('a complete list payload marks ALL so an in-flight refetch cannot wipe it', () => {
  const log = createPatchLog();
  const token = log.begin();
  log.mark('debate', listPayloadIds([{id: 'a'}], {complete: true}));
  const patched = log.since(token, 'debate');
  const local = [{id: 'a'}];
  assert.equal(mergeEntities([{id: 'stale'}], local, patched), local);
});

test('adoptDebateCurrent takes the conflicting server row and drops stale relations', () => {
  const rooms = [{id: 'r2', name: 'Hall B'}];
  const mine = {id: 'd1', judgeName: 'Mine', roomId: 'r1', room: {id: 'r1'}, adjudicatorId: 'u1', adjudicator: {id: 'u1'}, updatedAt: 'v1'};
  const current = {id: 'd1', judgeName: 'Theirs', roomId: 'r2', adjudicatorId: null, updatedAt: 'v2'};
  const adopted = adoptDebateCurrent(mine, current, {rooms});
  assert.equal(adopted.judgeName, 'Theirs');
  assert.equal(adopted.updatedAt, 'v2');
  assert.deepEqual(adopted.room, rooms[0]);
  assert.equal(adopted.adjudicator, null);
  // Unchanged relations are kept.
  const same = adoptDebateCurrent(mine, {...current, roomId: 'r1', adjudicatorId: 'u1'});
  assert.deepEqual(same.room, {id: 'r1'});
  assert.deepEqual(same.adjudicator, {id: 'u1'});
  assert.equal(adoptDebateCurrent(mine, null), mine);
});

test('relabelDebateConflict keeps the 409 routing data', () => {
  const err = Object.assign(new Error('server text'), {status: 409, code: 'BALLOT_CONFLICT', data: {current: {id: 'd1'}}});
  const relabeled = relabelDebateConflict(err);
  assert.match(relabeled.message, /^Another admin changed this debate/);
  assert.equal(relabeled.status, 409);
  assert.equal(relabeled.code, 'BALLOT_CONFLICT');
  assert.deepEqual(relabeled.data.current, {id: 'd1'});
  const other = Object.assign(new Error('gone'), {status: 409, code: 'DEBATE_REPLACED'});
  assert.equal(relabelDebateConflict(other), other);
});
