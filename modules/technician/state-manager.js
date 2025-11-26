/**
 * State Manager para o Painel do Técnico
 * Gerencia persistência de estado e sincronização com URL
 */

class TechnicianStateManager {
  constructor() {
    this.STATE_KEY = 'technician_state'
    this.currentState = this.loadState()
  }

  /**
   * Carrega estado salvo do localStorage (persiste mesmo fechando o navegador)
   */
  loadState() {
    try {
      const saved = localStorage.getItem(this.STATE_KEY)
      return saved ? JSON.parse(saved) : this.getDefaultState()
    } catch (e) {
      console.warn('Erro ao carregar estado:', e)
      return this.getDefaultState()
    }
  }

  /**
   * Estado padrão inicial
   */
  getDefaultState() {
    return {
      isLoggedIn: localStorage.getItem('technicianLoggedIn') === 'true',
      scrollPosition: 0,
      openOS: null, // ID da OS sendo finalizada
      formData: {
        timeEntries: [],
        displacements: [],
        materials: [],
        description: '',
        occurrence: '',
        selectedMachine: null
      },
      chatOpen: false,
      lastUpdate: Date.now()
    }
  }

  /**
   * Salva estado atual no localStorage (persiste mesmo fechando o navegador)
   */
  saveState() {
    try {
      this.currentState.lastUpdate = Date.now()
      localStorage.setItem(this.STATE_KEY, JSON.stringify(this.currentState))
    } catch (e) {
      console.warn('Erro ao salvar estado:', e)
    }
  }

  /**
   * Define qual OS está sendo trabalhada
   */
  setOpenOS(osId) {
    this.currentState.openOS = osId
    this.saveState()
    this.updateURL()
  }

  /**
   * Salva dados do formulário de finalização
   */
  saveFormData(formData) {
    this.currentState.formData = {
      ...this.currentState.formData,
      ...formData
    }
    this.saveState()
  }

  /**
   * Restaura dados do formulário
   */
  restoreFormData() {
    return this.currentState.formData
  }

  /**
   * Salva estado do chat
   */
  setChatOpen(isOpen) {
    this.currentState.chatOpen = isOpen
    this.saveState()
  }

  /**
   * Salva posição de scroll
   */
  saveScrollPosition(position) {
    this.currentState.scrollPosition = position
    this.saveState()
  }

  /**
   * Restaura posição de scroll
   */
  restoreScrollPosition() {
    const position = this.currentState.scrollPosition
    if (position !== undefined && position > 0) {
      setTimeout(() => {
        window.scrollTo(0, position)
      }, 100)
    }
  }

  /**
   * Atualiza URL baseado no estado atual
   */
  updateURL() {
    const hash = this.currentState.openOS 
      ? `#/os/${this.currentState.openOS}`
      : '#/os'
    
    if (window.location.hash !== hash) {
      window.history.pushState({ 
        osId: this.currentState.openOS
      }, '', hash)
    }
  }

  /**
   * Restaura estado baseado na URL atual
   */
  restoreFromURL() {
    const hash = window.location.hash.slice(2) // Remove #/
    const parts = hash.split('/')
    
    // URL: #/os/42 -> parts = ['os', '42']
    if (parts[0] === 'os' && parts[1]) {
      this.currentState.openOS = parseInt(parts[1])
      this.saveState()
    } else {
      this.currentState.openOS = null
    }

    return this.currentState
  }

  /**
   * Limpa estado (útil no logout)
   */
  clearState() {
    sessionStorage.removeItem(this.STATE_KEY)
    this.currentState = this.getDefaultState()
    window.history.replaceState(null, '', window.location.pathname + '#/os')
  }

  /**
   * Obtém estado atual
   */
  getState() {
    return { ...this.currentState }
  }

  /**
   * Limpa apenas os dados do formulário (após finalizar OS)
   */
  clearFormData() {
    this.currentState.formData = this.getDefaultState().formData
    this.currentState.openOS = null
    this.saveState()
    this.updateURL()
  }
}

// Instância global do gerenciador de estado
window.technicianStateManager = new TechnicianStateManager()

// Listener para mudanças de navegação via botão voltar/avançar
window.addEventListener('popstate', () => {
  if (window.technicianStateManager) {
    const state = window.technicianStateManager.restoreFromURL()
    if (state.openOS) {
      if (typeof window.reopenOSModal === 'function') {
        window.reopenOSModal(state.openOS)
      }
    } else {
      if (typeof window.closeFinishModal === 'function') {
        window.closeFinishModal()
      }
    }
  }
})

// Listener para mudanças no hash
window.addEventListener('hashchange', () => {
  if (window.technicianStateManager) {
    const state = window.technicianStateManager.restoreFromURL()
    if (state.openOS) {
      if (typeof window.reopenOSModal === 'function') {
        window.reopenOSModal(state.openOS)
      }
    } else {
      if (typeof window.closeFinishModal === 'function') {
        window.closeFinishModal()
      }
    }
  }
})

// Auto-save do scroll position
let scrollSaveTimeout
window.addEventListener('scroll', () => {
  clearTimeout(scrollSaveTimeout)
  scrollSaveTimeout = setTimeout(() => {
    if (window.technicianStateManager) {
      window.technicianStateManager.saveScrollPosition(window.scrollY)
    }
  }, 500)
})
