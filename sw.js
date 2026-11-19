// オフライン対応：最初に開いたときにアプリの全ファイルをスマホに保存する。
// ★ アプリのファイルを直したら、下の VERSION の数字を1つ上げる（スマホ側が新しいものに入れ替わる）。
const VERSION = 'v1';
const CACHE = 'denki-card-' + VERSION;
const FILES = [
    './',
    'index.html',
    'review.html',
    'manifest.webmanifest',
    'phrases.json',
    'qa.json',
    'app-icons/apple-touch-icon.png',
    'app-icons/icon-192.png',
    'app-icons/icon-512.png',
    'css/style.css',
    'img/breaker.svg',
    'img/icons/arrow-left.svg',
    'img/icons/book-open.svg',
    'img/icons/calendar.svg',
    'img/icons/check-check.svg',
    'img/icons/check.svg',
    'img/icons/chevron-left.svg',
    'img/icons/chevron-right.svg',
    'img/icons/circle-check.svg',
    'img/icons/circle-help.svg',
    'img/icons/clipboard-check.svg',
    'img/icons/copy.svg',
    'img/icons/door-open.svg',
    'img/icons/download.svg',
    'img/icons/external-link.svg',
    'img/icons/eye.svg',
    'img/icons/flame.svg',
    'img/icons/graduation-cap.svg',
    'img/icons/hand-heart.svg',
    'img/icons/hand.svg',
    'img/icons/heart.svg',
    'img/icons/hourglass.svg',
    'img/icons/house.svg',
    'img/icons/id-card.svg',
    'img/icons/image.svg',
    'img/icons/life-buoy.svg',
    'img/icons/lightbulb.svg',
    'img/icons/list.svg',
    'img/icons/mail.svg',
    'img/icons/message-circle.svg',
    'img/icons/message-square-text.svg',
    'img/icons/mic.svg',
    'img/icons/panel-top.svg',
    'img/icons/pencil.svg',
    'img/icons/plug.svg',
    'img/icons/plus.svg',
    'img/icons/presentation.svg',
    'img/icons/refresh-cw.svg',
    'img/icons/rotate-ccw.svg',
    'img/icons/search.svg',
    'img/icons/send.svg',
    'img/icons/settings.svg',
    'img/icons/shuffle.svg',
    'img/icons/star.svg',
    'img/icons/trash-2.svg',
    'img/icons/triangle-alert.svg',
    'img/icons/turtle.svg',
    'img/icons/upload.svg',
    'img/icons/volume-2.svg',
    'img/icons/x.svg',
    'img/icons/zap-off.svg',
    'img/icons/zap.svg',
    'img/notice-sample.svg',
    'js/config.js',
    'js/core.js',
    'js/home.js',
    'js/practice.js',
    'js/qa.js',
    'js/show.js',
    'js/speak.js',
    'js/vendor/motion.js',
    'js/words.js',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(FILES)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('denki-card-') && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;   // AIのサイトなど外部はそのまま

  // 文のファイル（.json）は「電波があれば最新、なければ保存したもの」
  if (url.pathname.endsWith('.json')) {
    e.respondWith(
      fetch(req).then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(req, copy));
        return res;
      }).catch(() => caches.match(req, { ignoreSearch: true }))
    );
    return;
  }

  // それ以外は「保存したものをすぐ使う」
  e.respondWith(
    caches.match(req, { ignoreSearch: true }).then((hit) => hit || fetch(req).then((res) => {
      if (res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); }
      return res;
    }).catch(() => (req.mode === 'navigate' ? caches.match('index.html') : undefined)))
  );
});
