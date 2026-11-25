import { test } from 'node:test';
import assert from 'node:assert/strict';
import { addDays, emptyEntry } from '../js/store.js';
import {
  findPatterns, describePattern, describeEnrichment, describeCombination, findCombinations,
  periodStarts, summarize, monthly, cycleInsight, mostLogged, medOveruse,
  perimenstrualSet, medClassSummary, medOveruseByClass, medClassByMonth, menstrualMigraineStat,
  menoSymptomCounts, trackingSpanWeeks, medDaysSinceRefill,
} from '../js/insights.js';

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

test('estimates the next period from recent cycle lengths', () => {
  const entries = build(100, (e, i) => { if (i % 28 < 5) e.period = 'medium'; });
  const c = cycleInsight(entries, addDays('2026-01-01', 99));
  assert.ok(c);
  assert.equal(c.cycleCount, 3); // 4 periods logged, 3 gaps between them
  assert.equal(c.avgLength, 28);
  assert.equal(c.lastStart, addDays('2026-01-01', 84));
  assert.equal(c.nextEstimate, addDays('2026-01-01', 112));
  assert.equal(c.daysUntil, 13);
  assert.equal(c.regular, true);
});

test('cycle estimate needs at least two periods', () => {
  const entries = build(20, (e, i) => { if (i < 5) e.period = 'medium'; });
  assert.equal(cycleInsight(entries, addDays('2026-01-01', 19)), null);
});

test('widens the range after irregular cycles', () => {
  // Cycle lengths of 21, 35 and 28 days: noticeably uneven.
  const starts = [0, 21, 56, 84];
  const entries = build(95, (e, i) => { if (starts.some((s) => i >= s && i < s + 4)) e.period = 'medium'; });
  const c = cycleInsight(entries, addDays('2026-01-01', 94));
  assert.equal(c.regular, false);
  assert.ok(c.spread > 3);
});

test('counts the triggers and menopause symptoms logged in a range', () => {
  const entries = build(10, (e, i) => {
    if (i % 2 === 0) e.triggers.push('red_wine');
    if (i % 3 === 0) e.meno.push('hot_flash');
  });
  const r = mostLogged(entries, '2026-01-01', addDays('2026-01-01', 9));
  assert.equal(r.days, 10);
  assert.equal(r.items.find((x) => x.id === 'red_wine').count, 5);
  assert.equal(r.items.find((x) => x.id === 'hot_flash').count, 4);
});

test('flags frequent pain relief averaged over three months', () => {
  const heavy = build(90, (e, i) => {
    if (i < 30) { e.headache.had = true; e.headache.meds = ['Ibuprofen']; }
  });
  const flagged = medOveruse(heavy, addDays('2026-01-01', 89));
  assert.equal(flagged.perMonth, 10);
  assert.equal(flagged.flag, true);

  const light = build(90, (e, i) => {
    if (i < 12) { e.headache.had = true; e.headache.meds = ['Ibuprofen']; }
  });
  const ok = medOveruse(light, addDays('2026-01-01', 89));
  assert.equal(ok.flag, false);
});

test('describes a pattern in Dutch when asked', () => {
  const p = { lag: 1, withRate: 1, withoutRate: 0 };
  assert.equal(describePattern(p, 'hoge stress', 'nl'), 'De dag na hoge stress had je 100% van de keren hoofdpijn, tegenover 0% op andere dagen.');
  // default stays English, unaffected by the new optional argument
  assert.equal(describePattern(p, 'high stress'), 'The day after high stress, you had a headache 100% of the time, compared with 0% otherwise.');
});

test('perimenstrual window runs from 2 days before to 3 days after (ICHD-3)', () => {
  const entries = build(10, (e, i) => { if (i === 5) e.period = 'medium'; });
  const start = addDays('2026-01-01', 5);
  const set = perimenstrualSet(entries);
  assert.ok(set.has(addDays(start, -2)));
  assert.ok(set.has(addDays(start, 3)));
  assert.ok(!set.has(addDays(start, -3)));
  assert.ok(!set.has(addDays(start, 4)));
});

test('counts aura days', () => {
  const entries = build(5, (e, i) => {
    if (i < 3) { e.headache.had = true; e.headache.symptoms = i === 0 ? ['aura'] : []; }
  });
  const s = summarize(entries, '2026-01-01', addDays('2026-01-01', 4));
  assert.equal(s.headacheDays, 3);
  assert.equal(s.auraDays, 1);
});

test('splits medication days into triptan and simple classes', () => {
  const entries = build(10, (e, i) => {
    if (i < 4) { e.headache.had = true; e.headache.meds = ['Sumatriptan 50mg']; }
    if (i >= 4 && i < 7) { e.headache.had = true; e.headache.meds = ['Ibuprofen']; }
    if (i === 7) { e.headache.had = true; e.headache.meds = ['Triptaan', 'Paracetamol']; } // counts toward both
  });
  const c = medClassSummary(entries, '2026-01-01', addDays('2026-01-01', 9));
  assert.equal(c.triptanDays, 5); // days 0-3 and 7
  assert.equal(c.simpleDays, 4); // days 4-6 and 7
});

test('flags triptan overuse from 10 days/month, simple analgesics from 15', () => {
  const triptanHeavy = build(90, (e, i) => {
    if (i < 30) { e.headache.had = true; e.headache.meds = ['Rizatriptan']; } // 10/month
  });
  const t = medOveruseByClass(triptanHeavy, addDays('2026-01-01', 89));
  assert.equal(t.triptan.flag, true);
  assert.equal(t.simple.flag, false);

  const simpleHeavy = build(90, (e, i) => {
    if (i < 46) { e.headache.had = true; e.headache.meds = ['Ibuprofen']; } // ~15.3/month
  });
  const sim = medOveruseByClass(simpleHeavy, addDays('2026-01-01', 89));
  assert.equal(sim.simple.flag, true);
  assert.equal(sim.triptan.flag, false);
});

test('medClassByMonth breaks triptan/simple days down per calendar month', () => {
  const entries = build(31, (e, i) => {
    if (i < 5) { e.headache.had = true; e.headache.meds = ['Sumatriptan']; }
    if (i >= 5 && i < 8) { e.headache.had = true; e.headache.meds = ['Naproxen']; }
  });
  const months = medClassByMonth(entries, 1, '2026-01-31');
  assert.equal(months[0].triptanDays, 5);
  assert.equal(months[0].simpleDays, 3);
});

test('menstrualMigraineStat counts migraines in the perimenstrual window per cycle', () => {
  // 3 cycles, 28 days apart; migraine on day 0 of cycles 1 and 3 only.
  const entries = build(90, (e, i) => {
    const cyc = i % 28;
    if (cyc < 3) e.period = 'medium';
    const cycleIndex = Math.floor(i / 28);
    if (cyc === 0 && cycleIndex !== 1) { e.headache.had = true; e.headache.type = 'migraine'; }
    if (cyc === 0 && cycleIndex === 1) { e.headache.had = true; e.headache.type = 'tension'; } // not migraine
  });
  const stat = menstrualMigraineStat(entries, 3);
  assert.equal(stat.checked, 3);
  assert.equal(stat.withMigraine, 2);
});

test('counts HRT days and menopause symptoms separately from triggers', () => {
  const entries = build(10, (e, i) => {
    if (i < 6) e.hrt = true;
    if (i % 2 === 0) e.meno.push('hot_flash');
    if (i === 0) e.triggers.push('red_wine'); // must not leak into the meno count
  });
  const r = menoSymptomCounts(entries, '2026-01-01', addDays('2026-01-01', 9));
  assert.equal(r.days, 10);
  assert.equal(r.hrtDays, 6);
  assert.equal(r.items.length, 1);
  assert.equal(r.items[0].id, 'hot_flash');
  assert.equal(r.items[0].count, 5);
  assert.equal(r.items[0].avgSeverity, 2); // defaults to moderate when no severity was recorded
});

test('averages recorded menopause-symptom severity, defaulting old entries to moderate', () => {
  const entries = build(4, (e, i) => {
    e.meno.push('night_sweats');
    if (i < 2) e.menoSeverity = { night_sweats: 3 }; // severe
    // the other two entries have no menoSeverity at all - as if saved before it existed
  });
  const r = menoSymptomCounts(entries, '2026-01-01', addDays('2026-01-01', 3));
  assert.equal(r.items[0].count, 4);
  assert.equal(r.items[0].avgSeverity, (3 + 3 + 2 + 2) / 4);
});

test('tracking span is 0 with no entries and counts weeks from the first one', () => {
  assert.equal(trackingSpanWeeks({}, '2026-01-01'), 0);
  const entries = build(1, () => {}); // a single entry on 2026-01-01
  assert.equal(trackingSpanWeeks(entries, addDays('2026-01-01', 56)), 8);
});

test('findPatterns also reports migraine rate and intensity for the same days', () => {
  const entries = build(60, (e, i) => {
    if (i % 5 === 0) {
      e.triggers.push('red_wine');
      e.headache.had = true; e.headache.type = 'migraine'; e.headache.intensity = 9;
    } else if (i % 6 === 0) {
      e.headache.had = true; e.headache.type = 'tension'; e.headache.intensity = 4;
    }
  });
  const pat = findPatterns(entries);
  const p = pat.allById.get('red_wine');
  assert.ok(p, 'red_wine should be in allById even though it also clears the risk threshold');
  assert.equal(p.migraineRateWith, 1);
  assert.equal(p.migraineRateWithout, 0);
  assert.equal(p.avgIntensityWith, 9);
  assert.equal(p.avgIntensityWithout, 4);
  const extra = describeEnrichment(p, 'en');
  assert.equal(extra.length, 2);
  assert.match(extra[0], /more often migraine specifically: 100%/);
  assert.match(extra[1], /more intense too: 9\.0\/10/);
  // Dutch readers expect a comma, not a dot, as the decimal separator.
  const extraNl = describeEnrichment(p, 'nl');
  assert.match(extraNl[1], /heftiger[\s\S]*4,0\/10/);
  assert.doesNotMatch(extraNl[1], /9\.0|4\.0/);
});

test('allById finds a factor even when it never clears the risk threshold', () => {
  // A trigger logged on just enough days, with no real relationship to headaches.
  const entries = build(20, (e, i) => {
    if (i % 3 === 0) e.triggers.push('tired');
    e.headache.had = i % 2 === 0; // unrelated to 'tired'
  });
  const pat = findPatterns(entries);
  assert.ok(!pat.risks.some((r) => r.id === 'tired'));
  assert.ok(pat.allById.has('tired'), 'should still be looked-up-able for a favourite symptom card');
});

test('findCombinations surfaces a pair that is worse together than apart', () => {
  const entries = build(60, (e, i) => {
    if (i < 10) { // both triggers present
      e.triggers.push('tired', 'busy');
      e.headache.had = i < 9; // 9 of 10
    } else if (i < 20) { // 'tired' only
      e.triggers.push('tired');
      e.headache.had = i < 13; // 3 of 10
    } else if (i < 30) { // 'busy' only
      e.triggers.push('busy');
      e.headache.had = i < 23; // 3 of 10
    } else { // neither (30 days)
      e.headache.had = i < 33; // 3 of 30
    }
  });
  const combos = findCombinations(entries, ['tired', 'busy']);
  assert.equal(combos.length, 1);
  const c = combos[0];
  assert.equal(c.days, 10);
  assert.equal(c.bothRate, 0.9);
  assert.ok(Math.abs(c.aOnlyRate - 0.3) < 1e-9);
  assert.ok(Math.abs(c.bOnlyRate - 0.3) < 1e-9);
  assert.match(describeCombination(c, 'tired', 'busy', 'en'), /90% of the time, higher than with just one of the two \(30%\)/);
});

test('findCombinations needs about 8 weeks of data and at least 2 candidates', () => {
  const short = build(30, (e, i) => { if (i < 10) { e.triggers.push('tired', 'busy'); e.headache.had = true; } });
  assert.deepEqual(findCombinations(short, ['tired', 'busy']), []);
  const long = build(60, () => {});
  assert.deepEqual(findCombinations(long, ['tired']), []);
});

test('medDaysSinceRefill counts logged days for one medication, optionally since a reset date', () => {
  const entries = build(10, (e, i) => {
    e.headache.had = true;
    e.headache.meds = i % 2 === 0 ? ['Ibuprofen'] : ['Paracetamol'];
  });
  assert.equal(medDaysSinceRefill(entries, 'Ibuprofen', undefined), 5);
  assert.equal(medDaysSinceRefill(entries, 'Paracetamol', undefined), 5);
  assert.equal(medDaysSinceRefill(entries, 'Aspirin', undefined), 0);
  // Only days strictly after the reset date count.
  const sinceDate = addDays('2026-01-01', 5); // day index 5
  assert.equal(medDaysSinceRefill(entries, 'Ibuprofen', sinceDate), 2); // indices 6 and 8
});
