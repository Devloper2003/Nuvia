// Nuvia Service Worker — offline shell + push, WITHOUT data caching.
const CACHE = 'nuvia-v6'
const CORE = ['/', '/manifest.json', '/brand/nuvia-mark-192.png', '/brand/nuvia-mark-512.png', '/offline']

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(CORE)).catch(() => {})
  )
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    )
  )
  self.clients.claim()
})

// ─── Web Push ─────────────────────────────────────────────────────────────────
// Server payloads are JSON: { title, body, tag?, url?, type? }
self.addEventListener('push', (event) => {
  let data = { title: 'Nuvia', body: 'You have a new update.', url: '/' }
  try {
    if (event.data) data = { ...data, ...event.data.json() }
  } catch {
    if (event.data) data.body = event.data.text()
  }
  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: '/brand/nuvia-mark-192.png',
      badge: '/brand/nuvia-mark-192.png',
      tag: data.tag || 'nuvia',
      renotify: true,
      data: { url: data.url || '/' },
      vibrate: [80, 40, 80],
    })
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url = (event.notification.data && event.notification.data.url) || '/'
  event.waitUntil(
    self.clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        for (const client of clientList) {
          if ('focus' in client) {
            if ('navigate' in client && url !== '/') {
              client.navigate(url).catch(() => {})
            }
            return client.focus()
          }
        }
        return self.clients.openWindow(url)
      })
  )
})

// ─── Fetch handling ───────────────────────────────────────────────────────────
// RULES (learned the hard way):
//  • NEVER cache /api/* responses. Caching /api/auth/me served a DELETED
//    user's session to the next visitor — stale identity, stale cycles,
//    stale everything. API data must always come from the network; the app
//    already renders friendly error/offline states when it fails.
//  • Code assets (JS/CSS) are NETWORK-FIRST. Stale-while-revalidate ran old
//    bundles after each deploy because dev/un-hashed chunk URLs collide in
//    the cache — users kept seeing the previous version of the app.
//  • Only cache 2xx responses, so error pages never poison the cache.
self.addEventListener('fetch', (event) => {
  const req = event.request
  if (req.method !== 'GET') return
  const url = new URL(req.url)
  // Only handle same-origin requests
  if (url.origin !== self.location.origin) return

  // ── API: pass straight through to the network (no interception) ──────────
  if (url.pathname.startsWith('/api/')) return

  // ── Navigation (HTML): network-first, offline fallback → /offline ────────
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((res) => {
          if (res && res.status === 200) {
            const copy = res.clone()
            caches.open(CACHE).then((c) => c.put(req, copy))
          }
          return res
        })
        .catch(() =>
          caches
            .match(req)
            .then((r) => r || caches.match('/offline'))
            .then((r) => r || caches.match('/'))
        )
    )
    return
  }

  // ── App code (JS/CSS): network-first, cache only as OFFLINE fallback ─────
  if (req.destination === 'script' || req.destination === 'style') {
    event.respondWith(
      fetch(req)
        .then((res) => {
          if (res && res.status === 200) {
            const copy = res.clone()
            caches.open(CACHE).then((c) => c.put(req, copy))
          }
          return res
        })
        .catch(() => caches.match(req).then((r) => r || Response.error()))
    )
    return
  }

  // ── Fonts & images: stale-while-revalidate (immutable content) ───────────
  if (req.destination === 'font' || req.destination === 'image') {
    event.respondWith(
      caches.match(req).then((cached) => {
        const network = fetch(req)
          .then((res) => {
            if (res && res.status === 200) {
              const copy = res.clone()
              caches.open(CACHE).then((c) => c.put(req, copy))
            }
            return res
          })
          .catch(() => cached)
        return cached || network
      })
    )
    return
  }

  // ── Everything else: network-first, cache only 2xx responses ─────────────
  event.respondWith(
    fetch(req)
      .then((res) => {
        if (res && res.status >= 200 && res.status < 300) {
          const copy = res.clone()
          caches.open(CACHE).then((c) => c.put(req, copy))
        }
        return res
      })
      .catch(() => caches.match(req))
  )
})
