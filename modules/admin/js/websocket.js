/**
 * ╔═══════════════════════════════════════════════════════════════════════════════╗
 * ║                    WEBSOCKET E AUTO-REFRESH - ADMIN                           ║
 * ╚═══════════════════════════════════════════════════════════════════════════════╝
 */

/**
 * Conecta ao WebSocket para notificações em tempo real
 */
function connectWebSocket() {
  if (socket && socket.connected) return

  socket = io(API_URL, {
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionDelay: 1000,
    reconnectionAttempts: 5
  })

  socket.on('connect', () => {
    console.log('✅ WebSocket conectado!')
    socket.emit('identify', { userType: 'admin', userId: localStorage.getItem('adminName') })
  })

  socket.on('disconnect', () => {
    console.log('❌ WebSocket desconectado')
  })

  // Nova solicitação criada por cliente
  socket.on('new_request', (data) => {
    console.log('📢 Nova solicitação recebida:', data)
    showToast(`Nova solicitação #${data.id} de ${data.company_name}`, 'success')
    // Recarrega lista se estiver na seção de solicitações
    const currentSection = document.querySelector('.admin-page[style*="display: block"]')?.id
    if (currentSection === 'requestsSection' && typeof loadRequestsSection === 'function') {
      loadRequestsSection()
    }
  })

  // OS criada (quando admin atribui técnico)
  socket.on('os_created', (data) => {
    console.log('📢 OS criada:', data)
  })
}

/**
 * Desconecta do WebSocket
 */
function disconnectWebSocket() {
  if (socket) {
    socket.disconnect()
    socket = null
  }
}

/**
 * Inicia auto-refresh para uma seção específica
 */
function startAutoRefresh(sectionName, refreshFunction, intervalSeconds = 10) {
  stopAutoRefreshForSection(sectionName)

  const intervalId = setInterval(() => {
    if (document.getElementById('admin-section')?.style.display !== 'none') {
      refreshFunction()
    }
  }, intervalSeconds * 1000)

  autoRefreshIntervals.push({ section: sectionName, id: intervalId })
}

/**
 * Para auto-refresh de uma seção específica
 */
function stopAutoRefreshForSection(sectionName) {
  autoRefreshIntervals = autoRefreshIntervals.filter(item => {
    if (item.section === sectionName) {
      clearInterval(item.id)
      return false
    }
    return true
  })
}

/**
 * Para todos os auto-refresh intervals
 */
function stopAllAutoRefresh() {
  autoRefreshIntervals.forEach(item => {
    clearInterval(item.id)
  })
  autoRefreshIntervals = []
}

// Exporta globalmente
window.connectWebSocket = connectWebSocket
window.disconnectWebSocket = disconnectWebSocket
window.startAutoRefresh = startAutoRefresh
window.stopAutoRefreshForSection = stopAutoRefreshForSection
window.stopAllAutoRefresh = stopAllAutoRefresh
