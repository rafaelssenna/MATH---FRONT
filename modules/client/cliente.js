/**
 * ╔═══════════════════════════════════════════════════════════════════════════════╗
 * ║                      PORTAL DO CLIENTE - MATH HELSEN                          ║
 * ╠═══════════════════════════════════════════════════════════════════════════════╣
 * ║  Sistema para clientes abrirem chamados e acompanharem OS                     ║
 * ╚═══════════════════════════════════════════════════════════════════════════════╝
 *
 * ┌─────────────────────────────────────────────────────────────────────────────┐
 * │                           ÍNDICE DO ARQUIVO                                  │
 * ├─────────────────────────────────────────────────────────────────────────────┤
 * │                                                                              │
 * │  SEÇÃO 1: UI HELPERS E TOAST ............................... linha ~35      │
 * │    - showToast                                                               │
 * │                                                                              │
 * │  SEÇÃO 2: SISTEMA DE PERFIS (Netflix-style) ................ linha ~50      │
 * │    - getCompanyProfiles, createCompanyProfile, openProfileSelector          │
 * │                                                                              │
 * │  SEÇÃO 3: WEBSOCKET E AUTO-REFRESH ......................... linha ~140     │
 * │    - connectWebSocket, startAutoRefresh, stopAutoRefresh                    │
 * │                                                                              │
 * │  SEÇÃO 4: TEMA E INICIALIZAÇÃO ............................. linha ~250     │
 * │    - initializeTheme, updateLogo, handleLogout                              │
 * │                                                                              │
 * │  SEÇÃO 5: AUTENTICAÇÃO ..................................... linha ~310     │
 * │    - checkClientLogin, handleClientLogin, showLoginSection                  │
 * │                                                                              │
 * │  SEÇÃO 6: MÁQUINAS ......................................... linha ~505     │
 * │    - loadMachineOptions                                                      │
 * │                                                                              │
 * │  SEÇÃO 7: ABERTURA DE CHAMADOS ............................. linha ~685     │
 * │    - initializeClientFeatures, handleClientRequest                          │
 * │                                                                              │
 * │  SEÇÃO 8: HISTÓRICO E FILTROS .............................. linha ~940     │
 * │    - filterClientHistory, filterHistory                                     │
 * │                                                                              │
 * │  SEÇÃO 9: MODAL DE DETALHES ................................ linha ~1120    │
 * │    - viewClientOSDetails, closeClientModal, getStatusText                   │
 * │                                                                              │
 * └─────────────────────────────────────────────────────────────────────────────┘
 */

// ╔═══════════════════════════════════════════════════════════════════════════════╗
// ║                       SEÇÃO 0: UTILITÁRIOS DE PERFORMANCE                     ║
// ╚═══════════════════════════════════════════════════════════════════════════════╝

/**
 * Gerenciador de event listeners para evitar memory leaks
 * Permite registrar e limpar listeners por seção
 */
const ListenerManager = {
  _listeners: [],

  add(element, event, handler, section = 'global') {
    if (!element) return
    element.addEventListener(event, handler)
    this._listeners.push({ element, event, handler, section })
  },

  clearSection(section) {
    this._listeners = this._listeners.filter(l => {
      if (l.section === section) {
        l.element.removeEventListener(l.event, l.handler)
        return false
      }
      return true
    })
  },

  clearAll() {
    this._listeners.forEach(l => {
      l.element.removeEventListener(l.event, l.handler)
    })
    this._listeners = []
  }
}

/**
 * Fetch com timeout para evitar requisições travadas
 */
async function fetchWithTimeout(url, options = {}, timeout = 30000) {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeout)

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal
    })
    clearTimeout(timeoutId)
    return response
  } catch (error) {
    clearTimeout(timeoutId)
    if (error.name === 'AbortError') {
      throw new Error('Tempo limite excedido. Verifique sua conexão.')
    }
    throw error
  }
}

/**
 * Fetch seguro com tratamento de erro e feedback ao usuário
 */
async function safeFetch(url, options = {}, errorMessage = 'Erro na requisição') {
  try {
    const response = await fetchWithTimeout(url, options)
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new Error(errorData.message || `Erro ${response.status}`)
    }
    return response
  } catch (error) {
    console.error(`[safeFetch] ${errorMessage}:`, error)
    showToast(error.message || errorMessage, 'error')
    throw error
  }
}

/**
 * Limpeza global ao fazer logout
 */
function globalCleanup() {
  ListenerManager.clearAll()
  stopAutoRefresh()
  disconnectWebSocket()
}

// ╔═══════════════════════════════════════════════════════════════════════════════╗
// ║                       SEÇÃO 1: UI HELPERS E TOAST                             ║
// ╚═══════════════════════════════════════════════════════════════════════════════╝

/**
 * Exibe mensagens de feedback na área de toast
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

/**
 * Converte horas decimais para formato legível (ex: 4.5 -> "4h 30min")
 * @param {number} decimalHours - Horas em formato decimal
 * @returns {string} - Horas formatadas (ex: "4h 30min" ou "4h")
 */
function formatHours(decimalHours) {
  const num = Number(decimalHours)
  if (isNaN(num)) return "N/A"
  const hours = Math.floor(num)
  const minutes = Math.round((num - hours) * 60)
  if (minutes === 0) return `${hours}h`
  return `${hours}h ${minutes}min`
}

// ╔═══════════════════════════════════════════════════════════════════════════════╗
// ║                   SEÇÃO 2: SISTEMA DE PERFIS (Netflix-style)                  ║
// ╚═══════════════════════════════════════════════════════════════════════════════╝
function getProfilesKey() {
  const companyUser = localStorage.getItem("clientUsername") || ""
  return `profiles:${companyUser}`
}
async function getCompanyProfiles() {
  const companyId = localStorage.getItem('clientCompanyId')
  if (companyId) {
    try {
      const res = await fetch(`${API_URL}/api/companies/${companyId}/profiles`)
      if (res.ok) return await res.json()
    } catch (err) { console.warn("[Cliente] Erro:", err.message) }
  }
  // Fallback local
  try { return JSON.parse(localStorage.getItem(getProfilesKey()) || "[]") } catch (err) { console.warn('[Cliente] Erro:', err.message); return [] }
}
function saveCompanyProfilesLocal(list) {
  localStorage.setItem(getProfilesKey(), JSON.stringify(list || []))
}
async function createCompanyProfile(name) {
  const companyId = localStorage.getItem('clientCompanyId')
  if (companyId) {
    try {
      const res = await fetch(`${API_URL}/api/companies/${companyId}/profiles`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ full_name: name })
      })
      if (res.ok) return await res.json()
    } catch (err) { console.warn("[Cliente] Erro:", err.message) }
  }
  // Fallback local
  const list = await getCompanyProfiles()
  if (!list.includes(name)) list.push(name)
  saveCompanyProfilesLocal(list)
  return { id: null, full_name: name }
}
async function ensureProfileSelected() {
  // SEMPRE abre seletor de perfil para identificar o solicitante
  // mesmo que já tenha perfil salvo - usuário deve confirmar quem está solicitando
  openProfileSelector()
}
function openProfileSelector() {
  if (document.getElementById("profileSelector")) return
  const overlay = document.createElement("div")
  overlay.id = "profileSelector"
  overlay.style.cssText = "position:fixed;inset:0;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,0.8);z-index:99999;"
  const box = document.createElement("div")
  box.style.cssText = "background:var(--bg-card);border:1px solid var(--border-color);border-radius:12px;padding:1.25rem;min-width:300px;max-width:90vw;"
  box.innerHTML = `
    <h3 style="margin:0 0 .75rem 0;color:var(--text-primary)">Selecionar Perfil</h3>
    <div id="profilesGrid" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(120px,1fr));gap:.75rem;margin:.5rem 0 1rem 0;"></div>
    <div style="display:flex;gap:.5rem;justify-content:flex-end">
      <button id="addProfileBtn" class="btn-secondary">Criar Perfil</button>
      <button id="closeProfilesBtn" class="btn-secondary">Fechar</button>
    </div>
  `
  overlay.appendChild(box)
  document.body.appendChild(overlay)
  const grid = box.querySelector('#profilesGrid')
  const render = async () => {
    // Limpa listeners anteriores antes de recriar
    ListenerManager.clearSection('profileSelector')
    const list = await getCompanyProfiles()
    const names = Array.isArray(list) ? list.map(p => p.full_name || p) : []
    if (!names.length) {
      grid.innerHTML = '<p class="empty-state" style="grid-column:1/-1">Nenhum perfil ainda. Clique em "Criar Perfil".</p>'
      return
    }
    grid.innerHTML = names.map(n => `<button class="btn-secondary" data-name="${n}" style="height:72px">${n}</button>`).join('')
    grid.querySelectorAll('button[data-name]').forEach(btn => {
      const handler = () => {
        localStorage.setItem('clientProfileName', btn.dataset.name)
        closeProfileSelector()
        const companyName = localStorage.getItem('clientName') || 'Empresa'
        const nameSpan = document.getElementById('loggedClientName')
        if (nameSpan) nameSpan.textContent = `Cliente: ${companyName} — Perfil: ${btn.dataset.name}`
      }
      ListenerManager.add(btn, 'click', handler, 'profileSelector')
    })
  }
  render()
  box.querySelector('#addProfileBtn').addEventListener('click', async () => {
    const name = prompt('Nome completo do solicitante:')
    const trimmed = (name || '').trim()
    if (!trimmed) return
    await createCompanyProfile(trimmed)
    render()
  })
  box.querySelector('#closeProfilesBtn').addEventListener('click', () => {
    if (!localStorage.getItem('clientProfileName')) {
      // exige um perfil para continuar
      return
    }
    closeProfileSelector()
  })
}
function closeProfileSelector() {
  ListenerManager.clearSection('profileSelector')
  const el = document.getElementById('profileSelector')
  if (el) el.remove()
}

// URL base da API do backend (Railway). Atualize conforme o domínio de produção.
const API_URL = "https://hs-back-production-f54a.up.railway.app"

// Armazena lista de máquinas disponíveis e seleção atual
let machinesOptions = []
let selectedMachine = null
let machinePending = false

// ╔═══════════════════════════════════════════════════════════════════════════════╗
// ║                    SEÇÃO 3: WEBSOCKET E AUTO-REFRESH                          ║
// ╚═══════════════════════════════════════════════════════════════════════════════╝

let autoRefreshInterval = null
let socket = null

function connectWebSocket() {
  if (socket && socket.connected) return
  
  const clientUsername = localStorage.getItem('clientUsername')
  if (!clientUsername) return
  
  socket = io(API_URL, {
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionDelay: 1000,
    reconnectionAttempts: 5
  })
  
  socket.on('connect', () => {
    console.log('✅ WebSocket conectado!')
    socket.emit('identify', { userType: 'client', userId: clientUsername })
  })
  
  socket.on('disconnect', () => {
    console.log('❌ WebSocket desconectado')
  })
  
  // Solicitação virou OS
  socket.on('os_created', (data) => {
    console.log('📢 Sua solicitação virou OS:', data)
    showToast(`Sua solicitação virou OS #${data.order_number}!`, 'success')
    filterClientHistory()
  })
}

function disconnectWebSocket() {
  if (socket) {
    socket.disconnect()
    socket = null
  }
}

function startAutoRefresh() {
  // Para intervalo anterior se existir
  if (autoRefreshInterval) {
    clearInterval(autoRefreshInterval)
  }
  
  // Auto-refresh do histórico a cada 20 segundos
  autoRefreshInterval = setInterval(() => {
    const clientSection = document.getElementById('client-section')
    if (clientSection && clientSection.style.display !== 'none') {
      filterClientHistory()
    }
  }, 20000)
}

function stopAutoRefresh() {
  if (autoRefreshInterval) {
    clearInterval(autoRefreshInterval)
    autoRefreshInterval = null
  }
}

/**
 * Restaura filtros do estado na interface
 */
window.restoreFiltersFromState = function() {
  if (!window.clientStateManager) return

  const filters = window.clientStateManager.restoreFilters()

  const filterMachine = document.getElementById("filterMachine")

  if (filterMachine && filters.machineSerial) {
    filterMachine.value = filters.machineSerial
  }

  // Aplica filtros se houver algum
  if (filters.machineSerial) {
    setTimeout(() => {
      filterClientHistory()
    }, 300)
  }
}

// Inicialização da página
document.addEventListener("DOMContentLoaded", () => {
  const loginForm = document.getElementById("clientLoginForm")
  if (loginForm) loginForm.addEventListener("submit", handleClientLogin)

  // Initialize theme
  initializeTheme()

  // Initialize logout button
  const logoutBtn = document.getElementById("logoutBtn")
  if (logoutBtn) {
    logoutBtn.addEventListener("click", handleLogout)
  }

  // Verifica se o cliente já está logado
  checkClientLogin()
  
  // Restaura estado salvo (filtros, scroll, etc)
  if (window.clientStateManager) {
    const state = window.clientStateManager.restoreFromURL()
    if (state.isLoggedIn) {
      setTimeout(() => {
        restoreFiltersFromState()
        window.clientStateManager.restoreScrollPosition()
      }, 500)
    }
  }
})

// ╔═══════════════════════════════════════════════════════════════════════════════╗
// ║                      SEÇÃO 4: TEMA E INICIALIZAÇÃO                            ║
// ╚═══════════════════════════════════════════════════════════════════════════════╝

/**
 * Inicializa o tema da aplicação baseado na preferência salva
 */
function initializeTheme() {
  const themeToggle = document.getElementById('themeToggle');
  if (!themeToggle) return;

  // Carrega tema salvo ou usa "dark" como padrão
  const savedTheme = localStorage.getItem('theme') || 'dark';
  document.documentElement.setAttribute('data-theme', savedTheme);
  updateLogo(savedTheme);

  themeToggle.addEventListener('click', () => {
    const currentTheme = document.documentElement.getAttribute('data-theme');
    const newTheme = currentTheme === 'light' ? 'dark' : 'light';
    document.documentElement.setAttribute('data-theme', newTheme);
    localStorage.setItem('theme', newTheme);
    updateLogo(newTheme);
  });
}

/**
 * Atualiza a logo baseada no tema
 */
function updateLogo(theme) {
  const logoImages = document.querySelectorAll('.logo-image, .login-logo');
  const logoSrc = theme === 'dark' ? 'logohelsenbranca.png' : 'helsenservicelogo.png';
  logoImages.forEach(img => {
    if (img) img.src = logoSrc;
  });
}

/**
 * Realiza logout do cliente, limpando o localStorage e redirecionando para login
 */
function handleLogout() {
  // Limpa dados de autenticação
  localStorage.removeItem("clientLoggedIn")
  localStorage.removeItem("clientName")
  localStorage.removeItem("clientUsername")

  // Limpa estado salvo
  if (window.clientStateManager) {
    window.clientStateManager.clearState()
  }
  
  // Para auto-refresh
  stopAutoRefresh()

  // Mostra mensagem de sucesso
  showToast("Logout realizado com sucesso!", "success")

  // Redireciona para tela de login
  showLoginSection()

  // Esconde botão de logout
  const logoutBtn = document.getElementById("logoutBtn")
  if (logoutBtn) logoutBtn.style.display = "none"
}

// ╔═══════════════════════════════════════════════════════════════════════════════╗
// ║                          SEÇÃO 5: AUTENTICAÇÃO                                ║
// ╚═══════════════════════════════════════════════════════════════════════════════╝

/**
 * Verifica se existe um cliente logado no localStorage. Caso positivo
 * carrega o portal do cliente; caso contrário mantém a tela de login.
 */
function checkClientLogin() {
  const logged = localStorage.getItem("clientLoggedIn") === "true"
  if (logged) {
    showClientSection()
  } else {
    showLoginSection()
  }
}

/**
 * Exibe o formulário de login e oculta o portal do cliente.
 */
function showLoginSection() {
  const login = document.getElementById("login-section")
  const portal = document.getElementById("client-section")
  if (login) login.style.display = "block"
  if (portal) portal.style.display = "none"
}

/**
 * Exibe o portal do cliente, esconde o login e inicializa os
 * componentes da página (sugestão de manutenção, avaliação e histórico).
 */
function showClientSection() {
  const login = document.getElementById("login-section")
  const portal = document.getElementById("client-section")
  if (login) login.style.display = "none"
  if (portal) portal.style.display = "block"

  const logoutBtn = document.getElementById("logoutBtn")
  if (logoutBtn) logoutBtn.style.display = "flex"

  const name = localStorage.getItem("clientName") || ""
  const nameDisplay = document.getElementById("loggedClientName")
  if (nameDisplay && name) nameDisplay.textContent = `Cliente: ${name}`
  const nomeInput = document.getElementById("clientNome")
  if (nomeInput && name) nomeInput.value = name
  // Inicializa funcionalidades somente uma vez
  initializeClientFeatures()
  // A avaliação de atendimento foi removida no novo fluxo
  const requestForm = document.getElementById("clientRequestForm")
  if (requestForm && !requestForm.dataset.bound) {
    requestForm.addEventListener("submit", handleClientRequest)
    requestForm.dataset.bound = "true"
  }
  // Carrega máquinas disponíveis para seleção
  loadMachineOptions()
  
  // Inicia auto-refresh e WebSocket
  startAutoRefresh()
  connectWebSocket()

  // SEMPRE exige seleção de perfil ao entrar (identifica o solicitante)
  setTimeout(() => ensureProfileSelected(), 300)
  
  // Sistema de múltiplas imagens com adição incremental
  window.selectedImages = [] // Array global para armazenar as imagens selecionadas

  const imagesInput = document.getElementById("clientProblemImages")
  const addPhotoBtn = document.getElementById("addPhotoBtn")
  const preview = document.getElementById("imagesPreview")
  const photoCount = document.getElementById("photoCount")

  // Atualiza o contador de fotos (função global)
  window.updatePhotoCount = function() {
    const photoCount = document.getElementById("photoCount")
    const addPhotoBtn = document.getElementById("addPhotoBtn")

    if (photoCount) {
      photoCount.textContent = window.selectedImages.length
    }
    // Desabilita botão se atingir limite
    if (addPhotoBtn) {
      if (window.selectedImages.length >= 5) {
        addPhotoBtn.disabled = true
        addPhotoBtn.style.opacity = "0.5"
        addPhotoBtn.style.cursor = "not-allowed"
      } else {
        addPhotoBtn.disabled = false
        addPhotoBtn.style.opacity = "1"
        addPhotoBtn.style.cursor = "pointer"
      }
    }
  }

  // Renderiza o preview de todas as imagens (função global)
  window.renderImagePreviews = function() {
    const preview = document.getElementById("imagesPreview")
    if (!preview) return

    preview.innerHTML = ""

    if (window.selectedImages.length === 0) {
      preview.style.display = "none"
      return
    }

    preview.style.display = "grid"

    window.selectedImages.forEach((fileData, index) => {
      const imgContainer = document.createElement("div")
      imgContainer.style.cssText = "position: relative; border-radius: 8px; overflow: hidden; border: 2px solid var(--border-color); background: var(--bg-card);"

      const img = document.createElement("img")
      img.src = fileData.dataUrl
      img.style.cssText = "width: 100%; height: 120px; object-fit: cover; display: block;"
      img.alt = `Foto ${index + 1}`

      const removeBtn = document.createElement("button")
      removeBtn.type = "button"
      removeBtn.innerHTML = "&times;"
      removeBtn.title = "Remover foto"
      removeBtn.style.cssText = "position: absolute; top: 5px; right: 5px; background: rgba(220, 38, 38, 0.9); color: white; border: none; border-radius: 50%; width: 28px; height: 28px; cursor: pointer; font-size: 20px; font-weight: bold; line-height: 1; padding: 0; display: flex; align-items: center; justify-content: center; box-shadow: 0 2px 4px rgba(0,0,0,0.3);"
      removeBtn.onclick = () => {
        window.selectedImages.splice(index, 1)
        window.renderImagePreviews()
        window.updatePhotoCount()
        showToast("Foto removida", "info")
      }

      imgContainer.appendChild(img)
      imgContainer.appendChild(removeBtn)
      preview.appendChild(imgContainer)
    })
  }

  // Botão de adicionar foto
  if (addPhotoBtn && imagesInput) {
    addPhotoBtn.addEventListener("click", () => {
      if (window.selectedImages.length >= 5) {
        showToast("Limite máximo de 5 fotos atingido", "error")
        return
      }
      imagesInput.click()
    })
  }

  // Quando o usuário seleciona uma imagem
  if (imagesInput) {
    imagesInput.addEventListener("change", (e) => {
      const file = e.target.files[0]

      if (!file) return

      // Validações
      const maxSize = 5 * 1024 * 1024 // 5MB
      const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp']

      if (file.size > maxSize) {
        showToast("Imagem muito grande! Máximo 5MB", "error")
        e.target.value = ""
        return
      }

      if (!allowedTypes.includes(file.type)) {
        showToast("Formato inválido! Use JPG, PNG, GIF ou WEBP", "error")
        e.target.value = ""
        return
      }

      if (window.selectedImages.length >= 5) {
        showToast("Máximo de 5 fotos", "error")
        e.target.value = ""
        return
      }

      // Lê a imagem como Data URL para preview
      const reader = new FileReader()
      reader.onload = (ev) => {
        window.selectedImages.push({
          file: file,
          dataUrl: ev.target.result,
          name: file.name
        })
        window.renderImagePreviews()
        window.updatePhotoCount()
        showToast(`Foto ${window.selectedImages.length}/5 adicionada`, "success")
      }
      reader.readAsDataURL(file)

      // Limpa o input para permitir adicionar a mesma imagem novamente se necessário
      e.target.value = ""
    })
  }

  // Inicializa contador
  window.updatePhotoCount()
}

// ╔═══════════════════════════════════════════════════════════════════════════════╗
// ║                            SEÇÃO 6: MÁQUINAS                                  ║
// ╚═══════════════════════════════════════════════════════════════════════════════╝

/**
 * Busca lista de máquinas cadastradas no backend e popula o select.
 */
function loadMachineOptions() {
  const select = document.getElementById("clientMachineSelect")
  const filterSelect = document.getElementById("filterMachine")

  // Limpa opções do select de abertura de chamado
  if (select) {
    select.innerHTML = '<option value="">Selecione a máquina...</option>'
  }

  // Pega company_id do cliente logado
  const companyId = localStorage.getItem("clientCompanyId")
  if (!companyId) {
    showToast("Erro: ID da empresa não encontrado.", "error")
    return
  }

  // Busca apenas máquinas da empresa do cliente
  fetch(`${API_URL}/api/machines?user_type=client&user_company_id=${companyId}`)
    .then((res) => res.json())
    .then((machines) => {
      machinesOptions = Array.isArray(machines) ? machines : []
      if (machinesOptions.length === 0) {
        if (select) select.innerHTML = '<option value="">Nenhuma máquina cadastrada</option>'
        return
      }

      // Popula dropdown de abertura de chamado
      if (select) {
        machinesOptions.forEach((m) => {
          const opt = document.createElement("option")
          opt.value = m.serial_number || ""
          opt.dataset.model = m.model || ""
          opt.dataset.serial = m.serial_number || ""
          opt.textContent = `${m.model || ""} (${m.serial_number || ""})`
          select.appendChild(opt)
        })
      }

      // Popula dropdown de filtro
      if (filterSelect) {
        filterSelect.innerHTML = '<option value="">Todas as máquinas</option>'
        machinesOptions.forEach((m) => {
          const opt = document.createElement("option")
          opt.value = m.serial_number || ""
          opt.textContent = `${m.model || ""} (${m.serial_number || ""})`
          filterSelect.appendChild(opt)
        })
      }
    })
    .catch((err) => {
      console.error(err)
      showToast("Erro ao carregar máquinas.", "error")
    })
  // Listener para atualização de máquina selecionada
  if (!select.dataset.bound) {
    select.addEventListener("change", (e) => {
      const value = e.target.value
      const equipField = document.getElementById("clientEquipamento")
      const serieField = document.getElementById("clientNumeroSerie")
      
      if (!value) {
        selectedMachine = null
        if (equipField) equipField.value = ""
        if (serieField) serieField.value = ""
      } else {
        const opt = e.target.selectedOptions[0]
        selectedMachine = {
          model: opt.dataset.model,
          serial_number: opt.dataset.serial,
        }
        // Preenche automaticamente os campos
        if (equipField) equipField.value = opt.dataset.model || ""
        if (serieField) serieField.value = opt.dataset.serial || ""
      }
    })
    select.dataset.bound = "true"
  }
  // Checkbox para máquina pendente
  const chk = document.getElementById("clientMachinePending")
  if (chk && !chk.dataset.bound) {
    chk.addEventListener("change", (e) => {
      machinePending = e.target.checked
      const equipField = document.getElementById("clientEquipamento")
      const serieField = document.getElementById("clientNumeroSerie")
      const selectField = document.getElementById("clientMachineSelect")
      
      if (machinePending) {
        // Limpa seleção da máquina se pendente
        selectedMachine = null
        if (selectField) selectField.value = ""
        if (equipField) equipField.value = ""
        if (serieField) serieField.value = ""
        // Desabilita campos
        if (selectField) selectField.disabled = true
        if (equipField) equipField.disabled = true
        if (serieField) serieField.disabled = true
      } else {
        // Reabilita campos
        if (selectField) selectField.disabled = false
        if (equipField) equipField.disabled = false
        if (serieField) serieField.disabled = false
      }
    })
    chk.dataset.bound = "true"
  }
}

/**
 * Trata o envio do formulário de login. Valida usuário e senha
 * contra os dados armazenados no localStorage.
 */
function handleClientLogin(e) {
  e.preventDefault()
  const username = document.getElementById("clientLoginName").value.trim()
  const password = document.getElementById("clientLoginPassword").value
  // Nova regra: autentica empresa primeiro; se falhar, tenta cliente (compatibilidade)
  const companyLogin = fetch(`${API_URL}/api/companies/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  }).then(async (res) => {
    if (!res.ok) throw new Error("not_company")
    const data = await res.json()
    // Sessão com dados da empresa
    localStorage.setItem("clientLoggedIn", "true")
    localStorage.setItem("clientName", data.name || username)
    localStorage.setItem("clientUsername", data.username || username)
    if (data.id) localStorage.setItem("clientCompanyId", String(data.id))
    showToast("Login realizado com sucesso!", "success")
    showClientSection()
  })

  const clientLogin = () => fetch(`${API_URL}/api/clients/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  })
    .then((res) => {
      if (!res.ok) throw new Error("Credenciais inválidas")
      return res.json()
    })
    .then((data) => {
      localStorage.setItem("clientLoggedIn", "true")
      localStorage.setItem("clientName", data.full_name || username)
      localStorage.setItem("clientUsername", data.username || username)
      if (data.company_id) localStorage.setItem("clientCompanyId", String(data.company_id))
      showToast("Login realizado com sucesso!", "success")
      showClientSection()
    })

  companyLogin.catch((err) => {
    if (String(err && err.message) === "not_company") return clientLogin()
    return clientLogin()
  }).catch(() => {
    // Fallback offline (compatibilidade antiga)
    const clients = JSON.parse(localStorage.getItem("clients") || "[]")
    const user = clients.find((u) => u.username === username && u.password === password)
    if (user) {
      localStorage.setItem("clientLoggedIn", "true")
      localStorage.setItem("clientName", user.full_name || user.username)
      localStorage.setItem("clientUsername", user.username)
      if (user.company_id) localStorage.setItem("clientCompanyId", String(user.company_id))
      showToast("Login realizado com sucesso!", "success")
      showClientSection()
    } else {
      showToast("Credenciais inválidas!", "error")
    }
  })
}

// ╔═══════════════════════════════════════════════════════════════════════════════╗
// ║                      SEÇÃO 7: ABERTURA DE CHAMADOS                            ║
// ╚═══════════════════════════════════════════════════════════════════════════════╝

/**
 * Inicializa funcionalidades específicas do portal do cliente:
 * preenche o nome do cliente logado e sugere automaticamente o tipo
 * de manutenção com base na descrição e no motivo do chamado.
 */
function initializeClientFeatures() {
  // Preenche nome do cliente caso exista
  const companyName = localStorage.getItem("clientName") || "Empresa"
  const profile = localStorage.getItem("clientProfileName") || ""
  const nameSpan = document.getElementById("loggedClientName")
  const nameInput = document.getElementById("clientNome")
  if (nameSpan) nameSpan.textContent = profile ? `Cliente: ${companyName} — Perfil: ${profile}` : `Cliente: ${companyName}`
  if (nameInput) nameInput.value = companyName
  // Referências aos campos de descrição e motivo
  const motivoField = document.getElementById("clientMotivoChamado")
  const tipoSugeridoField = document.getElementById("clientTipoSugerido")
  // O campo de descrição foi removido; a sugestão baseia-se apenas no motivo
  if (!motivoField || !tipoSugeridoField) return
  function suggestMaintenanceType() {
    const description = motivoField.value.toLowerCase()
    // Palavras-chave para manutenção corretiva
    const correctiveKeywords = [
      "quebrou",
      "parou",
      "não funciona",
      "não liga",
      "defeito",
      "falha",
      "problema",
      "vazamento",
      "ruído",
      "barulho",
      "travou",
      "erro",
    ]
    // Palavras-chave para manutenção preventiva
    const preventiveKeywords = [
      "revisão",
      "preventiva",
      "manutenção programada",
      "inspeção",
      "verificação",
      "troca de óleo",
      "limpeza",
    ]
    const hasCorrectiveKeyword = correctiveKeywords.some((keyword) => description.includes(keyword))
    const hasPreventiveKeyword = preventiveKeywords.some((keyword) => description.includes(keyword))
    if (hasCorrectiveKeyword) {
      tipoSugeridoField.value = "Corretiva"
    } else if (hasPreventiveKeyword) {
      tipoSugeridoField.value = "Preventiva"
    } else if (description.length > 10) {
      tipoSugeridoField.value = "Corretiva (sugestão baseada na descrição)"
    } else {
      tipoSugeridoField.value = ""
    }
  }
  motivoField.addEventListener("input", suggestMaintenanceType)
}

/**
 * Inicializa o controle de avaliação por estrelas. Permite que o
 * usuário clique nas estrelas para definir a nota e armazena o
 * valor selecionado em um campo oculto.
 */
function initializeStarRating() {
  const stars = document.querySelectorAll(".star")
  if (!stars || stars.length === 0) return
  stars.forEach((star) => {
    star.addEventListener("click", () => {
      const rating = star.dataset.rating
      const ratingInput = document.getElementById("ratingValue")
      if (ratingInput) ratingInput.value = rating
      stars.forEach((s) => {
        if (Number.parseInt(s.dataset.rating, 10) <= Number.parseInt(rating, 10)) {
          s.classList.add("active")
        } else {
          s.classList.remove("active")
        }
      })
    })
  })
}

/**
 * Processa o envio de um chamado de manutenção. Gera um número de
 * solicitação e armazena os dados no localStorage em "clientRequests".
 */
function showClientLoading() {
  let overlay = document.getElementById("clientLoadingOverlay")
  if (!overlay) {
    overlay = document.createElement("div")
    overlay.id = "clientLoadingOverlay"
    overlay.style.cssText = `
      position: fixed; top: 0; left: 0; width: 100%; height: 100%;
      background: rgba(0,0,0,0.8); z-index: 99999;
      display: flex; justify-content: center; align-items: center;
      backdrop-filter: blur(5px);
    `
    overlay.innerHTML = `
      <div style="background: var(--bg-card); padding: 2rem; border-radius: 16px; text-align: center; border: 1px solid var(--border-color);">
        <div style="width: 60px; height: 60px; border: 4px solid var(--border-color); border-top: 4px solid var(--primary-blue); border-radius: 50%; animation: spin 1s linear infinite; margin: 0 auto 1rem;"></div>
        <p style="color: var(--text-primary); font-size: 1.1rem; margin: 0;">Enviando solicitação...</p>
      </div>
    `
    document.body.appendChild(overlay)
  }
  overlay.style.display = "flex"
}

function hideClientLoading() {
  const overlay = document.getElementById("clientLoadingOverlay")
  if (overlay) overlay.style.display = "none"
}

function handleClientRequest(e) {
  e.preventDefault()

  // Previne múltiplos submits
  if (e.target.dataset.submitting === 'true') {
    return
  }

  // Valida descrição mínima (pelo menos 20 caracteres)
  const motivoField = document.getElementById("clientMotivoChamado")
  const descricao = motivoField ? motivoField.value.trim() : ""
  const MIN_DESCRICAO = 20

  if (descricao.length < MIN_DESCRICAO) {
    showToast(`Descreva o problema com pelo menos ${MIN_DESCRICAO} caracteres (atual: ${descricao.length})`, "error")
    if (motivoField) motivoField.focus()
    return
  }

  e.target.dataset.submitting = 'true'

  // Mostra loading
  showClientLoading()
  
  // Pega valores dos campos (podem vir da seleção ou digitados manualmente)
  const equipField = document.getElementById("clientEquipamento")
  const serieField = document.getElementById("clientNumeroSerie")
  
  let application = equipField ? equipField.value.trim() : ""
  let serial_number = serieField ? serieField.value.trim() : ""
  
  // Se não tiver valores nos campos, tenta usar selectedMachine
  if (!application && !serial_number && !machinePending && selectedMachine) {
    application = selectedMachine.model || ""
    serial_number = selectedMachine.serial_number || ""
  }
  
  // Pega imagens do array global (múltiplas)
  const imageFiles = window.selectedImages ? window.selectedImages.map(img => img.file) : []

  // Constrói FormData para enviar imagens junto
  const formData = new FormData()
  formData.append("client_username", localStorage.getItem("clientUsername") || document.getElementById("clientNome").value)
  const requesterProfile = localStorage.getItem("clientProfileName") || ""
  if (requesterProfile) formData.append("requester_name", requesterProfile)
  formData.append("application", application || "")
  formData.append("serial_number", serial_number || "")
  formData.append("call_reason", document.getElementById("clientMotivoChamado").value || "")
  formData.append("problem_description", document.getElementById("clientMotivoChamado").value || "")
  formData.append("machine_pending", machinePending ? "true" : "false")

  // Adiciona todas as imagens com o nome correto esperado pelo backend
  if (imageFiles.length > 0) {
    imageFiles.forEach(file => {
      formData.append("problem_images", file)
    })
  }
  
  fetch(`${API_URL}/api/requests`, {
    method: "POST",
    body: formData,
  })
    .then((res) => {
      if (!res.ok) throw new Error("Erro ao enviar solicitação")
      return res.json()
    })
    .then((data) => {
      e.target.dataset.submitting = 'false'
      hideClientLoading()
      showToast("Solicitação de manutenção enviada com sucesso!", "success")
      e.target.reset()
      document.getElementById("clientNome").value = localStorage.getItem("clientName") || ""
      // Limpa preview das imagens e array global
      window.selectedImages = []
      window.updatePhotoCount()
      window.renderImagePreviews()
      // Reseta seleção de máquina e checkbox
      const sel = document.getElementById("clientMachineSelect")
      if (sel) sel.value = ""
      const chk = document.getElementById("clientMachinePending")
      if (chk) chk.checked = false
      // Limpa campos de equipamento e série
      const equipField = document.getElementById("clientEquipamento")
      const serieField = document.getElementById("clientNumeroSerie")
      if (equipField) equipField.value = ""
      if (serieField) serieField.value = ""
      // Reabilita campos
      if (sel) sel.disabled = false
      if (equipField) equipField.disabled = false
      if (serieField) serieField.disabled = false
      selectedMachine = null
      machinePending = false
    })
    .catch(() => {
      e.target.dataset.submitting = 'false'
      hideClientLoading()
      showToast("Erro ao enviar solicitação. Tente novamente.", "error")
    })
}

/**
 * Processa o envio de uma avaliação de atendimento. Armazena a
 * avaliação no localStorage em "ratings".
 */
function handleRating(e) {
  e.preventDefault()
  const ratingObj = {
    osNumber: document.getElementById("ratingOS").value,
    rating: document.getElementById("ratingValue").value,
    comment: document.getElementById("ratingComment").value,
    createdAt: new Date().toISOString(),
  }
  const osNumber = ratingObj.osNumber
  const ratingValue = ratingObj.rating
  const comment = ratingObj.comment
  const clientUsername = localStorage.getItem("clientName")
  if (!osNumber) {
    showToast("Informe o número da OS.", "error")
    return
  }
  // Busca o ID da OS no backend usando o número
  fetch(`${API_URL}/api/os?search=${encodeURIComponent(osNumber)}`)
    .then((res) => res.json())
    .then((osList) => {
      if (!Array.isArray(osList) || osList.length === 0) throw new Error("OS não encontrada")
      const osId = osList[0].id
      // Envia avaliação para o backend
      return fetch(`${API_URL}/api/ratings`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ os_id: osId, client_username: clientUsername, rating: ratingValue, comment }),
      })
    })
    .then((res) => {
      if (!res.ok) throw new Error("Erro ao registrar avaliação")
      return res.json()
    })
    .then(() => {
      // Salva localmente
      const ratings = JSON.parse(localStorage.getItem("ratings") || "[]")
      ratings.push(ratingObj)
      localStorage.setItem("ratings", JSON.stringify(ratings))
      showToast("Avaliação enviada com sucesso!", "success")
      e.target.reset()
      document.querySelectorAll(".star").forEach((s) => s.classList.remove("active"))
    })
    .catch((err) => {
      console.error(err)
      showToast(err.message || "Erro ao enviar avaliação.", "error")
    })
}

// ╔═══════════════════════════════════════════════════════════════════════════════╗
// ║                       SEÇÃO 8: HISTÓRICO E FILTROS                            ║
// ╚═══════════════════════════════════════════════════════════════════════════════╝

/**
 * Filtra o histórico de ordens de serviço e solicitações por máquina.
 * Organiza os resultados agrupados por máquina para facilitar a visualização.
 */
async function filterClientHistory() {
  const filterMachine = document.getElementById("filterMachine")
  const selectedSerial = filterMachine ? filterMachine.value : ""

  // Salva filtro no estado
  if (window.clientStateManager) {
    window.clientStateManager.saveFilters({
      machineSerial: selectedSerial
    })
  }

  const container = document.getElementById("clientHistoryList")
  if (!container) return

  // Loading
  container.innerHTML = '<div style="text-align:center;padding:2rem;"><p>Carregando...</p></div>'

  try {
    const clientUsername = localStorage.getItem("clientUsername")
    const companyId = localStorage.getItem("clientCompanyId")
    if (!clientUsername) {
      container.innerHTML = '<p class="empty-state">Erro: usuário não identificado</p>'
      return
    }

    // Busca OS e solicitações do backend
    const osUrl = companyId ? `${API_URL}/api/os?company_id=${encodeURIComponent(companyId)}` : `${API_URL}/api/os`
    const reqUrl = `${API_URL}/api/requests?client=${encodeURIComponent(clientUsername)}`
    const [osRes, reqRes] = await Promise.all([ fetch(osUrl), fetch(reqUrl) ])

    const osList = osRes.ok ? await osRes.json() : []
    const requests = reqRes.ok ? await reqRes.json() : []

    // Combina OS e solicitações
    const allItems = [
      ...(Array.isArray(osList) ? osList : []).map((os) => ({
        ...os,
        type: "os",
        osNumber: os.order_number || os.id,
        aplicacao: os.equipment || os.application || "N/A",
        numeroSerie: os.serial_number || "N/A",
        dataProgramada: os.scheduled_date || os.created_at,
        status: os.status
      })),
      ...(Array.isArray(requests) ? requests : []).map((req) => ({
        ...req,
        type: "request",
        osNumber: `SOL-${req.id}`,
        aplicacao: req.application || "N/A",
        numeroSerie: req.serial_number || "N/A",
        dataProgramada: req.preferred_date || req.created_at,
        status: req.status || "pending"
      }))
    ]

    let filtered = allItems

    // Aplica filtro por máquina (número de série)
    if (selectedSerial) {
      filtered = filtered.filter((item) =>
        item.numeroSerie === selectedSerial
      )
    }

    if (filtered.length === 0) {
      container.innerHTML = '<p class="empty-state">Nenhuma O.S encontrada com os filtros aplicados</p>'
      return
    }

    // Ordena por data mais recente primeiro
    filtered.sort((a, b) => {
      const dateA = new Date(a.dataProgramada)
      const dateB = new Date(b.dataProgramada)
      return dateB - dateA
    })

    // Agrupa por máquina se não houver filtro selecionado
    if (!selectedSerial) {
      // Agrupa por número de série
      const groupedByMachine = {}
      filtered.forEach(item => {
        const serial = item.numeroSerie || "Sem Número de Série"
        if (!groupedByMachine[serial]) {
          groupedByMachine[serial] = {
            machine: serial,
            model: item.aplicacao,
            items: []
          }
        }
        groupedByMachine[serial].items.push(item)
      })

      // Renderiza agrupado
      let html = ""
      Object.keys(groupedByMachine).forEach(serial => {
        const group = groupedByMachine[serial]
        html += `
          <div class="machine-group" style="margin-bottom: 2rem;">
            <h3 style="color: var(--text-primary); margin-bottom: 1rem; padding-bottom: 0.5rem; border-bottom: 2px solid var(--border-color);">
              ${group.model} - ${serial}
            </h3>
            <div class="machine-os-list">
              ${group.items.map((item) => `
                <div class="history-item" onclick="viewClientOSDetails(${item.id}, '${item.type}')">
                  <div class="history-item-info">
                    <h3>${item.osNumber}</h3>
                    <p><strong>Data:</strong> ${new Date(item.dataProgramada).toLocaleDateString("pt-BR")}</p>
                  </div>
                  <div class="history-item-status">
                    <span class="status-badge ${item.status}">${getStatusText(item.status)}</span>
                    ${item.type === "request" ? '<span class="type-badge">Solicitação</span>' : '<span class="type-badge completed-badge">OS Completa</span>'}
                  </div>
                </div>
              `).join("")}
            </div>
          </div>
        `
      })
      container.innerHTML = html
    } else {
      // Renderiza lista simples quando há filtro de máquina
      container.innerHTML = filtered
        .map((item) => `
          <div class="history-item" onclick="viewClientOSDetails(${item.id}, '${item.type}')">
              <div class="history-item-info">
                  <h3>${item.osNumber}</h3>
                  <p><strong>Aplicação:</strong> ${item.aplicacao}</p>
                  <p><strong>Data:</strong> ${new Date(item.dataProgramada).toLocaleDateString("pt-BR")}</p>
                  ${item.numeroSerie && item.numeroSerie !== "N/A" ? `<p><strong>Nº Série:</strong> ${item.numeroSerie}</p>` : ""}
              </div>
              <div class="history-item-status">
                  <span class="status-badge ${item.status}">${getStatusText(item.status)}</span>
                  ${item.type === "request" ? '<span class="type-badge">Solicitação</span>' : '<span class="type-badge completed-badge">OS Completa</span>'}
              </div>
          </div>
        `).join("")
    }
  } catch (err) {
    console.error('Erro ao filtrar histórico:', err)
    container.innerHTML = '<p class="error-state">Erro ao carregar histórico</p>'
    showToast("Erro ao carregar histórico", "error")
  }
}

/**
 * Filtra o histórico interno da página (função não utilizada diretamente
 * nesta versão, mas mantida para compatibilidade). Mantém-se aqui
 * para referência futura caso seja necessário.
 */
function filterHistory() {
  const query = document.getElementById("filterOS").value.toLowerCase()
  const osList = JSON.parse(localStorage.getItem("osList") || "[]")
  const filtered = osList.filter(
    (os) => os.osNumber.toLowerCase().includes(query) || os.aplicacao.toLowerCase().includes(query),
  )
  const container = document.getElementById("historyList")
  if (!container) return
  if (filtered.length === 0) {
    container.innerHTML = '<p class="empty-state">Nenhuma O.S encontrada</p>'
    return
  }
  container.innerHTML = filtered
    .map(
      (os) => `
        <div class="history-item">
            <div class="history-item-info">
                <h3>OS #${os.osNumber}</h3>
                <p>${os.aplicacao} - ${new Date(os.dataProgramada).toLocaleDateString("pt-BR")}</p>
            </div>
            <span class="status-badge ${os.status}">${os.status === "pending" ? "Pendente" : "Concluída"}</span>
        </div>
    `,
    )
    .join("")
}

// ╔═══════════════════════════════════════════════════════════════════════════════╗
// ║                       SEÇÃO 9: MODAL DE DETALHES                              ║
// ╚═══════════════════════════════════════════════════════════════════════════════╝

/**
 * Exibe detalhes de uma solicitação ou OS na visão do cliente. Se for
 * uma OS concluída, mostra informações resumidas; caso seja uma
 * solicitação ainda pendente, mostra detalhes da solicitação.
 * @param {number} id Identificador da OS ou solicitação
 * @param {string} type Tipo do item: 'os' ou 'request'
 */
async function viewClientOSDetails(id, type) {
  const modal = document.getElementById("clientOSModal")
  const details = document.getElementById("clientOSDetails")
  if (!modal || !details) return

  // Mostra loading
  details.innerHTML = '<div style="text-align: center; padding: 2rem;">Carregando...</div>'
  modal.classList.add("active")

  try {
    let item
    if (type === "os") {
      const res = await fetch(`${API_URL}/api/os/${id}`)
      if (!res.ok) throw new Error('OS não encontrada')
      item = await res.json()
    } else {
      const res = await fetch(`${API_URL}/api/requests/${id}`)
      if (!res.ok) throw new Error('Solicitação não encontrada')
      item = await res.json()
    }

    if (!item) {
      details.innerHTML = '<div style="text-align: center; padding: 2rem;">Dados não encontrados</div>'
      return
    }
    // Para a versão atual, não exibimos avaliação de atendimento.  Apenas mostramos
    // as informações da OS e o resumo do serviço.  A seção de avaliação foi removida.
    if (type === "os") {
      details.innerHTML = `
          <div class="detail-section">
              <h3>Informações do Serviço</h3>
              <div class="detail-grid">
                  <div class="detail-field">
                      <label>Número da OS</label>
                      <span>${item.order_number || item.id}</span>
                  </div>
                  <div class="detail-field">
                      <label>Data do Serviço</label>
                      <span>${item.scheduled_date ? new Date(item.scheduled_date).toLocaleDateString("pt-BR") : "N/A"}</span>
                  </div>
                  <div class="detail-field">
                      <label>Aplicação</label>
                      <span>${item.application || "N/A"}</span>
                  </div>
                  <div class="detail-field">
                      <label>Tipo de Manutenção</label>
                      <span>${item.maintenance_type || "N/A"}</span>
                  </div>
              </div>
          </div>
          <div class="detail-section">
              <h3>Resumo do Atendimento</h3>
              <div class="client-summary">
                  <p><strong>O que foi feito:</strong></p>
                  <p>${item.service_description || "Informação não disponível"}</p>
                  ${item.observations ? `<p style="margin-top: 1rem;"><strong>Observações:</strong></p><p>${item.observations}</p>` : ""}
                  <div class="service-info">
                      <p><strong>Técnico Responsável:</strong> ${item.technician_name || "N/A"}</p>
                      <p><strong>Tempo de Atendimento:</strong> ${item.total_hours ? formatHours(item.total_hours) : "N/A"}</p>
                  </div>
              </div>
          </div>
      `
    } else {
      // Detalhes de uma solicitação pendente
      details.innerHTML = `
          <div class="detail-section">
              <h3>Solicitação de Manutenção</h3>
              <div class="detail-grid">
                  <div class="detail-field">
                      <label>Número da Solicitação</label>
                      <span>#${item.id}</span>
                  </div>
                  <div class="detail-field">
                      <label>Data da Solicitação</label>
                      <span>${item.created_at ? new Date(item.created_at).toLocaleString("pt-BR") : "N/A"}</span>
                  </div>
                  <div class="detail-field">
                      <label>Aplicação</label>
                      <span>${item.application || "N/A"}</span>
                  </div>
                  <div class="detail-field">
                      <label>Número de Série</label>
                      <span>${item.serial_number || "N/A"}</span>
                  </div>
                  <div class="detail-field">
                      <label>Data Preferida</label>
                      <span>${item.preferred_datetime ? new Date(item.preferred_datetime).toLocaleString("pt-BR") : "N/A"}</span>
                  </div>
                  <div class="detail-field">
                      <label>Contato</label>
                      <span>${item.contact || "N/A"}</span>
                  </div>
              </div>
          </div>
          <div class="detail-section">
              <h3>Descrição do Problema</h3>
              <div class="client-summary">
                  <p><strong>Motivo:</strong> ${item.call_reason || "N/A"}</p>
                  <p style="margin-top: 1rem;"><strong>Descrição:</strong></p>
                  <p>${item.problem_description || "N/A"}</p>
                  ${item.suggested_maintenance ? `<p style="margin-top: 1rem;"><strong>Tipo Sugerido:</strong> ${item.suggested_maintenance}</p>` : ""}
              </div>
          </div>
          <div class="detail-section">
              <div class="status-info ${item.status || 'pending'}">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <circle cx="12" cy="12" r="10"></circle>
                      <path d="M12 6v6l4 2"></path>
                  </svg>
                  <div>
                      <p><strong>Status:</strong> ${getStatusText(item.status || 'pending')}</p>
                      <p class="status-description">Sua solicitação foi recebida e está sendo processada. Entraremos em contato em breve.</p>
                  </div>
              </div>
          </div>
      `
    }
  } catch (error) {
    console.error('Erro ao carregar detalhes:', error)
    details.innerHTML = '<div style="text-align: center; padding: 2rem; color: red;">Erro ao carregar dados</div>'
  }
}

/**
 * Fecha o modal de detalhes do cliente.
 */
function closeClientModal() {
  const modal = document.getElementById("clientOSModal")
  if (modal) modal.classList.remove("active")
}

/**
 * Retorna uma tradução de status para exibição ao cliente.
 * @param {string} status Status original armazenado
 */
function getStatusText(status) {
  const statusMap = {
    pending: "Pendente",
    assigned: "Atribuída",
    in_progress: "Em Andamento",
    pending_review: "Em Conferência",
    completed: "Concluída",
    archived: "Arquivada",
    cancelled: "Cancelada",
    on_hold: "Em Espera",
  }
  return statusMap[status] || "Pendente"
}
