/**
 * ╔═══════════════════════════════════════════════════════════════════════════════╗
 * ║                    CONFIGURAÇÕES GLOBAIS - ADMIN                              ║
 * ╚═══════════════════════════════════════════════════════════════════════════════╝
 */

// URL base da API do backend (Railway)
const API_URL = "https://hs-back-production-f54a.up.railway.app"

// Cache de dados para evitar requisições repetidas
let cachedTechnicians = []
let cachedCompanies = []

// Sistema de rotas com URLs amigáveis
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

// OS atualmente visualizada (para PDF, edição, etc)
let currentOS = null

// Timeout padrão para requisições fetch (30 segundos)
const FETCH_TIMEOUT = 30000

// Exporta globalmente
window.API_URL = API_URL
window.ROUTES = ROUTES
window.SECTION_TO_ROUTE = SECTION_TO_ROUTE
window.FETCH_TIMEOUT = FETCH_TIMEOUT
