import {test} from 'node:test';
import assert from 'node:assert/strict';
import {
  parseStation, parsePanel, defaultStation, firstName, surname, flagsOf, flagLabel, drawPublishedAt, isSilent,
  debateState, roundCounters, sortDebates, findDebateByRoom, missingBallots, normalizeBallotLinks,
  absoluteUrl, commandContext, pipelineStep, ballotAgeMinutes, debateMatches,
} from '../src/lib/liveStations.js';
import {nextStep} from '../src/lib/roundNextStep.js';

const NOW = Date.parse('2026-11-17T10:00:00Z');
const MIN = 60000;
const published = {pairingsPublished: true, updatedAt: new Date(NOW - 30 * MIN).toISOString()};

test('station and panel parsing', () => {
  assert.equal(parseStation('Desk'), 'desk');
  assert.equal(parseStation('display'), null);
  assert.equal(parsePanel('ballot-links'), 'ballot-links');
  assert.equal(parsePanel('nope'), null);
  assert.equal(defaultStation(1280), 'director');
  assert.equal(defaultStation(390), 'desk');
});

test('firstName and surname fall back sensibly', () => {
  assert.equal(firstName({firstName: 'Riya', lastName: 'Shah'}), 'Riya');
  assert.equal(firstName({name: 'Arjun Mehta'}), 'Arjun');
  assert.equal(firstName(null), 'TBD');
  assert.equal(surname({firstName: 'Riya', lastName: 'Shah'}), 'Shah');
  assert.equal(surname({firstName: 'Arjun Mehta'}), 'Mehta');
  assert.equal(surname(null), 'TBD');
});

test('flags: arrays, strings, objects and labels', () => {
  assert.deepEqual(flagsOf({ballotFlags: ['large_margin']}), ['large_margin']);
  assert.deepEqual(flagsOf({ballotFlags: 'a, b'}), ['a', 'b']);
  assert.deepEqual(flagsOf({ballotFlags: {x: true, y: false}}), ['x']);
  assert.deepEqual(flagsOf({}), []);
  assert.equal(flagLabel('tie_manual_winner'), 'Tie broken by hand');
  assert.equal(flagLabel('judge_name_mismatch'), 'Different judge name');
  assert.equal(flagLabel('weird_new_flag'), 'Weird new flag');
});

test('draw time prefers explicit publish time, then slot start, then round.updatedAt', () => {
  assert.ok(Number.isNaN(drawPublishedAt({pairingsPublished: false}, {})));
  const explicit = {pairingsPublished: true, pairingsPublishedAt: new Date(NOW - 25 * MIN).toISOString()};
  assert.equal(drawPublishedAt(explicit, {}), NOW - 25 * MIN);
  assert.equal(drawPublishedAt(published, {startTime: new Date(NOW - 5 * MIN).toISOString()}), NOW - 5 * MIN);
  assert.equal(drawPublishedAt(published, {}), NOW - 30 * MIN);
});

test('silent = no ballot 20+ min after draw', () => {
  assert.equal(isSilent({status: 'PENDING'}, published, NOW), true);
  assert.equal(isSilent({status: 'COMPLETED'}, published, NOW), false);
  assert.equal(isSilent({status: 'PENDING', startTime: new Date(NOW - 10 * MIN).toISOString()}, published, NOW), false);
  assert.equal(isSilent({status: 'PENDING'}, {pairingsPublished: false}, NOW), false);
  assert.equal(ballotAgeMinutes({}, published, NOW), 30);
});

test('tile state: flag > done > silent > live > waiting', () => {
  assert.equal(debateState({status: 'COMPLETED', ballotFlags: ['large_margin']}, published, NOW), 'flag');
  assert.equal(debateState({status: 'COMPLETED'}, published, NOW), 'done');
  assert.equal(debateState({status: 'PENDING'}, published, NOW), 'flag');
  assert.equal(debateState({status: 'PENDING', startTime: new Date(NOW).toISOString()}, published, NOW), 'live');
  assert.equal(debateState({status: 'PENDING'}, {pairingsPublished: false}, NOW), 'waiting');
});

test('counters', () => {
  const debates = [{status: 'COMPLETED'}, {status: 'COMPLETED', ballotFlags: ['x']}, {status: 'PENDING'}];
  assert.deepEqual(roundCounters({debates, round: published, presentCount: 5, totalCount: 6, nowMs: NOW}),
    {checkedIn: 5, eligible: 6, ballots: 2, debates: 3, flagged: 1, silent: 1});
});

test('sort by room is natural; by flags puts flagged first', () => {
  const ds = [{id: 'a', room: {name: 'Room 10'}}, {id: 'b', room: {name: 'Room 2'}}, {id: 'c'}, {id: 'd', room: {name: 'Room 3'}, ballotFlags: ['x']}];
  assert.deepEqual(sortDebates(ds, 'room').map((d) => d.id), ['b', 'd', 'a', 'c']);
  assert.equal(sortDebates(ds, 'flags')[0].id, 'd');
});

test('find debate by room text', () => {
  const ds = [{id: 'a', room: {name: 'Room 12'}}, {id: 'b', room: {name: 'Hall B'}}, {id: 'c', room: {name: 'Room 1'}}];
  assert.equal(findDebateByRoom(ds, '12').id, 'a');
  assert.equal(findDebateByRoom(ds, 'room 1').id, 'c');
  assert.equal(findDebateByRoom(ds, 'hall').id, 'b');
  assert.equal(findDebateByRoom(ds, 'room'), null);
  assert.equal(findDebateByRoom(ds, ''), null);
});

test('missing ballots oldest first', () => {
  const ds = [
    {id: 'new', status: 'PENDING', startTime: new Date(NOW - 5 * MIN).toISOString()},
    {id: 'old', status: 'PENDING', startTime: new Date(NOW - 50 * MIN).toISOString()},
    {id: 'done', status: 'COMPLETED'},
  ];
  assert.deepEqual(missingBallots(ds, published, NOW).map((d) => d.id), ['old', 'new']);
});

test('ballot links normalization', () => {
  const links = normalizeBallotLinks({links: [
    {debateId: 'd1', roomName: 'R1', debater1Name: 'A', debater2Name: 'B', path: '/ballot/t1'},
    {debateId: 'd2', url: 'https://x.test/ballot/t2'},
    {debateId: 'd3', token: 't3'},
    {debateId: 'd4'},
  ]}, 'https://x.test');
  assert.deepEqual(links.map((l) => l.path), ['/ballot/t1', '/ballot/t2', '/ballot/t3']);
  assert.equal(absoluteUrl('https://x.test', '/ballot/t1'), 'https://x.test/ballot/t1');
  assert.equal(absoluteUrl('https://x.test', 'https://y.test/a'), 'https://y.test/a');
});

test('command context and pipeline step', () => {
  const ctx = commandContext('r1', [{id: 'd', room: {name: 'R'}, debater1: {firstName: 'A'}, debater2: {firstName: 'B'}}], [{id: 'u', firstName: 'C'}]);
  assert.deepEqual(ctx, {roundId: 'r1', debates: [{id: 'd', roomName: 'R', debater1Name: 'A', debater2Name: 'B'}], people: [{userId: 'u', name: 'C'}]});
  assert.equal(pipelineStep({debates: []}), 0);
  assert.equal(pipelineStep({debates: [{id: 1}]}), 1);
  assert.equal(pipelineStep({debates: [{roomId: 1, room: {}}, {}]}), 2);
  assert.equal(pipelineStep({debates: [{roomId: 1, room: {}}], round: {}}), 3);
  assert.equal(pipelineStep({debates: [{roomId: 1, room: {}}], round: {pairingsPublished: true}}), 4);
  assert.equal(pipelineStep({debates: [{roomId: 1, room: {}, status: 'COMPLETED'}], round: {pairingsPublished: true}}), 5);
  assert.equal(debateMatches({debater1: {firstName: 'Riya'}, room: {name: 'X'}}, 'riy'), true);

  // Pipeline enforces: Enter scores -> Who gets promoted -> Review Result -> Publish (never blind publish before Advance)
  let called = null;
  const step5Draft = nextStep({
    step: 5, present: 4, total: 4, debates: 2, withRoom: 2, noJudge: 0, pending: 0,
    resultsPublished: false, isRound1: true, busy: '',
    actions: {advance: () => { called = 'advance'; }, publishResults: () => { called = 'publish'; }},
  });
  step5Draft.run();
  assert.equal(called, 'advance');
  assert.match(step5Draft.body, /Nobody is eliminated until you publish/i);
});
