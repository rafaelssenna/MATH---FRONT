/**
 * ╔═══════════════════════════════════════════════════════════════════════════════╗
 * ║                   SISTEMA DE CONFERÊNCIA DE OS - MATH HELSEN                  ║
 * ╠═══════════════════════════════════════════════════════════════════════════════╣
 * ║  Módulo para conferência, edição e aprovação de OS finalizadas                ║
 * ╚═══════════════════════════════════════════════════════════════════════════════╝
 *
 * ┌─────────────────────────────────────────────────────────────────────────────┐
 * │                           ÍNDICE DO ARQUIVO                                  │
 * ├─────────────────────────────────────────────────────────────────────────────┤
 * │                                                                              │
 * │  SEÇÃO 1: VARIÁVEIS GLOBAIS ................................ linha ~25      │
 * │  SEÇÃO 2: CARREGAMENTO DE DADOS ............................ linha ~35      │
 * │  SEÇÃO 3: RENDERIZAÇÃO DE ESTATÍSTICAS ..................... linha ~60      │
 * │  SEÇÃO 4: LISTA DE OS PENDENTES ............................ linha ~100     │
 * │  SEÇÃO 5: MODAL DE CONFERÊNCIA ............................. linha ~150     │
 * │  SEÇÃO 6: EDIÇÃO DE MATERIAIS/WORKLOGS ..................... linha ~400     │
 * │  SEÇÃO 7: CÁLCULOS DE VALORES .............................. linha ~700     │
 * │  SEÇÃO 8: APROVAÇÃO E ARQUIVAMENTO ......................... linha ~900     │
 * │                                                                              │
 * └─────────────────────────────────────────────────────────────────────────────┘
 */

// ╔═══════════════════════════════════════════════════════════════════════════════╗
// ║                       SEÇÃO 1: VARIÁVEIS GLOBAIS                              ║
// ╚═══════════════════════════════════════════════════════════════════════════════╝

let currentConferenceOS = null
let conferenceMaterials = []
let conferenceWorklogs = []
let conferenceDisplacements = []
let conferenceAdditionalServices = []
let conferenceVehicles = []
let allCompaniesForReview = []
let allMachinesForReview = []
let conferenceOSListCache = [] // Cache para filtro de busca
let customHourlyRate = null // Valor da hora customizado (null = usar padrão)

/**
 * Formata quantidade de material - mostra inteiro se não tiver decimais
 * Ex: 1.00 → "1", 1.50 → "1.5", 2.75 → "2.75"
 */
function formatQuantity(qty) {
  const num = parseFloat(qty) || 0
  return num % 1 === 0 ? String(Math.floor(num)) : String(num)
}

/**
 * Converte horas decimais para formato legível (ex: 4.5 -> "4h 30min")
 * @param {number} decimalHours - Horas em formato decimal
 * @returns {string} - Horas formatadas (ex: "4h 30min" ou "4h")
 */
function formatHoursReview(decimalHours) {
  const hours = Math.floor(decimalHours)
  const minutes = Math.round((decimalHours - hours) * 60)
  if (minutes === 0) return `${hours}h`
  return `${hours}h ${minutes}min`
}

/**
 * Carrega dados de conferência (chamado ao abrir a seção)
 */
async function loadReviewData() {
  // Mostra spinner enquanto carrega
  showInlineSpinner('reviewOSList', 'Carregando OS para conferência...')

  try {
    // Busca estatísticas, OS pendentes, empresas e máquinas em paralelo
    const [statsResponse, pendingResponse, companiesResponse, machinesResponse] = await Promise.all([
      fetch(`${API_URL}/api/review/stats/summary`),
      fetch(`${API_URL}/api/review/pending`),
      fetch(`${API_URL}/api/companies`),
      fetch(`${API_URL}/api/machines`)
    ])

    if (!statsResponse.ok) {
      throw new Error(`Erro ao buscar estatísticas: ${statsResponse.status}`)
    }
    if (!pendingResponse.ok) {
      throw new Error(`Erro ao buscar OS pendentes: ${pendingResponse.status}`)
    }

    const stats = await statsResponse.json()
    const osList = await pendingResponse.json()

    // Carrega empresas e máquinas para os selects
    if (companiesResponse.ok) {
      allCompaniesForReview = await companiesResponse.json()
    }
    if (machinesResponse.ok) {
      allMachinesForReview = await machinesResponse.json()
    }

    // Renderiza estatísticas e lista
    renderConferenceStats(stats)
    renderConferenceOSList(osList)

  } catch (error) {
    console.error('Erro ao carregar conferência:', error)
    showToast(error.message || 'Erro ao carregar dados de conferência', 'error')
  }
}

/**
 * Renderiza estatísticas de conferência
 */
function renderConferenceStats(stats) {
  const container = document.getElementById('reviewStats')
  if (!container) return

  container.innerHTML = `
    <div class="stat-card" style="background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%); color: white; padding: 1.5rem; border-radius: 12px;">
      <div style="font-size: 0.875rem; opacity: 0.9; margin-bottom: 0.5rem;">Aguardando Conferência</div>
      <div style="font-size: 2rem; font-weight: 700;">${stats.pending || 0}</div>
    </div>
    <div class="stat-card" style="background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); color: white; padding: 1.5rem; border-radius: 12px; cursor: pointer;" onclick="activateSection('standbySection')">
      <div style="font-size: 0.875rem; opacity: 0.9; margin-bottom: 0.5rem;">Em Standby</div>
      <div style="font-size: 2rem; font-weight: 700;">${stats.standby || 0}</div>
    </div>
    <div class="stat-card" style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: white; padding: 1.5rem; border-radius: 12px;">
      <div style="font-size: 0.875rem; opacity: 0.9; margin-bottom: 0.5rem;">Aprovadas (Faturamento)</div>
      <div style="font-size: 2rem; font-weight: 700;">${stats.completed || 0}</div>
    </div>
    <div class="stat-card" style="background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%); color: white; padding: 1.5rem; border-radius: 12px; cursor: pointer;" onclick="openArchivedOSModal()">
      <div style="font-size: 0.875rem; opacity: 0.9; margin-bottom: 0.5rem;">Canceladas</div>
      <div style="font-size: 2rem; font-weight: 700;">${stats.archived || 0}</div>
    </div>
  `
}

/**
 * Renderiza lista de OS para conferência
 */
function renderConferenceOSList(osList, isFiltered = false) {
  const container = document.getElementById('reviewOSList')
  if (!container) return

  // Salva no cache se não for filtrado (lista completa)
  if (!isFiltered) {
    conferenceOSListCache = osList || []
  }

  // Atualiza título
  const title = document.getElementById('reviewListTitle')
  if (title) {
    title.textContent = 'OS Aguardando Conferência'
  }

  // Campo de busca (sempre mostra)
  const searchHtml = `
    <div style="margin-bottom: 1rem;">
      <input
        type="text"
        id="conferenceListSearch"
        placeholder="Buscar por número da OS, cliente ou técnico..."
        oninput="filterConferenceOSList()"
        style="
          width: 100%;
          padding: 0.75rem;
          background: var(--bg-input);
          border: 1px solid var(--border-color);
          border-radius: 6px;
          color: var(--text-primary);
          font-size: 0.9rem;
        "
      />
    </div>
  `

  if (!osList || osList.length === 0) {
    container.innerHTML = searchHtml + `<p class="empty-state">${isFiltered ? 'Nenhuma OS encontrada com esse filtro' : 'Nenhuma OS aguardando conferência'}</p>`
    return
  }

  const formatter = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })

  container.innerHTML = searchHtml + `
    <table style="width: 100%; border-collapse: collapse;">
      <thead>
        <tr style="border-bottom: 2px solid var(--border-color);">
          <th style="padding: 0.75rem; text-align: left;">OS</th>
          <th style="padding: 0.75rem; text-align: left;">Cliente</th>
          <th style="padding: 0.75rem; text-align: left;">Técnico</th>
          <th style="padding: 0.75rem; text-align: left;">Data Finalização</th>
          <th style="padding: 0.75rem; text-align: right;">Valor Total</th>
          <th style="padding: 0.75rem; text-align: center;">Ações</th>
        </tr>
      </thead>
      <tbody>
        ${osList.map(os => `
          <tr style="border-bottom: 1px solid var(--border-color);">
            <td style="padding: 0.75rem; font-weight: 600;">#${os.order_number || os.id}</td>
            <td style="padding: 0.75rem;">${escapeHtml(os.company_name || 'N/A')}</td>
            <td style="padding: 0.75rem;">${escapeHtml(os.technician_username || 'N/A')}</td>
            <td style="padding: 0.75rem;">${os.finished_at ? new Date(os.finished_at).toLocaleDateString('pt-BR') : 'N/A'}</td>
            <td style="padding: 0.75rem; text-align: right; font-weight: 600;">${formatter.format(os.grand_total || 0)}</td>
            <td style="padding: 0.75rem; text-align: center;">
              <button
                class="btn-primary btn-sm"
                style="display: inline-flex; align-items: center; gap: 0.5rem; padding: 0.5rem 1rem; background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); color: white; border: none; border-radius: 8px; font-size: 0.875rem; font-weight: 600; cursor: pointer;"
                onclick="openConferenceModal(${os.id})"
                title="Conferir OS">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M9 11l3 3L22 4"/>
                  <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>
                </svg>
                Conferir
              </button>
            </td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `
}

/**
 * Filtra lista de OS de conferência por busca
 */
function filterConferenceOSList() {
  const searchInput = document.getElementById('conferenceListSearch')
  const searchTerm = (searchInput?.value || '').trim().toLowerCase()

  if (!searchTerm) {
    renderConferenceOSList(conferenceOSListCache, true)
    return
  }

  const filtered = conferenceOSListCache.filter(os => {
    const osNumber = String(os.order_number || os.id || '').toLowerCase()
    const companyName = (os.company_name || '').toLowerCase()
    const technicianName = (os.technician_username || '').toLowerCase()
    return osNumber.includes(searchTerm) ||
           companyName.includes(searchTerm) ||
           technicianName.includes(searchTerm)
  })

  renderConferenceOSList(filtered, true)
}

/**
 * Abre modal de conferência com dados completos da OS
 */
async function openConferenceModal(osId) {
  try {
    // Busca veículos e OS em paralelo
    const [vehiclesResponse, osResponse] = await Promise.all([
      fetch(`${API_URL}/api/vehicles`),
      fetch(`${API_URL}/api/review/${osId}`)
    ])

    if (!osResponse.ok) throw new Error('Erro ao carregar OS')

    // Carrega veículos (ignora erro se não carregar)
    try {
      conferenceVehicles = await vehiclesResponse.json()
    } catch (err) {
      console.warn('Erro ao carregar veículos:', err)
      conferenceVehicles = []
    }

    currentConferenceOS = await osResponse.json()
    conferenceMaterials = currentConferenceOS.materials || []
    conferenceWorklogs = currentConferenceOS.worklogs || []
    conferenceDisplacements = currentConferenceOS.displacements || []
    conferenceAdditionalServices = currentConferenceOS.additional_services || []

    // Abre modal de edição completo
    renderConferenceModal()
    document.getElementById('conferenceModal').style.display = 'flex'

  } catch (error) {
    console.error('Erro ao abrir modal de conferência:', error)
    showToast('Erro ao carregar dados da OS', 'error')
  }
}

/**
 * Renderiza o modal de conferência
 */
function renderConferenceModal() {
  const modal = document.getElementById('conferenceModal')
  if (!modal) {
    // Cria modal se não existir
    createConferenceModal()
  }

  const os = currentConferenceOS
  const formatter = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })

  document.getElementById('conferenceModalContent').innerHTML = `
    <div style="display: grid; gap: 1.5rem;">
      <!-- Informações Básicas -->
      <div class="card" style="padding: 1.5rem; background: linear-gradient(135deg, #667eea22 0%, #764ba222 100%); border: 2px solid #667eea;">
        <!-- Linha 1: OS + Toggle Cliente -->
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.25rem; flex-wrap: wrap; gap: 1rem;">
          <h3 style="margin: 0; color: #667eea; font-size: 1.5rem;">OS #${os.order_number || os.id}</h3>
          <button
            id="toggleClientTypeBtn"
            onclick="toggleClientType()"
            style="padding: 0.5rem 1.25rem; border-radius: 20px; border: 2px solid ${os.is_new_client ? '#10b981' : '#6b7280'}; background: ${os.is_new_client ? 'linear-gradient(135deg, #10b981 0%, #059669 100%)' : 'linear-gradient(135deg, #6b7280 0%, #4b5563 100%)'}; color: white; font-weight: 700; font-size: 0.875rem; cursor: pointer; transition: all 0.3s ease; box-shadow: 0 2px 8px rgba(0,0,0,0.15);"
            title="Clique para alternar entre Cliente Novo e Cliente Antigo">
            ${os.is_new_client ? '🆕 CLIENTE NOVO' : '👤 CLIENTE ANTIGO'}
          </button>
        </div>

        <!-- Linha 2: Empresa + Técnico -->
        <div style="display: grid; grid-template-columns: 2fr 1fr; gap: 1.25rem; margin-bottom: 1.25rem;">
          <div style="position: relative;">
            <label style="font-size: 0.75rem; color: var(--text-secondary); display: block; margin-bottom: 0.5rem;">Cliente / Empresa *</label>
            <div
              id="conferenceCompanyDisplay"
              onclick="toggleCompanyDropdown()"
              style="width: 100%; padding: 0.75rem; background: var(--bg-input); border: 1px solid var(--border-color); border-radius: 6px; color: var(--text-primary); font-weight: 600; cursor: pointer; display: flex; justify-content: space-between; align-items: center; min-height: 44px;"
            >
              <span id="conferenceCompanyName" style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${escapeHtml(os.company_name || 'Selecione...')}</span>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="flex-shrink: 0; margin-left: 0.5rem;">
                <polyline points="6 9 12 15 18 9"/>
              </svg>
            </div>
            <div id="conferenceCompanyDropdown" style="display: none; position: absolute; top: 100%; left: 0; width: 100%; min-width: 300px; z-index: 1000; background: var(--bg-card); border: 1px solid var(--border-color); border-radius: 6px; margin-top: 4px; box-shadow: 0 4px 12px rgba(0,0,0,0.3);">
              <input
                type="text"
                id="conferenceCompanySearch"
                placeholder="Digite para buscar..."
                oninput="filterConferenceCompanies()"
                style="width: 100%; padding: 0.75rem; background: var(--bg-input); border: none; border-bottom: 1px solid var(--border-color); border-radius: 6px 6px 0 0; color: var(--text-primary); box-sizing: border-box;"
              />
              <select id="conferenceCompanySelect" onchange="onConferenceCompanyChange()" size="6" style="width: 100%; padding: 0.5rem; background: var(--bg-input); border: none; border-radius: 0 0 6px 6px; color: var(--text-primary); font-weight: 600;">
                ${renderCompanyOptions(os.company_id)}
              </select>
            </div>
          </div>
          <div>
            <label style="font-size: 0.75rem; color: var(--text-secondary); display: block; margin-bottom: 0.5rem;">Técnico</label>
            <div style="font-weight: 600; padding: 0.75rem; background: var(--bg-input); border: 1px solid var(--border-color); border-radius: 6px; min-height: 44px; display: flex; align-items: center;">${escapeHtml(os.technician_username || 'N/A')}</div>
          </div>
        </div>

        <!-- Linha 3: Máquina + Data + Tipo Manutenção -->
        <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 1.25rem;">
          <div>
            <label style="font-size: 0.75rem; color: var(--text-secondary); display: block; margin-bottom: 0.5rem;">Máquina *</label>
            <select id="conferenceMachineSelect" style="width: 100%; padding: 0.75rem; background: var(--bg-input); border: 1px solid var(--border-color); border-radius: 6px; color: var(--text-primary); font-weight: 600; min-height: 44px;">
              ${renderMachineOptions(os.company_id, os.machine_id)}
            </select>
          </div>
          <div>
            <label style="font-size: 0.75rem; color: var(--text-secondary); display: block; margin-bottom: 0.5rem;">Data Finalização</label>
            <div style="font-weight: 600; padding: 0.75rem; background: var(--bg-input); border: 1px solid var(--border-color); border-radius: 6px; min-height: 44px; display: flex; align-items: center;">${os.finished_at ? new Date(os.finished_at).toLocaleString('pt-BR') : 'N/A'}</div>
          </div>
          <div>
            <label style="font-size: 0.75rem; color: var(--text-secondary); display: block; margin-bottom: 0.5rem;">Tipo de Manutenção</label>
            <select id="conferenceMaintenanceType" style="width: 100%; padding: 0.75rem; background: var(--bg-input); border: 1px solid var(--border-color); border-radius: 6px; color: var(--text-primary); font-weight: 600; min-height: 44px;">
              <option value="">Selecione...</option>
              <option value="Manutenção Corretiva Eletroeletrônica" ${os.maintenance_type === 'Manutenção Corretiva Eletroeletrônica' ? 'selected' : ''}>Manutenção Corretiva Eletroeletrônica</option>
              <option value="Manutenção Corretiva Mecânica" ${os.maintenance_type === 'Manutenção Corretiva Mecânica' ? 'selected' : ''}>Manutenção Corretiva Mecânica</option>
              <option value="Manutenção Preventiva Eletroeletrônica" ${os.maintenance_type === 'Manutenção Preventiva Eletroeletrônica' ? 'selected' : ''}>Manutenção Preventiva Eletroeletrônica</option>
              <option value="Manutenção Preventiva Mecânica" ${os.maintenance_type === 'Manutenção Preventiva Mecânica' ? 'selected' : ''}>Manutenção Preventiva Mecânica</option>
              <option value="Entrega Técnica" ${os.maintenance_type === 'Entrega Técnica' ? 'selected' : ''}>Entrega Técnica</option>
              <option value="Reforma" ${os.maintenance_type === 'Reforma' ? 'selected' : ''}>Reforma</option>
            </select>
          </div>
        </div>
      </div>

      <!-- Assinaturas (Somente Leitura) -->
      ${os.technician_signature || os.client_signature ? `
      <div class="card" style="padding: 1.5rem;">
        <h3 style="margin: 0 0 1rem 0;">Assinaturas</h3>
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1.5rem;">
          ${os.technician_signature ? `
          <div>
            <label style="font-size: 0.75rem; color: var(--text-secondary); display: block; margin-bottom: 0.5rem;">Assinatura do Técnico</label>
            <img src="${os.technician_signature}" alt="Assinatura Técnico" style="border: 1px solid var(--border-color); border-radius: 8px; max-width: 100%; height: auto;"/>
          </div>
          ` : ''}
          ${os.client_signature ? `
          <div>
            <label style="font-size: 0.75rem; color: var(--text-secondary); display: block; margin-bottom: 0.5rem;">Assinatura do Cliente</label>
            <img src="${os.client_signature}" alt="Assinatura Cliente" style="border: 1px solid var(--border-color); border-radius: 8px; max-width: 100%; height: auto;"/>
          </div>
          ` : ''}
        </div>
      </div>
      ` : ''}

      <!-- Descrição do Serviço (Editável) -->
      <div class="card" style="padding: 1.5rem;">
        <h3 style="margin: 0 0 1rem 0;">Descrição do Serviço</h3>
        <textarea id="conferenceServiceDesc" style="width: 100%; min-height: 100px; background: var(--bg-input); border: 1px solid var(--border-color); padding: 0.75rem; border-radius: 6px; font-family: inherit;">${escapeHtml(os.service_description || '')}</textarea>
      </div>

      <!-- Materiais (Editável) -->
      <div class="card" style="padding: 1.5rem;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
          <h3 style="margin: 0;">Materiais Utilizados</h3>
          <button onclick="addConferenceMaterial()" class="btn-secondary" style="padding: 0.5rem 1rem; font-size: 0.875rem;">+ Adicionar Material</button>
        </div>
        <div id="conferenceMaterialsList">
          ${renderConferenceMaterials()}
        </div>
      </div>

      <!-- Worklogs (Editável) -->
      <div class="card" style="padding: 1.5rem;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
          <h3 style="margin: 0;">Períodos de Trabalho</h3>
          <button onclick="addConferenceWorklog()" class="btn-secondary" style="padding: 0.5rem 1rem; font-size: 0.875rem;">+ Adicionar Período</button>
        </div>
        <div id="conferenceWorklogsList">
          ${renderConferenceWorklogs()}
        </div>
      </div>

      <!-- Deslocamentos (Editável) -->
      <div class="card" style="padding: 1.5rem;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
          <h3 style="margin: 0;">Deslocamentos</h3>
          <button onclick="addConferenceDisplacement()" class="btn-secondary" style="padding: 0.5rem 1rem; font-size: 0.875rem;">+ Adicionar Deslocamento</button>
        </div>
        <div id="conferenceDisplacementsList">
          ${renderConferenceDisplacements()}
        </div>
      </div>

      <!-- Serviços Adicionais (Editável) -->
      <div class="card" style="padding: 1.5rem;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
          <h3 style="margin: 0;">Serviços Adicionais</h3>
          <button onclick="addConferenceAdditionalService()" class="btn-secondary" style="padding: 0.5rem 1rem; font-size: 0.875rem;">+ Adicionar Serviço</button>
        </div>
        <div id="conferenceAdditionalServicesList">
          ${renderConferenceAdditionalServices()}
        </div>
      </div>

      <!-- Valores (Detalhamento dinâmico) -->
      <div class="card" style="padding: 1.5rem;">
        <h3 style="margin: 0 0 1rem 0;">Detalhamento Financeiro</h3>
        <div id="conferenceFinancialBreakdown" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem;">
          <!-- Será preenchido dinamicamente pelo recalculateConferenceTotals() -->
        </div>
      </div>
    </div>
  `

  // Recalcula totais ao carregar
  recalculateConferenceTotals()
}

/**
 * Renderiza lista de materiais
 */
function renderConferenceMaterials() {
  if (conferenceMaterials.length === 0) {
    return `<p class="empty-state" style="margin: 0;">Nenhum material cadastrado</p>`
  }

  return conferenceMaterials.map((m, idx) => `
    <div style="display: grid; grid-template-columns: 2fr 1fr 1fr 1fr auto; gap: 0.75rem; margin-bottom: 0.75rem; align-items: end;">
      <div>
        <label style="font-size: 0.75rem; color: var(--text-secondary);">Nome do Material</label>
        <input type="text" value="${escapeHtml(m.name || '')}" onchange="conferenceMaterials[${idx}].name = this.value" style="width: 100%; padding: 0.5rem; background: var(--bg-input); border: 1px solid var(--border-color); border-radius: 6px; color: var(--text-primary);" />
      </div>
      <div>
        <label style="font-size: 0.75rem; color: var(--text-secondary);">Quantidade</label>
        <input type="number" value="${formatQuantity(m.quantity)}" onchange="updateMaterialQuantity(${idx}, this.value)" step="0.01" min="0" style="width: 100%; padding: 0.5rem; background: var(--bg-input); border: 1px solid var(--border-color); border-radius: 6px; color: var(--text-primary);" />
      </div>
      <div>
        <label style="font-size: 0.75rem; color: var(--text-secondary);">Preço Unit. (R$)</label>
        <input type="number" value="${m.unit_price || 0}" onchange="updateMaterialPrice(${idx}, this.value)" step="0.01" style="width: 100%; padding: 0.5rem; background: var(--bg-input); border: 1px solid var(--border-color); border-radius: 6px; color: var(--text-primary);" />
      </div>
      <div>
        <label style="font-size: 0.75rem; color: var(--text-secondary);">Total</label>
        <input type="text" value="${new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format((m.quantity || 0) * (m.unit_price || 0))}" readonly style="width: 100%; padding: 0.5rem; background: var(--bg-readonly); border: 1px solid var(--border-color); border-radius: 6px; font-weight: 600; color: var(--text-primary);" />
      </div>
      <button onclick="removeConferenceMaterial(${idx})" class="btn-danger" style="padding: 0.5rem; background: #ef4444; color: white; border: none; border-radius: 6px; cursor: pointer;">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <line x1="18" y1="6" x2="6" y2="18"/>
          <line x1="6" y1="6" x2="18" y2="18"/>
        </svg>
      </button>
    </div>
  `).join('')
}

/**
 * Converte horas decimais para formato HH:MM
 * Ex: 6.5 → "6:30", 4.5 → "4:30", 7.0 → "7:00"
 */
function formatDecimalToTime(decimalHours) {
  const hours = Math.floor(decimalHours)
  const minutes = Math.round((decimalHours - hours) * 60)
  return `${hours}:${String(minutes).padStart(2, '0')}`
}

/**
 * Renderiza lista de worklogs
 */
function renderConferenceWorklogs() {
  if (conferenceWorklogs.length === 0) {
    return `<p class="empty-state" style="margin: 0;">Nenhum período cadastrado</p>`
  }

  return conferenceWorklogs.map((w, idx) => `
    <div style="display: grid; grid-template-columns: 1fr 1fr 1fr auto; gap: 0.75rem; margin-bottom: 0.75rem; align-items: end;">
      <div>
        <label style="font-size: 0.75rem; color: var(--text-secondary);">Início</label>
        <input type="datetime-local" value="${w.start_datetime ? w.start_datetime.slice(0, 16) : ''}" onchange="updateWorklogStart(${idx}, this.value)" style="width: 100%; padding: 0.5rem; background: var(--bg-input); border: 1px solid var(--border-color); border-radius: 6px; color: var(--text-primary);" />
      </div>
      <div>
        <label style="font-size: 0.75rem; color: var(--text-secondary);">Fim</label>
        <input type="datetime-local" value="${w.end_datetime ? w.end_datetime.slice(0, 16) : ''}" onchange="updateWorklogEnd(${idx}, this.value)" style="width: 100%; padding: 0.5rem; background: var(--bg-input); border: 1px solid var(--border-color); border-radius: 6px; color: var(--text-primary);" />
      </div>
      <div>
        <label style="font-size: 0.75rem; color: var(--text-secondary);">Duração</label>
        <input type="text" value="${formatDecimalToTime(w.hours || 0)}h" readonly style="width: 100%; padding: 0.5rem; background: var(--bg-readonly); border: 1px solid var(--border-color); border-radius: 6px; font-weight: 600; color: var(--text-primary); text-align: center;" />
      </div>
      <button onclick="removeConferenceWorklog(${idx})" class="btn-danger" style="padding: 0.5rem; background: #ef4444; color: white; border: none; border-radius: 6px; cursor: pointer;">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <line x1="18" y1="6" x2="6" y2="18"/>
          <line x1="6" y1="6" x2="18" y2="18"/>
        </svg>
      </button>
    </div>
  `).join('')
}

/**
 * Renderiza lista de serviços adicionais
 */
function renderConferenceAdditionalServices() {
  if (conferenceAdditionalServices.length === 0) {
    return `<p class="empty-state" style="margin: 0;">Nenhum serviço adicional cadastrado</p>`
  }

  return conferenceAdditionalServices.map((s, idx) => `
    <div style="display: grid; grid-template-columns: 2fr 1fr auto; gap: 0.75rem; margin-bottom: 0.75rem; align-items: end;">
      <div>
        <label style="font-size: 0.75rem; color: var(--text-secondary);">Descrição do Serviço</label>
        <input type="text" value="${escapeHtml(s.description || '')}" onchange="conferenceAdditionalServices[${idx}].description = this.value" placeholder="Ex: Configuração de rede" style="width: 100%; padding: 0.5rem; background: var(--bg-input); border: 1px solid var(--border-color); border-radius: 6px; color: var(--text-primary);" />
      </div>
      <div>
        <label style="font-size: 0.75rem; color: var(--text-secondary);">Valor (R$)</label>
        <input type="number" value="${s.value || 0}" onchange="updateAdditionalServiceValue(${idx}, this.value)" step="0.01" style="width: 100%; padding: 0.5rem; background: var(--bg-input); border: 1px solid var(--border-color); border-radius: 6px; color: var(--text-primary);" />
      </div>
      <button onclick="removeConferenceAdditionalService(${idx})" class="btn-danger" style="padding: 0.5rem; background: #ef4444; color: white; border: none; border-radius: 6px; cursor: pointer;">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <line x1="18" y1="6" x2="6" y2="18"/>
          <line x1="6" y1="6" x2="18" y2="18"/>
        </svg>
      </button>
    </div>
  `).join('')
}

/**
 * Normaliza o valor de km_option para o formato padrão do sistema
 * Aceita valores do técnico (50, 100, maior, nenhum) e converte para formato unificado
 */
function normalizeKmOption(kmOption) {
  if (!kmOption) return 'sem_deslocamento'
  const opt = String(kmOption).toLowerCase().trim()

  // Mapeamento de valores do técnico → formato padrão
  // IMPORTANTE: A verificação de "acima_100km" deve vir ANTES de "ate_100km"
  // porque "acima_100km" contém "100" e seria capturado incorretamente
  if (opt === 'nenhum' || opt === 'none' || opt === 'sem_deslocamento' || opt === 'sem deslocamento') {
    return 'sem_deslocamento'
  }
  if (opt === 'maior' || opt === 'acima_100km' || opt.includes('acima') || opt.includes('maior')) {
    return 'acima_100km'
  }
  if (opt === '50' || opt === 'ate_50km' || opt.includes('50')) {
    return 'ate_50km'
  }
  if (opt === '100' || opt === 'ate_100km' || opt.includes('100')) {
    return 'ate_100km'
  }

  return 'sem_deslocamento'
}

/**
 * Renderiza lista de deslocamentos
 */
function renderConferenceDisplacements() {
  if (conferenceDisplacements.length === 0) {
    return `<p class="empty-state" style="margin: 0;">Nenhum deslocamento cadastrado</p>`
  }

  return conferenceDisplacements.map((d, idx) => {
    // Normaliza km_option para garantir compatibilidade
    const normalizedKmOption = normalizeKmOption(d.km_option)

    // Gera opções de veículos
    const vehicleOptions = conferenceVehicles.map(v =>
      `<option value="${v.id}" ${d.vehicle_id == v.id ? 'selected' : ''}>${escapeHtml(v.plate)}${v.name ? ' - ' + escapeHtml(v.name) : ''}</option>`
    ).join('')

    // KM Total só aparece se for acima de 100km
    const showKmTotal = normalizedKmOption === 'acima_100km'

    return `
    <div style="display: grid; grid-template-columns: 1fr ${showKmTotal ? '1fr ' : ''}1fr auto; gap: 0.75rem; margin-bottom: 0.75rem; align-items: end;">
      <div>
        <label style="font-size: 0.75rem; color: var(--text-secondary);">Opção KM</label>
        <select onchange="updateDisplacementKmOption(${idx}, this.value)" style="width: 100%; padding: 0.5rem; background: var(--bg-input); border: 1px solid var(--border-color); border-radius: 6px; color: var(--text-primary);">
          <option value="sem_deslocamento" ${normalizedKmOption === 'sem_deslocamento' ? 'selected' : ''}>Sem deslocamento</option>
          <option value="ate_50km" ${normalizedKmOption === 'ate_50km' ? 'selected' : ''}>Até 50 km</option>
          <option value="ate_100km" ${normalizedKmOption === 'ate_100km' ? 'selected' : ''}>Até 100 km</option>
          <option value="acima_100km" ${normalizedKmOption === 'acima_100km' ? 'selected' : ''}>Acima de 100 km</option>
        </select>
      </div>
      ${showKmTotal ? `
      <div id="kmTotalField_${idx}">
        <label style="font-size: 0.75rem; color: var(--text-secondary);">KM Total (ida + volta)</label>
        <input type="number" value="${d.km_total || 0}" onchange="updateDisplacementKmTotal(${idx}, this.value)" step="0.1" style="width: 100%; padding: 0.5rem; background: var(--bg-input); border: 1px solid var(--border-color); border-radius: 6px; color: var(--text-primary);" />
      </div>
      ` : ''}
      <div>
        <label style="font-size: 0.75rem; color: var(--text-secondary);">Veículo</label>
        <select onchange="updateDisplacementVehicle(${idx}, this.value)" style="width: 100%; padding: 0.5rem; background: var(--bg-input); border: 1px solid var(--border-color); border-radius: 6px; color: var(--text-primary);">
          <option value="">Selecione um veículo</option>
          ${vehicleOptions}
        </select>
      </div>
      <button onclick="removeConferenceDisplacement(${idx})" class="btn-danger" style="padding: 0.5rem; background: #ef4444; color: white; border: none; border-radius: 6px; cursor: pointer;">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <line x1="18" y1="6" x2="6" y2="18"/>
          <line x1="6" y1="6" x2="18" y2="18"/>
        </svg>
      </button>
    </div>
    `
  }).join('')
}

// Funções de atualização de materiais
function updateMaterialQuantity(idx, value) {
  conferenceMaterials[idx].quantity = parseFloat(value) || 0
  console.log('Material quantidade atualizada:', conferenceMaterials[idx])

  // Re-renderiza para atualizar total do material
  document.getElementById('conferenceMaterialsList').innerHTML = renderConferenceMaterials()

  // Recalcula totais
  recalculateConferenceTotals()
}

function updateMaterialPrice(idx, value) {
  conferenceMaterials[idx].unit_price = parseFloat(value) || 0
  console.log('Material preço atualizado:', conferenceMaterials[idx])

  // Re-renderiza para atualizar total do material
  document.getElementById('conferenceMaterialsList').innerHTML = renderConferenceMaterials()

  // Recalcula totais
  recalculateConferenceTotals()
}

// Funções de adição e remoção de itens
function addConferenceMaterial() {
  conferenceMaterials.push({ name: '', quantity: 0, unit_price: 0 })
  document.getElementById('conferenceMaterialsList').innerHTML = renderConferenceMaterials()
}

function removeConferenceMaterial(idx) {
  conferenceMaterials.splice(idx, 1)
  document.getElementById('conferenceMaterialsList').innerHTML = renderConferenceMaterials()
  recalculateConferenceTotals()
}

function addConferenceWorklog() {
  conferenceWorklogs.push({ start_datetime: '', end_datetime: '', hours: 0 })
  document.getElementById('conferenceWorklogsList').innerHTML = renderConferenceWorklogs()
  recalculateConferenceTotals()
}

function removeConferenceWorklog(idx) {
  conferenceWorklogs.splice(idx, 1)
  document.getElementById('conferenceWorklogsList').innerHTML = renderConferenceWorklogs()
  recalculateConferenceTotals()
}

function addConferenceDisplacement() {
  conferenceDisplacements.push({ km_option: 'ate_50km', km_total: 0, vehicle_id: null })
  document.getElementById('conferenceDisplacementsList').innerHTML = renderConferenceDisplacements()
  recalculateConferenceTotals()
}

function removeConferenceDisplacement(idx) {
  conferenceDisplacements.splice(idx, 1)
  document.getElementById('conferenceDisplacementsList').innerHTML = renderConferenceDisplacements()
  recalculateConferenceTotals()
}

function addConferenceAdditionalService() {
  conferenceAdditionalServices.push({ description: '', value: 0 })
  document.getElementById('conferenceAdditionalServicesList').innerHTML = renderConferenceAdditionalServices()
  recalculateConferenceTotals()
}

function removeConferenceAdditionalService(idx) {
  conferenceAdditionalServices.splice(idx, 1)
  document.getElementById('conferenceAdditionalServicesList').innerHTML = renderConferenceAdditionalServices()
  recalculateConferenceTotals()
}

function updateAdditionalServiceValue(idx, value) {
  conferenceAdditionalServices[idx].value = parseFloat(value) || 0
  console.log('Serviço adicional atualizado:', conferenceAdditionalServices[idx])
  recalculateConferenceTotals()
}

// Funções de atualização de deslocamentos
function updateDisplacementKmOption(idx, value) {
  conferenceDisplacements[idx].km_option = value
  console.log('Deslocamento atualizado:', conferenceDisplacements[idx])

  // Re-renderiza para mostrar/ocultar campo KM Total
  document.getElementById('conferenceDisplacementsList').innerHTML = renderConferenceDisplacements()

  // Recalcula totais
  recalculateConferenceTotals()
}

function updateDisplacementKmTotal(idx, value) {
  conferenceDisplacements[idx].km_total = parseFloat(value) || 0
  console.log('KM total atualizado:', conferenceDisplacements[idx])

  // Recalcula totais
  recalculateConferenceTotals()
}

function updateDisplacementVehicle(idx, value) {
  conferenceDisplacements[idx].vehicle_id = value ? parseInt(value) : null
  console.log('Veículo atualizado:', conferenceDisplacements[idx])
}

// Funções de atualização de worklogs
function updateWorklogStart(idx, value) {
  conferenceWorklogs[idx].start_datetime = value + ':00.000Z'
  conferenceWorklogs[idx].hours = null // Força recalculo baseado em datetime
  console.log('Worklog início atualizado:', conferenceWorklogs[idx])

  // Re-renderiza para atualizar duração exibida
  document.getElementById('conferenceWorklogsList').innerHTML = renderConferenceWorklogs()

  // Recalcula totais
  recalculateConferenceTotals()
}

function updateWorklogEnd(idx, value) {
  conferenceWorklogs[idx].end_datetime = value + ':00.000Z'
  conferenceWorklogs[idx].hours = null // Força recalculo baseado em datetime
  console.log('Worklog fim atualizado:', conferenceWorklogs[idx])

  // Re-renderiza para atualizar duração exibida
  document.getElementById('conferenceWorklogsList').innerHTML = renderConferenceWorklogs()

  // Recalcula totais
  recalculateConferenceTotals()
}

/**
 * Calcula custo de deslocamento baseado em km_option e is_new_client
 */
function calculateDisplacementCost(displacement, isNewClient) {
  // Normaliza km_option para garantir compatibilidade
  const normalizedKmOption = normalizeKmOption(displacement.km_option)

  // Sem deslocamento = R$ 0
  if (normalizedKmOption === 'sem_deslocamento') {
    return 0
  }

  let km = 0

  // Determina KM baseado na opção normalizada
  if (displacement.km_total > 0 && normalizedKmOption === 'acima_100km') {
    km = parseFloat(displacement.km_total)
  } else if (normalizedKmOption === 'ate_50km') {
    km = 50
  } else if (normalizedKmOption === 'ate_100km') {
    km = 100
  }

  // Aplica preços baseados em KM e tipo de cliente
  if (km <= 50) {
    return isNewClient ? 95 : 80
  } else if (km <= 100) {
    return isNewClient ? 170 : 150
  } else {
    // Acima de 100km: preço por km
    const ratePerKm = isNewClient ? 2.57 : 2.20
    return Math.round(km * ratePerKm * 100) / 100
  }
}

/**
 * Calcula total de horas trabalhadas
 */
function calculateTotalHours() {
  return conferenceWorklogs.reduce((total, wl) => {
    // SEMPRE calcula baseado em start/end datetime se ambos existirem
    if (wl.start_datetime && wl.end_datetime) {
      const start = new Date(wl.start_datetime)
      const end = new Date(wl.end_datetime)
      const hours = Math.max((end - start) / 3600000, 0) // milisegundos para horas

      // Atualiza o campo hours do worklog para manter sincronizado
      wl.hours = hours

      return total + hours
    }
    // Se não tem datetime, usa campo hours como fallback
    if (wl.hours != null && wl.hours > 0) {
      return total + parseFloat(wl.hours)
    }
    return total
  }, 0)
}

/**
 * Recalcula totais (chamado quando qualquer valor é alterado)
 */
function recalculateConferenceTotals() {
  console.log('🔄 recalculateConferenceTotals() chamado')

  if (!currentConferenceOS) {
    console.error('❌ currentConferenceOS não está definido!')
    return
  }

  console.log('📊 Dados da OS:', {
    is_new_client: currentConferenceOS.is_new_client,
    hourly_rate: currentConferenceOS.hourly_rate,
    materiais: conferenceMaterials.length,
    deslocamentos: conferenceDisplacements.length,
    worklogs: conferenceWorklogs.length
  })

  // 1. Calcula total de materiais
  const totalMaterials = conferenceMaterials.reduce((sum, m) => {
    const qty = parseFloat(m.quantity) || 0
    const price = parseFloat(m.unit_price) || 0
    return sum + (qty * price)
  }, 0)
  console.log('💰 Total Materiais:', totalMaterials)

  // 2. Calcula custo de deslocamentos
  const isNewClient = currentConferenceOS.is_new_client || false
  const displacementCost = conferenceDisplacements.reduce((sum, d) => {
    const cost = calculateDisplacementCost(d, isNewClient)
    console.log('🚗 Deslocamento:', d, '→ Custo:', cost)
    return sum + cost
  }, 0)
  console.log('🚗 Total Deslocamentos:', displacementCost)

  // 3. Calcula custo de horas trabalhadas
  const totalHours = calculateTotalHours()
  // Usa taxa customizada se definida, senão usa padrão baseado em cliente novo (175) ou antigo (150)
  const defaultRate = isNewClient ? 175 : 150
  const hourlyRate = customHourlyRate !== null ? customHourlyRate : defaultRate
  const hoursCost = totalHours * hourlyRate
  console.log('⏱️ Horas:', totalHours, '× Taxa:', hourlyRate, `(${customHourlyRate !== null ? 'CUSTOM' : isNewClient ? 'NOVO' : 'ANTIGO'})`, '=', hoursCost)

  // 4. Calcula total de serviços adicionais
  const totalAdditionalServices = conferenceAdditionalServices.reduce((sum, s) => {
    const value = parseFloat(s.value) || 0
    return sum + value
  }, 0)
  console.log('➕ Total Serviços Adicionais:', totalAdditionalServices)

  // 5. Total geral = horas + deslocamentos + materiais + serviços adicionais
  const grandTotal = hoursCost + displacementCost + totalMaterials + totalAdditionalServices
  console.log('💵 TOTAL GERAL:', grandTotal, '(Horas:', hoursCost, '+ Desl:', displacementCost, '+ Mat:', totalMaterials, '+ Serv Add:', totalAdditionalServices, ')')

  // 6. Renderiza campos dinamicamente
  const formatter = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })
  const breakdown = document.getElementById('conferenceFinancialBreakdown')

  if (!breakdown) {
    console.error('❌ Elemento conferenceFinancialBreakdown NÃO ENCONTRADO!')
    return
  }

  let fieldsHTML = ''

  // Campo: Valor da Hora (editável)
  const isCustomRate = customHourlyRate !== null
  fieldsHTML += `
    <div>
      <label style="font-size: 0.875rem; color: var(--text-secondary); display: block; margin-bottom: 0.5rem;">
        💵 Valor da Hora
      </label>
      <div style="display: flex; align-items: center; gap: 0.5rem;">
        <span style="color: var(--text-secondary);">R$</span>
        <input
          type="number"
          id="customHourlyRateInput"
          value="${hourlyRate}"
          step="0.01"
          min="0"
          style="flex: 1; padding: 0.5rem; background: var(--bg-input); border: 1px solid ${isCustomRate ? '#f59e0b' : 'var(--border-color)'}; border-radius: 6px; color: var(--text-primary); font-weight: 600; font-size: 1rem;"
          onchange="updateCustomHourlyRate(this.value)"
          oninput="updateCustomHourlyRate(this.value)"
        >
        ${isCustomRate ? `
          <button onclick="resetHourlyRate()" style="padding: 0.5rem; background: #f59e0b; border: none; border-radius: 6px; color: white; cursor: pointer; font-size: 0.75rem;" title="Voltar ao padrão">
            ↩️
          </button>
        ` : ''}
      </div>
      <div style="font-size: 0.75rem; color: ${isCustomRate ? '#f59e0b' : 'var(--text-secondary)'}; margin-top: 0.25rem;">
        ${isCustomRate ? '⚠️ Valor customizado' : `Padrão: ${isNewClient ? 'Cliente Novo (R$ 175)' : 'Cliente Antigo (R$ 150)'}`}
      </div>
    </div>
  `

  // Campo: Custo de Horas (calculado)
  fieldsHTML += `
    <div>
      <label style="font-size: 0.875rem; color: var(--text-secondary); display: block; margin-bottom: 0.5rem;">
        ⏱️ Custo de Horas
      </label>
      <div style="background: var(--bg-card); border: 1px solid var(--border-color); padding: 0.75rem; border-radius: 8px; font-size: 1.125rem; font-weight: 600; color: var(--text-primary);">
        ${formatter.format(hoursCost)}
      </div>
      <div style="font-size: 0.75rem; color: var(--text-secondary); margin-top: 0.25rem;">
        ${formatHoursReview(totalHours)} × ${formatter.format(hourlyRate)}/h
      </div>
    </div>
  `

  // Campo: Custo de Deslocamento (sempre aparece)
  fieldsHTML += `
    <div>
      <label style="font-size: 0.875rem; color: var(--text-secondary); display: block; margin-bottom: 0.5rem;">
        🚗 Deslocamento
      </label>
      <div style="background: var(--bg-card); border: 1px solid var(--border-color); padding: 0.75rem; border-radius: 8px; font-size: 1.125rem; font-weight: 600; color: var(--text-primary);">
        ${formatter.format(displacementCost)}
      </div>
      <div style="font-size: 0.75rem; color: var(--text-secondary); margin-top: 0.25rem;">
        ${conferenceDisplacements.length} deslocamento(s)
      </div>
    </div>
  `

  // Campo: Materiais (só se tiver)
  if (totalMaterials > 0) {
    fieldsHTML += `
      <div>
        <label style="font-size: 0.875rem; color: var(--text-secondary); display: block; margin-bottom: 0.5rem;">
          🔧 Materiais
        </label>
        <div style="background: var(--bg-card); border: 1px solid var(--border-color); padding: 0.75rem; border-radius: 8px; font-size: 1.125rem; font-weight: 600; color: var(--text-primary);">
          ${formatter.format(totalMaterials)}
        </div>
        <div style="font-size: 0.75rem; color: var(--text-secondary); margin-top: 0.25rem;">
          ${conferenceMaterials.length} item(ns)
        </div>
      </div>
    `
  }

  // Campo: Serviços Adicionais (só se tiver)
  if (totalAdditionalServices > 0) {
    fieldsHTML += `
      <div>
        <label style="font-size: 0.875rem; color: var(--text-secondary); display: block; margin-bottom: 0.5rem;">
          ➕ Serviços Adicionais
        </label>
        <div style="background: var(--bg-card); border: 1px solid var(--border-color); padding: 0.75rem; border-radius: 8px; font-size: 1.125rem; font-weight: 600; color: var(--text-primary);">
          ${formatter.format(totalAdditionalServices)}
        </div>
        <div style="font-size: 0.75rem; color: var(--text-secondary); margin-top: 0.25rem;">
          ${conferenceAdditionalServices.length} serviço(s)
        </div>
      </div>
    `
  }

  // Total Geral (sempre aparece, destaque)
  fieldsHTML += `
    <div style="background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%); padding: 1rem; border-radius: 12px; box-shadow: 0 4px 12px rgba(37, 99, 235, 0.3); grid-column: span 1;">
      <label style="font-size: 0.875rem; color: rgba(255,255,255,0.9); font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; display: block; margin-bottom: 0.5rem;">
        💰 Total Geral
      </label>
      <div id="conferenceGrandTotal" style="font-size: 1.75rem; font-weight: 700; color: white;">
        ${formatter.format(grandTotal)}
      </div>
    </div>
  `

  breakdown.innerHTML = fieldsHTML
  console.log('✅ Detalhamento financeiro atualizado:', formatter.format(grandTotal))
}

/**
 * Alterna entre Cliente Novo e Cliente Antigo
 */
function toggleClientType() {
  if (!currentConferenceOS) return

  // Alterna o status
  currentConferenceOS.is_new_client = !currentConferenceOS.is_new_client

  const isNew = currentConferenceOS.is_new_client
  const btn = document.getElementById('toggleClientTypeBtn')

  if (!btn) return

  // Atualiza visual do botão com animação
  btn.style.background = isNew
    ? 'linear-gradient(135deg, #10b981 0%, #059669 100%)'
    : 'linear-gradient(135deg, #6b7280 0%, #4b5563 100%)'
  btn.style.borderColor = isNew ? '#10b981' : '#6b7280'
  btn.textContent = isNew ? '🆕 CLIENTE NOVO' : '👤 CLIENTE ANTIGO'

  // Feedback visual
  btn.style.transform = 'scale(0.95)'
  setTimeout(() => {
    btn.style.transform = 'scale(1)'
  }, 150)

  console.log(`🔄 Tipo de cliente alterado para: ${isNew ? 'NOVO' : 'ANTIGO'}`)

  // Quando troca tipo de cliente, reseta valor customizado para usar o padrão
  customHourlyRate = null

  // Recalcula todos os valores automaticamente
  recalculateConferenceTotals()

  // Mostra mensagem de feedback
  showToast(
    `Cliente alterado para ${isNew ? 'NOVO (R$ 175/h)' : 'ANTIGO (R$ 150/h)'}. Valores recalculados!`,
    'success'
  )
}

/**
 * Atualiza o valor da hora customizado
 */
function updateCustomHourlyRate(value) {
  const numValue = parseFloat(value)
  if (isNaN(numValue) || numValue < 0) return

  const isNewClient = currentConferenceOS?.is_new_client || false
  const defaultRate = isNewClient ? 175 : 150

  // Se o valor for igual ao padrão, não precisa de custom
  if (numValue === defaultRate) {
    customHourlyRate = null
  } else {
    customHourlyRate = numValue
  }

  // Recalcula sem re-renderizar completamente para evitar perder foco do input
  recalculateConferenceTotalsQuick()
}

/**
 * Reseta o valor da hora para o padrão
 */
function resetHourlyRate() {
  customHourlyRate = null
  recalculateConferenceTotals()
  showToast('Valor da hora resetado para o padrão', 'info')
}

/**
 * Recalcula totais rapidamente (sem re-renderizar o input para não perder foco)
 */
function recalculateConferenceTotalsQuick() {
  if (!currentConferenceOS) return

  const isNewClient = currentConferenceOS.is_new_client || false
  const defaultRate = isNewClient ? 175 : 150
  const hourlyRate = customHourlyRate !== null ? customHourlyRate : defaultRate

  // Total de materiais
  const totalMaterials = conferenceMaterials.reduce((sum, m) => {
    const qty = parseFloat(m.quantity) || 0
    const price = parseFloat(m.unit_price) || 0
    return sum + (qty * price)
  }, 0)

  // Total de deslocamentos
  const displacementCost = conferenceDisplacements.reduce((sum, d) => {
    return sum + calculateDisplacementCost(d, isNewClient)
  }, 0)

  // Total de horas
  const totalHours = calculateTotalHours()
  const hoursCost = totalHours * hourlyRate

  // Total de serviços adicionais
  const totalAdditionalServices = conferenceAdditionalServices.reduce((sum, s) => {
    const value = parseFloat(s.value) || 0
    return sum + value
  }, 0)

  // Total geral
  const grandTotal = hoursCost + displacementCost + totalMaterials + totalAdditionalServices

  // Atualiza apenas os valores, não o HTML completo
  const formatter = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })

  // Atualiza total geral
  const totalEl = document.getElementById('conferenceGrandTotal')
  if (totalEl) {
    totalEl.textContent = formatter.format(grandTotal)
  }

  // Atualiza também os outros valores na tela se existirem
  // Isso garante que a tela está sempre em sincronia
  const breakdown = document.getElementById('conferenceFinancialBreakdown')
  if (breakdown) {
    // Procura e atualiza o valor do custo de horas
    const hoursCostDivs = breakdown.querySelectorAll('div')
    hoursCostDivs.forEach(div => {
      const label = div.querySelector('label')
      if (label && label.textContent.includes('Custo de Horas')) {
        const valueDiv = div.querySelector('div[style*="font-size: 1.125rem"]')
        if (valueDiv) {
          valueDiv.textContent = formatter.format(hoursCost)
        }
        const detailDiv = div.querySelector('div[style*="font-size: 0.75rem"]')
        if (detailDiv && detailDiv.textContent.includes('×')) {
          detailDiv.textContent = `${formatHoursReview(totalHours)} × ${formatter.format(hourlyRate)}/h`
        }
      }
    })
  }
}

/**
 * Fecha modal de conferência
 */
function closeConferenceModal() {
  document.getElementById('conferenceModal').style.display = 'none'
  currentConferenceOS = null
  conferenceMaterials = []
  conferenceWorklogs = []
  conferenceDisplacements = []
  conferenceAdditionalServices = []
  conferenceVehicles = []
  customHourlyRate = null // Reseta valor customizado ao fechar
}

/**
 * Toggle do menu dropdown no mobile
 */
function toggleConferenceMenu() {
  const dropdown = document.getElementById('conferenceDropdown')
  if (dropdown) {
    dropdown.classList.toggle('open')
  }
}

// Fecha dropdown se clicar fora dele
document.addEventListener('click', function(e) {
  const dropdown = document.getElementById('conferenceDropdown')
  const toggleBtn = document.querySelector('.btn-menu-toggle')
  if (dropdown && dropdown.classList.contains('open')) {
    if (!dropdown.contains(e.target) && !toggleBtn.contains(e.target)) {
      dropdown.classList.remove('open')
    }
  }
})

/**
 * Valida dados antes de aprovar OS
 * Retorna { valid: boolean, errors: string[] }
 */
function validateConferenceData() {
  const errors = []

  // 1. Validar empresa selecionada
  const companySelect = document.getElementById('conferenceCompanySelect')
  if (!companySelect?.value || companySelect.value === '' || companySelect.value === '0') {
    errors.push('Selecione uma empresa')
  }

  // 2. Validar máquina selecionada
  const machineSelect = document.getElementById('conferenceMachineSelect')
  if (!machineSelect?.value || machineSelect.value === '' || machineSelect.value === '0') {
    errors.push('Selecione uma máquina')
  }

  // 3. Validar worklogs (fim > início)
  for (let i = 0; i < conferenceWorklogs.length; i++) {
    const w = conferenceWorklogs[i]
    if (w.start_datetime && w.end_datetime) {
      const start = new Date(w.start_datetime)
      const end = new Date(w.end_datetime)
      if (end <= start) {
        errors.push(`Período ${i + 1}: Fim deve ser após o início`)
      }
    }
  }

  // 4. Validar valores não negativos
  for (let i = 0; i < conferenceMaterials.length; i++) {
    const m = conferenceMaterials[i]
    if (parseFloat(m.quantity) < 0) {
      errors.push(`Material "${m.name}": Quantidade não pode ser negativa`)
    }
    if (parseFloat(m.unit_price) < 0) {
      errors.push(`Material "${m.name}": Preço não pode ser negativo`)
    }
  }

  // 5. Validar valor da hora customizado
  if (customHourlyRate !== null && customHourlyRate <= 0) {
    errors.push('Valor da hora deve ser maior que zero')
  }

  return { valid: errors.length === 0, errors }
}

/**
 * Aprova OS e envia para faturamento
 */
async function approveConferenceOS() {
  if (!currentConferenceOS) {
    showToast('Nenhuma OS selecionada', 'error')
    return
  }

  // Validar dados antes de confirmar
  const validation = validateConferenceData()
  if (!validation.valid) {
    showToast('Corrija os erros:\n• ' + validation.errors.join('\n• '), 'error')
    return
  }

  if (!confirm(`Confirma a aprovação da OS #${currentConferenceOS.order_number || currentConferenceOS.id}?\n\nEla será enviada para faturamento.`)) {
    return
  }

  // Mostra spinner no botão durante o processamento
  const btn = document.getElementById('btnApproveConference')
  const originalText = setButtonLoading(btn, 'Aprovando...')

  try {
    // Recalcula todos os valores antes de enviar
    const totalMaterials = conferenceMaterials.reduce((sum, m) => {
      return sum + ((parseFloat(m.quantity) || 0) * (parseFloat(m.unit_price) || 0))
    }, 0)

    const isNewClient = currentConferenceOS.is_new_client || false
    const displacementCost = conferenceDisplacements.reduce((sum, d) => {
      return sum + calculateDisplacementCost(d, isNewClient)
    }, 0)

    const totalHours = calculateTotalHours()
    // Usa taxa customizada se definida, senão usa padrão
    const defaultRate = isNewClient ? 175 : 150
    const hourlyRate = customHourlyRate !== null ? customHourlyRate : defaultRate
    const hoursCost = totalHours * hourlyRate

    const totalAdditionalServices = conferenceAdditionalServices.reduce((sum, s) => {
      return sum + (parseFloat(s.value) || 0)
    }, 0)

    const totalServiceCost = hoursCost + displacementCost
    const grandTotal = hoursCost + displacementCost + totalMaterials + totalAdditionalServices

    // Pega valores dos selects de empresa, máquina e tipo de manutenção
    const selectedCompanyId = parseInt(document.getElementById('conferenceCompanySelect')?.value)
    const selectedMachineId = parseInt(document.getElementById('conferenceMachineSelect')?.value)
    const selectedMaintenanceType = document.getElementById('conferenceMaintenanceType')?.value || null

    const response = await fetch(`${API_URL}/api/review/${currentConferenceOS.id}/approve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        company_id: selectedCompanyId, // Empresa selecionada
        machine_id: selectedMachineId, // Máquina selecionada
        maintenance_type: selectedMaintenanceType, // Tipo de manutenção selecionado
        service_description: document.getElementById('conferenceServiceDesc').value,
        is_new_client: isNewClient, // Envia o tipo de cliente atualizado
        effective_hourly_rate: hourlyRate, // Taxa efetiva usada nesta OS
        value_service: totalAdditionalServices, // Soma dos serviços adicionais
        total_service_cost: totalServiceCost,
        total_material_cost: totalMaterials,
        grand_total: grandTotal,
        total_hours: totalHours, // Total de horas alteradas na conferência
        materials: conferenceMaterials,
        worklogs: conferenceWorklogs,
        displacements: conferenceDisplacements,
        additional_services: conferenceAdditionalServices
      })
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.message || 'Erro ao aprovar OS')
    }

    showToast(`OS #${currentConferenceOS.order_number || currentConferenceOS.id} aprovada com sucesso!`, 'success')
    closeConferenceModal()
    loadReviewData()
  } catch (error) {
    console.error('Erro ao aprovar OS:', error)
    showToast(error.message || 'Erro ao aprovar OS', 'error')
    // Restaura botão em caso de erro
    resetButtonLoading(btn, originalText)
  }
}

/**
 * Salva alterações da conferência SEM aprovar (OS continua em conferência)
 */
async function saveConferenceChanges() {
  if (!currentConferenceOS) {
    showToast('Nenhuma OS selecionada', 'error')
    return
  }

  const btn = document.getElementById('btnSaveConference')
  const originalText = setButtonLoading(btn, 'Salvando...')

  try {
    // Recalcula todos os valores antes de enviar
    const totalMaterials = conferenceMaterials.reduce((sum, m) => {
      return sum + ((parseFloat(m.quantity) || 0) * (parseFloat(m.unit_price) || 0))
    }, 0)

    const isNewClient = currentConferenceOS.is_new_client || false
    const displacementCost = conferenceDisplacements.reduce((sum, d) => {
      return sum + calculateDisplacementCost(d, isNewClient)
    }, 0)

    const totalHours = calculateTotalHours()
    const defaultRate = isNewClient ? 175 : 150
    const hourlyRate = customHourlyRate !== null ? customHourlyRate : defaultRate
    const hoursCost = totalHours * hourlyRate

    const totalAdditionalServices = conferenceAdditionalServices.reduce((sum, s) => {
      return sum + (parseFloat(s.value) || 0)
    }, 0)

    const totalServiceCost = hoursCost + displacementCost
    const grandTotal = hoursCost + displacementCost + totalMaterials + totalAdditionalServices

    const selectedCompanyId = parseInt(document.getElementById('conferenceCompanySelect')?.value)
    const selectedMachineId = parseInt(document.getElementById('conferenceMachineSelect')?.value)
    const selectedMaintenanceType = document.getElementById('conferenceMaintenanceType')?.value || null

    // Pega observações do campo se existir, senão usa o valor atual
    const observationsField = document.getElementById('conferenceObservations')
    const observations = observationsField ? observationsField.value : (currentConferenceOS.observations || null)

    console.log('[SAVE] Enviando dados para salvar:', {
      os_id: currentConferenceOS.id,
      company_id: selectedCompanyId,
      machine_id: selectedMachineId,
      grandTotal,
      materials: conferenceMaterials.length,
      worklogs: conferenceWorklogs.length,
      displacements: conferenceDisplacements.length
    })

    const response = await fetch(`${API_URL}/api/review/${currentConferenceOS.id}/save`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        company_id: selectedCompanyId,
        machine_id: selectedMachineId,
        maintenance_type: selectedMaintenanceType,
        service_description: document.getElementById('conferenceServiceDesc')?.value || null,
        observations: observations,
        is_new_client: isNewClient,
        effective_hourly_rate: hourlyRate,
        value_service: totalAdditionalServices,
        total_service_cost: totalServiceCost,
        total_material_cost: totalMaterials,
        grand_total: grandTotal,
        total_hours: totalHours,
        materials: conferenceMaterials,
        worklogs: conferenceWorklogs,
        displacements: conferenceDisplacements,
        additional_services: conferenceAdditionalServices
      })
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.message || 'Erro ao salvar alterações')
    }

    showToast(`Alterações da OS #${currentConferenceOS.order_number || currentConferenceOS.id} salvas!`, 'success')
    resetButtonLoading(btn, originalText)
  } catch (error) {
    console.error('Erro ao salvar alterações:', error)
    showToast(error.message || 'Erro ao salvar alterações', 'error')
    resetButtonLoading(btn, originalText)
  }
}

/**
 * Cancela OS (antiga função de arquivar)
 */
async function cancelConferenceOS() {
  if (!currentConferenceOS) {
    showToast('Nenhuma OS selecionada', 'error')
    return
  }

  const reason = prompt(`Por que você deseja CANCELAR a OS #${currentConferenceOS.order_number || currentConferenceOS.id}?\n\n(Ela não será faturada e ficará como cancelada no sistema)`)

  if (!reason || reason.trim() === '') {
    showToast('Você deve informar o motivo do cancelamento', 'error')
    return
  }

  try {
    const response = await fetch(`${API_URL}/api/review/${currentConferenceOS.id}/archive`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason })
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.message || 'Erro ao cancelar OS')
    }

    showToast(`OS #${currentConferenceOS.order_number || currentConferenceOS.id} cancelada com sucesso.`, 'success')
    closeConferenceModal()
    loadReviewData()
  } catch (error) {
    console.error('Erro ao cancelar OS:', error)
    showToast(error.message || 'Erro ao cancelar OS', 'error')
  }
}

/**
 * Envia OS para Standby (aguardando material, informação, etc.)
 */
async function standbyConferenceOS() {
  if (!currentConferenceOS) {
    showToast('Nenhuma OS selecionada', 'error')
    return
  }

  const reason = prompt(`Por que a OS #${currentConferenceOS.order_number || currentConferenceOS.id} está em STANDBY?\n\n(Ex: Aguardando material, aguardando aprovação do cliente, etc.)`)

  if (!reason || reason.trim() === '') {
    showToast('Você deve informar o motivo do standby', 'error')
    return
  }

  try {
    const response = await fetch(`${API_URL}/api/review/${currentConferenceOS.id}/standby`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason })
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.message || 'Erro ao colocar OS em standby')
    }

    showToast(`OS #${currentConferenceOS.order_number || currentConferenceOS.id} enviada para Standby.`, 'success')
    closeConferenceModal()
    loadReviewData()
  } catch (error) {
    console.error('Erro ao colocar OS em standby:', error)
    showToast(error.message || 'Erro ao colocar OS em standby', 'error')
  }
}

// Alias para compatibilidade
const archiveConferenceOS = cancelConferenceOS

/**
 * Cria modal de conferência (se não existir)
 */
function createConferenceModal() {
  const modalHTML = `
    <div id="conferenceModal" class="modal" style="display: none;">
      <div class="modal-content" style="max-width: 1000px; max-height: 90vh; overflow-y: auto;">
        <div class="modal-header">
          <h2 style="color: #f59e0b;">Conferência de OS</h2>
          <button class="modal-close" onclick="closeConferenceModal()">&times;</button>
        </div>
        <div id="conferenceModalContent" class="modal-body"></div>
        <div class="modal-footer conference-footer">
          <!-- Menu dropdown para mobile -->
          <div class="conference-mobile-menu">
            <button class="btn-conference btn-menu-toggle" onclick="toggleConferenceMenu()" type="button">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="12" cy="5" r="1"/>
                <circle cx="12" cy="12" r="1"/>
                <circle cx="12" cy="19" r="1"/>
              </svg>
              <span>Mais</span>
            </button>
            <div class="conference-dropdown" id="conferenceDropdown">
              <button class="dropdown-item btn-danger" onclick="cancelConferenceOS(); toggleConferenceMenu();">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <circle cx="12" cy="12" r="10"/>
                  <line x1="15" y1="9" x2="9" y2="15"/>
                  <line x1="9" y1="9" x2="15" y2="15"/>
                </svg>
                Cancelar OS
              </button>
              <button class="dropdown-item btn-warning" onclick="standbyConferenceOS(); toggleConferenceMenu();">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <circle cx="12" cy="12" r="10"/>
                  <line x1="12" y1="8" x2="12" y2="12"/>
                  <line x1="12" y1="16" x2="12.01" y2="16"/>
                </svg>
                Standby
              </button>
              <button class="dropdown-item" onclick="closeConferenceModal(); toggleConferenceMenu();">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <line x1="18" y1="6" x2="6" y2="18"/>
                  <line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
                Fechar
              </button>
            </div>
          </div>

          <!-- Botões visíveis em desktop -->
          <div class="conference-btn-group-left conference-desktop-only">
            <button class="btn-conference btn-danger" onclick="cancelConferenceOS()">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="12" cy="12" r="10"/>
                <line x1="15" y1="9" x2="9" y2="15"/>
                <line x1="9" y1="9" x2="15" y2="15"/>
              </svg>
              <span>Cancelar</span>
            </button>
            <button class="btn-conference btn-warning" onclick="standbyConferenceOS()">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="12" cy="12" r="10"/>
                <line x1="12" y1="8" x2="12" y2="12"/>
                <line x1="12" y1="16" x2="12.01" y2="16"/>
              </svg>
              <span>Standby</span>
            </button>
          </div>

          <!-- Botões principais (sempre visíveis) -->
          <div class="conference-btn-group-right">
            <button class="btn-conference btn-secondary conference-desktop-only" onclick="closeConferenceModal()">
              <span>Fechar</span>
            </button>
            <button id="btnSaveConference" class="btn-conference btn-save" onclick="saveConferenceChanges()">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/>
                <polyline points="17 21 17 13 7 13 7 21"/>
                <polyline points="7 3 7 8 15 8"/>
              </svg>
              <span>Salvar</span>
            </button>
            <button id="btnWarrantyConference" class="btn-conference" style="background: linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%);" onclick="sendToWarranty(currentConferenceOS.id)">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
              </svg>
              <span>Garantia</span>
            </button>
            <button id="btnApproveConference" class="btn-conference btn-approve" onclick="approveConferenceOS()">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="20 6 9 17 4 12"/>
              </svg>
              <span>Aprovar</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  `

  document.body.insertAdjacentHTML('beforeend', modalHTML)
}

/**
 * Renderiza options do select de empresas
 */
function renderCompanyOptions(selectedCompanyId) {
  if (!allCompaniesForReview || allCompaniesForReview.length === 0) {
    return '<option value="">Nenhuma empresa disponível</option>'
  }

  return allCompaniesForReview
    .map(company => `
      <option value="${company.id}" ${company.id === selectedCompanyId ? 'selected' : ''}>
        ${escapeHtml(company.name)} ${company.cnpj ? '- CNPJ: ' + company.cnpj : ''}
      </option>
    `)
    .join('')
}

/**
 * Renderiza options do select de máquinas (filtradas por empresa)
 */
function renderMachineOptions(companyId, selectedMachineId) {
  if (!allMachinesForReview || allMachinesForReview.length === 0) {
    return '<option value="">Nenhuma máquina disponível</option>'
  }

  // Filtra máquinas pela empresa selecionada
  const filteredMachines = allMachinesForReview.filter(m => m.company_id === companyId)

  if (filteredMachines.length === 0) {
    return '<option value="">Nenhuma máquina para esta empresa</option>'
  }

  return filteredMachines
    .map(machine => `
      <option value="${machine.id}" ${machine.id === selectedMachineId ? 'selected' : ''}>
        ${escapeHtml(machine.model || 'Sem modelo')} - Série: ${escapeHtml(machine.serial_number || 'N/A')}
      </option>
    `)
    .join('')
}


/**
 * Abre/fecha dropdown de empresas
 */
function toggleCompanyDropdown() {
  const dropdown = document.getElementById('conferenceCompanyDropdown')
  const searchInput = document.getElementById('conferenceCompanySearch')

  if (!dropdown) return

  const isOpen = dropdown.style.display !== 'none'

  if (isOpen) {
    dropdown.style.display = 'none'
  } else {
    dropdown.style.display = 'block'
    if (searchInput) {
      searchInput.value = ''
      searchInput.focus()
      filterConferenceCompanies() // Mostra todas
    }
  }
}

/**
 * Fecha dropdown quando clica fora
 */
document.addEventListener('click', function(e) {
  const dropdown = document.getElementById('conferenceCompanyDropdown')
  const display = document.getElementById('conferenceCompanyDisplay')

  if (!dropdown || !display) return

  // Se clicou fora do dropdown e do display, fecha
  if (!dropdown.contains(e.target) && !display.contains(e.target)) {
    dropdown.style.display = 'none'
  }
})

/**
 * Atualiza o select de máquinas quando troca a empresa
 */
function onConferenceCompanyChange() {
  const companySelect = document.getElementById('conferenceCompanySelect')
  const machineSelect = document.getElementById('conferenceMachineSelect')
  const companyNameDisplay = document.getElementById('conferenceCompanyName')
  const dropdown = document.getElementById('conferenceCompanyDropdown')

  if (!companySelect || !machineSelect) return

  const selectedCompanyId = parseInt(companySelect.value)

  // Atualiza o nome exibido
  const selectedOption = companySelect.options[companySelect.selectedIndex]
  if (companyNameDisplay && selectedOption) {
    // Pega só o nome (antes do CNPJ se houver)
    const fullText = selectedOption.textContent.trim()
    const nameOnly = fullText.split(' - CNPJ:')[0].trim()
    companyNameDisplay.textContent = nameOnly
  }

  // Fecha o dropdown
  if (dropdown) {
    dropdown.style.display = 'none'
  }

  // Atualiza o select de máquinas com as máquinas da empresa selecionada
  machineSelect.innerHTML = renderMachineOptions(selectedCompanyId, null)

  // Mostra mensagem informativa
  showToast('Empresa alterada! Máquinas atualizadas.', 'success')
}

/**
 * Filtra empresas conforme digitação no campo de busca
 */
function filterConferenceCompanies() {
  const searchInput = document.getElementById('conferenceCompanySearch')
  const companySelect = document.getElementById('conferenceCompanySelect')

  if (!searchInput || !companySelect) return

  const searchTerm = searchInput.value.toLowerCase().trim()

  // Filtra todas as options
  Array.from(companySelect.options).forEach(option => {
    const optionText = option.textContent.toLowerCase()
    const matches = searchTerm === '' || optionText.includes(searchTerm)
    option.style.display = matches ? '' : 'none'
  })
}

// ╔═══════════════════════════════════════════════════════════════════════════════╗
// ║                         SEÇÃO: STANDBY DE OS                                  ║
// ╚═══════════════════════════════════════════════════════════════════════════════╝

/**
 * Carrega OS em Standby
 */
async function loadStandbyOS() {
  try {
    const response = await fetch(`${API_URL}/api/review/standby`)
    if (!response.ok) {
      throw new Error('Erro ao carregar OS em standby')
    }

    const osList = await response.json()
    renderStandbyOSList(osList)

    // Atualiza contador
    const countEl = document.getElementById('standbyCount')
    if (countEl) {
      countEl.textContent = osList.length
    }

  } catch (error) {
    console.error('Erro ao carregar standby:', error)
    showToast(error.message || 'Erro ao carregar OS em standby', 'error')
  }
}

/**
 * Renderiza lista de OS em Standby
 */
function renderStandbyOSList(osList) {
  const container = document.getElementById('standbyOSList')
  if (!container) return

  if (!osList || osList.length === 0) {
    container.innerHTML = '<p class="empty-state">Nenhuma OS em standby</p>'
    return
  }

  const html = osList.map(os => {
    const standbyDate = os.standby_at ? new Date(os.standby_at).toLocaleDateString('pt-BR') : 'N/A'
    const reason = os.standby_reason || 'Não informado'

    return `
      <div class="os-card" style="display: flex; justify-content: space-between; align-items: center; padding: 1rem; margin-bottom: 0.75rem; border: 2px solid #f59e0b; border-radius: 12px; background: linear-gradient(135deg, rgba(245, 158, 11, 0.1) 0%, rgba(217, 119, 6, 0.05) 100%);">
        <div style="flex: 1;">
          <div style="display: flex; align-items: center; gap: 0.75rem; margin-bottom: 0.5rem;">
            <span style="font-weight: 700; font-size: 1.1rem; color: var(--text-primary);">OS #${os.order_number || os.id}</span>
            <span style="background: #f59e0b; color: white; padding: 0.25rem 0.5rem; border-radius: 4px; font-size: 0.75rem; font-weight: 600;">STANDBY</span>
          </div>
          <div style="color: var(--text-secondary); font-size: 0.875rem;">
            <p style="margin: 0.25rem 0;"><strong>Cliente:</strong> ${os.company_name || 'Não informado'}</p>
            <p style="margin: 0.25rem 0;"><strong>Técnico:</strong> ${os.technician_username || 'Não atribuído'}</p>
            <p style="margin: 0.25rem 0;"><strong>Data Standby:</strong> ${standbyDate}</p>
            <p style="margin: 0.25rem 0; color: #f59e0b;"><strong>Motivo:</strong> ${reason}</p>
          </div>
        </div>
        <div style="display: flex; flex-direction: column; gap: 0.5rem;">
          <button onclick="viewStandbyOS(${os.id})" class="btn-secondary" style="padding: 0.5rem 1rem; font-size: 0.875rem;">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="display: inline; vertical-align: middle; margin-right: 0.25rem;">
              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
              <circle cx="12" cy="12" r="3"/>
            </svg>
            Ver
          </button>
          <button onclick="returnStandbyToReview(${os.id})" class="btn-primary" style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); padding: 0.5rem 1rem; font-size: 0.875rem;">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="display: inline; vertical-align: middle; margin-right: 0.25rem;">
              <polyline points="1 4 1 10 7 10"/>
              <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/>
            </svg>
            Voltar para Conferência
          </button>
        </div>
      </div>
    `
  }).join('')

  container.innerHTML = html
}

/**
 * Visualiza detalhes de uma OS em Standby
 */
async function viewStandbyOS(osId) {
  try {
    const response = await fetch(`${API_URL}/api/review/${osId}`)
    if (!response.ok) {
      throw new Error('Erro ao carregar OS')
    }

    const os = await response.json()

    // Usa a modal de conferência para mostrar os dados (somente leitura)
    currentConferenceOS = os
    conferenceMaterials = os.materials || []
    conferenceWorklogs = os.worklogs || []
    conferenceDisplacements = os.displacements || []

    // Abre modal de conferência
    openConferenceModal(osId)

  } catch (error) {
    console.error('Erro ao visualizar OS:', error)
    showToast(error.message || 'Erro ao carregar OS', 'error')
  }
}

/**
 * Retorna uma OS de Standby para Conferência
 */
async function returnStandbyToReview(osId) {
  if (!confirm('Tem certeza que deseja retornar esta OS para conferência?')) {
    return
  }

  try {
    const response = await fetch(`${API_URL}/api/review/${osId}/return-to-review`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.message || 'Erro ao retornar OS')
    }

    showToast('OS retornada para conferência!', 'success')
    loadStandbyOS() // Recarrega lista de standby

  } catch (error) {
    console.error('Erro ao retornar OS:', error)
    showToast(error.message || 'Erro ao retornar OS para conferência', 'error')
  }
}

// ╔═══════════════════════════════════════════════════════════════════════════════╗
// ║                         SEÇÃO: OS ARQUIVADAS (CANCELADAS)                     ║
// ╚═══════════════════════════════════════════════════════════════════════════════╝

let archivedOSListCache = []

/**
 * Abre modal com lista de OS arquivadas (canceladas)
 */
async function openArchivedOSModal() {
  try {
    // Cria modal se não existir
    if (!document.getElementById('archivedOSModal')) {
      createArchivedOSModal()
    }

    // Mostra modal
    document.getElementById('archivedOSModal').style.display = 'flex'

    // Carrega dados
    await loadArchivedOS()

  } catch (error) {
    console.error('Erro ao abrir modal de OS arquivadas:', error)
    showToast('Erro ao carregar OS canceladas', 'error')
  }
}

/**
 * Cria modal de OS arquivadas
 */
function createArchivedOSModal() {
  const modalHTML = `
    <div id="archivedOSModal" class="modal" style="display: none;">
      <div class="modal-content" style="max-width: 900px; max-height: 90vh; overflow-y: auto;">
        <div class="modal-header" style="background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%); color: white; padding: 1.5rem; border-radius: 12px 12px 0 0;">
          <h2 style="margin: 0; display: flex; align-items: center; gap: 0.75rem;">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="10"/>
              <line x1="15" y1="9" x2="9" y2="15"/>
              <line x1="9" y1="9" x2="15" y2="15"/>
            </svg>
            OS Canceladas
          </h2>
          <button class="modal-close" onclick="closeArchivedOSModal()" style="background: rgba(255,255,255,0.2); border: none; color: white; font-size: 1.5rem; cursor: pointer; padding: 0.5rem; border-radius: 50%;">&times;</button>
        </div>
        <div id="archivedOSModalContent" class="modal-body" style="padding: 1.5rem;">
          <div style="text-align: center; padding: 2rem;">
            <div class="spinner"></div>
            <p>Carregando OS canceladas...</p>
          </div>
        </div>
        <div class="modal-footer" style="display: flex; justify-content: flex-end; padding: 1rem 1.5rem; border-top: 1px solid var(--border-color);">
          <button class="btn-secondary" onclick="closeArchivedOSModal()">Fechar</button>
        </div>
      </div>
    </div>
  `

  document.body.insertAdjacentHTML('beforeend', modalHTML)
}

/**
 * Fecha modal de OS arquivadas
 */
function closeArchivedOSModal() {
  const modal = document.getElementById('archivedOSModal')
  if (modal) {
    modal.style.display = 'none'
  }
}

/**
 * Carrega lista de OS arquivadas
 */
async function loadArchivedOS() {
  const container = document.getElementById('archivedOSModalContent')
  if (!container) return

  try {
    const response = await fetch(`${API_URL}/api/review/archived`)
    if (!response.ok) {
      throw new Error('Erro ao carregar OS arquivadas')
    }

    const osList = await response.json()
    archivedOSListCache = osList
    renderArchivedOSList(osList)

  } catch (error) {
    console.error('Erro ao carregar OS arquivadas:', error)
    container.innerHTML = `
      <div style="text-align: center; padding: 2rem; color: #ef4444;">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-bottom: 1rem;">
          <circle cx="12" cy="12" r="10"/>
          <line x1="12" y1="8" x2="12" y2="12"/>
          <line x1="12" y1="16" x2="12.01" y2="16"/>
        </svg>
        <p>Erro ao carregar OS canceladas</p>
        <button onclick="loadArchivedOS()" class="btn-secondary" style="margin-top: 1rem;">Tentar novamente</button>
      </div>
    `
  }
}

/**
 * Renderiza lista de OS arquivadas
 */
function renderArchivedOSList(osList) {
  const container = document.getElementById('archivedOSModalContent')
  if (!container) return

  if (!osList || osList.length === 0) {
    container.innerHTML = `
      <div style="text-align: center; padding: 3rem; color: var(--text-secondary);">
        <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="margin-bottom: 1rem; opacity: 0.5;">
          <path d="M21 8v13H3V8"/>
          <path d="M1 3h22v5H1z"/>
          <path d="M10 12h4"/>
        </svg>
        <p style="font-size: 1.1rem; margin: 0;">Nenhuma OS cancelada</p>
        <p style="font-size: 0.875rem; margin-top: 0.5rem; opacity: 0.7;">Todas as OS canceladas aparecerão aqui</p>
      </div>
    `
    return
  }

  // Campo de busca
  const searchHtml = `
    <div style="margin-bottom: 1rem;">
      <input
        type="text"
        id="archivedOSSearch"
        placeholder="Buscar por número da OS, cliente ou técnico..."
        oninput="filterArchivedOSList()"
        style="
          width: 100%;
          padding: 0.75rem;
          background: var(--bg-input);
          border: 1px solid var(--border-color);
          border-radius: 6px;
          color: var(--text-primary);
          font-size: 0.9rem;
        "
      />
    </div>
  `

  const html = osList.map(os => {
    // Tenta extrair motivo do cancelamento das observações
    let cancelReason = 'Não informado'
    if (os.observations) {
      const match = os.observations.match(/Arquivado:\s*(.+?)(?:\s*\||$)/)
      if (match) {
        cancelReason = match[1].trim()
      }
    }

    const finishedDate = os.finished_at ? new Date(os.finished_at).toLocaleDateString('pt-BR') : 'N/A'

    return `
      <div class="os-card" style="display: flex; justify-content: space-between; align-items: center; padding: 1rem; margin-bottom: 0.75rem; border: 2px solid #ef4444; border-radius: 12px; background: linear-gradient(135deg, rgba(239, 68, 68, 0.1) 0%, rgba(220, 38, 38, 0.05) 100%);">
        <div style="flex: 1;">
          <div style="display: flex; align-items: center; gap: 0.75rem; margin-bottom: 0.5rem;">
            <span style="font-weight: 700; font-size: 1.1rem; color: var(--text-primary);">OS #${os.order_number || os.id}</span>
            <span style="background: #ef4444; color: white; padding: 0.25rem 0.5rem; border-radius: 4px; font-size: 0.75rem; font-weight: 600;">CANCELADA</span>
          </div>
          <div style="color: var(--text-secondary); font-size: 0.875rem;">
            <p style="margin: 0.25rem 0;"><strong>Cliente:</strong> ${escapeHtml(os.company_name || 'Não informado')}</p>
            <p style="margin: 0.25rem 0;"><strong>Técnico:</strong> ${escapeHtml(os.technician_username || 'Não atribuído')}</p>
            <p style="margin: 0.25rem 0;"><strong>Data Finalização:</strong> ${finishedDate}</p>
            <p style="margin: 0.25rem 0; color: #ef4444;"><strong>Motivo:</strong> ${escapeHtml(cancelReason)}</p>
          </div>
        </div>
        <div style="display: flex; flex-direction: column; gap: 0.5rem;">
          <button onclick="restoreArchivedToReview(${os.id})" class="btn-primary" style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); padding: 0.5rem 1rem; font-size: 0.875rem; display: flex; align-items: center; gap: 0.5rem;">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="1 4 1 10 7 10"/>
              <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/>
            </svg>
            Restaurar
          </button>
        </div>
      </div>
    `
  }).join('')

  container.innerHTML = searchHtml + `
    <div id="archivedOSListContainer">
      ${html}
    </div>
    <div style="margin-top: 1rem; padding: 0.75rem; background: rgba(239, 68, 68, 0.1); border-radius: 8px; font-size: 0.875rem; color: var(--text-secondary);">
      <strong>Total:</strong> ${osList.length} OS cancelada(s)
    </div>
  `
}

/**
 * Filtra lista de OS arquivadas
 */
function filterArchivedOSList() {
  const searchInput = document.getElementById('archivedOSSearch')
  const searchTerm = (searchInput?.value || '').trim().toLowerCase()

  if (!searchTerm) {
    renderArchivedOSList(archivedOSListCache)
    return
  }

  const filtered = archivedOSListCache.filter(os => {
    const osNumber = String(os.order_number || os.id || '').toLowerCase()
    const companyName = (os.company_name || '').toLowerCase()
    const technicianName = (os.technician_username || '').toLowerCase()
    return osNumber.includes(searchTerm) ||
           companyName.includes(searchTerm) ||
           technicianName.includes(searchTerm)
  })

  // Re-renderiza apenas a lista, mantendo o campo de busca
  const listContainer = document.getElementById('archivedOSListContainer')
  if (listContainer && filtered.length > 0) {
    listContainer.innerHTML = filtered.map(os => {
      let cancelReason = 'Não informado'
      if (os.observations) {
        const match = os.observations.match(/Arquivado:\s*(.+?)(?:\s*\||$)/)
        if (match) {
          cancelReason = match[1].trim()
        }
      }
      const finishedDate = os.finished_at ? new Date(os.finished_at).toLocaleDateString('pt-BR') : 'N/A'

      return `
        <div class="os-card" style="display: flex; justify-content: space-between; align-items: center; padding: 1rem; margin-bottom: 0.75rem; border: 2px solid #ef4444; border-radius: 12px; background: linear-gradient(135deg, rgba(239, 68, 68, 0.1) 0%, rgba(220, 38, 38, 0.05) 100%);">
          <div style="flex: 1;">
            <div style="display: flex; align-items: center; gap: 0.75rem; margin-bottom: 0.5rem;">
              <span style="font-weight: 700; font-size: 1.1rem; color: var(--text-primary);">OS #${os.order_number || os.id}</span>
              <span style="background: #ef4444; color: white; padding: 0.25rem 0.5rem; border-radius: 4px; font-size: 0.75rem; font-weight: 600;">CANCELADA</span>
            </div>
            <div style="color: var(--text-secondary); font-size: 0.875rem;">
              <p style="margin: 0.25rem 0;"><strong>Cliente:</strong> ${escapeHtml(os.company_name || 'Não informado')}</p>
              <p style="margin: 0.25rem 0;"><strong>Técnico:</strong> ${escapeHtml(os.technician_username || 'Não atribuído')}</p>
              <p style="margin: 0.25rem 0;"><strong>Data Finalização:</strong> ${finishedDate}</p>
              <p style="margin: 0.25rem 0; color: #ef4444;"><strong>Motivo:</strong> ${escapeHtml(cancelReason)}</p>
            </div>
          </div>
          <div style="display: flex; flex-direction: column; gap: 0.5rem;">
            <button onclick="restoreArchivedToReview(${os.id})" class="btn-primary" style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); padding: 0.5rem 1rem; font-size: 0.875rem; display: flex; align-items: center; gap: 0.5rem;">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="1 4 1 10 7 10"/>
                <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/>
              </svg>
              Restaurar
            </button>
          </div>
        </div>
      `
    }).join('')
  } else if (listContainer) {
    listContainer.innerHTML = `
      <div style="text-align: center; padding: 2rem; color: var(--text-secondary);">
        <p>Nenhuma OS encontrada com esse filtro</p>
      </div>
    `
  }
}

/**
 * Restaura uma OS arquivada para conferência
 */
async function restoreArchivedToReview(osId) {
  if (!confirm('Tem certeza que deseja restaurar esta OS para conferência?\n\nEla voltará para a lista de OS aguardando conferência.')) {
    return
  }

  try {
    const response = await fetch(`${API_URL}/api/review/${osId}/restore-from-archived`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.message || 'Erro ao restaurar OS')
    }

    showToast('OS restaurada para conferência!', 'success')

    // Recarrega a lista de arquivadas
    await loadArchivedOS()

    // Recarrega os dados da conferência (para atualizar contadores)
    loadReviewData()

  } catch (error) {
    console.error('Erro ao restaurar OS:', error)
    showToast(error.message || 'Erro ao restaurar OS para conferência', 'error')
  }
}

// ========================================
// SEÇÃO: GARANTIA
// ========================================

/**
 * Carrega OS em Garantia
 */
async function loadWarrantyOS() {
  try {
    const response = await fetch(`${API_URL}/api/review/warranty`)
    if (!response.ok) {
      throw new Error('Erro ao carregar OS em garantia')
    }

    const osList = await response.json()
    renderWarrantyOSList(osList)

    // Atualiza contador
    const countEl = document.getElementById('warrantyCount')
    if (countEl) {
      countEl.textContent = osList.length
    }

  } catch (error) {
    console.error('Erro ao carregar garantia:', error)
    showToast(error.message || 'Erro ao carregar OS em garantia', 'error')
  }
}

/**
 * Renderiza lista de OS em Garantia
 */
function renderWarrantyOSList(osList) {
  const container = document.getElementById('warrantyOSList')
  if (!container) return

  if (!osList || osList.length === 0) {
    container.innerHTML = '<p class="empty-state">Nenhuma OS em garantia</p>'
    return
  }

  const html = osList.map(os => {
    const warrantyDate = os.warranty_at ? new Date(os.warranty_at).toLocaleDateString('pt-BR') : 'N/A'

    return `
      <div class="os-card" style="display: flex; justify-content: space-between; align-items: center; padding: 1rem; margin-bottom: 0.75rem; border: 2px solid #8b5cf6; border-radius: 12px; background: linear-gradient(135deg, rgba(139, 92, 246, 0.1) 0%, rgba(124, 58, 237, 0.05) 100%);">
        <div style="flex: 1;">
          <div style="display: flex; align-items: center; gap: 0.75rem; margin-bottom: 0.5rem;">
            <span style="font-weight: 700; font-size: 1.1rem; color: var(--text-primary);">OS #${os.order_number || os.id}</span>
            <span style="background: #8b5cf6; color: white; padding: 0.25rem 0.5rem; border-radius: 4px; font-size: 0.75rem; font-weight: 600;">GARANTIA</span>
          </div>
          <div style="color: var(--text-secondary); font-size: 0.875rem;">
            <p style="margin: 0.25rem 0;"><strong>Cliente:</strong> ${os.company_name || 'Não informado'}</p>
            <p style="margin: 0.25rem 0;"><strong>Técnico:</strong> ${os.technician_username || 'Não atribuído'}</p>
            <p style="margin: 0.25rem 0;"><strong>Data Garantia:</strong> ${warrantyDate}</p>
            ${os.service_description ? `<p style="margin: 0.25rem 0;"><strong>Serviço:</strong> ${os.service_description.substring(0, 100)}${os.service_description.length > 100 ? '...' : ''}</p>` : ''}
          </div>
        </div>
        <div style="display: flex; flex-direction: column; gap: 0.5rem;">
          <button onclick="viewWarrantyOS(${os.id})" class="btn-secondary" style="padding: 0.5rem 1rem; font-size: 0.875rem;">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="display: inline; vertical-align: middle; margin-right: 0.25rem;">
              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
              <circle cx="12" cy="12" r="3"/>
            </svg>
            Ver
          </button>
          <button onclick="returnWarrantyToReview(${os.id})" class="btn-primary" style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); padding: 0.5rem 1rem; font-size: 0.875rem;">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="display: inline; vertical-align: middle; margin-right: 0.25rem;">
              <polyline points="1 4 1 10 7 10"/>
              <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/>
            </svg>
            Voltar para Conferência
          </button>
        </div>
      </div>
    `
  }).join('')

  container.innerHTML = html
}

/**
 * Visualiza detalhes de uma OS em Garantia
 */
async function viewWarrantyOS(osId) {
  try {
    const response = await fetch(`${API_URL}/api/review/${osId}`)
    if (!response.ok) {
      throw new Error('Erro ao carregar OS')
    }

    const os = await response.json()

    // Usa a modal de conferência para mostrar os dados (somente leitura)
    currentConferenceOS = os
    conferenceMaterials = os.materials || []
    conferenceWorklogs = os.worklogs || []
    conferenceDisplacements = os.displacements || []

    // Abre modal de conferência
    openConferenceModal(osId)

  } catch (error) {
    console.error('Erro ao visualizar OS:', error)
    showToast(error.message || 'Erro ao carregar OS', 'error')
  }
}

/**
 * Retorna OS da Garantia para Conferência
 */
async function returnWarrantyToReview(osId) {
  if (!confirm('Deseja retornar esta OS para conferência?')) {
    return
  }

  try {
    const response = await fetch(`${API_URL}/api/review/${osId}/return-from-warranty`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.message || 'Erro ao retornar OS')
    }

    showToast('OS retornada para conferência!', 'success')
    loadWarrantyOS()
    loadReviewData()

  } catch (error) {
    console.error('Erro ao retornar OS:', error)
    showToast(error.message || 'Erro ao retornar OS para conferência', 'error')
  }
}

/**
 * Envia OS para Garantia
 */
async function sendToWarranty(osId) {
  if (!confirm('Deseja enviar esta OS para garantia?')) {
    return
  }

  try {
    const response = await fetch(`${API_URL}/api/review/${osId}/warranty`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.message || 'Erro ao enviar para garantia')
    }

    showToast('OS enviada para garantia!', 'success')
    closeConferenceModal()
    loadReviewData()

  } catch (error) {
    console.error('Erro ao enviar para garantia:', error)
    showToast(error.message || 'Erro ao enviar OS para garantia', 'error')
  }
}

// Compatibilidade com código antigo (apenas aliases)
const switchReviewTab = () => {} // Não usado mais (sem tabs)
const openReviewModal = openConferenceModal
const closeReviewModal = closeConferenceModal
const approveOS = approveConferenceOS
const rejectOS = archiveConferenceOS
