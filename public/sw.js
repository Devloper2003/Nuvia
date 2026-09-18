// ChandraCycle Service Worker — offline-first caching for PWA
const CACHE = 'chandracycle-v3'
const CORE = ['/', '/manifest.json', '/icon.svg', '/icon-maskable.svg']

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
  let data = { title: 'ChandraCycle', body: 'You have a new update.', url: '/' }
  try {
    if (event.data) data = { ...data, ...event.data.json() }
  } catch {
    if (event.data) data.body = event.data.text()
  }
  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: '/icon-maskable.svg',
      badge: '/icon.svg',
      tag: data.tag || 'chandracycle',
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
self.addEventListener('fetch', (event) => {
  const req = event.request
  if (req.method !== 'GET') return
  const url = new URL(req.url)
  // Only handle same-origin requests
  if (url.origin !== self.location.origin) return

  // Network-first for navigation (HTML), cache fallback offline
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone()
          caches.open(CACHE).then((c) => c.put(req, copy))
          return res
        })
        .catch(() => caches.match(req).then((r) => r || caches.match('/')))
    )
    return
  }

  // Stale-while-revalidate for static assets (JS/CSS/fonts/images):
  // serve the cached copy instantly, refresh it in the background. This keeps
  // the app fast AND avoids serving stale code after a new deployment.
  if (req.destination === 'script' || req.destination === 'style' || req.destination === 'font' || req.destination === 'image') {
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

  // Default: try network, fall back to cache
  event.respondWith(
    fetch(req)
      .then((res) => {
        const copy = res.clone()
        caches.open(CACHE).then((c) => c.put(req, copy))
        return res
      })
      .catch(() => caches.match(req))
  )
})
