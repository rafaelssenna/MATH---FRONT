/**
 * Utilitários de Segurança para o Frontend
 * Proteção contra XSS e outras vulnerabilidades
 */

/**
 * Escapa caracteres HTML para prevenir XSS
 * Use SEMPRE que inserir dados do usuário/API em innerHTML
 *
 * @param {string} unsafe - String que pode conter HTML malicioso
 * @returns {string} - String segura para usar em innerHTML
 *
 * @example
 * container.innerHTML = `<h3>${escapeHtml(company.name)}</h3>`;
 */
function escapeHtml(unsafe) {
  if (unsafe === null || unsafe === undefined) return '';
  return String(unsafe)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Escapa atributo HTML
 * Use para valores de atributos como href, src, onclick, etc.
 *
 * @param {string} unsafe - String para usar em atributo HTML
 * @returns {string} - String segura para atributos
 */
function escapeAttr(unsafe) {
  if (unsafe === null || unsafe === undefined) return '';
  return String(unsafe)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/`/g, '&#96;');
}

/**
 * Sanitiza URL para prevenir javascript: e data: injection
 *
 * @param {string} url - URL potencialmente insegura
 * @returns {string} - URL segura ou string vazia se inválida
 */
function sanitizeUrl(url) {
  if (!url || typeof url !== 'string') return '';

  const trimmed = url.trim().toLowerCase();

  // Bloqueia protocolos perigosos
  if (trimmed.startsWith('javascript:') ||
      trimmed.startsWith('data:') ||
      trimmed.startsWith('vbscript:')) {
    console.warn('[Security] URL bloqueada:', url.substring(0, 50));
    return '';
  }

  return url;
}

/**
 * Cria elemento de texto seguro (alternativa a innerHTML)
 *
 * @param {string} tag - Nome da tag HTML
 * @param {string} text - Texto a inserir (será escapado automaticamente)
 * @param {object} attrs - Atributos opcionais
 * @returns {HTMLElement}
 */
function createSafeElement(tag, text, attrs = {}) {
  const el = document.createElement(tag);
  el.textContent = text; // textContent é automaticamente seguro

  for (const [key, value] of Object.entries(attrs)) {
    if (key === 'href' || key === 'src') {
      el.setAttribute(key, sanitizeUrl(value));
    } else {
      el.setAttribute(key, value);
    }
  }

  return el;
}

/**
 * Fetch com timeout automático
 * Previne requisições que travam indefinidamente
 *
 * @param {string} url - URL para fetch
 * @param {object} options - Opções do fetch
 * @param {number} timeout - Timeout em ms (padrão 30s)
 * @returns {Promise<Response>}
 */
async function fetchWithTimeout(url, options = {}, timeout = 30000) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal
    });
    clearTimeout(timeoutId);
    return response;
  } catch (err) {
    clearTimeout(timeoutId);
    if (err.name === 'AbortError') {
      throw new Error(`Timeout: requisição demorou mais de ${timeout / 1000}s`);
    }
    throw err;
  }
}

/**
 * Mostra loading em um container
 * @param {HTMLElement} container - Container para mostrar loading
 * @param {string} message - Mensagem opcional
 */
function showLoading(container, message = 'Carregando...') {
  if (!container) return;
  container.innerHTML = `
    <div class="loading-state" style="text-align: center; padding: 2rem;">
      <div class="spinner" style="
        width: 40px; height: 40px;
        border: 3px solid #f3f3f3;
        border-top: 3px solid #3498db;
        border-radius: 50%;
        animation: spin 1s linear infinite;
        margin: 0 auto 1rem;
      "></div>
      <p>${escapeHtml(message)}</p>
    </div>
  `;
}

/**
 * Mostra erro em um container com botão de retry
 * @param {HTMLElement} container - Container para mostrar erro
 * @param {string} message - Mensagem de erro
 * @param {Function} retryFn - Função para tentar novamente
 */
function showError(container, message, retryFn = null) {
  if (!container) return;
  container.innerHTML = `
    <div class="error-state" style="text-align: center; padding: 2rem; color: #e74c3c;">
      <p>${escapeHtml(message)}</p>
      ${retryFn ? '<button class="btn-retry" style="margin-top: 1rem; padding: 0.5rem 1rem; cursor: pointer;">Tentar Novamente</button>' : ''}
    </div>
  `;

  if (retryFn) {
    const btn = container.querySelector('.btn-retry');
    if (btn) btn.onclick = retryFn;
  }
}

// Adiciona keyframe de animação para o spinner
if (!document.getElementById('security-utils-styles')) {
  const style = document.createElement('style');
  style.id = 'security-utils-styles';
  style.textContent = `
    @keyframes spin {
      0% { transform: rotate(0deg); }
      100% { transform: rotate(360deg); }
    }
  `;
  document.head.appendChild(style);
}

// Exporta globalmente (para uso em scripts inline e módulos)
window.escapeHtml = escapeHtml;
window.escapeAttr = escapeAttr;
window.sanitizeUrl = sanitizeUrl;
window.createSafeElement = createSafeElement;
window.fetchWithTimeout = fetchWithTimeout;
window.showLoading = showLoading;
window.showError = showError;
