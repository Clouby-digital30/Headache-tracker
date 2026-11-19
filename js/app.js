import {
  TRIGGER_GROUPS, PERIOD_LEVELS, HEADACHE_TYPES, DURATIONS, ONSET, LOCATIONS, HEADACHE_SYMPTOMS, IMPACT, RELIEF,
  MENO_SYMPTOMS, STAGES, DERIVED_LABELS, MILESTONES, SPECIES, CARDS,
} from './data.js';
import {
  load, save, today, addDays, parseDate, toDateStr, emptyEntry, streaks, defaultState, normalize, backupDue,
  swapDefaultMeds,
} from './store.js';
import {
  findPatterns, describePattern, summarize, monthly, byWeekday, medDaysLast30, medOveruse, cycleInsight, mostLogged,
} from './insights.js';
import { gardenScene, flower, speciesFor } from './garden.js';
import { barChart, compareBars, rankList } from './charts.js';
import { download, toCsv } from './export.js';
import { t, LOCALE } from './i18n.js';
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

const lang = () => state.settings.lang;
const T = (key, vars) => t(lang(), key, vars);
const locale = () => LOCALE[lang()] || 'en';

// Applies the chosen theme before first paint, and again whenever it changes.
function applyTheme() {
  const th = state.settings.theme;
  document.documentElement.dataset.theme = th === 'auto' ? '' : th;
  const dark = th === 'dark' || (th === 'auto' && matchMedia('(prefers-color-scheme: dark)').matches);
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
// Every data.js list holds { en, nl } labels; this map resolves an id to the
// current language's text. Custom (user-typed) triggers are plain strings.
const LABELS = new Map();
for (const g of TRIGGER_GROUPS) for (const [id, label] of g.items) LABELS.set(id, label);
for (const list of [PERIOD_LEVELS, HEADACHE_TYPES, DURATIONS, ONSET, LOCATIONS, HEADACHE_SYMPTOMS, IMPACT, RELIEF, MENO_SYMPTOMS]) {
  for (const [id, label] of list) LABELS.set(id, label);
}
function labelOf(id) {
  if (!id) return '';
  const custom = state.settings.customTriggers.find((c) => c.id === id);
  if (custom) return custom.label;
  const entry = LABELS.get(id);
  return entry ? (entry[lang()] || entry.en) : id;
}
const factorPhrase = (id) => {
  const d = DERIVED_LABELS[id];
  return d ? (d[lang()] || d.en) : `“${labelOf(id)}”`;
};

const niceDate = (str, opts = { weekday: 'long', day: 'numeric', month: 'long' }) => parseDate(str).toLocaleDateString(locale(), opts);
// A known Monday, used only to turn a weekday index (0=Mon..6=Sun) into a
// locale-correct short name; the actual date is irrelevant.
const weekdayLabel = (index) => new Date(2024, 0, 1 + index).toLocaleDateString(locale(), { weekday: 'short' });
const monthLabel = (year, month) => new Date(year, month, 1).toLocaleDateString(locale(), { month: 'short' });

function lastBackupText(ts) {
  if (!ts) return T('lastBackupNever');
  const days = Math.floor((Date.now() - ts) / 86400000);
  if (days <= 0) return T('lastBackupToday');
  if (days === 1) return T('lastBackupYesterday');
  return T('lastBackupDays', { n: days });
}
const dayNumber = (str) => Math.round(parseDate(str).getTime() / 86400000);
const cardFor = (str) => { const c = CARDS[lang()] || CARDS.en; return c[dayNumber(str) % c.length]; };

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
// Like chips(), but for a [id, {en, nl}] option list from data.js.
const L = (list) => list.map(([id, label]) => [id, label[lang()] || label.en]);

function scale(field, value, low, high) {
  return `<div class="scale">
    <div class="scale-dots">${[1, 2, 3, 4, 5].map((n) =>
    `<button type="button" class="dot${value === n ? ' on' : ''}" aria-pressed="${value === n}" aria-label="${T('ofFive', { n })}"
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
  const langPicker = `<div class="chips lang-pick">
    <button class="chip${s.lang === 'en' ? ' on' : ''}" data-action="setting" data-field="settings.lang" data-value="en">English</button>
    <button class="chip${s.lang === 'nl' ? ' on' : ''}" data-action="setting" data-field="settings.lang" data-value="nl">Nederlands</button>
  </div>`;
  return `<section class="onboard">
    <div class="brand-mark">${logo()}</div>
    <p class="eyebrow center">${T('chooseLanguage')}</p>
    ${langPicker}
    <h1>${T('welcomeTitle')}</h1>
    <p class="lead">${T('welcomeLead')}</p>
    <div class="card">
      <label class="field"><span>${T('nameQuestion')} <em>${T('optional')}</em></span>
        <input type="text" id="ob-name" value="${esc(p.name)}" maxlength="30" autocomplete="given-name"></label>
      <div class="field"><span>${T('stageQuestion')}</span>
        ${chips('profile.stage', L(STAGES), p.stage, false).replace(/data-action="pick"/g, 'data-action="setting"')}
      </div>
      <div class="field"><span>${T('hrtQuestion')}</span>
        ${chips('settings.usesHrt', [['yes', T('yes')], ['no', T('no')]], s.usesHrt ? 'yes' : 'no', false).replace(/data-action="pick"/g, 'data-action="setting"')}
      </div>
      <label class="field"><span>${T('reminderTimeQuestion')}</span>
        <input type="time" id="ob-time" value="${esc(s.reminderTime)}"></label>
    </div>
    <p class="fine">${T('onboardFine')}</p>
    <button class="btn primary big" data-action="finish-onboarding">${T('startMyGarden')}</button>
  </section>`;
}

function greeting() {
  const h = new Date().getHours();
  const part = T(h < 12 ? 'goodMorning' : h < 18 ? 'goodAfternoon' : 'goodEvening');
  return state.profile.name ? `${part}, ${esc(state.profile.name)}` : part;
}

function summaryLine(e) {
  const bits = [];
  if (e.headache.had) {
    const kind = e.headache.type ? ` (${labelOf(e.headache.type).toLowerCase()})` : '';
    bits.push(`${T('headacheIntensity')} ${e.headache.intensity}/10${kind}`);
  } else {
    bits.push(T('noHeadache'));
  }
  if (e.period !== 'none') bits.push(`${T('period')}: ${labelOf(e.period).toLowerCase()}`);
  if (e.stress) bits.push(`${T('stress')} ${e.stress}/5`);
  if (e.sleep) bits.push(`${T('lastNightSleep')} ${e.sleep}/5`);
  return bits.map(esc).join(' · ');
}

// A short sentence plus a track spanning the earliest-to-latest estimate, with
// today marked on it. The track's two ends are the whole range, so the band
// covers it in full; only the "today" marker needs a position.
function cycleCard(c, t0) {
  if (!c) return '';
  const span = Math.max(1, (parseDate(c.latest) - parseDate(c.earliest)) / 86400000);
  const nowPos = Math.min(100, Math.max(0, Math.round(((parseDate(t0) - parseDate(c.earliest)) / 86400000 / span) * 100)));
  const when = c.daysUntil > 1 ? T('cycleInAbout', { n: c.daysUntil })
    : c.daysUntil === 1 ? T('cycleTomorrow') : c.daysUntil === 0 ? T('cycleAroundToday')
      : c.daysUntil === -1 ? T('cycleDayAgo') : T('cycleDaysAgo', { n: Math.abs(c.daysUntil) });
  return `<div class="card">
    <p class="eyebrow">${T('yourCycle')}</p>
    <p>${T('cycleBasedOn', { n: c.cycleCount + 1, when })}</p>
    <div class="cycle-track"><span class="band" style="left:0;width:100%"></span><span class="now" style="left:${nowPos}%"></span></div>
    <div class="cycle-ends"><span>${niceDate(c.earliest, { day: 'numeric', month: 'short' })}</span><span>${niceDate(c.latest, { day: 'numeric', month: 'short' })}</span></div>
    ${!c.regular ? `<p class="hint">${T('cycleIrregular')}</p>` : ''}
  </div>`;
}

function viewToday() {
  const t0 = today(), y = addDays(t0, -1);
  const done = state.entries[t0];
  const st = streaks(state.entries);
  const pat = findPatterns(state.entries);
  const medDays = medDaysLast30(state.entries, t0);
  const cycle = state.profile.stage !== 'none' ? cycleInsight(state.entries, t0) : null;

  const hero = done
    ? `<div class="card hero done">
        <p class="eyebrow">${T('checkinDoneEyebrow')}</p>
        <p class="summary">${summaryLine(done)}</p>
        <button class="btn ghost" data-action="open-checkin" data-date="${t0}">${T('editToday')}</button>
      </div>
      <div class="card selfcare"><p class="eyebrow">${T('todaysCard')}</p><p class="quote">${esc(cardFor(t0))}</p></div>`
    : `<div class="card hero">
        <p class="eyebrow">${niceDate(t0)}</p>
        <h2>${T('howFeelingToday')}</h2>
        <p>${T('checkinPitch')}</p>
        <button class="btn primary big" data-action="open-checkin" data-date="${t0}">${T('startCheckin')}</button>
      </div>`;

  const catchUp = !state.entries[y] && st.total > 0
    ? `<button class="link-row" data-action="open-checkin" data-date="${y}"><span>${T('missedYesterday')}</span><span aria-hidden="true">›</span></button>`
    : '';

  const backupNote = backupDue(state)
    ? `<div class="card backup-nudge">
        <p class="eyebrow">${T('backupKeepSafe')}</p>
        <p>${T(state.lastBackupAt ? 'backupFewWeeks' : 'backupNever')} ${T('backupExplain')}</p>
        <div class="btn-row">
          <button class="btn primary" data-action="backup">${T('saveBackupNow')}</button>
          <button class="btn ghost" data-action="snooze-backup">${T('remindLater')}</button>
        </div>
      </div>`
    : '';

  let insight = '';
  if (!pat.ready) {
    insight = `<div class="card"><p class="eyebrow">${T('yourPatterns')}</p>
      <p>${T('patternsNeedTime', { n: pat.needed })}</p>
      <div class="progress"><span style="width:${Math.round(((14 - pat.needed) / 14) * 100)}%"></span></div></div>`;
  } else if (pat.risks.length) {
    const p = pat.risks[0];
    insight = `<div class="card"><p class="eyebrow">${T('patternNoticed')}</p>
      <p>${esc(describePattern(p, factorPhrase(p.id), lang()))}</p>
      <button class="btn ghost" data-action="go" data-view="insights">${T('seeAllInsights')}</button></div>`;
  }

  const medNote = medDays >= 10
    ? `<div class="card note"><p class="eyebrow">${T('worthMentioning')}</p>
        <p>${T('painRelief30', { n: medDays })}</p></div>`
    : '';

  return `<header class="top"><h1>${greeting()}</h1></header>
    ${hero}${catchUp}${backupNote}
    <button class="card garden-peek" data-action="go" data-view="garden" aria-label="${T('openYourGarden')}">
      ${gardenScene(st.total)}
      <div class="peek-stats"><span><strong>${st.total}</strong> ${T(st.total === 1 ? 'bloomSingular' : 'bloomPlural')}</span><span><strong>${st.current}</strong> ${T('dayStreak')}</span></div>
    </button>
    ${cycleCard(cycle, t0)}
    ${insight}${medNote}`;
}

function viewCheckin() {
  const d = ui.draft, date = ui.draftDate, isToday = date === today();
  const s = state.settings;
  const tracked = s.trackedTriggers.map((id) => [id, labelOf(id)]);
  const h = d.headache;

  const headacheQuick = h.had ? `
    <div class="sub">
      <label class="field"><span>${T('howStrongWorst')} <output id="intensity-out">${h.intensity}</output>/10</span>
        <input type="range" min="1" max="10" step="1" value="${h.intensity}" data-field="headache.intensity" data-num="1" aria-label="${T('intensityAria')}">
        <div class="scale-ends"><span>${T('mild')}</span><span>${T('unbearable')}</span></div></label>
      <div class="field"><span>${T('whatKind')}</span>${chips('headache.type', L(HEADACHE_TYPES), h.type, false)}</div>
    </div>` : '';

  const headacheMore = h.had ? `
    <div class="field"><span>${T('howDidItStart')}</span>${chips('headache.onset', L(ONSET), h.onset, false)}</div>
    <div class="field"><span>${T('howLongDidItLast')}</span>${chips('headache.duration', L(DURATIONS), h.duration, false)}</div>
    <div class="field"><span>${T('whereDidYouFeelIt')}</span>${chips('headache.locations', L(LOCATIONS), h.locations, true)}</div>
    <div class="field"><span>${T('whatCameWithIt')}</span>${chips('headache.symptoms', L(HEADACHE_SYMPTOMS), h.symptoms, true)}</div>
    <div class="field"><span>${T('howMuchAffect')}</span>${chips('headache.impact', L(IMPACT), h.impact, false)}</div>
    <div class="field"><span>${T('didYouTakeAnything')}</span>${chips('headache.meds', s.meds.map((m) => [m, m]), h.meds, true)}</div>
    ${h.meds.length ? `<div class="field"><span>${T('didItHelp')}</span>${chips('headache.relief', L(RELIEF), h.relief, false)}</div>` : ''}` : '';

  const more = ui.showMore ? `
    <div class="card">
      <h3>${T('moreDetail')}</h3>
      ${headacheMore}
      ${s.trackMeno ? `<div class="field"><span>${T('menopauseSymptoms')}</span>${chips('meno', L(MENO_SYMPTOMS), d.meno, true)}</div>` : ''}
      ${s.usesHrt ? `<div class="field"><span>${T('didYouTakeHrt')}</span>${chips('hrt', [['yes', T('yes')], ['no', T('no')]], d.hrt ? 'yes' : 'no', false)}</div>` : ''}
      <label class="field"><span>${T('hoursOfSleep')}</span>
        <input type="number" inputmode="decimal" min="0" max="16" step="0.5" value="${esc(d.sleepHours)}" data-field="sleepHours" placeholder="${T('egSeven')}"></label>
      <div class="field"><span>${T('mood')}</span>${scale('mood', d.mood, T('low'), T('bright'))}</div>
      <label class="field"><span>${T('notes')}</span>
        <textarea rows="3" data-field="notes" maxlength="1000" placeholder="${T('notesPlaceholder')}">${esc(d.notes)}</textarea></label>
    </div>` : '';

  const quickActions = ui.draftIsNew && state.entries[addDays(date, -1)]
    ? `<button class="link-row" data-action="copy-yesterday"><span>${T('copyYesterday')}</span><span aria-hidden="true">›</span></button>`
    : !ui.draftIsNew
      ? `<button class="link-row danger" data-action="delete-checkin" data-date="${date}"><span>${T('clearDay')}</span><span aria-hidden="true">×</span></button>`
      : '';

  return `<header class="top with-back">
      <button class="icon-btn" data-action="close-checkin" aria-label="${T('back')}">‹</button>
      <div><p class="eyebrow">${T(isToday ? 'today' : 'lookingBack')}</p><h1>${niceDate(date)}</h1></div>
    </header>
    ${quickActions}
    <div class="card">
      <h3>${T(isToday ? 'anyHeadacheToday' : 'anyHeadacheThatDay')}</h3>
      ${chips('headache.had', [['no', T('noHeadache')], ['yes', T('yes')]], h.had ? 'yes' : 'no', false)}
      ${headacheQuick}
    </div>
    ${state.profile.stage !== 'none' ? `<div class="card"><h3>${T('period')}</h3>${chips('period', L(PERIOD_LEVELS), d.period, false)}</div>` : ''}
    <div class="card">
      <h3>${T('stress')}</h3>${scale('stress', d.stress, T('calm'), T('veryStressed'))}
      <h3 class="gap">${T('lastNightSleep')}</h3>${scale('sleep', d.sleep, T('poor'), T('great'))}
    </div>
    <div class="card">
      <h3>${T('anythingFromList')}</h3>
      <p class="hint">${T('tapWhatApplied')}</p>
      ${chips('triggers', tracked, d.triggers, true)}
    </div>
    ${more}
    <button class="btn ghost wide" data-action="toggle-more">${T(ui.showMore ? 'hideExtraDetail' : 'addMoreDetail')}</button>
    <div class="save-bar"><button class="btn primary big" data-action="save-checkin">${T('saveCheckin')}</button></div>`;
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
  const t0 = today();
  const cycle = state.profile.stage !== 'none' ? cycleInsight(state.entries, t0) : null;
  let cells = '';
  for (let i = 0; i < offset; i++) cells += '<span class="cal-cell empty"></span>';
  for (let d = 1; d <= days; d++) {
    const str = `${ui.month}-${String(d).padStart(2, '0')}`;
    const e = state.entries[str];
    const future = str > t0;
    const period = e && e.period !== 'none';
    const predicted = !e && cycle && str >= cycle.earliest && str <= cycle.latest;
    const desc = e ? (e.headache.had ? T('ariaHeadacheOf10', { n: e.headache.intensity }) : T('legendNoHeadache')) : T('ariaNoCheckin');
    const aria = `${niceDate(str)}: ${desc}${period ? T('ariaPeriodSuffix') : ''}${predicted ? T('ariaPredictedSuffix') : ''}`;
    cells += `<button class="cal-cell ${intensityClass(e)}${str === t0 ? ' today' : ''}${predicted ? ' predicted' : ''}" ${future ? 'disabled' : ''}
      data-action="open-checkin" data-date="${str}" aria-label="${esc(aria)}">
      <span class="num">${d}</span>${period ? '<span class="drop" aria-hidden="true"></span>' : ''}</button>`;
  }
  const s = summarize(state.entries, `${ui.month}-01`, `${ui.month}-31`);
  const weekdayNames = [0, 1, 2, 3, 4, 5, 6].map((i) => weekdayLabel(i)[0].toUpperCase());
  return `<header class="top"><h1>${T('calendar')}</h1></header>
    <div class="card">
      <div class="cal-head">
        <button class="icon-btn" data-action="month" data-step="-1" aria-label="${T('previousMonth')}">‹</button>
        <h2>${first.toLocaleDateString(locale(), { month: 'long', year: 'numeric' })}</h2>
        <button class="icon-btn" data-action="month" data-step="1" aria-label="${T('nextMonth')}" ${ui.month >= t0.slice(0, 7) ? 'disabled' : ''}>›</button>
      </div>
      <div class="cal-grid names">${weekdayNames.map((n) => `<span>${n}</span>`).join('')}</div>
      <div class="cal-grid">${cells}</div>
      <div class="legend">
        <span><i class="sw clear"></i>${T('legendNoHeadache')}</span><span><i class="sw h1"></i>${T('legendMild')}</span>
        <span><i class="sw h2"></i>${T('legendModerate')}</span><span><i class="sw h3"></i>${T('legendSevere')}</span>
        <span><i class="drop"></i>${T('legendPeriod')}</span>${cycle ? `<span><i class="sw predicted-sw"></i>${T('legendPredicted')}</span>` : ''}
      </div>
    </div>
    <div class="tiles">
      ${tile(s.logged, T('checkins'))}${tile(s.headacheDays, T('headacheDays'))}${tile(s.periodDays, T('periodDays'))}
    </div>
    <p class="hint center">${T('tapAnyDay')}</p>`;
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
    <p>${esc(describePattern(p, factorPhrase(p.id), lang()))}</p>
    ${compareBars(p.withRate, p.withoutRate, T('withLabel'), T('withoutLabel'))}
    <p class="meta">${T(p.strong ? 'consistentPattern' : 'earlySignal')} · ${T('basedOnDays', { n: p.days })}</p>
  </div>`;
}

function viewInsights() {
  const { from, to } = rangeBounds();
  const s = summarize(state.entries, from, to);
  const pat = findPatterns(state.entries);
  const months = monthly(state.entries, ui.range === 30 ? 3 : ui.range === 90 ? 6 : 12, to);
  const week = byWeekday(state.entries, from, to);
  const ranges = [[30, T('range30')], [90, T('range90')], [365, T('range365')], [0, T('rangeAll')]];
  const cycle = state.profile.stage !== 'none' ? cycleInsight(state.entries, to) : null;
  const logged = mostLogged(state.entries, from, to);
  const mo = medOveruse(state.entries, to);

  const patterns = !pat.ready
    ? `<p>${T('patternsNeedTimeFull', { n: pat.needed })}</p>`
    : pat.risks.length
      ? pat.risks.slice(0, 8).map(patternCard).join('')
      : `<p>${T('noClearTriggers')}</p>`;

  const helpers = pat.ready && pat.helpers.length
    ? `<div class="card"><h2>${T('fewerHeadaches')}</h2>${pat.helpers.slice(0, 4).map(patternCard).join('')}</div>`
    : '';

  const mostLoggedCard = logged.items.length
    ? `<div class="card"><h2>${T('mostLogged')}</h2>
        <p class="hint">${T('mostLoggedExplain')}</p>
        ${rankList(logged.items.map((i) => ({ label: esc(labelOf(i.id)), value: i.count })))}
      </div>`
    : '';

  const medNote = mo.flag
    ? `<div class="card note"><p class="eyebrow">${T('worthMentioning')}</p>
        <p>${T('medNote3mo', { n: mo.perMonth.toFixed(1) })}</p></div>`
    : '';

  return `<header class="top"><h1>${T('insights')}</h1></header>
    <div class="chips range" role="group" aria-label="${T('rangeAria')}">${ranges.map(([n, l]) =>
    `<button class="chip${ui.range === n ? ' on' : ''}" aria-pressed="${ui.range === n}" data-action="range" data-value="${n}">${l}</button>`).join('')}</div>
    <div class="tiles four">
      ${tile(s.headacheDays, T('headacheDays'))}${tile(s.migraineDays, T('migraineDays'))}
      ${tile(s.headacheDays ? s.avgIntensity.toFixed(1) : '–', T('averageIntensity'))}${tile(s.medDays, T('daysWithPainRelief'))}
    </div>
    ${medNote}
    ${cycleCard(cycle, to)}
    <div class="card"><h2>${T('headacheDaysPerMonth')}</h2>
      ${barChart(months.map((x) => {
    const label = monthLabel(x.year, x.month);
    return { label, value: x.headacheDays, tip: T('tooltipMonth', { label, year: x.year, days: x.headacheDays, logged: x.logged }) };
  }), { ariaLabel: T('headacheDaysPerMonth') })}
    </div>
    <div class="card"><h2>${T('headacheDaysByWeekday')}</h2>
      ${barChart(week.map((x) => {
    const label = weekdayLabel(x.index);
    return { label, value: x.headacheDays, tip: T('tooltipWeekday', { label, days: x.headacheDays, logged: x.logged }) };
  }), { ariaLabel: T('headacheDaysByWeekday') })}
    </div>
    <div class="card"><h2>${T('yourPossibleTriggers')}</h2>
      <p class="hint">${T('patternsExplain')}</p>
      ${patterns}
    </div>
    ${helpers}
    ${mostLoggedCard}
    <div class="card"><h2>${T('takeItWithYou')}</h2>
      <p class="hint">${T('reportOrSpreadsheet')}</p>
      <div class="btn-row">
        <button class="btn primary" data-action="go" data-view="report">${T('doctorReportPdf')}</button>
        <button class="btn ghost" data-action="export-csv">${T('downloadCsv')}</button>
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
    return `<tr><td>${d}</td><td>${h.intensity}</td><td>${esc(labelOf(h.type))}</td><td>${esc(labelOf(h.onset))}</td><td>${esc(labelOf(h.duration))}</td>
      <td>${esc(h.symptoms.map(labelOf).join(', '))}</td><td>${esc(h.meds.join(', '))}${h.relief ? ` (${esc(labelOf(h.relief).toLowerCase())})` : ''}</td>
      <td>${e.period !== 'none' ? esc(labelOf(e.period)) : ''}</td><td>${esc(e.triggers.map(labelOf).join(', '))}</td></tr>`;
  }).join('');
  return `<header class="top with-back no-print">
      <button class="icon-btn" data-action="go" data-view="insights" aria-label="${T('back')}">‹</button>
      <h1>${T('doctorReport')}</h1>
    </header>
    <div class="btn-row no-print"><button class="btn primary" data-action="print">${T('printOrSave')}</button></div>
    <article class="report card">
      <h2>${state.profile.name ? T('headacheReportFor', { name: esc(state.profile.name) }) : T('headacheReport')}</h2>
      <p>${niceDate(from, { day: 'numeric', month: 'long', year: 'numeric' })} ${T('toDate')} ${niceDate(to, { day: 'numeric', month: 'long', year: 'numeric' })} · ${T('daysRecorded', { n: s.logged })}</p>
      <table class="kv">
        <tr><th>${T('kvHeadacheDays')}</th><td>${s.headacheDays}</td></tr>
        <tr><th>${T('kvMigraine')}</th><td>${s.migraineDays}</td></tr>
        <tr><th>${T('kvAvgIntensity')}</th><td>${s.headacheDays ? `${s.avgIntensity.toFixed(1)} / 10` : '–'}</td></tr>
        <tr><th>${T('kvPainRelief')}</th><td>${s.medDays}</td></tr>
        <tr><th>${T('kvRest')}</th><td>${s.restDays}</td></tr>
        <tr><th>${T('kvPeriodDays')}</th><td>${s.periodDays}</td></tr>
      </table>
      <h3>${T('perMonth')}</h3>
      <table><tr><th>${T('colMonth')}</th><th>${T('colDaysRecorded')}</th><th>${T('colHeadacheDays')}</th></tr>
        ${months.map((m) => `<tr><td>${monthLabel(m.year, m.month)} ${m.year}</td><td>${m.logged}</td><td>${m.headacheDays}</td></tr>`).join('')}</table>
      <h3>${T('observedPatterns')}</h3>
      ${pat.ready && pat.risks.length
    ? `<ul>${pat.risks.slice(0, 8).map((p) => `<li>${esc(describePattern(p, factorPhrase(p.id), lang()))} ${T('daysSuffix', { n: p.days })}</li>`).join('')}</ul>`
    : `<p>${T('noClearPatterns')}</p>`}
      <h3>${T('headacheLog')}</h3>
      ${rows ? `<table class="log"><tr><th>${T('colDate')}</th><th>${T('colIntensity')}</th><th>${T('colType')}</th><th>${T('colOnset')}</th><th>${T('colDuration')}</th><th>${T('colSymptoms')}</th><th>${T('colMedication')}</th><th>${T('colPeriod')}</th><th>${T('colLoggedFactors')}</th></tr>${rows}</table>` : `<p>${T('noHeadachesRecorded')}</p>`}
      <p class="fine">${T('reportDisclaimer')}</p>
    </article>`;
}

function viewGarden() {
  const st = streaks(state.entries);
  const next = MILESTONES.find((m) => m.at > st.total);
  const earned = MILESTONES.filter((m) => m.at <= st.total).reverse();
  return `<header class="top"><h1>${T('yourGarden')}</h1></header>
    <div class="card flush">${gardenScene(st.total)}</div>
    <div class="tiles">${tile(st.total, T(st.total === 1 ? 'bloomSingular' : 'bloomPlural'))}${tile(st.current, T('dayStreak'))}${tile(st.best, T('longestStreak'))}</div>
    <p class="hint center">${T('gardenNeverWilts')}</p>
    ${next ? `<div class="card"><p class="eyebrow">${T('nextMilestone')}</p><h2>${esc(next.title[lang()] || next.title.en)}</h2>
      <p>${T(next.at - st.total === 1 ? 'checkinsToGoSingular' : 'checkinsToGoPlural', { n: next.at - st.total })}</p>
      <div class="progress"><span style="width:${Math.round((st.total / next.at) * 100)}%"></span></div></div>` : ''}
    <div class="card"><h2>${T('flowers')}</h2><div class="species">${SPECIES.map((sp, i) => {
    const open = st.total >= sp.at;
    return `<div class="sp${open ? '' : ' locked'}"><svg viewBox="-14 -50 28 52" aria-hidden="true">${flower(sp.id, i)}</svg>
        <span>${open ? esc(sp.name[lang()] || sp.name.en) : T('atCount', { n: sp.at })}</span></div>`;
  }).join('')}</div></div>
    ${earned.length ? `<div class="card"><h2>${T('milestones')}</h2><ul class="milestones">${earned.map((m) =>
    `<li><strong>${esc(m.title[lang()] || m.title.en)}</strong><span>${esc(m.text[lang()] || m.text.en)}</span></li>`).join('')}</ul></div>` : ''}
    <div class="card selfcare"><p class="eyebrow">${T('todaysCard')}</p><p class="quote">${esc(cardFor(today()))}</p></div>`;
}

function viewSettings() {
  const s = state.settings, p = state.profile;
  const perm = reminders.permission();
  const permText = perm === 'granted' ? T('permGranted')
    : perm === 'denied' ? T('permDenied')
      : perm === 'unsupported' ? T('permUnsupported')
        : T('permDefault');
  const toSetting = (html) => html.replace(/data-action="pick"/g, 'data-action="setting"');

  const library = ui.showLibrary ? TRIGGER_GROUPS.map((g) => `
      <div class="field"><span>${g.label[lang()] || g.label.en}</span>
        ${toSetting(chips('settings.trackedTriggers', L(g.items), s.trackedTriggers, true))}</div>`).join('') : '';

  return `<header class="top"><h1>${T('settings')}</h1></header>
    <div class="card"><h2>${T('appearance')}</h2>
      <div class="field"><span>${T('language')}</span>
        <div class="chips">
          <button class="chip${s.lang === 'en' ? ' on' : ''}" data-action="setting" data-field="settings.lang" data-value="en">English</button>
          <button class="chip${s.lang === 'nl' ? ' on' : ''}" data-action="setting" data-field="settings.lang" data-value="nl">Nederlands</button>
        </div>
      </div>
      <div class="field"><span>${T('theme')}</span>${toSetting(chips('settings.theme',
    [['auto', T('matchDevice')], ['light', T('light')], ['dark', T('dark')]], s.theme, false))}</div>
    </div>
    <div class="card"><h2>${T('aboutYou')}</h2>
      <label class="field"><span>${T('name')}</span><input type="text" data-setting="profile.name" value="${esc(p.name)}" maxlength="30"></label>
      <div class="field"><span>${T('cycle')}</span>${toSetting(chips('profile.stage', L(STAGES), p.stage, false))}</div>
      <div class="field"><span>${T('hrtSetting')}</span>${toSetting(chips('settings.usesHrt', [['yes', T('yes')], ['no', T('no')]], s.usesHrt ? 'yes' : 'no', false))}</div>
      <div class="field"><span>${T('trackMenoSetting')}</span>${toSetting(chips('settings.trackMeno', [['yes', T('yes')], ['no', T('no')]], s.trackMeno ? 'yes' : 'no', false))}</div>
    </div>
    <div class="card"><h2>${T('dailyReminder')}</h2>
      <div class="field"><span>${T('remindEveryDay')}</span>${toSetting(chips('settings.reminderOn', [['yes', T('on')], ['no', T('off')]], s.reminderOn ? 'yes' : 'no', false))}</div>
      <label class="field"><span>${T('at')}</span><input type="time" data-setting="settings.reminderTime" value="${esc(s.reminderTime)}"></label>
      <p class="hint">${permText}</p>
      <p class="hint">${T('reminderNeverMisses')}</p>
      <button class="btn ghost" data-action="calendar-file">${T('addToCalendar')}</button>
    </div>
    <div class="card"><h2>${T('whatITrack')}</h2>
      <p class="hint">${T('factorsAppear', { n: s.trackedTriggers.length })}</p>
      <button class="btn ghost" data-action="toggle-library">${T(ui.showLibrary ? 'hideFullList' : 'chooseFullList')}</button>
      ${library}
      <div class="field"><span>${T('myOwnTriggers')}</span>
        <div class="chips">${s.customTriggers.filter((c) => !c.hidden).map((c) =>
    `<button class="chip on" data-action="remove-custom" data-id="${esc(c.id)}" aria-label="${T('removeAria', { label: esc(c.label) })}">${esc(c.label)} ×</button>`).join('') || `<span class="hint">${T('noneYet')}</span>`}</div>
        <div class="add-row"><input type="text" id="new-trigger" maxlength="40" placeholder="${T('newTriggerPlaceholder')}" aria-label="${T('newTriggerAria')}">
          <button class="btn ghost" data-action="add-custom">${T('add')}</button></div>
      </div>
    </div>
    <div class="card"><h2>${T('myMedication')}</h2>
      <div class="chips">${s.meds.map((m) =>
    `<button class="chip on" data-action="remove-med" data-id="${esc(m)}" aria-label="${T('removeAria', { label: esc(m) })}">${esc(m)} ×</button>`).join('')}</div>
      <div class="add-row"><input type="text" id="new-med" maxlength="40" placeholder="${T('newMedPlaceholder')}" aria-label="${T('newMedAria')}">
        <button class="btn ghost" data-action="add-med">${T('add')}</button></div>
    </div>
    <div class="card"><h2>${T('myData')}</h2>
      <p class="hint">${T('dataLivesHere')}</p>
      <p class="hint">${lastBackupText(state.lastBackupAt)}</p>
      <div class="btn-row">
        <button class="btn ghost" data-action="backup">${T('saveBackup')}</button>
        <button class="btn ghost" data-action="restore">${T('restoreBackup')}</button>
        <button class="btn ghost" data-action="export-csv">${T('downloadCsv')}</button>
      </div>
      <input type="file" id="restore-file" accept="application/json,.json" hidden>
      <button class="btn danger" data-action="wipe">${T('deleteAllData')}</button>
    </div>
    <div class="card"><h2>${T('aboutClary')}</h2>
      <p class="hint">${T('aboutClaryDiary')}</p>
      <p class="hint">${T('privacyLine')}</p>
      <p class="hint">${T('toInstall')}</p>
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
  const speciesName = sp.name[lang()] || sp.name.en;
  const bloomedLine = lang() === 'en'
    ? T('bloomedWithArticle', { article: /^[aeiou]/i.test(speciesName) ? 'An' : 'A', species: speciesName })
    : T('bloomedWithArticle', { species: speciesName });
  $modal.innerHTML = `<div class="sheet" role="dialog" aria-modal="true" aria-labelledby="reward-title">
    <svg class="bloom" viewBox="-22 -54 44 58" aria-hidden="true">${flower(sp.id, st.total - 1)}</svg>
    <h2 id="reward-title">${esc(bloomedLine)}</h2>
    <p>${st.total} ${T(st.total === 1 ? 'flowerSingular' : 'flowerPlural')} ${T('inYourGarden')}${st.current > 1 ? ` ${T('daysInRow', { n: st.current })}` : ''}</p>
    ${milestone ? `<div class="milestone"><p class="eyebrow">${T('milestoneLabel')}</p><strong>${esc(milestone.title[lang()] || milestone.title.en)}</strong><span>${esc(milestone.text[lang()] || milestone.text.en)}</span></div>` : ''}
    <div class="selfcare"><p class="eyebrow">${T('yourCardToday')}</p><p class="quote">${esc(cardFor(date))}</p></div>
    <button class="btn primary big" data-action="close-modal">${T('lovely')}</button>
  </div>`;
  $modal.hidden = false;
  $modal.querySelector('button').focus();
}

// ---------- render ----------
const VIEWS = {
  today: viewToday, checkin: viewCheckin, calendar: viewCalendar, insights: viewInsights,
  report: viewReport, garden: viewGarden, settings: viewSettings,
};
function navItems() {
  return [['today', T('navToday')], ['calendar', T('navCalendar')], ['insights', T('navInsights')], ['garden', T('navGarden')], ['settings', T('navSettings')]];
}
const NAV_ICONS = {
  today: '<circle cx="12" cy="12" r="4.2"/><path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M5.3 18.7l2.1-2.1M16.6 7.4l2.1-2.1"/>',
  calendar: '<rect x="3.5" y="5" width="17" height="15.5" rx="3"/><path d="M3.5 10h17M8 3v4M16 3v4"/>',
  insights: '<path d="M4 20V11M10 20V5M16 20v-7M21 20H3"/>',
  garden: '<path d="M12 21v-9"/><circle cx="12" cy="7.5" r="3.2"/><path d="M12 16c-3.5 0-5-2-5-4 3 0 5 1.500 5 4zM12 16c3.500 0 5-2 5-4-3 0-5 1.500-5 4z"/>',
  settings: '<circle cx="12" cy="12" r="3"/><path d="M12 3v2.500M12 18.500V21M3 12h2.500M18.500 12H21M5.600 5.600l1.800 1.800M16.600 16.600l1.800 1.800M5.600 18.400l1.800-1.800M16.600 7.400l1.800-1.800"/>',
};

function render(keepScroll = false) {
  const scroll = window.scrollY;
  document.documentElement.lang = lang();
  document.title = T('appTitle');
  if (!state.profile.onboarded) {
    $view.innerHTML = viewOnboarding();
    $nav.hidden = true;
    return;
  }
  $view.innerHTML = VIEWS[ui.view]();
  const hideNav = ui.view === 'checkin' || ui.view === 'report';
  $nav.hidden = hideNav;
  $nav.innerHTML = navItems().map(([id, label]) =>
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
const SINGLE_CHOICE_STICKY = new Set(['profile.stage', 'period', 'settings.theme', 'settings.lang']);

function applyPick(target, el) {
  const field = el.dataset.field;
  let value = el.dataset.num ? Number(el.dataset.value) : el.dataset.value;
  if (BOOL_FIELDS.has(field)) value = value === 'yes';
  if (el.dataset.multi) {
    const list = getPath(target, field);
    const i = list.indexOf(value);
    if (i >= 0) list.splice(i, 1); else list.push(value);
  } else {
    // tapping a selected single choice clears it, except for a handful of
    // settings that must always have some value.
    const current = getPath(target, field);
    const clearable = !BOOL_FIELDS.has(field) && !SINGLE_CHOICE_STICKY.has(field);
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
    if (!confirm(T('confirmDeleteCheckin'))) return;
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
    if (field === 'settings.lang') state.settings = swapDefaultMeds(state.settings, state.settings.lang);
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
    state.settings.trackedTriggers = state.settings.trackedTriggers.filter((c) => c !== el.dataset.id);
    const used = Object.values(state.entries).some((e) => e.triggers.includes(el.dataset.id));
    if (!used) state.settings.customTriggers = state.settings.customTriggers.filter((c) => c.id !== el.dataset.id);
    else state.settings.customTriggers.find((c) => c.id === el.dataset.id).hidden = true;
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
  'calendar-file': () => download('clary-reminder.ics', reminders.calendarFile(state.settings.reminderTime, lang()), 'text/calendar'),
  'export-csv': () => download(`clary-${today()}.csv`, toCsv(state.entries, labelOf, lang()), 'text/csv'),
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
    if (!confirm(T('confirmWipe'))) return;
    const keepLang = state.settings.lang;
    state = defaultState();
    state.settings.lang = keepLang;
    state.settings = swapDefaultMeds(state.settings, keepLang);
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
    if (!confirm(T('confirmRestore'))) return;
    state = normalize(data);
    commit();
    render();
  }).catch(() => alert(T('restoreBadFile')));
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
  bar.innerHTML = `<span>${T('updateReady')}</span><button class="btn ghost" data-action="apply-update">${T('refresh')}</button>`;
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
