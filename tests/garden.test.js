import { test } from 'node:test';
import assert from 'node:assert/strict';
import { seasonFor, moonPhase } from '../js/garden.js';

test('seasonFor maps months to meteorological seasons', () => {
  assert.equal(seasonFor(new Date(2026, 0, 15)), 'winter'); // Jan
  assert.equal(seasonFor(new Date(2026, 2, 1)), 'spring'); // Mar
  assert.equal(seasonFor(new Date(2026, 5, 1)), 'summer'); // Jun
  assert.equal(seasonFor(new Date(2026, 8, 1)), 'autumn'); // Sep
  assert.equal(seasonFor(new Date(2026, 11, 31)), 'winter'); // Dec
});

test('moonPhase is 0 at the reference new moon and ~0.5 a half-month later', () => {
  const newMoon = new Date(Date.UTC(2000, 0, 6, 18, 14));
  const phaseAtNew = moonPhase(newMoon);
  assert.ok(phaseAtNew < 0.01 || phaseAtNew > 0.99);
  const halfLater = new Date(newMoon.getTime() + 14.765 * 86400000);
  const phaseAtFull = moonPhase(halfLater);
  assert.ok(Math.abs(phaseAtFull - 0.5) < 0.01);
});

test('moonPhase always returns a fraction between 0 and 1', () => {
  for (let i = 0; i < 400; i += 37) {
    const p = moonPhase(new Date(2026, 0, 1 + i));
    assert.ok(p >= 0 && p < 1, `phase ${p} out of range for day ${i}`);
  }
});
