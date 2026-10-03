/**
 * BYE QUIZ LIVE - PWA Service Worker
 * Production cache policy:
 * - Never cache the admin dashboard.
 * - Never cache API/SSE/live endpoints.
 * - Use network-first for HTML/CSS/JS so UI updates reach clients immediately.
 * - Remove all previous BYE QUIZ caches on activation.
 */

const CACHE_NAME = 'bye-quiz-live-v6';

const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/broadcast.html',
  '/css/style.css',
  '/css/identity.css',
  '/js/audio.js',
  '/js/game.js',
  '/js/engine/iconSystem.js',
  '/js/engine/reactionCanvas.js',
  '/js/engine/giftEventEngine.js',
  '/js/engine/eventManager.js',
  '/js/engine/gameState.js',
  '/js/engine/questionModel.js',
  '/js/engine/questionValidator.js',
  '/js/engine/questionSelector.js',
  '/js/engine/participantCard.js',
  '/js/engine/participantManager.js',
  '/js/engine/questionEngine.js',
  '/js/engine/answerEngine.js',
  '/js/engine/drawEngine.js',
  '/js/engine/scoreEngine.js',
  '/js/engine/statisticsEngine.js',
  '/js/engine/reactionEngine.js',
  '/js/engine/milestoneEngine.js',
  '/js/engine/reactionAggregator.js',
  '/js/engine/reactionQueue.js',
  '/js/engine/effectManager.js',
  '/js/engine/sceneManager.js',
  '/js/engine/roundManager.js',
  '/js/engine/specialEntranceEngine.js',
  '/js/engine/gameEngine.js',
  '/manifest.webmanifest',
  '/icons/icon-192.svg',
  '/icons/icon-512.svg'
];

function isLiveOrDynamic(url) {
  return (
    url.pathname === '/admin' ||
    url.pathname === '/admin.html' ||
    url.pathname === '/service-worker.js' ||
    url.pathname.startsWith('/api/') ||
    url.pathname.includes('/events') ||
    url.pathname.includes('/command')
  );
}

function isHtmlCssJs(request) {
  const destination = request.destination;
  return destination === 'document' ||
    destination === 'style' ||
    destination === 'script' ||
    request.url.endsWith('.html') ||
    request.url.endsWith('.css') ||
    request.url.endsWith('.js');
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(STATIC_ASSETS))
      .catch((err) => console.warn('[SW] Static cache warning:', err))
      .finally(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys
          .filter((key) => key.startsWith('byequiz-') && key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;

  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  // Admin, service worker, APIs and live streams must always reach the server.
  if (isLiveOrDynamic(url)) return;

  // UI source files use network-first so deployments become visible immediately.
  if (isHtmlCssJs(request)) {
    event.respondWith(
      fetch(request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.ok) {
            const copy = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, copy)).catch(() => {});
          }
          return networkResponse;
        })
        .catch(() => caches.match(request))
    );
    return;
  }

  // Other static assets may use cache-first with network fallback.
  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      if (cachedResponse) return cachedResponse;

      return fetch(request).then((networkResponse) => {
        if (networkResponse && networkResponse.ok) {
          const copy = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, copy)).catch(() => {});
        }
        return networkResponse;
      });
    })
  );
});
