import { test } from 'node:test';
import assert from 'node:assert/strict';
import { seasonFor, moonPhase, speciesFor } from '../js/garden.js';
import { SPECIES, PACK_SPECIES } from '../js/data.js';

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

test('speciesFor ignores pack species when none are passed, unlocking the first free species at count 1', () => {
  const sp = speciesFor(0); // index 0 = the first-ever flower (count 1)
  assert.equal(sp.id, SPECIES[0].id);
});

test('speciesFor interleaves pack species at their own thresholds once passed in', () => {
  const moonflower = PACK_SPECIES.find((s) => s.id === 'moonflower');
  // The flower that unlocks right at the pack species' own threshold is
  // always that species itself, free species included in the comparison.
  const sp = speciesFor(moonflower.at - 1, PACK_SPECIES);
  assert.equal(sp.id, 'moonflower');
});

test('speciesFor without the pack never returns a pack species, even at the same count', () => {
  const moonflower = PACK_SPECIES.find((s) => s.id === 'moonflower');
  const sp = speciesFor(moonflower.at - 1, []);
  assert.notEqual(sp.id, 'moonflower');
});
