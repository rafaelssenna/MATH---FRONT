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

/**
 * Carrega dados de conferência (chamado ao abrir a seção)
 */
async function loadReviewData() {
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
    <div class="stat-card" style="background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); color: white; padding: 1.5rem; border-radius: 12px;">
      <div style="font-size: 0.875rem; opacity: 0.9; margin-bottom: 0.5rem;">Aguardando Conferência</div>
      <div style="font-size: 2rem; font-weight: 700;">${stats.pending || 0}</div>
    </div>
    <div class="stat-card" style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: white; padding: 1.5rem; border-radius: 12px;">
      <div style="font-size: 0.875rem; opacity: 0.9; margin-bottom: 0.5rem;">Aprovadas (Faturamento)</div>
      <div style="font-size: 2rem; font-weight: 700;">${stats.completed || 0}</div>
    </div>
    <div class="stat-card" style="background: linear-gradient(135deg, #6b7280 0%, #4b5563 100%); color: white; padding: 1.5rem; border-radius: 12px;">
      <div style="font-size: 0.875rem; opacity: 0.9; margin-bottom: 0.5rem;">Arquivadas</div>
      <div style="font-size: 2rem; font-weight: 700;">${stats.archived || 0}</div>
    </div>
  `
}

/**
 * Renderiza lista de OS para conferência
 */
function renderConferenceOSList(osList) {
  const container = document.getElementById('reviewOSList')
  if (!container) return

  // Atualiza título
  const title = document.getElementById('reviewListTitle')
  if (title) {
    title.textContent = 'OS Aguardando Conferência'
  }

  if (!osList || osList.length === 0) {
    container.innerHTML = `<p class="empty-state">Nenhuma OS aguardando conferência</p>`
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
      <!-- Informações Básicas (Somente Leitura) -->
      <div class="card" style="padding: 1.5rem; background: linear-gradient(135deg, #667eea22 0%, #764ba222 100%); border: 2px solid #667eea;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
          <h3 style="margin: 0; color: #667eea;">OS #${os.order_number || os.id}</h3>

          <!-- Toggle Cliente Novo/Antigo -->
          <div style="display: flex; align-items: center; gap: 0.75rem;">
            <span style="font-size: 0.875rem; font-weight: 600; color: var(--text-secondary);">Tipo de Cliente:</span>
            <button
              id="toggleClientTypeBtn"
              onclick="toggleClientType()"
              style="position: relative; width: 180px; height: 40px; border-radius: 20px; border: 2px solid ${os.is_new_client ? '#10b981' : '#6b7280'}; background: ${os.is_new_client ? 'linear-gradient(135deg, #10b981 0%, #059669 100%)' : 'linear-gradient(135deg, #6b7280 0%, #4b5563 100%)'}; color: white; font-weight: 700; font-size: 0.875rem; cursor: pointer; transition: all 0.3s ease; box-shadow: 0 2px 8px rgba(0,0,0,0.15);"
              title="Clique para alternar entre Cliente Novo e Cliente Antigo">
              ${os.is_new_client ? '🆕 CLIENTE NOVO' : '👤 CLIENTE ANTIGO'}
            </button>
          </div>
        </div>
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem;">
          <div style="position: relative;">
            <label style="font-size: 0.75rem; color: var(--text-secondary); display: block; margin-bottom: 0.25rem;">
              Cliente / Empresa *
            </label>
            <!-- Campo que mostra empresa selecionada -->
            <div
              id="conferenceCompanyDisplay"
              onclick="toggleCompanyDropdown()"
              style="width: 100%; padding: 0.5rem; background: var(--bg-input); border: 1px solid var(--border-color); border-radius: 6px; color: var(--text-primary); font-weight: 600; cursor: pointer; display: flex; justify-content: space-between; align-items: center;"
            >
              <span id="conferenceCompanyName">${escapeHtml(os.company_name || 'Selecione...')}</span>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="flex-shrink: 0;">
                <polyline points="6 9 12 15 18 9"/>
              </svg>
            </div>
            <!-- Dropdown com busca -->
            <div id="conferenceCompanyDropdown" style="display: none; position: absolute; top: 100%; left: 0; min-width: 350px; z-index: 1000; background: var(--bg-card); border: 1px solid var(--border-color); border-radius: 6px; margin-top: 4px; box-shadow: 0 4px 12px rgba(0,0,0,0.3);">
              <input
                type="text"
                id="conferenceCompanySearch"
                placeholder="Digite para buscar..."
                oninput="filterConferenceCompanies()"
                style="width: 100%; padding: 0.5rem; background: var(--bg-input); border: none; border-bottom: 1px solid var(--border-color); border-radius: 6px 6px 0 0; color: var(--text-primary);"
              />
              <select id="conferenceCompanySelect" onchange="onConferenceCompanyChange()" size="6" style="width: 100%; padding: 0.5rem; background: var(--bg-input); border: none; border-radius: 0 0 6px 6px; color: var(--text-primary); font-weight: 600;">
                ${renderCompanyOptions(os.company_id)}
              </select>
            </div>
          </div>
          <div>
            <label style="font-size: 0.75rem; color: var(--text-secondary); display: block; margin-bottom: 0.25rem;">Técnico</label>
            <div style="font-weight: 600;">${escapeHtml(os.technician_username || 'N/A')}</div>
          </div>
          <div>
            <label style="font-size: 0.75rem; color: var(--text-secondary); display: block; margin-bottom: 0.25rem;">Máquina *</label>
            <select id="conferenceMachineSelect" style="width: 100%; padding: 0.5rem; background: var(--bg-input); border: 1px solid var(--border-color); border-radius: 6px; color: var(--text-primary); font-weight: 600;">
              ${renderMachineOptions(os.company_id, os.machine_id)}
            </select>
          </div>
          <div>
            <label style="font-size: 0.75rem; color: var(--text-secondary); display: block; margin-bottom: 0.25rem;">Data Finalização</label>
            <div style="font-weight: 600;">${os.finished_at ? new Date(os.finished_at).toLocaleString('pt-BR') : 'N/A'}</div>
          </div>
          <div>
            <label style="font-size: 0.75rem; color: var(--text-secondary); display: block; margin-bottom: 0.25rem;">Tipo de Manutenção</label>
            <select id="conferenceMaintenanceType" style="width: 100%; padding: 0.5rem; background: var(--bg-input); border: 1px solid var(--border-color); border-radius: 6px; color: var(--text-primary); font-weight: 600;">
              <option value="">Selecione...</option>
              <option value="Manutenção Corretiva Eletroeletrônica" ${os.maintenance_type === 'Manutenção Corretiva Eletroeletrônica' ? 'selected' : ''}>Manutenção Corretiva Eletroeletrônica</option>
              <option value="Manutenção Corretiva Mecânica" ${os.maintenance_type === 'Manutenção Corretiva Mecânica' ? 'selected' : ''}>Manutenção Corretiva Mecânica</option>
              <option value="Manutenção Preventiva Eletroeletrônica" ${os.maintenance_type === 'Manutenção Preventiva Eletroeletrônica' ? 'selected' : ''}>Manutenção Preventiva Eletroeletrônica</option>
              <option value="Manutenção Preventiva Mecânica" ${os.maintenance_type === 'Manutenção Preventiva Mecânica' ? 'selected' : ''}>Manutenção Preventiva Mecânica</option>
              <option value="Entrega Técnica" ${os.maintenance_type === 'Entrega Técnica' ? 'selected' : ''}>Entrega Técnica</option>
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
        <input type="number" value="${m.quantity || 0}" onchange="updateMaterialQuantity(${idx}, this.value)" step="0.01" style="width: 100%; padding: 0.5rem; background: var(--bg-input); border: 1px solid var(--border-color); border-radius: 6px; color: var(--text-primary);" />
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
 * Renderiza lista de deslocamentos
 */
function renderConferenceDisplacements() {
  if (conferenceDisplacements.length === 0) {
    return `<p class="empty-state" style="margin: 0;">Nenhum deslocamento cadastrado</p>`
  }

  return conferenceDisplacements.map((d, idx) => {
    // Gera opções de veículos
    const vehicleOptions = conferenceVehicles.map(v =>
      `<option value="${v.id}" ${d.vehicle_id == v.id ? 'selected' : ''}>${escapeHtml(v.plate)}${v.name ? ' - ' + escapeHtml(v.name) : ''}</option>`
    ).join('')

    // KM Total só aparece se for acima de 100km
    const showKmTotal = d.km_option === 'acima_100km'

    return `
    <div style="display: grid; grid-template-columns: 1fr ${showKmTotal ? '1fr ' : ''}1fr auto; gap: 0.75rem; margin-bottom: 0.75rem; align-items: end;">
      <div>
        <label style="font-size: 0.75rem; color: var(--text-secondary);">Opção KM</label>
        <select onchange="updateDisplacementKmOption(${idx}, this.value)" style="width: 100%; padding: 0.5rem; background: var(--bg-input); border: 1px solid var(--border-color); border-radius: 6px; color: var(--text-primary);">
          <option value="ate_50km" ${d.km_option === 'ate_50km' ? 'selected' : ''}>Até 50 km</option>
          <option value="ate_100km" ${d.km_option === 'ate_100km' ? 'selected' : ''}>Até 100 km</option>
          <option value="acima_100km" ${d.km_option === 'acima_100km' ? 'selected' : ''}>Acima de 100 km</option>
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
  let km = 0

  // Determina KM baseado na opção
  if (displacement.km_total > 0 && displacement.km_option === 'acima_100km') {
    km = parseFloat(displacement.km_total)
  } else if (displacement.km_option === 'ate_50km') {
    km = 50
  } else if (displacement.km_option === 'ate_100km') {
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
  // Usa taxa baseada em cliente novo (175) ou antigo (150)
  const hourlyRate = isNewClient ? 175 : 150
  const hoursCost = totalHours * hourlyRate
  console.log('⏱️ Horas:', totalHours, '× Taxa:', hourlyRate, `(${isNewClient ? 'NOVO' : 'ANTIGO'})`, '=', hoursCost)

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

  // Campo: Custo de Horas (sempre aparece)
  fieldsHTML += `
    <div>
      <label style="font-size: 0.875rem; color: var(--text-secondary); display: block; margin-bottom: 0.5rem;">
        ⏱️ Custo de Horas
      </label>
      <div style="background: var(--bg-card); border: 1px solid var(--border-color); padding: 0.75rem; border-radius: 8px; font-size: 1.125rem; font-weight: 600; color: var(--text-primary);">
        ${formatter.format(hoursCost)}
      </div>
      <div style="font-size: 0.75rem; color: var(--text-secondary); margin-top: 0.25rem;">
        ${totalHours.toFixed(2)}h × ${formatter.format(hourlyRate)}/h
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

  // Recalcula todos os valores automaticamente
  recalculateConferenceTotals()

  // Mostra mensagem de feedback
  showToast(
    `Cliente alterado para ${isNew ? 'NOVO (R$ 175/h)' : 'ANTIGO (R$ 150/h)'}. Valores recalculados!`,
    'success'
  )
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
}

/**
 * Aprova OS e envia para faturamento
 */
async function approveConferenceOS() {
  if (!currentConferenceOS) {
    showToast('Nenhuma OS selecionada', 'error')
    return
  }

  if (!confirm(`Confirma a aprovação da OS #${currentConferenceOS.order_number || currentConferenceOS.id}?\n\nEla será enviada para faturamento.`)) {
    return
  }

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
    const hourlyRate = isNewClient ? 175 : 150
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
        value_service: totalAdditionalServices, // Soma dos serviços adicionais
        total_service_cost: totalServiceCost,
        total_material_cost: totalMaterials,
        grand_total: grandTotal,
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
  }
}

/**
 * Arquiva OS
 */
async function archiveConferenceOS() {
  if (!currentConferenceOS) {
    showToast('Nenhuma OS selecionada', 'error')
    return
  }

  const reason = prompt(`Por que você deseja arquivar a OS #${currentConferenceOS.order_number || currentConferenceOS.id}?\n\n(Ela não será faturada, mas será mantida no sistema)`)

  if (!reason || reason.trim() === '') {
    showToast('Você deve informar o motivo do arquivamento', 'error')
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
      throw new Error(error.message || 'Erro ao arquivar OS')
    }

    showToast(`OS #${currentConferenceOS.order_number || currentConferenceOS.id} arquivada com sucesso.`, 'success')
    closeConferenceModal()
    loadReviewData()
  } catch (error) {
    console.error('Erro ao arquivar OS:', error)
    showToast(error.message || 'Erro ao arquivar OS', 'error')
  }
}

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
        <div class="modal-footer" style="display: flex; gap: 1rem; justify-content: space-between;">
          <button class="btn-secondary" onclick="archiveConferenceOS()" style="background: #6b7280; color: white;">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="display: inline; vertical-align: middle; margin-right: 0.5rem;">
              <polyline points="21 8 21 21 3 21 3 8"/>
              <rect x="1" y="3" width="22" height="5"/>
              <line x1="10" y1="12" x2="14" y2="12"/>
            </svg>
            Arquivar
          </button>
          <div style="display: flex; gap: 1rem;">
            <button class="btn-secondary" onclick="closeConferenceModal()">Cancelar</button>
            <button class="btn-primary" onclick="approveConferenceOS()" style="background: linear-gradient(135deg, #10b981 0%, #059669 100%);">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="display: inline; vertical-align: middle; margin-right: 0.5rem;">
                <polyline points="20 6 9 17 4 12"/>
              </svg>
              Aprovar e Enviar para Faturamento
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

// Compatibilidade com código antigo (apenas aliases)
const switchReviewTab = () => {} // Não usado mais (sem tabs)
const openReviewModal = openConferenceModal
const closeReviewModal = closeConferenceModal
const approveOS = approveConferenceOS
const rejectOS = archiveConferenceOS
