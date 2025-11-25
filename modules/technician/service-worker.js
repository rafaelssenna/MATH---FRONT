// Incrementa versão a cada deploy para forçar atualização
const CACHE_NAME = 'math-v' + Date.now()

// Apenas assets estáticos (imagens, ícones)
const STATIC_ASSETS = [
  './helsenservicelogo.png',
  './logohelsenbranca.png',
  './mate-icon.jpg'
]

self.addEventListener('install', (event) => {
  console.log('🔧 Service Worker: Instalando nova versão...')
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('📦 Service Worker: Cacheando apenas assets estáticos')
      return cache.addAll(STATIC_ASSETS)
    }).then(() => {
      console.log('✅ Service Worker: Instalação completa')
      // FORÇA ativação imediata do novo SW
      return self.skipWaiting()
    })
  )
})

self.addEventListener('activate', (event) => {
  console.log('🔄 Service Worker: Ativando...')
  event.waitUntil(
    caches.keys().then((keys) => {
      // DELETA TODOS os caches antigos
      return Promise.all(
        keys.map(key => {
          if (key !== CACHE_NAME) {
            console.log('🗑️ Service Worker: Deletando cache antigo:', key)
            return caches.delete(key)
          }
        })
      )
    }).then(() => {
      console.log('✅ Service Worker: Ativado! Cache limpo.')
      // Toma controle de TODAS as abas imediatamente
      return self.clients.claim()
    })
  )
})

self.addEventListener('fetch', (event) => {
  const req = event.request
  const url = new URL(req.url)

  // Só intercepta requisições GET
  if (req.method !== 'GET') return

  // NUNCA cacheia APIs
  if (req.url.includes('railway.app') || req.url.includes('/api/')) return

  // NETWORK FIRST para .js, .css, .html = SEMPRE busca versão nova primeiro
  if (url.pathname.endsWith('.js') || url.pathname.endsWith('.css') || url.pathname.endsWith('.html') || url.pathname === './') {
    event.respondWith(
      fetch(req)
        .then(response => {
          // Salva no cache em background (mas SEMPRE serve da rede)
          if (response.status === 200) {
            const copy = response.clone()
            caches.open(CACHE_NAME).then(cache => cache.put(req, copy)).catch(() => {})
          }
          return response
        })
        .catch(() => {
          // Se offline, USA cache como fallback
          return caches.match(req).then(cached => {
            if (cached) {
              console.log('📴 Offline: Servindo do cache:', url.pathname)
              return cached
            }
            return new Response('Offline', { status: 503 })
          })
        })
    )
    return
  }

  // CACHE FIRST apenas para imagens (mudam raramente)
  event.respondWith(
    caches.match(req).then(cached => {
      if (cached) return cached
      return fetch(req).then(response => {
        if (response.status === 200) {
          const copy = response.clone()
          caches.open(CACHE_NAME).then(cache => cache.put(req, copy)).catch(() => {})
        }
        return response
      })
    })
  )
})
