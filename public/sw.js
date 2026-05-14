// Cabine 2.0 — Service Worker v3
// Cache statique + File hors-ligne IndexedDB + Push notifications FCM ready

const CACHE_NAME = 'cabine-v3';
const STATIC_ASSETS = ['/', '/index.html', '/manifest.json', '/logos/orange.svg', '/logos/mtn.svg', '/logos/wave.svg', '/logos/moov.svg'];
const TX_ENDPOINTS = ['/api/transfer', '/api/retrait', '/api/airtime', '/api/internet'];
const DB_NAME = 'cabine-offline-queue';
const STORE_NAME = 'tx-queue';

// ── IndexedDB helpers ──
function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id', autoIncrement: true });
      }
    };
    req.onsuccess = (e) => resolve(e.target.result);
    req.onerror = () => reject(req.error);
  });
}

async function enqueueTransaction(request) {
  const db = await openDB();
  const body = await request.clone().text();
  const entry = {
    url: request.url, method: request.method,
    headers: Object.fromEntries(request.headers.entries()),
    body, endpoint: new URL(request.url).pathname, timestamp: Date.now(),
  };
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const req = tx.objectStore(STORE_NAME).add(entry);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function getAllQueued() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const req = tx.objectStore(STORE_NAME).getAll();
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(req.error);
  });
}

async function removeQueued(id) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const req = tx.objectStore(STORE_NAME).delete(id);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

// ── Install ──
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(STATIC_ASSETS).catch(() => {}))
      .then(() => self.skipWaiting())
  );
});

// ── Activate ──
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// ── Fetch ──
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Transactions → Network first, file IndexedDB si hors-ligne
  if (TX_ENDPOINTS.some(e => url.pathname === e) && request.method === 'POST') {
    event.respondWith(
      fetch(request.clone()).catch(async () => {
        const queueId = await enqueueTransaction(request);
        self.clients.matchAll().then(clients =>
          clients.forEach(c => c.postMessage({ type: 'TX_QUEUED', queueId, endpoint: url.pathname }))
        );
        return new Response(JSON.stringify({
          offline: true, queued: true, queueId,
          txId: `OFFLINE-${Date.now()}`, status: 'QUEUED',
          message: '📶 Transaction mise en file. Elle sera envoyée dès le retour du réseau.',
        }), { headers: { 'Content-Type': 'application/json' }, status: 202 });
      })
    );
    return;
  }

  // API → Network first, 503 si hors-ligne
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(request).catch(() =>
        new Response(JSON.stringify({ error: 'Hors ligne. Vérifiez votre connexion.', offline: true }), {
          headers: { 'Content-Type': 'application/json' }, status: 503,
        })
      )
    );
    return;
  }

  // Assets statiques → Cache first
  event.respondWith(
    caches.match(request).then(cached => {
      if (cached) return cached;
      return fetch(request).then(response => {
        if (response.ok && request.method === 'GET') {
          caches.open(CACHE_NAME).then(cache => cache.put(request, response.clone()));
        }
        return response;
      }).catch(() => caches.match('/index.html'));
    })
  );
});

// ── Background Sync ──
self.addEventListener('sync', (event) => {
  if (event.tag === 'replay-tx-queue') event.waitUntil(replayQueue());
});

async function replayQueue() {
  const queued = await getAllQueued();
  if (!queued.length) return;
  const clients = await self.clients.matchAll();
  for (const entry of queued) {
    try {
      const response = await fetch(entry.url, { method: entry.method, headers: entry.headers, body: entry.body });
      if (response.ok) {
        await removeQueued(entry.id);
        const data = await response.json().catch(() => ({}));
        clients.forEach(c => c.postMessage({ type: 'TX_REPLAYED', queueId: entry.id, endpoint: entry.endpoint, result: data }));
      }
    } catch { break; }
  }
}

// ── Messages client ──
self.addEventListener('message', async (event) => {
  if (event.data?.type === 'REPLAY_QUEUE') { await replayQueue(); event.source?.postMessage({ type: 'QUEUE_REPLAYED' }); }
  if (event.data?.type === 'GET_QUEUE_COUNT') { const q = await getAllQueued(); event.source?.postMessage({ type: 'QUEUE_COUNT', count: q.length }); }
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting();
});

// ── Push notifications (FCM ready) ──
self.addEventListener('push', (event) => {
  if (!event.data) return;
  let data = {};
  try { data = event.data.json(); } catch { data = { title: 'Cabine 2.0', body: event.data.text() }; }
  event.waitUntil(
    self.registration.showNotification(data.title || 'Cabine 2.0', {
      body: data.body || '', icon: '/logos/orange.svg', badge: '/favicon.svg',
      data, tag: data.tag || 'cabine-notif', renotify: true, vibrate: [200, 100, 200],
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clients => {
      const open = clients.find(c => c.visibilityState === 'visible');
      if (open) { open.focus(); return; }
      return self.clients.openWindow(event.notification.data?.url || '/');
    })
  );
});
