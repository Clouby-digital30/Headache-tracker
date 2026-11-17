// Pattern recognition. Pure functions so they can be tested without a browser.
import { addDays, parseDate, toDateStr } from './store.js';

const isBleed = (e) => e && e.period && e.period !== 'none' && e.period !== 'spotting';
const hadHeadache = (e) => !!(e && e.headache && e.headache.had);

// First day of each period: a bleeding day not preceded by one.
export function periodStarts(entries) {
  return Object.keys(entries).sort().filter((d) => isBleed(entries[d]) && !isBleed(entries[addDays(d, -1)]));
}

// Everything that was "true" about a day and could relate to a headache.
export function dayFactors(entries, date, perimenstrualDays) {
  const e = entries[date];
  const f = new Set(e.triggers || []);
  (e.meno || []).forEach((m) => f.add(m));
  if (isBleed(e)) f.add('period');
  if (perimenstrualDays.has(date)) f.add('perimenstrual');
  if (e.stress >= 4) f.add('stress_high');
  if (e.sleep > 0 && e.sleep <= 2) f.add('sleep_poor');
  if (e.hrt) f.add('hrt_taken');
  return f;
}

export function perimenstrualSet(entries) {
  const set = new Set();
  for (const s of periodStarts(entries)) for (let o = -2; o <= 2; o++) set.add(addDays(s, o));
  return set;
}

const MIN_DAYS = 14;
const MIN_WITH = 4;
const MIN_WITHOUT = 5;
const SAME_DAY_ONLY = new Set(['period', 'perimenstrual']);

/**
 * Compares how often a headache follows each factor (same day, next day, two
 * days later) with how often it happens otherwise. Returns the strongest lag
 * per factor, sorted by strength.
 */
export function findPatterns(entries) {
  const dates = Object.keys(entries).sort();
  if (dates.length < MIN_DAYS) return { ready: false, needed: MIN_DAYS - dates.length, risks: [], helpers: [] };

  const peri = perimenstrualSet(entries);
  const factors = {};
  const all = new Set();
  for (const d of dates) {
    factors[d] = dayFactors(entries, d, peri);
    factors[d].forEach((x) => all.add(x));
  }

  const results = [];
  for (const id of all) {
    let best = null;
    // Cycle factors already describe a window of days, so only compare the same day.
    for (const lag of SAME_DAY_ONLY.has(id) ? [0] : [0, 1, 2]) {
      let w = 0, wh = 0, o = 0, oh = 0;
      for (const d of dates) {
        const target = entries[addDays(d, lag)];
        if (!target) continue;
        if (factors[d].has(id)) { w++; if (hadHeadache(target)) wh++; }
        else { o++; if (hadHeadache(target)) oh++; }
      }
      if (w < MIN_WITH || o < MIN_WITHOUT) continue;
      const withRate = wh / w, withoutRate = oh / o;
      const diff = withRate - withoutRate;
      if (!best || Math.abs(diff) > Math.abs(best.diff)) {
        best = { id, lag, withRate, withoutRate, diff, days: w, strong: w >= 8 };
      }
    }
    if (best) results.push(best);
  }

  const risks = results
    .filter((r) => r.diff >= 0.15 && r.withRate >= 1.5 * r.withoutRate)
    .sort((a, b) => b.diff - a.diff);
  const helpers = results
    .filter((r) => r.diff <= -0.15 && r.withRate <= 0.6 * r.withoutRate)
    .sort((a, b) => a.diff - b.diff);
  return { ready: true, needed: 0, risks, helpers };
}

export function describePattern(p, label) {
  const pct = (x) => `${Math.round(x * 100)}%`;
  const when = p.lag === 0
    ? `On days with ${label}, you had a headache`
    : p.lag === 1
      ? `The day after ${label}, you had a headache`
      : `Two days after ${label}, you had a headache`;
  return `${when} ${pct(p.withRate)} of the time, compared with ${pct(p.withoutRate)} otherwise.`;
}

// Totals for a date range (inclusive).
export function summarize(entries, from, to) {
  const s = { logged: 0, headacheDays: 0, migraineDays: 0, medDays: 0, periodDays: 0, intensitySum: 0, restDays: 0 };
  for (const d of Object.keys(entries)) {
    if (d < from || d > to) continue;
    const e = entries[d];
    s.logged++;
    if (isBleed(e)) s.periodDays++;
    if (!hadHeadache(e)) continue;
    s.headacheDays++;
    s.intensitySum += Number(e.headache.intensity) || 0;
    if (e.headache.type === 'migraine') s.migraineDays++;
    if ((e.headache.meds || []).length) s.medDays++;
    if (e.headache.impact === 'rest') s.restDays++;
  }
  s.avgIntensity = s.headacheDays ? s.intensitySum / s.headacheDays : 0;
  return s;
}

// Headache days per calendar month, oldest first, for the last `count` months.
export function monthly(entries, count, endStr) {
  const end = parseDate(endStr);
  const out = [];
  for (let i = count - 1; i >= 0; i--) {
    const m = new Date(end.getFullYear(), end.getMonth() - i, 1, 12);
    const key = toDateStr(m).slice(0, 7);
    let headacheDays = 0, logged = 0;
    for (const d of Object.keys(entries)) {
      if (!d.startsWith(key)) continue;
      logged++;
      if (hadHeadache(entries[d])) headacheDays++;
    }
    out.push({ key, label: m.toLocaleString('en', { month: 'short' }), year: m.getFullYear(), headacheDays, logged });
  }
  return out;
}

// Headache days by day of the week (Mon..Sun).
export function byWeekday(entries, from, to) {
  const names = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const out = names.map((label) => ({ label, headacheDays: 0, logged: 0 }));
  for (const d of Object.keys(entries)) {
    if (d < from || d > to) continue;
    const slot = out[(parseDate(d).getDay() + 6) % 7];
    slot.logged++;
    if (hadHeadache(entries[d])) slot.headacheDays++;
  }
  return out;
}

// Days with pain medication in the 30 days up to `endStr`.
export function medDaysLast30(entries, endStr) {
  return summarize(entries, addDays(endStr, -29), endStr).medDays;
}

// Pain-relief frequency over the last 90 days, as a monthly average. A rolling
// window reads as "worth a conversation" earlier than waiting for a single bad month.
export function medOveruse(entries, endStr) {
  const { medDays } = summarize(entries, addDays(endStr, -89), endStr);
  const perMonth = medDays / 3;
  return { medDays, perMonth, flag: perMonth >= 10 };
}

const MIN_CYCLES = 2;
const PLAUSIBLE_CYCLE = [14, 60]; // days; outside this, a gap is probably a logging gap, not a real cycle

// Estimates the next period from the length of recent cycles. Perimenopause
// cycles vary, so this is framed as a range, not a date, and widens when the
// user's own history has been irregular.
export function cycleInsight(entries, todayStr) {
  const starts = periodStarts(entries);
  if (starts.length < MIN_CYCLES) return null;

  const recent = starts.slice(-7); // up to the last 6 gaps
  const lengths = [];
  for (let i = 1; i < recent.length; i++) {
    lengths.push(Math.round((parseDate(recent[i]) - parseDate(recent[i - 1])) / 86400000));
  }
  const plausible = lengths.filter((n) => n >= PLAUSIBLE_CYCLE[0] && n <= PLAUSIBLE_CYCLE[1]);
  const used = plausible.length ? plausible : lengths;
  if (!used.length) return null;

  const avg = used.reduce((a, b) => a + b, 0) / used.length;
  const variance = used.reduce((a, b) => a + (b - avg) ** 2, 0) / used.length;
  const spreadFloor = used.length < 3 ? 4 : 2; // low confidence with few cycles: widen the range
  const spread = Math.max(spreadFloor, Math.round(Math.sqrt(variance)));

  const last = recent[recent.length - 1];
  const avgLength = Math.round(avg);
  const nextEstimate = addDays(last, avgLength);
  const daysUntil = Math.round((parseDate(nextEstimate) - parseDate(todayStr)) / 86400000);

  return {
    lastStart: last,
    cycleCount: used.length,
    avgLength,
    spread,
    nextEstimate,
    earliest: addDays(nextEstimate, -spread),
    latest: addDays(nextEstimate, spread),
    daysUntil,
    regular: spread <= 3,
  };
}

// How often each already-chosen trigger or menopause symptom was logged, over
// a range. Purely descriptive (counts), unlike findPatterns which compares
// outcomes - useful from day one, before there is enough data for a pattern.
export function mostLogged(entries, from, to, n = 6) {
  const counts = new Map();
  let days = 0;
  for (const d of Object.keys(entries)) {
    if (d < from || d > to) continue;
    days++;
    const e = entries[d];
    for (const t of e.triggers || []) counts.set(t, (counts.get(t) || 0) + 1);
    for (const m of e.meno || []) counts.set(m, (counts.get(m) || 0) + 1);
  }
  const items = [...counts.entries()]
    .map(([id, count]) => ({ id, count }))
    .sort((a, b) => b.count - a.count || a.id.localeCompare(b.id))
    .slice(0, n);
  return { days, items };
}
