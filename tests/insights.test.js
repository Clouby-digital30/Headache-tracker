import { test } from 'node:test';
import assert from 'node:assert/strict';
import { addDays, emptyEntry } from '../js/store.js';
import { findPatterns, describePattern, periodStarts, summarize, monthly } from '../js/insights.js';

function build(days, fn) {
  const entries = {};
  for (let i = 0; i < days; i++) {
    const date = addDays('2026-01-01', i);
    const e = emptyEntry();
    fn(e, i);
    entries[date] = e;
  }
  return entries;
}

test('needs two weeks of data before reporting', () => {
  const r = findPatterns(build(10, () => {}));
  assert.equal(r.ready, false);
  assert.equal(r.needed, 4);
});

test('finds a next-day headache after high stress', () => {
  // Stress every 4th day, headache always the day after.
  const entries = build(60, (e, i) => {
    if (i % 4 === 0) e.stress = 5; else e.stress = 2;
    if (i % 4 === 1) { e.headache.had = true; e.headache.intensity = 6; }
  });
  const r = findPatterns(entries);
  const p = r.risks.find((x) => x.id === 'stress_high');
  assert.ok(p, 'stress pattern found');
  assert.equal(p.lag, 1);
  assert.equal(p.withRate, 1);
  assert.equal(p.withoutRate, 0);
  assert.match(describePattern(p, 'high stress'), /^The day after high stress, you had a headache 100% of the time, compared with 0% otherwise\.$/);
});

test('finds a same-day trigger and ignores unrelated ones', () => {
  const entries = build(40, (e, i) => {
    if (i % 5 === 0) { e.triggers.push('red_wine'); e.headache.had = true; }
    if (i % 2 === 0) e.triggers.push('chocolate'); // half the days, unrelated
  });
  const r = findPatterns(entries);
  const wine = r.risks.find((x) => x.id === 'red_wine');
  assert.equal(wine.lag, 0);
  assert.ok(!r.risks.some((x) => x.id === 'chocolate'));
});

test('links headaches to the start of a period', () => {
  const entries = build(90, (e, i) => {
    const day = i % 28;
    if (day < 5) e.period = 'medium';
    if (day === 0 || day === 1) e.headache.had = true;
  });
  assert.equal(periodStarts(entries).length, 4);
  const r = findPatterns(entries);
  assert.ok(r.risks.some((x) => x.id === 'perimenstrual'));
});

test('skips gaps: the next day must be logged to count', () => {
  const entries = build(30, (e, i) => { if (i % 3 === 0) e.triggers.push('alcohol'); });
  // remove every day after alcohol, so lag 1 has no evidence at all
  for (let i = 1; i < 30; i += 3) delete entries[addDays('2026-01-01', i)];
  const r = findPatterns(entries);
  assert.equal(r.risks.length, 0);
});

test('summaries and monthly totals', () => {
  const entries = build(31, (e, i) => {
    if (i < 4) { e.headache.had = true; e.headache.intensity = 8; e.headache.type = 'migraine'; e.headache.meds = ['Triptan']; }
  });
  const s = summarize(entries, '2026-01-01', '2026-01-31');
  assert.deepEqual([s.logged, s.headacheDays, s.migraineDays, s.medDays, s.avgIntensity], [31, 4, 4, 4, 8]);
  const m = monthly(entries, 2, '2026-01-31');
  assert.equal(m[1].headacheDays, 4);
  assert.equal(m[0].logged, 0);
});
