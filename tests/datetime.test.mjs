import {test} from 'node:test';
import assert from 'node:assert/strict';
import {toLocalDateTime, serializeEventDates} from '../src/lib/datetime.js';

for (const timezone of ['Asia/Kolkata', 'UTC', 'America/New_York']) test(`event date roundtrip in ${timezone} preserves seconds`, () => {
  const oldTimezone = process.env.TZ;
  try {
    process.env.TZ = timezone;
    const original = {startDate: '2026-10-11T12:34:56.789Z', endDate:'2026-10-12T15:01:23.456Z'};
    const form = {name:'Audit',startDate:toLocalDateTime(original.startDate),endDate:toLocalDateTime(original.endDate)};
    assert.deepEqual(serializeEventDates(form,original), {name:'Audit',...original});
  } finally {
    if (oldTimezone === undefined) delete process.env.TZ;
    else process.env.TZ = oldTimezone;
  }
});
test('new local-clock date converts correctly to UTC in India', () => {
  const oldTimezone = process.env.TZ;
  try {
    process.env.TZ = 'Asia/Kolkata';
    assert.equal(serializeEventDates({startDate:'2026-10-11T18:00',endDate:''}).startDate,'2026-10-11T12:30:00.000Z');
    assert.equal(serializeEventDates({startDate:'2026-10-11T18:00',endDate:''}).endDate,'');
  } finally {
    if (oldTimezone === undefined) delete process.env.TZ;
    else process.env.TZ = oldTimezone;
  }
});
