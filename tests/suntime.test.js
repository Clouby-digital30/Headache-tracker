import { test } from 'node:test';
import assert from 'node:assert/strict';
import { localTime, dayPhase } from '../js/suntime.js';

test('localTime reads the hour and minute in a given IANA timezone', () => {
  // 2026-06-15T12:00:00Z
  const d = new Date(Date.UTC(2026, 5, 15, 12, 0));
  assert.deepEqual(localTime(d, 'UTC'), { hour: 12, minute: 0 });
  assert.deepEqual(localTime(d, 'Asia/Tokyo'), { hour: 21, minute: 0 }); // UTC+9
  assert.deepEqual(localTime(d, 'America/New_York'), { hour: 8, minute: 0 }); // UTC-4 (EDT)
});

test('localTime falls back to the device clock for an invalid timezone', () => {
  const d = new Date(Date.UTC(2026, 5, 15, 12, 0));
  const r = localTime(d, 'Not/ARealZone');
  assert.deepEqual(r, { hour: d.getHours(), minute: d.getMinutes() });
});

test('dayPhase maps clock time in UTC to the right band', () => {
  const at = (h, m = 0) => new Date(Date.UTC(2026, 5, 15, h, m));
  assert.equal(dayPhase(at(2), 'UTC'), 'night');
  assert.equal(dayPhase(at(5, 30), 'UTC'), 'sunrise');
  assert.equal(dayPhase(at(12), 'UTC'), 'day');
  assert.equal(dayPhase(at(18, 30), 'UTC'), 'sunset');
  assert.equal(dayPhase(at(20), 'UTC'), 'twilight');
  assert.equal(dayPhase(at(23, 30), 'UTC'), 'night');
});

test('dayPhase uses the given timezone, not the system one', () => {
  // Noon UTC is evening in Tokyo (UTC+9) - still "day" at 21:00 is actually twilight there.
  const noon = new Date(Date.UTC(2026, 5, 15, 12, 0));
  assert.equal(dayPhase(noon, 'Asia/Tokyo'), 'twilight'); // 21:00 local
  assert.equal(dayPhase(noon, 'America/New_York'), 'day'); // 08:00 local
});
