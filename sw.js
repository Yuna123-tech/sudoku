/* 오프라인 실행용 서비스 워커
   - 한 버전의 파일을 통째로 저장해 두고(캐시 우선) 인터넷 없이도 실행
   - 새 버전이 배포되면 뒤에서 미리 받아 두고, 화면의 "지금 업데이트"를 누르면 교체 */
const CACHE = 'sudoku-v8'; // 배포할 때 scripts/build-web.mjs가 커밋 번호로 자동 교체
const ASSETS = [
  './', 'index.html', 'style.css', 'app.js', 'sudoku.js', 'i18n.js', 'guide.js', 'worker.js', 'manifest.webmanifest',
  'games.js', 'chess-engine.js', 'janggi-engine.js', 'go-engine.js', 'omok-engine.js', 'othello-engine.js', 'ai-worker.js',
  'icons/icon-192.png', 'icons/icon-512.png', 'icons/icon-maskable-512.png', 'icons/apple-touch-icon.png',
];

self.addEventListener('install', (e) => {
  // 브라우저에 남은 예전 파일이 아니라 서버의 새 파일을 받음
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS.map((u) => new Request(u, { cache: 'reload' })))));
});

self.addEventListener('message', (e) => {
  if (e.data === 'skipWaiting') self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys()
    .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET' || new URL(e.request.url).origin !== location.origin) return;
  e.respondWith(caches.open(CACHE).then(async (cache) => {
    const cached = await cache.match(e.request, { ignoreSearch: true });
    if (cached) return cached;
    const res = await fetch(e.request);
    if (res.ok) cache.put(e.request, res.clone());
    return res;
  }));
});
