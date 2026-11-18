import {
  TRIGGER_GROUPS, PERIOD_LEVELS, HEADACHE_TYPES, DURATIONS, LOCATIONS, HEADACHE_SYMPTOMS, IMPACT, RELIEF,
  MENO_SYMPTOMS, STAGES, DERIVED_LABELS, MILESTONES, SPECIES, CARDS,
} from './data.js';
import { load, save, today, addDays, parseDate, toDateStr, emptyEntry, streaks, defaultState, normalize, backupDue } from './store.js';
import {
  findPatterns, describePattern, summarize, monthly, byWeekday, medDaysLast30, medOveruse, cycleInsight, mostLogged,
} from './insights.js';
import { gardenScene, flower, speciesFor } from './garden.js';
import { barChart, compareBars, rankList } from './charts.js';
import { download, toCsv } from './export.js';
import * as reminders from './reminders.js';

let state = load();
save(state); // persist any one-time migration (e.g. a newly introduced trigger) right away
const ui = {
  view: 'today',
  draft: null, draftDate: null, draftIsNew: false, showMore: false,
  month: today().slice(0, 7),
  range: 90,
  reward: null,
  showLibrary: false,
};

// Applies the chosen theme before first paint, and again whenever it changes.
function applyTheme() {
  const t = state.settings.theme;
  document.documentElement.dataset.theme = t === 'auto' ? '' : t;
  const dark = t === 'dark' || (t === 'auto' && matchMedia('(prefers-color-scheme: dark)').matches);
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', dark ? '#1E1B19' : '#FAF5EE');
}
applyTheme();
matchMedia('(prefers-color-scheme: dark)').addEventListener?.('change', () => { if (state.settings.theme === 'auto') applyTheme(); });

const $view = document.getElementById('view');
const $nav = document.getElementById('nav');
const $modal = document.getElementById('modal');
const $tip = document.getElementById('tip');

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// ---------- labels ----------
const LABELS = new Map();
for (const g of TRIGGER_GROUPS) for (const [id, label] of g.items) LABELS.set(id, label);
for (const list of [PERIOD_LEVELS, HEADACHE_TYPES, DURATIONS, LOCATIONS, HEADACHE_SYMPTOMS, IMPACT, RELIEF, MENO_SYMPTOMS]) {
  for (const [id, label] of list) LABELS.set(id, label);
}
function labelOf(id) {
  if (!id) return '';
  const custom = state.settings.customTriggers.find((t) => t.id === id);
  return custom ? custom.label : LABELS.get(id) || id;
}
const factorPhrase = (id) => DERIVED_LABELS[id] || `“${labelOf(id)}”`;

const niceDate = (str, opts = { weekday: 'long', day: 'numeric', month: 'long' }) => parseDate(str).toLocaleDateString('en', opts);
function lastBackupText(ts) {
  if (!ts) return 'You have not saved a backup yet.';
  const days = Math.floor((Date.now() - ts) / 86400000);
  if (days <= 0) return 'Last backup: today.';
  if (days === 1) return 'Last backup: yesterday.';
  return `Last backup: ${days} days ago.`;
}
const dayNumber = (str) => Math.round(parseDate(str).getTime() / 86400000);
const cardFor = (str) => CARDS[dayNumber(str) % CARDS.length];

function commit() {
  save(state);
  reminders.sync(state);
}

// ---------- small UI builders ----------
function chips(field, options, selected, multi) {
  const sel = multi ? new Set(selected) : new Set([selected]);
  return `<div class="chips">${options.map(([id, label]) =>
    `<button type="button" class="chip${sel.has(id) ? ' on' : ''}" aria-pressed="${sel.has(id)}"
      data-action="pick" data-field="${field}" data-value="${esc(id)}"${multi ? ' data-multi="1"' : ''}>${esc(label)}</button>`).join('')}</div>`;
}

function scale(field, value, low, high) {
  return `<div class="scale">
    <div class="scale-dots">${[1, 2, 3, 4, 5].map((n) =>
    `<button type="button" class="dot${value === n ? ' on' : ''}" aria-pressed="${value === n}" aria-label="${n} of 5"
        data-action="pick" data-field="${field}" data-value="${n}" data-num="1">${n}</button>`).join('')}</div>
    <div class="scale-ends"><span>${low}</span><span>${high}</span></div>
  </div>`;
}

function getPath(obj, path) { return path.split('.').reduce((o, k) => o[k], obj); }
function setPath(obj, path, value) {
  const keys = path.split('.');
  const last = keys.pop();
  keys.reduce((o, k) => o[k], obj)[last] = value;
}

// ---------- views ----------
function viewOnboarding() {
  const p = state.profile, s = state.settings;
  return `<section class="onboard">
    <div class="brand-mark">${logo()}</div>
    <h1>Welcome to Clary</h1>
    <p class="lead">A calm place to track headaches and migraines through perimenopause and menopause, and to discover what sets them off.</p>
    <div class="card">
      <label class="field"><span>What may we call you? <em>(optional)</em></span>
        <input type="text" id="ob-name" value="${esc(p.name)}" maxlength="30" autocomplete="given-name"></label>
      <div class="field"><span>Where are you right now?</span>
        ${chips('profile.stage', STAGES, p.stage, false).replace(/data-action="pick"/g, 'data-action="setting"')}
      </div>
      <div class="field"><span>Do you use hormone therapy (HRT)?</span>
        ${chips('settings.usesHrt', [['yes', 'Yes'], ['no', 'No']], s.usesHrt ? 'yes' : 'no', false).replace(/data-action="pick"/g, 'data-action="setting"')}
      </div>
      <label class="field"><span>When would a daily check-in suit you?</span>
        <input type="time" id="ob-time" value="${esc(s.reminderTime)}"></label>
    </div>
    <p class="fine">Everything you record stays on this device. No account, no cloud. Clary supports conversations with your doctor and does not replace medical advice.</p>
    <button class="btn primary big" data-action="finish-onboarding">Start my garden</button>
  </section>`;
}

function greeting() {
  const h = new Date().getHours();
  const part = h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
  return state.profile.name ? `${part}, ${esc(state.profile.name)}` : part;
}

function entrySummary(e) {
  const bits = [];
  if (e.headache.had) bits.push(`Headache, intensity ${e.headache.intensity}/10${e.headache.type ? ` (${labelOf(e.headache.type).toLowerCase()})` : ''}`);
  else bits.push('No headache');
  if (e.period !== 'none') bits.push(`Period: ${labelOf(e.period).toLowerCase()}`);
  if (e.stress) bits.push(`Stress ${e.stress}/5`);
  if (e.sleep) bits.push(`Sleep ${e.sleep}/5`);
  return bits.map(esc).join(' · ');
}

// A short sentence plus a track spanning the earliest-to-latest estimate, with
// today marked on it. The track's two ends are the whole range, so the band
// covers it in full; only the "today" marker needs a position.
function cycleCard(c, t) {
  if (!c) return '';
  const span = Math.max(1, (parseDate(c.latest) - parseDate(c.earliest)) / 86400000);
  const nowPos = Math.min(100, Math.max(0, Math.round(((parseDate(t) - parseDate(c.earliest)) / 86400000 / span) * 100)));
  const when = c.daysUntil > 1 ? `in about ${c.daysUntil} days`
    : c.daysUntil === 1 ? 'tomorrow' : c.daysUntil === 0 ? 'around today'
      : `${Math.abs(c.daysUntil)} ${Math.abs(c.daysUntil) === 1 ? 'day' : 'days'} ago`;
  return `<div class="card">
    <p class="eyebrow">Your cycle</p>
    <p>Based on your last ${c.cycleCount + 1} periods, your next one may start ${when}.</p>
    <div class="cycle-track"><span class="band" style="left:0;width:100%"></span><span class="now" style="left:${nowPos}%"></span></div>
    <div class="cycle-ends"><span>${niceDate(c.earliest, { day: 'numeric', month: 'short' })}</span><span>${niceDate(c.latest, { day: 'numeric', month: 'short' })}</span></div>
    ${!c.regular ? '<p class="hint">Your cycles have varied quite a bit lately, so take this as a rough guide rather than a date.</p>' : ''}
  </div>`;
}

function viewToday() {
  const t = today(), y = addDays(t, -1);
  const done = state.entries[t];
  const st = streaks(state.entries);
  const pat = findPatterns(state.entries);
  const medDays = medDaysLast30(state.entries, t);
  const cycle = state.profile.stage !== 'none' ? cycleInsight(state.entries, t) : null;

  const hero = done
    ? `<div class="card hero done">
        <p class="eyebrow">Today’s check-in is done</p>
        <p class="summary">${entrySummary(done)}</p>
        <button class="btn ghost" data-action="open-checkin" data-date="${t}">Edit today</button>
      </div>
      <div class="card selfcare"><p class="eyebrow">Today’s card</p><p class="quote">${esc(cardFor(t))}</p></div>`
    : `<div class="card hero">
        <p class="eyebrow">${niceDate(t)}</p>
        <h2>How are you feeling today?</h2>
        <p>Thirty seconds, a few taps, and a new flower for your garden.</p>
        <button class="btn primary big" data-action="open-checkin" data-date="${t}">Start check-in</button>
      </div>`;

  const catchUp = !state.entries[y] && st.total > 0
    ? `<button class="link-row" data-action="open-checkin" data-date="${y}"><span>Missed yesterday? Fill it in now</span><span aria-hidden="true">›</span></button>`
    : '';

  const backupNote = backupDue(state)
    ? `<div class="card backup-nudge">
        <p class="eyebrow">Keep your data safe</p>
        <p>${state.lastBackupAt ? 'It has been a few weeks since your last backup.' : 'You have not saved a backup yet.'}
          Everything here lives only on this device, so it is worth saving one now and then.</p>
        <div class="btn-row">
          <button class="btn primary" data-action="backup">Save backup now</button>
          <button class="btn ghost" data-action="snooze-backup">Remind me later</button>
        </div>
      </div>`
    : '';

  let insight = '';
  if (!pat.ready) {
    insight = `<div class="card"><p class="eyebrow">Your patterns</p>
      <p>Clary starts looking for patterns after two weeks of check-ins. ${pat.needed} more to go.</p>
      <div class="progress"><span style="width:${Math.round(((14 - pat.needed) / 14) * 100)}%"></span></div></div>`;
  } else if (pat.risks.length) {
    const p = pat.risks[0];
    insight = `<div class="card"><p class="eyebrow">A pattern Clary noticed</p>
      <p>${esc(describePattern(p, factorPhrase(p.id)))}</p>
      <button class="btn ghost" data-action="go" data-view="insights">See all insights</button></div>`;
  }

  const medNote = medDays >= 10
    ? `<div class="card note"><p class="eyebrow">Worth mentioning to your doctor</p>
        <p>You took pain relief on ${medDays} of the last 30 days. Frequent use can itself lead to more headaches, so it is good to discuss.</p></div>`
    : '';

  return `<header class="top"><h1>${greeting()}</h1></header>
    ${hero}${catchUp}${backupNote}
    <button class="card garden-peek" data-action="go" data-view="garden" aria-label="Open your garden">
      ${gardenScene(st.total)}
      <div class="peek-stats"><span><strong>${st.total}</strong> ${st.total === 1 ? 'bloom' : 'blooms'}</span><span><strong>${st.current}</strong> day streak</span></div>
    </button>
    ${cycleCard(cycle, t)}
    ${insight}${medNote}`;
}

function viewCheckin() {
  const d = ui.draft, date = ui.draftDate, isToday = date === today();
  const s = state.settings;
  const tracked = [
    ...s.trackedTriggers.map((id) => [id, labelOf(id)]),
  ];
  const h = d.headache;

  const headacheQuick = h.had ? `
    <div class="sub">
      <label class="field"><span>How strong was it at its worst? <output id="intensity-out">${h.intensity}</output>/10</span>
        <input type="range" min="1" max="10" step="1" value="${h.intensity}" data-field="headache.intensity" data-num="1" aria-label="Intensity from 1 to 10">
        <div class="scale-ends"><span>Mild</span><span>Unbearable</span></div></label>
      <div class="field"><span>What kind?</span>${chips('headache.type', HEADACHE_TYPES, h.type, false)}</div>
    </div>` : '';

  const headacheMore = h.had ? `
    <div class="field"><span>How long did it last?</span>${chips('headache.duration', DURATIONS, h.duration, false)}</div>
    <div class="field"><span>Where did you feel it?</span>${chips('headache.locations', LOCATIONS, h.locations, true)}</div>
    <div class="field"><span>What came with it?</span>${chips('headache.symptoms', HEADACHE_SYMPTOMS, h.symptoms, true)}</div>
    <div class="field"><span>How much did it affect your day?</span>${chips('headache.impact', IMPACT, h.impact, false)}</div>
    <div class="field"><span>Did you take anything?</span>${chips('headache.meds', s.meds.map((m) => [m, m]), h.meds, true)}</div>
    ${h.meds.length ? `<div class="field"><span>Did it help?</span>${chips('headache.relief', RELIEF, h.relief, false)}</div>` : ''}` : '';

  const more = ui.showMore ? `
    <div class="card">
      <h3>More detail</h3>
      ${headacheMore}
      ${s.trackMeno ? `<div class="field"><span>Menopause symptoms</span>${chips('meno', MENO_SYMPTOMS, d.meno, true)}</div>` : ''}
      ${s.usesHrt ? `<div class="field"><span>Did you take your HRT?</span>${chips('hrt', [['yes', 'Yes'], ['no', 'No']], d.hrt ? 'yes' : 'no', false)}</div>` : ''}
      <label class="field"><span>Hours of sleep</span>
        <input type="number" inputmode="decimal" min="0" max="16" step="0.5" value="${esc(d.sleepHours)}" data-field="sleepHours" placeholder="e.g. 7"></label>
      <div class="field"><span>Mood</span>${scale('mood', d.mood, 'Low', 'Bright')}</div>
      <label class="field"><span>Notes</span>
        <textarea rows="3" data-field="notes" maxlength="1000" placeholder="Anything else worth remembering">${esc(d.notes)}</textarea></label>
    </div>` : '';

  const quickActions = ui.draftIsNew && state.entries[addDays(date, -1)]
    ? `<button class="link-row" data-action="copy-yesterday"><span>Copy yesterday’s check-in</span><span aria-hidden="true">›</span></button>`
    : !ui.draftIsNew
      ? `<button class="link-row danger" data-action="delete-checkin" data-date="${date}"><span>Clear this day’s check-in</span><span aria-hidden="true">×</span></button>`
      : '';

  return `<header class="top with-back">
      <button class="icon-btn" data-action="close-checkin" aria-label="Back">‹</button>
      <div><p class="eyebrow">${isToday ? 'Today' : 'Looking back'}</p><h1>${niceDate(date)}</h1></div>
    </header>
    ${quickActions}
    <div class="card">
      <h3>${isToday ? 'Any headache today?' : 'Any headache that day?'}</h3>
      ${chips('headache.had', [['no', 'No headache'], ['yes', 'Yes']], h.had ? 'yes' : 'no', false)}
      ${headacheQuick}
    </div>
    ${state.profile.stage !== 'none' ? `<div class="card"><h3>Period</h3>${chips('period', PERIOD_LEVELS, d.period, false)}</div>` : ''}
    <div class="card">
      <h3>Stress</h3>${scale('stress', d.stress, 'Calm', 'Very stressed')}
      <h3 class="gap">Last night’s sleep</h3>${scale('sleep', d.sleep, 'Poor', 'Great')}
    </div>
    <div class="card">
      <h3>Anything from this list?</h3>
      <p class="hint">Tap what applied. You choose what appears here in Settings.</p>
      ${chips('triggers', tracked, d.triggers, true)}
    </div>
    ${more}
    <button class="btn ghost wide" data-action="toggle-more">${ui.showMore ? 'Hide extra detail' : 'Add more detail'}</button>
    <div class="save-bar"><button class="btn primary big" data-action="save-checkin">Save check-in</button></div>`;
}

function intensityClass(e) {
  if (!e) return '';
  if (!e.headache.had) return 'clear';
  const i = Number(e.headache.intensity);
  return i <= 3 ? 'h1' : i <= 6 ? 'h2' : 'h3';
}

function viewCalendar() {
  const [y, m] = ui.month.split('-').map(Number);
  const first = new Date(y, m - 1, 1, 12);
  const days = new Date(y, m, 0).getDate();
  const offset = (first.getDay() + 6) % 7;
  const t = today();
  const cycle = state.profile.stage !== 'none' ? cycleInsight(state.entries, t) : null;
  let cells = '';
  for (let i = 0; i < offset; i++) cells += '<span class="cal-cell empty"></span>';
  for (let d = 1; d <= days; d++) {
    const str = `${ui.month}-${String(d).padStart(2, '0')}`;
    const e = state.entries[str];
    const future = str > t;
    const period = e && e.period !== 'none';
    const predicted = !e && cycle && str >= cycle.earliest && str <= cycle.latest;
    const desc = e ? (e.headache.had ? `headache ${e.headache.intensity} of 10` : 'no headache') : 'no check-in';
    cells += `<button class="cal-cell ${intensityClass(e)}${str === t ? ' today' : ''}${predicted ? ' predicted' : ''}" ${future ? 'disabled' : ''}
      data-action="open-checkin" data-date="${str}" aria-label="${niceDate(str)}: ${desc}${period ? ', period' : ''}${predicted ? ', period may start around here' : ''}">
      <span class="num">${d}</span>${period ? '<span class="drop" aria-hidden="true"></span>' : ''}</button>`;
  }
  const s = summarize(state.entries, `${ui.month}-01`, `${ui.month}-31`);
  return `<header class="top"><h1>Calendar</h1></header>
    <div class="card">
      <div class="cal-head">
        <button class="icon-btn" data-action="month" data-step="-1" aria-label="Previous month">‹</button>
        <h2>${first.toLocaleDateString('en', { month: 'long', year: 'numeric' })}</h2>
        <button class="icon-btn" data-action="month" data-step="1" aria-label="Next month" ${ui.month >= t.slice(0, 7) ? 'disabled' : ''}>›</button>
      </div>
      <div class="cal-grid names">${['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((n) => `<span>${n}</span>`).join('')}</div>
      <div class="cal-grid">${cells}</div>
      <div class="legend">
        <span><i class="sw clear"></i>No headache</span><span><i class="sw h1"></i>Mild</span>
        <span><i class="sw h2"></i>Moderate</span><span><i class="sw h3"></i>Severe</span>
        <span><i class="drop"></i>Period</span>${cycle ? '<span><i class="sw predicted-sw"></i>Period may start</span>' : ''}
      </div>
    </div>
    <div class="tiles">
      ${tile(s.logged, 'check-ins')}${tile(s.headacheDays, 'headache days')}${tile(s.periodDays, 'period days')}
    </div>
    <p class="hint center">Tap any day to add or change its check-in.</p>`;
}

const tile = (value, label) => `<div class="tile"><strong>${value}</strong><span>${label}</span></div>`;

function rangeBounds() {
  const to = today();
  const dates = Object.keys(state.entries).sort();
  const from = ui.range === 0 ? (dates[0] || to) : addDays(to, -(ui.range - 1));
  return { from, to };
}

function patternCard(p) {
  return `<div class="pattern">
    <p>${esc(describePattern(p, factorPhrase(p.id)))}</p>
    ${compareBars(p.withRate, p.withoutRate)}
    <p class="meta">${p.strong ? 'Consistent pattern' : 'Early signal'} · based on ${p.days} days</p>
  </div>`;
}

function viewInsights() {
  const { from, to } = rangeBounds();
  const s = summarize(state.entries, from, to);
  const pat = findPatterns(state.entries);
  const months = monthly(state.entries, ui.range === 30 ? 3 : ui.range === 90 ? 6 : 12, to);
  const week = byWeekday(state.entries, from, to);
  const ranges = [[30, '30 days'], [90, '3 months'], [365, '1 year'], [0, 'All time']];
  const cycle = state.profile.stage !== 'none' ? cycleInsight(state.entries, to) : null;
  const logged = mostLogged(state.entries, from, to);
  const mo = medOveruse(state.entries, to);

  const patterns = !pat.ready
    ? `<p>Clary needs about two weeks of check-ins before it can compare days fairly. ${pat.needed} more to go.</p>`
    : pat.risks.length
      ? pat.risks.slice(0, 8).map(patternCard).join('')
      : '<p>No clear triggers yet. That is useful to know too. Keep checking in and Clary will keep looking.</p>';

  const helpers = pat.ready && pat.helpers.length
    ? `<div class="card"><h2>What seems to go with fewer headaches</h2>${pat.helpers.slice(0, 4).map(patternCard).join('')}</div>`
    : '';

  const mostLoggedCard = logged.items.length
    ? `<div class="card"><h2>Most logged</h2>
        <p class="hint">What you have tagged most often in this period, regardless of whether a headache followed.</p>
        ${rankList(logged.items.map((i) => ({ label: esc(labelOf(i.id)), value: i.count })))}
      </div>`
    : '';

  const medNote = mo.flag
    ? `<div class="card note"><p class="eyebrow">Worth mentioning to your doctor</p>
        <p>Over the last three months you have needed pain relief on about ${mo.perMonth.toFixed(1)} days a month on average. Frequent use can itself lead to more headaches.</p></div>`
    : '';

  return `<header class="top"><h1>Insights</h1></header>
    <div class="chips range" role="group" aria-label="Period">${ranges.map(([n, l]) =>
    `<button class="chip${ui.range === n ? ' on' : ''}" aria-pressed="${ui.range === n}" data-action="range" data-value="${n}">${l}</button>`).join('')}</div>
    <div class="tiles four">
      ${tile(s.headacheDays, 'headache days')}${tile(s.migraineDays, 'migraine days')}
      ${tile(s.headacheDays ? s.avgIntensity.toFixed(1) : '–', 'average intensity')}${tile(s.medDays, 'days with pain relief')}
    </div>
    ${medNote}
    ${cycleCard(cycle, to)}
    <div class="card"><h2>Headache days per month</h2>
      ${barChart(months.map((x) => ({ label: x.label, value: x.headacheDays, tip: `${x.label} ${x.year}: ${x.headacheDays} headache days out of ${x.logged} check-ins` })), { ariaLabel: 'Headache days per month' })}
    </div>
    <div class="card"><h2>Headache days by weekday</h2>
      ${barChart(week.map((x) => ({ label: x.label, value: x.headacheDays, tip: `${x.label}: ${x.headacheDays} headache days out of ${x.logged} check-ins` })), { ariaLabel: 'Headache days by weekday' })}
    </div>
    <div class="card"><h2>Your possible triggers</h2>
      <p class="hint">Clary compares days with and without each factor, on the same day and up to two days later. These are patterns to explore, not proof of a cause.</p>
      ${patterns}
    </div>
    ${helpers}
    ${mostLoggedCard}
    <div class="card"><h2>Take it with you</h2>
      <p class="hint">A report for your doctor, or the raw data for a spreadsheet.</p>
      <div class="btn-row">
        <button class="btn primary" data-action="go" data-view="report">Doctor report (PDF)</button>
        <button class="btn ghost" data-action="export-csv">Download CSV</button>
      </div>
    </div>`;
}

function viewReport() {
  const { from, to } = rangeBounds();
  const s = summarize(state.entries, from, to);
  const pat = findPatterns(state.entries);
  const months = monthly(state.entries, 12, to).filter((m) => m.logged > 0);
  const rows = Object.keys(state.entries).sort().filter((d) => d >= from && d <= to && state.entries[d].headache.had).map((d) => {
    const e = state.entries[d], h = e.headache;
    return `<tr><td>${d}</td><td>${h.intensity}</td><td>${esc(labelOf(h.type))}</td><td>${esc(labelOf(h.duration))}</td>
      <td>${esc(h.symptoms.map(labelOf).join(', '))}</td><td>${esc(h.meds.join(', '))}${h.relief ? ` (${esc(labelOf(h.relief).toLowerCase())})` : ''}</td>
      <td>${e.period !== 'none' ? esc(labelOf(e.period)) : ''}</td><td>${esc(e.triggers.map(labelOf).join(', '))}</td></tr>`;
  }).join('');
  return `<header class="top with-back no-print">
      <button class="icon-btn" data-action="go" data-view="insights" aria-label="Back">‹</button>
      <h1>Doctor report</h1>
    </header>
    <div class="btn-row no-print"><button class="btn primary" data-action="print">Print or save as PDF</button></div>
    <article class="report card">
      <h2>Headache report${state.profile.name ? ` for ${esc(state.profile.name)}` : ''}</h2>
      <p>${niceDate(from, { day: 'numeric', month: 'long', year: 'numeric' })} to ${niceDate(to, { day: 'numeric', month: 'long', year: 'numeric' })} · ${s.logged} days recorded</p>
      <table class="kv">
        <tr><th>Headache days</th><td>${s.headacheDays}</td></tr>
        <tr><th>Of which migraine</th><td>${s.migraineDays}</td></tr>
        <tr><th>Average intensity</th><td>${s.headacheDays ? `${s.avgIntensity.toFixed(1)} / 10` : '–'}</td></tr>
        <tr><th>Days with pain relief</th><td>${s.medDays}</td></tr>
        <tr><th>Days needing rest</th><td>${s.restDays}</td></tr>
        <tr><th>Period days</th><td>${s.periodDays}</td></tr>
      </table>
      <h3>Per month</h3>
      <table><tr><th>Month</th><th>Days recorded</th><th>Headache days</th></tr>
        ${months.map((m) => `<tr><td>${m.label} ${m.year}</td><td>${m.logged}</td><td>${m.headacheDays}</td></tr>`).join('')}</table>
      <h3>Observed patterns (all recorded data)</h3>
      ${pat.ready && pat.risks.length
    ? `<ul>${pat.risks.slice(0, 8).map((p) => `<li>${esc(describePattern(p, factorPhrase(p.id)))} (${p.days} days)</li>`).join('')}</ul>`
    : '<p>No clear patterns yet.</p>'}
      <h3>Headache log</h3>
      ${rows ? `<table class="log"><tr><th>Date</th><th>Intensity</th><th>Type</th><th>Duration</th><th>Symptoms</th><th>Medication</th><th>Period</th><th>Logged factors</th></tr>${rows}</table>` : '<p>No headaches recorded in this period.</p>'}
      <p class="fine">Self-reported with Clary. Patterns are statistical associations, not diagnoses.</p>
    </article>`;
}

function viewGarden() {
  const st = streaks(state.entries);
  const next = MILESTONES.find((m) => m.at > st.total);
  const earned = MILESTONES.filter((m) => m.at <= st.total).reverse();
  return `<header class="top"><h1>Your garden</h1></header>
    <div class="card flush">${gardenScene(st.total)}</div>
    <div class="tiles">${tile(st.total, st.total === 1 ? 'bloom' : 'blooms')}${tile(st.current, 'day streak')}${tile(st.best, 'longest streak')}</div>
    <p class="hint center">Every check-in grows a flower, on good days and hard days alike. Your garden never wilts.</p>
    ${next ? `<div class="card"><p class="eyebrow">Next milestone</p><h2>${esc(next.title)}</h2>
      <p>${next.at - st.total} more ${next.at - st.total === 1 ? 'check-in' : 'check-ins'} to go.</p>
      <div class="progress"><span style="width:${Math.round((st.total / next.at) * 100)}%"></span></div></div>` : ''}
    <div class="card"><h2>Flowers</h2><div class="species">${SPECIES.map((sp, i) => {
    const open = st.total >= sp.at;
    return `<div class="sp${open ? '' : ' locked'}"><svg viewBox="-14 -50 28 52" aria-hidden="true">${flower(sp.id, i)}</svg>
        <span>${open ? esc(sp.name) : `at ${sp.at}`}</span></div>`;
  }).join('')}</div></div>
    ${earned.length ? `<div class="card"><h2>Milestones</h2><ul class="milestones">${earned.map((m) =>
    `<li><strong>${esc(m.title)}</strong><span>${esc(m.text)}</span></li>`).join('')}</ul></div>` : ''}
    <div class="card selfcare"><p class="eyebrow">Today’s card</p><p class="quote">${esc(cardFor(today()))}</p></div>`;
}

function viewSettings() {
  const s = state.settings, p = state.profile;
  const perm = reminders.permission();
  const permText = perm === 'granted' ? 'Notifications are allowed on this device.'
    : perm === 'denied' ? 'Notifications are blocked. Allow them for this site in your browser settings.'
      : perm === 'unsupported' ? 'This browser does not support notifications. On iPhone, add Clary to your Home Screen first.'
        : 'Turn reminders on to allow notifications.';
  const toSetting = (html) => html.replace(/data-action="pick"/g, 'data-action="setting"');

  const library = ui.showLibrary ? TRIGGER_GROUPS.map((g) => `
      <div class="field"><span>${g.label}</span>
        ${toSetting(chips('settings.trackedTriggers', g.items, s.trackedTriggers, true))}</div>`).join('') : '';

  return `<header class="top"><h1>Settings</h1></header>
    <div class="card"><h2>Appearance</h2>
      <div class="field"><span>Theme</span>${toSetting(chips('settings.theme',
    [['auto', 'Match device'], ['light', 'Light'], ['dark', 'Dark']], s.theme, false))}</div>
    </div>
    <div class="card"><h2>About you</h2>
      <label class="field"><span>Name</span><input type="text" data-setting="profile.name" value="${esc(p.name)}" maxlength="30"></label>
      <div class="field"><span>Cycle</span>${toSetting(chips('profile.stage', STAGES, p.stage, false))}</div>
      <div class="field"><span>I use hormone therapy (HRT)</span>${toSetting(chips('settings.usesHrt', [['yes', 'Yes'], ['no', 'No']], s.usesHrt ? 'yes' : 'no', false))}</div>
      <div class="field"><span>Track menopause symptoms</span>${toSetting(chips('settings.trackMeno', [['yes', 'Yes'], ['no', 'No']], s.trackMeno ? 'yes' : 'no', false))}</div>
    </div>
    <div class="card"><h2>Daily reminder</h2>
      <div class="field"><span>Remind me every day</span>${toSetting(chips('settings.reminderOn', [['yes', 'On'], ['no', 'Off']], s.reminderOn ? 'yes' : 'no', false))}</div>
      <label class="field"><span>At</span><input type="time" data-setting="settings.reminderTime" value="${esc(s.reminderTime)}"></label>
      <p class="hint">${permText}</p>
      <p class="hint">For a reminder that never misses, even when Clary is closed, add a repeating alert to your phone’s calendar.</p>
      <button class="btn ghost" data-action="calendar-file">Add to my calendar</button>
    </div>
    <div class="card"><h2>What I track</h2>
      <p class="hint">${s.trackedTriggers.length} factors appear in your check-in. Your period, stress and sleep are always included.</p>
      <button class="btn ghost" data-action="toggle-library">${ui.showLibrary ? 'Hide the full list' : 'Choose from the full list'}</button>
      ${library}
      <div class="field"><span>My own triggers</span>
        <div class="chips">${s.customTriggers.filter((t) => !t.hidden).map((t) =>
    `<button class="chip on" data-action="remove-custom" data-id="${esc(t.id)}" aria-label="Remove ${esc(t.label)}">${esc(t.label)} ×</button>`).join('') || '<span class="hint">None yet</span>'}</div>
        <div class="add-row"><input type="text" id="new-trigger" maxlength="40" placeholder="e.g. Bright supermarket lights" aria-label="New trigger">
          <button class="btn ghost" data-action="add-custom">Add</button></div>
      </div>
    </div>
    <div class="card"><h2>My medication</h2>
      <div class="chips">${s.meds.map((m) =>
    `<button class="chip on" data-action="remove-med" data-id="${esc(m)}" aria-label="Remove ${esc(m)}">${esc(m)} ×</button>`).join('')}</div>
      <div class="add-row"><input type="text" id="new-med" maxlength="40" placeholder="e.g. Sumatriptan 50 mg" aria-label="New medication">
        <button class="btn ghost" data-action="add-med">Add</button></div>
    </div>
    <div class="card"><h2>My data</h2>
      <p class="hint">Your records live only on this device. Save a backup now and then, and use it to move to a new phone.</p>
      <p class="hint">${lastBackupText(state.lastBackupAt)}</p>
      <div class="btn-row">
        <button class="btn ghost" data-action="backup">Save backup</button>
        <button class="btn ghost" data-action="restore">Restore backup</button>
        <button class="btn ghost" data-action="export-csv">Download CSV</button>
      </div>
      <input type="file" id="restore-file" accept="application/json,.json" hidden>
      <button class="btn danger" data-action="wipe">Delete all my data</button>
    </div>
    <div class="card"><h2>About Clary</h2>
      <p class="hint">Clary is a diary, not a medical device. It cannot diagnose or treat. See a doctor urgently for a sudden severe headache, a headache with weakness, confusion, fever or vision loss, or a pattern that changes quickly.</p>
      <p class="hint">Privacy: no account, no tracking, nothing leaves this device unless you export it yourself.</p>
      <p class="hint">To install: open your browser menu and choose “Add to Home Screen”.</p>
    </div>`;
}

function logo() {
  return `<svg viewBox="-20 -52 40 56" aria-hidden="true">${flower('peony', 2)}</svg>`;
}

// ---------- reward modal ----------
function showReward(date) {
  const st = streaks(state.entries);
  const sp = speciesFor(st.total - 1);
  const milestone = MILESTONES.find((m) => m.at === st.total && !state.seenMilestones.includes(m.at));
  if (milestone) { state.seenMilestones.push(milestone.at); save(state); }
  const an = /^[aeiou]/.test(sp.name) ? 'An' : 'A';
  $modal.innerHTML = `<div class="sheet" role="dialog" aria-modal="true" aria-labelledby="reward-title">
    <svg class="bloom" viewBox="-22 -54 44 58" aria-hidden="true">${flower(sp.id, st.total - 1)}</svg>
    <h2 id="reward-title">${an} ${esc(sp.name)} bloomed</h2>
    <p>${st.total} ${st.total === 1 ? 'flower' : 'flowers'} in your garden${st.current > 1 ? ` · ${st.current} days in a row` : ''}</p>
    ${milestone ? `<div class="milestone"><p class="eyebrow">Milestone</p><strong>${esc(milestone.title)}</strong><span>${esc(milestone.text)}</span></div>` : ''}
    <div class="selfcare"><p class="eyebrow">Your card for today</p><p class="quote">${esc(cardFor(date))}</p></div>
    <button class="btn primary big" data-action="close-modal">Lovely</button>
  </div>`;
  $modal.hidden = false;
  $modal.querySelector('button').focus();
}

// ---------- render ----------
const VIEWS = {
  today: viewToday, checkin: viewCheckin, calendar: viewCalendar, insights: viewInsights,
  report: viewReport, garden: viewGarden, settings: viewSettings,
};
const NAV = [['today', 'Today'], ['calendar', 'Calendar'], ['insights', 'Insights'], ['garden', 'Garden'], ['settings', 'Settings']];
const NAV_ICONS = {
  today: '<circle cx="12" cy="12" r="4.2"/><path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M5.3 18.7l2.1-2.1M16.6 7.4l2.1-2.1"/>',
  calendar: '<rect x="3.5" y="5" width="17" height="15.5" rx="3"/><path d="M3.5 10h17M8 3v4M16 3v4"/>',
  insights: '<path d="M4 20V11M10 20V5M16 20v-7M21 20H3"/>',
  garden: '<path d="M12 21v-9"/><circle cx="12" cy="7.5" r="3.2"/><path d="M12 16c-3.5 0-5-2-5-4 3 0 5 1.500 5 4zM12 16c3.500 0 5-2 5-4-3 0-5 1.500-5 4z"/>',
  settings: '<circle cx="12" cy="12" r="3"/><path d="M12 3v2.500M12 18.500V21M3 12h2.500M18.500 12H21M5.600 5.600l1.800 1.800M16.600 16.600l1.800 1.800M5.600 18.400l1.800-1.800M16.600 7.400l1.800-1.800"/>',
};

function render(keepScroll = false) {
  const scroll = window.scrollY;
  if (!state.profile.onboarded) {
    $view.innerHTML = viewOnboarding();
    $nav.hidden = true;
    return;
  }
  $view.innerHTML = VIEWS[ui.view]();
  const hideNav = ui.view === 'checkin' || ui.view === 'report';
  $nav.hidden = hideNav;
  $nav.innerHTML = NAV.map(([id, label]) =>
    `<button class="${ui.view === id ? 'on' : ''}" data-action="go" data-view="${id}" ${ui.view === id ? 'aria-current="page"' : ''}>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.700" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${NAV_ICONS[id]}</svg>
      <span>${label}</span></button>`).join('');
  document.body.dataset.view = ui.view;
  window.scrollTo(0, keepScroll ? scroll : 0);
}

function go(view) { ui.view = view; render(); }

function openCheckin(date) {
  if (date > today()) return;
  const existing = state.entries[date];
  const base = emptyEntry();
  ui.draft = existing
    ? { ...base, ...structuredClone(existing), headache: { ...base.headache, ...structuredClone(existing.headache || {}) } }
    : base;
  ui.draftDate = date;
  ui.draftIsNew = !existing;
  ui.showMore = false;
  go('checkin');
}

// ---------- actions ----------
const BOOL_FIELDS = new Set(['headache.had', 'hrt', 'settings.usesHrt', 'settings.trackMeno', 'settings.reminderOn']);

function applyPick(target, el) {
  const field = el.dataset.field;
  let value = el.dataset.num ? Number(el.dataset.value) : el.dataset.value;
  if (BOOL_FIELDS.has(field)) value = value === 'yes';
  if (el.dataset.multi) {
    const list = getPath(target, field);
    const i = list.indexOf(value);
    if (i >= 0) list.splice(i, 1); else list.push(value);
  } else {
    // tapping a selected single choice clears it (except yes/no questions)
    const current = getPath(target, field);
    const clearable = !BOOL_FIELDS.has(field) && field !== 'profile.stage' && field !== 'period' && field !== 'settings.theme';
    setPath(target, field, clearable && current === value ? (el.dataset.num ? 0 : '') : value);
  }
  return field;
}

const actions = {
  go: (el) => go(el.dataset.view),
  'open-checkin': (el) => openCheckin(el.dataset.date),
  'close-checkin': () => go(ui.draftDate === today() ? 'today' : 'calendar'),
  'toggle-more': () => { ui.showMore = !ui.showMore; render(true); },
  pick: (el) => { applyPick(ui.draft, el); render(true); },
  'save-checkin': () => {
    const d = ui.draft;
    if (!d.headache.had) d.headache = emptyEntry().headache;
    if (!d.headache.meds.length) d.headache.relief = '';
    state.entries[ui.draftDate] = d;
    commit();
    const wasNew = ui.draftIsNew, date = ui.draftDate;
    go(date === today() ? 'today' : 'calendar');
    if (wasNew) showReward(date);
  },
  'close-modal': () => { $modal.hidden = true; $modal.innerHTML = ''; },
  'copy-yesterday': () => {
    const prev = state.entries[addDays(ui.draftDate, -1)];
    if (!prev) return;
    const base = emptyEntry();
    ui.draft = { ...base, ...structuredClone(prev), headache: { ...base.headache, ...structuredClone(prev.headache || {}) }, notes: '' };
    render(true);
  },
  'delete-checkin': (el) => {
    if (!confirm('Remove this day’s check-in? This cannot be undone.')) return;
    delete state.entries[el.dataset.date];
    commit();
    go(el.dataset.date === today() ? 'today' : 'calendar');
  },
  month: (el) => {
    const [y, m] = ui.month.split('-').map(Number);
    ui.month = toDateStr(new Date(y, m - 1 + Number(el.dataset.step), 1, 12)).slice(0, 7);
    render(true);
  },
  range: (el) => { ui.range = Number(el.dataset.value); render(true); },
  setting: async (el) => {
    const field = applyPick(state, el);
    if (field === 'settings.reminderOn' && state.settings.reminderOn) await reminders.askPermission();
    if (field === 'settings.theme') applyTheme();
    commit();
    render(true);
  },
  'finish-onboarding': async () => {
    state.profile.name = document.getElementById('ob-name').value.trim();
    state.settings.reminderTime = document.getElementById('ob-time').value || '20:00';
    state.profile.onboarded = true;
    if ((await reminders.askPermission()) === 'granted') state.settings.reminderOn = true;
    if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});
    commit();
    go('today');
  },
  'toggle-library': () => { ui.showLibrary = !ui.showLibrary; render(true); },
  'add-custom': () => {
    const label = document.getElementById('new-trigger').value.trim();
    if (!label) return;
    const id = `custom_${Date.now().toString(36)}`;
    state.settings.customTriggers.push({ id, label });
    state.settings.trackedTriggers.push(id);
    commit(); render(true);
  },
  'remove-custom': (el) => {
    // Past check-ins keep their label so history and exports stay readable.
    state.settings.trackedTriggers = state.settings.trackedTriggers.filter((t) => t !== el.dataset.id);
    const used = Object.values(state.entries).some((e) => e.triggers.includes(el.dataset.id));
    if (!used) state.settings.customTriggers = state.settings.customTriggers.filter((t) => t.id !== el.dataset.id);
    else state.settings.customTriggers.find((t) => t.id === el.dataset.id).hidden = true;
    commit(); render(true);
  },
  'add-med': () => {
    const name = document.getElementById('new-med').value.trim();
    if (!name || state.settings.meds.includes(name)) return;
    state.settings.meds.push(name);
    commit(); render(true);
  },
  'remove-med': (el) => {
    state.settings.meds = state.settings.meds.filter((m) => m !== el.dataset.id);
    commit(); render(true);
  },
  'calendar-file': () => download('clary-reminder.ics', reminders.calendarFile(state.settings.reminderTime), 'text/calendar'),
  'export-csv': () => download(`clary-${today()}.csv`, toCsv(state.entries, labelOf), 'text/csv'),
  backup: () => {
    download(`clary-backup-${today()}.json`, JSON.stringify(state, null, 2), 'application/json');
    state.lastBackupAt = Date.now();
    state.backupSnoozedUntil = null;
    commit();
    render(true);
  },
  'snooze-backup': () => {
    state.backupSnoozedUntil = Date.now() + 7 * 86400000;
    commit();
    render(true);
  },
  restore: () => document.getElementById('restore-file').click(),
  wipe: () => {
    if (!confirm('Delete every check-in and setting from this device? This cannot be undone.')) return;
    state = defaultState();
    commit();
    render();
  },
  print: () => window.print(),
};

document.addEventListener('click', (ev) => {
  const el = ev.target.closest('[data-action]');
  if (!el || el.disabled) return;
  actions[el.dataset.action]?.(el);
});

document.addEventListener('input', (ev) => {
  const el = ev.target;
  if (el.dataset.field && ui.draft) {
    setPath(ui.draft, el.dataset.field, el.dataset.num ? Number(el.value) : el.value);
    if (el.dataset.field === 'headache.intensity') document.getElementById('intensity-out').textContent = el.value;
  } else if (el.dataset.setting) {
    setPath(state, el.dataset.setting, el.value);
    commit();
  }
});

document.addEventListener('change', (ev) => {
  if (ev.target.id !== 'restore-file' || !ev.target.files[0]) return;
  ev.target.files[0].text().then((text) => {
    const data = JSON.parse(text);
    if (!data || typeof data.entries !== 'object') throw new Error('not a backup');
    if (!confirm('Replace everything on this device with this backup?')) return;
    state = normalize(data);
    commit();
    render();
  }).catch(() => alert('That file does not look like a Clary backup.'));
});

// Chart tooltips: hover or keyboard focus on a bar.
function showTip(el) {
  const r = el.getBoundingClientRect();
  $tip.textContent = el.dataset.tip;
  $tip.hidden = false;
  const w = $tip.offsetWidth;
  $tip.style.left = `${Math.min(window.innerWidth - w - 8, Math.max(8, r.left + r.width / 2 - w / 2))}px`;
  $tip.style.top = `${window.scrollY + r.top - $tip.offsetHeight - 6}px`;
}
for (const [on, off] of [['pointerover', 'pointerout'], ['focusin', 'focusout']]) {
  document.addEventListener(on, (ev) => { const el = ev.target.closest?.('[data-tip]'); if (el) showTip(el); });
  document.addEventListener(off, (ev) => { if (ev.target.closest?.('[data-tip]')) $tip.hidden = true; });
}

document.addEventListener('keydown', (ev) => {
  if (ev.key === 'Escape' && !$modal.hidden) actions['close-modal']();
});

// Service worker updates: ask before switching, so an open check-in is never
// interrupted mid-edit by a reload the user did not choose.
let waitingWorker = null;
function showUpdateBanner(worker) {
  waitingWorker = worker;
  if (document.getElementById('update-banner')) return;
  const bar = document.createElement('div');
  bar.id = 'update-banner';
  bar.className = 'update-banner';
  bar.innerHTML = '<span>A new version of Clary is ready.</span><button class="btn ghost" data-action="apply-update">Refresh</button>';
  document.body.prepend(bar);
}
actions['apply-update'] = () => waitingWorker?.postMessage('skipWaiting');

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js').then((reg) => {
    reminders.sync(state);
    if (reg.waiting && navigator.serviceWorker.controller) showUpdateBanner(reg.waiting);
    reg.addEventListener('updatefound', () => {
      const fresh = reg.installing;
      fresh?.addEventListener('statechange', () => {
        if (fresh.state === 'installed' && navigator.serviceWorker.controller) showUpdateBanner(reg.waiting || fresh);
      });
    });
  }).catch(() => {});
  let reloaded = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (reloaded) return;
    reloaded = true;
    location.reload();
  });
}

if (location.hash === '#checkin' && state.profile.onboarded) openCheckin(today()); else render();
