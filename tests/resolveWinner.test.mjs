import {test} from 'node:test';
import assert from 'node:assert/strict';
import {resolveWinnerId} from '../src/lib/scoring.js';

test('higher score automatically receives the winner tag', () => {
    const debater1Id = 'u1';
    const debater2Id = 'u2';

    // Debater 1 has higher score
    assert.equal(resolveWinnerId('85', '75', '', debater1Id, debater2Id), debater1Id);
    assert.equal(resolveWinnerId(85.5, 82.0, 'u2', debater1Id, debater2Id), debater1Id);

    // Debater 2 has higher score
    assert.equal(resolveWinnerId('72', '79', '', debater1Id, debater2Id), debater2Id);
    assert.equal(resolveWinnerId(65.0, 90.5, 'u1', debater1Id, debater2Id), debater2Id);
});

test('exact tie requires manual selection or preserves existing valid manual choice', () => {
    const debater1Id = 'u1';
    const debater2Id = 'u2';

    // Tie with no prior winner -> requires explicit manual selection
    assert.equal(resolveWinnerId('80', '80', '', debater1Id, debater2Id), '');

    // Tie with an existing valid winner -> preserves that winner choice
    assert.equal(resolveWinnerId('80', '80', 'u1', debater1Id, debater2Id), 'u1');
    assert.equal(resolveWinnerId('80', '80', 'u2', debater1Id, debater2Id), 'u2');

    // Tie with an invalid winner string -> returns empty string
    assert.equal(resolveWinnerId('80', '80', 'unknown', debater1Id, debater2Id), '');
});

test('incomplete or invalid inputs preserve current choice without throwing', () => {
    const debater1Id = 'u1';
    const debater2Id = 'u2';

    assert.equal(resolveWinnerId('', '80', 'u1', debater1Id, debater2Id), 'u1');
    assert.equal(resolveWinnerId('80', '', 'u2', debater1Id, debater2Id), 'u2');
    assert.equal(resolveWinnerId('abc', '80', '', debater1Id, debater2Id), '');
});
