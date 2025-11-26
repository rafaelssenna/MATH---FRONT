/**
 * Service Worker MÍNIMO - MATH Helsen Service
 *
 * OBJETIVO: Permitir instalação do PWA SEM cache problemático
 * - Todas as requisições vão direto para a rede (sempre atualizado)
 * - Se atualiza automaticamente quando há nova versão
 * - Zero cache = zero problemas de versão antiga
 */

const SW_VERSION = '1.0.0'

// Instalação: ativa imediatamente
self.addEventListener('install', (event) => {
  console.log('[SW] Instalando versão', SW_VERSION)
  // Pula waiting e ativa imediatamente
  self.skipWaiting()
})

// Ativação: limpa qualquer cache antigo e assume controle
self.addEventListener('activate', (event) => {
  console.log('[SW] Ativando versão', SW_VERSION)
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      // Deleta TODOS os caches (garantia de sempre atualizado)
      return Promise.all(
        cacheNames.map((cacheName) => {
          console.log('[SW] Deletando cache:', cacheName)
          return caches.delete(cacheName)
        })
      )
    }).then(() => {
      // Assume controle de todas as páginas imediatamente
      return self.clients.claim()
    })
  )
})

// Fetch: SEMPRE vai para a rede (sem cache)
self.addEventListener('fetch', (event) => {
  // Não intercepta - deixa ir direto para a rede
  // Isso garante que o app sempre terá a versão mais recente
  return
})

// Mensagem para forçar atualização se necessário
self.addEventListener('message', (event) => {
  if (event.data === 'skipWaiting') {
    self.skipWaiting()
  }
})
