/*
 * Lógica específica do painel administrativo.
 *
 * Implementa autenticação de administradores e funcionalidades de
 * gerenciamento de ordens de serviço: listagem, pesquisa, visualização
 * detalhada e geração de PDF. As ordens de serviço são armazenadas
 * no localStorage. Um administrador padrão é criado caso nenhum
 * esteja presente.
 */

// URL base da API do backend (Railway). Atualize conforme o domínio de produção.
const API_URL = "https://hs-back-production-f54a.up.railway.app"

// Lista de técnicos em cache para facilitar transferência de OS
let cachedTechnicians = []
let cachedCompanies = []

// ==========================================
// SISTEMA DE ROTAS COM URLs BONITAS
// ==========================================
const ROUTES = {
  'solicitacoes': 'requestsSection',
  'programacao': 'scheduleSection',
  'os': 'osSection',
  'empresas': 'companiesSection',
  'usuarios': 'usersSection',
  'veiculos': 'vehiclesSection',
  'maquinas': 'machinesSection',
  'conferencia': 'reviewSection',
  'faturamento': 'billingSection'
}

// Mapeamento inverso (seção → rota)
const SECTION_TO_ROUTE = Object.fromEntries(
  Object.entries(ROUTES).map(([route, section]) => [section, route])
)

// Sistema de auto-refresh e WebSocket
let autoRefreshIntervals = []
let socket = null
// Paginação de OS (10 por página)
let osPagination = { page: 1, limit: 10, total: 0 }
// Visualização de empresas (cards ou lista)
let companiesViewMode = localStorage.getItem('companiesViewMode') || 'cards'

/**
 * Função utilitária debounce para evitar chamadas excessivas
 */
function debounce(func, wait) {
  let timeout
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout)
      func(...args)
    }
    clearTimeout(timeout)
    timeout = setTimeout(later, wait)
  }
}

/**
 * Ícones SVG profissionais para substituir emojis
 */
const SVGIcons = {
  calendar: '<svg class="icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>',
  user: '<svg class="icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>',
  wrench: '<svg class="icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg>',
  settings: '<svg class="icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M12 1v6m0 6v6m5.66-13.66l-4.24 4.24m0 8.48l4.24 4.24M23 12h-6m-6 0H1m18.66 5.66l-4.24-4.24m-8.48 0l-4.24 4.24"/></svg>',
  clipboard: '<svg class="icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect x="8" y="2" width="8" height="4" rx="1" ry="1"/></svg>',
  building: '<svg class="icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="4" y="2" width="16" height="20" rx="2" ry="2"/><path d="M9 22v-4h6v4M8 6h.01M16 6h.01M8 10h.01M16 10h.01M8 14h.01M16 14h.01"/></svg>',
  trash: '<svg class="icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>',
  arrowLeft: '<svg class="icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>',
  check: '<svg class="icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>',
  x: '<svg class="icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>',
  warning: '<svg class="icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>',
  search: '<svg class="icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>',
  note: '<svg class="icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>',
  plus: '<svg class="icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>'
}

// ==========================================
// CONTROLE DA SIDEBAR MOBILE
// ==========================================

/**
 * Abre/fecha a sidebar em dispositivos móveis
 */
function toggleSidebar() {
  const sidebar = document.getElementById('sidebar')
  const overlay = document.getElementById('sidebarOverlay')

  if (sidebar && overlay) {
    const isOpen = sidebar.classList.contains('open')
    if (isOpen) {
      closeSidebar()
    } else {
      sidebar.classList.add('open')
      overlay.classList.add('active')
      document.body.style.overflow = 'hidden' // Previne scroll do body
    }
  }
}

/**
 * Fecha a sidebar
 */
function closeSidebar() {
  const sidebar = document.getElementById('sidebar')
  const overlay = document.getElementById('sidebarOverlay')

  if (sidebar && overlay) {
    sidebar.classList.remove('open')
    overlay.classList.remove('active')
    document.body.style.overflow = '' // Restaura scroll
  }
}

// Fecha sidebar quando um item do menu é clicado (em mobile)
document.addEventListener('DOMContentLoaded', function() {
  const menuItems = document.querySelectorAll('.sidebar-menu a')
  menuItems.forEach(item => {
    item.addEventListener('click', function() {
      if (window.innerWidth <= 1024) {
        closeSidebar()
      }
    })
  })
})

/**
 * Escapa caracteres HTML para prevenir XSS
 */
function escapeHtml(unsafe) {
  if (!unsafe) return ''
  return String(unsafe)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;")
}

/**
 * Formata data local para ISO sem conversão de timezone
 * Mantém a data/hora exata sem alterar para UTC
 * @param {Date} date - Data a ser formatada
 * @returns {string} - String ISO formatada (YYYY-MM-DDTHH:MM:SS.000Z)
 */
function formatDateToLocalISO(date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  const hours = String(date.getHours()).padStart(2, '0')
  const minutes = String(date.getMinutes()).padStart(2, '0')
  const seconds = String(date.getSeconds()).padStart(2, '0')

  // Formato ISO mas com horário local (sem ajuste de timezone)
  return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}.000Z`
}

/**
 * Converte string de data (que pode conter Z de UTC) para Date tratando como horário local
 * CORRIGE O PROBLEMA DE FUSO HORÁRIO: técnico coloca 14:00, deve aparecer 14:00 no PDF
 * @param {string} dateString - String de data (pode ter .000Z no final)
 * @returns {Date} - Objeto Date com horário local brasileiro
 */
function parseAsLocalTime(dateString) {
  if (!dateString) return null
  // Remove .000Z e Z do final para evitar conversão UTC
  const cleanDate = String(dateString).replace(/\.000Z$/,'').replace(/Z$/,'')
  // Cria Date sem timezone - browser assume horário local
  return new Date(cleanDate)
}

/**
 * Converte horas decimais para formato legível (ex: 4.5 -> "4h 30min")
 * @param {number} decimalHours - Horas em formato decimal
 * @returns {string} - Horas formatadas (ex: "4h 30min" ou "4h")
 */
function formatHours(decimalHours) {
  const hours = Math.floor(decimalHours)
  const minutes = Math.round((decimalHours - hours) * 60)
  if (minutes === 0) return `${hours}h`
  return `${hours}h ${minutes}min`
}

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
    if (currentSection === 'requestsSection') {
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
  // Para qualquer refresh anterior dessa seção
  stopAutoRefreshForSection(sectionName)
  
  // Inicia novo intervalo
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
 * Para todos os auto-refresh
 */
function stopAllAutoRefresh() {
  autoRefreshIntervals.forEach(item => clearInterval(item.id))
  autoRefreshIntervals = []
}

/**
 * Pré-carrega todos os dados do sistema
 */
async function preloadSystemData() {
  try {
    const promises = []
    
    // Timeout de segurança para cada requisição (5 segundos)
    const fetchWithTimeout = (url, timeout = 5000) => {
      return Promise.race([
        fetch(url),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Timeout')), timeout)
        )
      ])
    }
    
    // Carrega empresas
    promises.push(
      fetchWithTimeout(`${API_URL}/api/companies`)
        .then(res => res.json())
        .then(data => { if (Array.isArray(data)) cachedCompanies = data })
        .catch(err => {
          console.warn('Erro ao carregar empresas:', err)
        })
    )
    
    // Carrega técnicos (filtra Sistema NGMAN)
    promises.push(
      fetchWithTimeout(`${API_URL}/api/admin/technicians`)
        .then(res => res.json())
        .then(data => { 
          if (Array.isArray(data)) {
            cachedTechnicians = data.filter(t => t.username !== 'Sistema NGMAN')
          }
        })
        .catch(err => {
          console.warn('Erro ao carregar técnicos:', err)
        })
    )
    
    // Carrega veículos
    promises.push(
      fetchWithTimeout(`${API_URL}/api/vehicles`)
        .then(res => res.json())
        .catch(err => {
          console.warn('Erro ao carregar veículos:', err)
        })
    )
    
    // Aguarda todas as requisições (com timeout global de 10 segundos)
    await Promise.race([
      Promise.all(promises),
      new Promise((resolve) => setTimeout(resolve, 10000))
    ])
  } catch (error) {
    console.error('Erro ao pré-carregar dados:', error)
  }
}

/**
 * Esconde tela de loading
 */
function hideLoadingScreen() {
  const loadingScreen = document.getElementById('loadingScreen')
  if (loadingScreen) {
    // Adiciona animação de fade out
    loadingScreen.style.opacity = '0'
    loadingScreen.style.transition = 'opacity 0.3s ease'

    // Remove após animação
    setTimeout(() => {
      loadingScreen.style.display = 'none'
    }, 300)
  }
}

/**
 * Atualiza logo conforme tema (branco no escuro, normal no claro)
 */
function updateLogos() {
  const theme = document.documentElement.getAttribute('data-theme') || 'dark'
  const logoSrc = theme === 'dark' ? 'logohelsenbranca.png' : 'helsenservicelogo.png'
  
  // Atualiza todos os logos
  const logos = document.querySelectorAll('.logo-image, .login-logo, .loading-logo')
  logos.forEach(img => {
    if (img) img.src = logoSrc
  })
}

/**
 * Abre modal de criação de empresa
 */
function openCreateCompanyModal() {
  const modal = document.getElementById('createCompanyModal')
  if (modal) modal.classList.add('active')
}

/**
 * Fecha modal de criação de empresa
 */
function closeCreateCompanyModal() {
  const modal = document.getElementById('createCompanyModal')
  if (modal) modal.classList.remove('active')

  // Reseta o formulário
  const form = document.getElementById('companyForm')
  if (form) {
    form.reset()
    delete form.dataset.editingId

    // Garante que o checkbox isNew fique desmarcado
    const isNewInput = document.getElementById('companyIsNew')
    if (isNewInput) isNewInput.checked = false
  }

  // Reseta título do modal
  const modalTitle = document.querySelector('#createCompanyModal h2')
  if (modalTitle) modalTitle.textContent = 'Nova Empresa'
}

/**
 * Configura navegação entre as sub-tabs da seção Gestão de Empresas
 */
function setupCompanySubTabs() {
  const subNavBtns = document.querySelectorAll('.sub-nav-btn')
  const subTabs = document.querySelectorAll('.sub-tab-content')
  
  if (!subNavBtns.length || !subTabs.length) return
  
  subNavBtns.forEach((btn) => {
    if (btn.dataset.subTabBound) return
    
    btn.addEventListener('click', () => {
      const tabName = btn.getAttribute('data-tab')
      
      // Atualiza botões ativos
      subNavBtns.forEach((b) => b.classList.remove('active'))
      btn.classList.add('active')
      
      // Mostra tab correspondente
      subTabs.forEach((tab) => {
        if (tab.id === `tab-${tabName}`) {
          tab.style.display = 'block'
        } else {
          tab.style.display = 'none'
        }
      })
      
      // Salva sub-tab no estado
      if (window.adminStateManager) {
        window.adminStateManager.setSubTab(tabName)
      }
      
      // Carrega dados específicos de cada tab
      if (tabName === 'empresas') {
        loadCompaniesAdmin()
      } else if (tabName === 'maquinas') {
        // Máquinas já serão carregadas quando selecionar empresa
        const container = document.getElementById('machinesList')
        if (container) container.innerHTML = '<p class="empty-state">Selecione uma empresa para ver as máquinas</p>'
      }
    })
    
    btn.dataset.subTabBound = 'true'
  })
}

/**
 * Altera o modo de visualização das empresas (cards ou lista)
 */
function setCompaniesView(mode) {
  if (mode !== 'cards' && mode !== 'list') return
  companiesViewMode = mode
  loadCompaniesAdmin()
}

/**
 * Filtra usuários de empresa na aba de usuários
 */
function filterCompanyUsers() {
  const searchInput = document.getElementById('companyUserSearch')
  if (!searchInput) return

  const searchTerm = searchInput.value.toLowerCase().trim()
  const usersList = document.getElementById('companyUsersList')
  if (!usersList) return

  const userCards = usersList.querySelectorAll('.user-card')
  userCards.forEach(card => {
    const text = card.textContent.toLowerCase()
    if (text.includes(searchTerm)) {
      card.style.display = ''
    } else {
      card.style.display = 'none'
    }
  })
}

/**
 * Limpa e fecha o formulário de usuário de empresa
 */
function clearCompanyUserForm() {
  const form = document.getElementById('companyUserForm')
  if (form) form.reset()

  const formContainer = document.getElementById('companyUserFormContainer')
  if (formContainer) formContainer.style.display = 'none'

  // Esconde também o formulário de edição e o card de nova empresa (se existir)
  const editForm = document.getElementById('companyUserForm')
  if (editForm) editForm.style.display = 'none'

  const newCard = document.getElementById('newCompanyCard')
  if (newCard) newCard.style.display = 'none'

  const divider = document.getElementById('companyUserFormDivider')
  if (divider) divider.style.display = 'none'
}

/**
 * Carrega a lista de técnicos a partir do backend e armazena em cache.
 * A lista é usada para transferir OS entre técnicos.
 */
async function loadTechniciansForTransfer() {
  try {
    const res = await fetch(`${API_URL}/api/technicians`)
    const data = await res.json()
    if (Array.isArray(data)) {
      cachedTechnicians = data.filter(t => t.username !== 'Sistema NGMAN')
    }
  } catch (_err) {
    cachedTechnicians = []
  }
}

async function loadCompaniesCache() {
  try {
    const res = await fetch(`${API_URL}/api/companies`)
    const data = await res.json()
    if (Array.isArray(data)) {
      cachedCompanies = data
      // Preenche o select de empresas para criação de usuários quando os dados são carregados
      populateClientCompanySelect()
    }
  } catch (_err) {
    cachedCompanies = []
  }
}

/**
 * Popula o select de empresas no formulário de criação de usuários (clientes).
 * Utiliza a lista cachedCompanies.  Adiciona opção padrão "Selecione...".
 */
function populateClientCompanySelect() {
  const select = document.getElementById('clientCompanySelect')
  if (!select) return
  // Limpa opções atuais
  select.innerHTML = '<option value="">Selecione...</option>'
  if (!Array.isArray(cachedCompanies) || cachedCompanies.length === 0) return
  cachedCompanies.forEach((c) => {
    const opt = document.createElement('option')
    opt.value = c.id
    opt.textContent = c.name || c.username || ''
    select.appendChild(opt)
  })
}

/**
 * Carrega e exibe os usuários (clientes) de uma empresa.  Se nenhum ID
 * for fornecido, exibe estado vazio.  O resultado é mostrado no
 * elemento com id "companyUsersList".
 * @param {string|number} companyId
 */
function loadCompanyUsersList(companyId) {
  const container = document.getElementById('companyUsersList')
  if (!container) return
  if (!companyId) {
    container.innerHTML = '<p class="empty-state">Selecione uma empresa para ver os usuários</p>'
    return
  }
  fetch(`${API_URL}/api/clients?company_id=${companyId}`)
    .then((res) => res.json())
    .then((users) => {
      if (!Array.isArray(users) || users.length === 0) {
        container.innerHTML = '<p class="empty-state">Nenhum usuário cadastrado para esta empresa</p>'
        return
      }
      // Renderiza lista de usuários (nome completo e username)
      container.innerHTML = users
        .map((u) => {
          const fullName = u.full_name || u.username || ''
          const username = u.username || ''
          return `<p><strong>${fullName}</strong> (${username})</p>`
        })
        .join('')
    })
    .catch(() => {
      container.innerHTML = '<p class="empty-state">Erro ao carregar usuários</p>'
    })
}

/**
 * Manipula o envio do formulário de criação de usuário de empresa.
 * Valida dados e envia para o endpoint POST /api/clients/register.  Em
 * caso de sucesso, recarrega a lista de usuários da empresa selecionada.
 */
function handleClientForm(e) {
  e.preventDefault()
  const select = document.getElementById('clientCompanySelect')
  const fullNameInput = document.getElementById('clientFullName')
  const usernameInput = document.getElementById('clientUsername')
  const passwordInput = document.getElementById('clientPassword')
  const companyId = select ? select.value : ''
  const fullName = fullNameInput ? fullNameInput.value.trim() : ''
  const username = usernameInput ? usernameInput.value.trim() : ''
  const password = passwordInput ? passwordInput.value : ''
  if (!companyId || !fullName || !username || !password) {
    showToast('Preencha empresa, nome, usuário e senha.', 'error')
    return
  }
  fetch(`${API_URL}/api/clients/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password, full_name: fullName, company_id: Number(companyId) }),
  })
    .then((res) => {
      if (!res.ok)
        return res.json().then((data) => {
          throw new Error(data.message || 'Erro ao cadastrar usuário')
        })
      return res.json()
    })
    .then(() => {
      showToast('Usuário cadastrado com sucesso!', 'success')
      // Reseta campos do formulário
      if (fullNameInput) fullNameInput.value = ''
      if (usernameInput) usernameInput.value = ''
      if (passwordInput) passwordInput.value = ''
      // Recarrega lista de usuários da empresa atual
      loadCompanyUsersList(companyId)
    })
    .catch((err) => {
      console.error(err)
      showToast(err.message || 'Erro ao cadastrar usuário.', 'error')
    })
}

/**
 * Envia solicitação para transferir uma OS para outro técnico.
 * Utiliza a rota PATCH /api/os/:id/assign do backend.
 * @param {number} osId ID da OS
 */
function transferOSTo(osId) {
  const select = document.getElementById("transferTechSelect")
  if (!select) return
  const techId = select.value
  if (!techId) {
    showToast("Selecione um técnico para transferir.", "error")
    return
  }
  fetch(`${API_URL}/api/os/${osId}/assign`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ technician_id: Number(techId) }),
  })
    .then((res) => res.json())
    .then((data) => {
      if (data && data.message) showToast(data.message, "success")
      else showToast("OS transferida com sucesso!", "success")
      // Atualiza lista e modal
      loadOSList()
      viewOSDetails(osId)
    })
    .catch(() => {
      showToast("Erro ao transferir OS.", "error")
    })
}

// Armazena a OS atualmente visualizada para geração de PDF
let currentOS = null

/**
 * Exibe uma notificação na área de toast.
 * @param {string} message Mensagem a ser exibida
 * @param {string} [type] Tipo de notificação: success ou error
 */
function showToast(message, type = "success") {
  const toast = document.getElementById("toast")
  if (!toast) return
  toast.textContent = message
  toast.className = `toast ${type} show`
  setTimeout(() => {
    toast.classList.remove("show")
  }, 3000)
}

// Inicialização da página
document.addEventListener("DOMContentLoaded", () => {
  // Load theme preference
  const savedTheme = localStorage.getItem("theme") || "dark"

  /**
   * Inicializa o toggle de tema.
   * O tema é salvo no localStorage para persistir entre sessões.
   */
  function initializeTheme() {
    const themeToggle = document.getElementById("themeToggle")
    if (!themeToggle) return
    const savedTheme = localStorage.getItem("theme") || "dark"
    document.documentElement.setAttribute("data-theme", savedTheme)
    updateLogos()
    themeToggle.addEventListener("click", () => {
      const currentTheme = document.documentElement.getAttribute("data-theme")
      const newTheme = currentTheme === "light" ? "dark" : "light"
      document.documentElement.setAttribute("data-theme", newTheme)
      localStorage.setItem("theme", newTheme)
      updateLogos()
    })
  }

  initializeTheme()

  // Remove loading após tempo mínimo e carrega dados em background
  function initializeSystem() {
    const startTime = Date.now()

    // Pré-carrega dados em background
    preloadSystemData().catch(err => {
      console.warn('Aviso: Alguns dados não foram pré-carregados:', err)
    })

    // Aguarda mínimo de 800ms para mostrar o loading (bonito mas rápido)
    const minLoadTime = 800
    const elapsed = Date.now() - startTime
    const remaining = Math.max(0, minLoadTime - elapsed)

    setTimeout(() => {
      hideLoadingScreen()
    }, remaining)
  }

  initializeSystem()

  const logoutBtn = document.getElementById("logoutBtn")
  if (logoutBtn) {
    logoutBtn.addEventListener("click", () => {
      if (confirm("Tem certeza que deseja sair?")) {
        localStorage.removeItem("adminLoggedIn")
        localStorage.removeItem("adminName")
        // Limpa estado ao fazer logout
        if (window.adminStateManager) {
          window.adminStateManager.clearState()
        }
        // Desconecta WebSocket e para auto-refresh
        disconnectWebSocket()
        stopAllAutoRefresh()
        showToast("Logout realizado com sucesso!", "success")
        setTimeout(() => {
          location.reload()
        }, 500)
      }
    })
  }

  // Garante que exista pelo menos um administrador padrão
  const admins = JSON.parse(localStorage.getItem("admins") || "[]")
  if (admins.length === 0) {
    admins.push({ username: "admin", password: "admin" })
    localStorage.setItem("admins", JSON.stringify(admins))
  }
  const loginForm = document.getElementById("adminLoginForm")
  if (loginForm) loginForm.addEventListener("submit", handleAdminLogin)
  checkAdminLogin()
  
  // Inicializa drag and drop
  initDragAndDrop()

  // Vincula handlers dos formulários de empresa e máquina se existirem
  const companyForm = document.getElementById("companyForm")
  if (companyForm && !companyForm.dataset.bound) {
    companyForm.addEventListener("submit", handleCompanyForm)
    companyForm.dataset.bound = "true"
  }

  // Consulta dados do CNPJ automaticamente quando o campo perde o foco
  const companyCnpjInput = document.getElementById("companyCnpj")
  if (companyCnpjInput && !companyCnpjInput.dataset.bound) {
    companyCnpjInput.addEventListener("blur", () => {
      const raw = companyCnpjInput.value || ""
      const digits = raw.replace(/\D/g, "")
      if (digits.length !== 14) return
      fetch(`${API_URL}/api/companies/cnpj/${digits}`)
        .then((res) => res.json())
        .then((data) => {
          if (data && data.name) {
            const nameField = document.getElementById("companyName")
            if (nameField && !nameField.value) nameField.value = data.name
          }
          if (data && data.address) {
            const addrField = document.getElementById("companyAddress")
            if (addrField && !addrField.value) addrField.value = data.address
          }
          // Caso venha situacao (status) ou simples nacional, podemos exibir aviso
          if (data && data.status) {
            showToast(`Situação cadastral: ${data.status}`, "success")
          }
        })
        .catch((_err) => {
          // ignora falhas silenciosamente
        })
    })
    companyCnpjInput.dataset.bound = "true"
  }
  const machineForm = document.getElementById("machineForm")
  if (machineForm && !machineForm.dataset.bound) {
    machineForm.addEventListener("submit", handleMachineForm)
    machineForm.dataset.bound = "true"
  }
  // Formulário de veículos
  const vehicleForm = document.getElementById("vehicleForm")
  if (vehicleForm && !vehicleForm.dataset.bound) {
    vehicleForm.addEventListener("submit", handleVehicleForm)
    vehicleForm.dataset.bound = "true"
  }
  // Quando selecionar empresa na lista de máquinas, carregar máquinas dessa empresa
  const machineCompanySelect = document.getElementById("machineCompanySelect")
  if (machineCompanySelect && !machineCompanySelect.dataset.bound) {
    machineCompanySelect.addEventListener("change", (e) => {
      const companyId = e.target.value
      loadMachinesList(companyId)
    })
    machineCompanySelect.dataset.bound = "true"
  }

  // Formulário de criação de usuários de empresa (clientes)
  const clientForm = document.getElementById("clientForm")
  if (clientForm && !clientForm.dataset.bound) {
    clientForm.addEventListener("submit", handleClientForm)
    clientForm.dataset.bound = "true"
  }
  // Select de empresa para filtrar usuários
  const clientCompanySelect = document.getElementById("clientCompanySelect")
  if (clientCompanySelect && !clientCompanySelect.dataset.bound) {
    clientCompanySelect.addEventListener("change", (e) => {
      const companyId = e.target.value
      loadCompanyUsersList(companyId)
    })
    clientCompanySelect.dataset.bound = "true"
  }

  // Controles de navegação da programação semanal
  const prevWeekBtn = document.getElementById('prevWeekBtn')
  if (prevWeekBtn && !prevWeekBtn.dataset.bound) {
    prevWeekBtn.addEventListener('click', () => {
      if (!window.currentWeekStart) window.currentWeekStart = getMonday(new Date())
      // Subtrai 7 dias
      const newStart = new Date(window.currentWeekStart)
      newStart.setDate(newStart.getDate() - 7)
      window.currentWeekStart = newStart
      loadSchedule()
    })
    prevWeekBtn.dataset.bound = 'true'
  }
  const nextWeekBtn = document.getElementById('nextWeekBtn')
  if (nextWeekBtn && !nextWeekBtn.dataset.bound) {
    nextWeekBtn.addEventListener('click', () => {
      if (!window.currentWeekStart) window.currentWeekStart = getMonday(new Date())
      // Adiciona 7 dias
      const newStart = new Date(window.currentWeekStart)
      newStart.setDate(newStart.getDate() + 7)
      window.currentWeekStart = newStart
      loadSchedule()
    })
    nextWeekBtn.dataset.bound = 'true'
  }

  setupCompanySearch()
})

function setupCompanySearch() {
  const searchInput = document.getElementById("machineCompanySearch")
  const resultsDiv = document.getElementById("companySearchResults")
  const hiddenInput = document.getElementById("machineCompanySelect")

  if (!searchInput || !resultsDiv || !hiddenInput) return

  // Função de busca com debounce para melhor performance
  const performSearch = debounce((query) => {
    if (query.length === 0) {
      resultsDiv.classList.remove("active")
      resultsDiv.innerHTML = ""
      hiddenInput.value = ""
      return
    }

    const filtered = cachedCompanies.filter((company) => company.name.toLowerCase().includes(query))

    if (filtered.length === 0) {
      resultsDiv.innerHTML =
        '<div class="search-result-item" style="cursor: default; color: var(--text-secondary);">Nenhuma empresa encontrada</div>'
      resultsDiv.classList.add("active")
      return
    }

    resultsDiv.innerHTML = filtered
      .map(
        (company) =>
          `<div class="search-result-item" data-id="${company.id}" data-name="${company.name}">
        ${company.name}
      </div>`
      )
      .join("")
    resultsDiv.classList.add("active")

    // Add click handlers to results
    resultsDiv.querySelectorAll(".search-result-item").forEach((item) => {
      item.addEventListener("click", () => {
        const companyId = item.getAttribute("data-id")
        const companyName = item.getAttribute("data-name")
        if (companyId && companyName) {
          searchInput.value = companyName
          hiddenInput.value = companyId
          resultsDiv.classList.remove("active")
          resultsDiv.innerHTML = ""
          loadMachinesList(companyId)
        }
      })
    })
  }, 300); // 300ms de debounce

  // Adiciona event listener com debounce
  searchInput.addEventListener("input", (e) => {
    const query = e.target.value.toLowerCase().trim();
    performSearch(query);
  })

  // Close results when clicking outside
  document.addEventListener("click", (e) => {
    if (!searchInput.contains(e.target) && !resultsDiv.contains(e.target)) {
      resultsDiv.classList.remove("active")
    }
  })
}

/* -------------------- Util: resolver placa vinda em vários formatos -------------------- */
function resolvePlate(raw) {
  if (!raw) return ""
  if (typeof raw === "string") return raw
  if (typeof raw === "object") {
    // tenta os campos mais comuns
    return (
      raw.plate ||
      raw.vehicle_plate ||
      raw.vehiclePlate ||
      raw.vehicle_plate_number ||
      raw.name ||
      raw.label ||
      ""
    )
  }
  return ""
}

/* -------------------- Util: CNPJ -------------------- */
function onlyDigits(str) {
  return String(str || "").replace(/\D+/g, "")
}
function formatCNPJ(cnpj) {
  const d = onlyDigits(cnpj)
  if (d.length !== 14) return cnpj || ""
  return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`
}
async function resolveClientCNPJByName(name) {
  if (!name) return null
  // 1) tenta cache
  const found = cachedCompanies.find((c) => String(c.name || "").toLowerCase() === String(name).toLowerCase())
  if (found && found.cnpj) return found.cnpj
  // 2) tenta baixar lista e procurar
  try {
    const res = await fetch(`${API_URL}/api/companies`)
    const data = await res.json()
    if (Array.isArray(data)) {
      cachedCompanies = data
      const again = data.find((c) => String(c.name || "").toLowerCase() === String(name).toLowerCase())
      if (again && again.cnpj) return again.cnpj
    }
  } catch (_e) {}
  return null
}

/**
 * Verifica se um administrador está autenticado. Caso afirmativo,
 * exibe o painel; caso contrário mostra a tela de login.
 */
function checkAdminLogin() {
  const logged = localStorage.getItem("adminLoggedIn") === "true"
  console.log('🔍 [checkAdminLogin] Status:', { logged, localStorage: localStorage.getItem("adminLoggedIn") })

  if (logged) {
    console.log('✅ [checkAdminLogin] Usuário logado, mostrando admin section')
    showAdminSection()
    checkAccessControl() // Aplica controle de acesso
  } else {
    console.log('❌ [checkAdminLogin] Usuário não logado, mostrando login')
    showAdminLogin()
  }
}

/**
 * Exibe a tela de login e oculta o painel administrativo.
 */
function showAdminLogin() {
  console.log('🔐 [showAdminLogin] Exibindo tela de login')
  const login = document.getElementById("admin-login-section")
  const panel = document.getElementById("admin-section")
  if (login) login.style.display = "block"
  if (panel) panel.style.display = "none"
}

/**
 * Exibe o painel administrativo, oculta a tela de login e
 * inicializa a listagem de ordens de serviço.
 */
function showAdminSection() {
  console.log('🎯 [showAdminSection] Iniciando...')

  const login = document.getElementById("admin-login-section")
  const panel = document.getElementById("admin-section")

  console.log('🔍 [showAdminSection] Elementos:', {
    login: login ? 'encontrado' : 'NÃO ENCONTRADO',
    panel: panel ? 'encontrado' : 'NÃO ENCONTRADO'
  })

  if (login) {
    login.style.display = "none"
    console.log('✅ [showAdminSection] Login section escondida')
  }
  if (panel) {
    panel.style.display = "block"
    console.log('✅ [showAdminSection] Admin panel exibido')
  }

  const name = localStorage.getItem("adminName") || ""
  const display = document.getElementById("adminNameDisplay")
  if (display && name) {
    display.textContent = `${name}`
    console.log('✅ [showAdminSection] Nome exibido:', name)
  }

  console.log('📊 [showAdminSection] Carregando dados...')
  loadOSList()
  // Carrega empresas e máquinas para a gestão administrativa
  loadCompaniesAdmin()

  // Carrega lista de técnicos para permitir transferência de OS
  loadTechniciansForTransfer()

  loadCompaniesCache()

  // Carrega veículos cadastrados
  loadVehiclesList()

  console.log('✅ [showAdminSection] Concluído!')

  // Configura navegação lateral após carregar dados
  setupSidebar()

  // Conecta ao WebSocket para notificações em tempo real
  connectWebSocket()

  // Garante que o botão de arrastar esteja oculto inicialmente
  const dragToggle = document.getElementById('dragModeToggle')
  if (dragToggle) dragToggle.style.display = 'none'

  // Inicializa sistema de rotas (URLs bonitas)
  initRouter()
}

/**
 * Processa o envio do formulário de login do administrador. Valida
 * usuário e senha a partir da lista de administradores no localStorage.
 */
function handleAdminLogin(e) {
  e.preventDefault()

  console.log('🔐 [LOGIN] Iniciando login...')

  // Null checks para elementos do formulário
  const usernameInput = document.getElementById("adminLoginName")
  const passwordInput = document.getElementById("adminLoginPassword")

  if (!usernameInput || !passwordInput) {
    showToast("Erro: Formulário de login não encontrado", "error")
    console.error("❌ [LOGIN] Elementos de login não encontrados no DOM")
    return
  }

  const username = usernameInput.value.trim()
  const password = passwordInput.value

  console.log('📤 [LOGIN] Enviando credenciais:', { username, API_URL })

  // Tenta autenticar no backend
  fetch(`${API_URL}/api/admin/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  })
    .then((res) => {
      console.log('📥 [LOGIN] Resposta da API:', { status: res.status, ok: res.ok })
      if (!res.ok) throw new Error("Credenciais inválidas")
      return res.json()
    })
    .then((data) => {
      console.log('✅ [LOGIN] Login bem-sucedido:', data)
      localStorage.setItem("adminLoggedIn", "true")
      localStorage.setItem("adminName", data.username)
      localStorage.setItem("adminUserType", data.user_type || 'admin')
      showToast("Login realizado com sucesso!", "success")
      console.log('🔄 [LOGIN] Chamando showAdminSection()...')
      showAdminSection()
      setupAccessControl(data.user_type || 'admin')

      // Garante que a aba Faturamento seja visível após login
      const billingNavItem = document.getElementById('billingNavItem')
      if (billingNavItem && data.user_type !== 'financial') {
        billingNavItem.style.display = 'block'
      }
    })
    .catch((err) => {
      console.warn('⚠️ [LOGIN] Erro na API, tentando fallback local:', err)
      // Fallback para autenticação local (modo offline)
      const admins = JSON.parse(localStorage.getItem("admins") || "[]")
      console.log('📋 [LOGIN] Admins locais:', admins.length)
      const user = admins.find((u) => u.username === username && u.password === password)
      if (user) {
        console.log('✅ [LOGIN] Login local bem-sucedido')
        localStorage.setItem("adminLoggedIn", "true")
        localStorage.setItem("adminName", username)
        localStorage.setItem("adminUserType", 'admin') // Default para admin no offline
        showToast("Login realizado com sucesso!", "success")
        console.log('🔄 [LOGIN] Chamando showAdminSection()...')
        showAdminSection()
        setupAccessControl('admin')

        // Garante que a aba Faturamento seja visível
        const billingNavItem = document.getElementById('billingNavItem')
        if (billingNavItem) billingNavItem.style.display = 'block'
      } else {
        console.error('❌ [LOGIN] Credenciais inválidas (local e API)')
        showToast("Credenciais inválidas!", "error")
      }
    })
}

/**
 * Carrega a lista de ordens de serviço do localStorage e exibe
 * no painel administrativo.
 */
function loadOSList() {
  const container = document.getElementById("osList")
  if (!container) return
  const url = `${API_URL}/api/os?limit=${osPagination.limit}&page=${osPagination.page}&only_with_order_number=true`
  fetch(url)
    .then(async (res) => {
      if (!res.ok) {
        throw new Error(`Erro ao carregar OS: ${res.status}`)
      }
      const total = parseInt(res.headers.get('X-Total-Count') || '0', 10)
      osPagination.total = Number.isFinite(total) ? total : 0
      return res.json()
    })
    .then((rows) => {
      // FILTRO: Apenas OS que foram aceitas (com order_number) aparecem aqui
      // OS pendentes (is_pending_request = true ou order_number = null) NÃO aparecem
      const acceptedRows = rows.filter(row => row.order_number !== null && row.order_number !== undefined)
      
      const osList = acceptedRows.map((row) => {
        const status = row.status || (row.end_datetime ? "completed" : "assigned")
        return {
          id: row.id,
          osNumber: row.order_number,
          cliente: row.client_name,
          numeroSerie: row.machine_serial || "",
          responsavel: row.technician_username || "",
          assistenteTecnico: row.technician_username || "",
          dataProgramada: row.scheduled_date || row.created_at,
          descricao: row.service_description || "",
          ocorrencia: row.occurrence || "",
          causa: row.cause || "",
          observacoes: row.observations || "",
          totalHoras: row.total_hours ? `${Number(row.total_hours).toFixed(2)} horas` : "",
          signatureTecnico: row.technician_signature || "",
          signatureCliente: row.client_signature || "",
          status: status,
        }
      })
      localStorage.setItem("osList", JSON.stringify(osList))
      if (osList.length === 0) {
        container.innerHTML = '<p class="empty-state">Nenhuma OS cadastrada</p>'
        renderOsPaginationBar()
        return
      }
      container.innerHTML = osList
        .map((os) => {
          let statusLabel = ""
          switch (os.status) {
            case "pending":
              statusLabel = "Pendente"
              break
            case "assigned":
              statusLabel = "Atribuída"
              break
            case "in_progress":
              statusLabel = "Em Andamento"
              break
            case "pending_review":
              statusLabel = "Aguardando Conferência"
              break
            case "completed":
              statusLabel = "Concluída"
              break
            case "archived":
              statusLabel = "Arquivada"
              break
            case "cancelled":
              statusLabel = "Cancelada"
              break
            case "on_hold":
              statusLabel = "Em Espera"
              break
            default:
              statusLabel = os.status
          }
          const dataFormatada = os.dataProgramada ? new Date(os.dataProgramada).toLocaleDateString("pt-BR", { timeZone: 'America/Sao_Paulo' }) : 'N/A'
          return `
        <div class="os-card" data-os-id="${os.id}" style="cursor: pointer;">
            <div class="os-card-header">
                <h3 class="os-card-title">O.S ${os.osNumber}</h3>
                <span class="status-badge ${os.status}">${statusLabel}</span>
            </div>
            <div class="os-card-body">
                <div class="os-card-field">
                    <label>Cliente</label>
                    <span>${os.cliente}</span>
                </div>
                <div class="os-card-field">
                    <label>Técnico</label>
                    <span>${os.assistenteTecnico}</span>
                </div>
                <div class="os-card-field">
                    <label>Data</label>
                    <span>${dataFormatada}</span>
                </div>
            </div>
        </div>
      `
        })
        .join("")

      // Adiciona event listeners aos cards (substitui onclick inline)
      container.querySelectorAll('.os-card').forEach(card => {
        card.addEventListener('click', () => {
          const osId = parseInt(card.getAttribute('data-os-id'))
          if (osId) viewOSDetails(osId)
        })
      })

      renderOsPaginationBar()
    })
    .catch(() => {
      const osList = JSON.parse(localStorage.getItem("osList") || "[]")
      if (osList.length === 0) {
        container.innerHTML = '<p class="empty-state">Nenhuma OS cadastrada</p>'
        renderOsPaginationBar()
        return
      }
      container.innerHTML = osList
        .map(
          (os) => {
            let statusLabel = ""
            switch (os.status) {
              case "pending":
                statusLabel = "Pendente"
                break
              case "assigned":
                statusLabel = "Atribuída"
                break
              case "in_progress":
                statusLabel = "Em Andamento"
                break
              case "pending_review":
                statusLabel = "Aguardando Conferência"
                break
              case "completed":
                statusLabel = "Concluída"
                break
              case "archived":
                statusLabel = "Arquivada"
                break
              case "cancelled":
                statusLabel = "Cancelada"
                break
              case "on_hold":
                statusLabel = "Em Espera"
                break
              default:
                statusLabel = os.status || "Desconhecido"
            }
            const dataFormatada = os.dataProgramada ? new Date(os.dataProgramada).toLocaleDateString("pt-BR", { timeZone: 'America/Sao_Paulo' }) : 'N/A'
            return `
        <div class="os-card" data-os-id="${os.id}" style="cursor: pointer;">
            <div class="os-card-header">
                <h3 class="os-card-title">O.S ${os.osNumber}</h3>
                <span class="status-badge ${os.status}">${statusLabel}</span>
            </div>
            <div class="os-card-body">
                <div class="os-card-field">
                    <label>Cliente</label>
                    <span>${os.cliente}</span>
                </div>
                <div class="os-card-field">
                    <label>Técnico</label>
                    <span>${os.assistenteTecnico}</span>
                </div>
                <div class="os-card-field">
                    <label>Data</label>
                    <span>${dataFormatada}</span>
                </div>
            </div>
        </div>
    `
          }
        )
        .join("")

      // Adiciona event listeners aos cards (fallback)
      container.querySelectorAll('.os-card').forEach(card => {
        card.addEventListener('click', () => {
          const osId = parseInt(card.getAttribute('data-os-id'))
          if (osId) viewOSDetails(osId)
        })
      })

      renderOsPaginationBar()
    })
}

function renderOsPaginationBar() {
  const listContainer = document.getElementById('osList')
  if (!listContainer) return
  let bar = document.getElementById('osPaginationBar')
  if (!bar) {
    bar = document.createElement('div')
    bar.id = 'osPaginationBar'
    bar.style.cssText = 'display:flex;gap:.5rem;justify-content:center;margin:1rem 0;'
    listContainer.parentNode.insertBefore(bar, listContainer.nextSibling)
  }
  const totalPages = osPagination.limit ? Math.max(1, Math.ceil((osPagination.total || 0) / osPagination.limit)) : 1
  const page = osPagination.page
  const prevDisabled = page <= 1
  const nextDisabled = page >= totalPages
  bar.innerHTML = `
    <button class="btn-secondary" ${prevDisabled ? 'disabled' : ''} id="osPrevPageBtn">Anterior</button>
    <span style="align-self:center;color:var(--text-secondary)">Página ${page} de ${totalPages}</span>
    <button class="btn-secondary" ${nextDisabled ? 'disabled' : ''} id="osNextPageBtn">Próxima</button>
  `
  const prev = document.getElementById('osPrevPageBtn')
  const next = document.getElementById('osNextPageBtn')
  if (prev) prev.onclick = () => { if (osPagination.page > 1) { osPagination.page -= 1; loadOSList() } }
  if (next) next.onclick = () => { const tp = Math.max(1, Math.ceil((osPagination.total || 0)/osPagination.limit)); if (osPagination.page < tp) { osPagination.page += 1; loadOSList() } }
}

/* ====================== Gestão de Empresas e Máquinas ====================== */

function loadCompaniesAdmin() {
  fetch(`${API_URL}/api/companies`)
    .then((res) => {
      if (!res.ok) {
        throw new Error(`Erro ao carregar empresas: ${res.status}`)
      }
      return res.json()
    })
    .then((companies) => {
      cachedCompanies = companies

      // Atualiza select de empresa para cadastro de usuários
      populateClientCompanySelect()

      const list = document.getElementById("companiesList")
      if (list) {
        if (companies.length === 0) {
          list.innerHTML = '<p class="empty-state">Nenhuma empresa cadastrada</p>'
        } else {
          if (companiesViewMode === 'list') {
            list.innerHTML = `
              <div class="companies-list-view" style="overflow-x: auto; max-width: 100%;">
                <table style="width: 100%; min-width: 800px; table-layout: auto;">
                  <thead>
                    <tr>
                      <th style="min-width: 200px;">Nome</th>
                      <th style="min-width: 150px;">CNPJ</th>
                      <th style="min-width: 100px;">Status</th>
                      <th style="min-width: 100px;">Máquinas</th>
                      <th style="min-width: 200px;">Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${companies.map(company => `
                      <tr onclick="showCompanyDetails(${company.id})" style="cursor: pointer;">
                        <td><strong>${company.name}</strong></td>
                        <td>${company.cnpj || 'N/A'}</td>
                        <td>
                          <span class="company-status ${company.active ? 'active' : 'inactive'}">
                            <span style="width: 6px; height: 6px; border-radius: 50%; background: ${company.active ? '#16a34a' : '#dc2626'}; display: inline-block;"></span>
                            ${company.active ? 'Ativo' : 'Inativo'}
                          </span>
                        </td>
                        <td>${company.machines?.length || 0}</td>
                        <td onclick="event.stopPropagation()">
                          <div class="company-actions">
                            <button class="btn-view" onclick="showCompanyDetails(${company.id})">Ver</button>
                            <button class="btn-edit" onclick="editCompany(${company.id})">Editar</button>
                            <button class="btn-delete" onclick="deleteCompany(${company.id})">Excluir</button>
                          </div>
                        </td>
                      </tr>
                    `).join('')}
                  </tbody>
                </table>
              </div>
            `
          } else {
            list.innerHTML = companies
              .map((c) => {
                const phoneDisplay = c.phone1 ? c.phone1 + (c.phone2 ? ` / ${c.phone2}` : "") : c.phone2 || "";
                const contactLine = phoneDisplay ? `<p><strong>Telefone:</strong> ${phoneDisplay}</p>` : "";
                const emailLine = c.email ? `<p><strong>Email:</strong> ${c.email}</p>` : "";
                return `
                  <div class="company-card" onclick="showCompanyDetails(${c.id})" style="cursor: pointer;">
                      <h3>${c.name}</h3>
                      ${c.cnpj ? `<p><strong>CNPJ:</strong> ${c.cnpj}</p>` : ""}
                      ${c.responsible ? `<p><strong>Responsável:</strong> ${c.responsible}</p>` : ""}
                      ${contactLine}
                      ${emailLine}
                      <p><strong>Empresa Nova:</strong> ${c.is_new ? "Sim" : "Não"}</p>
                  </div>
                `
              })
              .join("")
          }
          // Atualizar botões de toggle
          const cardsBtn = document.getElementById('cardsViewBtn')
          const listBtn = document.getElementById('listViewBtn')
          if (cardsBtn && listBtn) {
            cardsBtn.classList.toggle('active', companiesViewMode === 'cards')
            listBtn.classList.toggle('active', companiesViewMode === 'list')
          }
        }
      }
    })
    .catch((err) => {
      console.error(err)
      showToast("Erro ao carregar empresas", "error")
    })
}

/**
 * Envia o cadastro de uma nova empresa para o backend.
 */
function handleCompanyForm(e) {
  e.preventDefault()

  // Coleta referências dos elementos com null checks
  const nameInput = document.getElementById("companyName")
  const cnpjInput = document.getElementById("companyCnpj")
  const responsibleInput = document.getElementById("companyResponsible")
  const ieInput = document.getElementById("companyIE")
  const addressInput = document.getElementById("companyAddress")
  const phone1Input = document.getElementById("companyPhone1")
  const emailInput = document.getElementById("companyEmail")
  const observationsInput = document.getElementById("companyObservations")
  const isNewInput = document.getElementById("companyIsNew")

  // Extrai valores com segurança
  const name = nameInput ? nameInput.value.trim() : ""
  const cnpj = cnpjInput ? cnpjInput.value.trim() : ""
  const responsible = responsibleInput ? responsibleInput.value.trim() : ""
  const ie = ieInput ? ieInput.value.trim() : ""
  const address = addressInput ? addressInput.value.trim() : ""
  const phone1 = phone1Input ? phone1Input.value.trim() : ""
  const email = emailInput ? emailInput.value.trim() : ""
  const observations = observationsInput ? observationsInput.value.trim() : ""
  const isNew = isNewInput ? isNewInput.checked : false

  // Verifica se está editando ou criando
  const form = e.target
  const editingId = form.dataset.editingId
  const isEditing = !!editingId

  // Validação
  if (!name || !cnpj) {
    showToast("Informe nome e CNPJ da empresa", "error")
    return
  }

  // Monta payload
  const payload = {
    name,
    cnpj,
    responsible,
    inscricao_estadual: ie,
    address,
    phone1,
    email,
    observations: observations || null,
    is_new: isNew,
  }

  // Define método e URL
  const method = isEditing ? "PATCH" : "POST"
  const url = isEditing ? `${API_URL}/api/companies/${editingId}` : `${API_URL}/api/companies`

  const token = localStorage.getItem('adminToken')

  fetch(url, {
    method: method,
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${token}`
    },
    body: JSON.stringify(payload),
  })
    .then((res) => {
      if (!res.ok)
        return res.json().then((data) => {
          throw new Error(data.message)
        })
      return res.json()
    })
    .then(() => {
      const successMessage = isEditing ? "Empresa atualizada com sucesso!" : "Empresa cadastrada com sucesso!"
      showToast(successMessage, "success")

      // Limpa formulário
      if (nameInput) nameInput.value = ""
      if (cnpjInput) cnpjInput.value = ""
      if (responsibleInput) responsibleInput.value = ""
      if (ieInput) ieInput.value = ""
      if (addressInput) addressInput.value = ""
      if (phone1Input) phone1Input.value = ""
      if (emailInput) emailInput.value = ""
      if (observationsInput) observationsInput.value = ""
      if (isNewInput) isNewInput.checked = false

      // Remove flag de edição
      delete form.dataset.editingId

      // Reseta título do modal
      const modalTitle = document.querySelector('#createCompanyModal h2')
      if (modalTitle) modalTitle.textContent = 'Cadastrar Nova Empresa'

      loadCompaniesAdmin()
      // Atualiza cache e select de empresas
      loadCompaniesCache()
      // Fecha modal
      closeCreateCompanyModal()
    })
    .catch((err) => {
      console.error(err)
      showToast(err.message || `Erro ao ${isEditing ? 'atualizar' : 'cadastrar'} empresa`, "error")
    })
}

/**
 * Abre modal de detalhes da empresa, buscando dados completos no backend.
 * Mostra informações de endereço, contatos e lista de máquinas.
 */
async function showCompanyDetails(companyId) {
  if (!companyId) return
  
  try {
    console.log(`[DEBUG] Carregando detalhes da empresa ID: ${companyId}`)
    
    // Busca dados da empresa
    const companyRes = await fetch(`${API_URL}/api/companies/${companyId}`)
    console.log(`[DEBUG] Status da empresa: ${companyRes.status}`)
    
    if (!companyRes.ok) {
      const data = await companyRes.json()
      throw new Error(data.message || 'Erro ao buscar empresa')
    }
    const company = await companyRes.json()
    console.log(`[DEBUG] Empresa carregada: ${company.name}`)
    
    // Busca OS da empresa
    const osURL = `${API_URL}/api/os?company_id=${companyId}`
    console.log(`[DEBUG] Buscando OS: ${osURL}`)
    
    const osRes = await fetch(osURL)
    console.log(`[DEBUG] Status das OS: ${osRes.status}`)
    
    const osList = await osRes.json()
    console.log(`[DEBUG] OS encontradas: ${Array.isArray(osList) ? osList.length : 0}`)
    
    // Popula modal com dados e OS
    populateCompanyDetails(company, osList)
    
    const modal = document.getElementById('companyDetailsModal')
    if (modal) modal.classList.add('active')
  } catch (err) {
    console.error('[DEBUG] Erro:', err)
    showToast(err.message || 'Erro ao carregar detalhes da empresa', 'error')
  }
}

/**
 * Popula o modal de detalhes da empresa com os dados retornados pelo backend.
 */
function populateCompanyDetails(company, osList = []) {
  if (!company) return
  const addressParts = []
  if (company.address) addressParts.push(company.address)
  if (company.bairro) addressParts.push(company.bairro)
  if (company.localidade) addressParts.push(company.localidade)
  if (company.cep) addressParts.push(company.cep)
  let ufPais = []
  if (company.uf) ufPais.push(company.uf)
  if (company.pais) ufPais.push(company.pais)
  if (ufPais.length) addressParts.push(ufPais.join(' - '))
  const fullAddress = addressParts.join(', ')
  // Telefones
  let phones = ''
  if (company.phone1) phones += company.phone1
  if (company.phone2) phones += (phones ? ' / ' : '') + company.phone2
  // Preenche campos básicos
  const setText = (id, text) => {
    const el = document.getElementById(id)
    if (el) el.textContent = text || ''
  }
  setText('detailsCompanyName', company.name || '')
  setText('detailsCompanyCnpj', company.cnpj || '')
  setText('detailsCompanyIE', company.inscricao_estadual || '')
  setText('detailsCompanyResponsible', company.responsible || '')
  setText('detailsCompanyAddress', fullAddress || '')
  setText('detailsCompanyPhones', phones || '')
  setText('detailsCompanyEmail', company.email || '')
  setText('detailsCompanyObservations', company.observations || company.info || '')

  // Preenche checkbox "Cliente Novo"
  const isNewCheckbox = document.getElementById('detailsCompanyIsNew')
  if (isNewCheckbox) {
    isNewCheckbox.checked = company.is_new || false
    // Armazena o ID da empresa para usar no toggle
    isNewCheckbox.dataset.companyId = company.id
  }
  
  // Preenche lista de máquinas
  const tbody = document.getElementById('detailsCompanyMachines')
  if (tbody) {
    if (Array.isArray(company.machines) && company.machines.length) {
      tbody.innerHTML = company.machines
        .map((m) => `<tr><td>${escapeHtml(m.model)}</td><td>${escapeHtml(m.serial_number)}</td></tr>`)
        .join('')
    } else {
      tbody.innerHTML = '<tr><td colspan="2">Nenhuma máquina cadastrada</td></tr>'
    }
  }
  
  // Preenche lista de OS da empresa
  const osContainer = document.getElementById('detailsCompanyOS')
  console.log(`[DEBUG] Populando OS - Container existe: ${!!osContainer}, Total OS: ${osList.length}`)
  
  if (osContainer) {
    if (!Array.isArray(osList) || osList.length === 0) {
      console.log('[DEBUG] Nenhuma OS para exibir')
      osContainer.innerHTML = '<p style="text-align: center; padding: 2rem; color: var(--text-secondary);">Nenhuma OS encontrada para esta empresa</p>'
    } else {
      console.log(`[DEBUG] Exibindo ${osList.length} OS`)
      
      // Gera HTML das OS
      const osHTML = osList.map(os => {
        try {
          // Mostra data real (agora todas as OS antigas têm data extraída dos PDFs!)
          const osDate = os.scheduled_date || os.created_at
          const formattedDate = osDate ? new Date(osDate).toLocaleDateString('pt-BR') : 'Sem data'
          
          const statusBg = os.status === 'completed' ? '#10b981' : os.status === 'in_progress' ? '#f59e0b' : '#1e3a8a'
          const statusText = os.status === 'completed' ? 'Finalizada' : os.status === 'in_progress' ? 'Em andamento' : 'Atribuída'
          
          return `
            <div style="padding: 1rem; border: 1px solid var(--border-color); border-radius: 8px; margin-bottom: 0.75rem; cursor: pointer; transition: all 0.2s;"
                 onclick="viewOSDetails(${os.id})"
                 onmouseover="this.style.background='var(--hover-bg)'"
                 onmouseout="this.style.background='transparent'">
              <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 0.5rem;">
                <strong style="font-size: 1.1rem; color: var(--primary-blue);">O.S ${escapeHtml(os.order_number)}</strong>
                <span style="background: ${statusBg}; color: white; padding: 0.25rem 0.75rem; border-radius: 12px; font-size: 0.85rem;">
                  ${statusText}
                </span>
              </div>
              <div style="color: var(--text-secondary); font-size: 0.9rem;">
                <div>${SVGIcons.calendar} ${escapeHtml(formattedDate)}</div>
                <div>${SVGIcons.user} ${escapeHtml(os.client_name || 'N/A')}</div>
                ${os.maintenance_type ? `<div>${SVGIcons.wrench} ${escapeHtml(os.maintenance_type)}</div>` : ''}
                ${os.machine_model ? `<div>${SVGIcons.settings} ${escapeHtml(os.machine_model)} ${os.machine_serial ? '- ' + escapeHtml(os.machine_serial) : ''}</div>` : ''}
              </div>
            </div>
          `
        } catch (err) {
          console.error('[DEBUG] Erro ao renderizar OS:', err, os)
          return ''
        }
      }).join('')
      
      osContainer.innerHTML = `
        <div style="margin-bottom: 1rem; padding: 0.75rem; background: var(--primary-blue); color: white; border-radius: 8px; text-align: center; font-weight: 600;">
          ${osList.length} Ordem${osList.length > 1 ? 's' : ''} de Serviço
        </div>
        
        <!-- Campo de busca de OS -->
        <div class="search-bar" style="margin-bottom: 1rem;">
          <input type="text" id="companyOSSearchInput" placeholder="Buscar OS por número..." onkeyup="filterCompanyOS()">
          <button class="btn-secondary" onclick="filterCompanyOS()">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="11" cy="11" r="8"/>
              <path d="m21 21-4.35-4.35"/>
            </svg>
            Buscar
          </button>
        </div>
        
        <div id="companyOSList" style="max-height: 400px; overflow-y: auto;">
          ${osHTML}
        </div>
      `
      
      // Armazena a lista completa de OS para filtrar
      window.currentCompanyOSList = osList
    }
  }
}

/**
 * Filtra as OS da empresa exibidas no modal de detalhes
 */
function filterCompanyOS() {
  const input = document.getElementById('companyOSSearchInput')
  const searchTerm = input ? input.value.trim().toLowerCase() : ''
  const osList = window.currentCompanyOSList || []
  const container = document.getElementById('companyOSList')
  
  if (!container) return
  
  // Se não há termo de busca, mostra todas
  if (!searchTerm) {
    renderCompanyOSList(osList, container)
    return
  }
  
  // Filtra OS pelo número
  const filtered = osList.filter(os => {
    const osNumber = String(os.order_number || '').toLowerCase()
    return osNumber.includes(searchTerm)
  })
  
  renderCompanyOSList(filtered, container)
}

/**
 * Renderiza a lista de OS no container
 */
function renderCompanyOSList(osList, container) {
  if (!osList || osList.length === 0) {
    container.innerHTML = '<p style="text-align: center; padding: 2rem; color: var(--text-secondary);">Nenhuma OS encontrada</p>'
    return
  }
  
  const osHTML = osList.map(os => {
    try {
      const osDate = os.scheduled_date || os.created_at
      const formattedDate = osDate ? new Date(osDate).toLocaleDateString('pt-BR') : 'Sem data'
      
      const statusBg = os.status === 'completed' ? '#10b981' : os.status === 'in_progress' ? '#f59e0b' : '#1e3a8a'
      const statusText = os.status === 'completed' ? 'Finalizada' : os.status === 'in_progress' ? 'Em andamento' : 'Atribuída'
      
      return `
        <div style="padding: 1rem; border: 1px solid var(--border-color); border-radius: 8px; margin-bottom: 0.75rem; cursor: pointer; transition: all 0.2s;" 
             onclick="viewOSDetails(${os.id})" 
             onmouseover="this.style.background='var(--hover-bg)'" 
             onmouseout="this.style.background='transparent'">
          <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 0.5rem;">
            <strong style="font-size: 1.1rem; color: var(--primary-blue);">O.S ${os.order_number}</strong>
            <span style="background: ${statusBg}; color: white; padding: 0.25rem 0.75rem; border-radius: 12px; font-size: 0.85rem;">
              ${statusText}
            </span>
          </div>
          <div style="color: var(--text-secondary); font-size: 0.9rem;">
            <div>${SVGIcons.calendar} ${formattedDate}</div>
            <div>${SVGIcons.user} ${os.client_name || 'N/A'}</div>
            ${os.maintenance_type ? `<div>${SVGIcons.wrench} ${os.maintenance_type}</div>` : ''}
            ${os.machine_model ? `<div>${SVGIcons.settings} ${os.machine_model} ${os.machine_serial ? '- ' + os.machine_serial : ''}</div>` : ''}
          </div>
        </div>
      `
    } catch (err) {
      console.error('[DEBUG] Erro ao renderizar OS:', err, os)
      return ''
    }
  }).join('')
  
  container.innerHTML = osHTML
}

/**
 * Fecha o modal de detalhes da empresa.
 */
function closeCompanyDetailsModal() {
  const modal = document.getElementById('companyDetailsModal')
  if (modal) modal.classList.remove('active')
}

/**
 * Alterna o status "Cliente Novo" de uma empresa
 */
async function toggleCompanyIsNew() {
  const checkbox = document.getElementById('detailsCompanyIsNew')
  if (!checkbox) return

  const companyId = checkbox.dataset.companyId
  const isNew = checkbox.checked

  if (!companyId) {
    showToast('ID da empresa não encontrado', 'error')
    checkbox.checked = !isNew // Reverte o checkbox
    return
  }

  try {
    const token = localStorage.getItem('adminToken')
    const res = await fetch(`${API_URL}/api/companies/${companyId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ is_new: isNew })
    })

    if (!res.ok) {
      const error = await res.json()
      throw new Error(error.message || 'Erro ao atualizar status')
    }

    showToast(`Cliente ${isNew ? 'marcado como novo' : 'marcado como antigo'}`, 'success')

    // Recarrega lista de empresas para refletir a mudança
    loadCompaniesList()
  } catch (error) {
    console.error('Erro ao atualizar status cliente novo:', error)
    showToast(error.message || 'Erro ao atualizar status', 'error')
    // Reverte o checkbox em caso de erro
    checkbox.checked = !isNew
  }
}

/**
 * Deleta uma empresa após confirmação do usuário.
 */
async function deleteCompany(companyId) {
  if (!companyId) {
    showToast('ID da empresa inválido', 'error')
    return
  }

  const confirmed = confirm('Tem certeza que deseja excluir esta empresa? Esta ação não pode ser desfeita.')
  if (!confirmed) return

  try {
    const token = localStorage.getItem('adminToken')
    const res = await fetch(`${API_URL}/api/companies/${companyId}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    })

    if (!res.ok) {
      const error = await res.json()
      throw new Error(error.message || 'Erro ao excluir empresa')
    }

    showToast('Empresa excluída com sucesso', 'success')

    // Fecha modal de detalhes se estiver aberto
    closeCompanyDetailsModal()

    // Recarrega lista de empresas
    loadCompaniesAdmin()
  } catch (error) {
    console.error('Erro ao excluir empresa:', error)
    showToast(error.message || 'Erro ao excluir empresa', 'error')
  }
}

/**
 * Abre modal de edição de empresa com dados preenchidos.
 */
async function editCompany(companyId) {
  if (!companyId) {
    showToast('ID da empresa inválido', 'error')
    return
  }

  try {
    // Busca dados da empresa
    const token = localStorage.getItem('adminToken')
    const res = await fetch(`${API_URL}/api/companies/${companyId}`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    })

    if (!res.ok) {
      const error = await res.json()
      throw new Error(error.message || 'Erro ao buscar dados da empresa')
    }

    const company = await res.json()

    // Preenche formulário com dados da empresa
    const form = document.getElementById('companyForm')
    if (!form) {
      showToast('Formulário de empresa não encontrado', 'error')
      return
    }

    // Preenche campos
    const nameInput = document.getElementById('companyName')
    const cnpjInput = document.getElementById('companyCnpj')
    const ieInput = document.getElementById('companyIE')
    const responsibleInput = document.getElementById('companyResponsible')
    const addressInput = document.getElementById('companyAddress')
    const phone1Input = document.getElementById('companyPhone1')
    const emailInput = document.getElementById('companyEmail')
    const observationsInput = document.getElementById('companyObservations')
    const isNewInput = document.getElementById('companyIsNew')

    if (nameInput) nameInput.value = company.name || ''
    if (cnpjInput) cnpjInput.value = company.cnpj || ''
    if (ieInput) ieInput.value = company.inscricao_estadual || ''
    if (responsibleInput) responsibleInput.value = company.responsible || ''
    if (addressInput) addressInput.value = company.address || ''
    if (phone1Input) phone1Input.value = company.phone1 || ''
    if (emailInput) emailInput.value = company.email || ''
    if (observationsInput) observationsInput.value = company.observations || ''
    if (isNewInput) isNewInput.checked = company.is_new || false

    // Armazena ID da empresa sendo editada
    form.dataset.editingId = companyId

    // Fecha modal de detalhes e abre modal de criação/edição
    closeCompanyDetailsModal()
    openCreateCompanyModal()

    // Atualiza título do modal
    const modalTitle = document.querySelector('#createCompanyModal h2')
    if (modalTitle) modalTitle.textContent = 'Editar Empresa'

  } catch (error) {
    console.error('Erro ao carregar dados da empresa:', error)
    showToast(error.message || 'Erro ao carregar dados da empresa', 'error')
  }
}

/**
 * Filtra a lista de empresas com base no texto digitado no campo de busca.
 * A pesquisa considera nome e CNPJ (ignorando formatação). Caso o campo
 * esteja vazio, a lista completa é recarregada.
 */
function searchCompanies() {
  const input = document.getElementById('companySearchInput')
  if (!input) return
  const query = input.value.trim().toLowerCase()
  const listEl = document.getElementById('companiesList')
  if (!listEl) return
  if (!query) {
    // Campo vazio: recarrega todas as empresas
    loadCompaniesAdmin()
    return
  }
  // Normaliza query removendo caracteres não numéricos para comparar CNPJ
  const queryDigits = query.replace(/\D/g, '')
  const filtered = Array.isArray(cachedCompanies) ? cachedCompanies.filter((c) => {
    const nameMatch = c.name && c.name.toLowerCase().includes(query)
    let cnpjDigits = ''
    if (c.cnpj) cnpjDigits = c.cnpj.replace(/\D/g, '')
    const cnpjMatch = queryDigits && cnpjDigits.includes(queryDigits)
    return nameMatch || cnpjMatch
  }) : []
  if (filtered.length === 0) {
    listEl.innerHTML = '<p class="empty-state">Nenhuma empresa encontrada</p>'
    return
  }
  listEl.innerHTML = filtered
    .map((c) => {
      const phoneDisplay = c.phone1 ? c.phone1 + (c.phone2 ? ` / ${c.phone2}` : '') : c.phone2 || ''
      const contactLine = phoneDisplay ? `<p><strong>Telefone:</strong> ${phoneDisplay}</p>` : ''
      const emailLine = c.email ? `<p><strong>Email:</strong> ${c.email}</p>` : ''
      return `
        <div class="company-card" onclick="showCompanyDetails(${c.id})">
            <h3>${c.name}</h3>
            ${c.cnpj ? `<p><strong>CNPJ:</strong> ${c.cnpj}</p>` : ''}
            ${c.responsible ? `<p><strong>Responsável:</strong> ${c.responsible}</p>` : ''}
            ${contactLine}
            ${emailLine}
            <p><strong>Empresa Nova:</strong> ${c.is_new ? 'Sim' : 'Não'}</p>
        </div>
      `
    })
    .join('')
}

/**
 * Envia o cadastro de uma nova máquina para o backend.
 */
function handleMachineForm(e) {
  e.preventDefault()
  const companyId = document.getElementById("machineCompanySelect").value
  const model = document.getElementById("machineModel").value.trim()
  const serial = document.getElementById("machineSerial").value.trim()
  if (!companyId || !serial) {
    showToast("Empresa e número de série são obrigatórios", "error")
    return
  }
  fetch(`${API_URL}/api/machines`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ company_id: companyId, model, serial_number: serial }),
  })
    .then((res) => {
      if (!res.ok)
        return res.json().then((data) => {
          throw new Error(data.message)
        })
      return res.json()
    })
    .then(() => {
      showToast("Máquina cadastrada com sucesso!", "success")
      document.getElementById("machineCompanySearch").value = ""
      document.getElementById("machineCompanySelect").value = ""
      document.getElementById("machineModel").value = ""
      document.getElementById("machineSerial").value = ""
      loadMachinesList(companyId)
    })
    .catch((err) => {
      console.error(err)
      showToast(err.message || "Erro ao cadastrar máquina", "error")
    })
}

/**
 * Carrega a lista de máquinas de uma empresa e exibe no painel.
 */
function loadMachinesList(companyId) {
  const container = document.getElementById("machinesList")
  if (!container) return
  if (!companyId) {
    container.innerHTML = '<p class="empty-state">Selecione uma empresa para ver as máquinas</p>'
    return
  }
  fetch(`${API_URL}/api/machines?company_id=${companyId}`)
    .then((res) => res.json())
    .then((machines) => {
      if (machines.length === 0) {
        container.innerHTML = '<p class="empty-state">Nenhuma máquina cadastrada para esta empresa</p>'
        return
      }
      container.innerHTML = machines
        .map((m) => {
          const machineName = `${m.serial_number}${m.model ? ' - ' + m.model : ''}`
          const modelSafe = (m.model || '').replace(/'/g, "\\'")
          const serialSafe = (m.serial_number || '').replace(/'/g, "\\'")
          return `
            <div class="machine-card" id="machine-card-${m.id}" style="position: relative;">
                <div style="position: absolute; top: 1rem; right: 1rem;">
                    <button id="edit-machine-btn-${m.id}" onclick="toggleMachineEditMode(${m.id}, '${modelSafe}', '${serialSafe}')" class="btn-icon" title="Editar máquina">
                        <svg width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
                            <path d="M12.146.146a.5.5 0 0 1 .708 0l3 3a.5.5 0 0 1 0 .708l-10 10a.5.5 0 0 1-.168.11l-5 2a.5.5 0 0 1-.65-.65l2-5a.5.5 0 0 1 .11-.168l10-10zM11.207 2.5 13.5 4.793 14.793 3.5 12.5 1.207 11.207 2.5zm1.586 3L10.5 3.207 4 9.707V10h.5a.5.5 0 0 1 .5.5v.5h.5a.5.5 0 0 1 .5.5v.5h.293l6.5-6.5zm-9.761 5.175-.106.106-1.528 3.821 3.821-1.528.106-.106A.5.5 0 0 1 5 12.5V12h-.5a.5.5 0 0 1-.5-.5V11h-.5a.5.5 0 0 1-.468-.325z"/>
                        </svg>
                    </button>
                </div>
                <div id="machine-view-${m.id}">
                    <h3 id="machine-serial-display-${m.id}">${m.serial_number}</h3>
                    ${m.model ? `<p id="machine-model-display-${m.id}"><strong>Modelo:</strong> ${m.model}</p>` : `<p id="machine-model-display-${m.id}" style="display:none;"></p>`}
                </div>
                <div id="machine-edit-${m.id}" style="display: none;">
                    <div class="form-group" style="margin-bottom: 0.75rem;">
                        <label>Modelo</label>
                        <input type="text" id="machine-model-input-${m.id}" value="${m.model || ''}" placeholder="Modelo da máquina" style="width: 100%; padding: 0.5rem; background: var(--bg-input); border: 1px solid var(--border-color); border-radius: 6px; color: var(--text-primary);">
                    </div>
                    <div class="form-group" style="margin-bottom: 0.75rem;">
                        <label>Número de Série *</label>
                        <input type="text" id="machine-serial-input-${m.id}" value="${m.serial_number || ''}" placeholder="Número de série" style="width: 100%; padding: 0.5rem; background: var(--bg-input); border: 1px solid var(--border-color); border-radius: 6px; color: var(--text-primary);">
                    </div>
                    <div style="display: flex; gap: 0.5rem; margin-bottom: 0.75rem;">
                        <button class="btn-primary btn-sm" onclick="saveMachineChanges(${m.id}, ${companyId})">Salvar</button>
                        <button class="btn-secondary btn-sm" onclick="toggleMachineEditMode(${m.id}, '${modelSafe}', '${serialSafe}')">Cancelar</button>
                    </div>
                </div>
                <div style="margin-top: 1rem; padding-top: 1rem; border-top: 1px solid var(--border-color);">
                    <button onclick="viewMachineOSHistory(${m.id}, '${machineName.replace(/'/g, "\\'")}');" class="btn-primary" style="width: 100%; padding: 0.5rem; font-size: 0.9rem;">
                        ${SVGIcons.clipboard} Ver Histórico de OS
                    </button>
                </div>
            </div>
          `
        })
        .join("")
    })
    .catch((err) => {
      console.error(err)
      showToast("Erro ao carregar máquinas", "error")
    })
}

/**
 * Visualiza uma ordem de serviço específica e abre o modal.
 */
async function viewOSDetails(id) {
  const modal = document.getElementById("osModal")
  const details = document.getElementById("osDetails")
  if (!modal || !details) return
  try {
    const row = await fetch(`${API_URL}/api/os/${id}`).then((res) => res.json())
    if (!row || !row.id) throw new Error("OS não encontrada")

    // Resolve CNPJ do cliente
    const resolvedCnpj =
      row.company_cnpj ||
      row.client_cnpj ||
      row.cnpj ||
      (await resolveClientCNPJByName(row.company_name || row.client_name || row.client_username || row.client))

    // Mapeamento único usado em UI + PDF
    currentOS = {
      id: row.id,
      osNumber: row.order_number,
      technician_id: row.technician_id || null,
      dataProgramada: row.scheduled_date || row.created_at,
      cliente: row.client_name || row.company_name || row.client_username || "",
      clienteCnpj: resolvedCnpj || "",
      numeroSerie: row.machine_serial || "",
      modelo: row.machine_model || "",
      // Responsável: pessoa que abriu o chamado. Para que o PDF mostre o solicitante
      // corretamente, usamos o campo requester (solicitante) da OS. O técnico
      // associado é armazenado em assistenteTecnico. Não incluímos numeração.
      responsavel: row.requester || "",
      assistenteTecnico: row.technician_username || "",
      maintenanceType: row.maintenance_type || "",
      totalHoras: row.total_hours ? `${Number(row.total_hours).toFixed(2)} horas` : "",
      totalHorasNum: row.total_hours || 0,
      descricao: row.service_description || "",
      ocorrencia: row.occurrence || "",
      causa: row.cause || "",
      observacoes: row.observations || "",
      dataHoraInicio: row.start_datetime || "",
      dataHoraFim: row.end_datetime || "",
      motivoChamado: row.call_reason || "",
      solicitante: row.requester || "",
      signatureTecnico: row.technician_signature || "",
      signatureCliente: row.client_signature || "",
      valorHoraTecnico: row.technician_hourly_rate !== undefined ? row.technician_hourly_rate : null,
      deslocamentoKm: row.displacement_km,
      carroUtilizado:
        resolvePlate(row.car_used) ||
        row.vehicle_plate ||
        resolvePlate(row.vehicle) ||
        row.vehicle ||
        row.plate ||
        row.vehiclePlate ||
        "",
      causaDeslocamento: row.displacement_cause,
      valorServico: row.value_service,
      custoServico: row.total_service_cost,
      custoMateriais: row.total_material_cost,
      totalGeral: row.grand_total,
      materiais: Array.isArray(row.materials) ? row.materials : [],
      displacements: Array.isArray(row.displacements) ? row.displacements : [],
      isNewClient: !!row.is_new_client,
      worklogs: Array.isArray(row.worklogs) ? row.worklogs : [],
      additionalServices: Array.isArray(row.additional_services) ? row.additional_services : [],
    }

    // Render do modal (informativo)
    let html = ""
    // Períodos de trabalho: grid duplicando campos (Início/Fim/Horas por período)
    let periodsHtml = ""
    try {
      if (currentOS.worklogs && currentOS.worklogs.length > 0) {
        const blocks = currentOS.worklogs
          .map((wl, idx) => {
            const s = wl && wl.start_datetime ? parseAsLocalTime(wl.start_datetime) : null
            const e = wl && wl.end_datetime ? parseAsLocalTime(wl.end_datetime) : null
            const sDate = s ? s.toLocaleDateString("pt-BR") : ""
            const sTime = s ? s.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) : ""
            const eDate = e ? e.toLocaleDateString("pt-BR") : ""
            const eTime = e ? e.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) : ""
            const hours =
              wl && wl.hours != null
                ? Number(wl.hours) || 0
                : s && e
                ? Math.max((e - s) / 36e5, 0)
                : 0
            return `
              <div class="detail-field">
                <label>Início</label>
                <span>${s ? `${sDate} ${sTime}` : ""}</span>
              </div>
              <div class="detail-field">
                <label>Fim</label>
                <span>${e ? `${eDate} ${eTime}` : ""}</span>
              </div>
              <div class="detail-field">
                <label>Horas</label>
                <span>${hours.toFixed(2)} h</span>
              </div>
            `
          })
          .join("")
        periodsHtml = `<div class="detail-grid" style="margin-top: .75rem">${blocks}</div>`
      }
    } catch (_err) {
      periodsHtml = ""
    }

    html += `
      <div class="detail-section">
          <h3>Informações Básicas (Relatório do Chamado)</h3>
          <div class="detail-grid">
              <div class="detail-field">
                  <label>Número da OS</label>
                  <span>${currentOS.osNumber}</span>
              </div>
              <div class="detail-field">
                  <label>Data Programada</label>
                  <span>${new Date(currentOS.dataProgramada).toLocaleDateString("pt-BR")}</span>
              </div>
              <div class="detail-field">
                  <label>Cliente</label>
                  <span>${currentOS.cliente}${currentOS.clienteCnpj ? " — CNPJ: " + formatCNPJ(currentOS.clienteCnpj) : ""}</span>
              </div>
              <div class="detail-field">
                  <label>Número de Série</label>
                  <span>${currentOS.numeroSerie}</span>
              </div>
              ${
                currentOS.modelo
                  ? `
              <div class="detail-field">
                  <label>Modelo</label>
                  <span>${currentOS.modelo}</span>
              </div>`
                  : ""
              }
              <div class="detail-field">
                  <label>Responsável</label>
                  <span>${currentOS.responsavel}</span>
              </div>
              <div class="detail-field">
                  <label>Motivo do Chamado</label>
                  <span>${currentOS.motivoChamado || ""}</span>
              </div>
          </div>
      </div>

      <div class="detail-section">
          <h3>Fechamento Técnico</h3>
          <div class="detail-grid">
              <div class="detail-field">
                  <label>Assistente Técnico</label>
                  <span>${currentOS.assistenteTecnico}</span>
              </div>
              <div class="detail-field">
                  <label>Data/Hora Início (Agregado)</label>
                  <span>${
                    currentOS.dataHoraInicio
                      ? parseAsLocalTime(currentOS.dataHoraInicio).toLocaleString("pt-BR", {
                          hour: "2-digit",
                          minute: "2-digit",
                          day: "2-digit",
                          month: "2-digit",
                          year: "numeric",
                        })
                      : ""
                  }</span>
              </div>
              <div class="detail-field">
                  <label>Data/Hora Fim (Agregado)</label>
                  <span>${
                    currentOS.dataHoraFim
                      ? parseAsLocalTime(currentOS.dataHoraFim).toLocaleString("pt-BR", {
                          hour: "2-digit",
                          minute: "2-digit",
                          day: "2-digit",
                          month: "2-digit",
                          year: "numeric",
                        })
                      : ""
                  }</span>
              </div>
              <div class="detail-field">
                  <label>Total de Horas (Geral)</label>
                  <span>${currentOS.totalHoras}</span>
              </div>
              ${
                currentOS.maintenanceType
                  ? `
              <div class="detail-field">
                  <label>Tipo de Manutenção</label>
                  <span>${currentOS.maintenanceType}</span>
              </div>`
                  : ""
              }
          </div>
          ${periodsHtml}
          <div class="detail-field" style="margin-top: 1rem;">
              <label>Descrição do Serviço</label>
              <span>${currentOS.descricao}</span>
          </div>
      </div>
    `

    // Deslocamentos (informativo)
    if (currentOS.displacements && currentOS.displacements.length > 0) {
      html += `<div class="detail-section"><h3>Deslocamentos</h3>`
      let totalKm = 0
      currentOS.displacements.forEach((d, idx) => {
        const kmLabel = d.km_option ? d.km_option : ""
        let kmTotal = ""
        let kmVal = 0

        // Verifica se é "sem deslocamento"
        const isSemDeslocamento = d.km_option && (
          String(d.km_option).toLowerCase() === 'nenhum' ||
          String(d.km_option).toLowerCase() === 'sem_deslocamento' ||
          String(d.km_option).toLowerCase() === 'sem deslocamento' ||
          String(d.km_option).toLowerCase() === 'none'
        )

        if (d.km_total !== null && d.km_total !== undefined) {
          kmVal = Number(d.km_total) || 0
          kmTotal = ` - ${kmVal} km`
        } else if (d.km_option && !isSemDeslocamento) {
          const opt = String(d.km_option).toLowerCase()
          if (opt.includes("50")) kmVal = 50
          else if (opt.includes("100")) kmVal = 100
          if (kmVal > 0) kmTotal = ` - ${kmVal} km`
        }
        totalKm += kmVal

        // Só mostra placa se NÃO for "sem deslocamento"
        let plateInfo = ""
        if (!isSemDeslocamento) {
          let plate =
            resolvePlate(d && d.vehicle) ||
            resolvePlate(d && d.vehicle_plate) ||
            resolvePlate(d && d.plate) ||
            resolvePlate(d && d.vehiclePlate) ||
            currentOS.carroUtilizado ||
            ""
          plateInfo = plate ? " | Veículo: " + plate : ""
        }

        html += `<p>Deslocamento ${idx + 1}: ${kmLabel}${kmTotal}${plateInfo}</p>`
      })
      html += `<p><strong>Quilometragem Total:</strong> ${totalKm} km</p>`
      html += `</div>`
    } else if (currentOS.deslocamentoKm || currentOS.carroUtilizado) {
      const plate = resolvePlate(currentOS.carroUtilizado)
      html += `
      <div class="detail-section">
          <h3>Deslocamento</h3>
          <p>Km: ${currentOS.deslocamentoKm || ""}${plate ? " | Veículo: " + plate : ""}</p>
      </div>`
    }

    // Materiais (informativo)
    if (currentOS.materiais && currentOS.materiais.length > 0) {
      html += `<div class="detail-section"><h3>Materiais Utilizados</h3>`
      html += '<div class="detail-grid">'
      currentOS.materiais.forEach((m) => {
        html += `
          <div class="detail-field">
            <label>Material</label>
            <span>${m.name}</span>
          </div>
          <div class="detail-field">
            <label>Qtde</label>
            <span>${m.quantity}</span>
          </div>
          <div class="detail-field">
            <label>Valor Unitário</label>
            <span>R$ ${Number(m.unit_price).toFixed(2)}</span>
          </div>
          <div class="detail-field">
            <label>Total</label>
            <span>R$ ${Number(m.line_total).toFixed(2)}</span>
          </div>
        `
      })
      html += "</div>"
      html += `<p style="margin-top:0.5rem"><strong>Custo Total de Materiais:</strong> R$ ${
        currentOS.custoMateriais !== undefined && currentOS.custoMateriais !== null
          ? Number(currentOS.custoMateriais).toFixed(2)
          : "0.00"
      }</p>`
      html += "</div>"
    }

    // Fechamento Financeiro (informativo)
    if (
      currentOS.valorServico !== undefined ||
      currentOS.custoServico !== undefined ||
      currentOS.custoMateriais !== undefined ||
      currentOS.totalGeral !== undefined
    ) {
      html += `<div class="detail-section"><h3>Fechamento Financeiro</h3>`
      html += '<div class="detail-grid">'
      html += `
        ${
          currentOS.valorServico !== null &&
          currentOS.valorServico !== undefined &&
          Number(currentOS.valorServico) > 0
            ? `
        <div class="detail-field">
          <label>Valor do Serviço Adicional</label>
          <span>R$ ${Number(currentOS.valorServico).toFixed(2)}</span>
        </div>
        `
            : ""
        }
        <div class="detail-field">
          <label>Custo Total de Serviços</label>
          <span>R$ ${
            currentOS.custoServico !== null && currentOS.custoServico !== undefined
              ? Number(currentOS.custoServico).toFixed(2)
              : "0.00"
          }</span>
        </div>
        <div class="detail-field">
          <label>Custo Total de Materiais</label>
          <span>R$ ${
            currentOS.custoMateriais !== null && currentOS.custoMateriais !== undefined
              ? Number(currentOS.custoMateriais).toFixed(2)
              : "0.00"
          }</span>
        </div>
        ${
          currentOS.observacoes
            ? `
        <div class="detail-field">
          <label>Obs. Serviço Adicional</label>
          <span>${currentOS.observacoes}</span>
        </div>
        `
            : ""
        }
        <div class="detail-field">
          <label>Total Geral</label>
          <span>R$ ${
            currentOS.totalGeral !== null && currentOS.totalGeral !== undefined
              ? Number(currentOS.totalGeral).toFixed(2)
              : "0.00"
          }</span>
        </div>
      `
      html += "</div>"
      html += "</div>"
    }

    // Assinaturas
    html += `
      <div class="detail-section">
          <h3>Assinaturas</h3>
          <div class="signature-display">
              <div>
                  <label>Técnico</label>
                  <img src="${currentOS.signatureTecnico}" alt="Assinatura Técnico">
              </div>
              <div>
                  <label>Cliente</label>
                  <img src="${currentOS.signatureCliente}" alt="Assinatura Cliente">
              </div>
          </div>
      </div>
    `
    
    // Se a OS não estiver finalizada, permite transferir para outro técnico.
    // Status que permitem transferência: assigned, accepted, in_progress
    const statusLower = String(row.status || '').toLowerCase()
    if (['assigned', 'accepted', 'in_progress'].includes(statusLower)) {
      try {
        // Garante que a lista de técnicos esteja carregada
        if (!cachedTechnicians || cachedTechnicians.length === 0) {
          await loadTechniciansForTransfer()
        }
        const options = (cachedTechnicians || [])
          .map((t) => `<option value="${t.id}">${t.username}</option>`)
          .join('')
        html += `
        <div class="detail-section">
          <h3>Transferir OS</h3>
          <div style="display:flex; gap:0.5rem; align-items:center; flex-wrap:wrap; margin-top:0.5rem">
            <select id="transferTechSelect" style="flex:1; min-width:180px; padding: 0.5rem; background: var(--bg-input); border: 1px solid var(--border-color); border-radius: 6px; color: var(--text-primary);">
              <option value="">Selecione o técnico</option>
              ${options}
            </select>
            <button class="btn-primary" onclick="transferOSTo(${row.id})">Transferir</button>
          </div>
        </div>
        `
      } catch (_e) {
        // silencioso: não impede renderização caso falhe
      }
    }

    details.innerHTML = html
    modal.classList.add("active")
  } catch (_e) {
    // Fallback localStorage com novo layout
    const osList = JSON.parse(localStorage.getItem("osList") || "[]")
    currentOS = osList.find((os) => os.id === id)
    if (!currentOS) return
    details.innerHTML = `
      <div class="detail-section">
          <h3>Informações Básicas (Relatório do Chamado)</h3>
          <div class="detail-grid">
              <div class="detail-field">
                  <label>Número da OS</label>
                  <span>${currentOS.osNumber}</span>
              </div>
              <div class="detail-field">
                  <label>Data Programada</label>
                  <span>${new Date(currentOS.dataProgramada).toLocaleDateString("pt-BR")}</span>
              </div>
              <div class="detail-field">
                  <label>Cliente</label>
                  <span>${currentOS.cliente}</span>
              </div>
              <div class="detail-field">
                  <label>Número de Série</label>
                  <span>${currentOS.numeroSerie || ""}</span>
              </div>
              <div class="detail-field">
                  <label>Responsável</label>
                  <span>${currentOS.responsavel}</span>
              </div>
          </div>
      </div>
      <div class="detail-section">
          <h3>Fechamento Técnico</h3>
          <div class="detail-grid">
              <div class="detail-field">
                  <label>Assistente Técnico</label>
                  <span>${currentOS.assistenteTecnico}</span>
              </div>
              <div class="detail-field">
                  <label>Total de Horas</label>
                  <span>${currentOS.totalHoras}</span>
              </div>
          </div>
          <div class="detail-field" style="margin-top: 1rem;">
              <label>Descrição do Serviço</label>
              <span>${currentOS.descricao}</span>
          </div>
      </div>
    `
    const modal = document.getElementById("osModal")
    if (modal) modal.classList.add("active")
  }
}

/**
 * Fecha o modal de detalhes.
 */
function closeModal() {
  const modal = document.getElementById("osModal")
  if (modal) modal.classList.remove("active")
}

/**
 * Pesquisa OS por número, cliente ou técnico.
 */
function searchOS() {
  const query = document.getElementById("adminSearch").value.toLowerCase()
  const osList = JSON.parse(localStorage.getItem("osList") || "[]")
  const filtered = osList.filter(
    (os) =>
      String(os.osNumber).toLowerCase().includes(query) ||
      (os.cliente || "").toLowerCase().includes(query) ||
      (os.assistenteTecnico || "").toLowerCase().includes(query)
  )
  const container = document.getElementById("osList")
  if (!container) return
  if (filtered.length === 0) {
    container.innerHTML = '<p class="empty-state">Nenhuma OS encontrada</p>'
    return
  }
  container.innerHTML = filtered
    .map(
      (os) => `
        <div class="os-card" onclick="viewOSDetails(${os.id})">
            <div class="os-card-header">
                <h3 class="os-card-title">O.S ${os.osNumber}</h3>
                <span class="status-badge ${os.status}">${os.status === "pending" ? "Pendente" : "Concluída"}</span>
            </div>
            <div class="os-card-body">
                <div class="os-card-field">
                    <label>Cliente</label>
                    <span>${os.cliente}</span>
                </div>
                <div class="os-card-field">
                    <label>Técnico</label>
                    <span>${os.assistenteTecnico}</span>
                </div>
                <div class="os-card-field">
                    <label>Data</label>
                    <span>${new Date(os.dataProgramada).toLocaleDateString("pt-BR")}</span>
                </div>
            </div>
        </div>
    `
    )
    .join("")
}

/**
 * Gera e abre o PDF da OS do sistema em uma nova aba
 */
async function generateAndOpenOSPDF() {
  if (!currentOS) return

  // Busca a assinatura ATUAL do técnico (não a que está salva na OS)
  console.log(`[PDF] ========== INÍCIO BUSCA ASSINATURA ==========`)
  console.log(`[PDF] Técnico ID: ${currentOS.technician_id}`)
  console.log(`[PDF] API_URL: ${API_URL}`)
  console.log(`[PDF] Assinatura ANTES da busca: ${currentOS.signatureTecnico ? 'EXISTE (' + currentOS.signatureTecnico.length + ' chars)' : 'NÃO EXISTE'}`)

  if (currentOS.technician_id) {
    try {
      const url = `${API_URL}/api/technicians/${currentOS.technician_id}`
      console.log(`[PDF] Fazendo fetch em: ${url}`)

      const techResponse = await fetch(url)
      console.log(`[PDF] Resposta recebida - Status: ${techResponse.status}`)

      if (techResponse.ok) {
        const techData = await techResponse.json()
        console.log(`[PDF] Técnico encontrado:`, techData)
        console.log(`[PDF] Signature no techData: ${techData.signature ? 'EXISTE (' + techData.signature.length + ' chars)' : 'NÃO EXISTE'}`)

        // Sobrescreve com a assinatura atual do técnico
        if (techData.signature) {
          console.log(`[PDF] ✅ Substituindo assinatura antiga pela ATUAL do técnico`)
          currentOS.signatureTecnico = techData.signature
          console.log(`[PDF] ✅ Assinatura substituída! Tamanho: ${currentOS.signatureTecnico.length} chars`)
        } else {
          console.log(`[PDF] ⚠️ Técnico não tem assinatura cadastrada`)
        }
      } else {
        console.warn(`[PDF] ❌ Erro ao buscar técnico: ${techResponse.status}`)
        const errorText = await techResponse.text()
        console.warn(`[PDF] Erro detalhado:`, errorText)
      }
    } catch (err) {
      console.error('[PDF] ❌ ERRO ao buscar assinatura:', err)
      console.error('[PDF] Stack:', err.stack)
      // Continua com a assinatura que está na OS
    }
  } else {
    console.warn('[PDF] ⚠️ OS não tem technician_id, usando assinatura da OS')
  }

  console.log(`[PDF] Assinatura DEPOIS da busca: ${currentOS.signatureTecnico ? 'EXISTE (' + currentOS.signatureTecnico.length + ' chars)' : 'NÃO EXISTE'}`)
  console.log(`[PDF] ========== FIM BUSCA ASSINATURA ==========`)

  const { jsPDF } = window.jspdf
  const doc = new jsPDF("p", "mm", "a4")
  
  // Medidas básicas
  const pageW = doc.internal.pageSize.getWidth()
  const pageH = doc.internal.pageSize.getHeight()
  const marginX = 12
  const contentW = pageW - marginX * 2
  let y = 2

  // Métricas / espaçamentos
  const LINE_H = 3.6           // baseline → baseline
  const PADY = 3               // padding vertical simétrico (top = bottom)
  const LEFT_INNER = 2         // recuo interno à esquerda
  const RIGHT_INNER = 2        // recuo interno à direita
  const BOTTOM_MARGIN = 20     // margem inferior de página

  // Helpers
  const fmtDateOnly = (d) => (!d ? "" : parseAsLocalTime(d).toLocaleDateString("pt-BR"))
  const fmtTimeOnly = (d) => (!d ? "" : parseAsLocalTime(d).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }))
  const fmtBRL = (n) => {
    const num = Number(n || 0)
    try { return num.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) }
    catch { return `R$ ${num.toFixed(2)}` }
  }
  
  const ensureSpace = (needed) => {
    if (y + needed <= pageH - BOTTOM_MARGIN) return
    doc.addPage()
    y = 10
  }

  // ========= UTIL DE TEXTO (respeita \n) =========
  const splitRespectingNewlines = (doc, text, maxW) => {
    const raw = String(text ?? "").replace(/\r\n?/g, "\n")
    const parts = raw.split("\n")
    let out = []
    for (const part of parts) {
      const arr = doc.splitTextToSize(part, maxW)
      out = out.concat(arr.length ? arr : [""])
    }
    return out
  }

  // ========= CÉLULAS lado-a-lado (label + value na MESMA LINHA) =========
  const drawCells = (cells) => {
    // mede cada célula
    const naturals = cells.map((cell) => {
      const cellW = contentW * cell.width
      // label
      doc.setFont("helvetica", "bold")
      doc.setFontSize(9)
      const labelText = `${cell.label}: `
      const labelW = doc.getTextWidth(labelText)
      // value
      doc.setFont("helvetica", "normal")
      const maxTextW = Math.max(10, cellW - LEFT_INNER - RIGHT_INNER - labelW)
      const valueLines = splitRespectingNewlines(doc, String(cell.value ?? ""), maxTextW)
      const n = Math.max(1, valueLines.length)
      return {
        labelText, labelW, valueLines,
        naturalH: (2 * PADY) + (n - 1) * LINE_H
      }
    })

    // altura da linha
    const rowH = Math.max(...naturals.map(n => n.naturalH))
    ensureSpace(rowH)

    // desenha
    let x = marginX
    cells.forEach((cell, idx) => {
      const cellW = contentW * cell.width
      const { labelText, labelW, valueLines, naturalH } = naturals[idx]

      // borda
      doc.setDrawColor(200, 200, 200)
      doc.setFillColor(255, 255, 255)
      doc.rect(x, y, cellW, rowH, "S")

      // centralização vertical se a célula for "menor"
      const extra = rowH - naturalH
      const baseY = y + PADY + (extra / 2)

      // label
      doc.setFont("helvetica", "bold")
      doc.setFontSize(9)
      doc.setTextColor(0, 0, 0)
      doc.text(labelText, x + LEFT_INNER, baseY)

      // valor
      doc.setFont("helvetica", "normal")
      const maxTextW = Math.max(10, cellW - LEFT_INNER - RIGHT_INNER - labelW)
      let yy = baseY
      const valX = x + LEFT_INNER + labelW
      valueLines.forEach((li) => {
        doc.text(li, valX, yy)
        yy += LINE_H
      })

      x += cellW
    })

    y += rowH
  }

  // ========= LINHA CHEIA (label + value) =========
  const drawFullRow = (label, value) => {
    // mede
    doc.setFont("helvetica", "bold")
    doc.setFontSize(9)
    const labelText = `${label}: `
    const labelW = doc.getTextWidth(labelText)

    doc.setFont("helvetica", "normal")
    const maxTextW = Math.max(10, contentW - LEFT_INNER - RIGHT_INNER - labelW)
    const lines = splitRespectingNewlines(doc, String(value ?? ""), maxTextW)
    const n = Math.max(1, lines.length)
    const rowH = (2 * PADY) + (n - 1) * LINE_H
    ensureSpace(rowH)

    // retângulo
    doc.setDrawColor(200, 200, 200)
    doc.setFillColor(255, 255, 255)
    doc.rect(marginX, y, contentW, rowH, "S")

    // base
    const baseY = y + PADY

    // label
    doc.setFont("helvetica", "bold")
    doc.setFontSize(9)
    doc.text(labelText, marginX + LEFT_INNER, baseY)

    // valor
    doc.setFont("helvetica", "normal")
    let yy = baseY
    const valX = marginX + LEFT_INNER + labelW
    lines.forEach((li) => {
      doc.text(li, valX, yy)
      yy += LINE_H
    })

    y += rowH
  }

  // ========= LINHA CHEIA MULTI-PÁGINA =========
  const drawFullRowMultipage = (label, value) => {
    // Métricas do label
    doc.setFont("helvetica", "bold")
    doc.setFontSize(9)
    const labelText = `${label}: `
    const labelW = doc.getTextWidth(labelText)

    // Quebra o texto inteiro
    doc.setFont("helvetica", "normal")
    const maxTextW = Math.max(10, contentW - LEFT_INNER - RIGHT_INNER - labelW)
    const allLines = splitRespectingNewlines(doc, String(value ?? ""), maxTextW)
    if (allLines.length === 0) {
      drawFullRow(label, "")
      return
    }

    let i = 0
    while (i < allLines.length) {
      // verifica espaço mínimo
      const MIN_SEG_H = 2 * PADY
      if (y > pageH - BOTTOM_MARGIN - MIN_SEG_H) {
        doc.addPage()
        y = 10
      }

      // Quantas linhas cabem nesta página?
      const available = pageH - BOTTOM_MARGIN - y
      // rowH(n) = 2*PADY + (n-1)*LINE_H  => n <= 1 + floor((available - 2*PADY)/LINE_H)
      let maxLines = 1 + Math.floor((available - 2 * PADY) / LINE_H)
      if (maxLines < 1) maxLines = 1

      const segLines = allLines.slice(i, i + maxLines)
      const n = segLines.length
      const segH = (2 * PADY) + (n - 1) * LINE_H

      // borda
      doc.setDrawColor(200, 200, 200)
      doc.setFillColor(255, 255, 255)
      doc.rect(marginX, y, contentW, segH, "S")

      // label
      doc.setFont("helvetica", "bold")
      doc.setFontSize(9)
      const baseY = y + PADY
      doc.text(labelText, marginX + LEFT_INNER, baseY)

      // valor
      doc.setFont("helvetica", "normal")
      let yy = baseY
      const valX = marginX + LEFT_INNER + labelW
      segLines.forEach((li) => {
        doc.text(li, valX, yy)
        yy += LINE_H
      })

      y += segH
      i += segLines.length
    }
  }

  // ========= Cabeçalho de sessão colorido =========
  const drawSectionHeaderColored = (title, color) => {
    const headerH = 7
    ensureSpace(headerH)
    doc.setFillColor(color.r, color.g, color.b)
    doc.rect(marginX, y, contentW, headerH, "F")
    doc.setFont("helvetica", "bold")
    doc.setFontSize(11)
    doc.setTextColor(0)
    const baseY = y + headerH / 2 + 1.3
    doc.text(title, marginX + LEFT_INNER, baseY)
    y += headerH
  }

  // ========= Barra do Título (tema) =========
  const drawTitleBar = (text) => {
    const VISUAL_H = 9
    const ADVANCE_H = 5
    const LIFT_UP = 5

    ensureSpace(Math.max(VISUAL_H, ADVANCE_H))
    doc.setFont("helvetica", "bold")
    doc.setFontSize(12)
    const tW = doc.getTextWidth(text)
    const tX = marginX + (contentW - tW) / 2
    doc.setTextColor(0)
    const baseY = y + VISUAL_H / 2 + 1.2 - LIFT_UP
    doc.text(text, tX, baseY)
    y += ADVANCE_H
  }

  // ========= Barra do Cliente (nome + CNPJ) =========
  const drawClientBar = () => {
    const cnpjTxt = currentOS.clienteCnpj ? ` | CNPJ: ${formatCNPJ(currentOS.clienteCnpj)}` : ""
    const text = `Cliente: ${currentOS.cliente || ""}${cnpjTxt}`
    const lines = doc.splitTextToSize(text, contentW - LEFT_INNER - RIGHT_INNER)
    const n = Math.max(1, lines.length)
    const barH = (2 * PADY) + (n - 1) * LINE_H
    ensureSpace(barH)

    doc.setFont("helvetica", "bold")
    doc.setFontSize(9)
    doc.setTextColor(0)
    let yy = y + PADY
    lines.forEach((li) => {
      doc.text(li, marginX + LEFT_INNER, yy)
      yy += LINE_H
    })
    y += barH
  }

  // ========= Assinaturas =========
  const drawSignatures = () => {
    console.log(`[PDF] ========== DESENHANDO ASSINATURAS ==========`)
    console.log(`[PDF] currentOS.signatureTecnico: ${currentOS.signatureTecnico ? 'EXISTE (' + currentOS.signatureTecnico.length + ' chars)' : 'NÃO EXISTE'}`)
    console.log(`[PDF] currentOS.signatureCliente: ${currentOS.signatureCliente ? 'EXISTE (' + currentOS.signatureCliente.length + ' chars)' : 'NÃO EXISTE'}`)

    const sigH = 35  // Altura do campo de assinatura
    const rowH = sigH + 7
    ensureSpace(rowH)
    const cellW = (contentW - 2) / 2
    const maxW = cellW - 4  // Largura máxima para assinatura (com margem)
    const maxH = sigH - 4   // Altura máxima para assinatura (com margem)

    doc.setDrawColor(200, 200, 200)
    doc.rect(marginX, y, cellW, sigH, "S")
    doc.rect(marginX + cellW + 2, y, cellW, sigH, "S")

    // Função para adicionar imagem respeitando aspect ratio
    const addSignatureImage = (imageData, xPos, label) => {
      console.log(`[PDF] addSignatureImage() chamado para ${label}`)
      console.log(`[PDF] imageData: ${imageData ? 'EXISTE (' + imageData.length + ' chars)' : 'NÃO EXISTE'}`)
      if (!imageData) {
        console.log(`[PDF] ⚠️ ${label}: imageData é null/undefined, pulando`)
        return
      }
      try {
        // IMPORTANTE: Adiciona a imagem do canvas COMPLETO sem cortar
        // O canvas do cliente agora é 800x300 pixels
        // Vamos usar toda a largura disponível no PDF

        // Aspect ratio fixo baseado no canvas (800x300 = 8:3)
        const canvasRatio = 8 / 3

        // Usa toda a largura disponível
        let finalWidth = maxW
        let finalHeight = maxW / canvasRatio

        // Se a altura calculada for maior que o espaço, limita pela altura
        if (finalHeight > maxH) {
          finalHeight = maxH
          finalWidth = maxH * canvasRatio
        }

        // Centraliza apenas se necessário
        const offsetX = (maxW - finalWidth) / 2
        const offsetY = (maxH - finalHeight) / 2

        console.log(`[PDF] Canvas completo ${label}: w=${finalWidth}, h=${finalHeight}`)
        console.log(`[PDF] Adicionando em x=${xPos + 2 + offsetX}, y=${y + 2 + offsetY}`)

        // Adiciona a imagem COMPLETA do canvas
        doc.addImage(imageData, "PNG", xPos + 2 + offsetX, y + 2 + offsetY, finalWidth, finalHeight, undefined, 'FAST')
        console.log(`[PDF] ✅ Assinatura ${label} adicionada com canvas COMPLETO`)
      } catch (err) {
        console.error(`[PDF] ❌ Erro ao adicionar assinatura ${label}:`, err)
      }
    }

    addSignatureImage(currentOS.signatureTecnico, marginX, 'TÉCNICO')
    addSignatureImage(currentOS.signatureCliente, marginX + cellW + 2, 'CLIENTE')

    doc.setFont("helvetica", "normal")
    doc.setFontSize(8)
    doc.setTextColor(0)
    const techLabel = "Assinatura Técnico"
    const cliLabel = "Assinatura Cliente"
    const techX = marginX + cellW / 2 - doc.getTextWidth(techLabel) / 2
    const cliX = marginX + cellW + 2 + cellW / 2 - doc.getTextWidth(cliLabel) / 2
    const yy = y + sigH + 5
    doc.text(techLabel, techX, yy)
    doc.text(cliLabel, cliX, yy)
    y += rowH
  }

  // ========= Custo de deslocamento =========
  const computeDisplacementCost = () => {
    const isNew = !!currentOS.isNewClient
    const perKm = isNew ? 2.57 : 2.2
    let totalKm = 0
    let cost = 0
    if (Array.isArray(currentOS.displacements) && currentOS.displacements.length > 0) {
      currentOS.displacements.forEach((d) => {
        let km = 0
        if (d && d.km_total !== undefined && d.km_total !== null && String(d.km_total).trim() !== "") {
          const parsed = Number(d.km_total)
          if (!isNaN(parsed) && parsed > 0) km = parsed
        } else if (d && d.km_option) {
          const opt = String(d.km_option).toLowerCase()
          if (opt.includes("50")) km = 50
          else if (opt.includes("100")) km = 100
        }
        if (km > 0) {
          totalKm += km
          if (km <= 50) cost += isNew ? 95 : 80
          else if (km <= 100) cost += isNew ? 170 : 150
          else cost += Math.round(km * perKm * 100) / 100
        }
      })
    } else {
      const kmVal = Number(currentOS.deslocamentoKm || 0)
      if (kmVal > 0) {
        totalKm = kmVal
        if (kmVal <= 50) cost = isNew ? 95 : 80
        else if (kmVal <= 100) cost = isNew ? 170 : 150
        else cost = Math.round(kmVal * perKm * 100) / 100
      }
    }
    return { totalKm, cost: Math.round(cost * 100) / 100 }
  }

  // ========= Rodapé =========
  const drawFooter = () => {
    const website = "www.helsenservice.com.br/"
    const footerY = pageH - 8
    doc.setFont("helvetica", "normal")
    doc.setFontSize(8)
    doc.setTextColor(0)
    doc.text(website, marginX, footerY)
  }

  // ========= Carrega logo =========
  const loadLogoData = () =>
    new Promise((resolve) => {
      try {
        const img = new Image()
        img.crossOrigin = "anonymous"
        img.onload = () => {
          const LOGO_W = 30
          const aspect = img.naturalHeight && img.naturalWidth ? img.naturalHeight / img.naturalWidth : 0.4
          const LOGO_H = Math.max(8, Math.min(18, LOGO_W * aspect))
          const canvas = document.createElement("canvas")
          canvas.width = img.naturalWidth
          canvas.height = img.naturalHeight
          const ctx = canvas.getContext("2d")
          ctx.drawImage(img, 0, 0)
          let dataUrl = null
          try { dataUrl = canvas.toDataURL("image/png") } catch (_e) { resolve(null); return }
          resolve({ dataUrl, w: LOGO_W, h: LOGO_H })
        }
        img.onerror = () => resolve(null)
        img.src = "logohelsen.png"
      } catch (_err) {
        resolve(null)
      }
    })

  // ====== Cabeçalho (logo + OS) ======
  doc.setFont("helvetica", "bold")
  doc.setFontSize(12)

  const logo = await loadLogoData()
  let headerBlockH = 14
  const LOGO_X_OFFSET = 4
  if (logo && logo.dataUrl) {
    try {
      doc.addImage(logo.dataUrl, "PNG", marginX + LOGO_X_OFFSET, y + 4, logo.w, logo.h)
      headerBlockH = Math.max(headerBlockH, logo.h + 2)
    } catch (_e) {}
  }

  const osLabel = `O.S.: ${currentOS.osNumber || ""}`
  const rightX = marginX + contentW
  const osW = doc.getTextWidth(osLabel)
  const textY = y + 9.0
  doc.text(osLabel, rightX - osW, textY)
  y += headerBlockH

  // Faixa do título (tema)
  drawTitleBar("RELATÓRIO DE ASSISTÊNCIA TÉCNICA")

  // ====== SESSÃO CLIENTE ======
  const TITLE_COLORS = {
    cliente:    { r: 232, g: 240, b: 254 },
    tecnico:    { r: 232, g: 240, b: 254 },
    financeiro: { r: 232, g: 240, b: 254 },
  }
  drawSectionHeaderColored("Dados do Cliente", TITLE_COLORS.cliente)
  drawClientBar()
  {
    const appVal =
      currentOS.modelo && currentOS.numeroSerie
        ? `${currentOS.modelo} — ${currentOS.numeroSerie}`
        : currentOS.modelo || currentOS.numeroSerie || ""
    const responsavel = currentOS.responsavel || currentOS.assistenteTecnico || ""
    drawCells([
      { label: "Equipamento", value: appVal, width: 0.5 },
      { label: "Responsável", value: responsavel, width: 0.5 },
    ])
  }
  drawFullRowMultipage("Motivo do Chamado", currentOS.motivoChamado || "")

  // ====== SESSÃO TÉCNICO ======
  drawSectionHeaderColored("Dados Técnicos", TITLE_COLORS.tecnico)
  drawCells([{ label: "Assistente Técnico", value: currentOS.assistenteTecnico || "", width: 1 }])

  if (currentOS.maintenanceType) {
    drawCells([{ label: "Tipo de Manutenção", value: currentOS.maintenanceType, width: 1 }])
  }

  const periods = Array.isArray(currentOS.worklogs) ? currentOS.worklogs : []
  if (periods.length > 0) {
    periods.forEach((wl) => {
      const s = wl && wl.start_datetime ? parseAsLocalTime(wl.start_datetime) : null
      const e = wl && wl.end_datetime ? parseAsLocalTime(wl.end_datetime) : null
      const hNum = wl && wl.hours != null ? Number(wl.hours) || 0 : s && e ? Math.max((e - s) / 36e5, 0) : 0
      const inicioVal = s ? `${fmtDateOnly(s)} ${fmtTimeOnly(s)}` : ""
      const fimVal = e ? `${fmtDateOnly(e)} ${fmtTimeOnly(e)}` : ""
      drawCells([
        { label: 'Início', value: inicioVal, width: 0.33 },
        { label: 'Fim', value: fimVal, width: 0.33 },
        { label: 'Horas', value: formatHours(hNum), width: 0.34 },
      ])
    })
    const totalGeral = periods.reduce((acc, wl) => {
      if (wl && wl.hours != null) return acc + (Number(wl.hours) || 0)
      const s = wl && wl.start_datetime ? parseAsLocalTime(wl.start_datetime) : null
      const e = wl && wl.end_datetime ? parseAsLocalTime(wl.end_datetime) : null
      return acc + (s && e ? Math.max((e - s) / 36e5, 0) : 0)
    }, 0)
    drawCells([{ label: "Total de Horas", value: formatHours(totalGeral), width: 1 }])
  } else {
    const inicioVal = currentOS.dataHoraInicio ? `${fmtDateOnly(currentOS.dataHoraInicio)} ${fmtTimeOnly(currentOS.dataHoraInicio)}` : ""
    const fimVal = currentOS.dataHoraFim ? `${fmtDateOnly(currentOS.dataHoraFim)} ${fmtTimeOnly(currentOS.dataHoraFim)}` : ""
    drawCells([
      { label: "Início", value: inicioVal, width: 0.33 },
      { label: "Fim", value: fimVal, width: 0.33 },
      { label: "Total de Horas", value: currentOS.totalHoras || "", width: 0.34 },
    ])
  }

  drawFullRowMultipage("Descrição", currentOS.descricao || "")

  if (Array.isArray(currentOS.displacements) && currentOS.displacements.length > 0) {
    currentOS.displacements.forEach((d, idx) => {
      let distText = ""

      // Verifica se é "sem deslocamento"
      const isSemDeslocamento = d && d.km_option && (
        String(d.km_option).toLowerCase() === 'nenhum' ||
        String(d.km_option).toLowerCase() === 'sem_deslocamento' ||
        String(d.km_option).toLowerCase() === 'sem deslocamento' ||
        String(d.km_option).toLowerCase() === 'none'
      )

      if (d) {
        if (isSemDeslocamento) {
          distText = "Não houve deslocamento"
        } else if (d.km_total !== undefined && d.km_total !== null && String(d.km_total).trim() !== "") {
          // Verifica primeiro se tem km_total preenchido (acima de 100 km)
          distText = `Acima: ${d.km_total} km`
        } else {
          // Se não tem km_total, verifica o km_option (até 50 ou até 100)
          const opt = String(d.km_option || "").toLowerCase()
          if (opt.includes("50")) distText = "Até 50 km"
          else if (opt.includes("100")) distText = "Até 100 km"
        }
      }

      // Só mostra a placa se NÃO for "sem deslocamento"
      if (isSemDeslocamento) {
        // Linha cheia sem placa
        drawFullRow(`Deslocamento ${idx + 1}`, distText)
      } else {
        // Linha com duas células (deslocamento + placa)
        const plate = resolvePlate(d && d.vehicle) || resolvePlate(d && d.vehicle_plate) || resolvePlate(d && d.plate) || resolvePlate(currentOS.carroUtilizado) || currentOS.carroUtilizado || ""
        drawCells([
          { label: `Deslocamento ${idx + 1}`, value: distText, width: 0.5 },
          { label: "Placa", value: plate, width: 0.5 },
        ])
      }
    })
  } else if (currentOS.deslocamentoKm || currentOS.carroUtilizado) {
    let distText = ""
    const kmVal = Number(currentOS.deslocamentoKm || 0)
    if (!isNaN(kmVal) && kmVal > 0) {
      if (kmVal <= 50) distText = "Até 50 km"
      else if (kmVal <= 100) distText = "Até 100 km"
      else distText = `Acima: ${kmVal} km`
    }
    const plate = resolvePlate(currentOS.carroUtilizado)
    drawCells([
      { label: "Deslocamento", value: distText, width: 0.5 },
      { label: "Placa", value: plate, width: 0.5 },
    ])
  }

  // ====== SESSÃO FINANCEIRO ======
  drawSectionHeaderColored("Dados Financeiros", TITLE_COLORS.financeiro)
  const { totalKm, cost: deslocCost } = computeDisplacementCost()
  const valServicoNum = Number(currentOS.valorServico || 0)
  const custoServicoNum = Number(currentOS.custoServico || 0)
  const custoMatNum = Number(currentOS.custoMateriais || 0)
  const totalHorasNum = Number(currentOS.totalHorasNum || 0)

  let valorHoraNum
  // Primeiro tenta pegar do campo salvo no banco
  if (currentOS.valorHoraTecnico !== undefined && currentOS.valorHoraTecnico !== null && Number(currentOS.valorHoraTecnico) > 0) {
    valorHoraNum = Number(currentOS.valorHoraTecnico)
  } else {
    // Se não tiver valor salvo, calcula baseado se é cliente novo ou antigo
    valorHoraNum = currentOS.isNewClient ? 175 : 150
  }
  const custoHorasTrabalhadasNum = valorHoraNum * totalHorasNum

  drawCells([
    { label: "Horas Trabalhadas", value: currentOS.totalHoras || "", width: 1 / 3 },
    { label: "Valor da Hora", value: fmtBRL(valorHoraNum), width: 1 / 3 },
    { label: "Total", value: fmtBRL(custoHorasTrabalhadasNum), width: 1 / 3 },
  ])

  if (Array.isArray(currentOS.materiais) && currentOS.materiais.length > 0) {
    currentOS.materiais.forEach((m) => {
      drawCells([
        { label: "Material", value: m.name || "", width: 0.4 },
        { label: "Qtde", value: String(m.quantity || ""), width: 0.2 },
        { label: "Valor Unitário", value: fmtBRL(m.unit_price), width: 0.2 },
        { label: "Total", value: fmtBRL(m.line_total), width: 0.2 },
      ])
    })
    drawFullRow("Custo Total de Materiais", fmtBRL(custoMatNum))
  }

  if (totalKm > 0) {
    drawFullRow(`Deslocamento (${totalKm} km)`, fmtBRL(deslocCost))
  }

  if (Array.isArray(currentOS.additionalServices) && currentOS.additionalServices.length > 0) {
    currentOS.additionalServices.forEach((s) => {
      const serviceValue = Number(s.value || 0)
      drawCells([
        { label: "Serviço Adicional", value: s.description || "", width: 0.7 },
        { label: "Valor", value: fmtBRL(serviceValue), width: 0.3 },
      ])
    })
    drawFullRow("Total de Serviços Adicionais", fmtBRL(valServicoNum))
  } else if (valServicoNum && valServicoNum > 0) {
    // Fallback: se não houver array de serviços, mostra só o total (compatibilidade)
    drawFullRow("Serviço Adicional", fmtBRL(valServicoNum))
  }

  drawFullRow("Custo Total de Serviços", fmtBRL(custoServicoNum))

  {
    const totalGer = fmtBRL(currentOS.totalGeral)
    const lineH = 8
    ensureSpace(lineH)
    doc.setFillColor(232, 240, 254)
    doc.rect(marginX, y, contentW, lineH, "F")
    doc.setFont("helvetica", "bold")
    doc.setFontSize(10)
    doc.setTextColor(0)
    doc.text("Total Geral da O.S.", marginX + LEFT_INNER, y + 5.2)
    doc.text(totalGer, marginX + contentW - doc.getTextWidth(totalGer) - RIGHT_INNER, y + 5.2)
    y += lineH
  }

  drawSignatures()
  drawFooter()

  // Gera o PDF e força o download (não abre em nova aba)
  try {
    const pdfBlob = doc.output('blob')
    const pdfUrl = URL.createObjectURL(pdfBlob)

    // Força o download do PDF
    const link = document.createElement('a')
    link.href = pdfUrl
    link.download = `OS${currentOS.osNumber}.pdf`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)

    showToast("PDF baixado com sucesso!", "success")

    // Limpa a URL do objeto após o download
    setTimeout(() => URL.revokeObjectURL(pdfUrl), 100)
  } catch (error) {
    console.error("Erro ao gerar PDF:", error)
    showToast("Erro ao gerar PDF: " + error.message, "error")
  }
}

/**
 * Função principal para geração de PDF
 * Verifica se é uma OS do NGMAN (baixa o PDF) ou do sistema (gera e abre em nova aba)
 */
async function generatePDF() {
  if (!currentOS) return
  
  // Verifica se é uma OS do NGMAN (possui PDF original)
  const hasLegacyPDF = await checkLegacyOSExists(currentOS.osNumber)
  if (hasLegacyPDF) {
    // Baixa o PDF original do NGMAN
    downloadLegacyOSPDF(currentOS.osNumber)
    return
  }
  
  // Se for OS do sistema, gera e abre em nova aba
  generateAndOpenOSPDF()
}

/**
 * Configura a barra lateral de navegação.
 */
function setupSidebar() {
  const menuItems = document.querySelectorAll(".sidebar-menu li")
  const pages = document.querySelectorAll(".admin-page")
  if (!menuItems.length || !pages.length) return
  menuItems.forEach((item) => {
    if (item.dataset.bound) return
    item.addEventListener("click", () => {
      const section = item.getAttribute("data-section")
      activateSection(section)
    })
    item.dataset.bound = "true"
  })
  
  // Restaura estado ao carregar
  restoreAdminState()
}

/**
 * Ativa uma seção específica (função exposta globalmente para uso do state manager)
 */
window.activateSection = function(section) {
  const menuItems = document.querySelectorAll(".sidebar-menu li")
  const pages = document.querySelectorAll(".admin-page")
  
  menuItems.forEach((i) => i.classList.remove("active"))
  const activeItem = Array.from(menuItems).find(i => i.getAttribute("data-section") === section)
  if (activeItem) activeItem.classList.add("active")
  
  pages.forEach((page) => {
    page.style.display = page.id === section ? "block" : "none"
  })
  
  // Salva estado
  if (window.adminStateManager) {
    window.adminStateManager.setSection(section)
  }
  
  // Para todos os auto-refresh anteriores
  stopAllAutoRefresh()
  
  if (section === "companiesSection") {
    loadCompaniesAdmin()
    setupCompanySubTabs()
  }
  
  if (section === "machinesSection") {
    // Limpa resultados anteriores
    document.getElementById('machineSearchInput').value = ''
    document.getElementById('machinesSearchResults').innerHTML = '<p class="empty-state">Digite o modelo ou número de série para buscar</p>'
  }
  if (section === "osSection") {
    loadOSList()
  }
  if (section === "usersSection") {
    loadUsersSection()
  }
  if (section === "requestsSection") {
    loadRequestsSection()
  }
  if (section === "vehiclesSection") {
    loadVehiclesList()
  }

  if (section === "reviewSection") {
    loadReviewData()
  }

  // Seção de programação semanal
  if (section === "scheduleSection") {
    // Inicializa a data da semana corrente se ainda não definida
    if (!window.currentWeekStart) {
      const today = new Date()
      window.currentWeekStart = getMonday(today)
    }
    loadSchedule()
  }
  
  // Gerenciar botão drag & drop - SEMPRE ocultar, só mostrar na Programação
  const dragBtn = document.getElementById('dragModeToggle')
  if (dragBtn) {
    dragBtn.style.display = 'none'
    if (section === 'scheduleSection') {
      setTimeout(() => {
        dragBtn.style.display = 'flex'
      }, 50)
    } else if (window.dragModeActive) {
      // Desativa drag se sair da programação
      toggleDragMode()
    }
  }
  
  // Restaura scroll da seção
  if (window.adminStateManager) {
    window.adminStateManager.restoreScrollPosition(section)
  }
}

/**
 * Restaura estado salvo ao carregar a página
 */
function restoreAdminState() {
  if (!window.adminStateManager) return
  
  const state = window.adminStateManager.restoreFromURL()
  
  if (state.currentSection) {
    activateSection(state.currentSection)
    
    // Restaura sub-tab se houver
    if (state.currentSubTab && state.currentSection === 'companiesSection') {
      setTimeout(() => {
        const subNavBtn = document.querySelector(`.sub-nav-btn[data-tab="${state.currentSubTab}"]`)
        if (subNavBtn) subNavBtn.click()
      }, 300)
    }
  }
}

/* ==================== Gestão de Usuários ==================== */

function loadUsersSection() {
  const techForm = document.getElementById("createTechnicianForm")
  if (techForm && !techForm.dataset.bound) {
    techForm.addEventListener("submit", handleCreateTechnician)
    techForm.dataset.bound = "true"
  }

  // Carrega o dropdown de empresas para usuários
  loadCompanyUserDropdown()

  const list = document.getElementById("techniciansList")
  if (!list) return
  
  // Loading
  list.innerHTML = `
    <div style="text-align: center; padding: 2rem;">
      <div style="width: 40px; height: 40px; border: 3px solid var(--border-color); border-top: 3px solid var(--primary-blue); border-radius: 50%; animation: spin 1s linear infinite; margin: 0 auto 1rem;"></div>
      <p style="color: var(--text-secondary);">Carregando técnicos...</p>
    </div>
  `
  
  fetch(`${API_URL}/api/admin/technicians`)
    .then((res) => res.json())
    .then((techs) => {
      // Filtra Sistema NGMAN (sistema antigo)
      const filteredTechs = Array.isArray(techs) ? techs.filter(t => t.username !== 'Sistema NGMAN') : []
      
      if (filteredTechs.length === 0) {
        list.innerHTML = '<p class="empty-state">Nenhum técnico cadastrado</p>'
        return
      }
      list.innerHTML = ""
      filteredTechs.forEach((t) => {
        const card = document.createElement("div")
        card.className = "tech-card"
        card.id = `tech-card-${t.id}`
        card.innerHTML = `
          <div class="tech-card-header">
            <div class="tech-info">
              <h3 class="tech-name" id="tech-name-${t.id}">${t.username}</h3>
            </div>
            <div class="tech-actions">
              <button class="btn-icon" id="edit-btn-${t.id}" onclick="toggleTechEditMode(${t.id}, '${t.username}', ${t.hourly_rate})" title="Editar técnico">
                <svg width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
                  <path d="M12.146.146a.5.5 0 0 1 .708 0l3 3a.5.5 0 0 1 0 .708l-10 10a.5.5 0 0 1-.168.11l-5 2a.5.5 0 0 1-.65-.65l2-5a.5.5 0 0 1 .11-.168l10-10zM11.207 2.5 13.5 4.793 14.793 3.5 12.5 1.207 11.207 2.5zm1.586 3L10.5 3.207 4 9.707V10h.5a.5.5 0 0 1 .5.5v.5h.5a.5.5 0 0 1 .5.5v.5h.293l6.5-6.5zm-9.761 5.175-.106.106-1.528 3.821 3.821-1.528.106-.106A.5.5 0 0 1 5 12.5V12h-.5a.5.5 0 0 1-.5-.5V11h-.5a.5.5 0 0 1-.468-.325z"/>
                </svg>
              </button>
              <button class="btn-icon btn-danger" onclick="deleteTech(${t.id}, '${t.username}')" title="Excluir técnico">
                <svg width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
                  <path d="M5.5 5.5A.5.5 0 0 1 6 6v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5Zm2.5 0a.5.5 0 0 1 .5.5v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5Zm3 .5a.5.5 0 0 0-1 0v6a.5.5 0 0 0 1 0V6Z"/>
                  <path d="M14.5 3a1 1 0 0 1-1 1H13v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V4h-.5a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1H6a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1h3.5a1 1 0 0 1 1 1v1ZM4.118 4 4 4.059V13a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V4.059L11.882 4H4.118ZM2.5 3h11V2h-11v1Z"/>
                </svg>
              </button>
            </div>
          </div>
          <div class="tech-card-body">
            <div class="tech-field" id="tech-field-${t.id}">
              <label>Valor/Hora (R$)</label>
              <div style="display: flex; gap: 0.5rem; align-items: center;">
                <span id="rate-display-${t.id}">${Number(t.hourly_rate).toFixed(2)}</span>
              </div>
            </div>
          </div>
        `
        list.appendChild(card)
      })
    })
    .catch((err) => {
      console.error(err)
      list.innerHTML = '<p class="error-state">Erro ao carregar técnicos</p>'
      showToast("Erro ao carregar técnicos", "error")
    })
}

function toggleTechEditMode(techId, currentName, currentRate) {
  const card = document.getElementById(`tech-card-${techId}`)
  const field = document.getElementById(`tech-field-${techId}`)
  const nameEl = document.getElementById(`tech-name-${techId}`)
  const rateDisplay = document.getElementById(`rate-display-${techId}`)
  const editBtn = document.getElementById(`edit-btn-${techId}`)
  
  // Verifica se já está em modo edição
  const isEditing = field.dataset.editing === 'true'
  
  if (isEditing) {
    // Sair do modo edição
    field.dataset.editing = 'false'
    field.innerHTML = `
      <label>Valor/Hora (R$)</label>
      <div style="display: flex; gap: 0.5rem; align-items: center;">
        <span id="rate-display-${techId}">${currentRate}</span>
      </div>
    `
    nameEl.innerHTML = currentName
    editBtn.title = "Editar técnico"
  } else {
    // Entrar no modo edição
    field.dataset.editing = 'true'
    field.innerHTML = `
      <label>Nome do Técnico</label>
      <input type="text" id="tech-name-input-${techId}" value="${currentName}" style="margin-bottom: 0.5rem; padding: 0.5rem; background: var(--bg-input); border: 1px solid var(--border-color); border-radius: 6px; color: var(--text-primary); width: 100%;">
      <label>Valor/Hora (R$)</label>
      <input type="number" step="0.01" id="tech-rate-input-${techId}" value="${currentRate}" style="margin-bottom: 0.5rem; padding: 0.5rem; background: var(--bg-input); border: 1px solid var(--border-color); border-radius: 6px; color: var(--text-primary); width: 100%;">
      <div style="display: flex; gap: 0.5rem;">
        <button class="btn-primary btn-sm" onclick="saveTechChanges(${techId}, '${currentName}', ${currentRate})">Salvar</button>
        <button class="btn-secondary btn-sm" onclick="toggleTechEditMode(${techId}, '${currentName}', ${currentRate})">Cancelar</button>
      </div>
    `
    nameEl.innerHTML = ''
    editBtn.title = "Cancelar edição"
  }
}

function saveTechChanges(techId, originalName, originalRate) {
  const newName = document.getElementById(`tech-name-input-${techId}`).value.trim()
  const newRate = Number.parseFloat(document.getElementById(`tech-rate-input-${techId}`).value)
  
  if (!newName) {
    showToast("Nome não pode ser vazio", "error")
    return
  }
  
  if (isNaN(newRate) || newRate < 0) {
    showToast("Valor de hora inválido", "error")
    return
  }
  
  // Faz as requisições
  const promises = []
  
  if (newName !== originalName) {
    promises.push(
      fetch(`${API_URL}/api/admin/technicians/${techId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: newName }),
      })
    )
  }
  
  if (newRate !== originalRate) {
    promises.push(
      fetch(`${API_URL}/api/admin/technicians/${techId}/hourly-rate`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ hourly_rate: newRate }),
      })
    )
  }
  
  if (promises.length === 0) {
    showToast("Nenhuma alteração foi feita", "info")
    toggleTechEditMode(techId, originalName, originalRate)
    return
  }
  
  Promise.all(promises)
    .then((responses) => {
      for (const res of responses) {
        if (!res.ok) {
          return res.json().then((d) => {
            throw new Error(d.message)
          })
        }
      }
      return true
    })
    .then(() => {
      showToast("Técnico atualizado com sucesso!", "success")
      loadUsersSection()
    })
    .catch((err) => {
      console.error(err)
      showToast(err.message || "Erro ao atualizar técnico", "error")
    })
}

function editTechName(techId, currentName) {
  const newName = prompt(`Editar nome do técnico:\n\nNome atual: ${currentName}\n\nNovo nome:`, currentName)
  
  if (!newName || newName.trim() === '') {
    showToast("Nome não pode ser vazio", "error")
    return
  }
  
  if (newName.trim() === currentName) {
    showToast("Nome não foi alterado", "info")
    return
  }
  
  fetch(`${API_URL}/api/admin/technicians/${techId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: newName.trim() }),
  })
    .then((res) => {
      if (!res.ok)
        return res.json().then((d) => {
          throw new Error(d.message)
        })
      return res.json()
    })
    .then(() => {
      showToast("Nome atualizado com sucesso!", "success")
      loadUsersSection()
    })
    .catch((err) => {
      console.error(err)
      showToast(err.message || "Erro ao atualizar nome", "error")
    })
}

function deleteTech(techId, techName) {
  if (!confirm(`ATENÇÃO!\n\nDeseja realmente excluir o técnico "${techName}"?\n\nEsta ação NÃO pode ser desfeita!`)) {
    return
  }
  
  fetch(`${API_URL}/api/admin/technicians/${techId}`, {
    method: "DELETE",
  })
    .then((res) => {
      if (!res.ok)
        return res.json().then((d) => {
          throw new Error(d.message)
        })
      return res.json()
    })
    .then((data) => {
      showToast(data.message || "Técnico excluído com sucesso!", "success")
      loadUsersSection()
    })
    .catch((err) => {
      console.error(err)
      showToast(err.message || "Erro ao excluir técnico", "error")
    })
}

function updateRate(techId) {
  const input = document.getElementById(`rate-${techId}`)
  const rate = Number.parseFloat(input.value)
  
  if (isNaN(rate) || rate < 0) {
    showToast("Valor de hora inválido", "error")
    return
  }
  
  fetch(`${API_URL}/api/admin/technicians/${techId}/hourly-rate`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ hourly_rate: rate }),
  })
    .then((res) => {
      if (!res.ok)
        return res.json().then((d) => {
          throw new Error(d.message)
        })
      return res.json()
    })
    .then(() => {
      showToast("Tarifa atualizada com sucesso!", "success")
    })
    .catch((err) => {
      console.error(err)
      showToast(err.message || "Erro ao atualizar tarifa", "error")
    })
}

function handleCreateTechnician(e) {
  e.preventDefault()
  const username = document.getElementById("techUsername").value.trim()
  const password = document.getElementById("techPassword").value
  if (!username || !password) {
    showToast("Preencha todos os campos", "error")
    return
  }
  fetch(`${API_URL}/api/admin/technicians`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  })
    .then((res) => {
      if (!res.ok)
        return res.json().then((d) => {
          throw new Error(d.message)
        })
      return res.json()
    })
    .then(() => {
      showToast("Técnico cadastrado com sucesso!", "success")
      document.getElementById("techUsername").value = ""
      document.getElementById("techPassword").value = ""
      loadUsersSection()
    })
    .catch((err) => {
      console.error(err)
      showToast(err.message || "Erro ao cadastrar técnico", "error")
    })
}

/* ==================== Gestão de Solicitações ==================== */

function loadRequestsSection() {
  const container = document.getElementById("requestsList")
  if (!container) return
  
  // Mostra loading
  container.innerHTML = `
    <div style="text-align: center; padding: 3rem;">
      <div style="width: 50px; height: 50px; border: 4px solid var(--border-color); border-top: 4px solid var(--primary-blue); border-radius: 50%; animation: spin 1s linear infinite; margin: 0 auto 1rem;"></div>
      <p style="color: var(--text-secondary);">Carregando solicitações...</p>
    </div>
  `
  
  fetch(`${API_URL}/api/requests`)
    .then((res) => res.json())
    .then((requests) => {
      // Filtra apenas solicitações pendentes (que ainda não foram atribuídas)
      const pendingRequests = Array.isArray(requests) 
        ? requests.filter(r => !r.status || r.status === 'pending')
        : []
      
      if (pendingRequests.length === 0) {
        container.innerHTML = '<p class="empty-state">Nenhuma solicitação pendente</p>'
        return
      }
      container.innerHTML = ""
      pendingRequests.forEach((reqObj) => {
        const card = document.createElement("div")
        card.className = "os-card clickable-card"
        card.style.cursor = "pointer"
        card.innerHTML = `
          <div class="os-card-header">
            <h3 class="os-card-title">Solicitação #${reqObj.id}</h3>
            <button class="btn-primary" data-req="${reqObj.id}" onclick="event.stopPropagation()">Atribuir Técnico</button>
          </div>
          <div class="os-card-body">
            <div class="os-card-field">
              <label>Cliente</label>
              <span>${reqObj.company_name || reqObj.client_username || ""}</span>
            </div>
            <div class="os-card-field">
              <label>Equipamento</label>
              <span>${reqObj.application || "N/A"}</span>
            </div>
            <div class="os-card-field">
              <label>Motivo</label>
              <span>${reqObj.call_reason || ""}</span>
            </div>
            <div class="os-card-field">
              <label>Responsável</label>
              <span>${reqObj.requester_name || reqObj.requester_username || ""}</span>
            </div>
            ${reqObj.problem_image_url ? '<div class="os-card-field"><label>📷 Com foto</label></div>' : ''}
          </div>
        `
        // Clique no card abre preview
        card.addEventListener("click", (e) => {
          if (!e.target.closest("button")) {
            showRequestPreview(reqObj)
          }
        })
        // Botão atribuir
        const btn = card.querySelector("button")
        btn.addEventListener("click", () => {
          openAssignModal(reqObj)
        })
        container.appendChild(card)
      })
    })
    .catch((err) => {
      console.error(err)
      showToast("Erro ao carregar solicitações", "error")
    })
}

async function showRequestPreview(reqObj) {
  // Busca todos os anexos da solicitação
  let attachments = []
  try {
    const response = await fetch(`${API_URL}/api/requests/${reqObj.id}/attachments`)
    if (response.ok) {
      attachments = await response.json()
    }
  } catch (err) {
    console.error('Erro ao buscar anexos:', err)
  }

  // Se não houver anexos na tabela nova, mas tiver problem_image_url (legado), usa ela
  if (attachments.length === 0 && reqObj.problem_image_url) {
    attachments = [{
      id: 'legacy',
      filename: 'Foto do problema',
      url: `${API_URL}${reqObj.problem_image_url}`
    }]
  }

  // Gera HTML das imagens
  const imagesHtml = attachments.length > 0
    ? `<div class="preview-images">
         <label>Fotos Anexadas (${attachments.length}):</label>
         <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 15px; margin-top: 10px;">
           ${attachments.map((att, idx) => `
             <div style="position: relative; border: 1px solid var(--border-color); border-radius: 8px; overflow: hidden; cursor: pointer; background: var(--bg-card);"
                  onclick="openImageModal(${JSON.stringify(attachments).replace(/"/g, '&quot;')}, ${idx})">
               <img src="${att.url || `${API_URL}/api/requests/attachment-file/${att.id}`}"
                    alt="${att.filename || 'Imagem'}"
                    style="width: 100%; height: 200px; object-fit: cover;">
               <div style="padding: 8px; background: var(--bg-input); color: var(--text-primary); font-size: 12px; text-align: center; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
                 ${att.filename || `Imagem ${idx + 1}`}
               </div>
             </div>
           `).join('')}
         </div>
       </div>`
    : '<p style="color: var(--text-secondary); font-style: italic;">Sem fotos anexadas</p>'

  const modal = document.createElement("div")
  modal.className = "modal"
  modal.id = "requestPreviewModal"
  modal.style.display = "block"
  modal.innerHTML = `
    <div class="modal-content">
      <div class="modal-header">
        <h2>Preview da Solicitação #${reqObj.id}</h2>
        <button class="modal-close" onclick="document.getElementById('requestPreviewModal').remove()">&times;</button>
      </div>
      <div class="modal-body">
        <div class="detail-grid">
          <div class="detail-item">
            <label>Cliente/Empresa:</label>
            <span>${reqObj.company_name || reqObj.client_username || "N/A"}</span>
          </div>
          <div class="detail-item">
            <label>Responsável:</label>
            <span>${reqObj.requester_name || reqObj.requester_username || "N/A"}</span>
          </div>
          <div class="detail-item">
            <label>Equipamento:</label>
            <span>${reqObj.application || "N/A"}</span>
          </div>
          <div class="detail-item">
            <label>Número de Série:</label>
            <span>${reqObj.serial_number || "N/A"}</span>
          </div>
          <div class="detail-item" style="grid-column: 1 / -1;">
            <label>Motivo do Chamado:</label>
            <span>${reqObj.call_reason || "N/A"}</span>
          </div>
          <div class="detail-item" style="grid-column: 1 / -1;">
            <label>Descrição do Problema:</label>
            <span>${reqObj.problem_description || reqObj.call_reason || "N/A"}</span>
          </div>
        </div>
        <hr style="margin: 20px 0; border: none; border-top: 1px solid var(--border-color);">
        ${imagesHtml}
      </div>
      <div class="modal-footer">
        <button class="btn-secondary" id="closePreviewBtn">Fechar</button>
        <button class="btn-primary" id="assignFromPreviewBtn">Atribuir Técnico</button>
      </div>
    </div>
  `
  document.body.appendChild(modal)

  // Event listeners para os botões
  document.getElementById("closePreviewBtn").addEventListener("click", () => {
    modal.remove()
  })
  document.getElementById("assignFromPreviewBtn").addEventListener("click", () => {
    modal.remove()
    openAssignModal(reqObj)
  })
}

// Função para abrir modal de visualização de imagens em tela cheia
function openImageModal(attachments, currentIndex) {
  const modal = document.createElement("div")
  modal.className = "modal"
  modal.id = "imageViewerModal"
  modal.style.display = "block"
  modal.style.zIndex = "10000"

  let currentIdx = currentIndex

  function updateImage() {
    const att = attachments[currentIdx]
    const imgUrl = att.url || `${API_URL}/api/requests/attachment-file/${att.id}`

    document.getElementById("modalImage").src = imgUrl
    document.getElementById("imageCounter").textContent = `${currentIdx + 1} / ${attachments.length}`
    document.getElementById("imageFilename").textContent = att.filename || `Imagem ${currentIdx + 1}`

    // Controles de navegação
    document.getElementById("prevImageBtn").disabled = currentIdx === 0
    document.getElementById("nextImageBtn").disabled = currentIdx === attachments.length - 1
  }

  modal.innerHTML = `
    <div class="modal-content" style="max-width: 90%; max-height: 90vh;">
      <div class="modal-header">
        <h2 id="imageFilename">Imagem</h2>
        <button class="modal-close" onclick="document.getElementById('imageViewerModal').remove()">&times;</button>
      </div>
      <div class="modal-body" style="text-align: center; padding: 20px;">
        <img id="modalImage"
             src=""
             alt="Imagem"
             style="max-width: 100%; max-height: 70vh; object-fit: contain; border-radius: 8px;">
        <div style="margin-top: 15px; display: flex; justify-content: center; align-items: center; gap: 15px;">
          <button id="prevImageBtn" class="btn-secondary" style="padding: 8px 16px;">
            ← Anterior
          </button>
          <span id="imageCounter" style="font-size: 14px; color: var(--text-secondary);">1 / 1</span>
          <button id="nextImageBtn" class="btn-secondary" style="padding: 8px 16px;">
            Próxima →
          </button>
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn-secondary" onclick="document.getElementById('imageViewerModal').remove()">Fechar</button>
        <button class="btn-primary" id="downloadImageBtn">Download</button>
      </div>
    </div>
  `

  document.body.appendChild(modal)
  updateImage()

  // Event listeners
  document.getElementById("prevImageBtn").addEventListener("click", () => {
    if (currentIdx > 0) {
      currentIdx--
      updateImage()
    }
  })

  document.getElementById("nextImageBtn").addEventListener("click", () => {
    if (currentIdx < attachments.length - 1) {
      currentIdx++
      updateImage()
    }
  })

  document.getElementById("downloadImageBtn").addEventListener("click", () => {
    const att = attachments[currentIdx]
    const imgUrl = att.url || `${API_URL}/api/requests/attachment-file/${att.id}`
    window.open(imgUrl, '_blank')
  })

  // Permite navegação com teclado
  const keyHandler = (e) => {
    if (e.key === 'ArrowLeft' && currentIdx > 0) {
      currentIdx--
      updateImage()
    } else if (e.key === 'ArrowRight' && currentIdx < attachments.length - 1) {
      currentIdx++
      updateImage()
    } else if (e.key === 'Escape') {
      modal.remove()
      document.removeEventListener('keydown', keyHandler)
    }
  }
  document.addEventListener('keydown', keyHandler)

  // Remove listener quando fechar modal
  const closeButtons = modal.querySelectorAll('.modal-close, .btn-secondary')
  closeButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      document.removeEventListener('keydown', keyHandler)
    })
  })
}

function openAssignModal(requestObj) {
  fetch(`${API_URL}/api/admin/technicians`)
    .then((res) => res.json())
    .then((techs) => {
      // Filtra Sistema NGMAN
      const filteredTechs = Array.isArray(techs) ? techs.filter(t => t.username !== 'Sistema NGMAN') : []
      const techOptions = filteredTechs.map((t) => `<option value="${t.id}">${t.username}</option>`).join("")
      const html = `
        <div class="modal" id="assignModal" style="display:block">
          <div class="modal-content">
            <div class="modal-header">
              <h2>Atribuir Técnico</h2>
              <button class="modal-close" onclick="document.getElementById('assignModal').remove()">&times;</button>
            </div>
            <div class="modal-body">
              <p>Selecione o técnico para a solicitação #${requestObj.id}:</p>
              <select id="assignTechSelect">
                <option value="">Selecione...</option>
                ${techOptions}
              </select>
            </div>
            <div class="modal-footer">
              <button class="btn-secondary" onclick="document.getElementById('assignModal').remove()">Cancelar</button>
              <button class="btn-primary" id="confirmAssignBtn">Atribuir</button>
            </div>
          </div>
        </div>
      `
      const temp = document.createElement("div")
      temp.innerHTML = html
      document.body.appendChild(temp.firstElementChild)
      const confirmBtn = document.getElementById("confirmAssignBtn")
      confirmBtn.addEventListener("click", () => {
        const select = document.getElementById("assignTechSelect")
        const techId = select ? select.value : ""
        if (!techId) {
          showToast("Selecione um técnico", "error")
          return
        }
        const isNewClient = requestObj.machine_pending ? true : false
        const payload = {
          client_name: requestObj.company_name || requestObj.client_username,
          company_name: requestObj.company_name || null,
          application: requestObj.application || null,
          machine_model: requestObj.application || null,
          machine_serial: requestObj.serial_number || null,
          maintenance_type: null,
          call_reason: requestObj.call_reason || null,
          // O responsável da OS deve ser o solicitante (usuário) que abriu o chamado
          requester: requestObj.requester_name || requestObj.requester_username || null,
          service_description: requestObj.problem_description || null,
          occurrence: requestObj.call_reason || null,
          cause: null,
          observations: null,
          technician_id: techId,
          is_new_client: isNewClient,
        }
        fetch(`${API_URL}/api/os`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        })
          .then((res) => {
            if (!res.ok)
              return res.json().then((d) => {
                throw new Error(d.message)
              })
            return res.json()
          })
          .then((osData) => {
            // Após criar a OS com sucesso, remove a solicitação original
            fetch(`${API_URL}/api/requests/${requestObj.id}`, {
              method: 'DELETE'
            }).catch(() => {})
            showToast(`O.S ${osData.order_number} criada e atribuída!`, "success")
            document.getElementById("assignModal").remove()
            // Recarrega listas
            loadRequestsSection()
            loadOSList()
          })
          .catch((err) => {
            console.error(err)
            showToast(err.message || "Erro ao criar OS", "error")
          })
      })
    })
    .catch((err) => {
      console.error(err)
      showToast("Erro ao buscar técnicos", "error")
    })
}

/* ==================== Criação manual de OS ==================== */

function openCreateOSModal() {
  Promise.all([
    fetch(`${API_URL}/api/admin/technicians`).then((res) => res.json()),
    fetch(`${API_URL}/api/companies`).then((res) => res.json()),
  ])
    .then(([techs, companies]) => {
      const techOptions = Array.isArray(techs)
        ? techs.map((t) => `<option value="${t.id}">${t.username}</option>`).join("")
        : ""
      const companyOptions = Array.isArray(companies)
        ? companies.map((c) => `<option value="${c.id}">${c.name}</option>`).join("")
        : ""
      const html = `
        <div class="modal" id="createOSModal" style="display:block">
          <div class="modal-content">
            <div class="modal-header">
              <h2>Criar Nova OS</h2>
              <button class="modal-close" onclick="document.getElementById('createOSModal').remove()">&times;</button>
            </div>
            <div class="modal-body">
              <div class="form-group">
                <label for="createOsCompanyInput">Empresa *</label>
                <input 
                  type="text" 
                  id="createOsCompanyInput" 
                  list="createOsCompanyList" 
                  placeholder="Digite para buscar empresa..."
                  required
                  autocomplete="off"
                >
                <datalist id="createOsCompanyList">
                  ${companyOptions.replace(/<option value="(\d+)">([^<]+)<\/option>/g, '<option value="$2" data-id="$1">$2</option>')}
                </datalist>
                <input type="hidden" id="createOsCompanySelect">
              </div>
              <div class="form-group">
                <label for="createOsMachineSelect">Máquina</label>
                <select id="createOsMachineSelect">
                  <option value="">-- selecione a empresa primeiro --</option>
                </select>
                <small class="form-hint">Pode deixar vazio se a máquina ainda não estiver cadastrada</small>
              </div>
              <div class="form-group">
                <label for="createOsTechSelect">Técnico *</label>
                <select id="createOsTechSelect" required>
                  <option value="">Selecione...</option>
                  ${techOptions}
                </select>
              </div>
              <div class="form-group">
                <label for="createOsMaintenanceType">Tipo de Manutenção *</label>
                <select id="createOsMaintenanceType" required>
                  <option value="">Selecione</option>
                  <option value="corretiva">Corretiva</option>
                  <option value="preventiva">Preventiva</option>
                  <option value="instalacao">Instalação</option>
                  <option value="entrega_tecnica">Entrega Técnica</option>
                </select>
              </div>
              <div class="form-group">
                <label for="createOsCallReason">Motivo do Chamado</label>
                <input type="text" id="createOsCallReason" placeholder="Motivo do chamado">
              </div>
              <div class="form-group">
                <label for="createOsObservations">Observações</label>
                <textarea id="createOsObservations" rows="2"></textarea>
              </div>
            </div>
            <div class="modal-footer">
              <button class="btn-secondary" onclick="document.getElementById('createOSModal').remove()">Cancelar</button>
              <button class="btn-primary" id="confirmCreateOsBtn">Criar OS</button>
            </div>
          </div>
        </div>
      `
      const temp = document.createElement("div")
      temp.innerHTML = html
      document.body.appendChild(temp.firstElementChild)
      
      // Elementos do formulário
      const companyInput = document.getElementById("createOsCompanyInput")
      const companyHidden = document.getElementById("createOsCompanySelect")
      const machineSelect = document.getElementById("createOsMachineSelect")

      // Busca company_id quando usuário seleciona uma empresa
      if (companyInput) {
        companyInput.addEventListener("input", (e) => {
          const companyName = e.target.value.trim()

          // Busca o company_id baseado no nome selecionado
          const company = companies.find(c => c.name === companyName)
          
          if (company) {
            companyHidden.value = company.id
            
            // Carrega máquinas da empresa
            machineSelect.innerHTML = '<option value="">Carregando...</option>'
            fetch(`${API_URL}/api/machines?company_id=${company.id}`)
              .then((res) => res.json())
              .then((machines) => {
                machineSelect.innerHTML = '<option value="">Nenhuma máquina</option>'
                if (Array.isArray(machines) && machines.length > 0) {
                  const opts = machines
                    .map(
                      (m) =>
                        `<option value="${m.serial_number}">${m.model || ""} (${m.serial_number || ""})</option>`
                    )
                    .join("")
                  machineSelect.innerHTML = '<option value="">Selecione...</option>' + opts
                }
              })
              .catch((err) => {
                console.error(err)
                machineSelect.innerHTML = '<option value="">Erro ao carregar máquinas</option>'
              })
          } else {
            companyHidden.value = ""
            machineSelect.innerHTML = '<option value="">-- selecione a empresa primeiro --</option>'
          }
        })
      }
      const confirmBtn = document.getElementById("confirmCreateOsBtn")
      if (confirmBtn) {
        confirmBtn.addEventListener("click", () => {
          const companyName = companyInput.value.trim()
          const machineSerial = machineSelect.value || null
          const techId = document.getElementById("createOsTechSelect").value
          const maintenanceType = document.getElementById("createOsMaintenanceType").value || null
          const callReason = document.getElementById("createOsCallReason").value || null
          const observations = document.getElementById("createOsObservations").value || null
          if (!companyName || !techId || !maintenanceType) {
            showToast("Empresa, técnico e tipo de manutenção são obrigatórios", "error")
            return
          }
          const payload = {
            client_name: companyName,
            company_name: companyName,
            machine_serial: machineSerial,
            maintenance_type: maintenanceType,
            call_reason: callReason,
            observations: observations,
            technician_id: techId,
          }
          fetch(`${API_URL}/api/os`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          })
            .then((res) => {
              if (!res.ok)
                return res.json().then((d) => {
                  throw new Error(d.message)
                })
              return res.json()
            })
            .then((osData) => {
              showToast(`O.S ${osData.order_number} criada com sucesso!`, "success")
              document.getElementById("createOSModal").remove()
              loadOSList()
            })
            .catch((err) => {
              console.error(err)
              showToast(err.message || "Erro ao criar OS", "error")
            })
        })
      }
    })
    .catch((err) => {
      console.error(err)
      showToast("Erro ao carregar dados para criar OS", "error")
    })
}

/**
 * Lista veículos no painel.
 */
function loadVehiclesList() {
  const list = document.getElementById("vehiclesList")
  if (!list) return
  fetch(`${API_URL}/api/vehicles`)
    .then((res) => res.json())
    .then((vehicles) => {
      if (!Array.isArray(vehicles) || vehicles.length === 0) {
        list.innerHTML = '<p class="empty-state">Nenhum veículo cadastrado</p>'
        return
      }
      list.innerHTML = vehicles
        .map((v) => {
          const vehicleName = v.name ? escapeHtml(v.name) : ''
          const displayName = vehicleName ? `${vehicleName} - ` : ''
          return `
            <div class="card" id="vehicle-card-${v.id}">
              <div class="card-header" style="display: flex; justify-content: space-between; align-items: center;">
                <div>
                  <h3>${escapeHtml(v.plate)}</h3>
                  ${vehicleName ? `<p style="margin: 0.25rem 0 0 0; font-size: 0.9rem; color: var(--text-secondary);">${vehicleName}</p>` : ''}
                </div>
                <div style="display: flex; gap: 0.5rem;">
                  <button class="btn-icon" onclick="editVehicle(${v.id}, '${escapeHtml(v.plate)}', '${vehicleName}')" title="Editar veículo">
                    <svg width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
                      <path d="M12.146.146a.5.5 0 0 1 .708 0l3 3a.5.5 0 0 1 0 .708l-10 10a.5.5 0 0 1-.168.11l-5 2a.5.5 0 0 1-.65-.65l2-5a.5.5 0 0 1 .11-.168l10-10zM11.207 2.5 13.5 4.793 14.793 3.5 12.5 1.207 11.207 2.5zm1.586 3L10.5 3.207 4 9.707V10h.5a.5.5 0 0 1 .5.5v.5h.5a.5.5 0 0 1 .5.5v.5h.293l6.5-6.5zm-9.761 5.175-.106.106-1.528 3.821 3.821-1.528.106-.106A.5.5 0 0 1 5 12.5V12h-.5a.5.5 0 0 1-.5-.5V11h-.5a.5.5 0 0 1-.468-.325z"/>
                    </svg>
                  </button>
                  <button class="btn-icon btn-danger" onclick="deleteVehicle(${v.id}, '${escapeHtml(v.plate)}')" title="Excluir veículo">
                    <svg width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
                      <path d="M5.5 5.5A.5.5 0 0 1 6 6v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5Zm2.5 0a.5.5 0 0 1 .5.5v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5Zm3 .5a.5.5 0 0 0-1 0v6a.5.5 0 0 0 1 0V6Z"/>
                      <path d="M14.5 3a1 1 0 0 1-1 1H13v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V4h-.5a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1H6a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1h3.5a1 1 0 0 1 1 1v1ZM4.118 4 4 4.059V13a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V4.059L11.882 4H4.118ZM2.5 3h11V2h-11v1Z"/>
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          `
        })
        .join("")
    })
    .catch((err) => {
      console.error(err)
      list.innerHTML = '<p class="empty-state">Erro ao carregar veículos</p>'
    })
}

function editVehicle(vehicleId, currentPlate, currentName) {
  // Cria modal inline
  const modalHTML = `
    <div class="modal active" id="editVehicleModal" style="display: block;">
      <div class="modal-content">
        <div class="modal-header">
          <h2>Editar Veículo</h2>
          <button class="modal-close" onclick="closeEditVehicleModal()">&times;</button>
        </div>
        <div class="modal-body">
          <div class="form-group">
            <label for="editVehiclePlate">Placa *</label>
            <input type="text" id="editVehiclePlate" value="${currentPlate}" required style="text-transform: uppercase; width: 100%; padding: 0.5rem; background: var(--bg-input); border: 1px solid var(--border-color); border-radius: 6px; color: var(--text-primary);">
          </div>
          <div class="form-group">
            <label for="editVehicleName">Nome do Veículo (Opcional)</label>
            <input type="text" id="editVehicleName" value="${currentName || ''}" placeholder="Ex: Fiorino Branca, Uno Prata" style="width: 100%; padding: 0.5rem; background: var(--bg-input); border: 1px solid var(--border-color); border-radius: 6px; color: var(--text-primary);">
            <small style="color: var(--text-secondary); font-size: 0.85rem;">
              Este nome ajuda o técnico a identificar o veículo. No PDF continua aparecendo apenas a placa.
            </small>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn-secondary" onclick="closeEditVehicleModal()">Cancelar</button>
          <button class="btn-primary" onclick="saveVehicleChanges(${vehicleId})">Salvar</button>
        </div>
      </div>
    </div>
  `

  // Remove modal existente se houver
  const existing = document.getElementById('editVehicleModal')
  if (existing) existing.remove()

  // Adiciona modal
  document.body.insertAdjacentHTML('beforeend', modalHTML)
}

function closeEditVehicleModal() {
  const modal = document.getElementById('editVehicleModal')
  if (modal) modal.remove()
}

function saveVehicleChanges(vehicleId) {
  const plateInput = document.getElementById('editVehiclePlate')
  const nameInput = document.getElementById('editVehicleName')

  const plate = plateInput ? plateInput.value.trim().toUpperCase() : ''
  const name = nameInput ? nameInput.value.trim() : ''

  if (!plate) {
    showToast("Placa não pode ser vazia", "error")
    return
  }

  fetch(`${API_URL}/api/vehicles/${vehicleId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ plate, name: name || null }),
  })
    .then((res) => {
      if (!res.ok)
        return res.json().then((d) => {
          throw new Error(d.message)
        })
      return res.json()
    })
    .then(() => {
      showToast("Veículo atualizado com sucesso!", "success")
      closeEditVehicleModal()
      loadVehiclesList()
    })
    .catch((err) => {
      console.error(err)
      showToast(err.message || "Erro ao atualizar veículo", "error")
    })
}

function deleteVehicle(vehicleId, plate) {
  if (!confirm(`ATENÇÃO!\n\nDeseja realmente excluir o veículo com placa "${plate}"?\n\nEsta ação NÃO pode ser desfeita!`)) {
    return
  }
  
  fetch(`${API_URL}/api/vehicles/${vehicleId}`, {
    method: "DELETE",
  })
    .then((res) => {
      if (!res.ok)
        return res.json().then((d) => {
          throw new Error(d.message)
        })
      return res.json()
    })
    .then((data) => {
      showToast(data.message || "Veículo excluído com sucesso!", "success")
      loadVehiclesList()
    })
    .catch((err) => {
      console.error(err)
      showToast(err.message || "Erro ao excluir veículo", "error")
    })
}

/**
 * Cadastra novo veículo (placa e nome opcional).
 */
function handleVehicleForm(e) {
  e.preventDefault()
  const plateEl = document.getElementById("vehiclePlate")
  const nameEl = document.getElementById("vehicleName")
  const plate = plateEl ? plateEl.value.trim().toUpperCase() : ""
  const name = nameEl ? nameEl.value.trim() : ""

  if (!plate) {
    showToast("Informe a placa do veículo", "error")
    return
  }

  fetch(`${API_URL}/api/vehicles`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ plate, name: name || null }),
  })
    .then((res) => res.json().then((data) => ({ ok: res.ok, data })))
    .then(({ ok, data }) => {
      if (!ok) {
        showToast(data.message || "Erro ao cadastrar veículo", "error")
        return
      }
      showToast("Veículo cadastrado com sucesso!", "success")
      if (plateEl) plateEl.value = ""
      if (nameEl) nameEl.value = ""
      loadVehiclesList()
    })
    .catch((err) => {
      console.error(err)
      showToast("Erro ao cadastrar veículo", "error")
    })
}

/* ==================== Programação Semanal ==================== */

/**
 * Exibe detalhes da OS ao clicar na célula da programação
 * Só mostra modal de OS se já foi aceita. Se ainda estiver assigned, mostra modal de agendar
 */
async function showScheduleOSDetails(osId, status) {
  if (!osId) return

  try {
    const res = await fetch(`${API_URL}/api/os/${osId}`)
    const os = await res.json()

    if (!os || !os.id) {
      showToast('OS não encontrada', 'error')
      return
    }

    // Mapeia status para texto legível
    let statusText = 'Desconhecido'
    let statusColor = '#gray'
    
    switch(os.status) {
      case 'assigned':
        statusText = 'Aguardando Aceite do Técnico'
        statusColor = '#f59e0b'
        break
      case 'accepted':
        statusText = 'Aceito pelo Técnico'
        statusColor = '#3b82f6'
        break
      case 'in_progress':
        statusText = 'Em Andamento'
        statusColor = '#3b82f6'
        break
      case 'finished':
        statusText = 'Concluído'
        statusColor = '#10b981'
        break
    }
    
    // Cria tooltip/modal compacto
    const existingTooltip = document.getElementById('scheduleTooltip')
    if (existingTooltip) existingTooltip.remove()
    
    const tooltip = document.createElement('div')
    tooltip.id = 'scheduleTooltip'
    tooltip.className = 'schedule-tooltip'
    tooltip.innerHTML = `
      <div class="schedule-tooltip-header">
        <h3>O.S ${os.order_number}</h3>
        <button onclick="closeScheduleTooltip()">&times;</button>
      </div>
      <div class="schedule-tooltip-body">
        <div class="tooltip-field">
          <label>Status:</label>
          <span style="color: ${statusColor}; font-weight: 600;">${statusText}</span>
        </div>
        <div class="tooltip-field">
          <label>Empresa/Cliente:</label>
          <span>${os.client_name || os.company_name || '-'}</span>
        </div>
        <div class="tooltip-field">
          <label>Técnico:</label>
          <span>${os.technician_username || '-'}</span>
        </div>
        <div class="tooltip-field">
          <label>Máquina:</label>
          <span>${os.machine_serial || '-'} ${os.machine_model ? '(' + os.machine_model + ')' : ''}</span>
        </div>
        <div class="tooltip-field">
          <label>Data Programada:</label>
          <span>${os.scheduled_date ? new Date(os.scheduled_date).toLocaleString('pt-BR') : '-'}</span>
        </div>
        ${os.call_reason ? `
          <div class="tooltip-field">
            <label>Motivo:</label>
            <span>${os.call_reason}</span>
          </div>
        ` : ''}
      </div>
      <div class="schedule-tooltip-footer">
        <button class="btn-secondary" onclick="closeScheduleTooltip()">Fechar</button>
        ${os.status === 'assigned' && !os.accepted_at ? `
          <button class="btn-warning" onclick="revertOSToPending(${os.id})" title="Reverter para solicitação">${SVGIcons.arrowLeft} Reverter</button>
          <button class="btn-danger" onclick="removePendingOS(${os.id})" title="Excluir definitivamente">${SVGIcons.trash} Remover</button>
        ` : ''}
        <button class="btn-success" onclick="addScheduleToSamePeriod(${os.id}, ${os.technician_id}, '${os.scheduled_date}'); closeScheduleTooltip()" title="Adicionar outro agendamento no mesmo período">${SVGIcons.plus} Adicionar Agendamento</button>
        <button class="btn-primary" onclick="viewOSDetails(${os.id}); closeScheduleTooltip()">Ver Detalhes Completos</button>
      </div>
    `
    
    document.body.appendChild(tooltip)
    
    // Posiciona o tooltip no centro da tela
    setTimeout(() => {
      tooltip.classList.add('active')
    }, 10)
    
  } catch (err) {
    console.error(err)
    showToast('Erro ao carregar detalhes da OS', 'error')
  }
}

/**
 * Fecha o tooltip de detalhes da programação
 */
function closeScheduleTooltip() {
  const tooltip = document.getElementById('scheduleTooltip')
  if (tooltip) {
    tooltip.classList.remove('active')
    setTimeout(() => tooltip.remove(), 300)
  }
}

/**
 * Adiciona um novo agendamento no mesmo período de uma OS existente
 */
async function addScheduleToSamePeriod(osId, technicianId, scheduledDate) {
  try {
    // Busca informações do técnico
    const techRes = await fetch(`${API_URL}/api/technicians`)
    const technicians = await techRes.json()
    const tech = technicians.find(t => t.id === technicianId)

    if (!tech) {
      showToast('Técnico não encontrado', 'error')
      return
    }

    // Extrai a data e determina o período (manhã ou tarde)
    const osDate = new Date(scheduledDate)
    const hour = osDate.getHours()
    const period = hour < 12 ? 'morning' : 'afternoon'

    // Formata a data para o formato esperado (YYYY-MM-DD)
    const dateStr = osDate.toISOString().split('T')[0]

    // Abre o modal de agendamento com os mesmos parâmetros
    openScheduleAssignModal(tech, dateStr, period)

  } catch (err) {
    console.error('Erro ao adicionar agendamento:', err)
    showToast('Erro ao abrir modal de agendamento', 'error')
  }
}

// Calcula a data da segunda-feira (Monday) da semana de uma data
function getMonday(d) {
  const date = new Date(d)
  const day = date.getDay()
  // 0 = domingo → precisamos voltar 6 dias para chegar à segunda
  const diff = (day === 0 ? -6 : 1) - day
  date.setDate(date.getDate() + diff)
  date.setHours(0, 0, 0, 0)
  return date
}

// Retorna array de 5 datas (segunda a sexta) da semana
function getWeekDates(startDate) {
  const dates = []
  for (let i = 0; i < 5; i++) {
    const d = new Date(startDate)
    d.setDate(startDate.getDate() + i)
    dates.push(d)
  }
  return dates
}

// Formata data como 'Seg 27/10'
function formatDay(date) {
  const dias = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']
  const dayName = dias[date.getDay()]
  const dd = String(date.getDate()).padStart(2, '0')
  const mm = String(date.getMonth() + 1).padStart(2, '0')
  return `${dayName} ${dd}/${mm}`
}

/**
 * Retorna a cor de fundo baseada no status da OS
 */
function getStatusColor(status) {
  const colors = {
    'assigned': '#f59e0b',    // Laranja - Atribuída
    'accepted': '#2563eb',    // Azul - Aceita
    'in_progress': '#8b5cf6', // Roxo - Em progresso
    'finished': '#10b981',    // Verde - Finalizada
    'pending': '#6b7280'      // Cinza - Pendente
  }
  return colors[status] || colors['pending']
}

// Renderiza a tabela de programação semanal com suporte a múltiplas OS por slot
function renderScheduleTable(weekDates, technicians, osList, notes = []) {
  const container = document.getElementById('scheduleContainer')
  if (!container) return

  // DEBUG: Log para verificar OS recebidas
  console.log('📊 renderScheduleTable - Total de OS recebidas:', osList.length)

  // Organiza OS por tecnico->data->slot como ARRAY (múltiplas OS por slot)
  const assignments = {}
  osList.forEach((os) => {
    const techId = os.technician_id
    if (!techId) return
    const sched = os.scheduled_date
    if (!sched) return

    const dt = new Date(sched)
    const dayKey = dt.toISOString().split('T')[0]

    // NOVO: USA O CAMPO period DIRETO DO BANCO - NÃO CALCULA PELA HORA
    const slot = os.period || 'morning'

    console.log(`📌 O.S ${os.id} - Técnico: ${techId}, Data: ${dayKey}, Período: ${slot} (do banco), Status: ${os.status}, Client: ${os.client_name}`)

    // Verifica se é uma OS de dia completo (marcada nas observações)
    const isFullDay = os.observations && os.observations.includes('[Sistema] Serviço programado para dia completo')

    if (!assignments[techId]) assignments[techId] = {}
    if (!assignments[techId][dayKey]) assignments[techId][dayKey] = {}
    if (!assignments[techId][dayKey][slot]) assignments[techId][dayKey][slot] = []
    assignments[techId][dayKey][slot].push(os)

    // Se for dia completo E estiver na manhã, adiciona também na tarde
    if (isFullDay && slot === 'morning') {
      if (!assignments[techId][dayKey]['afternoon']) assignments[techId][dayKey]['afternoon'] = []
      // Adiciona uma cópia com marcador de continuação
      const afternoonCopy = { ...os, _isContinuation: true }
      assignments[techId][dayKey]['afternoon'].push(afternoonCopy)
      console.log(`📌 O.S ${os.id} - Adicionada também na TARDE (dia completo)`)
    }
  })
  
  // Organiza notas por técnico->data->slot
  const notesBySlot = {}
  notes.forEach((note) => {
    const techId = note.technician_id
    if (!techId) return
    const dayKey = note.scheduled_date
    const slot = note.period
    if (!notesBySlot[techId]) notesBySlot[techId] = {}
    if (!notesBySlot[techId][dayKey]) notesBySlot[techId][dayKey] = {}
    if (!notesBySlot[techId][dayKey][slot]) notesBySlot[techId][dayKey][slot] = []
    notesBySlot[techId][dayKey][slot].push(note)
  })

  // DEBUG: Log datas da semana sendo renderizadas
  console.log('📅 Semana sendo renderizada:', weekDates.map(d => d.toISOString().split('T')[0]))

  // Monta HTML da tabela
  let html = '<table class="schedule-table"><thead><tr>'
  html += '<th>Técnico</th><th>Horário</th>'
  weekDates.forEach((d) => {
    html += `<th>${formatDay(d)}</th>`
  })
  html += '</tr></thead><tbody>'
  technicians.forEach((tech) => {
    // linha da manhã
    html += '<tr>'
    html += `<td rowspan="2">${tech.username}</td>`
    html += '<td>Manhã</td>'
    weekDates.forEach((d) => {
      const dayKey = d.toISOString().split('T')[0]
      const osList = assignments[tech.id]?.[dayKey]?.['morning'] || []
      const notesList = notesBySlot[tech.id]?.[dayKey]?.['morning'] || []

      // DEBUG: Log DETALHADO de busca por OS
      console.log(`🔍 MANHÃ - Técnico: ${tech.username} (ID:${tech.id}), Data: ${dayKey}`)
      console.log(`   - Tem assignments para este técnico?`, assignments[tech.id] ? 'SIM' : 'NÃO')
      if (assignments[tech.id]) {
        console.log(`   - Tem OS para esta data?`, assignments[tech.id][dayKey] ? 'SIM' : 'NÃO')
        if (assignments[tech.id][dayKey]) {
          console.log(`   - Chaves disponíveis:`, Object.keys(assignments[tech.id][dayKey]))
        }
      }
      if (osList.length > 0) {
        console.log(`   ✅ ${osList.length} OS encontrada(s)!`, osList.map(os => `#${os.id} - ${os.client_name} (${os.status})`))
      } else {
        console.log(`   ❌ Nenhuma OS`)
      }

      let cellContent = ''
      let cellClass = ''

      if (osList.length > 0 || notesList.length > 0) {
        // Tem OS ou notas - NÃO aplica classe de status na célula quando há múltiplas OS
        cellClass = osList.length > 0 ? 'has-os' : 'has-note'
        cellContent = ''

        // Renderiza OS (múltiplas se houver) - cada uma com sua própria cor
        osList.forEach((os, idx) => {
          const sep = idx > 0 ? '<br>' : ''
          // Usa company_name (do JOIN) como fallback se client_name estiver vazio
          const displayName = os.client_name || os.company_name || 'N/A'
          const osStatus = os.status || 'assigned'
          // Define cor de fundo baseado no status individual da OS
          const bgColor = getStatusColor(osStatus)
          // Remove onclick do span - será adicionado dinamicamente pelo enableDragMode/disableDragMode
          // pointer-events:none permite que o drop passe através do span para a célula
          cellContent += `${sep}<span data-os-id="${os.id}" data-os-status="${osStatus}" style="display:inline-block;width:100%;padding:0.25rem;background-color:${bgColor};border-radius:0.25rem;pointer-events:auto;" title="${displayName}">${displayName}</span>`
        })
        
        // Renderiza notas
        notesList.forEach((note, idx) => {
          const sep = (osList.length > 0 || idx > 0) ? '<br>' : ''
          cellContent += `${sep}<span style="font-style:italic;color:#666;font-size:0.85rem;">${SVGIcons.note} ${note.note_text}</span>`
        })
        
        // Sempre permite clicar para adicionar mais OS/solicitações
        html += `<td class="schedule-cell ${cellClass}" data-tech="${tech.id}" data-date="${dayKey}" data-slot="morning" style="cursor:pointer;">${cellContent}</td>`
      } else {
        // Vazio - clicável
        cellClass = 'empty'
        html += `<td class="schedule-cell ${cellClass}" data-tech="${tech.id}" data-date="${dayKey}" data-slot="morning"></td>`
      }
    })
    html += '</tr>'
    // linha da tarde
    html += '<tr>'
    html += '<td>Tarde</td>'
    weekDates.forEach((d) => {
      const dayKey = d.toISOString().split('T')[0]
      const osList = assignments[tech.id]?.[dayKey]?.['afternoon'] || []
      const notesList = notesBySlot[tech.id]?.[dayKey]?.['afternoon'] || []
      let cellContent2 = ''
      let cellClass2 = ''
      
      if (osList.length > 0 || notesList.length > 0) {
        cellClass2 = osList.length > 0 ? 'has-os' : 'has-note'
        cellContent2 = ''

        // Renderiza OS (múltiplas se houver) - cada uma com sua própria cor
        osList.forEach((os, idx) => {
          const sep = idx > 0 ? '<br>' : ''
          // Usa company_name (do JOIN) como fallback se client_name estiver vazio
          const displayName = os.client_name || os.company_name || 'N/A'
          const osStatus = os.status || 'assigned'
          const bgColor = getStatusColor(osStatus)

          // Se for continuação (dia completo), mostra com estilo diferente
          // Remove onclick do span - será adicionado dinamicamente pelo enableDragMode/disableDragMode
          // pointer-events:auto garante que spans possam receber cliques quando não em drag mode
          if (os._isContinuation) {
            cellContent2 += `${sep}<span data-os-id="${os.id}" data-os-status="${osStatus}" style="display:inline-block;width:100%;padding:0.25rem;opacity:0.8;background-color:${bgColor};border-radius:0.25rem;pointer-events:auto;" title="${displayName} (continuação da manhã)"><small style="color:#666;">↑ continuação</small><br>${displayName}</span>`
          } else {
            cellContent2 += `${sep}<span data-os-id="${os.id}" data-os-status="${osStatus}" style="display:inline-block;width:100%;padding:0.25rem;background-color:${bgColor};border-radius:0.25rem;pointer-events:auto;" title="${displayName}">${displayName}</span>`
          }
        })
        
        // Renderiza notas
        notesList.forEach((note, idx) => {
          const sep = (osList.length > 0 || idx > 0) ? '<br>' : ''
          cellContent2 += `${sep}<span style="font-style:italic;color:#666;font-size:0.85rem;">${SVGIcons.note} ${note.note_text}</span>`
        })
        
        // Sempre permite clicar para adicionar mais OS/solicitações
        html += `<td class="schedule-cell ${cellClass2}" data-tech="${tech.id}" data-date="${dayKey}" data-slot="afternoon" style="cursor:pointer;">${cellContent2}</td>`
      } else {
        cellClass2 = 'empty'
        html += `<td class="schedule-cell ${cellClass2}" data-tech="${tech.id}" data-date="${dayKey}" data-slot="afternoon"></td>`
      }
    })
    html += '</tr>'
  })
  html += '</tbody></table>'
  container.innerHTML = html

  // Adiciona event listeners para células vazias, com notas E com OS (para permitir múltiplas atribuições)
  container.querySelectorAll('.schedule-cell.empty, .schedule-cell.has-note, .schedule-cell.has-os').forEach(cell => {
    const techId = cell.getAttribute('data-tech')
    const dateStr = cell.getAttribute('data-date')
    const slot = cell.getAttribute('data-slot')
    const tech = technicians.find((t) => String(t.id) === String(techId))

    if (tech) {
      cell.addEventListener('click', (e) => {
        // Se clicou em um span de OS (para drag), não abre modal
        if (e.target.closest('[data-os-id]')) return

        // Não abrir modal se drag mode estiver ativo
        if (!window.dragModeActive) {
          console.log('🖱️ Célula clicada:', { tech: tech.username, dateStr, slot })
          openScheduleAssignModal(tech, dateStr, slot)
        }
      })
    }
  })

  // Reaplica drag & drop se modo estiver ativo
  if (window.dragModeActive) {
    setTimeout(() => {
      enableDragAndDrop()
    }, 100)
  }

  // Adiciona funcionalidade de redimensionamento de OSs
  enableOSResize()
}

// Função para habilitar redimensionamento de OSs no calendário
function enableOSResize() {
  const osSpans = document.querySelectorAll('.schedule-cell.status-assigned span[data-os-id], .schedule-cell.status-accepted span[data-os-id], .schedule-cell.status-in_progress span[data-os-id]')

  osSpans.forEach(span => {
    const currentCell = span.closest('.schedule-cell')
    const currentSlot = currentCell?.getAttribute('data-slot')

    // Verifica se é uma continuação (tarde)
    const isContinuation = span.innerHTML.includes('↑ continuação')

    // Se for tarde E NÃO for continuação, não adiciona handle
    if (currentSlot === 'afternoon' && !isContinuation) return

    // Adiciona indicador visual de que pode ser arrastado
    span.style.position = 'relative'
    span.style.paddingBottom = '8px'

    // Cria handle de arrasto (barra na parte inferior para manhã, superior para tarde)
    const dragHandle = document.createElement('div')
    dragHandle.className = 'os-drag-handle'

    // Se for continuação (tarde), coloca handle no topo
    const handlePosition = isContinuation ? 'top' : 'bottom'
    const handleColor = isContinuation ? 'rgba(239, 68, 68, 0.3)' : 'rgba(59, 130, 246, 0.3)'
    const handleColorHover = isContinuation ? 'rgba(239, 68, 68, 0.7)' : 'rgba(59, 130, 246, 0.7)'

    dragHandle.style.cssText = `
      position: absolute;
      ${handlePosition}: 2px;
      left: 50%;
      transform: translateX(-50%);
      width: 30px;
      height: 4px;
      background: ${handleColor};
      border-radius: 2px;
      cursor: grab;
      transition: background 0.2s;
    `

    dragHandle.addEventListener('mouseenter', () => {
      dragHandle.style.background = handleColorHover
      dragHandle.style.height = '5px'
    })

    dragHandle.addEventListener('mouseleave', () => {
      dragHandle.style.background = handleColor
      dragHandle.style.height = '4px'
    })

    // Implementa arrasto
    let isDragging = false
    let ghostElement = null
    let targetCell = null
    let allCells = []

    dragHandle.addEventListener('mousedown', (e) => {
      e.preventDefault()
      e.stopPropagation()

      isDragging = true
      dragHandle.style.cursor = 'grabbing'
      document.body.style.userSelect = 'none'

      const osId = span.getAttribute('data-os-id')
      const osStatus = span.getAttribute('data-os-status')
      const techId = currentCell.getAttribute('data-tech')
      const dateStr = currentCell.getAttribute('data-date')

      // NOVO: Armazena todas as células da tabela como possíveis alvos
      allCells = Array.from(document.querySelectorAll('.schedule-cell'))

      // Cria elemento fantasma
      ghostElement = document.createElement('div')
      ghostElement.style.cssText = `
        position: fixed;
        background: rgba(59, 130, 246, 0.2);
        border: 2px dashed #3b82f6;
        border-radius: 6px;
        padding: 0.5rem;
        font-size: 0.9rem;
        pointer-events: none;
        z-index: 10000;
        color: #1e40af;
        font-weight: 500;
        min-width: 150px;
        text-align: center;
      `
      ghostElement.textContent = span.textContent.replace('↑ continuação', '').trim()
      document.body.appendChild(ghostElement)

      // Store data no ghostElement para usar no mouseup
      ghostElement.dataset.osId = osId
      ghostElement.dataset.osStatus = osStatus
      ghostElement.dataset.originalTechId = techId
      ghostElement.dataset.originalDateStr = dateStr
      ghostElement.dataset.isContinuation = isContinuation
    })

    document.addEventListener('mousemove', (e) => {
      if (!isDragging || !ghostElement) return

      // Posiciona elemento fantasma
      ghostElement.style.left = (e.clientX + 10) + 'px'
      ghostElement.style.top = (e.clientY + 10) + 'px'

      // NOVO: Detecta qual célula está sob o cursor
      const hoveredElement = document.elementFromPoint(e.clientX, e.clientY)
      const hoveredCell = hoveredElement?.closest('.schedule-cell')

      // Remove highlight anterior
      if (targetCell && targetCell !== hoveredCell) {
        targetCell.style.background = ''
        targetCell.style.border = ''
      }

      // Atualiza targetCell e adiciona highlight
      targetCell = hoveredCell

      if (targetCell) {
        targetCell.style.background = 'rgba(34, 197, 94, 0.2)'
        targetCell.style.border = '2px solid #22c55e'
        ghostElement.style.borderColor = '#22c55e'
        ghostElement.style.background = 'rgba(34, 197, 94, 0.2)'
      } else {
        ghostElement.style.borderColor = '#3b82f6'
        ghostElement.style.background = 'rgba(59, 130, 246, 0.2)'
      }
    })

    document.addEventListener('mouseup', async () => {
      if (!isDragging) return

      isDragging = false
      dragHandle.style.cursor = 'grab'
      document.body.style.userSelect = ''

      // Remove highlights de todas as células
      allCells.forEach(cell => {
        cell.style.background = ''
        cell.style.border = ''
      })

      // Remove elemento fantasma
      if (ghostElement) {
        const osId = ghostElement.dataset.osId
        const originalTechId = ghostElement.dataset.originalTechId
        const originalDateStr = ghostElement.dataset.originalDateStr
        const wasContinuation = ghostElement.dataset.isContinuation === 'true'

        ghostElement.remove()
        ghostElement = null

        // NOVO: Verifica se soltou em uma célula válida
        if (targetCell && osId) {
          const newTechId = targetCell.getAttribute('data-tech')
          const newDateStr = targetCell.getAttribute('data-date')
          const newSlot = targetCell.getAttribute('data-slot')

          // Verifica se mudou de posição
          const positionChanged = (originalTechId !== newTechId || originalDateStr !== newDateStr)
          const samePositionDifferentSlot = (originalTechId === newTechId && originalDateStr === newDateStr)

          try {
            // Busca OS
            const osRes = await fetch(`${API_URL}/api/os/${osId}`)
            if (!osRes.ok) throw new Error('OS não encontrada')
            const os = await osRes.json()

            // CASO 1: Arrastou para DIFERENTE técnico/dia - move a OS
            if (positionChanged) {
              // Remove continuação se houver
              let newObservations = (os.observations || '').replace(/\n?\[Sistema\] Serviço programado para dia completo \(manhã \+ tarde\)/g, '').trim()

              // Monta nova data/hora baseado no slot alvo
              const [year, month, day] = newDateStr.split('-').map(Number)
              const targetHour = newSlot === 'morning' ? 9 : 14
              const localDate = new Date(year, month - 1, day, targetHour, 0, 0, 0)
              const scheduledISO = formatDateToLocalISO(localDate)

              // Busca nome do técnico para mostrar na mensagem
              const tech = technicians.find(t => String(t.id) === String(newTechId))
              const techName = tech ? tech.name : 'Técnico'

              const updateRes = await fetch(`${API_URL}/api/os/${osId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  technician_id: Number(newTechId),
                  scheduled_date: scheduledISO,
                  observations: newObservations,
                  period: newSlot  // NOVO: atualiza o período explicitamente
                })
              })

              if (!updateRes.ok) throw new Error('Erro ao mover OS')

              const periodText = newSlot === 'morning' ? 'manhã' : 'tarde'
              showToast(`✓ ${os.client_name || os.company_name} movido para ${techName} - ${newDateStr} (${periodText})`, 'success')
              loadSchedule()

            // CASO 2: Mesmo técnico/dia - toggle dia completo (manhã/tarde)
            } else if (samePositionDifferentSlot) {
              if (wasContinuation) {
                // DESFAZER: Remover marcação de dia completo
                const newObservations = (os.observations || '').replace(/\n?\[Sistema\] Serviço programado para dia completo \(manhã \+ tarde\)/g, '').trim()

                const updateRes = await fetch(`${API_URL}/api/os/${osId}`, {
                  method: 'PATCH',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    observations: newObservations
                  })
                })

                if (!updateRes.ok) throw new Error('Erro ao atualizar OS')
                showToast(`✓ ${os.client_name || os.company_name} - Voltou para apenas manhã!`, 'success')
                loadSchedule()

              } else {
                // FAZER: Adicionar marcação de dia completo
                const updateRes = await fetch(`${API_URL}/api/os/${osId}`, {
                  method: 'PATCH',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    observations: (os.observations || '') + '\n[Sistema] Serviço programado para dia completo (manhã + tarde)'
                  })
                })

                if (!updateRes.ok) throw new Error('Erro ao atualizar OS')
                showToast(`✓ ${os.client_name || os.company_name} - Dia completo programado!`, 'success')
                loadSchedule()
              }
            }

          } catch (err) {
            console.error('Erro ao processar OS:', err)
            showToast(err.message || 'Erro ao processar OS', 'error')
          }
        }
      }

      // Limpa referências
      targetCell = null
      allCells = []
    })

    span.appendChild(dragHandle)
  })
}

// Helper: encontra a célula da tarde correspondente
function findAfternoonCell(techId, dateStr) {
  const cells = document.querySelectorAll('.schedule-cell')
  for (const cell of cells) {
    if (cell.getAttribute('data-tech') === techId &&
        cell.getAttribute('data-date') === dateStr &&
        cell.getAttribute('data-slot') === 'afternoon') {
      return cell
    }
  }
  return null
}

// Helper: encontra a célula da manhã correspondente
function findMorningCell(techId, dateStr) {
  const cells = document.querySelectorAll('.schedule-cell')
  for (const cell of cells) {
    if (cell.getAttribute('data-tech') === techId &&
        cell.getAttribute('data-date') === dateStr &&
        cell.getAttribute('data-slot') === 'morning') {
      return cell
    }
  }
  return null
}

// Carrega e exibe a programação da semana corrente
async function loadSchedule() {
  const label = document.getElementById('scheduleWeekLabel')
  try {
    // Define semana atual
    const weekStart = window.currentWeekStart || getMonday(new Date())
    window.currentWeekStart = weekStart
    const weekEnd = new Date(weekStart)
    weekEnd.setDate(weekStart.getDate() + 4)
    // Atualiza label (ex: 21/10 - 25/10)
    const fmt = (d) => {
      const dd = String(d.getDate()).padStart(2, '0')
      const mm = String(d.getMonth() + 1).padStart(2, '0')
      return `${dd}/${mm}`
    }
    if (label) {
      label.textContent = `${fmt(weekStart)} - ${fmt(weekEnd)}`
    }
    // Busca técnicos, OS e notas
    // REMOVIDO FILTRO DE SEMANA: agora busca TODAS as OS para exibir em qualquer semana
    const [techRes, osRes, notesRes] = await Promise.all([
      fetch(`${API_URL}/api/technicians`).then((r) => r.json()),
      fetch(`${API_URL}/api/os`).then((r) => r.json()),
      fetch(`${API_URL}/api/schedule-notes?week_start=${weekStart.toISOString().split('T')[0]}&week_end=${weekEnd.toISOString().split('T')[0]}`).then((r) => r.json()).catch(() => [])
    ])
    const technicians = Array.isArray(techRes) ? techRes.filter(t => t.username !== 'Sistema NGMAN') : []
    const osList = Array.isArray(osRes) ? osRes : []
    const notes = Array.isArray(notesRes) ? notesRes : []
    const weekDates = getWeekDates(weekStart)
    renderScheduleTable(weekDates, technicians, osList, notes)
    
    // Reativa drag mode se estava ativo
    if (dragModeActive) {
      setTimeout(() => {
        enableDragAndDrop()
      }, 100)
    }
  } catch (err) {
    console.error(err)
    showToast('Erro ao carregar programação', 'error')
  }
}

// Abre modal para atribuir programação a uma célula
function openScheduleAssignModal(tech, dateStr, slot) {
  // VALIDAÇÃO DE DATA REMOVIDA - permite atribuir em qualquer data (passada, presente ou futura)

  console.log('🎯 openScheduleAssignModal chamada com:', { tech: tech.username, dateStr, slot })

  const existingModal = document.getElementById('scheduleAssignModal')
  if (existingModal) existingModal.remove()
  const modal = document.createElement('div')
  modal.id = 'scheduleAssignModal'
  modal.className = 'modal'
  modal.style.display = 'block'
  modal.innerHTML = `
    <div class="modal-content">
      <div class="modal-header">
        <h2>Agendar ${tech.username}</h2>
        <button class="modal-close" onclick="document.getElementById('scheduleAssignModal').remove()">&times;</button>
      </div>
      <div class="modal-body">
        <p>Data: ${dateStr.split('-').reverse().join('/')} (${slot === 'morning' ? 'Manhã' : 'Tarde'})</p>
        <p>Escolha uma opção:</p>
        <button id="scheduleChooseRequest" class="btn-secondary" style="margin-right:0.5rem">Selecionar Solicitação</button>
        <button id="scheduleCreateOs" class="btn-primary" style="margin-right:0.5rem">Criar Nova OS</button>
        <button id="scheduleAddNote" class="btn-secondary">Adicionar Nota</button>
      </div>
    </div>
  `
  document.body.appendChild(modal)
  // Selecionar solicitação
  modal.querySelector('#scheduleChooseRequest').addEventListener('click', async () => {
    try {
      const res = await fetch(`${API_URL}/api/requests`)
      const list = await res.json()
      const requests = Array.isArray(list) ? list : []
      if (requests.length === 0) {
        showToast('Nenhuma solicitação disponível', 'error')
        return
      }
      const reqModal = document.getElementById('scheduleRequestModal')
      if (reqModal) reqModal.remove()
      const m = document.createElement('div')
      m.id = 'scheduleRequestModal'
      m.className = 'modal'
      m.style.display = 'block'
      const options = requests
        .map((req) => {
          const label = `${req.id} - ${req.company_name || req.client_username || ''} | ${req.call_reason || ''}`
          return `<option value="${req.id}">${label}</option>`
        })
        .join('')
      m.innerHTML = `
        <div class="modal-content">
          <div class="modal-header">
            <h2>Selecionar Solicitação</h2>
            <button class="modal-close" onclick="document.getElementById('scheduleRequestModal').remove()">&times;</button>
          </div>
          <div class="modal-body">
            <select id="scheduleReqSelect" style="width:100%; margin-bottom:1rem; padding: 0.5rem; background: var(--bg-input); border: 1px solid var(--border-color); border-radius: 6px; color: var(--text-primary);">
              <option value="">Selecione...</option>
              ${options}
            </select>
          </div>
          <div class="modal-footer">
            <button class="btn-secondary" onclick="document.getElementById('scheduleRequestModal').remove()">Cancelar</button>
            <button class="btn-primary" id="confirmScheduleReq">Atribuir</button>
          </div>
        </div>
      `
      document.body.appendChild(m)
      m.querySelector('#confirmScheduleReq').addEventListener('click', async () => {
        const select = m.querySelector('#scheduleReqSelect')
        const reqId = select ? select.value : ''
        if (!reqId) {
          showToast('Selecione uma solicitação', 'error')
          return
        }
        try {
          await assignRequestToSlot(Number(reqId), tech.id, dateStr, slot)
          showToast('Solicitação atribuída com sucesso!', 'success')
          document.getElementById('scheduleRequestModal').remove()
          document.getElementById('scheduleAssignModal').remove()
          loadSchedule()
        } catch (err) {
          console.error(err)
          showToast(err.message || 'Erro ao atribuir solicitação', 'error')
        }
      })
    } catch (err) {
      console.error(err)
      showToast('Erro ao carregar solicitações', 'error')
    }
  })
  // Criar nova OS
  modal.querySelector('#scheduleCreateOs').addEventListener('click', () => {
    openScheduleCreateOsModal(tech, dateStr, slot)
    document.getElementById('scheduleAssignModal').remove()
  })
  // Adicionar Nota
  modal.querySelector('#scheduleAddNote').addEventListener('click', () => {
    openAddNoteModal(tech.id, dateStr, slot)
    document.getElementById('scheduleAssignModal').remove()
  })
}

// Modal para criação de nova OS a partir da programação
function openScheduleCreateOsModal(tech, dateStr, slot) {
  const existing = document.getElementById('scheduleNewOsModal')
  if (existing) existing.remove()
  const modal = document.createElement('div')
  modal.id = 'scheduleNewOsModal'
  modal.className = 'modal'
  modal.style.display = 'block'
  modal.innerHTML = `
    <div class="modal-content">
      <div class="modal-header">
        <h2>Criar OS para ${tech.username}</h2>
        <button class="modal-close" onclick="document.getElementById('scheduleNewOsModal').remove()">&times;</button>
      </div>
      <div class="modal-body">
        <div class="form-group">
          <label for="schedCompanyInput">Empresa *</label>
          <input 
            type="text" 
            id="schedCompanyInput" 
            list="schedCompanyList" 
            placeholder="Digite para buscar empresa..."
            required
            autocomplete="off"
          >
          <datalist id="schedCompanyList"></datalist>
          <input type="hidden" id="schedCompanySelect">
        </div>
        <div class="form-group">
          <label>Máquina</label>
          <select id="schedMachineSelect">
            <option value="">Selecione uma empresa</option>
          </select>
        </div>
        <div class="form-group">
          <label>Motivo do Chamado</label>
          <input type="text" id="schedCallReason" placeholder="Motivo">
        </div>
        <div class="form-group">
          <label>Tipo de Manutenção *</label>
          <select id="schedMaintenanceType" required>
            <option value="">Selecione</option>
            <option value="corretiva">Corretiva</option>
            <option value="preventiva">Preventiva</option>
            <option value="instalacao">Instalação</option>
            <option value="entrega_tecnica">Entrega Técnica</option>
          </select>
        </div>
        <div class="form-group">
          <label>Observações</label>
          <textarea id="schedObservations" rows="2"></textarea>
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn-secondary" onclick="document.getElementById('scheduleNewOsModal').remove()">Cancelar</button>
        <button class="btn-primary" id="schedConfirmBtn">Criar OS</button>
      </div>
    </div>
  `
  document.body.appendChild(modal)
  
  // Elementos do formulário
  const companyInput = modal.querySelector('#schedCompanyInput')
  const companyHidden = modal.querySelector('#schedCompanySelect')
  const companyDatalist = modal.querySelector('#schedCompanyList')
  const machineSelect = modal.querySelector('#schedMachineSelect')
  
  // Carrega empresas
  let companiesData = []
  fetch(`${API_URL}/api/companies`)
    .then((res) => res.json())
    .then((companies) => {
      if (!Array.isArray(companies) || companies.length === 0) return
      
      companiesData = companies
      const opts = companies.map((c) => `<option value="${c.name}">`).join('')
      companyDatalist.innerHTML = opts
    })
    .catch((err) => {
      console.error('Erro ao carregar empresas:', err)
    })
  
  // Quando usuário digitar/selecionar empresa, carregar máquinas
  if (companyInput) {
    companyInput.addEventListener('input', (e) => {
      const companyName = e.target.value.trim()
      
      // Busca o company_id baseado no nome selecionado
      const company = companiesData.find(c => c.name === companyName)
      
      if (company) {
        companyHidden.value = company.id
        
        // Carrega máquinas da empresa
        machineSelect.innerHTML = '<option value="">Carregando...</option>'
        fetch(`${API_URL}/api/machines?company_id=${company.id}`)
          .then((res) => res.json())
          .then((machines) => {
            if (!Array.isArray(machines) || machines.length === 0) {
              machineSelect.innerHTML = '<option value="">Nenhuma máquina</option>'
              return
            }
            const opts = machines.map((m) => `<option value="${m.serial_number}">${m.model || ''} (${m.serial_number})</option>`).join('')
            machineSelect.innerHTML = '<option value="">Selecione...</option>' + opts
          })
          .catch(() => {
            machineSelect.innerHTML = '<option value="">Erro ao carregar</option>'
          })
      } else {
        companyHidden.value = ''
        machineSelect.innerHTML = '<option value="">Selecione uma empresa</option>'
      }
    })
  }
  // Confirma criação da OS
  modal.querySelector('#schedConfirmBtn').addEventListener('click', () => {
    const companyName = companyInput.value.trim()
    const machineSerial = modal.querySelector('#schedMachineSelect').value || null
    const callReason = modal.querySelector('#schedCallReason').value || null
    const maintenanceType = modal.querySelector('#schedMaintenanceType').value || null
    const observations = modal.querySelector('#schedObservations').value || null
    if (!companyName) {
      showToast('Empresa é obrigatória', 'error')
      return
    }
    if (!maintenanceType) {
      showToast('Tipo de manutenção é obrigatório', 'error')
      return
    }

    console.log(`🎯 [openScheduleCreateOsModal] Criando OS no slot:`, { tech: tech.username, dateStr, slot })

    // CORREÇÃO: Monta data/hora SEM conversão de timezone
    // dateStr vem no formato YYYY-MM-DD (ex: "2025-01-20")
    const [year, month, day] = dateStr.split('-').map(Number)
    const targetHour = slot === 'morning' ? 9 : 14

    console.log(`🔥 [openScheduleCreateOsModal] CALCULANDO HORA:`, {
      dateStr,
      slot,
      'slot === morning?': slot === 'morning',
      'slot === afternoon?': slot === 'afternoon',
      targetHour
    })

    // Cria data local (sem conversão UTC)
    const localDate = new Date(year, month - 1, day, targetHour, 0, 0, 0)

    // Formata manualmente para ISO sem conversão de timezone
    const scheduled = formatDateToLocalISO(localDate)

    console.log(`✅ [openScheduleCreateOsModal] Data agendada:`, {
      dateStr,
      slot,
      targetHour,
      localDate: localDate.toString(),
      scheduled
    })

    const payload = {
      client_name: companyName,
      company_name: companyName,
      machine_serial: machineSerial,
      maintenance_type: maintenanceType,
      call_reason: callReason,
      observations: observations,
      technician_id: tech.id,
      scheduled_date: scheduled,
      period: slot  // NOVO: envia o período explicitamente
    }
    fetch(`${API_URL}/api/os`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    })
      .then((res) => {
        if (!res.ok) return res.json().then((d) => { throw new Error(d.message) })
        return res.json()
      })
      .then((osData) => {
        showToast(`O.S ${osData.order_number} criada!`, 'success')
        document.getElementById('scheduleNewOsModal').remove()
        loadSchedule()
      })
      .catch((err) => {
        console.error(err)
        showToast(err.message || 'Erro ao criar OS', 'error')
      })
  })
}

// Atribui uma solicitação existente a um slot (cria OS a partir da solicitação)
async function assignRequestToSlot(requestId, techId, dateStr, slot) {
  console.log(`🎯 [assignRequestToSlot] Atribuindo ao slot:`, { requestId, techId, dateStr, slot })

  // Busca lista de solicitações e encontra a escolhida (não há rota GET /api/requests/:id neste backend)
  const listRes = await fetch(`${API_URL}/api/requests`)
  if (!listRes.ok) throw new Error('Falha ao buscar solicitações')
  const list = await listRes.json()
  const req = Array.isArray(list) ? list.find((r) => String(r.id) === String(requestId)) : null
  if (!req) throw new Error('Solicitação não encontrada')

  // CORREÇÃO: Busca nome da empresa pelo company_id se não houver company_name
  let companyName = req.company_name || req.client_username
  if (!companyName && req.company_id) {
    try {
      const companyRes = await fetch(`${API_URL}/api/companies/${req.company_id}`)
      if (companyRes.ok) {
        const companyData = await companyRes.json()
        companyName = companyData.name
      }
    } catch (err) {
      console.warn('Erro ao buscar empresa:', err)
    }
  }

  const payload = {
    client_name: companyName,
    company_name: companyName,
    application: req.application || req.machine_model || null,
    machine_serial: req.serial_number || null,
    maintenance_type: null,
    call_reason: req.call_reason || null,
    service_description: req.problem_description || null,
    technician_id: techId,
    observations: null,
    is_new_client: req.machine_pending ? true : false,
    period: slot  // NOVO: envia o período explicitamente
  }

  // CORREÇÃO: Monta data/hora SEM conversão de timezone
  // dateStr vem no formato YYYY-MM-DD (ex: "2025-01-20")
  const [year, month, day] = dateStr.split('-').map(Number)
  const targetHour = slot === 'morning' ? 9 : 14

  console.log(`🔥 [assignRequestToSlot] CALCULANDO HORA:`, {
    dateStr,
    slot,
    'slot === morning?': slot === 'morning',
    'slot === afternoon?': slot === 'afternoon',
    targetHour
  })

  // Cria data local (sem conversão UTC)
  const localDate = new Date(year, month - 1, day, targetHour, 0, 0, 0)

  // Formata manualmente para ISO sem conversão de timezone
  const scheduledISO = formatDateToLocalISO(localDate)

  payload.scheduled_date = scheduledISO

  console.log(`✅ [assignRequestToSlot] Data agendada:`, {
    dateStr,
    slot,
    targetHour,
    localDate: localDate.toString(),
    scheduledISO
  })

  // Responsável (solicitante): utiliza nome completo ou username
  payload.requester = req.requester_name || req.requester_username || null
  // Cria OS
  const osRes = await fetch(`${API_URL}/api/os`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  })
  if (!osRes.ok) {
    const data = await osRes.json().catch(() => ({}))
    throw new Error(data.message || 'Erro ao criar OS')
  }
  await osRes.json()
  // Remove solicitação
  await fetch(`${API_URL}/api/requests/${requestId}`, { method: 'DELETE' })
}

/**
 * Converte um objeto Date ou string ISO em formato "YYYY-MM-DDTHH:MM" para campos datetime-local.
 * @param {Date|string} value
 */
function toDatetimeLocal(value) {
  try {
    const d = value instanceof Date ? value : new Date(value)
    if (!d || isNaN(d)) return ''
    const iso = d.toISOString()
    return iso.substring(0, 16)
  } catch (_e) {
    return ''
  }
}

/**
 * Abre a janela modal de edição de OS.
 * Preenche os campos com dados da OS atual (currentOS).
 */
function openEditOsModal() {
  console.log('🔧 [openEditOsModal] Abrindo modal de edição...', currentOS)

  const modal = document.getElementById('editOsModal')
  if (!modal) {
    console.error('❌ Modal editOsModal não encontrado!')
    return
  }
  if (!currentOS) {
    console.error('❌ currentOS não está definido!')
    return
  }

  // Campos de data/hora
  const startInput = document.getElementById('editStart')
  const endInput = document.getElementById('editEnd')
  const totalHoursInput = document.getElementById('editTotalHours')

  // Informações básicas
  const descInput = document.getElementById('editServiceDescription')
  const occInput = document.getElementById('editOccurrence')
  const obsInput = document.getElementById('editObservations')
  const typeInput = document.getElementById('editMaintenanceType')
  const callReasonInput = document.getElementById('editCallReason')
  const causeInput = document.getElementById('editCause')

  // Deslocamento
  const displacementKmInput = document.getElementById('editDisplacementKm')
  const carUsedInput = document.getElementById('editCarUsed')
  const displacementCauseInput = document.getElementById('editDisplacementCause')

  // Valores
  const techHourlyRateInput = document.getElementById('editTechnicianHourlyRate')
  const valueServiceInput = document.getElementById('editValueService')

  // Popula campos de data/hora
  if (startInput) startInput.value = currentOS.dataHoraInicio ? toDatetimeLocal(currentOS.dataHoraInicio) : ''
  if (endInput) endInput.value = currentOS.dataHoraFim ? toDatetimeLocal(currentOS.dataHoraFim) : ''
  if (totalHoursInput) totalHoursInput.value = currentOS.totalHorasNum || 0

  // Popula informações básicas
  if (descInput) descInput.value = currentOS.descricao || ''
  if (occInput) occInput.value = currentOS.ocorrencia || ''
  if (obsInput) obsInput.value = currentOS.observacoes || ''
  if (typeInput) typeInput.value = currentOS.maintenanceType || ''
  if (callReasonInput) callReasonInput.value = currentOS.motivoChamado || ''
  if (causeInput) causeInput.value = currentOS.causa || ''

  // Popula deslocamento
  if (displacementKmInput) displacementKmInput.value = currentOS.deslocamentoKm || ''
  if (carUsedInput) carUsedInput.value = currentOS.carroUtilizado || ''
  if (displacementCauseInput) displacementCauseInput.value = currentOS.causaDeslocamento || ''

  // Popula valores
  if (techHourlyRateInput) techHourlyRateInput.value = currentOS.valorHoraTecnico || ''
  if (valueServiceInput) valueServiceInput.value = currentOS.valorServico || ''

  // Carrega materiais
  loadEditMaterials()

  // Popula resumo de custos
  const totalMaterialCostInput = document.getElementById('editTotalMaterialCost')
  const totalServiceCostInput = document.getElementById('editTotalServiceCost')
  const grandTotalInput = document.getElementById('editGrandTotal')

  if (totalMaterialCostInput) totalMaterialCostInput.value = (parseFloat(currentOS.custoMateriais) || 0).toFixed(2)
  if (totalServiceCostInput) totalServiceCostInput.value = (parseFloat(currentOS.custoServico) || 0).toFixed(2)
  if (grandTotalInput) grandTotalInput.value = (parseFloat(currentOS.totalGeral) || 0).toFixed(2)

  // Recalcula totais inicialmente
  recalculateOSTotals()

  // Configura listeners para recalcular horas automaticamente
  setupHourRecalculation()

  // Abre o modal (usa display block em vez de classe active)
  modal.style.display = 'block'
  modal.style.visibility = 'visible'
  modal.style.opacity = '1'

  console.log('✅ [openEditOsModal] Modal de edição aberto com sucesso!')
}

/**
 * Carrega os materiais da OS atual para edição
 */
function loadEditMaterials() {
  const materialsList = document.getElementById('editMaterialsList')
  if (!materialsList) return

  console.log('[loadEditMaterials] currentOS.materiais:', currentOS.materiais)

  // Limpa lista
  materialsList.innerHTML = ''

  // Se não tem materiais, mostra mensagem
  if (!currentOS.materiais || currentOS.materiais.length === 0) {
    materialsList.innerHTML = '<p style="color: #64748b; text-align: center; padding: 1rem;">Nenhum material cadastrado</p>'
    return
  }

  // Renderiza cada material
  currentOS.materiais.forEach((material, index) => {
    const materialDiv = document.createElement('div')
    materialDiv.className = 'edit-material-item'
    materialDiv.dataset.index = index
    materialDiv.dataset.id = material.id || ''
    materialDiv.style.cssText = 'border: 1px solid var(--border-color); border-radius: 0.5rem; padding: 0.75rem; margin-bottom: 0.5rem; background: var(--bg-card); position: relative;'

    materialDiv.innerHTML = `
      <div style="display: flex; flex-direction: column; gap: 0.5rem;">
        <div style="display: grid; grid-template-columns: 1fr auto; gap: 0.5rem; align-items: start;">
          <div class="form-group" style="margin-bottom: 0;">
            <label style="font-size: 0.75rem; font-weight: 600; color: var(--text-secondary);">Nome do Material</label>
            <input type="text" class="material-name" value="${escapeHtml(material.name || '')}" placeholder="Ex: Filtro de óleo" style="width: 100%; padding: 0.5rem; background: var(--bg-input); border: 1px solid var(--border-color); border-radius: 6px; color: var(--text-primary);">
          </div>
          <button type="button" class="btn-danger" onclick="removeEditMaterial(${index})" style="padding: 0.5rem; width: 36px; height: 36px; margin-top: 1.25rem;" title="Remover material">
            &times;
          </button>
        </div>
        <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 0.5rem;">
          <div class="form-group" style="margin-bottom: 0;">
            <label style="font-size: 0.75rem; font-weight: 600; color: var(--text-secondary);">Quantidade</label>
            <input type="number" class="material-quantity" value="${material.quantity || 1}" step="0.01" min="0" style="width: 100%; padding: 0.5rem; background: var(--bg-input); border: 1px solid var(--border-color); border-radius: 6px; color: var(--text-primary); pointer-events: auto;">
          </div>
          <div class="form-group" style="margin-bottom: 0;">
            <label style="font-size: 0.75rem; font-weight: 600; color: var(--text-secondary);">Valor Unit. (R$)</label>
            <input type="number" class="material-unit-price" value="${material.unit_price || 0}" step="0.01" min="0" style="width: 100%; padding: 0.5rem; background: var(--bg-input); border: 1px solid var(--border-color); border-radius: 6px; color: var(--text-primary); pointer-events: auto;">
          </div>
          <div class="form-group" style="margin-bottom: 0;">
            <label style="font-size: 0.75rem; font-weight: 600; color: var(--text-secondary);">Total (R$)</label>
            <input type="number" class="material-line-total" value="${material.line_total || 0}" step="0.01" readonly style="width: 100%; padding: 0.5rem; background: var(--bg-readonly); border: 1px solid var(--border-color); border-radius: 6px; color: var(--text-primary); pointer-events: none;">
          </div>
        </div>
      </div>
    `

    materialsList.appendChild(materialDiv)

    // Adiciona listeners para recalcular total quando quantidade ou preço mudarem
    const qtyInput = materialDiv.querySelector('.material-quantity')
    const priceInput = materialDiv.querySelector('.material-unit-price')
    const totalInput = materialDiv.querySelector('.material-line-total')

    const recalc = () => {
      const qty = parseFloat(qtyInput.value) || 0
      const price = parseFloat(priceInput.value) || 0
      totalInput.value = (qty * price).toFixed(2)

      // Recalcula total da OS
      recalculateOSTotals()
    }

    qtyInput.addEventListener('input', recalc)
    priceInput.addEventListener('input', recalc)
  })
}

/**
 * Adiciona um novo material vazio para edição
 */
function addEditMaterial() {
  if (!currentOS.materiais) {
    currentOS.materiais = []
  }

  // Adiciona material vazio
  currentOS.materiais.push({
    id: null,
    name: '',
    quantity: 1,
    unit_price: 0,
    line_total: 0
  })

  // Recarrega a lista
  loadEditMaterials()
}

/**
 * Remove um material da lista de edição
 */
function removeEditMaterial(index) {
  if (!currentOS.materiais || index < 0 || index >= currentOS.materiais.length) return

  currentOS.materiais.splice(index, 1)
  loadEditMaterials()
}

/**
 * Função auxiliar para escapar HTML
 */
function escapeHtml(text) {
  const div = document.createElement('div')
  div.textContent = text
  return div.innerHTML
}

/**
 * Recalcula os totais da OS (custo materiais, custo serviço, total geral)
 * baseado nos materiais atuais e valor do serviço
 */
function recalculateOSTotals() {
  const materialsListDiv = document.getElementById('editMaterialsList')
  const totalMaterialCostInput = document.getElementById('editTotalMaterialCost')
  const totalServiceCostInput = document.getElementById('editTotalServiceCost')
  const grandTotalInput = document.getElementById('editGrandTotal')
  const valueServiceInput = document.getElementById('editValueService')
  const techHourlyRateInput = document.getElementById('editTechnicianHourlyRate')
  const totalHoursInput = document.getElementById('editTotalHours')

  if (!totalMaterialCostInput || !totalServiceCostInput || !grandTotalInput) return

  // Calcula custo total de materiais
  let totalMaterialCost = 0
  if (materialsListDiv) {
    const materialItems = materialsListDiv.querySelectorAll('.edit-material-item')
    materialItems.forEach(item => {
      const lineTotal = parseFloat(item.querySelector('.material-line-total')?.value) || 0
      totalMaterialCost += lineTotal
    })
  }

  // Custo do serviço (pode ser valor fixo ou calculado por horas)
  let totalServiceCost = 0

  // Se tem valor de serviço definido, usa ele
  if (valueServiceInput && valueServiceInput.value) {
    totalServiceCost = parseFloat(valueServiceInput.value) || 0
  }
  // Senão, calcula por horas x valor/hora do técnico
  else if (techHourlyRateInput && totalHoursInput) {
    const hourlyRate = parseFloat(techHourlyRateInput.value) || 0
    const totalHours = parseFloat(totalHoursInput.value) || 0
    totalServiceCost = hourlyRate * totalHours
  }

  // Total geral = materiais + serviço
  const grandTotal = totalMaterialCost + totalServiceCost

  // Atualiza os campos
  totalMaterialCostInput.value = totalMaterialCost.toFixed(2)
  totalServiceCostInput.value = totalServiceCost.toFixed(2)
  grandTotalInput.value = grandTotal.toFixed(2)

  console.log('[recalculateOSTotals] Materiais:', totalMaterialCost.toFixed(2), 'Serviço:', totalServiceCost.toFixed(2), 'Total:', grandTotal.toFixed(2))
}

/**
 * Configura os listeners para recalcular automaticamente as horas
 * quando o admin altera o horário de início ou fim
 */
function setupHourRecalculation() {
  const startInput = document.getElementById('editStart')
  const endInput = document.getElementById('editEnd')
  const totalHoursInput = document.getElementById('editTotalHours')
  const valueServiceInput = document.getElementById('editValueService')
  const techHourlyRateInput = document.getElementById('editTechnicianHourlyRate')

  if (!startInput || !endInput || !totalHoursInput) return

  // Remove listeners antigos se existirem
  startInput.removeEventListener('change', recalculateEditHours)
  endInput.removeEventListener('change', recalculateEditHours)

  // Adiciona novos listeners
  startInput.addEventListener('change', recalculateEditHours)
  endInput.addEventListener('change', recalculateEditHours)

  // Listeners para recalcular totais quando valores financeiros mudarem
  if (valueServiceInput) {
    valueServiceInput.removeEventListener('input', recalculateOSTotals)
    valueServiceInput.addEventListener('input', recalculateOSTotals)
  }
  if (techHourlyRateInput) {
    techHourlyRateInput.removeEventListener('input', recalculateOSTotals)
    techHourlyRateInput.addEventListener('input', recalculateOSTotals)
  }
}

/**
 * Recalcula o total de horas com base nos horários de início e fim
 */
function recalculateEditHours() {
  const startInput = document.getElementById('editStart')
  const endInput = document.getElementById('editEnd')
  const totalHoursInput = document.getElementById('editTotalHours')

  if (!startInput || !endInput || !totalHoursInput) return

  const startVal = startInput.value
  const endVal = endInput.value

  if (!startVal || !endVal) {
    totalHoursInput.value = 0
    return
  }

  const start = new Date(startVal)
  const end = new Date(endVal)

  // Calcula diferença em horas
  const diffMs = end - start
  const hours = Math.max(diffMs / 36e5, 0) // 36e5 = 3600000 ms (1 hora)

  totalHoursInput.value = hours.toFixed(2)

  console.log(`[EditOS] Horas recalculadas: ${hours.toFixed(2)}h (${startVal} -> ${endVal})`)

  // Recalcula totais da OS (pode afetar custo do serviço)
  recalculateOSTotals()
}

/** Fecha a modal de edição */
function closeEditOsModal() {
  const modal = document.getElementById('editOsModal')
  if (modal) modal.style.display = 'none'
}

/**
 * Manipula o envio do formulário de edição.
 * Envia atualização parcial para o backend e recarrega detalhes/listas.
 */
function handleEditOsForm(e) {
  console.log('💾 [handleEditOsForm] Formulário submetido!')
  e.preventDefault()
  if (!currentOS || !currentOS.id) {
    console.error('❌ currentOS não definido ou sem ID')
    return
  }

  // Chama a função consolidada de salvamento
  saveOSEdit()
    .then(() => {
      console.log('✅ OS salva com sucesso')
      closeEditOsModal()
      loadOSList()
    })
    .catch(err => {
      console.error('❌ Erro ao salvar:', err)
      showToast('Erro ao salvar OS', 'error')
    })
}

/**
 * Função auxiliar que pode ser chamada externamente (ex: da review modal)
 * para salvar as edições da OS
 */
async function saveOSEdit() {
  if (!currentOS || !currentOS.id) {
    throw new Error('Nenhuma OS selecionada para editar')
  }

  const id = currentOS.id

  // Captura todos os campos do formulário
  const startInput = document.getElementById('editStart')
  const endInput = document.getElementById('editEnd')
  const totalHoursInput = document.getElementById('editTotalHours')
  const descInput = document.getElementById('editServiceDescription')
  const occInput = document.getElementById('editOccurrence')
  const obsInput = document.getElementById('editObservations')
  const typeInput = document.getElementById('editMaintenanceType')
  const callReasonInput = document.getElementById('editCallReason')
  const causeInput = document.getElementById('editCause')
  const displacementKmInput = document.getElementById('editDisplacementKm')
  const carUsedInput = document.getElementById('editCarUsed')
  const displacementCauseInput = document.getElementById('editDisplacementCause')
  const techHourlyRateInput = document.getElementById('editTechnicianHourlyRate')
  const valueServiceInput = document.getElementById('editValueService')

  const payload = {}

  // Data/hora e total de horas (mantém horário local sem conversão UTC)
  const startVal = startInput && startInput.value ? startInput.value : ''
  const endVal = endInput && endInput.value ? endInput.value : ''
  if (startVal) payload.start_datetime = formatDateToLocalISO(new Date(startVal))
  if (endVal) payload.end_datetime = formatDateToLocalISO(new Date(endVal))

  // Inclui total_hours recalculado se ambas as datas foram fornecidas
  if (totalHoursInput && totalHoursInput.value) {
    payload.total_hours = parseFloat(totalHoursInput.value)
  }

  // Informações básicas
  if (descInput && descInput.value.trim()) payload.service_description = descInput.value.trim()
  if (occInput && occInput.value.trim()) payload.occurrence = occInput.value.trim()
  if (obsInput && obsInput.value.trim()) payload.observations = obsInput.value.trim()
  if (typeInput && typeInput.value.trim()) payload.maintenance_type = typeInput.value.trim()
  if (callReasonInput && callReasonInput.value.trim()) payload.call_reason = callReasonInput.value.trim()
  if (causeInput && causeInput.value.trim()) payload.cause = causeInput.value.trim()

  // Deslocamento
  if (displacementKmInput && displacementKmInput.value !== '') {
    payload.displacement_km = parseFloat(displacementKmInput.value) || 0
  }
  if (carUsedInput && carUsedInput.value.trim()) payload.car_used = carUsedInput.value.trim()
  if (displacementCauseInput && displacementCauseInput.value.trim()) {
    payload.displacement_cause = displacementCauseInput.value.trim()
  }

  // Valores financeiros
  if (techHourlyRateInput && techHourlyRateInput.value !== '') {
    payload.technician_hourly_rate = parseFloat(techHourlyRateInput.value) || 0
  }
  if (valueServiceInput && valueServiceInput.value !== '') {
    payload.value_service = parseFloat(valueServiceInput.value) || 0
  }

  // Coleta materiais editados
  const materialsListDiv = document.getElementById('editMaterialsList')
  if (materialsListDiv) {
    const materialItems = materialsListDiv.querySelectorAll('.edit-material-item')
    const materials = []

    materialItems.forEach(item => {
      const id = item.dataset.id || null
      const name = item.querySelector('.material-name')?.value.trim()
      const quantity = parseFloat(item.querySelector('.material-quantity')?.value) || 0
      const unitPrice = parseFloat(item.querySelector('.material-unit-price')?.value) || 0
      const lineTotal = parseFloat(item.querySelector('.material-line-total')?.value) || 0

      // Só adiciona se tiver nome preenchido
      if (name) {
        materials.push({
          id: id && id !== '' ? parseInt(id) : null,
          name,
          quantity,
          unit_price: unitPrice,
          line_total: lineTotal
        })
      }
    })

    // Inclui materiais no payload
    if (materials.length > 0) {
      payload.materials = materials
    }
  }

  console.log('[saveOSEdit] Enviando payload:', payload)

  const response = await fetch(`${API_URL}/api/os/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.message || 'Erro ao atualizar OS')
  }

  const result = await response.json()
  console.log('[saveOSEdit] OS atualizada com sucesso:', result)

  // Atualiza currentOS com os novos dados
  if (typeof viewOSDetails === 'function') {
    await viewOSDetails(id)
  }
  if (typeof loadOSList === 'function') loadOSList()
  if (typeof loadSchedule === 'function') loadSchedule()

  return result
}

// Associa submissão do formulário de edição após DOM prontas
document.addEventListener('DOMContentLoaded', () => {
  const editForm = document.getElementById('editOsForm')
  if (editForm) {
    editForm.addEventListener('submit', handleEditOsForm)
  }
})

/**
 * Verifica se existe PDF da OS antiga (NGMAN) no banco
 * @param {string} osNumber - Número da OS (ex: 4, 7, 12)
 * @returns {Promise<boolean>} - True se existe, false se não
 */
async function checkLegacyOSExists(osNumber) {
  try {
    const response = await fetch(`${API_URL}/api/legacy-os`)
    const data = await response.json()
    if (data.success && Array.isArray(data.data)) {
      // Compara como string removendo zeros à esquerda
      const osNum = String(parseInt(osNumber))
      return data.data.some(os => String(parseInt(os.os_number)) === osNum)
    }
    return false
  } catch (error) {
    console.error('Erro ao verificar OS antiga:', error)
    return false
  }
}

/**
 * Baixa o PDF de uma OS antiga do NGMAN
 * @param {string} osNumber - Número da OS (ex: 4, 7, 12)
 */
function downloadLegacyOSPDF(osNumber) {
  // Remove zeros à esquerda
  const cleanNumber = String(parseInt(osNumber))
  const url = `${API_URL}/api/legacy-os/${cleanNumber}/download`
  window.open(url, '_blank')
}

/**
 * Ver todas as OS de uma empresa específica
 */
async function viewCompanyOSHistory(companyId, companyName) {
  try {
    const response = await fetch(`${API_URL}/api/os?company_id=${companyId}`)
    const data = await response.json()
    
    if (data.length === 0) {
      showToast('Nenhuma OS encontrada para esta empresa', 'info')
      return
    }
    
    // Exibe modal com histórico
    const modal = document.getElementById('osModal')
    const details = document.getElementById('osDetails')
    
    let html = `
      <h3>${SVGIcons.building} Histórico de OS - ${companyName}</h3>
      <p style="margin-bottom: 1.5rem; color: var(--text-secondary);">
        ${data.length} ordem(ns) de serviço encontrada(s)
      </p>
      
      <div style="max-height: 500px; overflow-y: auto;">
        ${data.map(os => `
          <div class="os-history-item" style="padding: 1rem; border: 1px solid var(--border-color); border-radius: 8px; margin-bottom: 1rem; cursor: pointer; transition: all 0.2s;" onclick="viewOSDetails(${os.id}); event.stopPropagation();" onmouseover="this.style.background='var(--hover-bg)'" onmouseout="this.style.background='transparent'">
            <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 0.5rem;">
              <strong style="font-size: 1.1rem; color: var(--primary-blue);">O.S ${os.order_number}</strong>
              <span style="background: ${os.status === 'completed' ? 'var(--success)' : os.status === 'in_progress' ? 'var(--warning)' : 'var(--primary-blue)'}; color: white; padding: 0.25rem 0.75rem; border-radius: 12px; font-size: 0.85rem;">
                ${os.status === 'completed' ? 'Finalizada' : os.status === 'in_progress' ? 'Em andamento' : 'Atribuída'}
              </span>
            </div>
            <div style="color: var(--text-secondary); font-size: 0.9rem;">
              <div>${SVGIcons.calendar} ${new Date(os.scheduled_date || os.created_at).toLocaleDateString('pt-BR')}</div>
              <div>${SVGIcons.user} Cliente: ${os.client_name || 'N/A'}</div>
              <div>${SVGIcons.wrench} ${os.maintenance_type || 'Não especificado'}</div>
              ${os.machine_model ? `<div>${SVGIcons.settings} Máquina: ${os.machine_model}</div>` : ''}
            </div>
          </div>
        `).join('')}
      </div>
    `
    
    details.innerHTML = html
    modal.classList.add('active')
  } catch (error) {
    console.error('Erro ao carregar histórico da empresa:', error)
    showToast('Erro ao carregar histórico de OS', 'error')
  }
}

/**
 * Ver histórico de OS de uma máquina específica
 */
async function viewMachineOSHistory(machineId, machineName) {
  try {
    const response = await fetch(`${API_URL}/api/os?machine_id=${machineId}`)
    const data = await response.json()
    
    if (data.length === 0) {
      showToast('Nenhuma OS encontrada para esta máquina', 'info')
      return
    }
    
    // Exibe modal com histórico
    const modal = document.getElementById('osModal')
    const details = document.getElementById('osDetails')
    
    let html = `
      <h3>${SVGIcons.settings} Histórico de OS - ${machineName}</h3>
      <p style="margin-bottom: 1.5rem; color: var(--text-secondary);">
        ${data.length} ordem(ns) de serviço encontrada(s)
      </p>
      
      <div style="max-height: 500px; overflow-y: auto;">
        ${data.map(os => {
          // Mostra data real (todas as OS antigas agora têm data extraída dos PDFs!)
          const osDate = os.scheduled_date || os.created_at
          const formattedDate = osDate ? new Date(osDate).toLocaleDateString('pt-BR') : 'Sem data'
          
          return `
            <div class="os-history-item" style="padding: 1rem; border: 1px solid var(--border-color); border-radius: 8px; margin-bottom: 1rem; cursor: pointer; transition: all 0.2s;" onclick="viewOSDetails(${os.id}); event.stopPropagation();" onmouseover="this.style.background='var(--hover-bg)'" onmouseout="this.style.background='transparent'">
              <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 0.5rem;">
                <strong style="font-size: 1.1rem; color: var(--primary-blue);">O.S ${os.order_number}</strong>
                <span style="background: ${os.status === 'completed' ? 'var(--success)' : os.status === 'in_progress' ? 'var(--warning)' : 'var(--primary-blue)'}; color: white; padding: 0.25rem 0.75rem; border-radius: 12px; font-size: 0.85rem;">
                  ${os.status === 'completed' ? 'Finalizada' : os.status === 'in_progress' ? 'Em andamento' : 'Atribuída'}
                </span>
              </div>
              <div style="color: var(--text-secondary); font-size: 0.9rem;">
                <div>${SVGIcons.calendar} ${formattedDate}</div>
                <div>${SVGIcons.user} Cliente: ${os.client_name || 'N/A'}</div>
                <div>${SVGIcons.wrench} ${os.maintenance_type || 'Não especificado'}</div>
                ${os.call_reason ? `<div>${SVGIcons.note} Motivo: ${os.call_reason}</div>` : ''}
              </div>
            </div>
          `
        }).join('')}
      </div>
    `
    
    details.innerHTML = html
    modal.classList.add('active')
  } catch (error) {
    console.error('Erro ao carregar histórico:', error)
    showToast('Erro ao carregar histórico de OS', 'error')
  }
}

/**
 * Busca máquinas por modelo ou número de série
 */
async function searchMachines() {
  const input = document.getElementById('machineSearchInput')
  const searchTerm = input.value.trim()
  
  if (!searchTerm || searchTerm.length < 2) {
    showToast('Digite pelo menos 2 caracteres para buscar', 'warning')
    return
  }
  
  try {
    const response = await fetch(`${API_URL}/api/machines/search?q=${encodeURIComponent(searchTerm)}`)
    if (!response.ok) throw new Error('Erro ao buscar máquinas')
    
    const data = await response.json()
    const resultsDiv = document.getElementById('machinesSearchResults')
    
    if (!data || data.length === 0) {
      resultsDiv.innerHTML = '<p class="empty-state">Nenhuma máquina encontrada</p>'
      return
    }
    
    resultsDiv.innerHTML = data.map(machine => `
      <div class="card" style="margin-bottom: 1rem;">
        <div class="card-header" style="background: var(--bg-input);">
          <h3>${SVGIcons.settings} ${machine.model || 'Modelo não informado'}</h3>
        </div>
        <div style="padding: 1rem;">
          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem; margin-bottom: 1rem;">
            <div>
              <strong style="color: var(--text-secondary); font-size: 0.85rem;">Número de Série:</strong>
              <div style="color: var(--text-primary); font-weight: 500;">${machine.serial_number || 'N/A'}</div>
            </div>
            <div>
              <strong style="color: var(--text-secondary); font-size: 0.85rem;">Empresa:</strong>
              <div style="color: var(--text-primary); font-weight: 500;">${machine.company_name || 'N/A'}</div>
            </div>
          </div>
          <button class="btn-primary btn-sm" onclick="viewMachineOSHistory('${machine.serial_number}', '${machine.model}')">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M12 20h9"/>
              <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/>
            </svg>
            Ver Histórico de OS
          </button>
        </div>
      </div>
    `).join('')
  } catch (error) {
    console.error('Erro ao buscar máquinas:', error)
    showToast('Erro ao buscar máquinas', 'error')
  }
}

/**
 * Alterna entre modo de visualização e edição de máquina
 */
function toggleMachineEditMode(machineId, currentModel, currentSerial) {
  const viewDiv = document.getElementById(`machine-view-${machineId}`)
  const editDiv = document.getElementById(`machine-edit-${machineId}`)
  
  if (!viewDiv || !editDiv) return
  
  const isEditing = editDiv.style.display !== 'none'
  
  if (isEditing) {
    // Voltar para modo visualização
    viewDiv.style.display = 'block'
    editDiv.style.display = 'none'
  } else {
    // Entrar em modo edição
    viewDiv.style.display = 'none'
    editDiv.style.display = 'block'
    // Restaura valores originais
    const modelInput = document.getElementById(`machine-model-input-${machineId}`)
    const serialInput = document.getElementById(`machine-serial-input-${machineId}`)
    if (modelInput) modelInput.value = currentModel || ''
    if (serialInput) serialInput.value = currentSerial || ''
  }
}

/**
 * Salva as alterações da máquina
 */
async function saveMachineChanges(machineId, companyId) {
  const modelInput = document.getElementById(`machine-model-input-${machineId}`)
  const serialInput = document.getElementById(`machine-serial-input-${machineId}`)
  
  if (!modelInput || !serialInput) return
  
  const model = modelInput.value.trim()
  const serial = serialInput.value.trim()
  
  if (!serial) {
    showToast('Número de série é obrigatório', 'error')
    return
  }
  
  try {
    const response = await fetch(`${API_URL}/api/machines/${machineId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model, serial_number: serial })
    })
    
    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.message || 'Erro ao atualizar máquina')
    }
    
    showToast('Máquina atualizada com sucesso!', 'success')
    
    // Recarrega a lista de máquinas
    loadMachinesList(companyId)
  } catch (error) {
    console.error('Erro ao atualizar máquina:', error)
    showToast(error.message || 'Erro ao atualizar máquina', 'error')
  }
}

/**
 * Abre modal para adicionar nota na programação
 */
function openAddNoteModal(techId, dateStr, period) {
  const modal = document.createElement('div')
  modal.className = 'modal'
  modal.id = 'addNoteModal'
  modal.style.display = 'block'
  modal.innerHTML = `
    <div class="modal-content">
      <div class="modal-header">
        <h2>Adicionar Nota</h2>
        <button class="modal-close" onclick="document.getElementById('addNoteModal').remove()">&times;</button>
      </div>
      <div class="modal-body">
        <div class="form-group">
          <label>Nota:</label>
          <textarea id="noteText" rows="3" placeholder="Digite a nota..." style="width: 100%; padding: 0.5rem; border: 1px solid var(--border-color); border-radius: 6px; background: var(--bg-input); color: var(--text-primary);"></textarea>
        </div>
        <p style="font-size: 0.9rem; color: var(--text-secondary); margin-top: 0.5rem;">Data: ${dateStr.split('-').reverse().join('/')} - ${period === 'morning' ? 'Manhã' : 'Tarde'}</p>
      </div>
      <div class="modal-footer">
        <button class="btn-secondary" onclick="document.getElementById('addNoteModal').remove()">Cancelar</button>
        <button class="btn-primary" id="confirmNoteBtn">Salvar Nota</button>
      </div>
    </div>
  `
  document.body.appendChild(modal)
  
  document.getElementById('confirmNoteBtn').addEventListener('click', async () => {
    const noteText = document.getElementById('noteText').value.trim()
    if (!noteText) {
      showToast('Digite uma nota', 'error')
      return
    }
    
    try {
      const response = await fetch(`${API_URL}/api/schedule-notes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          technician_id: techId,
          scheduled_date: dateStr,
          period: period,
          note_text: noteText
        })
      })
      
      if (!response.ok) throw new Error('Erro ao salvar nota')
      
      showToast('Nota adicionada com sucesso!', 'success')
      document.getElementById('addNoteModal').remove()
      loadSchedule() // Recarrega a programação
    } catch (error) {
      console.error('Erro ao salvar nota:', error)
      showToast('Erro ao salvar nota', 'error')
    }
  })
}

/**
 * Remove uma OS pendente (não aceita) definitivamente
 */
async function removePendingOS(osId) {
  if (!confirm('Tem certeza que deseja REMOVER esta OS definitivamente?\n\nEsta ação não pode ser desfeita!')) {
    return
  }
  
  try {
    const response = await fetch(`${API_URL}/api/os/${osId}/remove-pending`, {
      method: 'DELETE'
    })
    
    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.message || 'Erro ao remover OS')
    }
    
    const result = await response.json()
    showToast('OS removida com sucesso!', 'success')
    closeScheduleTooltip()
    loadSchedule() // Recarrega a programação
  } catch (error) {
    console.error('Erro ao remover OS:', error)
    showToast(error.message || 'Erro ao remover OS', 'error')
  }
}

/**
 * Reverte uma OS pendente para solicitação
 */
async function revertOSToPending(osId) {
  if (!confirm('Tem certeza que deseja REVERTER esta OS para solicitação?\n\nEla voltará para a lista de solicitações pendentes.')) {
    return
  }
  
  try {
    const response = await fetch(`${API_URL}/api/os/${osId}/revert-to-request`, {
      method: 'POST'
    })
    
    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.message || 'Erro ao reverter OS')
    }
    
    const result = await response.json()
    showToast('OS revertida para solicitação com sucesso!', 'success')
    closeScheduleTooltip()
    loadSchedule() // Recarrega a programação
  } catch (error) {
    console.error('Erro ao reverter OS:', error)
    showToast(error.message || 'Erro ao reverter OS', 'error')
  }
}

// Estado atual da aba de faturamento
let currentBillingTab = 'pending'

/**
 * Troca entre abas de faturamento (pendente / faturadas)
 */
function switchBillingTab(tab) {
  currentBillingTab = tab

  // Atualiza estilos das abas
  document.getElementById('billingTabPending').classList.toggle('active', tab === 'pending')
  document.getElementById('billingTabBilled').classList.toggle('active', tab === 'billed')

  // Atualiza título
  const title = document.getElementById('billingListTitle')
  if (title) {
    title.textContent = tab === 'pending' ? 'OS Pendentes de Faturamento' : 'OS Faturadas'
  }

  // Recarrega dados
  loadBillingData()
}

/**
 * Carrega dados de faturamento
 */
async function loadBillingData() {
  const year = document.getElementById('billingYear')?.value || ''
  const month = document.getElementById('billingMonth')?.value || ''
  
  try {
    // Busca estatísticas
    let statsUrl = `${API_URL}/api/billing/stats?`
    if (year) statsUrl += `year=${year}&`
    if (month) statsUrl += `month=${month}`
    
    // Busca OS com filtro de billed
    let osUrl = `${API_URL}/api/billing/finished-os?billed=${currentBillingTab === 'billed' ? 'true' : 'false'}`
    if (year) osUrl += `&year=${year}`
    if (month) osUrl += `&month=${month}`
    
    const [statsRes, osRes] = await Promise.all([
      fetch(statsUrl).then(r => r.json()),
      fetch(osUrl).then(r => r.json())
    ])
    
    // Renderiza estatísticas
    renderBillingStats(statsRes)
    
    // Renderiza lista de OS
    renderBillingOSList(osRes, currentBillingTab)
    
  } catch (error) {
    console.error('Erro ao carregar faturamento:', error)
    showToast('Erro ao carregar dados de faturamento', 'error')
  }
}

/**
 * Renderiza estatísticas de faturamento
 */
function renderBillingStats(stats) {
  const container = document.getElementById('billingStats')
  if (!container) return

  const formatter = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })

  container.innerHTML = `
    <div class="stat-card" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 1.5rem; border-radius: 12px;">
      <div style="font-size: 0.875rem; opacity: 0.9; margin-bottom: 0.5rem;">Total de OS</div>
      <div style="font-size: 2rem; font-weight: 700;">${stats.total_os || 0}</div>
      <div style="font-size: 0.75rem; opacity: 0.8; margin-top: 0.5rem;">
        Faturadas: ${stats.total_os_faturadas || 0} | A Faturar: ${stats.total_os_a_faturar || 0}
      </div>
    </div>
    <div class="stat-card" style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: white; padding: 1.5rem; border-radius: 12px;">
      <div style="font-size: 0.875rem; opacity: 0.9; margin-bottom: 0.5rem;">Total Faturado</div>
      <div style="font-size: 2rem; font-weight: 700;">${formatter.format(stats.total_faturado || 0)}</div>
    </div>
    <div class="stat-card" style="background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); color: white; padding: 1.5rem; border-radius: 12px;">
      <div style="font-size: 0.875rem; opacity: 0.9; margin-bottom: 0.5rem;">Total a Faturar</div>
      <div style="font-size: 2rem; font-weight: 700;">${formatter.format(stats.total_a_faturar || 0)}</div>
    </div>
    <div class="stat-card" style="background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%); color: white; padding: 1.5rem; border-radius: 12px;">
      <div style="font-size: 0.875rem; opacity: 0.9; margin-bottom: 0.5rem;">Ticket Médio</div>
      <div style="font-size: 2rem; font-weight: 700;">${formatter.format(stats.ticket_medio || 0)}</div>
    </div>
  `
}

/**
 * Renderiza lista de OS finalizadas
 */
function renderBillingOSList(osList, tab) {
  console.log('🔍 renderBillingOSList - tab:', tab, '| currentBillingTab:', currentBillingTab)

  const container = document.getElementById('billingOSList')
  if (!container) return

  if (!osList || osList.length === 0) {
    container.innerHTML = `<p class="empty-state">Nenhuma OS ${tab === 'billed' ? 'faturada' : 'pendente de faturamento'} encontrada</p>`
    return
  }

  const formatter = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })
  
  container.innerHTML = `
    <table style="width: 100%; border-collapse: collapse;">
      <thead>
        <tr style="border-bottom: 2px solid var(--border-color);">
          <th style="padding: 0.75rem; text-align: left;">OS</th>
          <th style="padding: 0.75rem; text-align: left;">Cliente</th>
          <th style="padding: 0.75rem; text-align: left;">Técnico</th>
          <th style="padding: 0.75rem; text-align: left;">Data Conclusão</th>
          ${tab === 'billed' ? '<th style="padding: 0.75rem; text-align: left;">Nota Fiscal</th>' : ''}
          <th style="padding: 0.75rem; text-align: right;">Valor Total</th>
          <th style="padding: 0.75rem; text-align: center;">Ações</th>
        </tr>
      </thead>
      <tbody>
        ${osList.map(os => `
          <tr style="border-bottom: 1px solid var(--border-color);">
            <td style="padding: 0.75rem;">#${os.order_number || 'N/A'}</td>
            <td style="padding: 0.75rem;">${os.client_name || os.company_name || 'N/A'}</td>
            <td style="padding: 0.75rem;">${os.technician_username || 'N/A'}</td>
            <td style="padding: 0.75rem;">${os.finished_at ? new Date(os.finished_at).toLocaleDateString('pt-BR') : 'N/A'}</td>
            ${tab === 'billed' ? `<td style="padding: 0.75rem; font-weight: 600; color: var(--primary);">NF: ${os.invoice_number || 'N/A'}</td>` : ''}
            <td style="padding: 0.75rem; text-align: right; font-weight: 600;">${formatter.format(os.grand_total || 0)}</td>
            <td style="padding: 0.75rem; text-align: center;">
              <button onclick="viewOSDetails(${os.id})" title="Ver detalhes" style="
                padding: 0.5rem 0.75rem;
                background: #3498db;
                color: white;
                border: none;
                border-radius: 6px;
                cursor: pointer;
                font-size: 0.875rem;
                font-weight: 500;
                display: inline-flex;
                align-items: center;
                gap: 0.35rem;
                margin-right: 0.5rem;
                min-width: 90px;
                justify-content: center;
                transition: all 0.2s;
              " onmouseover="this.style.background='#2980b9'" onmouseout="this.style.background='#3498db'">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                  <circle cx="12" cy="12" r="3"/>
                </svg>
                Ver
              </button>
              ${tab === 'pending' ? `
                <button onclick="returnOSToReview(${os.id}, ${os.order_number})" title="Voltar para revisão" style="
                  padding: 0.5rem 0.75rem;
                  background: #f39c12;
                  color: white;
                  border: none;
                  border-radius: 6px;
                  cursor: pointer;
                  font-size: 0.875rem;
                  font-weight: 500;
                  display: inline-flex;
                  align-items: center;
                  gap: 0.35rem;
                  margin-right: 0.5rem;
                  min-width: 100px;
                  justify-content: center;
                  transition: all 0.2s;
                " onmouseover="this.style.background='#e67e22'" onmouseout="this.style.background='#f39c12'">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M3 7v6h6"/>
                    <path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13"/>
                  </svg>
                  Restaurar
                </button>
                <button onclick="markOSAsBilled(${os.id}, ${os.order_number})" title="Marcar como faturada" style="
                  padding: 0.5rem 0.75rem;
                  background: #27ae60;
                  color: white;
                  border: none;
                  border-radius: 6px;
                  cursor: pointer;
                  font-size: 0.875rem;
                  font-weight: 500;
                  display: inline-flex;
                  align-items: center;
                  gap: 0.35rem;
                  min-width: 95px;
                  justify-content: center;
                  transition: all 0.2s;
                " onmouseover="this.style.background='#229954'" onmouseout="this.style.background='#27ae60'">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <polyline points="20 6 9 17 4 12"/>
                  </svg>
                  Faturar
                </button>
              ` : `
                <span style="color: var(--success-color); font-weight: 600;">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="display: inline; vertical-align: middle;">
                    <polyline points="20 6 9 17 4 12"/>
                  </svg>
                  Faturada
                </span>
              `}
            </td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `
}

/**
 * Marca OS como faturada
 */
async function markOSAsBilled(osId, osNumber) {
  // Mostra modal para pedir número da nota fiscal
  showInvoiceNumberModal(osId, osNumber)
}

/**
 * Mostra modal para inserir número da nota fiscal
 */
function showInvoiceNumberModal(osId, osNumber) {
  const modalHtml = `
    <div id="invoiceModal" style="
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.7);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 10000;
      padding: 1rem;
    ">
      <div style="
        background: var(--bg-primary);
        border-radius: 12px;
        padding: 2rem;
        max-width: 500px;
        width: 100%;
        box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
      ">
        <h2 style="margin: 0 0 1rem 0; color: var(--text-primary);">Faturar O.S ${osNumber}</h2>
        <p style="margin: 0 0 1.5rem 0; color: var(--text-secondary);">
          Digite o número da nota fiscal para esta ordem de serviço:
        </p>
        <input
          type="text"
          id="invoiceNumberInput"
          placeholder="Ex: 12345"
          style="
            width: 100%;
            padding: 0.75rem;
            background: var(--bg-input);
            border: 1px solid var(--border-color);
            border-radius: 6px;
            color: var(--text-primary);
            font-size: 1rem;
            margin-bottom: 1.5rem;
          "
        />
        <div style="display: flex; gap: 1rem; justify-content: flex-end;">
          <button onclick="closeInvoiceModal()" class="btn-secondary">
            Cancelar
          </button>
          <button onclick="confirmMarkAsBilled(${osId}, ${osNumber})" class="btn-primary">
            Confirmar Faturamento
          </button>
        </div>
      </div>
    </div>
  `

  document.body.insertAdjacentHTML('beforeend', modalHtml)

  // Foca no input
  setTimeout(() => {
    document.getElementById('invoiceNumberInput')?.focus()
  }, 100)

  // Permite confirmar com Enter
  document.getElementById('invoiceNumberInput')?.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      confirmMarkAsBilled(osId, osNumber)
    }
  })
}

/**
 * Fecha modal de nota fiscal
 */
function closeInvoiceModal() {
  document.getElementById('invoiceModal')?.remove()
}

/**
 * Confirma e envia o faturamento com número da nota
 */
async function confirmMarkAsBilled(osId, osNumber) {
  const invoiceInput = document.getElementById('invoiceNumberInput')
  const invoiceNumber = invoiceInput?.value?.trim()

  if (!invoiceNumber) {
    showToast('Por favor, digite o número da nota fiscal', 'error')
    invoiceInput?.focus()
    return
  }

  try {
    const response = await fetch(`${API_URL}/api/billing/os/${osId}/mark-billed`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ invoice_number: invoiceNumber })
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.message || 'Erro ao marcar OS como faturada')
    }

    closeInvoiceModal()
    showToast(`O.S ${osNumber} marcada como faturada! NF: ${invoiceNumber}`, 'success')
    loadBillingData() // Recarrega a lista
  } catch (error) {
    console.error('Erro ao marcar OS como faturada:', error)
    showToast(error.message || 'Erro ao marcar OS como faturada', 'error')
  }
}

/**
 * Volta uma OS faturada para revisão
 * Permite editar a OS no estado atual
 */
async function returnOSToReview(osId, osNumber) {
  if (!confirm(`Tem certeza que deseja voltar a O.S ${osNumber} para revisão?\n\nIsso permitirá editar a OS no estado atual.`)) {
    return
  }

  try {
    const response = await fetch(`${API_URL}/api/billing/os/${osId}/return-to-review`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' }
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.message || 'Erro ao voltar OS para revisão')
    }

    showToast(`O.S ${osNumber} voltou para revisão!`, 'success')
    loadBillingData() // Recarrega a lista
  } catch (error) {
    console.error('Erro ao voltar OS para revisão:', error)
    showToast(error.message || 'Erro ao voltar OS para revisão', 'error')
  }
}

/**
 * Inicializa select de anos de faturamento
 */
function initBillingYears() {
  const select = document.getElementById('billingYear')
  if (!select) return
  
  const currentYear = new Date().getFullYear()
  select.innerHTML = '<option value="">Todos</option>'
  
  for (let year = currentYear; year >= currentYear - 5; year--) {
    const option = document.createElement('option')
    option.value = year
    option.textContent = year
    if (year === currentYear) option.selected = true
    select.appendChild(option)
  }
}

/**
 * Configura controle de acesso baseado no tipo de usuário
 */
function setupAccessControl(userType) {
  const billingNavItem = document.getElementById('billingNavItem')
  const sidebar = document.querySelector('.sidebar ul')
  
  if (userType === 'financial') {
    // Usuário financeiro: mostrar APENAS Faturamento
    if (sidebar) {
      Array.from(sidebar.children).forEach(item => {
        if (!item.getAttribute('data-section') || item.getAttribute('data-section') !== 'billingSection') {
          item.style.display = 'none'
        }
      })
    }
    if (billingNavItem) billingNavItem.style.display = 'block'
    
    // Redireciona automaticamente para faturamento
    setTimeout(() => {
      showSection('billingSection')
      initBillingYears()
      loadBillingData()
    }, 100)
  } else {
    // Admin: mostrar todas as seções incluindo Faturamento
    if (sidebar) {
      Array.from(sidebar.children).forEach(item => {
        item.style.display = 'block'
      })
    }
    if (billingNavItem) billingNavItem.style.display = 'block'
  }
}

/**
 * Verifica ao carregar a página se precisa restaurar controle de acesso
 */
function checkAccessControl() {
  const userType = localStorage.getItem('adminUserType')
  if (userType) {
    setupAccessControl(userType)
  }
}

/**
 * Sistema de Drag & Drop para OS na programação
 */
window.dragModeActive = false
window.draggedOSData = null

function initDragAndDrop() {
  const toggleBtn = document.getElementById('dragModeToggle')
  if (!toggleBtn) return

  // Remove listener anterior para evitar duplicação
  toggleBtn.removeEventListener('click', toggleDragMode)
  toggleBtn.addEventListener('click', toggleDragMode)

  // Mostrar botão quando estiver na seção de programação
  const scheduleSection = document.getElementById('scheduleSection')
  if (scheduleSection && scheduleSection.style.display !== 'none') {
    toggleBtn.style.display = 'flex'
  }
}

function toggleDragMode() {
  window.dragModeActive = !window.dragModeActive
  const toggleBtn = document.getElementById('dragModeToggle')

  if (window.dragModeActive) {
    toggleBtn.classList.add('active')
    toggleBtn.title = 'Desativar modo de arrastar'
    enableDragAndDrop()
    showToast('Modo de arrastar ativado! Arraste OS amarelas entre técnicos', 'success')
  } else {
    toggleBtn.classList.remove('active')
    toggleBtn.title = 'Ativar modo de arrastar OS'
    disableDragAndDrop()
    showToast('Modo de arrastar desativado', 'info')
  }
}

function enableDragAndDrop() {
  const scheduleCells = document.querySelectorAll('.schedule-cell')
  
  scheduleCells.forEach(cell => {
    // Pega TODOS os spans com data-os-id na célula (pode haver várias OS)
    const spans = cell.querySelectorAll('span[data-os-id]')

    spans.forEach(span => {
      const osStatus = span.getAttribute('data-os-status')
      const osId = span.getAttribute('data-os-id')

      // Só torna draggable se for status assigned (laranja)
      if (osStatus === 'assigned') {
        span.draggable = true
        span.style.cursor = 'move'
        span.setAttribute('data-drag-os-id', osId)
        span.addEventListener('dragstart', handleSpanDragStart)
        span.addEventListener('dragend', handleSpanDragEnd)
        // Remove o click handler durante drag mode
        span.onclick = null
        // Permite drop nos spans assigned também
        span.addEventListener('dragover', handleDragOver)
        span.addEventListener('drop', handleDrop)
        span.addEventListener('dragleave', handleDragLeave)
      } else {
        // Outros status não podem ser arrastados
        span.style.cursor = 'not-allowed'
        // Mas podem receber drop - adiciona listeners
        span.addEventListener('dragover', handleDragOver)
        span.addEventListener('drop', handleDrop)
        span.addEventListener('dragleave', handleDragLeave)
      }
    })

    // Permite drop em todas as células
    cell.addEventListener('dragover', handleDragOver)
    cell.addEventListener('drop', handleDrop)
    cell.addEventListener('dragleave', handleDragLeave)
  })
}

function disableDragAndDrop() {
  const scheduleCells = document.querySelectorAll('.schedule-cell')

  scheduleCells.forEach(cell => {
    // Remove draggable de todos os spans
    const spans = cell.querySelectorAll('span[data-os-id]')
    spans.forEach(span => {
      span.draggable = false
      span.style.cursor = 'pointer'
      span.removeAttribute('data-drag-os-id')
      span.removeEventListener('dragstart', handleSpanDragStart)
      span.removeEventListener('dragend', handleSpanDragEnd)

      // Remove listeners de drop dos spans
      span.removeEventListener('dragover', handleDragOver)
      span.removeEventListener('drop', handleDrop)
      span.removeEventListener('dragleave', handleDragLeave)

      // Restaura pointer events
      span.style.pointerEvents = 'auto'

      // Restaura o onclick para visualizar detalhes da OS
      const osId = span.getAttribute('data-os-id')
      const osStatus = span.getAttribute('data-os-status')
      if (osId && osStatus) {
        span.onclick = () => showScheduleOSDetails(parseInt(osId), osStatus)
      }
    })

    // Remove listeners da célula
    cell.classList.remove('drag-over')
    cell.removeEventListener('dragover', handleDragOver)
    cell.removeEventListener('drop', handleDrop)
    cell.removeEventListener('dragleave', handleDragLeave)
  })
}

// Funções para arrastar spans individuais (cada OS separadamente)
function handleSpanDragStart(e) {
  const osId = this.getAttribute('data-drag-os-id')
  if (!osId) return

  console.log('🚀 DRAG START - OS ID:', osId)

  window.draggedOSData = {
    osId: osId,
    element: this
  }
  this.classList.add('dragging')
  this.style.opacity = '0.5'
  e.dataTransfer.effectAllowed = 'move'
  e.dataTransfer.setData('text/plain', osId)
}

function handleSpanDragEnd(e) {
  this.classList.remove('dragging')
  this.style.opacity = '1'
  // NÃO resetar draggedOSData aqui para permitir múltiplos arrastos
}

function handleDragOver(e) {
  e.preventDefault()
  e.dataTransfer.dropEffect = 'move'
  this.classList.add('drag-over')
}

function handleDragLeave(e) {
  this.classList.remove('drag-over')
}

async function handleDrop(e) {
  e.preventDefault()
  e.stopPropagation() // Evita propagação dupla
  this.classList.remove('drag-over')

  if (!window.draggedOSData) return

  // Busca atributos na célula (pode ser this se for TD, ou parentElement se for SPAN)
  let targetElement = this
  if (this.tagName === 'SPAN') {
    // Se dropou em um span, pega a célula pai
    targetElement = this.closest('.schedule-cell')
  }

  const targetTechId = targetElement.getAttribute('data-tech')
  const targetDate = targetElement.getAttribute('data-date')
  const targetSlot = targetElement.getAttribute('data-slot')

  console.log('🎯 DROP detectado:', {
    elementoOriginal: this.tagName,
    elementoAlvo: targetElement.tagName,
    targetTechId,
    targetDate,
    targetSlot
  })

  if (!targetTechId || !targetDate || !targetSlot) {
    console.error('❌ DROP em elemento sem atributos necessários!')
    return
  }

  // Busca dados completos da OS
  try {
    const response = await fetch(`${API_URL}/api/os/${window.draggedOSData.osId}`)
    const osData = await response.json()
    
    if (!response.ok || osData.status !== 'assigned') {
      showToast('Apenas OS não aceitas podem ser movidas!', 'error')
      return
    }
    
    // Atualiza a OS com novo técnico e data (mantém horário local sem conversão UTC)
    const targetHour = targetSlot === 'morning' ? 9 : 14
    const [year, month, day] = targetDate.split('-').map(Number)
    const localDate = new Date(year, month - 1, day, targetHour, 0, 0, 0)
    const scheduledDateISO = formatDateToLocalISO(localDate)

    console.log(`📋 Movendo O.S ${window.draggedOSData.osId}:`)
    console.log(`   - De técnico: ${osData.technician_id} → Para técnico: ${targetTechId}`)
    console.log(`   - Data/hora LOCAL: ${scheduledDateISO}`)

    const updateResponse = await fetch(`${API_URL}/api/os/${window.draggedOSData.osId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        technician_id: parseInt(targetTechId),
        scheduled_date: scheduledDateISO
      })
    })

    if (!updateResponse.ok) {
      const errorData = await updateResponse.json().catch(() => ({}))
      console.error('❌ Erro ao mover OS:', errorData)
      throw new Error(errorData.message || 'Erro ao mover OS')
    }

    const updatedOS = await updateResponse.json()
    console.log('✅ OS atualizada com sucesso:', updatedOS)

    showToast('OS movida com sucesso!', 'success')

    // Recarrega a programação - drag mode será reativado automaticamente via renderScheduleTable
    await loadSchedule()

  } catch (error) {
    console.error('Erro ao mover OS:', error)
    showToast('Erro ao mover OS', 'error')
  }

  window.draggedOSData = null
}

// Mostrar/ocultar seções ao clicar no menu lateral
function showSection(sectionId, updateUrl = true) {
  // Esconde todas as seções admin-page
  const sections = document.querySelectorAll('.admin-page')
  sections.forEach(section => {
    section.style.display = 'none'
  })

  // Mostra a seção solicitada
  const targetSection = document.getElementById(sectionId)
  if (targetSection) {
    targetSection.style.display = 'block'

    // Carregar dados específicos da seção
    if (sectionId === 'scheduleSection') {
      loadSchedule()
    } else if (sectionId === 'billingSection') {
      // Carrega dados de faturamento imediatamente
      initBillingYears()
      loadBillingData()
    } else if (sectionId === 'reviewSection') {
      loadReviewData()
    } else if (sectionId === 'vehiclesSection') {
      loadVehiclesList()
    }
  }

  // Gerenciar botão drag & drop - SEMPRE ocultar primeiro, depois mostrar APENAS se for Programação
  const toggleBtn = document.getElementById('dragModeToggle')
  if (toggleBtn) {
    // SEMPRE oculta primeiro
    toggleBtn.style.display = 'none'

    // Desativa modo drag se estava ativo e não é mais Programação
    if (dragModeActive && sectionId !== 'scheduleSection') {
      toggleDragMode()
    }

    // SÓ mostra se for Programação
    if (sectionId === 'scheduleSection') {
      toggleBtn.style.display = 'flex'
    }
  }

  // Remove classe active de todos os itens do menu
  document.querySelectorAll('.sidebar ul li').forEach(item => {
    item.classList.remove('active')
  })

  // Adiciona classe active ao item clicado
  const clickedItem = document.querySelector(`[data-section="${sectionId}"]`)
  if (clickedItem) {
    clickedItem.classList.add('active')
  }

  // Atualiza URL com rota bonita (caminho limpo)
  if (updateUrl && SECTION_TO_ROUTE[sectionId]) {
    const route = SECTION_TO_ROUTE[sectionId]
    const newUrl = '/administracao/' + route
    if (window.location.pathname !== newUrl) {
      history.pushState({ section: sectionId }, '', newUrl)
    }
  }
}

// Navega para seção baseado na URL
function navigateFromUrl() {
  const path = window.location.pathname

  // Extrai a rota do caminho (ex: /administracao/os -> os)
  const match = path.match(/^\/administracao\/([a-z]+)$/)
  const page = match ? match[1] : null

  if (page && ROUTES[page]) {
    showSection(ROUTES[page], false)
  } else {
    // Rota padrão: solicitações
    showSection('requestsSection', false)
  }
}

// Listener para mudanças de URL (botões voltar/avançar)
window.addEventListener('popstate', navigateFromUrl)

// Inicializa rota ao carregar página (será chamado após login)
function initRouter() {
  navigateFromUrl()
}

// Função para alternar visualização de empresas
function setCompaniesView(mode) {
  companiesViewMode = mode
  localStorage.setItem('companiesViewMode', companiesViewMode)
  loadCompaniesAdmin()
}

// Variável global para armazenar empresas carregadas
let cachedCompanyUsers = []

// Função para limpar formulário de cadastro de empresa
function clearCompanyUserForm() {
  // Limpa o campo de busca
  const searchInput = document.getElementById('companyUserSearch')
  if (searchInput) searchInput.value = ''

  const searchResults = document.getElementById('companyUserSearchResults')
  if (searchResults) searchResults.style.display = 'none'

  const hiddenSelect = document.getElementById('companyUserSelect')
  if (hiddenSelect) hiddenSelect.value = ''

  const editForm = document.getElementById('companyUserForm')
  if (editForm) {
    editForm.style.display = 'none'
    document.getElementById('companyUserEditId').value = ''
    document.getElementById('companyUserName').value = ''
    document.getElementById('companyUserUsername').value = ''
    document.getElementById('companyUserPassword').value = ''
    document.getElementById('companyUserCnpj').value = ''
  }

  const newCard = document.getElementById('newCompanyCard')
  if (newCard) {
    newCard.style.display = 'none'
    document.getElementById('newCompanyName').value = ''
    document.getElementById('newCompanyCnpj').value = ''
    document.getElementById('newCompanyUsername').value = ''
    document.getElementById('newCompanyPassword').value = ''
  }
}

// Carrega empresas no cache quando a aba é aberta
function loadCompanyUserDropdown() {
  console.log('[loadCompanyUserDropdown] Iniciando carregamento de empresas...')
  fetch(`${API_URL}/api/companies`)
    .then(res => {
      console.log('[loadCompanyUserDropdown] Response recebido:', res.status)
      return res.json()
    })
    .then(companies => {
      cachedCompanyUsers = companies || []
      console.log(`[loadCompanyUserDropdown] ✅ Carregadas ${cachedCompanyUsers.length} empresas para seleção`, cachedCompanyUsers)
    })
    .catch(err => {
      console.error('[loadCompanyUserDropdown] ❌ Erro ao carregar empresas:', err)
      showToast('Erro ao carregar empresas', 'error')
      cachedCompanyUsers = []
    })
}

// Filtra empresas conforme o usuário digita
function filterCompanyUsers() {
  const searchInput = document.getElementById('companyUserSearch')
  const resultsDiv = document.getElementById('companyUserSearchResults')

  if (!searchInput || !resultsDiv) {
    console.warn('[filterCompanyUsers] Elementos não encontrados')
    return
  }

  const query = searchInput.value.toLowerCase().trim()

  // Se vazio, esconde resultados
  if (query === '') {
    resultsDiv.style.display = 'none'
    resultsDiv.innerHTML = ''
    return
  }

  // Verifica se tem empresas carregadas
  if (!cachedCompanyUsers || cachedCompanyUsers.length === 0) {
    console.warn('[filterCompanyUsers] Nenhuma empresa no cache. Recarregando...')
    resultsDiv.innerHTML = '<div style="padding: 0.75rem; color: var(--text-secondary);">Carregando empresas...</div>'
    resultsDiv.style.display = 'block'
    loadCompanyUserDropdown()
    return
  }

  console.log(`[filterCompanyUsers] Buscando "${query}" em ${cachedCompanyUsers.length} empresas`)

  // Filtra empresas
  const filtered = cachedCompanyUsers.filter(c => {
    const name = (c.name || '').toLowerCase()
    const cnpj = (c.cnpj || '').toLowerCase()
    return name.includes(query) || cnpj.includes(query)
  })

  console.log(`[filterCompanyUsers] Encontradas ${filtered.length} empresas`)

  // Se não encontrou nada
  if (filtered.length === 0) {
    resultsDiv.innerHTML = '<div style="padding: 0.75rem; color: var(--text-secondary);">Nenhuma empresa encontrada</div>'
    resultsDiv.style.display = 'block'
    return
  }

  // Monta HTML dos resultados (limita a 10)
  const html = filtered.slice(0, 10).map(c => `
    <div class="search-result-item" onclick="selectCompanyUser(${c.id}, '${(c.name || '').replace(/'/g, "\\'")}')">
      <strong>${c.name || 'Sem nome'}</strong>
      ${c.cnpj ? `<small style="color: var(--text-secondary); display: block;">${c.cnpj}</small>` : ''}
    </div>
  `).join('')

  resultsDiv.innerHTML = html
  resultsDiv.style.display = 'block'
}

// Seleciona uma empresa da lista de resultados
async function selectCompanyUser(companyId, companyName) {
  const searchInput = document.getElementById('companyUserSearch')
  const resultsDiv = document.getElementById('companyUserSearchResults')
  const hiddenSelect = document.getElementById('companyUserSelect')

  // Atualiza campo de busca e esconde resultados
  if (searchInput) searchInput.value = companyName
  if (resultsDiv) resultsDiv.style.display = 'none'
  if (hiddenSelect) hiddenSelect.value = companyId

  // Carrega dados da empresa
  try {
    const response = await fetch(`${API_URL}/api/companies/${companyId}`)
    if (!response.ok) throw new Error('Empresa não encontrada')

    const company = await response.json()

    // Preenche o formulário de edição
    document.getElementById('companyUserEditId').value = company.id
    document.getElementById('companyUserName').value = company.name || ''
    document.getElementById('companyUserUsername').value = company.username || ''

    // Mostra senha em texto plano (detecta se é hash antigo)
    const passwordField = document.getElementById('companyUserPassword')
    const passwordHint = document.getElementById('passwordHint')

    // Verifica se senha parece ser hash bcrypt (inicia com $2b$ ou $2a$)
    if (company.password && company.password.startsWith('$2')) {
      passwordField.value = ''
      if (passwordHint) {
        passwordHint.textContent = '⚠️ Senha antiga criptografada. Digite uma nova senha para substituir.'
      }
    } else {
      passwordField.value = company.password || ''
      if (passwordHint) {
        passwordHint.textContent = 'Senha atual da empresa. Modifique se necessário.'
      }
    }

    document.getElementById('companyUserCnpj').value = company.cnpj || ''

    // Esconde novo cadastro e mostra formulário de edição
    const newCard = document.getElementById('newCompanyCard')
    if (newCard) newCard.style.display = 'none'

    const editForm = document.getElementById('companyUserForm')
    if (editForm) editForm.style.display = 'block'

    const divider = document.getElementById('companyUserFormDivider')
    if (divider) divider.style.display = 'block'

  } catch (error) {
    console.error('Erro ao carregar empresa:', error)
    showToast('Erro ao carregar dados da empresa', 'error')
  }
}

// Fecha resultados ao clicar fora
document.addEventListener('click', (e) => {
  const resultsDiv = document.getElementById('companyUserSearchResults')
  const searchInput = document.getElementById('companyUserSearch')

  if (resultsDiv && searchInput) {
    if (!searchInput.contains(e.target) && !resultsDiv.contains(e.target)) {
      resultsDiv.style.display = 'none'
    }
  }
})

// Handler para EDITAR empresa (formulário de edição)
document.getElementById('companyUserForm')?.addEventListener('submit', async (e) => {
  e.preventDefault()

  const companyId = document.getElementById('companyUserEditId').value
  const username = document.getElementById('companyUserUsername').value.trim()
  const password = document.getElementById('companyUserPassword').value.trim()

  if (!companyId || !username || !password) {
    showToast('Preencha usuário e senha!', 'error')
    return
  }

  try {
    const response = await fetch(`${API_URL}/api/companies/${companyId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username,
        password
      })
    })

    if (response.ok) {
      showToast('Credenciais atualizadas com sucesso!', 'success')
      clearCompanyUserForm()
      loadCompanyUserDropdown() // Recarrega dropdown
    } else {
      const error = await response.text()
      showToast(`Erro ao atualizar: ${error}`, 'error')
    }
  } catch (error) {
    console.error('Erro ao atualizar empresa:', error)
    showToast('Erro ao atualizar credenciais', 'error')
  }
})

/* ==================== RESPONSIVIDADE MOBILE ==================== */

/**
 * Inicializa menu mobile (hamburguer) para tablets e celulares
 */
function initMobileMenu() {
  // Cria botão hamburguer se não existir
  if (!document.querySelector('.mobile-menu-toggle')) {
    const menuBtn = document.createElement('button')
    menuBtn.className = 'mobile-menu-toggle'
    menuBtn.innerHTML = `
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <line x1="3" y1="12" x2="21" y2="12"/>
        <line x1="3" y1="6" x2="21" y2="6"/>
        <line x1="3" y1="18" x2="21" y2="18"/>
      </svg>
    `
    menuBtn.style.display = 'none' // CSS media query vai mostrar em mobile
    document.body.appendChild(menuBtn)

    // Cria overlay
    const overlay = document.createElement('div')
    overlay.className = 'sidebar-overlay'
    document.body.appendChild(overlay)

    const sidebar = document.querySelector('.sidebar')

    // Toggle sidebar
    menuBtn.addEventListener('click', () => {
      sidebar.classList.toggle('active')
      overlay.classList.toggle('active')
      document.body.style.overflow = sidebar.classList.contains('active') ? 'hidden' : ''
    })

    // Fecha ao clicar no overlay
    overlay.addEventListener('click', () => {
      sidebar.classList.remove('active')
      overlay.classList.remove('active')
      document.body.style.overflow = ''
    })

    // Fecha ao clicar em um item do menu
    const menuItems = document.querySelectorAll('.sidebar-menu li')
    menuItems.forEach(item => {
      item.addEventListener('click', () => {
        if (window.innerWidth <= 768) {
          sidebar.classList.remove('active')
          overlay.classList.remove('active')
          document.body.style.overflow = ''
        }
      })
    })

    // Fecha sidebar ao redimensionar para desktop
    window.addEventListener('resize', () => {
      if (window.innerWidth > 768) {
        sidebar.classList.remove('active')
        overlay.classList.remove('active')
        document.body.style.overflow = ''
      }
    })
  }
}

// Inicializa quando DOM carregar
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initMobileMenu)
} else {
  initMobileMenu()
}

/**
 * Otimizações para touch (iOS/Android)
 */
function initTouchOptimizations() {
  // Previne zoom duplo-toque em botões
  let lastTouchEnd = 0
  document.addEventListener('touchend', (e) => {
    const now = Date.now()
    if (now - lastTouchEnd <= 300) {
      e.preventDefault()
    }
    lastTouchEnd = now
  }, false)

  // Adiciona classe 'touch' no body para CSS específico
  if ('ontouchstart' in window || navigator.maxTouchPoints > 0) {
    document.body.classList.add('touch-device')
  }
}

initTouchOptimizations()
