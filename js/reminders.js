// Daily reminders. No server is involved, so there are three layers:
// 1. a notification scheduled while the app is open or recently used,
// 2. periodic background sync where the browser supports it (installed app),
// 3. a repeating calendar event the user can add, which always works.
import { today } from './store.js';
import { t } from './i18n.js';

const META_CACHE = 'clary-meta';
let timer = null;

export const supported = () => 'Notification' in window && 'serviceWorker' in navigator;
export const permission = () => (supported() ? Notification.permission : 'unsupported');

export async function askPermission() {
  if (!supported()) return 'unsupported';
  return Notification.requestPermission();
}

async function notify(lang) {
  const reg = await navigator.serviceWorker.ready;
  return reg.showNotification(t(lang, 'notifyTitle'), {
    body: t(lang, 'notifyBody'),
    icon: 'icons/icon-192.png',
    badge: 'icons/icon-192.png',
    tag: 'clary-daily',
  });
}

// Tell the service worker what it needs to know (it cannot read localStorage,
// and it shows its own notification text in the right language from this).
async function writeMeta(state) {
  if (!('caches' in window)) return;
  const dates = Object.keys(state.entries).sort();
  const meta = {
    reminderOn: state.settings.reminderOn,
    reminderTime: state.settings.reminderTime,
    lang: state.settings.lang,
    lastCheckin: dates[dates.length - 1] || '',
  };
  const cache = await caches.open(META_CACHE);
  await cache.put('meta.json', new Response(JSON.stringify(meta), { headers: { 'Content-Type': 'application/json' } }));
}

export async function sync(state) {
  clearTimeout(timer);
  try { await writeMeta(state); } catch { /* storage unavailable */ }
  if (!state.settings.reminderOn || permission() !== 'granted') return;

  const [h, m] = state.settings.reminderTime.split(':').map(Number);
  const next = new Date();
  next.setHours(h, m, 0, 0);
  if (next <= new Date()) next.setDate(next.getDate() + 1);
  timer = setTimeout(async () => {
    const fresh = JSON.parse(localStorage.getItem('clary.v1') || '{}');
    if (!(fresh.entries || {})[today()]) await notify(fresh.settings?.lang || 'en').catch(() => {});
    sync(state);
  }, next - new Date());

  try {
    const reg = await navigator.serviceWorker.ready;
    if ('periodicSync' in reg) await reg.periodicSync.register('clary-reminder', { minInterval: 6 * 60 * 60 * 1000 });
  } catch { /* not granted or not supported */ }
}

// A repeating calendar event with an alert: dependable on every phone.
export function calendarFile(time, lang = 'en') {
  const [h, m] = time.split(':');
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  const start = `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}T${h}${m}00`;
  const url = location.href.split('#')[0];
  const summary = t(lang, 'notifyTitle');
  return [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Clary//Daily check-in//EN',
    'BEGIN:VEVENT',
    `UID:clary-daily-${Date.now()}@clary`,
    `DTSTAMP:${start}`,
    `DTSTART:${start}`,
    'DURATION:PT5M',
    'RRULE:FREQ=DAILY',
    `SUMMARY:${summary}`,
    `DESCRIPTION:${summary} ${url}`,
    `URL:${url}`,
    'BEGIN:VALARM', 'ACTION:DISPLAY', `DESCRIPTION:${summary}`, 'TRIGGER:PT0M', 'END:VALARM',
    'END:VEVENT', 'END:VCALENDAR',
  ].join('\r\n');
}
