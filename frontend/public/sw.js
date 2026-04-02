const CACHE_NAME = 'whalearc-v1';
const STATIC_ASSETS = [
  '/',
  '/tail.png',
  '/manifest.json',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // 인증 관련 경로 및 API 요청은 항상 네트워크 우선 (캐싱 제외)
  const isAuthRoute = ['/auth/', '/login', '/signup', '/forgot-password', '/reset-password'].some(
    (path) => url.pathname.startsWith(path)
  );
  const isApiRequest = url.pathname.startsWith('/api/');

  if (isAuthRoute || isApiRequest) {
    event.respondWith(fetch(event.request));
    return;
  }

  // 네비게이션 요청(HTML 페이지)은 network-first + 캐시 폴백 (SPA 지원)
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request).catch(() => caches.match('/'))
    );
    return;
  }

  // 정적 자산은 cache-first
  event.respondWith(
    caches.match(event.request).then((cached) => cached || fetch(event.request))
  );
});

// PWA 푸시 알림 수신
self.addEventListener('push', (event) => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch (_) { /* 파싱 실패 시 기본값 */ }
  event.waitUntil(
    self.registration.showNotification(data.title || 'WhaleArc', {
      body: data.body || '새로운 알림이 있습니다',
      icon: '/favicon.svg',
      badge: '/favicon.svg',
      data: data,
    })
  );
});

// 알림 클릭 시 대시보드로 이동
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(clients.openWindow('/dashboard'));
});
