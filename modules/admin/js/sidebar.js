/**
 * ╔═══════════════════════════════════════════════════════════════════════════════╗
 * ║                         SIDEBAR E NAVEGAÇÃO - ADMIN                           ║
 * ╚═══════════════════════════════════════════════════════════════════════════════╝
 */

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
      document.body.style.overflow = 'hidden'
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
    document.body.style.overflow = ''
  }
}

/**
 * Configura a sidebar - fecha ao clicar em itens do menu (mobile)
 */
function setupSidebar() {
  const menuItems = document.querySelectorAll('.sidebar-menu .menu-group-items li')
  menuItems.forEach(item => {
    item.addEventListener('click', function() {
      if (window.innerWidth <= 1024) {
        closeSidebar()
      }
    })
  })
}

// Inicializa sidebar quando DOM estiver pronto
document.addEventListener('DOMContentLoaded', setupSidebar)

// Exporta globalmente
window.toggleSidebar = toggleSidebar
window.closeSidebar = closeSidebar
window.setupSidebar = setupSidebar
