/* JP App — Service Worker */
const CACHE = 'jp-app-v1'

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE)
      .then(c => c.add('/'))
      .then(() => self.skipWaiting())
  )
})

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(k => k !== CACHE).map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  )
})

self.addEventListener('fetch', e => {
  const { request } = e
  const url = new URL(request.url)

  if (request.method !== 'GET') return
  if (url.origin !== location.origin) return
  if (url.pathname.startsWith('/api/')) return

  // Navigation: network-first, fallback to cached shell
  if (request.mode === 'navigate') {
    e.respondWith(
      fetch(request)
        .then(r => {
          if (r.ok) caches.open(CACHE).then(c => c.put(request, r.clone()))
          return r
        })
        .catch(() =>
          caches.match('/').then(r => r ?? new Response('Offline', { status: 503 }))
        )
    )
    return
  }

  // Static assets: cache-first, refresh in background
  e.respondWith(
    caches.match(request).then(cached => {
      const network = fetch(request).then(r => {
        if (r.ok) caches.open(CACHE).then(c => c.put(request, r.clone()))
        return r
      })
      return cached ?? network
    })
  )
})
