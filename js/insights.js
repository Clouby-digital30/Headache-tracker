// Pattern recognition. Pure functions so they can be tested without a browser.
import { addDays, parseDate, toDateStr } from './store.js';
import { TRIPTAN_RE } from './data.js';
import { LOCALE } from './i18n.js';

// One decimal place, with the comma Dutch readers expect instead of a dot.
const fmt1 = (n, lang) => n.toLocaleString(LOCALE[lang] || 'en', { minimumFractionDigits: 1, maximumFractionDigits: 1 });

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

// ICHD-3's "perimenstrual" window for menstrual migraine is day -2 to +3
// relative to the first day of bleeding (day 1).
const PERIMENSTRUAL_RANGE = [-2, 3];

export function perimenstrualSet(entries) {
  const set = new Set();
  for (const s of periodStarts(entries)) {
    for (let o = PERIMENSTRUAL_RANGE[0]; o <= PERIMENSTRUAL_RANGE[1]; o++) set.add(addDays(s, o));
  }
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
  if (dates.length < MIN_DAYS) {
    return { ready: false, needed: MIN_DAYS - dates.length, risks: [], helpers: [], allById: new Map() };
  }

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
      let w = 0, wh = 0, o = 0, oh = 0, wMig = 0, oMig = 0, wIntensitySum = 0, oIntensitySum = 0;
      for (const d of dates) {
        const target = entries[addDays(d, lag)];
        if (!target) continue;
        const hh = hadHeadache(target);
        const intensity = hh ? Number(target.headache.intensity) || 0 : 0;
        const migraine = hh && target.headache.type === 'migraine';
        if (factors[d].has(id)) {
          w++;
          if (hh) { wh++; wIntensitySum += intensity; if (migraine) wMig++; }
        } else {
          o++;
          if (hh) { oh++; oIntensitySum += intensity; if (migraine) oMig++; }
        }
      }
      if (w < MIN_WITH || o < MIN_WITHOUT) continue;
      const withRate = wh / w, withoutRate = oh / o;
      const diff = withRate - withoutRate;
      if (!best || Math.abs(diff) > Math.abs(best.diff)) {
        best = {
          id, lag, withRate, withoutRate, diff, days: w, strong: w >= 8,
          // Descriptive extras about the *same* days already compared above,
          // not a separate test - so they add no further false-positive risk.
          migraineRateWith: wh ? wMig / wh : 0,
          migraineRateWithout: oh ? oMig / oh : 0,
          avgIntensityWith: wh ? wIntensitySum / wh : 0,
          avgIntensityWithout: oh ? oIntensitySum / oh : 0,
        };
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
  // Every factor's best lag, whether or not it cleared the risk/helper
  // threshold - lets a factor the user cares about always be looked up,
  // even to honestly say "no clear link yet".
  const allById = new Map(results.map((r) => [r.id, r]));
  return { ready: true, needed: 0, risks, helpers, allById };
}

const COMBO_MIN_DAYS_TOTAL = 56; // about 8 weeks, per the extra false-positive risk of testing pairs
const COMBO_MIN_BOTH = 8; // the stricter "consistent pattern" threshold, not the lighter single-factor one
const COMBO_DIFF = 0.15;

/**
 * Whether two factors occurring *together* associate with headaches more
 * than either does alone - e.g. night sweats and poor sleep. Only tests
 * pairs drawn from `candidateIds`, which the caller should restrict to
 * factors that already individually qualified as a risk: testing every
 * possible pair would multiply the chance of a coincidental result far more
 * than testing single factors already does.
 */
export function findCombinations(entries, candidateIds) {
  const dates = Object.keys(entries).sort();
  if (dates.length < COMBO_MIN_DAYS_TOTAL || candidateIds.length < 2) return [];
  const peri = perimenstrualSet(entries);
  const factors = {};
  for (const d of dates) factors[d] = dayFactors(entries, d, peri);

  const results = [];
  for (let i = 0; i < candidateIds.length; i++) {
    for (let j = i + 1; j < candidateIds.length; j++) {
      const a = candidateIds[i], b = candidateIds[j];
      let both = 0, bothH = 0, aOnly = 0, aOnlyH = 0, bOnly = 0, bOnlyH = 0, neither = 0, neitherH = 0;
      for (const d of dates) {
        const hasA = factors[d].has(a), hasB = factors[d].has(b);
        const hh = hadHeadache(entries[d]);
        if (hasA && hasB) { both++; if (hh) bothH++; } else if (hasA) { aOnly++; if (hh) aOnlyH++; }
        else if (hasB) { bOnly++; if (hh) bOnlyH++; } else { neither++; if (hh) neitherH++; }
      }
      if (both < COMBO_MIN_BOTH) continue;
      const bothRate = bothH / both;
      const aOnlyRate = aOnly ? aOnlyH / aOnly : 0;
      const bOnlyRate = bOnly ? bOnlyH / bOnly : 0;
      const neitherRate = neither ? neitherH / neither : 0;
      const higherAlone = Math.max(aOnlyRate, bOnlyRate);
      if (bothRate - higherAlone >= COMBO_DIFF) {
        results.push({ a, b, bothRate, aOnlyRate, bOnlyRate, neitherRate, days: both });
      }
    }
  }
  return results.sort((x, y) => y.bothRate - x.bothRate);
}

const PATTERN_SENTENCE = {
  en: (label, lag, withPct, withoutPct) => {
    const lead = lag === 0 ? `On days with ${label}, you had a headache`
      : lag === 1 ? `The day after ${label}, you had a headache`
        : `Two days after ${label}, you had a headache`;
    return `${lead} ${withPct}% of the time, compared with ${withoutPct}% otherwise.`;
  },
  nl: (label, lag, withPct, withoutPct) => {
    const lead = lag === 0 ? `Op dagen met ${label}` : lag === 1 ? `De dag na ${label}` : `Twee dagen na ${label}`;
    return `${lead} had je ${withPct}% van de keren hoofdpijn, tegenover ${withoutPct}% op andere dagen.`;
  },
};

export function describePattern(p, label, lang = 'en') {
  const sentence = PATTERN_SENTENCE[lang] || PATTERN_SENTENCE.en;
  return sentence(label, p.lag, Math.round(p.withRate * 100), Math.round(p.withoutRate * 100));
}

const ENRICH_MIGRAINE_DIFF = 0.15;
const ENRICH_INTENSITY_DIFF = 1;

const ENRICH_SENTENCE = {
  en: {
    migraine: (withPct, withoutPct) => `It was also more often migraine specifically: ${withPct}% of those headaches, compared with ${withoutPct}% otherwise.`,
    intensity: (withVal, withoutVal) => `Those headaches tended to be more intense too: ${withVal}/10 on average, compared with ${withoutVal}/10 otherwise.`,
  },
  nl: {
    migraine: (withPct, withoutPct) => `Het was ook vaker specifiek migraine: ${withPct}% van die hoofdpijndagen, tegenover ${withoutPct}% op andere dagen.`,
    intensity: (withVal, withoutVal) => `Die hoofdpijn was dan ook vaak heftiger: gemiddeld ${withVal}/10, tegenover ${withoutVal}/10 op andere dagen.`,
  },
};

// Extra sentences about a pattern already found by findPatterns - describing
// the same with/without days more fully (migraine specifically, intensity),
// not a new test, so it carries no extra coincidence risk of its own.
export function describeEnrichment(p, lang = 'en') {
  const s = ENRICH_SENTENCE[lang] || ENRICH_SENTENCE.en;
  const out = [];
  if (p.migraineRateWith - p.migraineRateWithout >= ENRICH_MIGRAINE_DIFF) {
    out.push(s.migraine(Math.round(p.migraineRateWith * 100), Math.round(p.migraineRateWithout * 100)));
  }
  if (p.avgIntensityWith - p.avgIntensityWithout >= ENRICH_INTENSITY_DIFF) {
    out.push(s.intensity(fmt1(p.avgIntensityWith, lang), fmt1(p.avgIntensityWithout, lang)));
  }
  return out;
}

const COMBO_SENTENCE = {
  en: (labelA, labelB, bothPct, alonePct) =>
    `On days with both ${labelA} and ${labelB}, you had a headache ${bothPct}% of the time, higher than with just one of the two (${alonePct}%).`,
  nl: (labelA, labelB, bothPct, alonePct) =>
    `Op dagen met zowel ${labelA} als ${labelB} had je ${bothPct}% van de keren hoofdpijn, hoger dan met maar één van de twee (${alonePct}%).`,
};

export function describeCombination(c, labelA, labelB, lang = 'en') {
  const sentence = COMBO_SENTENCE[lang] || COMBO_SENTENCE.en;
  const alonePct = Math.round(Math.max(c.aOnlyRate, c.bOnlyRate) * 100);
  return sentence(labelA, labelB, Math.round(c.bothRate * 100), alonePct);
}

// Totals for a date range (inclusive).
export function summarize(entries, from, to) {
  const s = {
    logged: 0, headacheDays: 0, migraineDays: 0, auraDays: 0, medDays: 0, periodDays: 0, intensitySum: 0, restDays: 0,
    stressSum: 0, stressAnswered: 0, sleepSum: 0, sleepAnswered: 0,
  };
  for (const d of Object.keys(entries)) {
    if (d < from || d > to) continue;
    const e = entries[d];
    s.logged++;
    if (isBleed(e)) s.periodDays++;
    if (e.stress > 0) { s.stressSum += e.stress; s.stressAnswered++; }
    if (e.sleep > 0) { s.sleepSum += e.sleep; s.sleepAnswered++; }
    if (!hadHeadache(e)) continue;
    s.headacheDays++;
    s.intensitySum += Number(e.headache.intensity) || 0;
    if (e.headache.type === 'migraine') s.migraineDays++;
    if ((e.headache.symptoms || []).includes('aura')) s.auraDays++;
    if ((e.headache.meds || []).length) s.medDays++;
    if (e.headache.impact === 'rest') s.restDays++;
  }
  s.avgIntensity = s.headacheDays ? s.intensitySum / s.headacheDays : 0;
  s.avgStress = s.stressAnswered ? s.stressSum / s.stressAnswered : 0;
  s.avgSleep = s.sleepAnswered ? s.sleepSum / s.sleepAnswered : 0;
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
    // `month` (0-based) and `year` let the caller format the label in its own language.
    out.push({ key, month: m.getMonth(), year: m.getFullYear(), headacheDays, logged });
  }
  return out;
}

// Headache days by day of the week. `index` is 0 (Monday) to 6 (Sunday); the
// caller formats the weekday name in its own language.
export function byWeekday(entries, from, to) {
  const out = Array.from({ length: 7 }, (_, index) => ({ index, headacheDays: 0, logged: 0 }));
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

const isTriptanDay = (e) => (e?.headache?.meds || []).some((m) => TRIPTAN_RE.test(m));
const isSimpleMedDay = (e) => (e?.headache?.meds || []).some((m) => !TRIPTAN_RE.test(m));

// Days of triptan use vs. simple-analgesic use in a range. Kept separate
// because medication-overuse headache uses different thresholds per class
// (commonly: triptans/combination analgesics 10+ days/month, simple
// analgesics such as paracetamol or NSAIDs 15+ days/month, for 3+ months).
export function medClassSummary(entries, from, to) {
  let triptanDays = 0, simpleDays = 0;
  for (const d of Object.keys(entries)) {
    if (d < from || d > to) continue;
    const e = entries[d];
    if (!hadHeadache(e)) continue;
    if (isTriptanDay(e)) triptanDays++;
    if (isSimpleMedDay(e)) simpleDays++;
  }
  return { triptanDays, simpleDays };
}

// Same split, as a monthly average over the last 90 days, each against its
// own overuse threshold.
export function medOveruseByClass(entries, endStr) {
  const { triptanDays, simpleDays } = medClassSummary(entries, addDays(endStr, -89), endStr);
  const triptanPerMonth = triptanDays / 3, simplePerMonth = simpleDays / 3;
  return {
    triptan: { days: triptanDays, perMonth: triptanPerMonth, flag: triptanPerMonth >= 10 },
    simple: { days: simpleDays, perMonth: simplePerMonth, flag: simplePerMonth >= 15 },
  };
}

// Triptan and simple-analgesic days per calendar month, oldest first, for
// the last `count` months - the shape a doctor can scan at a glance.
export function medClassByMonth(entries, count, endStr) {
  const end = parseDate(endStr);
  const out = [];
  for (let i = count - 1; i >= 0; i--) {
    const m = new Date(end.getFullYear(), end.getMonth() - i, 1, 12);
    const key = toDateStr(m).slice(0, 7);
    const from = `${key}-01`, to = `${key}-31`;
    const { triptanDays, simpleDays } = medClassSummary(entries, from, to);
    out.push({ key, month: m.getMonth(), year: m.getFullYear(), triptanDays, simpleDays });
  }
  return out;
}

// Of the last `count` menstrual cycles, how many had a migraine (not just
// any headache) in the perimenstrual window - the ICHD-3 question behind
// "menstrual migraine". A cycle only counts toward the total once there is
// at least one logged day in its window, so missing data isn't read as "no".
export function menstrualMigraineStat(entries, count = 3) {
  const starts = periodStarts(entries).slice(-count);
  let checked = 0, withMigraine = 0;
  for (const start of starts) {
    let logged = false, migraine = false;
    for (let o = PERIMENSTRUAL_RANGE[0]; o <= PERIMENSTRUAL_RANGE[1]; o++) {
      const e = entries[addDays(start, o)];
      if (!e) continue;
      logged = true;
      if (hadHeadache(e) && e.headache.type === 'migraine') migraine = true;
    }
    if (!logged) continue;
    checked++;
    if (migraine) withMigraine++;
  }
  return { checked, withMigraine };
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

// HRT days and how often each menopause symptom was logged, over a range -
// the detail a doctor report needs that a trigger-focused summary doesn't
// give. avgSeverity is 1 (light) to 3 (severe); entries saved before severity
// existed default to 2 (moderate) rather than being left out.
export function menoSymptomCounts(entries, from, to) {
  const counts = new Map(); // id -> { count, severitySum }
  let days = 0, hrtDays = 0;
  for (const d of Object.keys(entries)) {
    if (d < from || d > to) continue;
    days++;
    const e = entries[d];
    if (e.hrt) hrtDays++;
    for (const m of e.meno || []) {
      const entry = counts.get(m) || { count: 0, severitySum: 0 };
      entry.count++;
      entry.severitySum += (e.menoSeverity && e.menoSeverity[m]) || 2;
      counts.set(m, entry);
    }
  }
  const items = [...counts.entries()]
    .map(([id, v]) => ({ id, count: v.count, avgSeverity: v.severitySum / v.count }))
    .sort((a, b) => b.count - a.count || a.id.localeCompare(b.id));
  return { days, hrtDays, items };
}

// How many weeks of check-ins exist up to `endStr`, from the very first one.
// Used to frame how close a tracking history is to the ~8 weeks doctors
// generally find most useful for spotting a pattern.
export function trackingSpanWeeks(entries, endStr) {
  const dates = Object.keys(entries).sort();
  if (!dates.length) return 0;
  return Math.max(0, Math.round((parseDate(endStr) - parseDate(dates[0])) / (7 * 86400000)));
}

// How many logged days have included this medication since it was last
// marked "refilled" (or ever, if never reset) - a day-level proxy for dose
// count, since Clary tracks whether a medication was taken each day, not
// exact quantities.
export function medDaysSinceRefill(entries, medName, sinceDate) {
  let n = 0;
  for (const d of Object.keys(entries)) {
    if (sinceDate && d <= sinceDate) continue;
    if ((entries[d]?.headache?.meds || []).includes(medName)) n++;
  }
  return n;
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
