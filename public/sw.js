// Vite build replaces __LANKAFIT_ASSETS__ with this deployment's hashed assets.
const CACHE = 'lankafit-__LANKAFIT_BUILD__';
const ASSETS = __LANKAFIT_ASSETS__;
self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(ASSETS)));
});
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith('lankafit-') && key !== CACHE).map(key => caches.delete(key)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', event => {
  const request = event.request; const url = new URL(request.url);
  // Never cache API, auth, uploaded photos or third-party responses.
  if (request.method !== 'GET' || url.origin !== self.location.origin || url.pathname.startsWith('/api/') || url.pathname.startsWith('/.netlify/')) return;
  if (request.mode === 'navigate') {
    event.respondWith(fetch(request).catch(() => caches.open(CACHE).then(cache => cache.match('/index.html', { ignoreVary: true })).then(response => response || Response.error())));
  } else if (ASSETS.includes(url.pathname)) {
    // Static assets are public and deployment-specific. CORS variation must not
    // prevent a precached asset from serving a crossorigin module request offline.
    event.respondWith(caches.open(CACHE).then(cache => cache.match(url.pathname, { ignoreVary: true })).then(response => response || fetch(request)));
  }
});
