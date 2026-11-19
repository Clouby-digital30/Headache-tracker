// Local-only persistence. Everything lives in localStorage on this device.
import { DEFAULT_TRIGGERS, DEFAULT_MEDS, TRIGGER_UPDATES } from './data.js';

const KEY = 'clary.v1';

export function toDateStr(d) {
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export function parseDate(str) {
  const [y, m, d] = str.split('-').map(Number);
  return new Date(y, m - 1, d, 12); // noon avoids daylight-saving edge cases
}

export function addDays(str, n) {
  const d = parseDate(str);
  d.setDate(d.getDate() + n);
  return toDateStr(d);
}

export const today = () => toDateStr(new Date());

export function defaultState() {
  return {
    version: 1,
    profile: { name: '', stage: 'irregular', onboarded: false },
    settings: {
      lang: 'en', // 'en' | 'nl'
      theme: 'auto', // 'auto' | 'light' | 'dark'
      reminderOn: false,
      reminderTime: '20:00',
      trackedTriggers: [...DEFAULT_TRIGGERS],
      appliedTriggerUpdates: [], // ids of TRIGGER_UPDATES already merged in, so they aren't repeated
      customTriggers: [], // [{id, label}]
      meds: [...DEFAULT_MEDS.en],
      usesHrt: false,
      trackMeno: true,
    },
    entries: {}, // 'YYYY-MM-DD' -> entry
    seenMilestones: [],
    lastBackupAt: null, // timestamp (ms) of the last "Save backup", or null
    backupSnoozedUntil: null, // timestamp (ms): don't remind before this
    license: { key: null, instanceId: null, valid: false }, // see js/license.js
  };
}

// Adds any trigger introduced since a saved state was last written, once,
// without undoing a user's own choice to remove it afterwards.
function applyTriggerUpdates(settings) {
  const applied = Array.isArray(settings.appliedTriggerUpdates) ? [...settings.appliedTriggerUpdates] : [];
  const tracked = [...settings.trackedTriggers];
  for (const update of TRIGGER_UPDATES) {
    if (applied.includes(update.id)) continue;
    for (const t of update.add) if (!tracked.includes(t)) tracked.push(t);
    applied.push(update.id);
  }
  return { ...settings, trackedTriggers: tracked, appliedTriggerUpdates: applied };
}

// Fixes entries saved before 'none' was split into its own id per list (it
// used to mean three different things - no period, no impact, no relief -
// which collided in a single id-to-label lookup).
function migrateEntries(entries) {
  for (const e of Object.values(entries)) {
    const h = e && e.headache;
    if (!h) continue;
    if (h.impact === 'none') h.impact = 'carried_on';
    if (h.relief === 'none') h.relief = 'no_relief';
  }
  return entries;
}

export function normalize(raw) {
  const base = defaultState();
  if (!raw || typeof raw !== 'object') return base;
  const settings = applyTriggerUpdates({ ...base.settings, ...(raw.settings || {}) });
  // A saved state with no license field predates the paywall entirely, so
  // it is grandfathered in rather than suddenly locked out of a feature it
  // never had to pay for.
  const license = raw.license
    ? { ...base.license, ...raw.license }
    : { key: null, instanceId: null, valid: true, grandfathered: true };
  return {
    ...base,
    ...raw,
    profile: { ...base.profile, ...(raw.profile || {}) },
    settings,
    entries: migrateEntries(raw.entries && typeof raw.entries === 'object' ? raw.entries : {}),
    seenMilestones: Array.isArray(raw.seenMilestones) ? raw.seenMilestones : [],
    license,
  };
}

export function load() {
  try {
    return normalize(JSON.parse(localStorage.getItem(KEY)));
  } catch {
    return defaultState();
  }
}

export function save(state) {
  localStorage.setItem(KEY, JSON.stringify(state));
}

export function emptyEntry() {
  return {
    headache: { had: false, intensity: 5, type: '', onset: '', duration: '', locations: [], symptoms: [], meds: [], relief: '', impact: '' },
    period: 'none',
    stress: 0, // 1-5, 0 = not answered
    sleep: 0, // 1-5 quality
    sleepHours: '',
    mood: 0,
    triggers: [],
    meno: [],
    hrt: false,
    notes: '',
  };
}

const BACKUP_NUDGE_MIN_ENTRIES = 7; // not worth nagging before there's much to lose
const BACKUP_NUDGE_DAYS = 21;

// Whether it's time to gently remind the user to save a backup: there's
// something worth keeping, it's been a while (or never), and they haven't
// just asked to be left alone about it.
export function backupDue(state) {
  if (Object.keys(state.entries).length < BACKUP_NUDGE_MIN_ENTRIES) return false;
  if (state.backupSnoozedUntil && Date.now() < state.backupSnoozedUntil) return false;
  if (!state.lastBackupAt) return true;
  return Date.now() - state.lastBackupAt >= BACKUP_NUDGE_DAYS * 86400000;
}

const arraysEqual = (a, b) => a.length === b.length && a.every((v, i) => v === b[i]);

// If the medication list is still exactly one language's unmodified default
// set (nothing added or removed), swap it to the other language's defaults.
// Leaves a list the user has customised alone.
export function swapDefaultMeds(settings, lang) {
  const other = lang === 'nl' ? 'en' : 'nl';
  if (arraysEqual(settings.meds, DEFAULT_MEDS[other]) || arraysEqual(settings.meds, DEFAULT_MEDS[lang])) {
    return { ...settings, meds: [...DEFAULT_MEDS[lang]] };
  }
  return settings;
}

// Streak = consecutive checked-in days ending today or yesterday.
export function streaks(entries) {
  const dates = Object.keys(entries).sort();
  let best = 0, run = 0, prev = null;
  for (const d of dates) {
    run = prev && addDays(prev, 1) === d ? run + 1 : 1;
    best = Math.max(best, run);
    prev = d;
  }
  let current = 0;
  let cursor = entries[today()] ? today() : addDays(today(), -1);
  while (entries[cursor]) { current++; cursor = addDays(cursor, -1); }
  return { current, best, total: dates.length };
}
