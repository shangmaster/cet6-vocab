/* 离线缓存：站点自身资源走 cache-first，发音音频走 network-only（不缓存，省空间）
   版本号变了就丢旧缓存 —— 改完站记得改 CACHE 常量 */
const CACHE = 'cet6-vocab-v3';
const ASSETS = [
  './',
  './index.html',
  './manifest.webmanifest',
  './assets/style.css',
  './assets/app.js',
  './assets/data-1.js',
  './assets/data-2.js',
  './assets/data-3.js',
  './assets/data-4.js',
  './assets/data-5.js',
  './assets/data-6.js',
  './assets/forms.js',
  './assets/roots-1.js',
  './assets/roots-2.js',
  './assets/roots-3.js',
  './assets/roots-4.js',
  './assets/roots-5.js',
  './assets/roots-6.js',
  './assets/phonetics.js',
  './assets/derivs.js',
  './assets/icon-192.png',
  './assets/icon-512.png'
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE)
      .then((c) => c.addAll(ASSETS))
      .then(() => self.skipWaiting())
      .catch(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);

  // 发音音频：直连，不缓存（音频体积大、且有 892*2 个组合）
  if (url.hostname === 'dict.youdao.com') return;

  // 只处理同源资源
  if (url.origin !== self.location.origin) return;

  e.respondWith(
    caches.match(req, { ignoreSearch: true }).then((hit) => {
      if (hit) {
        // 后台顺手更新，下次更快
        fetch(req).then((res) => {
          if (res && res.ok) caches.open(CACHE).then((c) => c.put(req, res.clone()));
        }).catch(() => {});
        return hit;
      }
      return fetch(req).then((res) => {
        if (res && res.ok && res.type === 'basic') {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy));
        }
        return res;
      }).catch(() => caches.match('./index.html'));
    })
  );
});
