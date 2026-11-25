import { test } from 'node:test';
import assert from 'node:assert/strict';
import { defaultState, backupDue, normalize, swapDefaultMeds } from '../js/store.js';
import { DEFAULT_MEDS } from '../js/data.js';

function withEntries(n) {
  const state = defaultState();
  for (let i = 0; i < n; i++) state.entries[`2026-01-${String(i + 1).padStart(2, '0')}`] = {};
  return state;
}

test('does not nag before there is much to lose', () => {
  const state = withEntries(6);
  assert.equal(backupDue(state), false);
});

test('asks for a first backup once there is enough to lose', () => {
  const state = withEntries(7);
  assert.equal(state.lastBackupAt, null);
  assert.equal(backupDue(state), true);
});

test('stays quiet for a while after a recent backup', () => {
  const state = withEntries(20);
  state.lastBackupAt = Date.now() - 5 * 86400000;
  assert.equal(backupDue(state), false);
});

test('asks again once a backup is old enough', () => {
  const state = withEntries(20);
  state.lastBackupAt = Date.now() - 22 * 86400000;
  assert.equal(backupDue(state), true);
});

test('a snooze is honoured until it expires', () => {
  const state = withEntries(20);
  state.backupSnoozedUntil = Date.now() + 86400000;
  assert.equal(backupDue(state), false);
  state.backupSnoozedUntil = Date.now() - 1000;
  assert.equal(backupDue(state), true);
});

test('a newly introduced trigger reaches an already-set-up user once', () => {
  const saved = defaultState();
  saved.profile.onboarded = true;
  saved.settings.trackedTriggers = ['alcohol']; // a narrower list, as if saved before this trigger existed
  const loaded = normalize(saved);
  assert.ok(loaded.settings.trackedTriggers.includes('tired'));
  assert.ok(loaded.settings.appliedTriggerUpdates.length > 0);
});

test('removing a migrated trigger again sticks - it does not come back', () => {
  const saved = defaultState();
  saved.profile.onboarded = true;
  saved.settings.trackedTriggers = ['alcohol'];
  const afterMigration = normalize(saved);
  afterMigration.settings.trackedTriggers = afterMigration.settings.trackedTriggers.filter((t) => t !== 'tired');
  const loadedAgain = normalize(afterMigration);
  assert.ok(!loadedAgain.settings.trackedTriggers.includes('tired'));
});

test('swaps the medication list when it is still an unmodified default', () => {
  const settings = { meds: [...DEFAULT_MEDS.en] };
  const swapped = swapDefaultMeds(settings, 'nl');
  assert.deepEqual(swapped.meds, DEFAULT_MEDS.nl);
});

test('leaves a customised medication list alone when the language changes', () => {
  const settings = { meds: ['My own pill'] };
  const swapped = swapDefaultMeds(settings, 'nl');
  assert.deepEqual(swapped.meds, ['My own pill']);
});

test('grandfathers a state saved before licensing existed', () => {
  const saved = defaultState();
  delete saved.license; // as an old save file would be, before this field existed
  const loaded = normalize(saved);
  assert.equal(loaded.license.valid, true);
  assert.equal(loaded.license.grandfathered, true);
});

test('a brand-new state is not grandfathered', () => {
  const loaded = normalize(null);
  assert.equal(loaded.license.valid, false);
  assert.ok(!loaded.license.grandfathered);
});

test('an existing license is kept as saved, not grandfathered', () => {
  const saved = defaultState();
  saved.license = { key: 'abc', instanceId: '1', valid: true };
  const loaded = normalize(saved);
  assert.equal(loaded.license.key, 'abc');
  assert.ok(!loaded.license.grandfathered);
});

test('migrates the old "light" headache-symptom id to light_sensitivity, without touching other symptoms', () => {
  const saved = defaultState();
  saved.profile.onboarded = true;
  saved.entries['2026-01-01'] = { headache: { had: true, symptoms: ['nausea', 'light'] } };
  const loaded = normalize(saved);
  assert.deepEqual(loaded.entries['2026-01-01'].headache.symptoms, ['nausea', 'light_sensitivity']);
});

test('leaves entries with no "light" symptom untouched by the migration', () => {
  const saved = defaultState();
  saved.profile.onboarded = true;
  saved.entries['2026-01-01'] = { headache: { had: true, symptoms: ['nausea'] } };
  const loaded = normalize(saved);
  assert.deepEqual(loaded.entries['2026-01-01'].headache.symptoms, ['nausea']);
});
