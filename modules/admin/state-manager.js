/**
 * State Manager para o Painel Administrativo
 * Gerencia persistência de estado e sincronização com URL
 */

class AdminStateManager {
  constructor() {
    this.STATE_KEY = 'admin_state'
    this.currentState = this.loadState()
  }

  /**
   * Carrega estado salvo do sessionStorage
   */
  loadState() {
    try {
      const saved = sessionStorage.getItem(this.STATE_KEY)
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
      isLoggedIn: localStorage.getItem('adminLoggedIn') === 'true',
      currentSection: 'osSection',
      currentSubTab: null, // Para gestão de empresas
      scrollPosition: {},
      searchQuery: '',
      filters: {},
      modalState: null,
      lastUpdate: Date.now()
    }
  }

  /**
   * Salva estado atual no sessionStorage
   */
  saveState() {
    try {
      this.currentState.lastUpdate = Date.now()
      sessionStorage.setItem(this.STATE_KEY, JSON.stringify(this.currentState))
    } catch (e) {
      console.warn('Erro ao salvar estado:', e)
    }
  }

  /**
   * Atualiza seção atual e sincroniza com URL
   */
  setSection(sectionId) {
    this.currentState.currentSection = sectionId
    this.saveState()
    this.updateURL()
  }

  /**
   * Atualiza sub-tab (ex: empresas, usuários, máquinas)
   */
  setSubTab(subTab) {
    this.currentState.currentSubTab = subTab
    this.saveState()
    this.updateURL()
  }

  /**
   * Salva posição de scroll da seção atual
   */
  saveScrollPosition(sectionId, position) {
    this.currentState.scrollPosition[sectionId] = position
    this.saveState()
  }

  /**
   * Restaura posição de scroll da seção
   */
  restoreScrollPosition(sectionId) {
    const position = this.currentState.scrollPosition[sectionId]
    if (position !== undefined) {
      setTimeout(() => {
        window.scrollTo(0, position)
      }, 100)
    }
  }

  /**
   * Atualiza URL baseado no estado atual
   */
  updateURL() {
    const sectionMap = {
      'osSection': 'os',
      'companiesSection': 'empresas',
      'usersSection': 'tecnicos',
      'vehiclesSection': 'veiculos',
      'requestsSection': 'solicitacoes',
      'scheduleSection': 'programacao'
    }
    
    let hash = '#/'
    const section = sectionMap[this.currentState.currentSection] || 'os'
    hash += section
    
    if (this.currentState.currentSubTab && section === 'empresas') {
      hash += '/' + this.currentState.currentSubTab
    }
    
    if (window.location.hash !== hash) {
      window.history.pushState({ 
        section: this.currentState.currentSection,
        subTab: this.currentState.currentSubTab
      }, '', hash)
    }
  }

  /**
   * Restaura estado baseado na URL atual
   */
  restoreFromURL() {
    const hash = window.location.hash.slice(2) // Remove #/
    const parts = hash.split('/')
    
    const reverseMap = {
      'os': 'osSection',
      'empresas': 'companiesSection',
      'tecnicos': 'usersSection',
      'veiculos': 'vehiclesSection',
      'solicitacoes': 'requestsSection',
      'programacao': 'scheduleSection'
    }
    
    if (parts[0] && reverseMap[parts[0]]) {
      this.currentState.currentSection = reverseMap[parts[0]]
    }
    
    if (parts[1]) {
      this.currentState.currentSubTab = parts[1]
    }

    this.saveState()
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
   * Salva dados de um formulário/modal
   */
  saveModalState(modalId, data) {
    this.currentState.modalState = { modalId, data }
    this.saveState()
  }

  /**
   * Restaura dados de modal
   */
  getModalState() {
    return this.currentState.modalState
  }

  /**
   * Limpa estado do modal
   */
  clearModalState() {
    this.currentState.modalState = null
    this.saveState()
  }
}

// Instância global do gerenciador de estado
window.adminStateManager = new AdminStateManager()

// Listener para mudanças de navegação via botão voltar/avançar
window.addEventListener('popstate', (event) => {
  if (window.adminStateManager) {
    const state = window.adminStateManager.restoreFromURL()
    if (state.currentSection && typeof window.activateSection === 'function') {
      window.activateSection(state.currentSection)
    }
  }
})

// Listener para mudanças no hash
window.addEventListener('hashchange', () => {
  if (window.adminStateManager) {
    const state = window.adminStateManager.restoreFromURL()
    if (state.currentSection && typeof window.activateSection === 'function') {
      window.activateSection(state.currentSection)
    }
  }
})

// Auto-save do scroll position
let scrollSaveTimeout
window.addEventListener('scroll', () => {
  clearTimeout(scrollSaveTimeout)
  scrollSaveTimeout = setTimeout(() => {
    if (window.adminStateManager) {
      const currentSection = window.adminStateManager.currentState.currentSection
      if (currentSection) {
        window.adminStateManager.saveScrollPosition(currentSection, window.scrollY)
      }
    }
  }, 500)
})
