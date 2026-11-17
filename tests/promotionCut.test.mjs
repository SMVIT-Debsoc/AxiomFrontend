import {test} from 'node:test';
import assert from 'node:assert/strict';
import {autoTarget, resolveTarget, slotsToFill, clampCut, normalizeProposal, promotionDelta} from '../src/lib/promotionCut.js';

test('auto target is the smallest power of two ≥ winners', () => {
  assert.equal(autoTarget(0), 0);
  assert.equal(autoTarget(1), 1);
  assert.equal(autoTarget(5), 8);
  assert.equal(autoTarget(8), 8);
  assert.equal(autoTarget(50), 64);
});

test('resolve target choices', () => {
  assert.equal(resolveTarget('auto', 50), 64);
  assert.equal(resolveTarget(32, 50), 32);
  assert.equal(resolveTarget('custom', 50, '40'), 40);
  assert.equal(resolveTarget('custom', 50, ''), 64);
});

test('slots and clamping', () => {
  assert.equal(slotsToFill(64, 50, 50), 14);
  assert.equal(slotsToFill(64, 50, 3), 3);
  assert.equal(slotsToFill(32, 50, 50), 0);
  assert.equal(clampCut(-2, 5), 0);
  assert.equal(clampCut(9, 5), 5);
});

test('normalize proposal shapes', () => {
  const p = normalizeProposal({success: true, proposal: {
    winnersCount: 3, targetSize: 4, suggestedCount: 1,
    ranked: [{userId: 'u1', firstName: 'A', lastName: 'B', score: 70, isPromoted: true}, {user: {id: 'u2', firstName: 'C'}, score: 60}],
  }});
  assert.equal(p.winners, 3);
  assert.equal(p.targetSize, 4);
  assert.equal(p.suggestedCut, 1);
  assert.deepEqual(p.candidates.map((c) => c.userId), ['u1', 'u2']);
  assert.equal(p.candidates[0].name, 'A B');
  assert.deepEqual(p.promotedIds, ['u1']);
  const q = normalizeProposal({candidates: [{userId: 'x'}], winners: [{}, {}]});
  assert.equal(q.winners, 2);
  assert.equal(q.suggestedCut, null);
});

test('normalize the real backend proposal shape (cutIndex / needed / promoted)', () => {
  const p = normalizeProposal({success: true, data: {
    roundId: 'r1', advanceTarget: null, targetSize: 8, autoTargetSize: 8, winnersCount: 6, needed: 2, pendingResults: 0, cutIndex: 2,
    candidates: [
      {userId: 'a', name: 'Ann', score: 74, opponentScore: 75, margin: 1, debateId: 'd1', roomName: 'R1', rank: 1, promoted: true},
      {userId: 'b', name: 'Ben', score: 72, opponentScore: 76, margin: 4, debateId: 'd2', roomName: 'R2', rank: 2, promoted: false},
      {userId: 'c', name: 'Cat', score: 70, opponentScore: 77, margin: 7, debateId: 'd3', roomName: 'R3', rank: 3, promoted: false},
    ],
  }});
  assert.equal(p.winners, 6);
  assert.equal(p.targetSize, 8);
  assert.equal(p.suggestedCut, 2);
  assert.equal(p.needed, 2);
  assert.equal(p.targetMode, 'auto');
  assert.deepEqual(p.promotedIds, ['a']);
  assert.equal(p.candidates[1].roomName, 'R2');
  // cutIndex beyond the candidate list is clamped.
  assert.equal(normalizeProposal({data: {cutIndex: 9, needed: 9, candidates: [{userId: 'x'}]}}).suggestedCut, 1);

  const withWinners = normalizeProposal({success: true, data: {
    winnersCount: 2, targetSize: 4, cutIndex: 2, hasExplicitPromotions: true, promotedIds: ['w1', 'm1'],
    winners: [{userId: 'w1', name: 'Asha Rao', score: 84, margin: 4, promoted: true}],
    otherPromoted: [{userId: 'm1', name: 'Kiran S', college: 'RVCE'}],
    candidates: [{userId: 'l1', name: 'Bala N', score: 79, margin: 5, cumulativeWins: 1, promoted: false}],
  }});
  assert.equal(withWinners.winners, 1);
  assert.equal(withWinners.winnerRows[0].name, 'Asha Rao');
  assert.equal(withWinners.otherPromoted[0].userId, 'm1');
  assert.equal(withWinners.hasExplicitPromotions, true);
  assert.equal(withWinners.candidates[0].cumulativeWins, 1);
});

test('delta adds above the line and removes below', () => {
  const cands = [{userId: 'a'}, {userId: 'b'}, {userId: 'c'}];
  assert.deepEqual(promotionDelta(cands, 2, ['a', 'c']), {add: ['b'], remove: ['c']});
  assert.deepEqual(promotionDelta(cands, 0, []), {add: [], remove: []});
});
