// Service worker: offline app shell, reminder notifications.
const CACHE = 'clary-shell-v13';
const META_CACHE = 'clary-meta';
const SHELL = [
  './', 'index.html', 'css/styles.css', 'manifest.webmanifest',
  'js/app.js', 'js/data.js', 'js/store.js', 'js/insights.js', 'js/garden.js',
  'js/charts.js', 'js/reminders.js', 'js/export.js', 'js/i18n.js', 'js/license.js',
  'icons/icon.svg', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/apple-touch-icon.png',
];

// Kept in step with notifyTitle/notifyBody in js/i18n.js. A service worker
// registered as a classic script can't import that module, so it is small
// enough to duplicate rather than add module-worker plumbing for two lines.
const NOTIFY = {
  en: { title: 'How are you feeling today?', body: 'A 30-second check-in, and a new flower for your garden.' },
  nl: { title: 'Hoe voel je je vandaag?', body: 'Een check-in van 30 seconden, en een nieuwe bloem voor je tuin.' },
};

self.addEventListener('install', (e) => {
  // Cache the new shell, but wait for the page to ask before taking over:
  // skipWaiting now would swap files mid-session without warning.
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)));
});

self.addEventListener('message', (e) => {
  if (e.data === 'skipWaiting') self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE && k !== META_CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

// Network first so updates arrive quickly; fall back to the cache when offline.
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  e.respondWith(
    fetch(req)
      .then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(req, copy));
        return res;
      })
      .catch(() => caches.match(req, { cacheName: CACHE }).then((hit) => hit || caches.match('index.html'))),
  );
});

function localDate(d) {
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

async function maybeRemind() {
  const cache = await caches.open(META_CACHE);
  const hit = await cache.match('meta.json');
  if (!hit) return;
  const meta = await hit.json();
  const now = new Date();
  const todayStr = localDate(now);
  const [h, m] = (meta.reminderTime || '20:00').split(':').map(Number);
  const due = now.getHours() * 60 + now.getMinutes() >= h * 60 + m;
  if (!meta.reminderOn || !due || meta.lastCheckin === todayStr || meta.lastNotified === todayStr) return;
  const text = NOTIFY[meta.lang] || NOTIFY.en;
  await self.registration.showNotification(text.title, {
    body: text.body,
    icon: 'icons/icon-192.png',
    badge: 'icons/icon-192.png',
    tag: 'clary-daily',
  });
  meta.lastNotified = todayStr;
  await cache.put('meta.json', new Response(JSON.stringify(meta), { headers: { 'Content-Type': 'application/json' } }));
}

self.addEventListener('periodicsync', (e) => {
  if (e.tag === 'clary-reminder') e.waitUntil(maybeRemind());
});

self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  e.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      const open = list.find((c) => 'focus' in c);
      return open ? open.focus() : self.clients.openWindow('./#checkin');
    }),
  );
});
