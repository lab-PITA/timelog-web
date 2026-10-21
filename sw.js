// オフラインでも開けるよう、アプリのファイルを端末に保存しておく（Service Worker）。
// ファイルを変えたら VERSION を上げる。上げると、次に開いたときに新しいファイルに入れ替わる。
const VERSION = 'timelog-1.2.1';

const FILES = [
  './',
  'index.html',
  'manifest.webmanifest',
  'css/app.css',
  'icons/icon.svg',
  'icons/apple-touch-icon.png',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'js/app.js',
  'js/vendor/preact-htm.js',
  'js/domain/dates.js',
  'js/domain/timecalc.js',
  'js/domain/stats.js',
  'js/domain/format.js',
  'js/domain/timeinput.js',
  'js/data/colors.js',
  'js/data/seed.js',
  'js/data/store.js',
  'js/data/idb.js',
  'js/data/backup.js',
  'js/ui/context.js',
  'js/ui/icons.js',
  'js/ui/icon-data.js',
  'js/ui/components.js',
  'js/ui/charts.js',
  'js/ui/keypad-dialogs.js',
  'js/ui/screens/record.js',
  'js/ui/screens/today.js',
  'js/ui/screens/week.js',
  'js/ui/screens/goal.js',
  'js/ui/screens/share.js',
  'js/ui/screens/help.js',
  'js/ui/screens/settings.js',
  'js/ui/screens/categories.js',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(VERSION)
      .then((cache) => cache.addAll(FILES.map((f) => new Request(f, { cache: 'reload' }))))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

// 保存してあるファイルを先に使う。なければインターネットから取る
self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET' || new URL(request.url).origin !== location.origin) return;
  event.respondWith(
    caches.match(request, { ignoreSearch: true }).then((hit) => hit ?? fetch(request)),
  );
});
