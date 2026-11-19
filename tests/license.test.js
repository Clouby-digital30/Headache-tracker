import { test } from 'node:test';
import assert from 'node:assert/strict';
import { defaultState } from '../js/store.js';
import { trialUsed, isLicensed, trialExhausted, TRIAL_LIMIT } from '../js/license.js';

function withEntries(n) {
  const state = defaultState();
  for (let i = 0; i < n; i++) state.entries[`2026-01-${String(i + 1).padStart(2, '0')}`] = {};
  return state;
}

test('trial is not exhausted below the limit', () => {
  const state = withEntries(TRIAL_LIMIT - 1);
  assert.equal(trialUsed(state), TRIAL_LIMIT - 1);
  assert.equal(isLicensed(state), false);
  assert.equal(trialExhausted(state), false);
});

test('trial is exhausted once the limit is reached', () => {
  const state = withEntries(TRIAL_LIMIT);
  assert.equal(trialExhausted(state), true);
});

test('a valid license lifts the limit regardless of entry count', () => {
  const state = withEntries(TRIAL_LIMIT + 50);
  state.license = { key: 'abc', instanceId: '1', valid: true };
  assert.equal(isLicensed(state), true);
  assert.equal(trialExhausted(state), false);
});

test('a grandfathered state (saved before licensing existed) is never exhausted', () => {
  const state = withEntries(TRIAL_LIMIT + 50);
  state.license = { key: null, instanceId: null, valid: true, grandfathered: true };
  assert.equal(trialExhausted(state), false);
});
