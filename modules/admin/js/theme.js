/**
 * ╔═══════════════════════════════════════════════════════════════════════════════╗
 * ║                         TEMA E APARÊNCIA - ADMIN                              ║
 * ╚═══════════════════════════════════════════════════════════════════════════════╝
 */

/**
 * Atualiza logos baseado no tema atual
 */
function updateLogos() {
  const theme = document.documentElement.getAttribute('data-theme') || 'dark'
  const headerLogo = document.querySelector('.logo-image')
  const loadingLogo = document.getElementById('loadingLogo')

  // Define qual logo usar baseado no tema
  const logoSrc = theme === 'light' ? 'helsenservicelogo-dark.png' : 'helsenservicelogo.png'

  if (headerLogo) headerLogo.src = logoSrc
  if (loadingLogo) loadingLogo.src = logoSrc
}

/**
 * Inicializa o toggle de tema
 */
function initializeTheme() {
  const themeToggle = document.getElementById('themeToggle')
  if (!themeToggle) return

  const savedTheme = localStorage.getItem('theme') || 'dark'
  document.documentElement.setAttribute('data-theme', savedTheme)
  updateLogos()

  themeToggle.addEventListener('click', () => {
    const currentTheme = document.documentElement.getAttribute('data-theme')
    const newTheme = currentTheme === 'light' ? 'dark' : 'light'
    document.documentElement.setAttribute('data-theme', newTheme)
    localStorage.setItem('theme', newTheme)
    updateLogos()
  })
}

/**
 * Esconde a tela de loading
 */
function hideLoadingScreen() {
  const loadingScreen = document.getElementById('loadingScreen')
  if (loadingScreen) {
    loadingScreen.classList.add('hidden')
  }
}

// Exporta globalmente
window.updateLogos = updateLogos
window.initializeTheme = initializeTheme
window.hideLoadingScreen = hideLoadingScreen
