/**
 * ╔═══════════════════════════════════════════════════════════════════════════════╗
 * ║                         TOAST NOTIFICATIONS - ADMIN                           ║
 * ╚═══════════════════════════════════════════════════════════════════════════════╝
 */

/**
 * Exibe uma notificação na área de toast
 * @param {string} message Mensagem a ser exibida
 * @param {string} type Tipo: success, error, warning, info
 */
function showToast(message, type = "success") {
  const toast = document.getElementById("toast")
  if (!toast) return

  toast.textContent = message
  toast.className = `toast ${type} show`

  // Auto-hide após 3 segundos
  setTimeout(() => {
    toast.classList.remove("show")
  }, 3000)
}

// Exporta globalmente
window.showToast = showToast
