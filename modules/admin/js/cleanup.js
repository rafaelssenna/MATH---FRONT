/**
 * ╔═══════════════════════════════════════════════════════════════════════════════╗
 * ║              SISTEMA DE CLEANUP E GERENCIAMENTO DE RECURSOS                   ║
 * ╚═══════════════════════════════════════════════════════════════════════════════╝
 */

/**
 * Gerenciador centralizado de event listeners para evitar vazamentos de memória
 */
const ListenerManager = {
  _listeners: [],

  /**
   * Adiciona um event listener e registra para cleanup posterior
   */
  add(element, event, handler, section = 'global') {
    if (!element) return
    element.addEventListener(event, handler)
    this._listeners.push({ element, event, handler, section })
  },

  /**
   * Remove todos os listeners de uma seção específica
   */
  clearSection(section) {
    this._listeners = this._listeners.filter(item => {
      if (item.section === section) {
        try {
          item.element.removeEventListener(item.event, item.handler)
        } catch (e) {
          // Elemento pode não existir mais
        }
        return false
      }
      return true
    })
  },

  /**
   * Remove TODOS os listeners registrados (usado no logout)
   */
  clearAll() {
    this._listeners.forEach(item => {
      try {
        item.element.removeEventListener(item.event, item.handler)
      } catch (e) {
        // Elemento pode não existir mais
      }
    })
    this._listeners = []
  }
}

/**
 * Cleanup global - chamado no logout
 */
function globalCleanup() {
  console.log('[Cleanup] Executando limpeza global...')

  // Para todos os auto-refresh intervals
  if (typeof stopAllAutoRefresh === 'function') {
    stopAllAutoRefresh()
  }

  // Remove todos os event listeners registrados
  ListenerManager.clearAll()

  // Fecha conexão WebSocket
  if (socket) {
    try {
      socket.disconnect()
      socket = null
    } catch (e) {
      console.warn('[Cleanup] Erro ao fechar WebSocket:', e)
    }
  }

  // Limpa caches
  cachedTechnicians = []
  cachedCompanies = []

  // Reseta paginação
  osPagination = { page: 1, limit: 10, total: 0 }

  console.log('[Cleanup] Limpeza global concluída')
}

// Exporta globalmente
window.ListenerManager = ListenerManager
window.globalCleanup = globalCleanup
