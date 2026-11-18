import { test } from 'node:test';
import assert from 'node:assert/strict';
import { defaultState, backupDue, normalize } from '../js/store.js';

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
