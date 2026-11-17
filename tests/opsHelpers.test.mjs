import {test} from 'node:test';
import assert from 'node:assert/strict';
import {fuzzyScore, fuzzyFilter} from '../src/lib/fuzzy.js';
import {drawRows, paginate, sortByFirstName, sortBySurname, surnameFirst, rowsThatFit, wrapPage, secondsUntil, pickDisplayRound} from '../src/lib/displayBoard.js';
import {ballotUrl, venueCheckInUrl, formatShortCode, passQrValue, isResumablePath, encodeReturnTo, decodeReturnTo, RETURN_TO_TTL_MS} from '../src/lib/opsLinks.js';
import {relativeTime, initialsOf, mergeFeed} from '../src/lib/relativeTime.js';

test('fuzzyScore: substring beats scattered, prefix beats middle, no match is -1', () => {
  assert.equal(fuzzyScore('xyz', 'Room 12'), -1);
  assert.ok(fuzzyScore('room', 'Room 12') > fuzzyScore('room', 'Back room 12'));
  assert.ok(fuzzyScore('room 12', 'Room 12') > fuzzyScore('rm12', 'Room 12'));
  assert.ok(fuzzyScore('rm12', 'Room 12') >= 0);
  assert.equal(fuzzyScore('', 'anything'), 0);
  assert.ok(fuzzyScore('jose', 'José Ramos') > 0, 'accent-insensitive');
});

test('fuzzyFilter ranks and keeps order on ties, uses best key, honours limit', () => {
  const items = [{label: 'Open rooms'}, {label: 'Open draw panel'}, {label: 'Publish draw'}];
  assert.deepEqual(fuzzyFilter(items, 'draw').map((i) => i.label), ['Publish draw', 'Open draw panel']);
  assert.equal(fuzzyFilter(items, '').length, 3);
  assert.equal(fuzzyFilter(items, '', undefined, 2).length, 2);
  const people = [{name: 'A', alt: 'Riya Kapoor'}];
  assert.equal(fuzzyFilter(people, 'kapoor', (p) => [p.name, p.alt]).length, 1);
});

test('drawRows: one row per debater, GOV/OPP sides, swing slot, first-name order', () => {
  const debates = [
    {id: 'd1', room: {name: 'Room 12'}, debater1: {firstName: 'Riya', lastName: 'Zed'}, debater2: {firstName: 'Arjun', lastName: 'Bose'}},
    {id: 'd2', roomName: 'Room 3', debater1: {firstName: 'Mia', lastName: 'adams'}, debater2: null},
  ];
  const rows = drawRows(debates);
  assert.deepEqual(rows.map((r) => r.name), ['Arjun Bose', 'Mia adams', 'Riya Zed']);
  assert.equal(rows[0].side, 'OPP');
  assert.equal(rows[0].opponent, 'Riya Zed');
  assert.equal(rows[1].opponent, '—');
  assert.equal(rows[2].room, 'Room 12');
  assert.equal(drawRows([{id: 'x', debater1: {name: 'Solo'}}])[0].room, 'Room TBA');
});

test('surname and first-name helpers', () => {
  assert.equal(surnameFirst({name: 'Ada Lovelace'}), 'Lovelace, Ada');
  assert.equal(surnameFirst({firstName: 'Cher'}), 'Cher');
  assert.equal(surnameFirst(null), 'TBD');
  assert.deepEqual(sortBySurname([{lastName: 'b'}, {lastName: 'A'}]).map((p) => p.lastName), ['A', 'b']);
  assert.deepEqual(sortByFirstName([{firstName: 'Zara', lastName: 'A'}, {firstName: 'Arjun', lastName: 'Z'}]).map((p) => p.firstName), ['Arjun', 'Zara']);
});

test('pagination helpers', () => {
  assert.deepEqual(paginate([1, 2, 3, 4, 5], 2), [[1, 2], [3, 4], [5]]);
  assert.deepEqual(paginate([], 10), [[]]);
  assert.deepEqual(paginate([1], 0), [[1]]);
  assert.equal(wrapPage(3, 3), 0);
  assert.equal(wrapPage(-1, 3), 2);
  assert.equal(wrapPage(5, 0), 0);
  assert.equal(rowsThatFit(1080, 80, 200), 11);
  assert.equal(rowsThatFit(100, 80, 200), 4);
  assert.equal(rowsThatFit(100000, 10), 40);
});

test('secondsUntil and pickDisplayRound', () => {
  assert.equal(secondsUntil(10_500, 1_000), 10);
  assert.equal(secondsUntil(0, 5_000), 0);
  assert.equal(secondsUntil(null), null);
  assert.equal(secondsUntil('nope'), null);
  const rounds = [
    {id: 'r1', roundNumber: 1, status: 'COMPLETED', pairingsPublished: true},
    {id: 'r2', roundNumber: 2, status: 'UPCOMING', pairingsPublished: true},
    {id: 'r3', roundNumber: 3, status: 'UPCOMING'},
  ];
  assert.equal(pickDisplayRound(rounds).id, 'r2');
  assert.equal(pickDisplayRound(rounds, 'r1').id, 'r1');
  assert.equal(pickDisplayRound(rounds, 'missing').id, 'r2');
  assert.equal(pickDisplayRound([...rounds, {id: 'r4', roundNumber: 4, status: 'ONGOING'}]).id, 'r4');
  assert.equal(pickDisplayRound([]), null);
});

test('ops links', () => {
  assert.equal(ballotUrl('https://a.test/', 'a b'), 'https://a.test/ballot/a%20b');
  assert.equal(ballotUrl('https://a.test', ''), '');
  assert.equal(venueCheckInUrl('https://a.test', 'r1', ' K7Q2 '), 'https://a.test/checkin/r1?c=K7Q2');
  assert.equal(venueCheckInUrl('https://a.test', 'r1', ''), '');
  assert.equal(formatShortCode('ab-cd12'), 'ABC D12');
  assert.equal(formatShortCode('abcd1234'), 'ABCD 1234');
  assert.equal(formatShortCode('k7q'), 'K7Q');
  assert.equal(passQrValue('  p.1  '), 'p.1');
});

test('return-to after sign-in only resumes fresh /checkin paths', () => {
  assert.ok(isResumablePath('/checkin/abc_1?c=XY12'));
  assert.ok(!isResumablePath('//evil.test/checkin/1'));
  assert.ok(!isResumablePath('/admin'));
  assert.ok(!isResumablePath('https://evil.test/checkin/1'));
  const now = 1_000_000;
  const raw = encodeReturnTo('/checkin/r1?c=AB', now);
  assert.equal(decodeReturnTo(raw, now + 1000), '/checkin/r1?c=AB');
  assert.equal(decodeReturnTo(raw, now + RETURN_TO_TTL_MS + 1), null);
  assert.equal(encodeReturnTo('/admin', now), null);
  assert.equal(decodeReturnTo('{bad', now), null);
  assert.equal(decodeReturnTo(JSON.stringify({path: '/admin', at: now}), now), null);
});

test('relativeTime, initials, mergeFeed', () => {
  const now = Date.parse('2026-11-17T10:00:00Z');
  assert.equal(relativeTime(now - 2000, now), 'now');
  assert.equal(relativeTime(now - 30_000, now), '30s');
  assert.equal(relativeTime(now - 120_000, now), '2m');
  assert.equal(relativeTime(now - 3 * 3600_000, now), '3h');
  assert.equal(relativeTime(now - 49 * 3600_000, now), '2d');
  assert.equal(relativeTime('garbage', now), '');
  assert.equal(initialsOf('Riya Kapoor Singh'), 'RK');
  assert.equal(initialsOf(''), '?');
  const merged = mergeFeed(
    [{id: 1, createdAt: '2026-11-17T09:00:00Z'}, {id: 2, createdAt: '2026-11-17T08:00:00Z'}],
    [{id: 3, createdAt: '2026-11-17T09:30:00Z'}, {id: 1, createdAt: '2026-11-17T09:00:00Z'}],
  );
  assert.deepEqual(merged.map((m) => m.id), [3, 1, 2]);
});

import {advanceTargetToForm, advanceTargetToPayload, advanceTargetError, advanceTargetChoice, advanceTargetLabel} from '../src/lib/advanceTarget.js';

test('advance target: auto is null, presets and custom round-trip, invalid customs rejected', () => {
  assert.equal(advanceTargetToForm(null), '');
  assert.equal(advanceTargetToForm(16), '16');
  assert.equal(advanceTargetToPayload(''), null);
  assert.equal(advanceTargetToPayload('24'), 24);
  assert.equal(advanceTargetError(''), null);
  assert.equal(advanceTargetError('24'), null);
  assert.ok(advanceTargetError('1'));
  assert.ok(advanceTargetError('2.5'));
  assert.equal(advanceTargetChoice(''), 'auto');
  assert.equal(advanceTargetChoice('32'), '32');
  assert.equal(advanceTargetChoice('24'), 'custom');
  assert.equal(advanceTargetLabel(''), 'Auto');
  assert.equal(advanceTargetLabel('16'), 'Top 16');
});
