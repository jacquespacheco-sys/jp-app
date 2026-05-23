/* JP App — Service Worker */
const CACHE = 'jp-app-v2'

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

// Em dev (localhost / 127.0.0.1) o SW NÃO deve cachear nada — Vite
// gerencia HMR e o módulo graph muda a cada edição. Cache-first aqui
// serve módulos velhos pra sempre. Auto-desregistra e limpa cache.
const IS_DEV = ['localhost', '127.0.0.1'].includes(location.hostname)
if (IS_DEV) {
  self.addEventListener('install', () => self.skipWaiting())
  self.addEventListener('activate', e => {
    e.waitUntil(
      caches.keys()
        .then(keys => Promise.all(keys.map(k => caches.delete(k))))
        .then(() => self.registration.unregister())
        .then(() => self.clients.matchAll())
        .then(cs => cs.forEach(c => c.navigate(c.url)))
    )
  })
}

self.addEventListener('fetch', e => {
  if (IS_DEV) return

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
