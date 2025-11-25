/**
 * State Manager para o Portal do Cliente
 * Gerencia persistência de estado e sincronização com URL
 */

class ClientStateManager {
  constructor() {
    this.STATE_KEY = 'client_state'
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
      isLoggedIn: localStorage.getItem('clientLoggedIn') === 'true',
      scrollPosition: 0,
      formData: {
        clientNome: '',
        clientMotivoChamado: '',
        selectedMachine: null,
        machinePending: false
      },
      filters: {
        periodoInicio: '',
        periodoFim: '',
        equipamento: '',
        numeroSerie: ''
      },
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
   * Salva dados do formulário de solicitação
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
   * Salva filtros de pesquisa
   */
  saveFilters(filters) {
    this.currentState.filters = {
      ...this.currentState.filters,
      ...filters
    }
    this.saveState()
    this.updateURL()
  }

  /**
   * Restaura filtros
   */
  restoreFilters() {
    return this.currentState.filters
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
   * Atualiza URL baseado nos filtros
   */
  updateURL() {
    const params = new URLSearchParams()
    
    const filters = this.currentState.filters
    if (filters.periodoInicio) params.set('inicio', filters.periodoInicio)
    if (filters.periodoFim) params.set('fim', filters.periodoFim)
    if (filters.equipamento) params.set('eq', filters.equipamento)
    if (filters.numeroSerie) params.set('serie', filters.numeroSerie)

    const hash = '#/historico'
    const newURL = params.toString() ? `${hash}?${params.toString()}` : hash
    
    if (window.location.hash + window.location.search !== newURL) {
      window.history.pushState({ filters }, '', newURL)
    }
  }

  /**
   * Restaura estado baseado na URL atual
   */
  restoreFromURL() {
    const params = new URLSearchParams(window.location.search)
    
    const filters = {}
    if (params.has('inicio')) filters.periodoInicio = params.get('inicio')
    if (params.has('fim')) filters.periodoFim = params.get('fim')
    if (params.has('eq')) filters.equipamento = params.get('eq')
    if (params.has('serie')) filters.numeroSerie = params.get('serie')

    if (Object.keys(filters).length > 0) {
      this.currentState.filters = { ...this.currentState.filters, ...filters }
      this.saveState()
    }

    return this.currentState
  }

  /**
   * Limpa estado (útil no logout)
   */
  clearState() {
    sessionStorage.removeItem(this.STATE_KEY)
    this.currentState = this.getDefaultState()
    window.history.replaceState(null, '', window.location.pathname + '#/historico')
  }

  /**
   * Obtém estado atual
   */
  getState() {
    return { ...this.currentState }
  }

  /**
   * Limpa apenas os dados do formulário
   */
  clearFormData() {
    this.currentState.formData = this.getDefaultState().formData
    this.saveState()
  }
}

// Instância global do gerenciador de estado
window.clientStateManager = new ClientStateManager()

// Listener para mudanças de navegação via botão voltar/avançar
window.addEventListener('popstate', () => {
  if (window.clientStateManager) {
    window.clientStateManager.restoreFromURL()
    if (typeof window.restoreFiltersFromState === 'function') {
      window.restoreFiltersFromState()
    }
  }
})

// Listener para mudanças no hash
window.addEventListener('hashchange', () => {
  if (window.clientStateManager) {
    window.clientStateManager.restoreFromURL()
    if (typeof window.restoreFiltersFromState === 'function') {
      window.restoreFiltersFromState()
    }
  }
})

// Auto-save do scroll position
let scrollSaveTimeout
window.addEventListener('scroll', () => {
  clearTimeout(scrollSaveTimeout)
  scrollSaveTimeout = setTimeout(() => {
    if (window.clientStateManager) {
      window.clientStateManager.saveScrollPosition(window.scrollY)
    }
  }, 500)
})
