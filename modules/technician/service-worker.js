const CACHE_NAME = 'math-v4'
const urlsToCache = [
  './',
  './index.html',
  './manifest.webmanifest',
  './styles.css',
  './tecnico.js',
  './company-info.js',
  './state-manager.js',
  './utils.js',
  './helsenservicelogo.png',
  './logohelsenbranca.png',
  './mate-icon.jpg'
]

self.addEventListener('install', (event) => {
  console.log('Service Worker: Installing...')
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('Service Worker: Caching files')
      return cache.addAll(urlsToCache)
    }).then(() => {
      console.log('Service Worker: Installation complete')
      self.skipWaiting()
    })
  )
})

self.addEventListener('activate', (event) => {
  console.log('Service Worker: Activating...')
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter(key => key !== CACHE_NAME).map(key => {
          console.log('Service Worker: Deleting old cache', key)
          return caches.delete(key)
        })
      )
    }).then(() => {
      console.log('Service Worker: Activation complete')
      return self.clients.claim()
    })
  )
})

self.addEventListener('fetch', (event) => {
  const req = event.request
  
  // Só intercepta requisições GET
  if (req.method !== 'GET') return
  
  // Não intercepta requisições para APIs externas
  if (req.url.includes('railway.app') || req.url.includes('api/')) return
  
  event.respondWith(
    caches.match(req).then((cached) => {
      if (cached) {
        console.log('Service Worker: Serving from cache', req.url)
        return cached
      }
      
      return fetch(req).then((networkResponse) => {
        // Só cacheia respostas válidas
        if (networkResponse.status === 200) {
          const copy = networkResponse.clone()
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(req, copy)
          }).catch(() => {})
        }
        return networkResponse
      }).catch(() => {
        console.log('Service Worker: Network failed, no cache available for', req.url)
        return new Response('Offline', { status: 503 })
      })
    })
  )
})
