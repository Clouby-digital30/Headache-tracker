// Local-only persistence. Everything lives in localStorage on this device.
import { DEFAULT_TRIGGERS, DEFAULT_MEDS } from './data.js';

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
      theme: 'auto', // 'auto' | 'light' | 'dark'
      reminderOn: false,
      reminderTime: '20:00',
      trackedTriggers: [...DEFAULT_TRIGGERS],
      customTriggers: [], // [{id, label}]
      meds: [...DEFAULT_MEDS],
      usesHrt: false,
      trackMeno: true,
    },
    entries: {}, // 'YYYY-MM-DD' -> entry
    seenMilestones: [],
  };
}

export function normalize(raw) {
  const base = defaultState();
  if (!raw || typeof raw !== 'object') return base;
  return {
    ...base,
    ...raw,
    profile: { ...base.profile, ...(raw.profile || {}) },
    settings: { ...base.settings, ...(raw.settings || {}) },
    entries: raw.entries && typeof raw.entries === 'object' ? raw.entries : {},
    seenMilestones: Array.isArray(raw.seenMilestones) ? raw.seenMilestones : [],
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
    headache: { had: false, intensity: 5, type: '', duration: '', locations: [], symptoms: [], meds: [], relief: '', impact: '' },
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
