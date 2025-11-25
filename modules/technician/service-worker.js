// Versão estável do cache (incrementar manualmente apenas em mudanças críticas)
const CACHE_VERSION = 'v1.0.0'
const CACHE_NAME = `math-${CACHE_VERSION}`

// Apenas assets estáticos (imagens, ícones)
const STATIC_ASSETS = [
  './helsenservicelogo.png',
  './logohelsenbranca.png',
  './mate-icon.jpg'
]

self.addEventListener('install', (event) => {
  console.log('🔧 Service Worker: Nova versão disponível em background')
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('📦 Service Worker: Cacheando assets estáticos')
      return cache.addAll(STATIC_ASSETS)
    }).then(() => {
      console.log('✅ Service Worker: Instalação completa')
      // NÃO força skipWaiting - deixa atualizar naturalmente
      // O novo SW ficará em espera até todas as abas serem fechadas
    })
  )
})

self.addEventListener('activate', (event) => {
  console.log('🔄 Service Worker: Ativando nova versão')
  event.waitUntil(
    caches.keys().then((keys) => {
      // Remove apenas caches muito antigos
      return Promise.all(
        keys.map(key => {
          if (key.startsWith('math-') && key !== CACHE_NAME) {
            console.log('🗑️ Service Worker: Removendo cache antigo:', key)
            return caches.delete(key)
          }
        })
      )
    }).then(() => {
      console.log('✅ Service Worker: Ativado com sucesso')
      // NÃO força clients.claim() - deixa a transição ser suave
    })
  )
})

self.addEventListener('fetch', (event) => {
  const req = event.request
  const url = new URL(req.url)

  // Só intercepta requisições GET
  if (req.method !== 'GET') return

  // NUNCA cacheia APIs - sempre busca dados frescos
  if (req.url.includes('railway.app') || req.url.includes('/api/')) return

  // Para imagens estáticas, usa cache
  if (STATIC_ASSETS.some(asset => url.pathname.includes(asset))) {
    event.respondWith(
      caches.match(req).then(cached => {
        if (cached) return cached
        return fetch(req).then(response => {
          if (response.status === 200) {
            const copy = response.clone()
            caches.open(CACHE_NAME).then(cache => cache.put(req, copy))
          }
          return response
        })
      })
    )
    return
  }

  // Para todo o resto (JS, CSS, HTML), SEMPRE busca da rede
  // Não interfere no fluxo normal - deixa o navegador gerenciar
  // Isso evita problemas de cache desatualizado
})