/**
 * ╔═══════════════════════════════════════════════════════════════════════════════╗
 * ║                      PAINEL DO TÉCNICO - MATH HELSEN                          ║
 * ╠═══════════════════════════════════════════════════════════════════════════════╣
 * ║  Sistema de gestão de OS para técnicos - aceitar, executar e finalizar OS     ║
 * ╚═══════════════════════════════════════════════════════════════════════════════╝
 *
 * ┌─────────────────────────────────────────────────────────────────────────────┐
 * │                           ÍNDICE DO ARQUIVO                                  │
 * ├─────────────────────────────────────────────────────────────────────────────┤
 * │                                                                              │
 * │  SEÇÃO 1: CONFIGURAÇÕES E STORAGE ............................ linha ~30    │
 * │    - API_URL, localStorage helpers, parseAsLocalTime                        │
 * │                                                                              │
 * │  SEÇÃO 2: WEBSOCKET E AUTO-REFRESH ........................... linha ~60    │
 * │    - connectWebSocket, startAutoRefresh, stopAutoRefresh                    │
 * │                                                                              │
 * │  SEÇÃO 3: UI HELPERS ......................................... linha ~145   │
 * │    - showToast, setupAutoRewrite, escapeHtml                                │
 * │                                                                              │
 * │  SEÇÃO 4: ÁUDIO E TRANSCRIÇÃO ................................ linha ~420   │
 * │    - initAudioRecording, handleRecordAudioClick, transcrição                │
 * │                                                                              │
 * │  SEÇÃO 5: TEMA E INICIALIZAÇÃO ............................... linha ~965   │
 * │    - initializeTheme, initThemeToggle, initLogoutButton                     │
 * │                                                                              │
 * │  SEÇÃO 6: AUTENTICAÇÃO ....................................... linha ~1035  │
 * │    - checkTechnicianLogin, handleTechnicianLogin, logout                    │
 * │                                                                              │
 * │  SEÇÃO 7: LISTAGEM DE OS ..................................... linha ~1160  │
 * │    - loadOSList, downloadOS, translateStatus                                │
 * │                                                                              │
 * │  SEÇÃO 8: PREVIEW E MODAL DE OS .............................. linha ~1312  │
 * │    - openPreviewOsModal, loadCallInfoForPreview, acceptOS                   │
 * │                                                                              │
 * │  SEÇÃO 9: FINALIZAÇÃO DE OS .................................. linha ~1595  │
 * │    - openFinishModal, handleFinishSubmit, autoSaveFormData                  │
 * │                                                                              │
 * │  SEÇÃO 10: MATERIAIS E DESLOCAMENTOS ......................... linha ~2325  │
 * │    - addMaterialLine, addDisplacementRow, addTimeEntryRow                   │
 * │                                                                              │
 * │  SEÇÃO 11: MÁQUINAS .......................................... linha ~2655  │
 * │    - populateMachineSelect, getMachinesForCompany                           │
 * │                                                                              │
 * │  SEÇÃO 12: ASSINATURAS ....................................... linha ~3170  │
 * │    - initSignatureFeature, saveTechnicianSignature                          │
 * │                                                                              │
 * │  SEÇÃO 13: EMPRESAS E HISTÓRICO .............................. linha ~3820  │
 * │    - searchCompanies, loadCompanyMachines, viewOSHistory                    │
 * │                                                                              │
 * │  SEÇÃO 14: CRIAR OS PRÓPRIA .................................. linha ~4285  │
 * │    - openCreateOwnOSModal, submitCreateOwnOS                                │
 * │                                                                              │
 * │  SEÇÃO 15: INICIALIZAÇÃO DO DOM .............................. linha ~4475  │
 * │    - DOMContentLoaded, setupEventListeners                                  │
 * │                                                                              │
 * └─────────────────────────────────────────────────────────────────────────────┘
 */

// ╔═══════════════════════════════════════════════════════════════════════════════╗
// ║                    SEÇÃO 1: CONFIGURAÇÕES E STORAGE                           ║
// ╚═══════════════════════════════════════════════════════════════════════════════╝

// URL base da API do backend
const API_URL = "https://hs-back-production-f54a.up.railway.app"

// --- Helpers de localStorage ---
function getStoredTechnicianId() {
  return localStorage.getItem("technicianId")
}

function setStoredTechnicianId(id) {
  if (id) localStorage.setItem("technicianId", id)
}

// Assinatura fica apenas em memória da sessão - se sair da página, perde
// (não usa localStorage para não persistir entre sessões)
let _technicianSignatureInMemory = null

function getStoredTechnicianSignature() {
  return _technicianSignatureInMemory
}

function setStoredTechnicianSignature(sig) {
  _technicianSignatureInMemory = sig
}

/**
 * Converte string de data (que pode conter Z de UTC) para Date tratando como horário local
 * CORRIGE O PROBLEMA DE FUSO HORÁRIO: técnico coloca 14:00, deve aparecer 14:00 sempre
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
 * Formata Date para string compatível com datetime-local input (YYYY-MM-DDTHH:MM)
 * SEM conversão de timezone
 * @param {Date} date - Objeto Date
 * @returns {string} - String no formato YYYY-MM-DDTHH:MM
 */
function formatForDatetimeLocal(date) {
  if (!date || !(date instanceof Date) || isNaN(date.getTime())) return ''
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  const hours = String(date.getHours()).padStart(2, '0')
  const minutes = String(date.getMinutes()).padStart(2, '0')
  return `${year}-${month}-${day}T${hours}:${minutes}`
}

/**
 * Cria um select de hora com intervalos de 30 minutos (00:00, 00:30, 01:00, ..., 23:30)
 * Retorna um elemento <select> estilizado para mobile (scroll picker)
 * @param {string} className - Classe CSS do select
 * @param {string} initialValue - Valor inicial no formato "HH:MM" (ex: "08:30")
 * @returns {HTMLSelectElement}
 */
function createTimeSelect(className, initialValue = '') {
  const select = document.createElement("select")
  select.className = className
  select.required = true
  select.style.padding = "0.5rem"
  select.style.background = "var(--bg-input)"
  select.style.border = "1px solid var(--border-color)"
  select.style.borderRadius = "6px"
  select.style.color = "var(--text-primary)"
  select.style.fontSize = "1rem"
  select.style.minWidth = "90px"
  select.style.cursor = "pointer"
  select.style.appearance = "none"
  select.style.webkitAppearance = "none"
  select.style.backgroundImage = "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%23888' stroke-width='2'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E\")"
  select.style.backgroundRepeat = "no-repeat"
  select.style.backgroundPosition = "right 8px center"
  select.style.paddingRight = "28px"

  // Opção vazia
  const emptyOpt = document.createElement("option")
  emptyOpt.value = ""
  emptyOpt.textContent = "--:--"
  select.appendChild(emptyOpt)

  // Gera opções de 00:00 a 23:30 (de 30 em 30 min)
  for (let h = 0; h < 24; h++) {
    for (let m = 0; m < 60; m += 30) {
      const hStr = String(h).padStart(2, '0')
      const mStr = String(m).padStart(2, '0')
      const timeValue = `${hStr}:${mStr}`

      const opt = document.createElement("option")
      opt.value = timeValue
      opt.textContent = timeValue
      select.appendChild(opt)
    }
  }

  // Define valor inicial (arredonda para 30 min mais próximo se necessário)
  if (initialValue) {
    const [hh, mm] = initialValue.split(':').map(Number)
    if (!isNaN(hh) && !isNaN(mm)) {
      // Arredonda minutos para 0 ou 30
      const roundedMin = mm < 15 ? 0 : (mm < 45 ? 30 : 0)
      const roundedHour = mm >= 45 ? (hh + 1) % 24 : hh
      const roundedValue = `${String(roundedHour).padStart(2, '0')}:${String(roundedMin).padStart(2, '0')}`
      select.value = roundedValue
    }
  }

  return select
}

// ╔═══════════════════════════════════════════════════════════════════════════════╗
// ║                    SEÇÃO 2: WEBSOCKET E AUTO-REFRESH                          ║
// ╚═══════════════════════════════════════════════════════════════════════════════╝

let autoRefreshInterval = null
let socket = null

function connectWebSocket() {
  if (socket && socket.connected) {
    console.log('🔌 WebSocket já conectado')
    return
  }

  const techId = getStoredTechnicianId()
  const techName = localStorage.getItem("technicianName")

  if (!techId) {
    console.log('⚠️ Não foi possível conectar WebSocket: techId não encontrado')
    return
  }

  console.log('🔌 Conectando WebSocket para técnico:', { id: techId, username: techName })

  socket = io(API_URL, {
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionDelay: 1000,
    reconnectionAttempts: 5
  })

  socket.on('connect', () => {
    console.log('✅ WebSocket conectado! Socket ID:', socket.id)
    socket.emit('identify', { userType: 'technician', userId: techId, username: techName })
    console.log('📤 Identificação enviada:', { userType: 'technician', userId: techId, username: techName })
  })

  socket.on('disconnect', () => {
    console.log('❌ WebSocket desconectado')
  })

  socket.on('connect_error', (error) => {
    console.error('❌ Erro de conexão WebSocket:', error)
  })

  // Nova OS atribuída a este técnico
  socket.on('new_os', (data) => {
    console.log('📢 Nova OS recebida via WebSocket:', data)
    const notificationText = data.order_number
      ? `Nova O.S ${data.order_number} atribuída!`
      : `Nova Solicitação de Serviço atribuída!`
    showToast(notificationText, 'success')
    loadOSList()
  })

  // Log de qualquer evento WebSocket (para debug)
  socket.onAny((eventName, ...args) => {
    console.log('🔔 WebSocket evento recebido:', eventName, args)
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
  
  // Auto-refresh a cada 15 segundos
  autoRefreshInterval = setInterval(() => {
    const techSection = document.getElementById('technician-section')
    if (techSection && techSection.style.display !== 'none') {
      loadOSList()
    }
  }, 15000)
}

function stopAutoRefresh() {
  if (autoRefreshInterval) {
    clearInterval(autoRefreshInterval)
    autoRefreshInterval = null
  }
}

// ╔═══════════════════════════════════════════════════════════════════════════════╗
// ║                          SEÇÃO 3: UI HELPERS                                  ║
// ╚═══════════════════════════════════════════════════════════════════════════════╝
function showToast(message, type = "success") {
  const toast = document.getElementById("toast")
  if (!toast) return
  toast.textContent = message
  toast.className = `toast ${type} show`
  setTimeout(() => toast.classList.remove("show"), 3000)
}

document.addEventListener("DOMContentLoaded", () => {
  // Limpa assinaturas antigas do cache (não devem mais ser salvas)
  Object.keys(localStorage)
    .filter(key => key.startsWith('technicianSignature:'))
    .forEach(key => localStorage.removeItem(key))

  const loginForm = document.getElementById("technicianLoginForm")
  if (loginForm) {
    console.log("[INIT] Form de login encontrado, vinculando evento...")
    // Remove qualquer listener anterior
    loginForm.removeEventListener("submit", handleTechnicianLogin)
    // Adiciona com captura
    loginForm.addEventListener("submit", handleTechnicianLogin, true)
  } else {
    console.warn("[INIT] Form de login NAO encontrado!")
  }

  const closeBtn = document.getElementById("closeModal")
  if (closeBtn) closeBtn.addEventListener("click", closeFinishModal)

  const addMaterialBtn = document.getElementById("addMaterialBtn")
  if (addMaterialBtn) addMaterialBtn.addEventListener("click", addMaterialLine)

  const finishForm = document.getElementById("finishForm")
  if (finishForm) {
    console.log("[INIT] Form de finalização encontrado, vinculando evento...")
    // Remove qualquer listener anterior
    finishForm.removeEventListener("submit", handleFinishSubmit)
    // Adiciona com captura para garantir que preventDefault seja chamado primeiro
    finishForm.addEventListener("submit", handleFinishSubmit, true)
  } else {
    console.warn("[INIT] Form de finalização NAO encontrado!")
  }

  // Botão para adicionar novas linhas de deslocamento
  const addDispBtn = document.getElementById("addDisplacementBtn")
  if (addDispBtn) addDispBtn.addEventListener("click", () => addDisplacementRow())

  // Botão para adicionar novos períodos de trabalho
  const addTimeBtn = document.getElementById("addTimeEntryBtn")
  if (addTimeBtn) addTimeBtn.addEventListener("click", () => addTimeEntryRow())

  initThemeToggle()

  initLogoutButton()

  initSignatureFeature()
  checkTechnicianLogin()

  // Inicializa sistema de tabs
  initTechTabs()

  // Inicializa recurso de gravação de áudio
  initAudioRecording()

  // Inicializa reescrita automática da descrição digitada
  setupAutoRewriteDescription()

  // Inicializa reescrita automática da observação de serviço adicional
  setupAutoRewriteAdditionalNote()

  // Inicializa o chatbot para suporte via Assistants
  initChat()

  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("./service-worker.js")
        .then(registration => {
          console.log("Service Worker registered successfully:", registration)
        })
        .catch(error => {
          console.log("Service Worker registration failed:", error)
        })
    })
  }

  let deferredPrompt = null
  
  // Função para criar botão PWA
  function createInstallButton() {
    console.log("PWA: Tentando criar botão de instalação...")

    // NÃO criar botão se já está instalado como PWA
    const isInstalledPWA = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone
    if (isInstalledPWA) {
      console.log("PWA: App já instalado - botão não será criado")
      return
    }

    const headerActions = document.querySelector(".header-actions")
    console.log("PWA: Procurando .header-actions:", headerActions)

    if (!headerActions) {
      console.log("PWA: .header-actions não encontrado! Tentando novamente em 1s...")
      setTimeout(createInstallButton, 1000)
      return
    }

    if (document.getElementById("installAppBtn")) {
      console.log("PWA: Botão já existe")
      return
    }
    
    const btn = document.createElement("button")
    btn.id = "installAppBtn"
    btn.className = "btn-secondary"
    btn.innerHTML = `
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-right: 0.5rem;">
        <rect x="5" y="2" width="14" height="20" rx="2" ry="2"/>
        <line x1="12" y1="18" x2="12.01" y2="18"/>
      </svg>
      Instalar App
    `
    btn.style.marginRight = "0.5rem"
    btn.style.display = "flex"
    btn.style.alignItems = "center"
    btn.title = "Instalar aplicativo na tela inicial"
    
    btn.addEventListener("click", async () => {
      console.log("PWA: Botão clicado!")

      if (deferredPrompt) {
        console.log("PWA: Usando prompt nativo do navegador")
        try {
          // Mostra o prompt de instalação nativo
          deferredPrompt.prompt()
          // Aguarda a escolha do usuário
          const result = await deferredPrompt.userChoice
          console.log("PWA: Escolha do usuário:", result.outcome)

          if (result.outcome === 'in_progress') {
            console.log('PWA: Instalação aceita!')
            showToast('App instalado com sucesso!', 'success')
            btn.remove()
          } else {
            console.log('PWA: Instalação recusada')
          }

          // Limpa o prompt usado
          deferredPrompt = null
        } catch (e) {
          console.error("PWA: Erro ao mostrar prompt:", e)
          showToast('Erro ao instalar. Tente pelo menu do navegador.', 'error')
        }
      } else {
        console.log("PWA: Sem prompt nativo disponível - não foi possível instalar")
        showToast('Aguarde... O app está sendo preparado para instalação.', 'info')

        // Se não tem o prompt nativo, significa que:
        // - Ainda não carregou (aguarda evento beforeinstallprompt)
        // - Já está instalado
        // - Falta algo no manifest/service-worker
        // - Não está em HTTPS

        // Remove o botão pois não pode instalar agora
        btn.remove()
      }
    })
    
    headerActions.insertBefore(btn, headerActions.firstChild)
    console.log("PWA: Botão criado e adicionado!")
  }
  
  // Captura evento PWA quando disponível (só funciona em HTTPS)
  window.addEventListener("beforeinstallprompt", (e) => {
    console.log("✅ PWA: Evento beforeinstallprompt capturado - app pode ser instalado!")
    e.preventDefault()
    deferredPrompt = e

    // Cria o botão quando o evento é capturado
    createInstallButton()
  })

  // Evento disparado quando app é instalado
  window.addEventListener('appinstalled', (e) => {
    console.log('✅ PWA: App foi instalado com sucesso!')
    showToast('App instalado! Você pode acessá-lo pela tela inicial.', 'success')
    const btn = document.getElementById("installAppBtn")
    if (btn) btn.remove()
    deferredPrompt = null
  })

  // Verifica se está rodando como PWA
  const isInstalledPWA = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone
  if (isInstalledPWA) {
    console.log('✅ PWA: Rodando como aplicativo instalado - botão não será exibido')
  } else {
    console.log('ℹ️ PWA: Aguardando evento beforeinstallprompt para criar botão...')
    // NÃO cria o botão automaticamente - só quando o evento beforeinstallprompt for disparado
  }
})

/**
 * Configura o campo de descrição para que, ao digitar ou sair do campo,
 * o texto seja enviado ao backend para reescrita técnica via Assistant.
 * O texto retornado substitui o conteúdo do campo, mantendo eventuais
 * modificações posteriores do usuário se ele continuar digitando.
 */
function setupAutoRewriteDescription() {
  const descField = document.getElementById('finishDescription')
  if (!descField) return
  let timer = null
  const DEBOUNCE_MS = 800
  async function rewriteNow() {
    const raw = (descField.value || '').trim()
    if (!raw) return
    try {
      const resp = await fetch(`${API_URL}/api/text/rewrite`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: raw })
      })
      const data = await resp.json()
      if (resp.ok && data && typeof data.description === 'string' && data.description.trim()) {
        // Só atualiza se o usuário não digitou algo totalmente diferente no meio
        const current = (descField.value || '').trim()
        if (current.startsWith(raw.slice(0, 5))) {
          descField.value = data.description.trim()
        }
      }
    } catch (err) {
      // falha silenciosa
    }
  }
  // Reescreve apenas quando o usuário sair do campo.
  // A chamada automática a cada digitação foi removida para evitar
  // substituir texto enquanto o técnico ainda está digitando.
  descField.addEventListener('blur', () => {
    if (timer) clearTimeout(timer)
    rewriteNow()
  })
}

/**
 * Configura o campo de observação do serviço adicional para que, ao digitar ou sair do campo,
 * o texto seja enviado ao backend para reescrita técnica via Assistant. O texto retornado
 * substitui o conteúdo do campo, mantendo eventuais modificações posteriores do usuário se
 * ele continuar digitando. Funciona de forma idêntica à reescrita da descrição principal.
 */
function setupAutoRewriteAdditionalNote() {
  const noteField = document.getElementById('finishAdditionalServiceNote')
  if (!noteField) return
  let timer = null
  const DEBOUNCE_MS = 800
  async function rewriteNow() {
    const raw = (noteField.value || '').trim()
    if (!raw) return
    try {
      const resp = await fetch(`${API_URL}/api/text/rewrite`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: raw })
      })
      const data = await resp.json()
      if (resp.ok && data && typeof data.description === 'string' && data.description.trim()) {
        const current = (noteField.value || '').trim()
        if (current.startsWith(raw.slice(0, 5))) {
          noteField.value = data.description.trim()
        }
      }
    } catch (_err) {
      // falha silenciosa
    }
  }
  // Reescreve apenas quando o usuário sair do campo.
  noteField.addEventListener('blur', () => {
    if (timer) clearTimeout(timer)
    rewriteNow()
  })
}

// ╔═══════════════════════════════════════════════════════════════════════════════╗
// ║                       SEÇÃO 4: ÁUDIO E TRANSCRIÇÃO                            ║
// ╚═══════════════════════════════════════════════════════════════════════════════╝
let mediaRecorder = null
let recordedChunks = []

// Gravador de áudio específico para o chat de suporte
let chatMediaRecorder = null
let chatRecordedChunks = []

// Armazena a imagem anexada pelo técnico antes do envio
let attachedImage = null

/**
 * Inicializa o recurso de upload de imagem para o chat. Configura o botão e
 * o campo de input para que, ao selecionar uma imagem, ela seja lida como
 * data URL, exibida no chat e enviada ao assistente através da API.
 */
function initChatImageUpload() {
  const imgBtn = document.getElementById('chatImageBtn')
  const imgInput = document.getElementById('chatImageInput')
  if (!imgBtn || !imgInput) return
  // Ao clicar no botão, delega para o input oculto
  imgBtn.addEventListener('click', () => {
    imgInput.click()
  })
  // Ao selecionar um arquivo, processa a imagem
  imgInput.addEventListener('change', handleChatImageSelect)
}

/**
 * Trata a seleção de imagem no chat. Converte o arquivo em Data URL,
 * exibe a imagem na interface e envia a mensagem ao assistente.
 */
async function handleChatImageSelect(ev) {
  const input = ev.target
  if (!input || !input.files || input.files.length === 0) return
  const file = input.files[0]
  // Limpa o input para permitir seleção da mesma imagem novamente
  input.value = ''
  if (!file || !file.type.startsWith('image/')) return
  const reader = new FileReader()
  reader.onload = () => {
    // Salva a imagem como Data URL para envio posterior
    attachedImage = reader.result
    // Mostra pré-visualização no chat antes do envio
    showAttachmentPreview()
  }
  reader.readAsDataURL(file)
}

/**
 * Adiciona uma imagem como mensagem no chat. Cria um elemento de imagem
 * encapsulado dentro de uma div que herda classes de estilo com base na
 * origem (usuário ou assistente).
 * @param {string} dataUrl Data URL da imagem
 * @param {'user'|'assistant'} role Papel da mensagem
 */
function appendChatImage(dataUrl, role) {
  const chatMessages = document.getElementById('chatMessages')
  if (!chatMessages) return
  const wrapper = document.createElement('div')
  wrapper.className = 'chat-message ' + role
  const img = document.createElement('img')
  img.src = dataUrl
  img.alt = 'Imagem'
  wrapper.appendChild(img)
  chatMessages.appendChild(wrapper)
  chatMessages.scrollTop = chatMessages.scrollHeight
}

/**
 * Exibe a imagem anexada no contêiner de pré-visualização com botão de remoção.
 */
function showAttachmentPreview() {
  const container = document.getElementById('chatPreviewContainer')
  if (!container) return
  if (!attachedImage) {
    container.style.display = 'none'
    container.innerHTML = ''
    return
  }
  container.innerHTML = ''
  const img = document.createElement('img')
  img.src = attachedImage
  img.alt = 'Anexo'
  const removeBtn = document.createElement('button')
  removeBtn.textContent = 'Remover'
  removeBtn.className = 'remove-preview'
  removeBtn.addEventListener('click', () => {
    attachedImage = null
    clearAttachmentPreview()
  })
  container.appendChild(img)
  container.appendChild(removeBtn)
  container.style.display = 'flex'
}

/**
 * Limpa a pré-visualização e esconde o contêiner.
 */
function clearAttachmentPreview() {
  const container = document.getElementById('chatPreviewContainer')
  if (container) {
    container.style.display = 'none'
    container.innerHTML = ''
  }
}

/**
 * Inicializa o botão de gravação de áudio e verifica suporte do navegador.
 */
function initAudioRecording() {
  const recordBtn = document.getElementById("recordAudioBtn")
  if (!recordBtn) return

  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    recordBtn.disabled = true
    recordBtn.title = "Seu navegador não suporta gravação de áudio"
    return
  }
  // Exibe o botão de gravação agora que há suporte
  recordBtn.style.display = ''
  recordBtn.addEventListener("click", handleRecordAudioClick)
}

async function handleRecordAudioClick(e) {
  e.preventDefault()
  const recordBtn = document.getElementById("recordAudioBtn")
  if (!recordBtn) return
  // Se ainda não iniciou, começa a gravar
  if (!mediaRecorder || mediaRecorder.state === "inactive") {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      recordedChunks = []
      // Define opções de codec para compatibilidade
      const options = { mimeType: 'audio/webm;codecs=opus', audioBitsPerSecond: 64000 }
      mediaRecorder = new MediaRecorder(stream, options)
      mediaRecorder.ondataavailable = (ev) => {
        if (ev.data && ev.data.size > 0) recordedChunks.push(ev.data)
      }
      mediaRecorder.onstop = async () => {
        try {
          const blob = new Blob(recordedChunks, { type: 'audio/webm;codecs=opus' })
          const formData = new FormData()
          formData.append('audio', blob, 'recording.webm')
          const resp = await fetch(`${API_URL}/api/os/transcribe`, {
            method: 'POST',
            body: formData
          })
          const data = await resp.json()
          if (!resp.ok) {
            showToast(data.message || 'Falha ao transcrever áudio.', 'error')
          } else {
            // Apenas atualiza a descrição do serviço (e opcionalmente o tipo de manutenção)
            if (data && (data.description || data.transcription)) {
              const descField = document.getElementById('finishDescription')
              // Sempre reescreve o texto transcrito via Assistant antes de preencher o campo.
              const originalText = String(data.transcription || data.description || '')
              let rewritten = originalText
              try {
                const rewriteResp = await fetch(`${API_URL}/api/text/rewrite`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ text: originalText })
                })
                const rewriteData = await rewriteResp.json()
                if (rewriteResp.ok && rewriteData && typeof rewriteData.description === 'string' && rewriteData.description.trim()) {
                  rewritten = rewriteData.description.trim()
                }
              } catch (_errRewrite) {
                // Se falhar ao chamar o Assistant, mantém o texto original
              }
              if (descField) descField.value = rewritten
              // Tipo de manutenção não é mais atualizado automaticamente; selecionado manualmente pelo técnico.
              showToast('Descrição preenchida a partir do áudio!', 'success')
            } else {
              showToast('Não foi possível extrair a descrição do áudio.', 'info')
            }
          }
        } catch (err) {
          console.error(err)
          showToast('Erro de rede ao enviar áudio.', 'error')
        } finally {
          // Libera microfone
          try { mediaRecorder.stream.getTracks().forEach((t) => t.stop()) } catch (_e) {}
          mediaRecorder = null
          recordBtn.classList.remove('recording', 'processing')
          recordBtn.disabled = false
          // Restaura texto original do botão
          recordBtn.innerHTML = `
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
              <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
              <line x1="12" y1="19" x2="12" y2="23"/>
              <line x1="8" y1="23" x2="16" y2="23"/>
            </svg>
            Gravar Áudio
          `
        }
      }
      mediaRecorder.start()
      // Indica gravação no botão
      recordBtn.classList.add('recording')
      // Altera texto para indicar gravação
      recordBtn.innerHTML = `
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <rect x="6" y="6" width="12" height="12" rx="2" ry="2"/>
        </svg>
        Gravando...
      `
    } catch (err) {
      console.error(err)
      showToast('Não foi possível acessar o microfone.', 'error')
    }
  } else if (mediaRecorder.state === 'recording') {
    // Finaliza gravação; onstop irá enviar o áudio
    mediaRecorder.stop()
    // Mostra estado de processamento imediatamente
    recordBtn.classList.remove('recording')
    recordBtn.classList.add('processing')
    recordBtn.disabled = true
    recordBtn.innerHTML = '<svg class="spinner-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10" opacity="0.25"/><path d="M12 2a10 10 0 0 1 10 10" stroke-linecap="round"/></svg> Processando...'
  }
}

/**
 * Inicializa o botão de gravação de áudio no chat, verificando suporte do navegador.
 * Ao clicar, grava o áudio e, quando finalizado, transcreve o conteúdo e envia
 * como mensagem no chat, retornando também a resposta do assistente.
 */
function initChatAudioRecording() {
  const chatRecordBtn = document.getElementById('chatRecordBtn')
  if (!chatRecordBtn) return
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    chatRecordBtn.disabled = true
    chatRecordBtn.title = 'Seu navegador não suporta gravação de áudio'
    return
  }
  chatRecordBtn.addEventListener('click', handleChatRecordAudioClick)
}

async function handleChatRecordAudioClick(e) {
  e.preventDefault()
  const btn = document.getElementById('chatRecordBtn')
  if (!btn) return
  // Se ainda não iniciou, começa a gravar
  if (!chatMediaRecorder || chatMediaRecorder.state === 'inactive') {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      chatRecordedChunks = []
      const options = { mimeType: 'audio/webm;codecs=opus', audioBitsPerSecond: 64000 }
      chatMediaRecorder = new MediaRecorder(stream, options)
      chatMediaRecorder.ondataavailable = (ev) => {
        if (ev.data && ev.data.size > 0) chatRecordedChunks.push(ev.data)
      }
      chatMediaRecorder.onstop = async () => {
        try {
          const blob = new Blob(chatRecordedChunks, { type: 'audio/webm;codecs=opus' })
          const formData = new FormData()
          formData.append('audio', blob, 'chatRecording.webm')
          // Transcreve o áudio utilizando o endpoint de transcrição
          const resp = await fetch(`${API_URL}/api/os/transcribe`, {
            method: 'POST',
            body: formData
          })
          const data = await resp.json()
          if (resp.ok && data && (data.description || data.transcription)) {
            const text = String(data.transcription || data.description || '').trim()
            if (text) {
              // Adiciona a mensagem do usuário no chat
              appendChatMessageExternal(text, 'user')
              // Mostra indicador "digitando..."
              showChatTypingIndicator()
              // Envia a mensagem ao assistente de chat
              try {
                const chatResp = await fetch(`${API_URL}/api/chat`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ conversationId: chatConvId || generateUUID(), message: text })
                })
                const chatData = await chatResp.json()
                hideChatTypingIndicator()
                if (chatResp.ok && chatData && typeof chatData.reply === 'string') {
                  appendChatMessageExternal(chatData.reply.trim(), 'assistant')
                } else {
                  appendChatMessageExternal('Falha ao obter resposta do assistente.', 'assistant')
                }
              } catch (err) {
                console.error(err)
                hideChatTypingIndicator()
                appendChatMessageExternal('Erro ao enviar mensagem.', 'assistant')
              }
            } else {
              appendChatMessageExternal('Não foi possível transcrever o áudio.', 'assistant')
            }
          } else {
            appendChatMessageExternal('Falha ao transcrever áudio.', 'assistant')
          }
        } catch (err) {
          console.error(err)
          appendChatMessageExternal('Erro de rede ao enviar áudio.', 'assistant')
        } finally {
          // Libera microfone e reseta gravador
          try { chatMediaRecorder.stream.getTracks().forEach((t) => t.stop()) } catch (_e) {}
          chatMediaRecorder = null
          btn.classList.remove('recording', 'processing')
          btn.disabled = false
          btn.title = 'Gravar áudio'
          // Restaura SVG do microfone
          btn.innerHTML = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
            <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
            <line x1="12" y1="19" x2="12" y2="23"/>
            <line x1="8" y1="23" x2="16" y2="23"/>
          </svg>`
        }
      }
      chatMediaRecorder.start()
      btn.classList.add('recording')
      // Troca ícone para indicar gravação
      btn.textContent = '⏹'
    } catch (err) {
      console.error(err)
      appendChatMessageExternal('Não foi possível acessar o microfone.', 'assistant')
    }
  } else if (chatMediaRecorder.state === 'recording') {
    // Mostra feedback de processamento ao parar gravação
    btn.classList.remove('recording')
    btn.classList.add('processing')
    btn.disabled = true
    btn.title = 'Processando áudio...'
    chatMediaRecorder.stop()
  }
}

/**
 * Adiciona uma mensagem ao chat (externa ao escopo de initChat),
 * criando o elemento manualmente. Utilizado pelo gravador de áudio do chat.
 * @param {string} text Texto da mensagem
 * @param {'user'|'assistant'} role Papel do emissor (usuário ou assistente)
 */
function appendChatMessageExternal(text, role) {
  const chatMessages = document.getElementById('chatMessages')
  if (!chatMessages) return
  
  const messageContainer = document.createElement('div')
  messageContainer.className = 'chat-message-container ' + role
  
  // Se for mensagem do assistente, adiciona avatar
  if (role === 'assistant') {
    const avatar = document.createElement('div')
    avatar.className = 'chat-avatar'
    avatar.innerHTML = '<img src="mate-icon.jpg" alt="MATH" class="avatar-image" />'
    avatar.title = 'MATH - Assistente IA'
    messageContainer.appendChild(avatar)
  }
  
  const messageContent = document.createElement('div')
  messageContent.className = 'chat-message-content'
  
  // Se for assistente, adiciona nome
  if (role === 'assistant') {
    const nameLabel = document.createElement('div')
    nameLabel.className = 'chat-name'
    nameLabel.textContent = 'MATH'
    messageContent.appendChild(nameLabel)
  }
  
  const div = document.createElement('div')
  div.className = 'chat-message ' + role
  div.textContent = text
  messageContent.appendChild(div)
  
  messageContainer.appendChild(messageContent)
  chatMessages.appendChild(messageContainer)
  chatMessages.scrollTop = chatMessages.scrollHeight
}

// Mostra indicador de "digitando..." (função global para gravador de áudio)
function showChatTypingIndicator() {
  const chatMessages = document.getElementById('chatMessages')
  if (!chatMessages) return
  
  hideChatTypingIndicator()
  
  const typingDiv = document.createElement('div')
  typingDiv.id = 'typingIndicator'
  typingDiv.className = 'chat-message-container assistant typing'
  
  const avatar = document.createElement('div')
  avatar.className = 'chat-avatar'
  avatar.innerHTML = '<img src="mate-icon.jpg" alt="MATH" class="avatar-image" />'
  typingDiv.appendChild(avatar)
  
  const contentDiv = document.createElement('div')
  contentDiv.className = 'chat-message-content'
  
  const nameLabel = document.createElement('div')
  nameLabel.className = 'chat-name'
  nameLabel.textContent = 'MATH'
  contentDiv.appendChild(nameLabel)
  
  const dotsDiv = document.createElement('div')
  dotsDiv.className = 'typing-dots'
  dotsDiv.innerHTML = '<span></span><span></span><span></span>'
  contentDiv.appendChild(dotsDiv)
  
  typingDiv.appendChild(contentDiv)
  chatMessages.appendChild(typingDiv)
  chatMessages.scrollTop = chatMessages.scrollHeight
}

// Esconde indicador de "digitando..." (função global para gravador de áudio)
function hideChatTypingIndicator() {
  const typingDiv = document.getElementById('typingIndicator')
  if (typingDiv) {
    typingDiv.remove()
  }
}

/**
 * Preenche diversos campos do formulário de finalização a partir dos dados
 * extraídos pela IA. Se um campo já contém texto significativo, não o
 * sobrescreve. Também preenche listas de materiais, deslocamentos e
 * intervalos de trabalho quando fornecidos.
 * @param {Object} fields Campos extraídos (call_reason, occurrence, etc.)
 * @param {string|null} maintenanceType Categoria de manutenção sugerida pela IA
 */
function applyTranscribedFields(fields, maintenanceType) {
  // Teste se valor é significativo (não sobrescrever com 1 letra)
  const isMeaningful = (v) => {
    if (v == null) return false
    const s = String(v).trim()
    if (!/^[0-9]/.test(s) && s.length < 3) return false
    return true
  }
  const setIfEmptyOrShort = (el, v) => {
    if (!el) return
    const cur = String(el.value || '').trim()
    if (!isMeaningful(v)) return
    if (!cur || cur.length < 3) el.value = v
  }
  // Preenche somente campos que a IA deve controlar. Não sobrescreve
  // motivo do chamado ou relato do cliente, pois já vêm pré-preenchidos.
  setIfEmptyOrShort(document.getElementById('finishDescription'), fields.service_description)
  setIfEmptyOrShort(document.getElementById('finishAdditionalServiceNote'), fields.additional_service_note)
  // Valor adicional
  const valField = document.getElementById('finishAdditionalServiceValue')
  if (valField) {
    const rawVal = fields.value_service
    if (rawVal !== undefined && rawVal !== null && rawVal !== '') {
      const n = Number(String(rawVal).replace(/\./g, '').replace(',', '.'))
      if (!isNaN(n) && n >= 0) valField.value = n.toFixed(2)
    }
  }
  // Tipo de manutenção não é preenchido automaticamente (seleção manual)
  // Resolver máquina pelo serial/modelo
  ;(async () => {
    if (isMeaningful(fields.machine_serial) || isMeaningful(fields.machine_model)) {
      const smartInput = document.getElementById('machineSmartInput')
      const select = document.getElementById('finishMachineSelect')
      if (smartInput) {
        if (fields.machine_serial) smartInput.value = fields.machine_serial
        else if (fields.machine_model) smartInput.value = fields.machine_model
      }
      // Tenta resolver ID
      if (select) {
        const id = await resolveMachineIdNow()
        if (id) select.value = String(id)
      }
    }
  })()
  // Materiais
  if (Array.isArray(fields.materials) && fields.materials.length) {
    const container = document.getElementById('materialsContainer')
    if (container) {
      if (!container.querySelector('.material-row')) container.innerHTML = ''
      fields.materials.forEach((m) => {
        if (!m || !isMeaningful(m.name)) return
        addMaterialLine()
        const row = container.lastElementChild
        if (row) {
          const nameInput = row.querySelector('.material-name')
          const qtyInput = row.querySelector('.material-qty')
          const priceInput = row.querySelector('.material-price')
          if (nameInput) nameInput.value = m.name
          if (qtyInput && m.quantity != null && !isNaN(Number(m.quantity))) qtyInput.value = Number(m.quantity)
          if (priceInput && m.unit_price != null && !isNaN(Number(m.unit_price))) priceInput.value = Number(m.unit_price)
        }
      })
    }
  }
  // Deslocamentos
  if (Array.isArray(fields.displacements) && fields.displacements.length) {
    const container = document.getElementById('displacementContainer')
    if (container) {
      if (!container.querySelector('.displacement-row')) container.innerHTML = ''
      fields.displacements.forEach((d) => {
        addDisplacementRow()
        const row = container.lastElementChild
        if (!row) return
        const optSelect = row.querySelector('.km-option')
        const totalInput = row.querySelector('.km-total')
        const vehSelect = row.querySelector('.vehicle-select')
        if (d.km_option && optSelect) {
          const val = String(d.km_option)
          if (['50','100','maior'].includes(val)) optSelect.value = val
        }
        if (optSelect && optSelect.value === 'maior' && d.km_total != null && !isNaN(Number(d.km_total))) {
          totalInput.value = Number(d.km_total)
          totalInput.style.display = 'block'
          totalInput.required = true
        }
        if (vehSelect && d.vehicle_plate) {
          const target = String(d.vehicle_plate).replace(/\W/g, '').toUpperCase()
          for (const opt of vehSelect.options) {
            if (!opt.value) continue
            const txt = String(opt.textContent || '').replace(/\W/g, '').toUpperCase()
            if (txt.includes(target)) {
              vehSelect.value = opt.value
              break
            }
          }
        }
      })
    }
  }
  // Períodos de trabalho
  if (Array.isArray(fields.worklogs) && fields.worklogs.length) {
    const container = document.getElementById('timeEntriesContainer')
    if (container) {
      if (!container.querySelector('.time-entry-row')) container.innerHTML = ''
      fields.worklogs.forEach((w) => {
        if (!w || !w.start_datetime || !w.end_datetime) return
        addTimeEntryRow({ start_datetime: w.start_datetime, end_datetime: w.end_datetime })
      })
    }
  }
}

/**
 * Inicializa o toggle de tema.
 */
function initializeTheme() {
  const themeToggle = document.getElementById('themeToggle');
  if (!themeToggle) return;

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

function initThemeToggle() {
  const themeToggle = document.getElementById("themeToggle")
  if (!themeToggle) return

  // Load saved theme or default to dark
  const savedTheme = localStorage.getItem("theme") || "dark"
  document.documentElement.setAttribute("data-theme", savedTheme)

  themeToggle.addEventListener("click", () => {
    const currentTheme = document.documentElement.getAttribute("data-theme")
    const newTheme = currentTheme === "dark" ? "light" : "dark"

    document.documentElement.setAttribute("data-theme", newTheme)
    localStorage.setItem("theme", newTheme)
  })
}

function initLogoutButton() {
  const logoutBtn = document.getElementById("logoutBtn")
  if (!logoutBtn) return

  logoutBtn.addEventListener("click", () => {
    // Clear all localStorage data to force re-login
    localStorage.clear()

    // Limpa estado salvo
    if (window.technicianStateManager) {
      window.technicianStateManager.clearState()
    }
    
    // Para auto-refresh e desconecta WebSocket
    stopAutoRefresh()
    disconnectWebSocket()

    showToast("Logout realizado com sucesso!", "success")

    // Redirect to login
    showLoginSection()
  })
}

// ╔═══════════════════════════════════════════════════════════════════════════════╗
// ║                    SEÇÃO 5: SESSÃO E NAVEGAÇÃO                                ║
// ╚═══════════════════════════════════════════════════════════════════════════════╝
function checkTechnicianLogin() {
  const logged = localStorage.getItem("technicianLoggedIn") === "true"
  if (logged) showTechnicianSection()
  else showLoginSection()
}

function showLoginSection() {
  const login = document.getElementById("login-section")
  const tech = document.getElementById("technician-section")
  const logoutBtn = document.getElementById("logoutBtn")

  if (login) login.style.display = "block"
  if (tech) tech.style.display = "none"
  if (logoutBtn) logoutBtn.style.display = "none"
}

function showTechnicianSection() {
  const login = document.getElementById("login-section")
  const tech = document.getElementById("technician-section")
  const logoutBtn = document.getElementById("logoutBtn")

  if (login) login.style.display = "none"
  if (tech) tech.style.display = "block"
  if (logoutBtn) logoutBtn.style.display = "flex"

  const name = localStorage.getItem("technicianName") || ""
  const display = document.getElementById("technicianNameDisplay")
  if (display && name) display.textContent = `Técnico: ${name}`

  // Busca assinatura do técnico (caso ainda não esteja no localStorage)
  const techId = getStoredTechnicianId()
  if (techId) {
    fetch(`${API_URL}/api/technicians/${techId}`)
      .then((res) => res.json())
      .then((data) => {
        if (data && data.signature) {
          setStoredTechnicianSignature(data.signature)
          // Atualiza o botão após carregar a assinatura
          updateSignatureButtonStatus()
        }
      })
      .catch(() => {})
  }

  loadOSList()
  
  // Conecta WebSocket (sem auto-refresh)
  connectWebSocket()
  
  // Restaura estado salvo (se houver OS aberta)
  if (window.technicianStateManager) {
    const state = window.technicianStateManager.restoreFromURL()
    if (state.openOS) {
      setTimeout(() => {
        window.reopenOSModal(state.openOS)
      }, 500)
    }
    // Restaura scroll
    setTimeout(() => {
      window.technicianStateManager.restoreScrollPosition()
    }, 300)
  }
}

// ╔═══════════════════════════════════════════════════════════════════════════════╗
// ║                         SEÇÃO 6: AUTENTICAÇÃO                                 ║
// ╚═══════════════════════════════════════════════════════════════════════════════╝
async function handleTechnicianLogin(e) {
  if (e) {
    e.preventDefault()
    e.stopPropagation()
    e.stopImmediatePropagation()
  }
  console.log("[LOGIN] Iniciando login...")

  const username = document.getElementById("technicianLoginName").value.trim()
  const password = document.getElementById("technicianLoginPassword").value

  console.log("[LOGIN] Usuario:", username)

  if (!username || !password) {
    console.log("[LOGIN] Campos vazios")
    showToast("Preencha usuário e senha.", "error")
    return
  }

  try {
    console.log("[LOGIN] Fazendo requisicao para:", `${API_URL}/api/technicians/login`)
    const resp = await fetch(`${API_URL}/api/technicians/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    })

    console.log("[LOGIN] Status da resposta:", resp.status)
    const data = await resp.json()
    console.log("[LOGIN] Dados recebidos:", data)

    if (!resp.ok) {
      console.log("[LOGIN] Erro:", data.message)
      showToast(data.message || "Credenciais inválidas!", "error")
      return
    }

    console.log("[LOGIN] Login bem-sucedido!")
    localStorage.setItem("technicianLoggedIn", "true")
    localStorage.setItem("technicianName", username)
    if (data && data.id) setStoredTechnicianId(data.id)

    // Salva a assinatura no localStorage se existir
    if (data && data.signature) {
      setStoredTechnicianSignature(data.signature)
    }

    // Atualiza o botão de assinatura para refletir o estado correto
    updateSignatureButtonStatus()

    showToast("Login realizado com sucesso!", "success")
    console.log("[LOGIN] Chamando showTechnicianSection()")
    showTechnicianSection()
  } catch (err) {
    console.error("[LOGIN] Erro de conexao:", err)
    showToast("Erro de conexão com o servidor.", "error")
  }
  return false
}

// ╔═══════════════════════════════════════════════════════════════════════════════╗
// ║                        SEÇÃO 7: LISTAGEM DE OS                                ║
// ╚═══════════════════════════════════════════════════════════════════════════════╝
async function loadOSList() {
  const listEl = document.getElementById("osList")
  if (!listEl) return

  const username = localStorage.getItem("technicianName")
  listEl.innerHTML = '<p class="empty-state">Carregando...</p>'

  try {
    const res = await fetch(`${API_URL}/api/os`)
    if (!res.ok) throw new Error("Falha ao listar OS")

    const allOs = await res.json()


    // Filtra por technician_username OU technician_name (fallback)
    const osList = Array.isArray(allOs) ? allOs.filter((os) =>
      os.technician_username === username ||
      os.technician_name === username ||
      os.assigned_technician === username
    ) : []


    listEl.innerHTML = ""
    if (osList.length === 0) {
      listEl.innerHTML = '<p class="empty-state">Nenhuma OS atribuída.</p>'
      return
    }

    osList.forEach((os) => {
      const card = document.createElement("div")
      card.className = "os-card"
      card.style.cursor = "pointer"
      const statusText = translateStatus(os.status)

      // Define o título: se não tiver order_number, é uma Solicitação de Serviço (S.S)
      const osTitle = os.order_number
        ? `O.S ${os.order_number}`
        : `S.S (Solicitação de Serviço)`

      card.innerHTML = `
        <h3>${osTitle}</h3>
        <p><strong>Cliente:</strong> ${escapeHtml(os.client_name || "")}</p>
        <p><strong>Status:</strong> ${statusText}</p>
        <div class="os-actions"></div>
      `
      
      // Clique no card abre preview
      card.addEventListener("click", (e) => {
        // Só abre preview se não clicar em botão
        if (!e.target.closest("button")) {
          openPreviewOsModal(os)
        }
      })

      const actionsDiv = card.querySelector(".os-actions")

      if (os.status === "assigned") {
        const acceptBtn = document.createElement("button")
        acceptBtn.className = "btn-accept"
        acceptBtn.textContent = "Aceitar"
        acceptBtn.addEventListener("click", (e) => {
          e.stopPropagation()
          acceptOS(os.id)
        })
        actionsDiv.appendChild(acceptBtn)
      } else if (os.status === "accepted" || os.status === "in_progress") {
        const finishBtn = document.createElement("button")
        finishBtn.className = "btn-finish"
        finishBtn.textContent = "Finalizar"
        finishBtn.addEventListener("click", (e) => {
          e.stopPropagation()
          openFinishModal(os)
        })
        actionsDiv.appendChild(finishBtn)
      } else if (os.status === "finished") {
        // Técnico não precisa baixar OS - removido botão de download
        const statusBadge = document.createElement("span")
        statusBadge.textContent = "Finalizada"
        statusBadge.style.cssText = "color: var(--success); font-weight: 600; padding: 0.5rem 1rem; background: rgba(16, 185, 129, 0.1); border-radius: 8px;"
        actionsDiv.appendChild(statusBadge)
      } else {
        actionsDiv.textContent = os.status || ""
      }

      listEl.appendChild(card)
    })
  } catch (err) {
    console.error(err)
    showToast("Erro ao carregar OS.", "error")
    listEl.innerHTML = '<p class="empty-state">Erro ao carregar OS.</p>'
  }
}

async function downloadOS(id) {
  try {
    const res = await fetch(`${API_URL}/api/os/${id}`)
    const data = await res.json()

    if (!res.ok) {
      showToast(data.message || "Erro ao obter OS.", "error")
      return
    }

    const content = JSON.stringify(data, null, 2)
    const blob = new Blob([content], { type: "application/json" })
    const url = URL.createObjectURL(blob)

    const a = document.createElement("a")
    a.href = url
    a.download = `os_${data.order_number || id}.json`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)

    URL.revokeObjectURL(url)
    showToast("Download iniciado.", "success")
  } catch (err) {
    console.error(err)
    showToast("Erro ao baixar OS.", "error")
  }
}

function translateStatus(status) {
  switch (status) {
    case "assigned":
      return "Atribuída"
    case "in_progress":
      return "Em Andamento"
    case "pending_review":
      return "Aguardando Conferência"
    case "completed":
      return "Concluída"
    case "pending":
      return "Pendente"
    case "cancelled":
      return "Cancelada"
    case "on_hold":
      return "Em Espera"
    default:
      return status || ""
  }
}

// ╔═══════════════════════════════════════════════════════════════════════════════╗
// ║                     SEÇÃO 8: PREVIEW E MODAL DE OS                            ║
// ╚═══════════════════════════════════════════════════════════════════════════════╝
function openPreviewOsModal(os) {
  const modal = document.getElementById('previewOsModal')
  if (!modal) return
  
  // Preenche informações básicas
  const osNumberEl = document.getElementById('previewOsNumber')
  const clientNameEl = document.getElementById('previewClientName')
  const statusEl = document.getElementById('previewStatus')
  const acceptBtn = document.getElementById('acceptFromPreview')

  // Define título: se não tiver order_number, é Solicitação de Serviço (S.S)
  const osTitle = os.order_number
    ? `O.S ${os.order_number}`
    : `S.S (Solicitação de Serviço)`

  if (osNumberEl) osNumberEl.textContent = osTitle
  if (clientNameEl) clientNameEl.textContent = os.client_name || '-'
  if (statusEl) statusEl.textContent = translateStatus(os.status)
  
  // Mostra botão aceitar se status for assigned
  if (acceptBtn) {
    if (os.status === 'assigned') {
      acceptBtn.style.display = 'inline-block'
      acceptBtn.onclick = () => {
        closePreviewOsModal()
        acceptOS(os.id)
      }
    } else {
      acceptBtn.style.display = 'none'
    }
  }
  
  // Carrega informações da empresa
  if (typeof loadCompanyInfoForPreview === 'function') {
    loadCompanyInfoForPreview(os.company_id, os.requester)
  }

  // Carrega informações do chamado
  loadCallInfoForPreview(os)

  // Mostra modal
  modal.style.display = 'flex'
}

async function loadCallInfoForPreview(os) {
  const callInfoSection = document.getElementById('previewCallInfoSection')
  const callReasonEl = document.getElementById('previewCallReason')
  const photosContainer = document.getElementById('previewProblemPhotosContainer')
  const photosGrid = document.getElementById('previewProblemPhotos')

  // Preenche motivo do chamado
  if (callReasonEl) {
    callReasonEl.textContent = os.call_reason || 'Não informado'
  }

  // Se tiver call_reason ou request_id, mostra a seção
  if (os.call_reason || os.request_id) {
    if (callInfoSection) callInfoSection.style.display = 'block'
  }

  // Carrega fotos do problema
  if (os.id) {
    try {
      const images = []

      // 1. Tenta buscar anexos da OS
      const osRes = await fetch(`${API_URL}/api/os/${os.id}`)
      if (osRes.ok) {
        const osData = await osRes.json()
        if (osData.attachments && osData.attachments.length > 0) {
          osData.attachments.forEach(att => {
            images.push({
              url: `${API_URL}/api/attachments/${att.id}`,
              filename: att.filename || 'Imagem'
            })
          })
        }
      }

      // 2. Se não tiver anexos na OS mas tiver request_id, busca da solicitação original
      if (images.length === 0 && os.request_id) {
        const reqRes = await fetch(`${API_URL}/api/requests/${os.request_id}/attachments`)
        if (reqRes.ok) {
          const reqAttachments = await reqRes.json()
          reqAttachments.forEach(att => {
            images.push({
              url: `${API_URL}/api/requests/attachment-file/${att.id}`,
              filename: att.filename || 'Imagem'
            })
          })
        }
      }

      // Renderiza fotos se houver
      if (images.length > 0 && photosGrid) {
        photosGrid.innerHTML = images.map((img, idx) => `
          <div style="position: relative; border-radius: 6px; overflow: hidden; border: 1px solid var(--border-color); background: var(--bg-card); cursor: pointer;" onclick='openImageModal(${JSON.stringify(images).replace(/'/g, "\\'")}, ${idx})'>
            <img src="${img.url}" alt="${img.filename}" style="width: 100%; height: 120px; object-fit: cover; display: block;" onerror="this.parentElement.innerHTML='<div style=\\'height:120px;display:flex;align-items:center;justify-content:center;color:var(--text-secondary);font-size:0.75rem\\'>Erro ao carregar</div>'">
            <div style="position: absolute; bottom: 0; left: 0; right: 0; background: rgba(0,0,0,0.6); color: white; padding: 4px 8px; font-size: 11px; text-align: center; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
              ${img.filename}
            </div>
          </div>
        `).join('')

        if (photosContainer) {
          photosContainer.style.display = 'block'
        }
      } else {
        if (photosContainer) {
          photosContainer.style.display = 'none'
        }
      }
    } catch (err) {
      console.error('Erro ao carregar fotos do problema:', err)
      if (photosContainer) {
        photosContainer.style.display = 'none'
      }
    }
  }
}

function closePreviewOsModal() {
  const modal = document.getElementById('previewOsModal')
  if (modal) modal.style.display = 'none'
}

// Função para abrir modal de visualização de imagens em tela cheia
function openImageModal(images, currentIndex) {
  const modal = document.createElement("div")
  modal.className = "modal"
  modal.id = "imageViewerModal"
  modal.style.display = "flex"
  modal.style.zIndex = "10000"

  let currentIdx = currentIndex

  function updateImage() {
    const img = images[currentIdx]

    document.getElementById("modalImage").src = img.url
    document.getElementById("imageCounter").textContent = `${currentIdx + 1} / ${images.length}`
    document.getElementById("imageFilename").textContent = img.filename || `Imagem ${currentIdx + 1}`

    // Controles de navegação
    document.getElementById("prevImageBtn").disabled = currentIdx === 0
    document.getElementById("nextImageBtn").disabled = currentIdx === images.length - 1
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
    if (currentIdx < images.length - 1) {
      currentIdx++
      updateImage()
    }
  })

  document.getElementById("downloadImageBtn").addEventListener("click", () => {
    const img = images[currentIdx]
    window.open(img.url, '_blank')
  })

  // Permite navegação com teclado
  const keyHandler = (e) => {
    if (e.key === 'ArrowLeft' && currentIdx > 0) {
      currentIdx--
      updateImage()
    } else if (e.key === 'ArrowRight' && currentIdx < images.length - 1) {
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

// Flag para prevenir múltiplas chamadas simultâneas de acceptOS
let isAcceptingOS = false

async function acceptOS(id) {
  // Previne double-click
  if (isAcceptingOS) {
    console.warn('⚠️ Já existe uma operação de aceitar OS em andamento')
    return
  }

  isAcceptingOS = true

  try {
    console.log('🔄 Aceitando OS/SS:', id)
    const res = await fetch(`${API_URL}/api/os/${id}/accept`, {
      method: "PATCH",
      headers: {
        'Content-Type': 'application/json'
      }
    })

    console.log('📡 Resposta do servidor:', res.status, res.statusText)

    const data = await res.json()
    console.log('📦 Dados recebidos:', data)

    if (!res.ok) {
      console.error('❌ Erro na resposta:', data)

      // Mensagem específica para conflito de OS em andamento
      if (data.conflict_os_id || data.conflict_os_number) {
        showToast(data.message || "Você já possui outra OS em andamento.", "error")
        // Opcional: destacar a OS em conflito na lista
        console.warn('⚠️ OS em conflito:', data.conflict_os_id, data.conflict_os_number)
      } else {
        showToast(data.message || "Erro ao aceitar SS/OS.", "error")
      }
      return
    }

    // Mostra número da O.S gerado (se era uma S.S que virou O.S)
    if (data.was_pending && data.order_number) {
      showToast(`S.S aceita e transformada em O.S ${data.order_number}!`, "success")
    } else if (data.order_number) {
      showToast(`O.S ${data.order_number} aceita com sucesso!`, "success")
    } else {
      showToast("O.S aceita com sucesso!", "success")
    }

    console.log('✅ OS aceita com sucesso, recarregando lista...')
    loadOSList()
  } catch (err) {
    console.error('❌ Erro ao aceitar OS:', err)
    showToast("Erro de rede ao aceitar SS/OS.", "error")
  } finally {
    isAcceptingOS = false
  }
}

// ╔═══════════════════════════════════════════════════════════════════════════════╗
// ║                       SEÇÃO 9: FINALIZAÇÃO DE OS                              ║
// ╚═══════════════════════════════════════════════════════════════════════════════╝
let currentOsId = null
let isSubmittingFinish = false

// Catálogo em memória para o campo inteligente de máquinas
let __machineCatalog = []
const __machineByLabel = new Map() // label -> id
const __machineBySerial = new Map() // serial -> id

// Timer para auto-save (debounce)
let autoSaveTimer = null

/**
 * Salva automaticamente os dados do formulário no state manager
 * Usa debounce de 500ms para evitar salvar a cada tecla digitada
 */
function autoSaveFormData() {
  clearTimeout(autoSaveTimer)
  autoSaveTimer = setTimeout(() => {
    if (!window.technicianStateManager || !currentOsId) return

    try {
      // Coleta dados dos campos do formulário
      const formData = {
        osId: currentOsId,
        description: document.getElementById("finishDescription")?.value || '',
        occurrence: document.getElementById("finishCallReason")?.value || '',
        maintenanceType: document.getElementById("maintenanceTypeSelect")?.value || '',
        selectedMachine: document.getElementById("finishMachineSelect")?.value || '',
        machineSmartInput: document.getElementById("machineSmartInput")?.value || '',

        // Materiais e serviço adicional (radio buttons)
        hasMaterials: document.querySelector('input[name="hasMaterials"]:checked')?.value || null,
        hasAdditionalService: document.querySelector('input[name="hasAdditionalService"]:checked')?.value || null,
        additionalServiceValue: document.getElementById("finishAdditionalServiceValue")?.value || '',
        additionalServiceNote: document.getElementById("finishAdditionalServiceNote")?.value || '',

        // Períodos de trabalho (data + hora início + hora fim)
        timeEntries: Array.from(document.querySelectorAll("#timeEntriesContainer .time-entry-row")).map(row => ({
          date: row.querySelector(".work-date")?.value || '',
          start: row.querySelector(".start-time")?.value || '',
          end: row.querySelector(".end-time")?.value || ''
        })),

        // Materiais
        materials: Array.from(document.querySelectorAll("#materialsContainer .material-row")).map(row => ({
          name: row.querySelector(".material-name")?.value || '',
          quantity: row.querySelector(".material-qty")?.value || '',
          price: row.querySelector(".material-price")?.value || ''
        })),

        // Deslocamentos
        displacements: Array.from(document.querySelectorAll("#displacementContainer .displacement-row")).map(row => ({
          kmOption: row.querySelector(".km-option")?.value || '',
          kmTotal: row.querySelector(".km-total")?.value || '',
          vehicleId: row.querySelector(".vehicle-select")?.value || ''
        })),

        timestamp: Date.now()
      }

      window.technicianStateManager.saveFormData(formData)
      console.log('💾 Dados do formulário salvos automaticamente')
    } catch (err) {
      console.warn('Erro ao auto-salvar dados:', err)
    }
  }, 500)
}

/**
 * Configura event listeners para auto-save dos campos do formulário
 */
function setupAutoSaveListeners() {
  const fieldsToWatch = [
    'finishDescription',
    'finishCallReason',
    'maintenanceTypeSelect',
    'finishMachineSelect',
    'machineSmartInput',
    'finishAdditionalServiceValue',
    'finishAdditionalServiceNote'
  ]

  fieldsToWatch.forEach(fieldId => {
    const field = document.getElementById(fieldId)
    if (field) {
      field.addEventListener('input', autoSaveFormData)
      field.addEventListener('change', autoSaveFormData)
    }
  })

  // Radio buttons
  document.querySelectorAll('input[name="hasMaterials"]').forEach(radio => {
    radio.addEventListener('change', autoSaveFormData)
  })
  document.querySelectorAll('input[name="hasAdditionalService"]').forEach(radio => {
    radio.addEventListener('change', autoSaveFormData)
  })

  console.log('✅ Listeners de auto-save configurados')
}

/**
 * Restaura dados salvos do formulário
 */
function restoreFormData() {
  if (!window.technicianStateManager) return

  try {
    const savedData = window.technicianStateManager.restoreFormData()
    if (!savedData || !savedData.osId || savedData.osId !== currentOsId) {
      console.log('⚠️ Nenhum dado salvo para esta OS')
      return
    }

    console.log('🔄 Restaurando dados salvos do formulário...')

    // Restaura campos simples
    if (savedData.description) document.getElementById("finishDescription").value = savedData.description
    if (savedData.occurrence) document.getElementById("finishCallReason").value = savedData.occurrence
    if (savedData.maintenanceType) document.getElementById("maintenanceTypeSelect").value = savedData.maintenanceType
    if (savedData.selectedMachine) document.getElementById("finishMachineSelect").value = savedData.selectedMachine
    if (savedData.machineSmartInput) document.getElementById("machineSmartInput").value = savedData.machineSmartInput

    // Restaura radio buttons de materiais
    if (savedData.hasMaterials) {
      const materialRadio = document.querySelector(`input[name="hasMaterials"][value="${savedData.hasMaterials}"]`)
      if (materialRadio) {
        materialRadio.checked = true
        materialRadio.dispatchEvent(new Event('change', { bubbles: true }))
      }
    }

    // Restaura radio buttons de serviço adicional
    if (savedData.hasAdditionalService) {
      const serviceRadio = document.querySelector(`input[name="hasAdditionalService"][value="${savedData.hasAdditionalService}"]`)
      if (serviceRadio) {
        serviceRadio.checked = true
        serviceRadio.dispatchEvent(new Event('change', { bubbles: true }))
      }
    }

    // Restaura valores de serviço adicional
    if (savedData.additionalServiceValue) document.getElementById("finishAdditionalServiceValue").value = savedData.additionalServiceValue
    if (savedData.additionalServiceNote) document.getElementById("finishAdditionalServiceNote").value = savedData.additionalServiceNote

    // Restaura períodos de trabalho
    if (savedData.timeEntries && savedData.timeEntries.length > 0) {
      // Limpa períodos existentes
      resetTimeEntries()
      // Adiciona períodos salvos
      savedData.timeEntries.forEach(entry => {
        if (entry.date && (entry.start || entry.end)) {
          // Combina data + hora para criar datetime strings
          const startDatetime = entry.start ? `${entry.date}T${entry.start}` : ''
          const endDatetime = entry.end ? `${entry.date}T${entry.end}` : ''
          addTimeEntryRow({ start_datetime: startDatetime, end_datetime: endDatetime })
        }
      })
    }

    // Restaura materiais
    if (savedData.materials && savedData.materials.length > 0) {
      const container = document.getElementById('materialsContainer')
      if (container) {
        container.innerHTML = ''
        savedData.materials.forEach(material => {
          if (material.name) {
            addMaterialLine()
            const rows = container.querySelectorAll('.material-row')
            const lastRow = rows[rows.length - 1]
            if (lastRow) {
              lastRow.querySelector('.material-name').value = material.name
              lastRow.querySelector('.material-qty').value = material.quantity
              lastRow.querySelector('.material-price').value = material.price
            }
          }
        })
      }
    }

    // Restaura deslocamentos
    if (savedData.displacements && savedData.displacements.length > 0) {
      resetDisplacementRows()
      savedData.displacements.forEach(disp => {
        addDisplacementRow({
          km_option: disp.kmOption,
          km_total: disp.kmTotal,
          vehicle_id: disp.vehicleId
        })
      })
    }

    console.log('✅ Dados restaurados com sucesso')
  } catch (err) {
    console.warn('Erro ao restaurar dados:', err)
  }
}

/**
 * Extrai o número de série de um texto inserido no campo de máquina.
 * Aceita formatos como "SERIAL — MODELO", "SERIAL - MODELO" ou apenas "SERIAL".
 * @param {string} text Texto digitado pelo técnico
 * @returns {string} Parte correspondente ao número de série em minúsculas e sem espaços
 */
function parseSerialFromLabel(text) {
  const t = String(text || "").trim()
  if (!t) return ""
  // separa por em-dash, en-dash ou hífen, com ou sem espaços
  const parts = t.split(/\s*[—–-]\s*/)
  return parts.length > 0 ? parts[0].trim().toLowerCase() : t.toLowerCase()
}

/**
 * Resolve de imediato o ID da máquina baseado no valor atual do campo inteligente.
 * Utiliza os índices locais e, se necessário, consulta o backend.
 * @returns {Promise<number|null>} ID da máquina ou null se não encontrado
 */
async function resolveMachineIdNow() {
  const sel = document.getElementById("finishMachineSelect")
  const smartInput = document.getElementById("machineSmartInput")
  if (!smartInput || !sel) return null
  const raw = (smartInput.value || "").trim()
  if (!raw) return null
  const lower = raw.toLowerCase().trim()
  // tenta pelo rótulo completo
  if (__machineByLabel.has(lower)) {
    return Number(__machineByLabel.get(lower))
  }
  // tenta pelo número de série local
  const serialOnly = parseSerialFromLabel(raw)
  if (serialOnly && __machineBySerial.has(serialOnly)) {
    return Number(__machineBySerial.get(serialOnly))
  }
  // consulta backend
  const found = await lookupMachineIdBySerial(serialOnly)
  return found ? Number(found) : null
}

// Lista de veículos disponível (placas) para seleção nos deslocamentos
let vehiclesList = []

async function openFinishModal(os) {
  console.log("🔍 openFinishModal chamada para OS:", os.id)
  
  try {
    currentOsId = os.id
    
    // Salva estado da OS aberta
    if (window.technicianStateManager) {
      window.technicianStateManager.setOpenOS(os.id)
    }
    
    const modal = document.getElementById("finishModal")
    
    if (!modal) {
      console.error("❌ Modal finishModal não encontrado no DOM!")
      showToast("Erro: Modal não encontrado", "error")
      return
    }
    
    console.log("✅ Modal encontrado, preparando campos...")

    // Limpa campos
    document.getElementById("finishOsId").value = os.id
    // Limpa períodos de trabalho iniciais (agora dinâmicos)
    resetTimeEntries()
    // Adiciona pelo menos um período vazio
    addTimeEntryRow()
    // Os campos legacy finishStart/finishEnd não são mais utilizados
    const oldStart = document.getElementById("finishStart")
    const oldEnd = document.getElementById("finishEnd")
    if (oldStart) oldStart.value = ""
    if (oldEnd) oldEnd.value = ""
    document.getElementById("finishDescription").value = ""
    const callReasonField = document.getElementById("finishCallReason")
    if (callReasonField) callReasonField.value = ""

    // Limpa seleção de tipo de manutenção manual
    const mtSelect = document.getElementById("maintenanceTypeSelect")
    if (mtSelect) mtSelect.value = ""

    const materialsContainer = document.getElementById("materialsContainer")
    if (materialsContainer) materialsContainer.innerHTML = ""

    // Limpa assinatura do cliente
    const clientCanvas = document.getElementById("clientSignatureCanvas")
    if (clientCanvas) {
      const ctx = clientCanvas.getContext("2d")
      ctx.clearRect(0, 0, clientCanvas.width, clientCanvas.height)
    }
    // Carrega veículos e reseta seções de deslocamento
    await loadVehicles()
    resetDisplacementRows()

    // Carrega dados da OS para preencher motivo do chamado e deslocamentos existentes
    try {
      const response = await fetch(`${API_URL}/api/os/${os.id}`)
      const detail = await response.json()
      if (response.ok && detail) {
        // Motivo do chamado
        if (callReasonField) callReasonField.value = detail.call_reason || ""
        // Materiais previamente cadastrados? (Não pré-carregados aqui)
        // Deslocamentos existentes
        if (Array.isArray(detail.displacements) && detail.displacements.length > 0) {
          detail.displacements.forEach((d) => {
            addDisplacementRow({ km_option: d.km_option, km_total: d.km_total, vehicle_id: d.vehicle_id })
          })
        } else {
          // Garante pelo menos uma linha de deslocamento
          addDisplacementRow()
        }

        // Exibe fotos do problema se disponíveis
        await loadProblemPhotos(os.id, detail)
        
        // Carrega e exibe informações da empresa
        await loadCompanyInfo(detail.company_id, detail.requester)
      } else {
        // Falha ao obter detalhes: cria linha vazia de deslocamento
        addDisplacementRow()
        // Esconde fotos
        const photoContainer = document.getElementById("problemPhotoContainer")
        if (photoContainer) photoContainer.style.display = "none"
        // Limpa informações da empresa
        clearCompanyInfo()
      }
    } catch (_err) {
      addDisplacementRow()
      // Esconde fotos
      const photoContainer = document.getElementById("problemPhotoContainer")
      if (photoContainer) photoContainer.style.display = "none"
      // Limpa informações da empresa
      clearCompanyInfo()
    }

    // Carrega máquinas da empresa desta OS e monta campo único com datalist
    await populateMachineSelect(os.id)

    console.log("✅ Exibindo modal...")
    modal.style.display = "flex"

    // Exibe o botão flutuante de áudio quando o modal está aberto
    const audioBtn = document.getElementById("recordAudioBtn")
    if (audioBtn) {
      audioBtn.style.display = "flex"
    }

    // Inicializa toggles de materiais e serviço adicional
    initMaterialsToggle()
    initAdditionalServiceToggle()

    // Inicializa canvas de assinatura do cliente
    initClientSignatureCanvas()

    // Configura auto-save dos campos do formulário
    setupAutoSaveListeners()

    // Restaura dados salvos anteriormente (se houver)
    restoreFormData()

  } catch (error) {
    console.error("❌ Erro ao abrir modal de finalização:", error)
    showToast("Erro ao abrir modal: " + error.message, "error")
  }
}

// Inicializa o toggle de materiais (Sim/Não)
function initMaterialsToggle() {
  const materialsRadios = document.getElementsByName('hasMaterials')
  const materialsSection = document.getElementById('materialsSection')
  
  materialsRadios.forEach(radio => {
    radio.addEventListener('change', (e) => {
      if (e.target.value === 'yes') {
        materialsSection.style.display = 'block'
        // Adiciona primeira linha de material se não houver
        const container = document.getElementById('materialsContainer')
        if (container && container.children.length === 0) {
          addMaterialLine()
        }
      } else {
        materialsSection.style.display = 'none'
        // Limpa materiais ao selecionar Não
        const container = document.getElementById('materialsContainer')
        if (container) container.innerHTML = ''
      }
      // Adiciona feedback visual ao label selecionado
      updateRadioStyles('hasMaterials')
    })
  })
}

// Inicializa o toggle de serviço adicional (Sim/Não)
function initAdditionalServiceToggle() {
  const serviceRadios = document.getElementsByName('hasAdditionalService')
  const serviceSection = document.getElementById('additionalServiceSection')
  
  serviceRadios.forEach(radio => {
    radio.addEventListener('change', (e) => {
      if (e.target.value === 'yes') {
        serviceSection.style.display = 'block'
      } else {
        serviceSection.style.display = 'none'
        // Limpa campos ao selecionar Não
        const valueField = document.getElementById('finishAdditionalServiceValue')
        const noteField = document.getElementById('finishAdditionalServiceNote')
        if (valueField) valueField.value = ''
        if (noteField) noteField.value = ''
      }
      // Adiciona feedback visual ao label selecionado
      updateRadioStyles('hasAdditionalService')
    })
  })
}

// Atualiza estilos visuais dos radio buttons
function updateRadioStyles(radioName) {
  const radios = document.getElementsByName(radioName)
  radios.forEach(radio => {
    const label = radio.closest('label')
    const checkmark = label.querySelector('.radio-x')
    const checkBox = label.querySelector('.radio-check')

    if (radio.checked) {
      label.style.borderColor = 'var(--accent-blue)'
      label.style.background = 'rgba(59, 130, 246, 0.1)'
      if (checkmark) checkmark.style.display = 'inline'
      if (checkBox) {
        checkBox.style.background = 'var(--accent-blue)'
        checkBox.style.borderColor = 'var(--accent-blue)'
      }
    } else {
      label.style.borderColor = 'var(--border-color)'
      label.style.background = 'var(--bg-card)'
      if (checkmark) checkmark.style.display = 'none'
      if (checkBox) {
        checkBox.style.background = 'transparent'
        checkBox.style.borderColor = 'var(--border-color)'
      }
    }
  })
}

function closeFinishModal() {
  const modal = document.getElementById("finishModal")
  if (modal) modal.style.display = "none"
  currentOsId = null
  isSubmittingFinish = false

  // Limpa estado da OS
  if (window.technicianStateManager) {
    window.technicianStateManager.clearFormData()
  }

  // Reseta radio buttons de materiais e serviço adicional
  document.querySelectorAll('input[name="hasMaterials"]').forEach(r => r.checked = false)
  document.querySelectorAll('input[name="hasAdditionalService"]').forEach(r => r.checked = false)
  
  // Esconde seções
  const materialsSection = document.getElementById('materialsSection')
  const serviceSection = document.getElementById('additionalServiceSection')
  if (materialsSection) materialsSection.style.display = 'none'
  if (serviceSection) serviceSection.style.display = 'none'
  
  // Reseta estilos dos labels
  updateRadioStyles('hasMaterials')
  updateRadioStyles('hasAdditionalService')

  // Oculta o botão de áudio quando o modal fecha e encerra gravação se estiver ativa
  const audioBtn = document.getElementById("recordAudioBtn")
  if (audioBtn) {
    audioBtn.style.display = "none"
    if (mediaRecorder && mediaRecorder.state === 'recording') {
      try { mediaRecorder.stop() } catch (_e) {}
    }
    audioBtn.classList.remove('recording')
  }
}

/**
 * Reabre modal da OS (usado pelo popstate do navegador)
 */
window.reopenOSModal = async function(osId) {
  try {
    const response = await fetch(`${API_URL}/api/os/${osId}`)
    const os = await response.json()
    if (response.ok && os) {
      await openFinishModal(os)
    }
  } catch (err) {
    console.error('Erro ao reabrir modal:', err)
  }
}

/**
 * Busca lista de veículos cadastrados no backend e armazena em vehiclesList.
 * Deve ser chamada sempre que o modal de finalização for aberto para garantir
 * que as opções reflitam os registros mais recentes cadastrados pelo administrador.
 */
async function loadVehicles() {
  try {
    const res = await fetch(`${API_URL}/api/vehicles`)
    const data = await res.json()
    if (Array.isArray(data)) {
      vehiclesList = data
    } else {
      vehiclesList = []
    }
  } catch (_err) {
    vehiclesList = []
  }
}

/**
 * Carrega e exibe as fotos do problema (múltiplas imagens).
 * Busca tanto imagens anexadas diretamente à OS quanto imagens da solicitação original.
 * @param {number} osId - ID da OS
 * @param {Object} osDetail - Objeto com detalhes da OS
 */
async function loadProblemPhotos(osId, osDetail = {}) {
  const photoContainer = document.getElementById("problemPhotoContainer")
  const photoGallery = document.getElementById("problemPhotosGallery")

  if (!photoContainer || !photoGallery) return

  // Limpa galeria
  photoGallery.innerHTML = ""

  const images = []

  // 1. Verifica se há imagem única legada (retrocompatibilidade)
  if (osDetail.problem_image_url) {
    images.push({
      url: `${API_URL}${osDetail.problem_image_url}`,
      filename: 'Foto do problema'
    })
  }

  // 2. Busca anexos da OS (tabela attachments)
  try {
    const osAttachmentsRes = await fetch(`${API_URL}/api/os/${osId}`)
    if (osAttachmentsRes.ok) {
      const osData = await osAttachmentsRes.json()
      if (Array.isArray(osData.attachments) && osData.attachments.length > 0) {
        osData.attachments.forEach(att => {
          // Anexos de OS são BYTEA, precisam endpoint específico
          images.push({
            url: `${API_URL}/api/attachments/${att.id}`,
            filename: att.filename || 'Anexo'
          })
        })
      }
    }
  } catch (err) {
    console.log('Erro ao buscar anexos da OS:', err)
  }

  // 3. Se a OS tem request_id, busca anexos da solicitação original
  if (osDetail.request_id) {
    try {
      const requestAttachmentsRes = await fetch(`${API_URL}/api/requests/${osDetail.request_id}/attachments`)
      if (requestAttachmentsRes.ok) {
        const requestAttachments = await requestAttachmentsRes.json()
        if (Array.isArray(requestAttachments) && requestAttachments.length > 0) {
          requestAttachments.forEach(att => {
            images.push({
              url: `${API_URL}/api/requests/attachment-file/${att.id}`,
              filename: att.filename || 'Foto do problema'
            })
          })
        }
      }
    } catch (err) {
      console.log('Erro ao buscar anexos da solicitação:', err)
    }
  }

  // Exibe imagens na galeria
  if (images.length > 0) {
    images.forEach(img => {
      const imgCard = document.createElement("div")
      imgCard.style.cssText = `
        position: relative;
        overflow: hidden;
        border-radius: 8px;
        border: 2px solid var(--border-color);
        background: var(--bg-card);
        cursor: pointer;
        transition: transform 0.2s;
      `
      imgCard.addEventListener('mouseenter', () => {
        imgCard.style.transform = 'scale(1.05)'
      })
      imgCard.addEventListener('mouseleave', () => {
        imgCard.style.transform = 'scale(1)'
      })

      const imgElement = document.createElement("img")
      imgElement.src = img.url
      imgElement.alt = img.filename
      imgElement.style.cssText = `
        width: 100%;
        height: 200px;
        object-fit: cover;
        display: block;
      `

      // Clique para expandir imagem
      imgCard.addEventListener('click', () => {
        openImageModal(img.url, img.filename)
      })

      const caption = document.createElement("div")
      caption.textContent = img.filename
      caption.style.cssText = `
        padding: 0.5rem;
        font-size: 0.85rem;
        color: var(--text-secondary);
        text-align: center;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      `

      imgCard.appendChild(imgElement)
      imgCard.appendChild(caption)
      photoGallery.appendChild(imgCard)
    })

    photoContainer.style.display = "block"
  } else {
    photoContainer.style.display = "none"
  }
}

/**
 * Abre modal para visualizar imagem em tamanho grande
 * @param {string} imageUrl - URL da imagem
 * @param {string} imageName - Nome/legenda da imagem
 */
function openImageModal(imageUrl, imageName) {
  // Cria modal se não existir
  let modal = document.getElementById('imageModal')
  if (!modal) {
    modal = document.createElement('div')
    modal.id = 'imageModal'
    modal.style.cssText = `
      display: none;
      position: fixed;
      z-index: 10000;
      left: 0;
      top: 0;
      width: 100%;
      height: 100%;
      background-color: rgba(0,0,0,0.9);
      justify-content: center;
      align-items: center;
      padding: 2rem;
    `

    const content = document.createElement('div')
    content.style.cssText = `
      position: relative;
      max-width: 90%;
      max-height: 90%;
      display: flex;
      flex-direction: column;
      align-items: center;
    `

    const closeBtn = document.createElement('button')
    closeBtn.innerHTML = '&times;'
    closeBtn.style.cssText = `
      position: absolute;
      top: -40px;
      right: 0;
      font-size: 2rem;
      color: white;
      background: transparent;
      border: none;
      cursor: pointer;
      padding: 0;
      width: 40px;
      height: 40px;
      line-height: 1;
    `
    closeBtn.onclick = () => {
      modal.style.display = 'none'
    }

    const img = document.createElement('img')
    img.id = 'imageModalImg'
    img.style.cssText = `
      max-width: 100%;
      max-height: 80vh;
      object-fit: contain;
      border-radius: 8px;
    `

    const caption = document.createElement('div')
    caption.id = 'imageModalCaption'
    caption.style.cssText = `
      color: white;
      margin-top: 1rem;
      font-size: 1.1rem;
      text-align: center;
    `

    content.appendChild(closeBtn)
    content.appendChild(img)
    content.appendChild(caption)
    modal.appendChild(content)
    document.body.appendChild(modal)

    // Fecha ao clicar fora da imagem
    modal.onclick = (e) => {
      if (e.target === modal) {
        modal.style.display = 'none'
      }
    }
  }

  // Atualiza conteúdo e exibe
  const img = document.getElementById('imageModalImg')
  const caption = document.getElementById('imageModalCaption')
  img.src = imageUrl
  caption.textContent = imageName
  modal.style.display = 'flex'
}

/**
 * Remove todas as linhas de deslocamento atualmente exibidas.
 */
function resetDisplacementRows() {
  const container = document.getElementById("displacementContainer")
  if (container) container.innerHTML = ""
}

/**
 * Adiciona uma nova linha de deslocamento ao container.  Se for passado um
 * objeto inicial (com km_option, km_total e vehicle_id), utiliza-o para
 * preencher os campos.
 * @param {Object} [init] Valores iniciais para o deslocamento
 */
function addDisplacementRow(init = {}) {
  const container = document.getElementById("displacementContainer")
  if (!container) return
  // Cria elementos
  const row = document.createElement("div")
  row.className = "displacement-row"
  row.style.display = "flex"
  row.style.flexWrap = "wrap"
  row.style.gap = "0.5rem"
  row.style.marginTop = "0.5rem"

  // Select de distância
  const distSelect = document.createElement("select")
  distSelect.className = "km-option"
  distSelect.style.flex = "1"
  distSelect.style.minWidth = "120px"
  distSelect.style.padding = "0.5rem"
  distSelect.style.background = "var(--bg-input)"
  distSelect.style.border = "1px solid var(--border-color)"
  distSelect.style.borderRadius = "6px"
  distSelect.style.color = "var(--text-primary)"
  // Opções de distância: não houve deslocamento, até 50 km, até 100 km ou acima de 100 km
  const options = [
    { value: "nenhum", label: "Não houve deslocamento" },
    { value: "50", label: "Até 50 km" },
    { value: "100", label: "Até 100 km" },
    { value: "maior", label: "Acima de 100 km" },
  ]
  options.forEach((opt) => {
    const o = document.createElement("option")
    o.value = opt.value
    o.textContent = opt.label
    distSelect.appendChild(o)
  })
  // Preenche opção inicial
  if (init.km_option) {
    const initVal = String(init.km_option).toLowerCase()
    const matched = options.find((o) => o.value === initVal || o.label.toLowerCase().includes(initVal))
    if (matched) distSelect.value = matched.value
  }

  // Input de km total (somente visível quando opção for >100km)
  const kmInput = document.createElement("input")
  kmInput.type = "number"
  kmInput.className = "km-total"
  kmInput.placeholder = "Km total (ida e volta)"
  kmInput.step = "0.01"
  kmInput.style.flex = "1"
  kmInput.style.minWidth = "140px"
  kmInput.style.padding = "0.5rem"
  kmInput.style.background = "var(--bg-input)"
  kmInput.style.border = "1px solid var(--border-color)"
  kmInput.style.borderRadius = "6px"
  kmInput.style.color = "var(--text-primary)"
  // Mostra ou oculta campos de acordo com seleção
  const updateFieldsVisibility = (value) => {
    // Campo de km total - só visível quando for "maior" (acima de 100km)
    if (value === "maior") {
      kmInput.style.display = "block"
      kmInput.required = true
    } else {
      kmInput.style.display = "none"
      kmInput.required = false
      kmInput.value = ""
    }

    // Campo de placa - oculto quando for "nenhum" (sem deslocamento)
    if (value === "nenhum") {
      vehicleSelect.style.display = "none"
      vehicleSelect.required = false
      vehicleSelect.value = ""
    } else {
      vehicleSelect.style.display = "block"
      vehicleSelect.required = false // Não é obrigatório, mas é visível
    }
  }

  // Atribui valor inicial
  if (init.km_total !== undefined && init.km_total !== null) {
    kmInput.value = init.km_total
  }

  // Listener para troca de opção
  distSelect.addEventListener("change", (e) => {
    updateFieldsVisibility(e.target.value)
    autoSaveFormData()
  })

  // Select de veículo
  const vehicleSelect = document.createElement("select")
  vehicleSelect.className = "vehicle-select"
  vehicleSelect.style.flex = "1"
  vehicleSelect.style.minWidth = "150px"
  vehicleSelect.style.padding = "0.5rem"
  vehicleSelect.style.background = "var(--bg-input)"
  vehicleSelect.style.border = "1px solid var(--border-color)"
  vehicleSelect.style.borderRadius = "6px"
  vehicleSelect.style.color = "var(--text-primary)"
  // Preenche opções
  const defaultOpt = document.createElement("option")
  defaultOpt.value = ""
  defaultOpt.textContent = "Placa do carro"
  vehicleSelect.appendChild(defaultOpt)
  vehiclesList.forEach((v) => {
    const opt = document.createElement("option")
    opt.value = v.id
    // Mostra "Nome do Carro - PLACA" se tiver nome, senão só a placa
    opt.textContent = v.name ? `${v.name} - ${v.plate}` : v.plate
    vehicleSelect.appendChild(opt)
  })
  // Valor inicial
  if (init.vehicle_id) {
    vehicleSelect.value = String(init.vehicle_id)
  }

  // Aplica visibilidade inicial dos campos
  updateFieldsVisibility(distSelect.value)

  // Botão de remover
  const removeBtn = document.createElement("button")
  removeBtn.type = "button"
  removeBtn.textContent = "×"
  removeBtn.title = "Remover deslocamento"
  removeBtn.style.background = "var(--error)"
  removeBtn.style.color = "white"
  removeBtn.style.border = "none"
  removeBtn.style.padding = "0 0.5rem"
  removeBtn.style.borderRadius = "6px"
  removeBtn.addEventListener("click", () => {
    row.remove()
    autoSaveFormData()
  })

  // Adiciona listeners de auto-save
  kmInput.addEventListener('input', autoSaveFormData)
  kmInput.addEventListener('change', autoSaveFormData)
  vehicleSelect.addEventListener('change', autoSaveFormData)

  // Monta linha
  row.appendChild(distSelect)
  row.appendChild(kmInput)
  row.appendChild(vehicleSelect)
  row.appendChild(removeBtn)

  container.appendChild(row)
}

function addMaterialLine() {
  const container = document.getElementById("materialsContainer")
  if (!container) return
  const row = document.createElement("div")
  row.className = "material-row"
  row.style.display = "flex"
  row.style.gap = "0.5rem"
  row.style.marginTop = "0.5rem"
  row.innerHTML = `
    <input type="text" class="material-name" placeholder="Material" style="flex:2; padding:0.5rem; background: var(--bg-input); border: 1px solid var(--border-color); border-radius: 6px; color: var(--text-primary);">
    <input type="number" class="material-qty" step="0.01" placeholder="Qtde" style="flex:1; padding:0.5rem; background: var(--bg-input); border: 1px solid var(--border-color); border-radius: 6px; color: var(--text-primary);">
    <input type="number" class="material-price" step="0.01" placeholder="Unitário (R$)" style="flex:1; padding:0.5rem; background: var(--bg-input); border: 1px solid var(--border-color); border-radius: 6px; color: var(--text-primary);">
    <button type="button" class="remove-material" style="background: var(--error); color:white; border:none; padding:0 0.5rem; border-radius:6px;">&times;</button>
  `
  row.querySelector(".remove-material").addEventListener("click", () => {
    row.remove()
    autoSaveFormData()
  })
  // Adiciona listeners de auto-save
  row.querySelectorAll('input').forEach(input => {
    input.addEventListener('input', autoSaveFormData)
    input.addEventListener('change', autoSaveFormData)
  })
  container.appendChild(row)
}

/**
 * Limpa todos os períodos de trabalho exibidos.
 * Será chamado ao abrir o modal de finalização para iniciar com uma linha em branco.
 */
function resetTimeEntries() {
  const container = document.getElementById("timeEntriesContainer")
  if (container) container.innerHTML = ""
}

/**
 * Adiciona uma nova linha de período de trabalho (data + hora início + hora fim) ao container.
 * Aceita opcionalmente valores iniciais para preenchimento (ISO 8601 ou formato aceito pelo input).
 * Nova versão simplificada: 1 campo de data + 2 campos de hora (início e fim)
 * @param {Object} [init] Valores iniciais para o período
 */
function addTimeEntryRow(init = {}) {
  const container = document.getElementById("timeEntriesContainer")
  if (!container) return

  const row = document.createElement("div")
  row.className = "time-entry-row"
  row.style.display = "flex"
  row.style.flexWrap = "wrap"
  row.style.gap = "0.75rem"
  row.style.marginTop = "0.5rem"
  row.style.alignItems = "flex-end"
  row.style.justifyContent = "center"
  row.style.padding = "0.75rem"
  row.style.background = "var(--bg-secondary)"
  row.style.borderRadius = "8px"
  row.style.border = "1px solid var(--border-color)"

  // Extrair data e hora dos valores iniciais (se existirem)
  let initDate = ""
  let initStartTime = ""
  let initEndTime = ""
  if (init.start_datetime) {
    try {
      const d = parseAsLocalTime(init.start_datetime)
      if (d && !isNaN(d.getTime())) {
        initDate = d.toISOString().split('T')[0]
        initStartTime = d.toTimeString().slice(0, 5)
      }
    } catch (_e) {}
  }
  if (init.end_datetime) {
    try {
      const d = parseAsLocalTime(init.end_datetime)
      if (d && !isNaN(d.getTime())) {
        if (!initDate) initDate = d.toISOString().split('T')[0]
        initEndTime = d.toTimeString().slice(0, 5)
      }
    } catch (_e) {}
  }

  // Container para input de data
  const dateContainer = document.createElement("div")
  dateContainer.style.flex = "1"
  dateContainer.style.minWidth = "140px"
  dateContainer.style.maxWidth = "180px"
  dateContainer.style.display = "flex"
  dateContainer.style.flexDirection = "column"
  dateContainer.style.gap = "0.25rem"

  const dateLabel = document.createElement("label")
  dateLabel.innerHTML = `
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align: middle; margin-right: 4px;">
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
      <line x1="16" y1="2" x2="16" y2="6"/>
      <line x1="8" y1="2" x2="8" y2="6"/>
      <line x1="3" y1="10" x2="21" y2="10"/>
    </svg>
    Data
  `
  dateLabel.style.fontSize = "0.75rem"
  dateLabel.style.fontWeight = "500"
  dateLabel.style.color = "var(--text-secondary)"
  dateLabel.style.display = "flex"
  dateLabel.style.alignItems = "center"

  const dateInput = document.createElement("input")
  dateInput.type = "date"
  dateInput.className = "work-date"
  dateInput.required = true
  dateInput.style.padding = "0.5rem"
  dateInput.style.background = "var(--bg-input)"
  dateInput.style.border = "1px solid var(--border-color)"
  dateInput.style.borderRadius = "6px"
  dateInput.style.color = "var(--text-primary)"
  dateInput.value = initDate || new Date().toISOString().split('T')[0]

  dateContainer.appendChild(dateLabel)
  dateContainer.appendChild(dateInput)

  // Container para hora de início
  const startContainer = document.createElement("div")
  startContainer.style.flex = "0 0 auto"
  startContainer.style.minWidth = "100px"
  startContainer.style.display = "flex"
  startContainer.style.flexDirection = "column"
  startContainer.style.gap = "0.25rem"
  startContainer.style.alignItems = "center"

  const startLabel = document.createElement("label")
  startLabel.innerHTML = `
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align: middle; margin-right: 4px;">
      <circle cx="12" cy="12" r="10"/>
      <polyline points="12 6 12 12 16 14"/>
    </svg>
    Início
  `
  startLabel.style.fontSize = "0.75rem"
  startLabel.style.fontWeight = "500"
  startLabel.style.color = "var(--text-secondary)"
  startLabel.style.display = "flex"
  startLabel.style.alignItems = "center"

  // Usa select com horas de 30 em 30 minutos (scroll picker)
  const startInput = createTimeSelect("start-time", initStartTime)

  startContainer.appendChild(startLabel)
  startContainer.appendChild(startInput)

  // Container para hora de fim
  const endContainer = document.createElement("div")
  endContainer.style.flex = "0 0 auto"
  endContainer.style.minWidth = "100px"
  endContainer.style.display = "flex"
  endContainer.style.flexDirection = "column"
  endContainer.style.gap = "0.25rem"
  endContainer.style.alignItems = "center"

  const endLabel = document.createElement("label")
  endLabel.innerHTML = `
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align: middle; margin-right: 4px;">
      <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/>
      <line x1="4" y1="22" x2="4" y2="15"/>
    </svg>
    Fim
  `
  endLabel.style.fontSize = "0.75rem"
  endLabel.style.fontWeight = "500"
  endLabel.style.color = "var(--text-secondary)"
  endLabel.style.display = "flex"
  endLabel.style.alignItems = "center"

  // Usa select com horas de 30 em 30 minutos (scroll picker)
  const endInput = createTimeSelect("end-time", initEndTime)

  endContainer.appendChild(endLabel)
  endContainer.appendChild(endInput)

  // botão remover
  const removeBtn = document.createElement("button")
  removeBtn.type = "button"
  removeBtn.textContent = "×"
  removeBtn.title = "Remover período"
  removeBtn.style.background = "var(--error)"
  removeBtn.style.color = "white"
  removeBtn.style.border = "none"
  removeBtn.style.width = "32px"
  removeBtn.style.height = "32px"
  removeBtn.style.borderRadius = "6px"
  removeBtn.style.fontSize = "1.25rem"
  removeBtn.style.lineHeight = "1"
  removeBtn.style.cursor = "pointer"
  removeBtn.style.flexShrink = "0"
  removeBtn.addEventListener("click", () => {
    row.remove()
    autoSaveFormData()
  })

  // Adiciona listeners de auto-save nos inputs
  dateInput.addEventListener('change', autoSaveFormData)
  startInput.addEventListener('change', autoSaveFormData)
  endInput.addEventListener('change', autoSaveFormData)

  row.appendChild(dateContainer)
  row.appendChild(startContainer)
  row.appendChild(endContainer)
  row.appendChild(removeBtn)
  container.appendChild(row)
}

/**
 * Carrega dados da OS e tenta obter as máquinas da empresa por diferentes rotas.
 * Em seguida, converte o campo em um input com datalist (campo único).
 */
async function populateMachineSelect(osId) {
  const sel = document.getElementById("finishMachineSelect")
  if (!sel) return

  // Deixa o select oculto; usaremos apenas para armazenar o ID escolhido
  sel.style.display = "none"
  sel.required = false
  sel.innerHTML = "" // limpa qualquer lixo prévio

  // Cria (ou obtém) o input + datalist
  const inputId = "machineSmartInput"
  const listId = "machineOptions"
  let smartInput = document.getElementById(inputId)
  let dataList = document.getElementById(listId)

  if (!smartInput) {
    smartInput = document.createElement("input")
    smartInput.id = inputId
    smartInput.setAttribute("list", listId)
    smartInput.setAttribute("placeholder", "Digite o nº de série ou selecione o modelo...")
    smartInput.setAttribute("autocomplete", "off")
    smartInput.required = true
    smartInput.style.width = "100%"
    smartInput.style.padding = "0.6rem"
    smartInput.style.background = "var(--bg-input)"
    smartInput.style.border = "1px solid var(--border-color)"
    smartInput.style.borderRadius = "6px"
    smartInput.style.color = "var(--text-primary)"
    sel.parentElement.appendChild(smartInput)
  }
  if (!dataList) {
    dataList = document.createElement("datalist")
    dataList.id = listId
    document.body.appendChild(dataList)
  }

  // Busca OS
  let osData = null
  try {
    const res = await fetch(`${API_URL}/api/os/${osId}`)
    osData = await res.json()
    if (!res.ok) throw new Error(osData?.message || "Falha ao carregar OS")
  } catch (err) {
    console.error(err)
    showToast("Erro ao carregar dados da OS.", "error")
    dataList.innerHTML = ""
    smartInput.value = ""
    sel.value = ""
    return
  }

  // Obtém máquinas da empresa (várias estratégias/fallbacks)
  const machines = await getMachinesForCompany(osData)

  __machineCatalog = Array.isArray(machines) ? machines : []
  __machineByLabel.clear()
  __machineBySerial.clear()

  if (__machineCatalog.length === 0) {
    // Sem máquinas: deixa datalist vazio e permite digitar o serial.
    dataList.innerHTML = ""
    smartInput.value = ""
    sel.value = ""
    showToast("Nenhuma máquina cadastrada para esta empresa. Digite o nº de série.", "error")
  } else {
    // Preenche datalist e índices
    const optionsHtml = __machineCatalog
      .map((m) => {
        const serial = (m.serial_number || "").trim()
        const model = (m.model || "").trim()
        // label preferindo serial no início (facilita digitar o serial)
        const label = serial ? `${serial} — ${model || "Sem modelo"}` : `${model} — (sem série)`
        // Armazena rótulo e serial em minúsculas e sem espaços extras
        __machineByLabel.set(label.toLowerCase().trim(), m.id)
        if (serial) __machineBySerial.set(serial.toLowerCase().trim(), m.id)
        return `<option value="${escapeHtml(label)}"></option>`
      })
      .join("")
    dataList.innerHTML = optionsHtml

    // Se já existe uma máquina vinculada à OS, preenche o input
    if (osData.machine_id) {
      const m = __machineCatalog.find((x) => Number(x.id) === Number(osData.machine_id))
      if (m) {
        const serial = (m.serial_number || "").trim()
        const model = (m.model || "").trim()
        const label = serial ? `${serial} — ${model || "Sem modelo"}` : `${model} — (sem série)`
        smartInput.value = label
        sel.value = String(m.id)
      }
    } else {
      smartInput.value = ""
      sel.value = ""
    }
  }

  // Resolve seleção quando o usuário muda/termina de digitar
  const resolveSelection = async () => {
    const raw = (smartInput.value || "").trim()
    if (!raw) {
      sel.value = ""
      return
    }
    // 1) procura pelo rótulo completo (case-insensitive)
    const key = raw.toLowerCase().trim()
    if (__machineByLabel.has(key)) {
      sel.value = String(__machineByLabel.get(key))
      return
    }
    // 2) procura pelo número de série local
    const serialOnly = parseSerialFromLabel(raw)
    if (serialOnly && __machineBySerial.has(serialOnly)) {
      sel.value = String(__machineBySerial.get(serialOnly))
      return
    }
    // 3) tenta consultar o backend por serial
    const foundId = await lookupMachineIdBySerial(serialOnly, osData?.company_id, osData?.company_name)
    if (foundId) {
      sel.value = String(foundId)
      // se não estava no catálogo, adiciona para manter consistência local
      if (!__machineCatalog.some((x) => Number(x.id) === Number(foundId))) {
        __machineCatalog.push({ id: foundId, serial_number: serialOnly, model: "" })
        // armazena o número de série em minúsculas como chave
        __machineBySerial.set(serialOnly.toLowerCase(), foundId)
      }
      return
    }
    // Se nada deu certo, limpa valor
    sel.value = ""
  }

  // Atribui eventos para resolver seleção: inclui oninput para captar digitação em tempo real
  smartInput.oninput = resolveSelection
  smartInput.onchange = resolveSelection
  smartInput.onblur = resolveSelection
  smartInput.onkeydown = (e) => {
    if (e.key === "Enter") {
      e.preventDefault()
      resolveSelection()
    }
  }
}

/**
 * Estratégia robusta para obter máquinas da empresa de uma OS.
 * Tenta:
 *  - osData.machines (quando backend já envia)
 *  - /api/machines?company_id=
 *  - /api/companies/{id}/machines
 *  - /api/machines/company/{id}
 *  - /api/machines/by-company?name=
 *  - /api/companies?search=  (esperando que retorne machines no primeiro item)
 */
async function getMachinesForCompany(osData) {
  const fromOs = Array.isArray(osData?.machines) ? osData.machines : []
  if (fromOs.length) return fromOs

  const cid = osData?.company_id
  const cname = osData?.company_name

  // helpers
  const tryJson = async (url) => {
    try {
      const r = await fetch(url)
      if (!r.ok) return null
      return await r.json()
    } catch (_e) {
      return null
    }
  }

  // Por company_id
  if (cid) {
    // 1) /api/machines?company_id=
    let j = await tryJson(`${API_URL}/api/machines?company_id=${encodeURIComponent(cid)}`)
    if (Array.isArray(j) && j.length) return j

    // 2) /api/companies/{id}/machines
    j = await tryJson(`${API_URL}/api/companies/${encodeURIComponent(cid)}/machines`)
    if (Array.isArray(j) && j.length) return j

    // 3) /api/machines/company/{id}
    j = await tryJson(`${API_URL}/api/machines/company/${encodeURIComponent(cid)}`)
    if (Array.isArray(j) && j.length) return j
  }

  // Por company_name
  if (cname) {
    // 4) /api/machines/by-company?name=
    let j = await tryJson(`${API_URL}/api/machines/by-company?name=${encodeURIComponent(cname)}`)
    if (Array.isArray(j) && j.length) return j

    // 5) /api/companies?search=  (espera first.machines)
    j = await tryJson(`${API_URL}/api/companies?search=${encodeURIComponent(cname)}`)
    if (Array.isArray(j) && j[0] && Array.isArray(j[0].machines)) return j[0].machines
  }

  return []
}

/**
 * Procura machine_id a partir do número de série. Tenta endpoints comuns.
 */
async function lookupMachineIdBySerial(serial, companyId, companyName) {
  if (!serial) return null

  const candidates = [
    `${API_URL}/api/machines/find?serial=${encodeURIComponent(serial)}`,
    `${API_URL}/api/machines?serial=${encodeURIComponent(serial)}`,
    `${API_URL}/api/machines/by-serial/${encodeURIComponent(serial)}`,
    `${API_URL}/api/machines/search?q=${encodeURIComponent(serial)}`,
  ]

  for (const url of candidates) {
    try {
      const r = await fetch(url)
      if (!r.ok) continue
      const j = await r.json()

      // aceita tanto objeto único quanto lista
      if (j && typeof j === "object" && !Array.isArray(j) && j.id) {
        // se tiver empresa e não bater, ainda assim retorna (backend valida)
        return j.id
      }
      if (Array.isArray(j) && j.length) {
        const first = j[0]
        if (first && first.id) return first.id
      }
    } catch (_e) {}
  }

  // como último recurso, se temos catálogo em memória, tenta match por serial (case-insensitive)
  const inMem = __machineCatalog.find((m) => (m.serial_number || "").toLowerCase() === String(serial).toLowerCase())
  if (inMem) return inMem.id

  return null
}

function showLoadingOverlay(message = "Finalizando OS...") {
  let overlay = document.getElementById("loadingOverlay")
  if (!overlay) {
    overlay = document.createElement("div")
    overlay.id = "loadingOverlay"
    overlay.innerHTML = `
      <div class="loading-content">
        <div class="loading-spinner"></div>
        <p class="loading-text">${message}</p>
      </div>
    `
    document.body.appendChild(overlay)
  }
  overlay.style.display = "flex"
}

function hideLoadingOverlay() {
  const overlay = document.getElementById("loadingOverlay")
  if (overlay) overlay.style.display = "none"
}

async function handleFinishSubmit(e) {
  e.preventDefault()
  if (isSubmittingFinish) return
  
  // Valida se o técnico respondeu sobre materiais e serviço adicional
  const hasMaterialsAnswer = document.querySelector('input[name="hasMaterials"]:checked')
  const hasServiceAnswer = document.querySelector('input[name="hasAdditionalService"]:checked')
  
  if (!hasMaterialsAnswer) {
    showToast("Por favor, informe se houve uso de materiais (Sim ou Não).", "error")
    // Scroll até a pergunta
    document.querySelector('input[name="hasMaterials"]').scrollIntoView({ behavior: 'smooth', block: 'center' })
    return
  }
  
  if (!hasServiceAnswer) {
    showToast("Por favor, informe se houve serviço adicional (Sim ou Não).", "error")
    // Scroll até a pergunta
    document.querySelector('input[name="hasAdditionalService"]').scrollIntoView({ behavior: 'smooth', block: 'center' })
    return
  }

  isSubmittingFinish = true

  // Mostra loading
  showLoadingOverlay("Finalizando OS...")

  const osId = currentOsId || document.getElementById("finishOsId").value
  if (!osId) {
    showToast("OS inválida.", "error")
    isSubmittingFinish = false
    hideLoadingOverlay()
    return
  }

  // Campo único: smart input resolve para o select oculto (machine_id)
  const sel = document.getElementById("finishMachineSelect")
  const smartInput = document.getElementById("machineSmartInput")
  // força resolução final se o usuário só digitou e apertou salvar
  if (smartInput && !sel.value) {
    const ev = new Event("blur")
    smartInput.dispatchEvent(ev)
  }

  let machine_id = sel && sel.value ? Number(sel.value) : null
  // Fallback: se ainda não há machine_id, tenta resolver agora usando o valor do smartInput
  if (!machine_id && smartInput && smartInput.value) {
    machine_id = await resolveMachineIdNow()
    if (machine_id) {
      sel.value = String(machine_id)
    }
  }

  // VALIDAÇÃO CRÍTICA: Verifica se a máquina foi selecionada
  if (!machine_id) {
    showToast("Por favor, selecione uma máquina válida antes de finalizar a OS.", "error")
    isSubmittingFinish = false
    hideLoadingOverlay()
    if (smartInput) {
      smartInput.focus()
      smartInput.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
    return
  }

  // Coleta períodos de trabalho do usuário (início/fim)
  const timeRows = document.querySelectorAll("#timeEntriesContainer .time-entry-row")
  const worklogsArr = []
  let earliest = null
  let latest = null
  let earliestVal = null
  let latestVal = null
  if (!timeRows || timeRows.length === 0) {
    showToast("Adicione pelo menos um período de trabalho.", "error")
    isSubmittingFinish = false
    hideLoadingOverlay()
    return
  }
  for (const row of timeRows) {
    const dateInput = row.querySelector(".work-date")
    const startInput = row.querySelector(".start-time")
    const endInput = row.querySelector(".end-time")
    const dateVal = dateInput ? dateInput.value : ""
    const startTimeVal = startInput ? startInput.value : ""
    const endTimeVal = endInput ? endInput.value : ""
    if (!dateVal || !startTimeVal || !endTimeVal) {
      showToast("Preencha a data e os horários de início e fim.", "error")
      isSubmittingFinish = false
      hideLoadingOverlay()
      return
    }
    // Combina data + hora para criar datetime completo
    const sv = `${dateVal}T${startTimeVal}`
    const ev = `${dateVal}T${endTimeVal}`
    const sDate = new Date(sv)
    const eDate = new Date(ev)
    if (Number.isNaN(sDate.getTime()) || Number.isNaN(eDate.getTime()) || eDate < sDate) {
      showToast("Verifique os períodos de trabalho: o horário de início deve ser anterior ao de término.", "error")
      isSubmittingFinish = false
      hideLoadingOverlay()
      return
    }
    worklogsArr.push({ start_datetime: sv, end_datetime: ev })
    if (!earliest || sDate < earliest) {
      earliest = sDate
      earliestVal = sv
    }
    if (!latest || eDate > latest) {
      latest = eDate
      latestVal = ev
    }
  }

  // Valida sobreposição de períodos
  for (let i = 0; i < worklogsArr.length; i++) {
    const period1Start = new Date(worklogsArr[i].start_datetime)
    const period1End = new Date(worklogsArr[i].end_datetime)

    for (let j = i + 1; j < worklogsArr.length; j++) {
      const period2Start = new Date(worklogsArr[j].start_datetime)
      const period2End = new Date(worklogsArr[j].end_datetime)

      // Verifica se há sobreposição: período 1 termina depois que período 2 começa E período 1 começa antes que período 2 termina
      if (period1End > period2Start && period1Start < period2End) {
        showToast("Os períodos de trabalho não podem se sobrepor. Corrija as datas/horas.", "error")
        isSubmittingFinish = false
        hideLoadingOverlay()
        return
      }
    }
  }

  const payload = {
    // Usa o intervalo mais cedo e o mais tarde como agregados para compatibilidade
    start_datetime: earliestVal,
    end_datetime: latestVal,
    service_description: document.getElementById("finishDescription").value,
    occurrence: document.getElementById("finishCallReason").value,
    materials: [],
    machine_id,
    worklogs: worklogsArr,
  }

  // Tipo de manutenção manual selecionado
  const mtSelect = document.getElementById("maintenanceTypeSelect")
  const maintenanceVal = mtSelect ? mtSelect.value : ""
  if (!maintenanceVal) {
    showToast("Selecione o tipo de manutenção.", "error")
    isSubmittingFinish = false
    hideLoadingOverlay()
    return
  }
  payload.maintenance_type = maintenanceVal

  // Materiais
  document.querySelectorAll("#materialsContainer .material-row").forEach((row) => {
    const name = row.querySelector(".material-name").value.trim()
    const qty = Number.parseFloat(row.querySelector(".material-qty").value)
    const price = Number.parseFloat(row.querySelector(".material-price").value)
    if (name) payload.materials.push({ name, quantity: qty || 0, unit_price: price || 0 })
  })

  // Deslocamentos
  payload.displacements = []
  let displacementValidationError = null
  document.querySelectorAll("#displacementContainer .displacement-row").forEach((row) => {
    const kmSelect = row.querySelector(".km-option")
    const kmValue = kmSelect ? kmSelect.value : ""
    const kmTotalInput = row.querySelector(".km-total")
    let kmTotal = null

    // Só captura km_total se a opção for "maior" (acima de 100km)
    const isMaior = kmValue && kmValue.toLowerCase() === "maior"
    if (isMaior) {
      if (kmTotalInput && kmTotalInput.value) {
        const n = Number.parseFloat(kmTotalInput.value)
        if (!isNaN(n) && n > 0) {
          kmTotal = n
        } else {
          displacementValidationError = "Para deslocamento acima de 100km, informe a quilometragem total."
        }
      } else {
        displacementValidationError = "Para deslocamento acima de 100km, informe a quilometragem total."
      }
    }

    const vehicleSel = row.querySelector(".vehicle-select")
    const vehId = vehicleSel ? vehicleSel.value : ""
    payload.displacements.push({ km_option: kmValue, km_total: kmTotal, vehicle_id: vehId })
  })

  // Valida se há erro de deslocamento
  if (displacementValidationError) {
    showToast(displacementValidationError, "error")
    isSubmittingFinish = false
    hideLoadingOverlay()
    return
  }

  // Assinaturas
  const techSig = getStoredTechnicianSignature()
  payload.technician_signature = techSig || ""

  const clientCanvas = document.getElementById("clientSignatureCanvas")
  payload.client_signature = clientCanvas ? clientCanvas.toDataURL("image/png") : ""

  // Valor do serviço adicional e observação
  const valField = document.getElementById("finishAdditionalServiceValue")
  const noteField = document.getElementById("finishAdditionalServiceNote")
  let additionalVal = null
  if (valField && valField.value) {
    const parsed = Number.parseFloat(valField.value)
    if (!isNaN(parsed) && parsed >= 0) additionalVal = parsed
  }
  const additionalNote = noteField && noteField.value ? noteField.value.trim() : ""
  if (additionalVal !== null) payload.value_service = additionalVal
  if (additionalNote) payload.additional_service_note = additionalNote

  // Responsável pelo chamado (quando preenchido pelo técnico - OS não veio de solicitação)
  const requesterInput = document.getElementById('requesterInput')
  const requesterInputContainer = document.getElementById('requesterInputContainer')
  if (requesterInputContainer && requesterInputContainer.style.display !== 'none' && requesterInput) {
    const requesterValue = requesterInput.value.trim()
    if (requesterValue) {
      payload.requester = requesterValue
    }
  }

  try {
    console.log('📤 [FINISH] Enviando finalização para API:', {
      url: `${API_URL}/api/os/${osId}/finish`,
      osId,
      payload
    })

    // Timeout de 60 segundos
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 60000)

    const res = await fetch(`${API_URL}/api/os/${osId}/finish`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: controller.signal
    })

    clearTimeout(timeoutId)

    console.log('📡 [FINISH] Resposta recebida:', {
      status: res.status,
      statusText: res.statusText,
      ok: res.ok
    })

    let data
    try {
      data = await res.json()
      console.log('📦 [FINISH] Dados da resposta:', data)
    } catch (jsonErr) {
      console.error('❌ [FINISH] Erro ao parsear JSON:', jsonErr)
      throw new Error('Resposta inválida do servidor')
    }

    if (!res.ok) {
      console.error('❌ [FINISH] Erro na finalização:', data)
      showToast(data.message || "Erro ao finalizar OS.", "error")
      return
    }

    console.log('✅ [FINISH] OS finalizada com sucesso!')
    showToast("OS finalizada com sucesso!", "success")
    closeFinishModal()
    loadOSList()
  } catch (err) {
    console.error('❌ [FINISH] Erro capturado:', err)
    if (err.name === 'AbortError') {
      showToast("Tempo limite excedido. Tente novamente.", "error")
    } else {
      showToast(err.message || "Erro ao finalizar OS.", "error")
    }
  } finally {
    // GARANTE que o loading SEMPRE será escondido
    console.log('🔄 [FINISH] Limpando estado...')
    hideLoadingOverlay()
    isSubmittingFinish = false
  }
}

// ╔═══════════════════════════════════════════════════════════════════════════════╗
// ║                        SEÇÃO 12: ASSINATURAS                                  ║
// ╚═══════════════════════════════════════════════════════════════════════════════╝
function initSignatureFeature() {
  const openBtn = document.getElementById("openSignatureModal")
  const modal = document.getElementById("signatureModal")
  const closeBtn = document.getElementById("closeSignatureModal")

  // Atualiza o botão para mostrar status da assinatura
  updateSignatureButtonStatus()

  if (openBtn && modal) {
    openBtn.addEventListener("click", () => {
      modal.style.display = "flex"
      initTechSignatureCanvas()
      // Carrega assinatura existente se houver
      loadExistingSignature()
    })
  }
  if (closeBtn && modal) {
    closeBtn.addEventListener("click", () => {
      modal.style.display = "none"
    })
  }
  
  // Fechar modal clicando fora
  window.addEventListener("click", (e) => {
    if (e.target === modal) {
      modal.style.display = "none"
    }
  })

  const clearSigBtn = document.getElementById("clearSignatureBtn")
  const saveSigBtn = document.getElementById("saveSignatureBtn")
  if (clearSigBtn) {
    clearSigBtn.addEventListener("click", () => {
      const canvas = document.getElementById("signatureCanvas")
      const ctx = canvas.getContext("2d")
      // Limpa e redefine fundo branco
      ctx.fillStyle = '#FFFFFF'
      ctx.fillRect(0, 0, canvas.width, canvas.height)
    })
  }
  if (saveSigBtn) {
    saveSigBtn.addEventListener("click", () => saveTechnicianSignature())
  }
}

function initTechSignatureCanvas() {
  const canvas = document.getElementById("signatureCanvas")
  if (!canvas) return

  // Define fundo branco no canvas para assinatura
  const ctx = canvas.getContext("2d")
  ctx.fillStyle = '#FFFFFF'
  ctx.fillRect(0, 0, canvas.width, canvas.height)

  attachSignatureDrawing(canvas)
}

async function saveTechnicianSignature() {
  const canvas = document.getElementById("signatureCanvas")
  if (!canvas) return

  const dataUrl = canvas.toDataURL("image/png")
  const techId = getStoredTechnicianId()
  if (!techId) {
    showToast("ID do técnico não encontrado.", "error")
    return
  }

  // Verifica se já tinha assinatura ANTES de salvar
  const hadSignature = !!getStoredTechnicianSignature()

  try {
    const res = await fetch(`${API_URL}/api/technicians/${techId}/signature`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ signature: dataUrl }),
    })
    const data = await res.json()

    if (!res.ok) {
      showToast(data.message || "Erro ao salvar assinatura", "error")
      return
    }

    setStoredTechnicianSignature(data.signature)
    showToast(hadSignature ? "Assinatura atualizada com sucesso!" : "Assinatura cadastrada com sucesso!", "success")

    const modal = document.getElementById("signatureModal")
    if (modal) modal.style.display = "none"

    // Atualiza o botão para mostrar que já tem assinatura
    updateSignatureButtonStatus()
  } catch (err) {
    console.error(err)
    showToast("Erro de rede ao salvar assinatura.", "error")
  }
}

// Atualiza o status do botão de assinatura
function updateSignatureButtonStatus() {
  const openBtn = document.getElementById("openSignatureModal")
  if (!openBtn) return
  
  const existingSignature = getStoredTechnicianSignature()
  if (existingSignature) {
    openBtn.innerHTML = 'Minha Assinatura'
    openBtn.className = 'btn-success'
  } else {
    openBtn.innerHTML = 'Cadastrar Minha Assinatura'
    openBtn.className = 'btn-secondary'
  }
}

// Carrega assinatura existente no canvas
function loadExistingSignature() {
  const canvas = document.getElementById("signatureCanvas")
  if (!canvas) return
  
  const existingSignature = getStoredTechnicianSignature()
  if (!existingSignature) {
    // Se não tem assinatura, mostra mensagem
    updateSignatureModalMessage('Assine no campo abaixo para cadastrar sua assinatura:')
    return
  }
  
  // Carrega a assinatura existente no canvas
  const ctx = canvas.getContext("2d")
  const img = new Image()
  img.onload = () => {
    // Define fundo branco antes de carregar
    ctx.fillStyle = '#FFFFFF'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    ctx.drawImage(img, 0, 0)
  }
  img.src = existingSignature
  
  // Atualiza mensagem do modal
  updateSignatureModalMessage('Sua assinatura atual (você pode editar e salvar novamente):')
}

// Atualiza mensagem do modal de assinatura
function updateSignatureModalMessage(message) {
  const modal = document.getElementById("signatureModal")
  if (!modal) return
  
  let msgElement = modal.querySelector('.signature-modal-message')
  if (!msgElement) {
    msgElement = document.createElement('p')
    msgElement.className = 'signature-modal-message'
    const h2 = modal.querySelector('h2')
    if (h2 && h2.nextSibling) {
      h2.parentNode.insertBefore(msgElement, h2.nextSibling)
    }
  }
  msgElement.textContent = message
}

function initClientSignatureCanvas() {
  const canvas = document.getElementById("clientSignatureCanvas")
  if (!canvas) return

  // Define fundo branco no canvas para assinatura
  const ctx = canvas.getContext("2d")
  ctx.fillStyle = '#FFFFFF'
  ctx.fillRect(0, 0, canvas.width, canvas.height)

  attachSignatureDrawing(canvas)

  const clearClientBtn = document.getElementById("clearClientSignatureBtn")
  if (clearClientBtn) {
    clearClientBtn.addEventListener("click", () => {
      // Ao limpar, redefine o fundo branco
      ctx.fillStyle = '#FFFFFF'
      ctx.fillRect(0, 0, canvas.width, canvas.height)
    })
  }
}

// Desenho (mouse + touch) para canvas de assinaturas
function attachSignatureDrawing(canvas) {
  const ctx = canvas.getContext("2d")
  ctx.lineWidth = 2
  ctx.lineCap = "round"
  let drawing = false

  // Ajusta o canvas para considerar o device pixel ratio (retina displays)
  const scaleCanvas = () => {
    const rect = canvas.getBoundingClientRect()
    const dpr = window.devicePixelRatio || 1

    // Salva o conteúdo atual antes de redimensionar
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)

    // Define tamanho CSS do canvas
    canvas.style.width = rect.width + 'px'
    canvas.style.height = rect.height + 'px'
    // Define resolução interna considerando DPR
    canvas.width = rect.width * dpr
    canvas.height = rect.height * dpr
    ctx.scale(dpr, dpr)
    ctx.lineWidth = 2
    ctx.lineCap = "round"
    // Sempre usa preto para assinatura (independente do tema)
    ctx.strokeStyle = '#000000'

    // Restaura o conteúdo salvo (se houver)
    if (imageData && imageData.width > 0) {
      ctx.putImageData(imageData, 0, 0)
    }
  }
  scaleCanvas()

  const getPos = (e) => {
    const rect = canvas.getBoundingClientRect()

    let clientX, clientY
    if (e.touches && e.touches[0]) {
      clientX = e.touches[0].clientX
      clientY = e.touches[0].clientY
    } else {
      clientX = e.clientX
      clientY = e.clientY
    }

    // Calcula posição relativa ao canvas e ajusta para o DPR
    return {
      x: (clientX - rect.left) * (canvas.width / rect.width) / (window.devicePixelRatio || 1),
      y: (clientY - rect.top) * (canvas.height / rect.height) / (window.devicePixelRatio || 1)
    }
  }

  const start = (e) => {
    e.preventDefault()
    drawing = true
    ctx.beginPath()
    const p = getPos(e)
    ctx.moveTo(p.x, p.y)
  }

  const move = (e) => {
    if (!drawing) return
    e.preventDefault()
    const p = getPos(e)
    ctx.lineTo(p.x, p.y)
    ctx.stroke()
  }

  const end = (e) => {
    if (!drawing) return
    e.preventDefault()
    drawing = false
    ctx.closePath()
  }

  // Mouse
  canvas.addEventListener("mousedown", start)
  canvas.addEventListener("mousemove", move)
  canvas.addEventListener("mouseup", end)
  canvas.addEventListener("mouseleave", end)

  // Touch
  canvas.addEventListener("touchstart", start, { passive: false })
  canvas.addEventListener("touchmove", move, { passive: false })
  canvas.addEventListener("touchend", end)
  canvas.addEventListener("touchcancel", end)
}

// === Util ===
function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;")
}

// === Chatbot helper functions ===
// Identificador da conversa; reutilizado entre mensagens para manter contexto
let chatConvId = null

/**
 * Inicializa a interface de chat. Configura eventos de clique para abrir/fechar
 * o widget e enviar mensagens ao backend. O backend deve expor a rota
 * POST /api/chat que aceita {conversationId, message} e retorna {reply}.
 */
function initChat() {
  const chatToggle = document.getElementById('chatToggleBtn')
  const chatWidget = document.getElementById('chatWidget')
  const chatClose = document.getElementById('chatCloseBtn')
  const chatSendBtn = document.getElementById('chatSendBtn')
  const chatInput = document.getElementById('chatInput')
  const chatMessages = document.getElementById('chatMessages')
  if (!chatToggle || !chatWidget) return

  // Recupera ou cria um ID de conversa persistente
  chatConvId = localStorage.getItem('chatConvId') || generateUUID()
  localStorage.setItem('chatConvId', chatConvId)

  // Alterna exibição do widget e do botão
  chatToggle.addEventListener('click', () => {
    const isHidden = chatWidget.style.display === 'none' || chatWidget.style.display === ''
    if (isHidden) {
      chatWidget.style.display = 'flex'
      chatToggle.style.display = 'none'
    } else {
      chatWidget.style.display = 'none'
      chatToggle.style.display = 'flex'
    }
  })

  if (chatClose) {
    chatClose.addEventListener('click', () => {
      chatWidget.style.display = 'none'
      chatToggle.style.display = 'flex'
    })
  }

  const sendMsg = async () => {
    const msg = chatInput.value.trim()
    // Se houver imagem anexada, exija uma mensagem
    if (attachedImage && !msg) {
      showToast('Digite uma mensagem para enviar a imagem', 'error')
      return
    }
    // Se não houver mensagem nem imagem, não envia
    if (!msg && !attachedImage) return
    // Exibe a mensagem do usuário se houver
    if (msg) appendChatMessage(msg, 'user')
    // Se houver imagem anexada, adiciona pré-visualização ao chat e prepara para envio
    let imageToSend = null
    if (attachedImage) {
      appendChatImage(attachedImage, 'user')
      imageToSend = attachedImage
      attachedImage = null
      clearAttachmentPreview()
    }
    // Limpa campo de entrada
    chatInput.value = ''
    
    // Mostra indicador "digitando..."
    showTypingIndicator()
    
    try {
      const payload = { conversationId: chatConvId }
      if (msg) payload.message = msg
      if (imageToSend) payload.image = imageToSend
      const resp = await fetch(`${API_URL}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })
      const data = await resp.json()
      // Remove indicador "digitando..."
      hideTypingIndicator()
      
      if (resp.ok && data && typeof data.reply === 'string') {
        appendChatMessage(data.reply.trim(), 'assistant')
      } else {
        appendChatMessage('Falha ao obter resposta do assistente.', 'assistant')
      }
    } catch (err) {
      console.error(err)
      hideTypingIndicator()
      appendChatMessage('Erro ao enviar mensagem.', 'assistant')
    }
  }
  if (chatSendBtn) chatSendBtn.addEventListener('click', sendMsg)
  if (chatInput) {
    chatInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault()
        sendMsg()
      }
    })
  }

  // Inicializa gravação de áudio para o chat
  initChatAudioRecording()
  // Inicializa o upload de imagem para o chat
  initChatImageUpload()

  function appendChatMessage(text, role) {
    const messageContainer = document.createElement('div')
    messageContainer.className = 'chat-message-container ' + role
    
    // Se for mensagem do assistente, adiciona avatar
    if (role === 'assistant') {
      const avatar = document.createElement('div')
      avatar.className = 'chat-avatar'
      avatar.innerHTML = '<img src="mate-icon.jpg" alt="MATH" class="avatar-image" />'
      avatar.title = 'MATH - Assistente IA'
      messageContainer.appendChild(avatar)
    }
    
    const messageContent = document.createElement('div')
    messageContent.className = 'chat-message-content'
    
    // Se for assistente, adiciona nome
    if (role === 'assistant') {
      const nameLabel = document.createElement('div')
      nameLabel.className = 'chat-name'
      nameLabel.textContent = 'MATH'
      messageContent.appendChild(nameLabel)
    }
    
    const div = document.createElement('div')
    div.className = 'chat-message ' + role
    div.textContent = text
    messageContent.appendChild(div)
    
    messageContainer.appendChild(messageContent)
    chatMessages.appendChild(messageContainer)
    chatMessages.scrollTop = chatMessages.scrollHeight
  }
  
  // Mostra indicador de "digitando..."
  function showTypingIndicator() {
    // Remove indicador existente se houver
    hideTypingIndicator()
    
    const typingDiv = document.createElement('div')
    typingDiv.id = 'typingIndicator'
    typingDiv.className = 'chat-message-container assistant typing'
    
    const avatar = document.createElement('div')
    avatar.className = 'chat-avatar'
    avatar.innerHTML = '<img src="mate-icon.jpg" alt="MATH" class="avatar-image" />'
    typingDiv.appendChild(avatar)
    
    const contentDiv = document.createElement('div')
    contentDiv.className = 'chat-message-content'
    
    const nameLabel = document.createElement('div')
    nameLabel.className = 'chat-name'
    nameLabel.textContent = 'MATH'
    contentDiv.appendChild(nameLabel)
    
    const dotsDiv = document.createElement('div')
    dotsDiv.className = 'typing-dots'
    dotsDiv.innerHTML = '<span></span><span></span><span></span>'
    contentDiv.appendChild(dotsDiv)
    
    typingDiv.appendChild(contentDiv)
    chatMessages.appendChild(typingDiv)
    chatMessages.scrollTop = chatMessages.scrollHeight
  }
  
  // Esconde indicador de "digitando..."
  function hideTypingIndicator() {
    const typingDiv = document.getElementById('typingIndicator')
    if (typingDiv) {
      typingDiv.remove()
    }
  }
}

/**
 * Gera um UUID v4 simples para identificar a conversa. Não garante
 * unicidade absoluta mas é suficiente para uso local.
 */
function generateUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0
    const v = c === 'x' ? r : (r & 0x3 | 0x8)
    return v.toString(16)
  })
}

// ============================================================
// Tab Navigation System
// ============================================================

/**
 * Inicializa o sistema de tabs do técnico
 */
function initTechTabs() {
  const tabs = document.querySelectorAll('.tech-tab')
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      const tabName = tab.getAttribute('data-tab')
      switchTechTab(tabName)
    })
  })
}

/**
 * Alterna entre as tabs do painel do técnico
 */
function switchTechTab(tabName) {
  // Remove active de todas as tabs
  document.querySelectorAll('.tech-tab').forEach(t => t.classList.remove('active'))
  document.querySelectorAll('.tech-tab-content').forEach(c => {
    c.style.display = 'none'
    c.classList.remove('active')
  })

  // Ativa a tab selecionada
  const selectedTab = document.querySelector(`.tech-tab[data-tab="${tabName}"]`)
  const selectedContent = document.getElementById(`${tabName}Tab`)

  if (selectedTab && selectedContent) {
    selectedTab.classList.add('active')
    selectedContent.style.display = 'block'
    selectedContent.classList.add('active')

    // Carrega dados se necessário
    if (tabName === 'machines') {
      // Máquinas são carregadas sob demanda via busca
    } else if (tabName === 'allos') {
      loadAllOSForTech()
    } else if (tabName === 'companies') {
      // Empresas são buscadas sob demanda
    } else if (tabName === 'purchaseRequest') {
      loadMyPurchaseRequests()
    }
  }
}

/**
 * Busca máquinas (disponível para técnicos)
 */
async function searchMachinesTech() {
  const query = document.getElementById('machineSearchInput').value.trim()
  const resultsDiv = document.getElementById('machineResults')

  if (!query) {
    resultsDiv.innerHTML = '<p style="text-align:center;color:var(--text-secondary);padding:2rem;">Digite um termo para buscar</p>'
    return
  }

  resultsDiv.innerHTML = '<p style="text-align:center;padding:2rem;">Buscando...</p>'

  try {
    const response = await fetch(`${API_URL}/api/machines/search?q=${encodeURIComponent(query)}`)
    if (!response.ok) throw new Error('Erro ao buscar máquinas')

    const machines = await response.json()

    if (!machines || machines.length === 0) {
      resultsDiv.innerHTML = '<p style="text-align:center;color:var(--text-secondary);padding:2rem;">Nenhuma máquina encontrada</p>'
      return
    }

    resultsDiv.innerHTML = machines.map(m => `
      <div class="card" style="margin-bottom: 1rem;">
        <div class="card-header" style="background: var(--bg-input);">
          <h3>
            <svg class="icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="2" y="7" width="20" height="14" rx="2" ry="2"/>
              <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/>
            </svg>
            ${m.model || 'Modelo não informado'}
          </h3>
        </div>
        <div style="padding: 1rem;">
          <p><strong>Número de Série:</strong> ${m.serial_number || 'N/A'}</p>
          <p><strong>Empresa:</strong> ${m.company_name || 'N/A'}</p>
          <button onclick="viewMachineOSHistory(${m.id}, '${(m.model || 'Máquina').replace(/'/g, "\\'")}', '${(m.company_name || 'N/A').replace(/'/g, "\\'")}', true)" class="btn-primary" style="margin-top: 0.75rem;">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
              <polyline points="14 2 14 8 20 8"/>
            </svg>
            Ver Histórico de OS
          </button>
        </div>
      </div>
    `).join('')
  } catch (err) {
    console.error(err)
    showToast('Erro ao buscar máquinas', 'error')
    resultsDiv.innerHTML = '<p style="text-align:center;color:var(--error);padding:2rem;">Erro ao buscar máquinas</p>'
  }
}

/**
 * Visualiza histórico de OS de uma máquina (versão técnico - sem valores)
 */
async function viewMachineOSHistory(machineId, machineName, companyName, hidePrices = false) {
  try {
    const response = await fetch(`${API_URL}/api/machines/${machineId}/os`)
    if (!response.ok) throw new Error('Erro ao buscar histórico')

    const data = await response.json()

    const modal = document.getElementById('osModal') || createOSModal()
    const details = modal.querySelector('#osDetails') || modal.querySelector('.modal-content')

    let html = `
      <h3>
        <svg class="icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <rect x="2" y="7" width="20" height="14" rx="2" ry="2"/>
          <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/>
        </svg>
        Histórico de OS - ${machineName}
      </h3>
      <p style="margin-bottom: 1rem; color: var(--text-secondary);">Empresa: ${companyName}</p>
      <p style="margin-bottom: 1.5rem; color: var(--text-secondary);">
        ${data.length} ordem(ns) de serviço encontrada(s)
      </p>
      <div style="max-height: 60vh; overflow-y: auto;">
        ${data.map(os => {
          const formattedDate = os.scheduled_date ? new Date(os.scheduled_date).toLocaleDateString('pt-BR') :
                               os.created_at ? new Date(os.created_at).toLocaleDateString('pt-BR') : 'N/A'
          return `
            <div class="card" style="margin-bottom: 1rem; cursor: pointer;" onclick="viewOSDetailsTech(${os.id}, ${hidePrices})">
              <div style="padding: 1rem;">
                <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 0.75rem;">
                  <strong style="color: var(--primary-blue);">${os.order_number ? `O.S ${os.order_number}` : `S.S ${os.id}`}</strong>
                  <span class="status-badge status-${os.status}">
                    ${os.status === 'completed' ? 'Finalizada' : os.status === 'in_progress' ? 'Em andamento' : 'Atribuída'}
                  </span>
                </div>
                <div style="color: var(--text-secondary); font-size: 0.9rem;">
                  <div>
                    <svg class="icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
                      <line x1="16" y1="2" x2="16" y2="6"/>
                      <line x1="8" y1="2" x2="8" y2="6"/>
                      <line x1="3" y1="10" x2="21" y2="10"/>
                    </svg>
                    ${formattedDate}
                  </div>
                  <div>
                    <svg class="icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                      <circle cx="12" cy="7" r="4"/>
                    </svg>
                    Cliente: ${os.client_name || 'N/A'}
                  </div>
                  <div>
                    <svg class="icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>
                    </svg>
                    ${os.maintenance_type || 'Não especificado'}
                  </div>
                  ${os.call_reason ? `<div><em>Motivo: ${os.call_reason}</em></div>` : ''}
                </div>
              </div>
            </div>
          `
        }).join('')}
      </div>
    `

    details.innerHTML = html
    modal.style.display = 'block'
  } catch (err) {
    console.error(err)
    showToast('Erro ao carregar histórico', 'error')
  }
}

/**
 * Cria modal para exibição de OS se não existir
 */
function createOSModal() {
  let modal = document.getElementById('osModal')
  if (!modal) {
    modal = document.createElement('div')
    modal.id = 'osModal'
    modal.className = 'modal'
    modal.innerHTML = `
      <div class="modal-content">
        <span class="close" onclick="document.getElementById('osModal').style.display='none'">&times;</span>
        <div id="osDetails"></div>
      </div>
    `
    document.body.appendChild(modal)

    // Fecha ao clicar fora
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        modal.style.display = 'none'
      }
    })
  }
  return modal
}

/**
 * Carrega todas as OS para visualização do técnico (sem valores financeiros)
 */
async function loadAllOSForTech() {
  const listDiv = document.getElementById('allOsList')
  listDiv.innerHTML = '<p style="text-align:center;padding:2rem;">Carregando...</p>'

  try {
    const response = await fetch(`${API_URL}/api/os`)
    if (!response.ok) throw new Error('Erro ao carregar OS')

    let allOS = await response.json()

    // Filtra conforme os filtros aplicados
    const filterText = document.getElementById('osFilterInput').value.trim().toLowerCase()
    const statusFilter = document.getElementById('osStatusFilter').value

    if (filterText) {
      allOS = allOS.filter(os =>
        (os.client_name && os.client_name.toLowerCase().includes(filterText)) ||
        (os.order_number && String(os.order_number).includes(filterText))
      )
    }

    if (statusFilter) {
      allOS = allOS.filter(os => os.status === statusFilter)
    }

    if (!allOS || allOS.length === 0) {
      listDiv.innerHTML = '<p style="text-align:center;color:var(--text-secondary);padding:2rem;">Nenhuma OS encontrada</p>'
      return
    }

    listDiv.innerHTML = allOS.map(os => {
      const formattedDate = os.scheduled_date ? new Date(os.scheduled_date).toLocaleDateString('pt-BR') :
                           os.created_at ? new Date(os.created_at).toLocaleDateString('pt-BR') : 'N/A'

      return `
        <div class="card" style="margin-bottom: 1rem; cursor: pointer;" onclick="viewOSDetailsTech(${os.id}, true)">
          <div style="padding: 1rem;">
            <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 0.75rem;">
              <strong style="color: var(--primary-blue);">${os.order_number ? `O.S ${os.order_number}` : `S.S ${os.id}`}</strong>
              <span class="status-badge status-${os.status}">
                ${getStatusLabel(os.status)}
              </span>
            </div>
            <div style="color: var(--text-secondary); font-size: 0.9rem;">
              <p><strong>Cliente:</strong> ${os.client_name || 'N/A'}</p>
              <p><strong>Data:</strong> ${formattedDate}</p>
              <p><strong>Tipo:</strong> ${os.maintenance_type || 'N/A'}</p>
              ${os.machine_model ? `<p><strong>Máquina:</strong> ${os.machine_model}</p>` : ''}
            </div>
          </div>
        </div>
      `
    }).join('')
  } catch (err) {
    console.error(err)
    showToast('Erro ao carregar OS', 'error')
    listDiv.innerHTML = '<p style="text-align:center;color:var(--error);padding:2rem;">Erro ao carregar OS</p>'
  }
}

/**
 * Filtra a lista de todas as OS
 */
function filterAllOS() {
  loadAllOSForTech()
}

/**
 * Visualiza detalhes de uma OS (versão técnico - pode ocultar valores)
 */
async function viewOSDetailsTech(osId, hidePrices = false) {
  try {
    const response = await fetch(`${API_URL}/api/os/${osId}`)
    if (!response.ok) throw new Error('Erro ao carregar OS')

    const os = await response.json()

    const modal = document.getElementById('osModal') || createOSModal()
    const details = modal.querySelector('#osDetails') || modal.querySelector('.modal-content')

    const formattedDate = os.scheduled_date ? new Date(os.scheduled_date).toLocaleDateString('pt-BR') :
                         os.created_at ? new Date(os.created_at).toLocaleDateString('pt-BR') : 'N/A'

    let html = `
      <h3 style="color: var(--primary-blue); margin-bottom: 1rem;">${os.order_number ? `O.S ${os.order_number}` : `S.S ${os.id}`}</h3>

      <div style="display: grid; gap: 1rem; margin-bottom: 1.5rem;">
        <div class="info-group">
          <strong>Cliente:</strong>
          <p>${os.client_name || 'N/A'}</p>
        </div>
        <div class="info-group">
          <strong>Data Agendada:</strong>
          <p>${formattedDate}</p>
        </div>
        <div class="info-group">
          <strong>Status:</strong>
          <span class="status-badge status-${os.status}">${getStatusLabel(os.status)}</span>
        </div>
        <div class="info-group">
          <strong>Tipo de Manutenção:</strong>
          <p>${os.maintenance_type || 'N/A'}</p>
        </div>
        ${os.machine_model ? `
          <div class="info-group">
            <strong>Máquina:</strong>
            <p>${os.machine_model}${os.machine_serial ? ' - ' + os.machine_serial : ''}</p>
          </div>
        ` : ''}
        ${os.call_reason ? `
          <div class="info-group">
            <strong>Motivo do Chamado:</strong>
            <p>${os.call_reason}</p>
          </div>
        ` : ''}
        ${os.service_description ? `
          <div class="info-group">
            <strong>Descrição do Serviço:</strong>
            <p>${os.service_description}</p>
          </div>
        ` : ''}
        ${os.occurrence ? `
          <div class="info-group">
            <strong>Ocorrência:</strong>
            <p>${os.occurrence}</p>
          </div>
        ` : ''}
        ${os.observations ? `
          <div class="info-group">
            <strong>Observações:</strong>
            <p>${os.observations}</p>
          </div>
        ` : ''}
        ${!hidePrices && os.total_amount ? `
          <div class="info-group">
            <strong>Valor Total:</strong>
            <p style="font-size: 1.25rem; color: var(--success);">R$ ${Number(os.total_amount).toFixed(2)}</p>
          </div>
        ` : ''}
      </div>

      <button onclick="document.getElementById('osModal').style.display='none'" class="btn-secondary" style="width: 100%;">
        Fechar
      </button>
    `

    details.innerHTML = html
    modal.style.display = 'block'
  } catch (err) {
    console.error(err)
    showToast('Erro ao carregar detalhes da OS', 'error')
  }
}

/**
 * Retorna o label traduzido para o status
 */
function getStatusLabel(status) {
  const labels = {
    'pending': 'Pendente',
    'assigned': 'Atribuída',
    'accepted': 'Aceita',
    'finished': 'Finalizada',
    'approved': 'Aprovada',
    'rejected': 'Rejeitada',
    'billed': 'Faturada'
  }
  return labels[status] || status
}

// ============================================================
// Companies Tab - Visualização de Empresas e Máquinas
// ============================================================

let currentCompanyId = null
let currentCompanyName = null
let currentMachineId = null
let currentMachineName = null

/**
 * Normaliza texto: remove acentos e converte para minúsculas
 * Ex: "São Paulo" -> "sao paulo"
 */
function normalizeText(text) {
  return (text || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remove diacríticos (acentos)
}

/**
 * Busca empresas por nome
 * Busca case-insensitive e accent-insensitive
 */
async function searchCompanies() {
  const query = document.getElementById('companySearchInput').value.trim()
  const resultsDiv = document.getElementById('companiesSearchResults')

  if (!query) {
    resultsDiv.innerHTML = '<p style="text-align:center;color:var(--text-secondary);padding:2rem;">Digite o nome da empresa para buscar</p>'
    return
  }

  resultsDiv.innerHTML = '<p style="text-align:center;padding:2rem;">Buscando...</p>'

  try {
    const response = await fetch(`${API_URL}/api/companies`)
    if (!response.ok) throw new Error('Erro ao buscar empresas')

    const allCompanies = await response.json()

    // Filtra empresas - busca case-insensitive e accent-insensitive
    const queryNormalized = normalizeText(query)
    const companies = allCompanies.filter(company =>
      normalizeText(company.name || '').includes(queryNormalized)
    )

    if (!companies || companies.length === 0) {
      resultsDiv.innerHTML = '<p style="text-align:center;color:var(--text-secondary);padding:2rem;">Nenhuma empresa encontrada</p>'
      return
    }

    resultsDiv.innerHTML = companies.map(company => `
      <div class="card" style="margin-bottom: 1rem; cursor: pointer; transition: transform 0.2s;"
           onclick="loadCompanyMachines(${company.id}, '${(company.name || '').replace(/'/g, "\\'")}')">
        <div style="padding: 1.5rem;">
          <div style="display: flex; align-items: center; gap: 1rem; margin-bottom: 0.75rem;">
            <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); width: 48px; height: 48px; border-radius: 12px; display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2">
                <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
                <polyline points="9 22 9 12 15 12 15 22"/>
              </svg>
            </div>
            <div style="flex: 1;">
              <h3 style="margin: 0; color: var(--text-primary); font-size: 1.125rem;">${company.name || 'Sem nome'}</h3>
              ${company.address ? `<p style="margin: 0.25rem 0 0 0; color: var(--text-secondary); font-size: 0.875rem;">${company.address}</p>` : ''}
            </div>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="flex-shrink: 0; color: var(--text-secondary);">
              <polyline points="9 18 15 12 9 6"/>
            </svg>
          </div>
          ${company.phone ? `
            <div style="display: flex; align-items: center; gap: 0.5rem; color: var(--text-secondary); font-size: 0.875rem;">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/>
              </svg>
              ${company.phone}
            </div>
          ` : ''}
        </div>
      </div>
    `).join('')
  } catch (err) {
    console.error(err)
    showToast('Erro ao buscar empresas', 'error')
    resultsDiv.innerHTML = '<p style="text-align:center;color:var(--error);padding:2rem;">Erro ao buscar empresas</p>'
  }
}

/**
 * Carrega máquinas de uma empresa específica
 */
async function loadCompanyMachines(companyId, companyName) {
  currentCompanyId = companyId
  currentCompanyName = companyName

  const titleDiv = document.getElementById('companyMachinesTitle')
  const listDiv = document.getElementById('companyMachinesList')

  titleDiv.textContent = `Máquinas - ${companyName}`
  listDiv.innerHTML = '<p style="text-align:center;padding:2rem;">Carregando máquinas...</p>'

  // Mostra view de máquinas, esconde outras
  document.getElementById('companiesSearchView').style.display = 'none'
  document.getElementById('companyMachinesView').style.display = 'block'
  document.getElementById('machineHistoryView').style.display = 'none'

  try {
    const response = await fetch(`${API_URL}/api/machines?user_type=client&user_company_id=${companyId}`)
    if (!response.ok) throw new Error('Erro ao carregar máquinas')

    const machines = await response.json()

    if (!machines || machines.length === 0) {
      listDiv.innerHTML = '<p style="text-align:center;color:var(--text-secondary);padding:2rem;">Nenhuma máquina cadastrada para esta empresa</p>'
      return
    }

    listDiv.innerHTML = machines.map(machine => `
      <div class="card" style="margin-bottom: 1rem; cursor: pointer; transition: transform 0.2s;"
           onclick="loadMachineHistory(${machine.id}, '${(machine.model || '').replace(/'/g, "\\'")}', '${(machine.serial_number || '').replace(/'/g, "\\'")}')">
        <div style="padding: 1.5rem;">
          <div style="display: flex; align-items: center; gap: 1rem; margin-bottom: 0.75rem;">
            <div style="background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%); width: 48px; height: 48px; border-radius: 12px; display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2">
                <rect x="2" y="7" width="20" height="14" rx="2" ry="2"/>
                <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/>
              </svg>
            </div>
            <div style="flex: 1;">
              <h3 style="margin: 0; color: var(--text-primary); font-size: 1.125rem;">${machine.model || 'Modelo não informado'}</h3>
              <p style="margin: 0.25rem 0 0 0; color: var(--text-secondary); font-size: 0.875rem;">
                <strong>Nº Série:</strong> ${machine.serial_number || 'N/A'}
              </p>
            </div>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="flex-shrink: 0; color: var(--text-secondary);">
              <polyline points="9 18 15 12 9 6"/>
            </svg>
          </div>
        </div>
      </div>
    `).join('')
  } catch (err) {
    console.error(err)
    showToast('Erro ao carregar máquinas', 'error')
    listDiv.innerHTML = '<p style="text-align:center;color:var(--error);padding:2rem;">Erro ao carregar máquinas</p>'
  }
}

/**
 * Carrega histórico de OS de uma máquina
 */
async function loadMachineHistory(machineId, machineModel, machineSerial) {
  currentMachineId = machineId
  currentMachineName = `${machineModel} (${machineSerial})`

  const titleDiv = document.getElementById('machineHistoryTitle')
  const listDiv = document.getElementById('machineOsHistory')

  titleDiv.textContent = `Histórico - ${machineModel}`
  listDiv.innerHTML = '<p style="text-align:center;padding:2rem;">Carregando histórico...</p>'

  // Mostra view de histórico, esconde outras
  document.getElementById('companiesSearchView').style.display = 'none'
  document.getElementById('companyMachinesView').style.display = 'none'
  document.getElementById('machineHistoryView').style.display = 'block'

  try {
    const response = await fetch(`${API_URL}/api/machines/${machineId}/os`)
    if (!response.ok) throw new Error('Erro ao buscar histórico')

    const osHistory = await response.json()

    if (!osHistory || osHistory.length === 0) {
      listDiv.innerHTML = '<p style="text-align:center;color:var(--text-secondary);padding:2rem;">Nenhuma OS encontrada para esta máquina</p>'
      return
    }

    listDiv.innerHTML = osHistory.map(os => {
      const formattedDate = os.scheduled_date ? new Date(os.scheduled_date).toLocaleDateString('pt-BR') :
                           os.created_at ? new Date(os.created_at).toLocaleDateString('pt-BR') : 'N/A'

      return `
        <div class="card" style="margin-bottom: 1rem; cursor: pointer;" onclick="viewOSDetailsTech(${os.id}, true)">
          <div style="padding: 1.5rem;">
            <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 1rem;">
              <div>
                <h4 style="margin: 0; color: var(--primary-blue); font-size: 1.125rem;">${os.order_number ? `O.S ${os.order_number}` : `S.S ${os.id}`}</h4>
                <p style="margin: 0.25rem 0 0 0; color: var(--text-secondary); font-size: 0.875rem;">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align: middle;">
                    <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
                    <line x1="16" y1="2" x2="16" y2="6"/>
                    <line x1="8" y1="2" x2="8" y2="6"/>
                    <line x1="3" y1="10" x2="21" y2="10"/>
                  </svg>
                  ${formattedDate}
                </p>
              </div>
              <span class="status-badge status-${os.status}">${getStatusLabel(os.status)}</span>
            </div>
            <div style="color: var(--text-secondary); font-size: 0.875rem; display: grid; gap: 0.5rem;">
              ${os.maintenance_type ? `
                <div style="display: flex; align-items: center; gap: 0.5rem;">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>
                  </svg>
                  <strong>Tipo:</strong> ${os.maintenance_type}
                </div>
              ` : ''}
              ${os.call_reason ? `
                <div style="display: flex; align-items: start; gap: 0.5rem;">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="flex-shrink: 0; margin-top: 2px;">
                    <circle cx="12" cy="12" r="10"/>
                    <line x1="12" y1="16" x2="12" y2="12"/>
                    <line x1="12" y1="8" x2="12.01" y2="8"/>
                  </svg>
                  <div><strong>Motivo:</strong> ${os.call_reason}</div>
                </div>
              ` : ''}
              ${os.service_description ? `
                <div style="display: flex; align-items: start; gap: 0.5rem;">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="flex-shrink: 0; margin-top: 2px;">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                    <polyline points="14 2 14 8 20 8"/>
                  </svg>
                  <div><strong>Serviço:</strong> ${os.service_description}</div>
                </div>
              ` : ''}
            </div>
          </div>
        </div>
      `
    }).join('')
  } catch (err) {
    console.error(err)
    showToast('Erro ao carregar histórico', 'error')
    listDiv.innerHTML = '<p style="text-align:center;color:var(--error);padding:2rem;">Erro ao carregar histórico</p>'
  }
}

/**
 * Volta para busca de empresas
 */
function backToCompanySearch() {
  currentCompanyId = null
  currentCompanyName = null

  // Mostra view de busca, esconde outras
  document.getElementById('companiesSearchView').style.display = 'block'
  document.getElementById('companyMachinesView').style.display = 'none'
  document.getElementById('machineHistoryView').style.display = 'none'

  // Limpa resultados anteriores
  document.getElementById('companiesSearchResults').innerHTML = ''
}

/**
 * Volta para lista de máquinas da empresa
 */
function backToCompanyMachines() {
  currentMachineId = null
  currentMachineName = null

  if (currentCompanyId && currentCompanyName) {
    loadCompanyMachines(currentCompanyId, currentCompanyName)
  } else {
    backToCompanySearch()
  }
}

/**
 * =============================================================================
 * CRIAR MINHA PRÓPRIA OS
 * =============================================================================
 */

// Variáveis globais para criar OS
let createOS_companies = []
let createOS_machines = []
let createOS_selectedCompanyId = null

/**
 * Abre o modal para criar uma nova OS
 */
async function openCreateOwnOSModal() {
  const modal = document.getElementById('createOwnOSModal')
  if (!modal) return

  // Limpa o formulário
  document.getElementById('createOwnOSForm').reset()
  createOS_selectedCompanyId = null

  // Limpa campos do autocomplete
  const companyInput = document.getElementById('newOS_companyInput')
  const companyIdInput = document.getElementById('newOS_companyId')
  const suggestions = document.getElementById('newOS_companySuggestions')
  if (companyInput) companyInput.value = ''
  if (companyIdInput) companyIdInput.value = ''
  if (suggestions) {
    suggestions.innerHTML = ''
    suggestions.classList.remove('active')
  }

  // Reseta select de máquinas
  const machineSelect = document.getElementById('newOS_machineSelect')
  if (machineSelect) {
    machineSelect.innerHTML = '<option value="">-- selecione a empresa primeiro --</option>'
  }

  // Carrega lista de empresas
  try {
    const response = await fetch(`${API_URL}/api/companies?active=true`)
    if (!response.ok) throw new Error('Erro ao carregar empresas')
    createOS_companies = await response.json()
  } catch (error) {
    console.error('[openCreateOwnOSModal] Erro ao carregar empresas:', error)
    showToast('Erro ao carregar empresas', 'error')
  }

  // Configura event listeners
  setupCreateOSListeners()

  modal.style.display = 'flex'
}

/**
 * Mostra sugestões do autocomplete de empresas
 */
function showCompanySuggestions(searchTerm) {
  const suggestions = document.getElementById('newOS_companySuggestions')
  if (!suggestions) return

  if (!searchTerm || searchTerm.trim() === '') {
    suggestions.innerHTML = ''
    suggestions.classList.remove('active')
    return
  }

  const term = searchTerm.toLowerCase().trim()
  const filtered = createOS_companies.filter(c =>
    c.name.toLowerCase().includes(term)
  )

  if (filtered.length === 0) {
    suggestions.innerHTML = '<div class="autocomplete-item no-results">Nenhuma empresa encontrada</div>'
  } else {
    suggestions.innerHTML = filtered
      .map(c => `<div class="autocomplete-item" data-id="${c.id}" data-name="${c.name}">${c.name}</div>`)
      .join('')
  }

  suggestions.classList.add('active')
}

/**
 * Seleciona uma empresa do autocomplete
 */
async function selectCompany(companyId, companyName) {
  const companyInput = document.getElementById('newOS_companyInput')
  const companyIdInput = document.getElementById('newOS_companyId')
  const suggestions = document.getElementById('newOS_companySuggestions')
  const machineSelect = document.getElementById('newOS_machineSelect')

  // Preenche os campos
  if (companyInput) companyInput.value = companyName
  if (companyIdInput) companyIdInput.value = companyId
  if (suggestions) {
    suggestions.innerHTML = ''
    suggestions.classList.remove('active')
  }

  createOS_selectedCompanyId = companyId

  // Carrega máquinas da empresa
  if (machineSelect) {
    try {
      const response = await fetch(`${API_URL}/api/machines?company_id=${companyId}`)
      if (!response.ok) throw new Error('Erro ao carregar máquinas')

      createOS_machines = await response.json()

      machineSelect.innerHTML = '<option value="">-- sem máquina --</option>' +
        createOS_machines
          .map(m => `<option value="${m.id}">${m.model || 'Sem modelo'} (${m.serial_number})</option>`)
          .join('')
    } catch (error) {
      console.error('[selectCompany] Erro ao carregar máquinas:', error)
      machineSelect.innerHTML = '<option value="">-- erro ao carregar --</option>'
    }
  }
}

/**
 * Configura os event listeners do formulário de criar OS
 */
function setupCreateOSListeners() {
  const companyInput = document.getElementById('newOS_companyInput')
  const suggestions = document.getElementById('newOS_companySuggestions')

  if (!companyInput) return

  // Remove listeners antigos
  companyInput.replaceWith(companyInput.cloneNode(true))
  const newCompanyInput = document.getElementById('newOS_companyInput')

  // Ao digitar, mostra sugestões
  newCompanyInput.addEventListener('input', (e) => {
    // Limpa seleção anterior quando digitar
    document.getElementById('newOS_companyId').value = ''
    createOS_selectedCompanyId = null
    showCompanySuggestions(e.target.value)
  })

  // Ao focar, mostra sugestões se tiver texto
  newCompanyInput.addEventListener('focus', (e) => {
    if (e.target.value.trim()) {
      showCompanySuggestions(e.target.value)
    }
  })

  // Clique nas sugestões
  const newSuggestions = document.getElementById('newOS_companySuggestions')
  if (newSuggestions) {
    newSuggestions.addEventListener('click', (e) => {
      const item = e.target.closest('.autocomplete-item')
      if (item && !item.classList.contains('no-results')) {
        const companyId = item.dataset.id
        const companyName = item.dataset.name
        selectCompany(companyId, companyName)
      }
    })
  }

  // Fecha sugestões ao clicar fora
  document.addEventListener('click', (e) => {
    if (!e.target.closest('.autocomplete-wrapper')) {
      const suggestions = document.getElementById('newOS_companySuggestions')
      if (suggestions) {
        suggestions.classList.remove('active')
      }
    }
  })
}

/**
 * Fecha o modal de criar OS
 */
function closeCreateOwnOSModal() {
  const modal = document.getElementById('createOwnOSModal')
  if (!modal) return
  modal.style.display = 'none'
}

/**
 * Submete o formulário de criar nova OS
 */
async function submitCreateOwnOS(event) {
  event.preventDefault()

  const submitBtn = event.target.querySelector('button[type="submit"]')
  const originalText = submitBtn.textContent
  submitBtn.disabled = true
  submitBtn.textContent = 'Criando...'

  try {
    const companyId = document.getElementById('newOS_companyId').value
    const machineId = document.getElementById('newOS_machineSelect').value
    const callReason = document.getElementById('newOS_callReason').value.trim()

    if (!companyId) {
      throw new Error('Você deve selecionar uma empresa da lista')
    }

    if (!callReason) {
      throw new Error('Motivo do chamado é obrigatório')
    }

    // Busca o nome da empresa pelo ID selecionado
    const company = createOS_companies.find(c => c.id === parseInt(companyId))
    if (!company) {
      throw new Error('Empresa selecionada não encontrada')
    }

    // Pega ID do técnico logado - tenta múltiplas formas
    let techId = getStoredTechnicianId()

    // Se a função não retornar, tenta direto do localStorage
    if (!techId) {
      techId = localStorage.getItem('technicianId')
    }

    console.log('🔍 [createOwnOS] techId obtido:', techId)
    console.log('🔍 [createOwnOS] localStorage completo:', {
      technicianId: localStorage.getItem('technicianId'),
      technicianLoggedIn: localStorage.getItem('technicianLoggedIn'),
      technicianName: localStorage.getItem('technicianName')
    })

    if (!techId) {
      console.error('❌ [createOwnOS] ID do técnico não encontrado!')
      console.error('localStorage keys:', Object.keys(localStorage))

      // FORÇA LOGOUT AUTOMÁTICO
      localStorage.clear()
      alert('⚠️ SESSÃO EXPIRADA!\n\nVocê será deslogado agora.\n\nFaça login novamente para continuar.')

      // Recarrega a página para forçar logout
      window.location.reload()

      throw new Error('ID do técnico não encontrado. Sessão expirada.')
    }

    // Monta payload
    const payload = {
      company_name: company.name,
      company_id: parseInt(companyId),
      machine_id: machineId || null,
      call_reason: callReason || null,
      client_name: company.name, // Usa o nome da empresa como cliente
      technician_id: parseInt(techId) // Garante que é número
    }

    console.log('📤 [createOwnOS] Enviando payload:', JSON.stringify(payload, null, 2))

    const response = await fetch(`${API_URL}/api/os/create-own`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('techToken')}`
      },
      body: JSON.stringify(payload)
    })

    const data = await response.json()

    if (!response.ok) {
      throw new Error(data.message || 'Erro ao criar OS')
    }

    showToast(`O.S ${data.order_number} criada com sucesso!`, 'success')
    closeCreateOwnOSModal()
    loadOSList() // Recarrega a lista de OS

  } catch (error) {
    console.error('[createOwnOS] Erro:', error)
    showToast(error.message || 'Erro ao criar OS', 'error')
  } finally {
    submitBtn.disabled = false
    submitBtn.textContent = originalText
  }
}

// =============================================
// SOLICITAÇÃO DE COMPRA
// =============================================

/**
 * Carrega as solicitações de compra do técnico
 */
async function loadMyPurchaseRequests() {
  const container = document.getElementById('myPurchaseRequestsList')
  if (!container) return

  const techId = localStorage.getItem('technicianId')
  if (!techId) {
    container.innerHTML = '<p class="empty-state">Faça login para ver suas solicitações</p>'
    return
  }

  try {
    container.innerHTML = '<p style="text-align: center; padding: 1rem;">Carregando...</p>'

    const response = await fetch(`${API_URL}/api/purchase-orders/technician/${techId}`)
    if (!response.ok) throw new Error('Erro ao buscar solicitações')
    const orders = await response.json()

    if (!orders || orders.length === 0) {
      container.innerHTML = '<p class="empty-state">Nenhuma solicitação realizada</p>'
      return
    }

    container.innerHTML = orders.map(order => {
      const statusColor = order.status === 'approved' ? '#22c55e' : order.status === 'rejected' ? '#ef4444' : '#f97316'
      const statusText = order.status === 'approved' ? 'Aprovado' : order.status === 'rejected' ? 'Rejeitado' : 'Pendente'

      return `
        <div style="padding: 1rem; border: 1px solid var(--border-color); border-radius: 8px; margin-bottom: 0.75rem; border-left: 4px solid ${statusColor};">
          <div style="display: flex; justify-content: space-between; align-items: flex-start;">
            <div>
              <h4 style="margin: 0; font-size: 1rem;">${escapeHtml(order.material_name)}</h4>
              ${order.observations ? `<p style="margin: 0.25rem 0 0; font-size: 0.875rem; opacity: 0.7;">${escapeHtml(order.observations)}</p>` : ''}
              <p style="margin: 0.5rem 0 0; font-size: 0.75rem; opacity: 0.5;">
                Solicitado em: ${formatDate(order.created_at)}
              </p>
            </div>
            <span style="background: ${statusColor}; color: white; padding: 0.25rem 0.75rem; border-radius: 20px; font-size: 0.75rem; font-weight: 600;">
              ${statusText}
            </span>
          </div>
          ${order.status === 'approved' && order.approved_at ? `
            <p style="margin: 0.5rem 0 0; font-size: 0.75rem; color: #22c55e;">
              Aprovado em ${formatDate(order.approved_at)} ${order.approved_by ? `por ${order.approved_by}` : ''}
            </p>
          ` : ''}
        </div>
      `
    }).join('')

  } catch (err) {
    console.error('[loadMyPurchaseRequests] Erro:', err)
    container.innerHTML = '<p class="empty-state" style="color: #ef4444;">Erro ao carregar solicitações</p>'
  }
}

/**
 * Envia solicitação de compra
 */
async function submitPurchaseRequest(e) {
  e.preventDefault()

  const materialName = document.getElementById('requestMaterialName').value.trim()
  const observations = document.getElementById('requestObservations').value.trim()

  if (!materialName) {
    showToast('Nome do material é obrigatório', 'error')
    return
  }

  const techId = localStorage.getItem('technicianId')
  if (!techId) {
    showToast('Faça login para enviar solicitações', 'error')
    return
  }

  try {
    const response = await fetch(`${API_URL}/api/purchase-orders/technician`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        material_name: materialName,
        observations,
        technician_id: parseInt(techId)
      })
    })

    const result = await response.json()
    if (!response.ok) throw new Error(result.message || 'Erro ao enviar solicitação')

    showToast('Solicitação enviada com sucesso!', 'success')

    // Limpa o formulário
    document.getElementById('requestMaterialName').value = ''
    document.getElementById('requestObservations').value = ''

    // Recarrega a lista
    loadMyPurchaseRequests()
  } catch (err) {
    console.error('[submitPurchaseRequest] Erro:', err)
    showToast(err.message || 'Erro ao enviar solicitação', 'error')
  }
}

// Inicializa o formulário de solicitação
document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('purchaseRequestForm')
  if (form) {
    form.addEventListener('submit', submitPurchaseRequest)
  }
})

// Expõe funções globalmente
window.loadMyPurchaseRequests = loadMyPurchaseRequests
window.submitPurchaseRequest = submitPurchaseRequest
