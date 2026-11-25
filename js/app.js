import {
  TRIGGER_GROUPS, PERIOD_LEVELS, HEADACHE_TYPES, DURATIONS, ONSET, LOCATIONS, HEADACHE_SYMPTOMS, IMPACT, RELIEF,
  MENO_SYMPTOMS, QUICK_MENO_SYMPTOMS, SEVERITY, STAGES, DERIVED_LABELS, MILESTONES, SPECIES, CARDS,
  PACK_SPECIES, PACK_CARDS,
} from './data.js';
import {
  load, save, today, addDays, parseDate, toDateStr, emptyEntry, streaks, defaultState, normalize, backupDue,
  swapDefaultMeds,
} from './store.js';
import {
  findPatterns, describePattern, describeEnrichment, describeCombination, findCombinations, summarize, monthly,
  byWeekday, medDaysLast30, medOveruse, cycleInsight, mostLogged,
  medOveruseByClass, medClassByMonth, menstrualMigraineStat, menoSymptomCounts, trackingSpanWeeks, medDaysSinceRefill,
} from './insights.js';
import { gardenScene, flower, speciesFor } from './garden.js';
import { deviceTimezone, timezoneOptions } from './suntime.js';
import { barChart, compareBars, rankList } from './charts.js';
import { download, toCsv, downloadSvgAsPng } from './export.js';
import { t, LOCALE } from './i18n.js';
import * as reminders from './reminders.js';
import {
  BUY_URL, PACK_BUY_URL, TRIAL_LIMIT, trialUsed, isLicensed, trialExhausted, applyLicenseKey, revalidate, releaseDevice,
  isPackUnlocked, applyPackKey, revalidatePack, releasePack,
} from './license.js';

let state = load();
save(state); // persist any one-time migration (e.g. a newly introduced trigger) right away
const ui = {
  view: 'today',
  draft: null, draftDate: null, draftIsNew: false, showMore: false,
  month: today().slice(0, 7),
  range: 90,
  reward: null,
  showLibrary: false,
  licenseBusy: false, licenseMsg: null, licenseKeyDraft: '', paywallReturnDate: null, installReturnView: 'today',
  idm: null, // [bool|null, bool|null, bool|null] while the ID Migraine helper is open
  autoInstallPending: false, // true when Clary itself navigated to the install screen, so it may also fire the native Android prompt without waiting for a tap on our own button
  packBusy: false, packMsg: null, packKeyDraft: '', // "Garden & self-care" pack activation, mirrors the license fields above
};
// Re-confirm a stored license in the background; re-render if its status changed.
revalidate(state).then(() => { save(state); if (ui.view !== 'checkin') render(true); }).catch(() => {});
revalidatePack(state, 'gardenCare').then(() => { save(state); if (ui.view !== 'checkin') render(true); }).catch(() => {});

const lang = () => state.settings.lang;
const T = (key, vars) => t(lang(), key, vars);
const locale = () => LOCALE[lang()] || 'en';
// One decimal place, with the comma Dutch readers expect instead of a dot.
const fmt1 = (n) => n.toLocaleString(locale(), { minimumFractionDigits: 1, maximumFractionDigits: 1 });

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

const SEVERITY_LABELS = new Map(SEVERITY);
const severityLabel = (n) => { const l = SEVERITY_LABELS.get(Math.round(n)); return l ? (l[lang()] || l.en) : ''; };

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
// The "Garden & self-care" pack's extra species/cards, once bought - [] / {}
// otherwise, which reproduces the exact free behaviour everywhere below.
const packSpecies = () => (isPackUnlocked(state, 'gardenCare') ? PACK_SPECIES : []);
const gardenTimezone = () => state.settings.timezone || undefined; // '' falls through to the device's own
const cardFor = (str) => {
  const base = CARDS[lang()] || CARDS.en;
  const extra = isPackUnlocked(state, 'gardenCare') ? (PACK_CARDS[lang()] || PACK_CARDS.en) : [];
  const c = extra.length ? [...base, ...extra] : base;
  return c[dayNumber(str) % c.length];
};

// Medications the user opted into a refill reminder for, with how many
// logged days have used it since the last "I've refilled" tap - and whether
// that has reached the days' worth they said one refill covers.
function refillStatuses() {
  const resetAt = state.medRefillResetAt || {};
  return Object.entries(state.settings.medRefill || {})
    .filter(([, perRefill]) => perRefill > 0)
    .map(([med, perRefill]) => ({ med, perRefill, used: medDaysSinceRefill(state.entries, med, resetAt[med]) }));
}

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

// A small severity picker (light/moderate/severe) for one logged menopause
// symptom. Defaults to moderate when nothing has been picked yet, matching
// how old entries without a severity are read in insights.js.
function severityPicker(d, id) {
  const val = (d.menoSeverity && d.menoSeverity[id]) || 2;
  return `<div class="chips sm">${SEVERITY.map(([n, label]) =>
    `<button type="button" class="chip sm${val === n ? ' on' : ''}" aria-pressed="${val === n}"
      data-action="pick" data-field="menoSeverity.${id}" data-value="${n}" data-num="1">${esc(label[lang()] || label.en)}</button>`).join('')}</div>`;
}

// One severity picker per currently-logged menopause symptom, however it was
// selected (quick list or full list) - they share the same underlying array.
function menoSeverityFields(d) {
  if (!d.meno.length) return '';
  return d.meno.map((id) => `<div class="field tight"><span class="small-label">${esc(labelOf(id))} - ${T('menoSeverityLabel')}</span>${severityPicker(d, id)}</div>`).join('');
}

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
      <label class="field"><span>${T('gardenNameQuestion')} <em>${T('optional')}</em></span>
        <input type="text" id="ob-garden-name" value="${esc(p.gardenName)}" maxlength="30" placeholder="${T('gardenNamePlaceholder')}"></label>
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

  const due = refillStatuses().filter((r) => r.used >= r.perRefill);
  const refillNote = due.length
    ? `<div class="card note"><p class="eyebrow">${T('medRefillDueEyebrow')}</p>
        ${due.map((r) => `<p>${T('medRefillDueText', { med: esc(r.med), n: r.used })}</p>
          <button class="btn ghost" data-action="refill-done" data-id="${esc(r.med)}">${T('medRefillDoneButton')}</button>`).join('')}
      </div>`
    : '';

  return `<header class="top"><h1>${greeting()}</h1></header>
    ${hero}${catchUp}${backupNote}${refillNote}
    <button class="card garden-peek" data-action="go" data-view="garden" aria-label="${T('openYourGarden')}">
      ${gardenScene(st.total, { emptyText: T('gardenEmpty'), extraSpecies: packSpecies(), timezone: gardenTimezone() })}
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
      <div class="field"><span>${T('whatKind')}</span>${chips('headache.type', L(HEADACHE_TYPES), h.type, false)}
        <button type="button" class="link-inline" data-action="open-idm">${T('idmLinkText')}</button></div>
      <div class="field"><span>${T('howDidItStart')}</span>${chips('headache.onset', L(ONSET), h.onset, false)}</div>
      ${h.onset === 'sudden' ? `<p class="hint warning">${T('suddenOnsetWarning')}</p>` : ''}
    </div>` : '';

  const headacheMore = h.had ? `
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
    ${s.trackMeno ? `<div class="card">
      <h3>${T('quickMenoLabel')}</h3>
      ${chips('meno', L(MENO_SYMPTOMS.filter(([id]) => QUICK_MENO_SYMPTOMS.includes(id))), d.meno, true)}
      ${menoSeverityFields(d)}
    </div>` : ''}
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
  const extra = describeEnrichment(p, lang());
  return `<div class="pattern">
    <p>${esc(describePattern(p, factorPhrase(p.id), lang()))}</p>
    ${extra.map((x) => `<p class="hint">${esc(x)}</p>`).join('')}
    ${compareBars(p.withRate, p.withoutRate, T('withLabel'), T('withoutLabel'))}
    <p class="meta">${T(p.strong ? 'consistentPattern' : 'earlySignal')} · ${T('basedOnDays', { n: p.days })}</p>
  </div>`;
}

// A favourite menopause symptom always gets its own card in Insights and the
// report - even without a found pattern, since the honest answer ("no clear
// link yet") is itself useful to a user who picked this symptom as important.
function favoriteCard(pat, id) {
  const label = labelOf(id);
  if (!pat.ready) {
    return `<div class="pattern favorite"><p class="eyebrow">${esc(label)}</p><p>${T('favoriteNeedsTime')}</p></div>`;
  }
  const p = pat.allById.get(id);
  const isPattern = p && (pat.risks.some((r) => r.id === id) || pat.helpers.some((r) => r.id === id));
  if (isPattern) return patternCard(p);
  if (p) return `<div class="pattern favorite"><p class="eyebrow">${esc(label)}</p><p>${T('favoriteNoLinkYet', { n: p.days })}</p></div>`;
  return `<div class="pattern favorite"><p class="eyebrow">${esc(label)}</p><p>${T('favoriteNotLoggedYet')}</p></div>`;
}

function comboCard(c) {
  return `<div class="pattern">
    <p>${esc(describeCombination(c, factorPhrase(c.a), factorPhrase(c.b), lang()))}</p>
    <p class="meta">${T('basedOnDays', { n: c.days })}</p>
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

  const favoriteMeno = state.settings.trackMeno ? state.settings.favoriteMeno : [];
  const favoritesCard = favoriteMeno.length
    ? `<div class="card"><h2>${T('yourTopConcerns')}</h2>${favoriteMeno.map((id) => favoriteCard(pat, id)).join('')}</div>`
    : '';

  const combos = pat.ready ? findCombinations(state.entries, pat.risks.map((r) => r.id)) : [];
  const combosCard = combos.length
    ? `<div class="card"><h2>${T('combinedFactors')}</h2><p class="hint">${T('combinedFactorsExplain')}</p>${combos.slice(0, 4).map(comboCard).join('')}</div>`
    : '';

  const mostLoggedCard = logged.items.length
    ? `<div class="card"><h2>${T('mostLogged')}</h2>
        <p class="hint">${T('mostLoggedExplain')}</p>
        ${rankList(logged.items.map((i) => ({ label: esc(labelOf(i.id)), value: i.count })))}
      </div>`
    : '';

  const medNote = mo.flag
    ? `<div class="card note"><p class="eyebrow">${T('worthMentioning')}</p>
        <p>${T('medNote3mo', { n: fmt1(mo.perMonth) })}</p></div>`
    : '';

  return `<header class="top"><h1>${T('insights')}</h1></header>
    <div class="chips range" role="group" aria-label="${T('rangeAria')}">${ranges.map(([n, l]) =>
    `<button class="chip${ui.range === n ? ' on' : ''}" aria-pressed="${ui.range === n}" data-action="range" data-value="${n}">${l}</button>`).join('')}</div>
    <div class="tiles four">
      ${tile(s.headacheDays, T('headacheDays'))}${tile(s.migraineDays, T('migraineDays'))}
      ${tile(s.headacheDays ? fmt1(s.avgIntensity) : '–', T('averageIntensity'))}${tile(s.medDays, T('daysWithPainRelief'))}
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
    ${favoritesCard}
    ${combosCard}
    ${mostLoggedCard}
    <div class="card"><h2>${T('takeItWithYou')}</h2>
      <p class="hint">${T('reportOrSpreadsheet')}</p>
      <p class="hint">${T('eightWeeksNoteInsights', { weeks: trackingSpanWeeks(state.entries, to) })}</p>
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
  const strongRisks = pat.ready ? pat.risks.filter((p) => p.strong) : [];
  const combos = pat.ready ? findCombinations(state.entries, pat.risks.map((r) => r.id)) : [];
  const favoriteMeno = state.settings.trackMeno ? state.settings.favoriteMeno : [];
  const months = monthly(state.entries, 12, to).filter((m) => m.logged > 0);
  const weeks = trackingSpanWeeks(state.entries, to);
  const rows = Object.keys(state.entries).sort().filter((d) => d >= from && d <= to && state.entries[d].headache.had).map((d) => {
    const e = state.entries[d], h = e.headache;
    return `<tr><td>${d}</td><td>${h.intensity}</td><td>${esc(labelOf(h.type))}</td><td>${esc(labelOf(h.onset))}</td><td>${esc(labelOf(h.duration))}</td>
      <td>${esc(h.symptoms.map(labelOf).join(', '))}</td><td>${esc(h.meds.join(', '))}${h.relief ? ` (${esc(labelOf(h.relief).toLowerCase())})` : ''}</td>
      <td>${e.period !== 'none' ? esc(labelOf(e.period)) : ''}</td><td>${esc(e.triggers.map(labelOf).join(', '))}</td></tr>`;
  }).join('');

  // Medication detail: a rolling 3-month view regardless of the selected
  // range, since overuse is inherently assessed over 3+ months.
  const medClasses = medOveruseByClass(state.entries, to);
  const medMonths = medClassByMonth(state.entries, 3, to);
  const medFlags = [
    medClasses.triptan.flag ? T('medOveruseTriptanFlag', { n: fmt1(medClasses.triptan.perMonth) }) : '',
    medClasses.simple.flag ? T('medOveruseSimpleFlag', { n: fmt1(medClasses.simple.perMonth) }) : '',
  ].filter(Boolean);

  // Menopause and cycle: only shown where it applies to this user at all.
  const meno = state.settings.trackMeno ? menoSymptomCounts(state.entries, from, to) : null;
  const migraineStat = state.profile.stage !== 'none' ? menstrualMigraineStat(state.entries, 3) : null;
  const showMenoCycleSection = !!meno || (migraineStat && migraineStat.checked > 0);

  return `<header class="top with-back no-print">
      <button class="icon-btn" data-action="go" data-view="insights" aria-label="${T('back')}">‹</button>
      <h1>${T('doctorReport')}</h1>
    </header>
    <div class="btn-row no-print"><button class="btn primary" data-action="print">${T('printOrSave')}</button></div>
    <article class="report card">
      <h2>${state.profile.name ? T('headacheReportFor', { name: esc(state.profile.name) }) : T('headacheReport')}</h2>
      <p>${niceDate(from, { day: 'numeric', month: 'long', year: 'numeric' })} ${T('toDate')} ${niceDate(to, { day: 'numeric', month: 'long', year: 'numeric' })} · ${T('daysRecorded', { n: s.logged })}</p>
      <p class="fine">${T('trackingWeeksReport', { weeks })} ${T('trackingWeeksGuidance')}</p>
      <table class="kv">
        <tr><th>${T('kvHeadacheDays')}</th><td>${s.headacheDays}</td></tr>
        <tr><th>${T('kvMigraine')}</th><td>${s.migraineDays}</td></tr>
        <tr><th>${T('kvAuraDays')}</th><td>${s.auraDays}</td></tr>
        <tr><th>${T('kvAvgIntensity')}</th><td>${s.headacheDays ? `${fmt1(s.avgIntensity)} / 10` : '–'}</td></tr>
        <tr><th>${T('kvPainRelief')}</th><td>${s.medDays}</td></tr>
        <tr><th>${T('kvRest')}</th><td>${s.restDays}</td></tr>
        <tr><th>${T('kvPeriodDays')}</th><td>${s.periodDays}</td></tr>
      </table>
      <h3>${T('perMonth')}</h3>
      <table><tr><th>${T('colMonth')}</th><th>${T('colDaysRecorded')}</th><th>${T('colHeadacheDays')}</th></tr>
        ${months.map((m) => `<tr><td>${monthLabel(m.year, m.month)} ${m.year}</td><td>${m.logged}</td><td>${m.headacheDays}</td></tr>`).join('')}</table>
      <h3>${T('reportMedicationTitle')}</h3>
      <p>${T('reportMedExplain')}</p>
      <table><tr><th>${T('colMonth')}</th><th>${T('colTriptanDays')}</th><th>${T('colSimpleDays')}</th></tr>
        ${medMonths.map((m) => `<tr><td>${monthLabel(m.year, m.month)} ${m.year}</td><td>${m.triptanDays}</td><td>${m.simpleDays}</td></tr>`).join('')}</table>
      ${medFlags.map((f) => `<p class="fine">${f}</p>`).join('')}
      ${showMenoCycleSection ? `
      <h3>${T('reportMenoCycleTitle')}</h3>
      ${meno ? `<p>${T('reportHrtDays')}: ${meno.hrtDays}</p>
        <p>${T('reportMenoSymptomsIntro')}</p>
        ${meno.items.length
    ? `<ul>${meno.items.map((i) => `<li>${esc(labelOf(i.id))}: ${i.count} (${T('reportAvgSeverity', { sev: fmt1(i.avgSeverity) })})</li>`).join('')}</ul>`
    : `<p>${T('reportNoMenoSymptoms')}</p>`}` : ''}
      ${migraineStat && migraineStat.checked > 0 ? `<p>${T('reportMenstrualMigraine', { withN: migraineStat.withMigraine, checked: migraineStat.checked })}</p>` : ''}
      <p>${T('reportAvgSleepStress', { sleep: s.avgSleep ? fmt1(s.avgSleep) : '–', stress: s.avgStress ? fmt1(s.avgStress) : '–' })}</p>` : ''}
      <h3>${T('observedPatterns')}</h3>
      <p class="fine">${T('patternsCaution')}</p>
      ${strongRisks.length
    ? `<ul>${strongRisks.slice(0, 8).map((p) => {
      const extra = describeEnrichment(p, lang());
      return `<li>${esc(describePattern(p, factorPhrase(p.id), lang()))} ${T('daysSuffix', { n: p.days })}${extra.length ? ` ${extra.map(esc).join(' ')}` : ''}</li>`;
    }).join('')}</ul>`
    : `<p>${T('noStrongPatternsYet')}</p>`}
      ${favoriteMeno.length ? `
      <h3>${T('reportTopConcernsTitle')}</h3>
      <ul>${favoriteMeno.map((id) => {
      const label = labelOf(id);
      const p = pat.ready ? pat.allById.get(id) : null;
      const isPattern = p && (pat.risks.some((r) => r.id === id) || pat.helpers.some((r) => r.id === id));
      if (isPattern) {
        const extra = describeEnrichment(p, lang());
        return `<li>${esc(describePattern(p, factorPhrase(id), lang()))} ${T('daysSuffix', { n: p.days })}${extra.length ? ` ${extra.map(esc).join(' ')}` : ''}</li>`;
      }
      if (!pat.ready) return `<li>${esc(label)}: ${T('favoriteNeedsTime')}</li>`;
      if (p) return `<li>${esc(label)}: ${T('favoriteNoLinkYet', { n: p.days })}</li>`;
      return `<li>${esc(label)}: ${T('favoriteNotLoggedYet')}</li>`;
    }).join('')}</ul>` : ''}
      ${combos.length ? `
      <h3>${T('reportCombinedFactorsTitle')}</h3>
      <ul>${combos.slice(0, 4).map((c) => `<li>${esc(describeCombination(c, factorPhrase(c.a), factorPhrase(c.b), lang()))} ${T('daysSuffix', { n: c.days })}</li>`).join('')}</ul>` : ''}
      <h3>${T('headacheLog')}</h3>
      ${rows ? `<table class="log"><tr><th>${T('colDate')}</th><th>${T('colIntensity')}</th><th>${T('colType')}</th><th>${T('colOnset')}</th><th>${T('colDuration')}</th><th>${T('colSymptoms')}</th><th>${T('colMedication')}</th><th>${T('colPeriod')}</th><th>${T('colLoggedFactors')}</th></tr>${rows}</table>` : `<p>${T('noHeadachesRecorded')}</p>`}
      <p class="fine">${T('reportDisclaimer')}</p>
    </article>`;
}

function viewGarden() {
  const st = streaks(state.entries);
  const next = MILESTONES.find((m) => m.at > st.total);
  const earned = MILESTONES.filter((m) => m.at <= st.total).reverse();
  const dates = Object.keys(state.entries).sort();
  const title = state.profile.gardenName ? esc(state.profile.gardenName) : T('yourGarden');
  return `<header class="top"><h1>${title}</h1></header>
    <div class="card flush">${gardenScene(st.total, { dates, interactive: true, emptyText: T('gardenEmpty'), extraSpecies: packSpecies(), timezone: gardenTimezone() })}</div>
    ${st.total ? `<p class="hint center">${T('tapAFlower')}</p>` : ''}
    <div class="btn-row center"><button class="btn ghost" data-action="save-garden-photo">${T('saveGardenPhoto')}</button></div>
    <div class="tiles">${tile(st.total, T(st.total === 1 ? 'bloomSingular' : 'bloomPlural'))}${tile(st.current, T('dayStreak'))}${tile(st.best, T('longestStreak'))}</div>
    <p class="hint center">${T('gardenNeverWilts')}</p>
    ${next ? `<div class="card"><p class="eyebrow">${T('nextMilestone')}</p><h2>${esc(next.title[lang()] || next.title.en)}</h2>
      <p>${T(next.at - st.total === 1 ? 'checkinsToGoSingular' : 'checkinsToGoPlural', { n: next.at - st.total })}</p>
      <div class="progress"><span style="width:${Math.round((st.total / next.at) * 100)}%"></span></div></div>` : ''}
    <div class="card"><h2>${T('flowers')}</h2><div class="species">${[...SPECIES, ...packSpecies()].sort((a, b) => a.at - b.at).map((sp, i) => {
    const open = st.total >= sp.at;
    return `<div class="sp${open ? '' : ' locked'}"><svg viewBox="-14 -50 28 52" aria-hidden="true">${flower(sp.id, i)}</svg>
        <span>${open ? esc(sp.name[lang()] || sp.name.en) : T('atCount', { n: sp.at })}</span>
        ${open && sp.meaning ? `<span class="meaning">${esc(sp.meaning[lang()] || sp.meaning.en)}</span>` : ''}</div>`;
  }).join('')}</div></div>
    ${earned.length ? `<div class="card"><h2>${T('milestones')}</h2><ul class="milestones">${earned.map((m) =>
    `<li><strong>${esc(m.title[lang()] || m.title.en)}</strong><span>${esc(m.text[lang()] || m.text.en)}</span></li>`).join('')}</ul></div>` : ''}
    <div class="card selfcare"><p class="eyebrow">${T('todaysCard')}</p><p class="quote">${esc(cardFor(today()))}</p></div>`;
}

// Shared by Settings and the paywall: current status, a key-entry form, and
// a buy link. ui.licenseBusy/ui.licenseMsg hold the in-flight activate state.
function licenseCard() {
  const lic = state.license;
  const status = isLicensed(state)
    ? `<p>${T('licenseUnlocked')}</p>`
    : `<p>${T('licenseTrialStatus', { used: Math.min(trialUsed(state), TRIAL_LIMIT), limit: TRIAL_LIMIT })}</p>`;
  const msg = ui.licenseMsg ? `<p class="hint${ui.licenseMsg.ok ? '' : ' error'}">${esc(ui.licenseMsg.text)}</p>` : '';
  return `${status}${msg}
    <div class="add-row">
      <input type="text" id="license-key" placeholder="${T('licenseKeyPlaceholder')}" aria-label="${T('licenseKeyAria')}" value="${esc(ui.licenseKeyDraft || '')}" ${ui.licenseBusy ? 'disabled' : ''}>
      <button class="btn ghost" data-action="activate-license" ${ui.licenseBusy ? 'disabled' : ''}>${T(ui.licenseBusy ? 'activating' : 'activate')}</button>
    </div>
    <div class="btn-row">
      <button class="btn primary" data-action="buy">${T('buyClary')}</button>
      ${isLicensed(state) && !lic.grandfathered ? `<button class="btn ghost" data-action="free-up-device">${T('freeUpDevice')}</button>` : ''}
    </div>`;
}

function packCard() {
  const unlocked = isPackUnlocked(state, 'gardenCare');
  const status = `<p>${T(unlocked ? 'packUnlocked' : 'packLocked')}</p>`;
  const msg = ui.packMsg ? `<p class="hint${ui.packMsg.ok ? '' : ' error'}">${esc(ui.packMsg.text)}</p>` : '';
  return `<p class="hint">${T('packExplain')}</p>${status}${msg}
    ${unlocked ? '' : `<div class="add-row">
      <input type="text" id="pack-key" placeholder="${T('licenseKeyPlaceholder')}" aria-label="${T('licenseKeyAria')}" value="${esc(ui.packKeyDraft || '')}" ${ui.packBusy ? 'disabled' : ''}>
      <button class="btn ghost" data-action="activate-pack" ${ui.packBusy ? 'disabled' : ''}>${T(ui.packBusy ? 'activating' : 'activate')}</button>
    </div>`}
    <div class="btn-row">
      ${unlocked ? `<button class="btn ghost" data-action="free-up-pack">${T('freeUpDevice')}</button>` : `<button class="btn primary" data-action="buy-pack">${T('buyPack')}</button>`}
    </div>`;
}

function viewPaywall() {
  return `<header class="top with-back">
      <button class="icon-btn" data-action="close-paywall" aria-label="${T('back')}">‹</button>
      <h1>${T('paywallTitle')}</h1>
    </header>
    <div class="card">
      <p>${T('paywallExplain')}</p>
      <p class="hint">${T('alreadyBought')}</p>
      ${licenseCard()}
    </div>`;
}

const isStandalone = () => matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
const isIOS = () => /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
const isAndroid = () => /Android/.test(navigator.userAgent);
let deferredInstallPrompt = null;

// Whether to jump straight to the install screen without being asked: only on
// a phone (not desktop, which already has its own install affordance), not
// already installed, and not snoozed from a recent "Continue" tap.
function installDue(st) {
  if (isStandalone() || (!isAndroid() && !isIOS())) return false;
  return !st.installSnoozedUntil || Date.now() >= st.installSnoozedUntil;
}

// On Android, fire the browser's own install popup immediately once we've
// navigated to the install screen on our own (not because the user tapped
// "How to install" from Settings) - so opening the app is the only tap needed
// before the native "Install app?" dialog appears.
function maybeAutoPrompt() {
  if (ui.view === 'install' && ui.autoInstallPending && isAndroid() && deferredInstallPrompt) {
    ui.autoInstallPending = false;
    actions['install-now']();
  }
}

function viewInstall() {
  if (isStandalone()) {
    return `<header class="top with-back">
        <button class="icon-btn" data-action="install-continue" aria-label="${T('back')}">‹</button>
        <h1>${T('installTitle')}</h1>
      </header>
      <div class="card"><p>${T('installAlready')}</p></div>
      <div class="save-bar"><button class="btn primary big" data-action="install-continue">${T('continueToClary')}</button></div>`;
  }
  const androidButton = isAndroid() && deferredInstallPrompt
    ? `<div class="card"><button class="btn primary big" data-action="install-now">${T('installAndroidButton')}</button></div>` : '';
  return `<header class="top with-back">
      <button class="icon-btn" data-action="install-continue" aria-label="${T('back')}">‹</button>
      <h1>${T('installTitle')}</h1>
    </header>
    <div class="card"><p>${T('installWhy')}</p></div>
    ${androidButton}
    <div class="card">
      <h3>${T('installIosTitle')}</h3>
      <ol class="install-steps">
        <li>${T('installIosStep1')}</li>
        <li>${T('installIosStep2')}</li>
        <li>${T('installIosStep3')}</li>
      </ol>
    </div>
    ${androidButton ? '' : `<div class="card">
      <h3>${T('installAndroidFallbackTitle')}</h3>
      <p>${T('installAndroidFallbackStep')}</p>
    </div>`}
    <div class="save-bar"><button class="btn primary big" data-action="install-continue">${T('continueToClary')}</button></div>`;
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
      <label class="field"><span>${T('timezoneSetting')}</span>
        <select data-setting="settings.timezone">
          <option value="">${T('timezoneAuto', { tz: deviceTimezone() })}</option>
          ${timezoneOptions().map((tz) => `<option value="${esc(tz)}"${s.timezone === tz ? ' selected' : ''}>${esc(tz.replace(/_/g, ' '))}</option>`).join('')}
        </select>
        <p class="hint">${T('timezoneExplain')}</p>
      </label>
    </div>
    <div class="card"><h2>${T('aboutYou')}</h2>
      <label class="field"><span>${T('name')}</span><input type="text" data-setting="profile.name" value="${esc(p.name)}" maxlength="30"></label>
      <label class="field"><span>${T('gardenNameSetting')}</span><input type="text" data-setting="profile.gardenName" value="${esc(p.gardenName)}" maxlength="30" placeholder="${T('gardenNamePlaceholder')}"></label>
      <div class="field"><span>${T('cycle')}</span>${toSetting(chips('profile.stage', L(STAGES), p.stage, false))}</div>
      <div class="field"><span>${T('hrtSetting')}</span>${toSetting(chips('settings.usesHrt', [['yes', T('yes')], ['no', T('no')]], s.usesHrt ? 'yes' : 'no', false))}</div>
      <div class="field"><span>${T('trackMenoSetting')}</span>${toSetting(chips('settings.trackMeno', [['yes', T('yes')], ['no', T('no')]], s.trackMeno ? 'yes' : 'no', false))}</div>
      ${s.trackMeno ? `<div class="field"><span>${T('favoriteMenoSetting')}</span>
        <p class="hint">${T('favoriteMenoHint')}</p>
        <div class="chips">${L(MENO_SYMPTOMS).map(([id, label]) => {
    const on = s.favoriteMeno.includes(id);
    const full = !on && s.favoriteMeno.length >= 3;
    return `<button type="button" class="chip${on ? ' on' : ''}" aria-pressed="${on}" ${full ? 'disabled' : ''}
      data-action="toggle-favorite-meno" data-id="${esc(id)}">${esc(label)}</button>`;
  }).join('')}</div></div>` : ''}
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
    ${s.meds.length ? `<div class="card"><h2>${T('medRefillTitle')}</h2>
      <p class="hint">${T('medRefillExplain')}</p>
      ${s.meds.map((m) => {
    const perRefill = s.medRefill[m];
    const used = perRefill ? medDaysSinceRefill(state.entries, m, state.medRefillResetAt[m]) : 0;
    return `<div class="field tight"><span class="small-label">${esc(m)}</span>
        <div class="refill-row">
          <input type="number" min="1" max="365" inputmode="numeric" data-med-refill="${esc(m)}" value="${perRefill || ''}" placeholder="${T('medRefillPlaceholder')}">
          ${perRefill ? `<button class="btn ghost" data-action="refill-done" data-id="${esc(m)}">${T('medRefillDoneButton')}</button>` : ''}
        </div>
        ${perRefill ? `<p class="fine">${T('medRefillStatus', { n: used, total: perRefill })}</p>` : ''}
      </div>`;
  }).join('')}
    </div>` : ''}
    <div class="card"><h2>${T('license')}</h2>${licenseCard()}</div>
    <div class="card"><h2>${T('packTitle')}</h2>${packCard()}</div>
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
      <button class="btn ghost" data-action="open-install">${T('howToInstall')}</button>
    </div>`;
}

function logo() {
  return `<svg viewBox="-20 -52 40 56" aria-hidden="true">${flower('peony', 2)}</svg>`;
}

// ---------- reward modal ----------
function showReward(date) {
  const st = streaks(state.entries);
  const sp = speciesFor(st.total - 1, packSpecies());
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

// The ID Migraine screener: 3 validated yes/no questions. Never auto-fills
// the type - the person taps to accept a suggestion themselves.
const IDM_QUESTIONS = ['idmQ1', 'idmQ2', 'idmQ3'];

function renderIdm() {
  const answered = ui.idm.filter((a) => a !== null).length;
  const yesCount = ui.idm.filter((a) => a === true).length;
  const idmChip = (i, value, label) => {
    const on = ui.idm[i] === value;
    return `<button type="button" class="chip${on ? ' on' : ''}" aria-pressed="${on}" data-action="idm-answer" data-i="${i}" data-value="${value}">${label}</button>`;
  };
  const questions = IDM_QUESTIONS.map((key, i) => `
    <div class="field"><span>${T(key)}</span><div class="chips">${idmChip(i, true, T('yes'))}${idmChip(i, false, T('no'))}</div></div>`).join('');
  const result = answered === 3
    ? `<div class="selfcare"><p>${T(yesCount >= 2 ? 'idmResultHigh' : 'idmResultLow', { n: yesCount })}</p></div>
       ${yesCount >= 2 ? `<button class="btn primary big" data-action="idm-select-migraine">${T('idmSelectMigraine')}</button>` : ''}`
    : '';
  $modal.innerHTML = `<div class="sheet" role="dialog" aria-modal="true" aria-labelledby="idm-title">
    <h2 id="idm-title">${T('idmTitle')}</h2>
    <p class="fine">${T('idmIntro')}</p>
    ${questions}
    ${result}
    <button class="btn ghost big" data-action="close-modal">${T('idmClose')}</button>
  </div>`;
  $modal.hidden = false;
}

// A tap on any flower in the full garden view: which day it was, and what
// was logged that day, with a note if one was written.
function showFlowerDay(date) {
  const e = state.entries[date];
  if (!e) return;
  const dates = Object.keys(state.entries).sort();
  const index = dates.indexOf(date);
  const sp = speciesFor(index, packSpecies());
  $modal.innerHTML = `<div class="sheet" role="dialog" aria-modal="true" aria-labelledby="flower-day-title">
    <svg class="bloom" viewBox="-22 -54 44 58" aria-hidden="true">${flower(sp.id, index)}</svg>
    <h2 id="flower-day-title">${esc(niceDate(date))}</h2>
    <p>${summaryLine(e)}</p>
    <div class="selfcare"><p class="eyebrow">${T('notes')}</p><p class="quote">${e.notes ? esc(e.notes) : T('flowerDayNoNote')}</p></div>
    <button class="btn ghost big" data-action="open-flower-day" data-date="${date}">${T('openThisDay')}</button>
    <button class="btn primary big" data-action="close-modal">${T('lovely')}</button>
  </div>`;
  $modal.hidden = false;
  $modal.querySelector('button').focus();
}

// ---------- render ----------
const VIEWS = {
  today: viewToday, checkin: viewCheckin, calendar: viewCalendar, insights: viewInsights,
  report: viewReport, garden: viewGarden, settings: viewSettings, paywall: viewPaywall, install: viewInstall,
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
  const hideNav = ui.view === 'checkin' || ui.view === 'report' || ui.view === 'install';
  $nav.hidden = hideNav;
  $nav.innerHTML = navItems().map(([id, label]) =>
    `<button class="${ui.view === id ? 'on' : ''}" data-action="go" data-view="${id}" ${ui.view === id ? 'aria-current="page"' : ''}>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.700" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${NAV_ICONS[id]}</svg>
      <span>${label}</span></button>`).join('');
  document.body.dataset.view = ui.view;
  window.scrollTo(0, keepScroll ? scroll : 0);
  maybeAutoPrompt();
}

function go(view) { ui.view = view; render(); }

function openCheckin(date) {
  if (date > today()) return;
  const existing = state.entries[date];
  if (!existing && trialExhausted(state)) { ui.paywallReturnDate = date; go('paywall'); return; }
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
    const clearable = !BOOL_FIELDS.has(field) && !SINGLE_CHOICE_STICKY.has(field) && !field.startsWith('menoSeverity.');
    setPath(target, field, clearable && current === value ? (el.dataset.num ? 0 : '') : value);
  }
  return field;
}

const actions = {
  go: (el) => go(el.dataset.view),
  'open-checkin': (el) => openCheckin(el.dataset.date),
  'close-checkin': () => go(ui.draftDate === today() ? 'today' : 'calendar'),
  'toggle-more': () => { ui.showMore = !ui.showMore; render(true); },
  pick: (el) => {
    const field = applyPick(ui.draft, el);
    render(true);
    // The sudden-onset warning can land behind the sticky save button at some
    // scroll positions; nudge it fully into view (scroll-margin-bottom keeps
    // it clear of that bar) the moment it appears.
    if (field === 'headache.onset' && ui.draft.headache.onset === 'sudden') {
      requestAnimationFrame(() => document.querySelector('.hint.warning')?.scrollIntoView({ block: 'nearest', behavior: 'smooth' }));
    }
  },
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
  'close-modal': () => { $modal.hidden = true; $modal.innerHTML = ''; ui.idm = null; },
  'open-idm': () => { ui.idm = [null, null, null]; renderIdm(); },
  'idm-answer': (el) => {
    ui.idm[Number(el.dataset.i)] = el.dataset.value === 'true';
    renderIdm();
  },
  'idm-select-migraine': () => {
    ui.draft.headache.type = 'migraine';
    actions['close-modal']();
    render(true);
  },
  'close-paywall': () => { ui.licenseMsg = null; go('today'); },
  'open-install': () => { ui.installReturnView = ui.view === 'install' ? 'settings' : ui.view; ui.autoInstallPending = false; go('install'); },
  'install-continue': () => {
    // Moving on without installing snoozes the automatic prompt for a few
    // days, rather than showing it again on every single visit.
    if (!isStandalone()) { state.installSnoozedUntil = Date.now() + 3 * 86400000; commit(); }
    const back = ui.paywallReturnDate;
    ui.paywallReturnDate = null;
    if (back) { openCheckin(back); return; }
    go(ui.installReturnView || 'today');
  },
  'install-now': async () => {
    if (!deferredInstallPrompt) return;
    deferredInstallPrompt.prompt();
    await deferredInstallPrompt.userChoice.catch(() => {});
    deferredInstallPrompt = null;
    render(true);
  },
  buy: () => window.open(BUY_URL, '_blank', 'noopener'),
  'activate-license': async () => {
    const input = document.getElementById('license-key');
    const key = input ? input.value : (ui.licenseKeyDraft || '');
    if (!key.trim()) return;
    ui.licenseBusy = true;
    ui.licenseMsg = null;
    render(true);
    const result = await applyLicenseKey(state, key);
    ui.licenseBusy = false;
    if (result.ok) {
      ui.licenseKeyDraft = '';
      ui.licenseMsg = { ok: true, text: T('activateSuccess') };
      commit();
      // paywallReturnDate (if any) is kept: the install screen's Continue
      // button resumes the check-in the purchase was for.
      if (!isStandalone()) { ui.autoInstallPending = true; render(true); go('install'); return; }
      const back = ui.paywallReturnDate;
      ui.paywallReturnDate = null;
      if (back) { openCheckin(back); return; }
    } else {
      ui.licenseMsg = { ok: false, text: result.network ? T('licenseErrorNetwork') : T('licenseErrorGeneric') };
      commit();
    }
    render(true);
  },
  'free-up-device': async () => {
    if (!confirm(T('confirmFreeUpDevice'))) return;
    await releaseDevice(state);
    commit();
    render(true);
  },
  'buy-pack': () => window.open(PACK_BUY_URL, '_blank', 'noopener'),
  'activate-pack': async () => {
    const input = document.getElementById('pack-key');
    const key = input ? input.value : (ui.packKeyDraft || '');
    if (!key.trim()) return;
    ui.packBusy = true;
    ui.packMsg = null;
    render(true);
    const result = await applyPackKey(state, 'gardenCare', key);
    ui.packBusy = false;
    if (result.ok) {
      ui.packKeyDraft = '';
      ui.packMsg = { ok: true, text: T('activateSuccess') };
      commit();
    } else {
      ui.packMsg = { ok: false, text: result.network ? T('licenseErrorNetwork') : T('licenseErrorGeneric') };
      commit();
    }
    render(true);
  },
  'free-up-pack': async () => {
    if (!confirm(T('confirmFreeUpDevice'))) return;
    await releasePack(state, 'gardenCare');
    commit();
    render(true);
  },
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
    state.profile.gardenName = document.getElementById('ob-garden-name').value.trim();
    state.settings.reminderTime = document.getElementById('ob-time').value || '20:00';
    state.profile.onboarded = true;
    if ((await reminders.askPermission()) === 'granted') state.settings.reminderOn = true;
    if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});
    commit();
    if (installDue(state)) { ui.installReturnView = 'today'; ui.autoInstallPending = true; go('install'); return; }
    go('today');
  },
  'toggle-library': () => { ui.showLibrary = !ui.showLibrary; render(true); },
  'toggle-favorite-meno': (el) => {
    const id = el.dataset.id;
    const list = state.settings.favoriteMeno;
    const i = list.indexOf(id);
    if (i >= 0) list.splice(i, 1);
    else if (list.length < 3) list.push(id);
    commit(); render(true);
  },
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
    delete state.settings.medRefill[el.dataset.id];
    delete state.medRefillResetAt[el.dataset.id];
    commit(); render(true);
  },
  'refill-done': (el) => {
    state.medRefillResetAt[el.dataset.id] = today();
    commit(); render(true);
  },
  'calendar-file': () => download('clary-reminder.ics', reminders.calendarFile(state.settings.reminderTime, lang()), 'text/calendar'),
  'export-csv': () => download(`clary-${today()}.csv`, toCsv(state.entries, labelOf, lang()), 'text/csv'),
  'show-flower-day': (el) => showFlowerDay(el.dataset.flowerDate),
  'open-flower-day': (el) => { actions['close-modal'](); openCheckin(el.dataset.date); },
  'save-garden-photo': () => {
    const svg = document.querySelector('.garden');
    if (svg) downloadSvgAsPng(`clary-garden-${today()}.png`, svg).catch(() => alert(T('savePhotoError')));
  },
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
  } else if (el.dataset.medRefill) {
    // Keyed by the medication's own (free-text) name, not a dot-path field,
    // since a name could itself contain a literal "." that setPath would
    // misread as a nested path.
    const days = Number(el.value) || 0;
    if (days > 0) state.settings.medRefill[el.dataset.medRefill] = days;
    else delete state.settings.medRefill[el.dataset.medRefill];
    commit();
  } else if (el.id === 'license-key') {
    ui.licenseKeyDraft = el.value;
  } else if (el.id === 'pack-key') {
    ui.packKeyDraft = el.value;
  }
});

document.addEventListener('change', (ev) => {
  if (ev.target.dataset.medRefill) { render(true); return; }
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

// Android/desktop Chrome offer a real install prompt; capture it so the
// install screen can show a one-tap button instead of manual steps.
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredInstallPrompt = e;
  if (ui.view === 'install') render(true);
});
window.addEventListener('appinstalled', () => {
  deferredInstallPrompt = null;
  state.installSnoozedUntil = null;
  commit();
  if (ui.view === 'install') render(true);
});

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

// A phone that opens Clary and hasn't installed it yet goes straight to the
// install screen - so following the link is the only tap needed before
// Android's own "Install app?" popup (via maybeAutoPrompt) or iPhone's
// "Add to Home Screen" steps appear.
if (state.profile.onboarded && installDue(state)) { ui.installReturnView = 'today'; ui.view = 'install'; ui.autoInstallPending = true; }
if (location.hash === '#checkin' && state.profile.onboarded && ui.view !== 'install') openCheckin(today()); else render();
