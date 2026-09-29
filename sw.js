// 핑구섬 경제 노트 · 오프라인 저장 파일(서비스 워커)
const VERSION = '3ae9388f99';
const CORE = 'pinggu-core-' + VERSION;
const FONTS = 'pinggu-fonts-v1';
const ASSETS = ['./', './index.html', './manifest.webmanifest', './icons/icon-32.png', './icons/icon-192.png', './icons/icon-512.png', './icons/maskable-512.png', './icons/apple-touch-icon.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CORE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k.startsWith('pinggu-core-') && k !== CORE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});
// 첫 방문 때 이미 내려받은 글꼴을 오프라인용으로 담아 둔다
self.addEventListener('message', e => {
  const d = e.data || {};
  if (d.type !== 'warm' || !Array.isArray(d.urls)) return;
  e.waitUntil(caches.open(FONTS).then(c => Promise.all(d.urls.map(u =>
    c.match(u).then(hit => hit || fetch(u, { mode: 'cors', credentials: 'omit' }).then(r => (r.ok ? c.put(u, r) : null)).catch(() => null))))));
});
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  // 게임 화면: 인터넷이 되면 새 버전을, 안 되면 저장해 둔 버전을 연다
  if (req.mode === 'navigate') {
    e.respondWith(fetch(req)
      .then(r => { if (r.ok) { const copy = r.clone(); caches.open(CORE).then(c => c.put('./index.html', copy)); } return r; })
      .catch(() => caches.match('./index.html')));
    return;
  }
  // 아이콘, 설치 정보: 저장본 먼저
  if (url.origin === self.location.origin) {
    e.respondWith(caches.match(req, { ignoreSearch: true }).then(hit => hit || fetch(req)));
    return;
  }
  // 구글 글꼴: 저장본이 있으면 바로 쓰고, 인터넷이 되면 새로 받아 둔다
  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    // 내용을 확인할 수 있는 방식(CORS)으로 받아 성공한 응답만 저장한다
    const key = req.url;
    e.respondWith(caches.open(FONTS).then(c => c.match(key).then(hit => {
      const net = fetch(key, { mode: 'cors', credentials: 'omit' })
        .then(r => { if (r.ok) { c.put(key, r.clone()); return r; } return hit || fetch(req); })
        .catch(() => hit || fetch(req));
      return hit || net;
    })));
  }
});
