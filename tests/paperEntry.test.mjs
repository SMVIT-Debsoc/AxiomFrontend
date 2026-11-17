import {test} from 'node:test';
import assert from 'node:assert/strict';
import {parseScore, parseWinnerKey, resolvePaperEntry, nextMissingDebate, pushRecent} from '../src/lib/paperEntry.js';

const debates = [
  {id: 'a', room: {name: 'Room 1'}, debater1Id: 'g1', debater2Id: 'o1', status: 'PENDING'},
  {id: 'b', room: {name: 'Room 2'}, debater1Id: 'g2', debater2Id: 'o2', status: 'PENDING'},
  {id: 'c', room: {name: 'Room 3'}, debater1Id: 'g3', debater2Id: 'o3', status: 'COMPLETED'},
];

test('score and winner key parsing', () => {
  assert.equal(parseScore('75'), 75);
  assert.equal(parseScore('74,5'), 74.5);
  assert.ok(Number.isNaN(parseScore('7x')));
  assert.ok(Number.isNaN(parseScore('')));
  assert.equal(parseWinnerKey('1'), 1);
  assert.equal(parseWinnerKey('O'), 2);
  assert.equal(parseWinnerKey('x'), null);
});

test('higher score wins automatically', () => {
  const r = resolvePaperEntry({debates, roomText: '2', gov: '70', opp: '74'});
  assert.equal(r.ok, true);
  assert.equal(r.debate.id, 'b');
  assert.equal(r.winnerId, 'o2');
});

test('tie requires an explicit winner', () => {
  const tie = resolvePaperEntry({debates, roomText: '1', gov: '72', opp: '72'});
  assert.equal(tie.ok, false);
  assert.equal(tie.needsWinner, true);
  const chosen = resolvePaperEntry({debates, roomText: '1', gov: '72', opp: '72', winnerChoice: 1});
  assert.equal(chosen.winnerId, 'g1');
});

test('errors point at the right field', () => {
  assert.equal(resolvePaperEntry({debates, roomText: '', gov: '1', opp: '2'}).field, 'room');
  assert.equal(resolvePaperEntry({debates, roomText: '9', gov: '1', opp: '2'}).field, 'room');
  assert.equal(resolvePaperEntry({debates, roomText: '1', gov: 'x', opp: '2'}).field, 'gov');
  assert.equal(resolvePaperEntry({debates, roomText: '1', gov: '1', opp: ''}).field, 'opp');
});

test('next missing skips the saved one and completed ones', () => {
  const round = {pairingsPublished: false};
  assert.equal(nextMissingDebate(debates, round, 'a').id, 'b');
  assert.equal(nextMissingDebate(debates.slice(0, 1), round, 'a'), null);
});

test('recent list keeps 5, newest first, de-duplicated', () => {
  let list = [];
  for (let i = 0; i < 7; i += 1) list = pushRecent(list, {debateId: `d${i}`});
  assert.equal(list.length, 5);
  assert.equal(list[0].debateId, 'd6');
  list = pushRecent(list, {debateId: 'd4', again: true});
  assert.equal(list[0].again, true);
  assert.equal(list.filter((e) => e.debateId === 'd4').length, 1);
});
