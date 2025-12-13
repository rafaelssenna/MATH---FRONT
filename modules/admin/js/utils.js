/**
 * ╔═══════════════════════════════════════════════════════════════════════════════╗
 * ║                         UTILITÁRIOS - ADMIN                                   ║
 * ╚═══════════════════════════════════════════════════════════════════════════════╝
 */

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
 */
function formatDateToLocalISO(date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  const hours = String(date.getHours()).padStart(2, '0')
  const minutes = String(date.getMinutes()).padStart(2, '0')
  const seconds = String(date.getSeconds()).padStart(2, '0')
  return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}.000Z`
}

/**
 * Converte string de data para Date tratando como horário local
 */
function parseAsLocalTime(dateString) {
  if (!dateString) return null
  const cleanDate = String(dateString).replace(/\.000Z$/,'').replace(/Z$/,'')
  return new Date(cleanDate)
}

/**
 * Converte horas decimais para formato legível (ex: 4.5 -> "4h 30min")
 */
function formatHours(decimalHours) {
  const num = parseFloat(decimalHours) || 0
  if (isNaN(num) || num === 0) return '0h'
  const hours = Math.floor(num)
  const minutes = Math.round((num - hours) * 60)
  if (minutes === 0) return `${hours}h`
  return `${hours}h ${minutes}min`
}

/**
 * Formata quantidade de material - mostra inteiro se não tiver decimais
 */
function formatQuantity(qty) {
  const num = parseFloat(qty) || 0
  return num % 1 === 0 ? String(Math.floor(num)) : String(num)
}

/**
 * Retorna feriados nacionais brasileiros para um ano específico
 */
function getBrazilianHolidays(year) {
  const holidays = new Set()

  // Feriados fixos
  holidays.add(`${year}-01-01`) // Ano Novo
  holidays.add(`${year}-04-21`) // Tiradentes
  holidays.add(`${year}-05-01`) // Dia do Trabalho
  holidays.add(`${year}-09-07`) // Independência
  holidays.add(`${year}-10-12`) // Nossa Senhora Aparecida
  holidays.add(`${year}-11-02`) // Finados
  holidays.add(`${year}-11-15`) // Proclamação da República
  holidays.add(`${year}-12-25`) // Natal

  // Feriados móveis (Páscoa e derivados)
  const calcEaster = (y) => {
    const a = y % 19
    const b = Math.floor(y / 100)
    const c = y % 100
    const d = Math.floor(b / 4)
    const e = b % 4
    const f = Math.floor((b + 8) / 25)
    const g = Math.floor((b - f + 1) / 3)
    const h = (19 * a + b - d - g + 15) % 30
    const i = Math.floor(c / 4)
    const k = c % 4
    const l = (32 + 2 * e + 2 * i - h - k) % 7
    const m = Math.floor((a + 11 * h + 22 * l) / 451)
    const month = Math.floor((h + l - 7 * m + 114) / 31)
    const day = ((h + l - 7 * m + 114) % 31) + 1
    return new Date(y, month - 1, day)
  }

  const easter = calcEaster(year)

  // Carnaval (47 dias antes da Páscoa)
  const carnavalTerca = new Date(easter)
  carnavalTerca.setDate(easter.getDate() - 47)
  const carnavalSegunda = new Date(carnavalTerca)
  carnavalSegunda.setDate(carnavalTerca.getDate() - 1)
  holidays.add(carnavalSegunda.toISOString().split('T')[0])
  holidays.add(carnavalTerca.toISOString().split('T')[0])

  // Sexta-feira Santa (2 dias antes da Páscoa)
  const sextaSanta = new Date(easter)
  sextaSanta.setDate(easter.getDate() - 2)
  holidays.add(sextaSanta.toISOString().split('T')[0])

  // Corpus Christi (60 dias após a Páscoa)
  const corpusChristi = new Date(easter)
  corpusChristi.setDate(easter.getDate() + 60)
  holidays.add(corpusChristi.toISOString().split('T')[0])

  return holidays
}

/**
 * Verifica se uma data é dia útil
 */
function isBusinessDay(date, holidays) {
  const dayOfWeek = date.getDay()
  if (dayOfWeek === 0 || dayOfWeek === 6) return false
  const dateStr = date.toISOString().split('T')[0]
  return !holidays.has(dateStr)
}

/**
 * Avança a data para o próximo dia útil se necessário
 */
function getNextBusinessDay(date, holidays) {
  const result = new Date(date)
  while (!isBusinessDay(result, holidays)) {
    result.setDate(result.getDate() + 1)
  }
  return result
}

/**
 * Calcula as datas de vencimento com base no valor total da OS
 */
function calculateDueDates(totalValue, baseDate = new Date()) {
  const value = Number(totalValue) || 0
  const base = new Date(baseDate)

  const currentYear = base.getFullYear()
  const holidays = new Set([
    ...getBrazilianHolidays(currentYear),
    ...getBrazilianHolidays(currentYear + 1)
  ])

  let dueDays = []
  if (value <= 700) {
    dueDays = [15]
  } else if (value <= 2000) {
    dueDays = [28]
  } else if (value <= 4000) {
    dueDays = [28, 56]
  } else {
    dueDays = [28, 56, 84]
  }

  return dueDays.map((days, idx) => {
    const dueDate = new Date(base)
    dueDate.setDate(base.getDate() + days)
    const businessDay = getNextBusinessDay(dueDate, holidays)
    return {
      parcela: idx + 1,
      totalParcelas: dueDays.length,
      days,
      date: businessDay,
      dateStr: businessDay.toLocaleDateString('pt-BR')
    }
  })
}

/**
 * Formata vencimentos para exibição no PDF
 */
function formatDueDatesForPDF(totalValue, baseDate = new Date()) {
  const dueDates = calculateDueDates(totalValue, baseDate)
  if (dueDates.length === 1) {
    return dueDates[0].dateStr
  }
  return dueDates.map(d => d.dateStr).join(' / ')
}

/**
 * Fetch com timeout para evitar requisições travadas
 */
async function fetchWithTimeout(url, options = {}, timeout = window.FETCH_TIMEOUT || 30000) {
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
      throw new Error('Requisição excedeu o tempo limite. Tente novamente.')
    }
    throw error
  }
}

/**
 * Wrapper para fetch que mostra erro ao usuário em caso de falha
 */
async function safeFetch(url, options = {}, errorMessage = 'Erro na requisição') {
  try {
    const response = await fetchWithTimeout(url, options)
    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Erro desconhecido')
      throw new Error(errorText || `Erro ${response.status}`)
    }
    return response
  } catch (error) {
    console.error(`[safeFetch] ${errorMessage}:`, error)
    showToast(errorMessage + ': ' + error.message, 'error')
    throw error
  }
}

// Exporta globalmente
window.debounce = debounce
window.escapeHtml = escapeHtml
window.formatDateToLocalISO = formatDateToLocalISO
window.parseAsLocalTime = parseAsLocalTime
window.formatHours = formatHours
window.formatQuantity = formatQuantity
window.getBrazilianHolidays = getBrazilianHolidays
window.isBusinessDay = isBusinessDay
window.getNextBusinessDay = getNextBusinessDay
window.calculateDueDates = calculateDueDates
window.formatDueDatesForPDF = formatDueDatesForPDF
window.fetchWithTimeout = fetchWithTimeout
window.safeFetch = safeFetch
