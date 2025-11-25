// ===== MATH - Sistema de Roteamento Simplificado =====
// Versão otimizada: Redirecionamento direto sem iframe para máxima performance

// Configuração de módulos
const MODULES = {
    technician: {
        name: 'Técnico',
        path: './modules/technician/index.html',
        color: '#3b82f6',
        icon: '👷'
    },
    client: {
        name: 'Cliente',
        path: './modules/client/index.html',
        color: '#10b981',
        icon: '🏢'
    },
    admin: {
        name: 'Administrador',
        path: './modules/admin/index.html',
        color: '#dc2626',
        icon: '⚙️'
    }
};

/**
 * Seleciona o perfil e redireciona DIRETAMENTE para o módulo
 * Sem iframe = INSTANTÂNEO como os sistemas originais!
 */
function selectRole(role) {
    if (!MODULES[role]) {
        showToast('Perfil inválido', 'error');
        return;
    }

    const module = MODULES[role];

    // Salva o perfil selecionado
    localStorage.setItem('math_currentRole', role);
    localStorage.setItem('math_lastAccess', new Date().toISOString());

    // Adiciona timestamp para SEMPRE pegar versão mais recente (anti-cache)
    const cacheBuster = Date.now();
    const urlWithCache = `${module.path}?v=${cacheBuster}`;

    // Redireciona DIRETAMENTE (sem iframe = rápido!)
    window.location.href = urlWithCache;
}

/**
 * Mostra notificação toast
 */
function showToast(message, type = 'info') {
    const toast = document.getElementById('toast');
    if (!toast) return;

    toast.className = `toast ${type} show`;
    toast.textContent = message;

    setTimeout(() => {
        toast.classList.remove('show');
    }, 3000);
}

// ===== Animações de entrada =====
document.addEventListener('DOMContentLoaded', () => {
    // Adiciona animação de entrada aos cards
    setTimeout(() => {
        const header = document.querySelector('.welcome-header');
        if (header) header.style.opacity = '1';

        document.querySelectorAll('.role-card').forEach((card, index) => {
            setTimeout(() => {
                card.style.opacity = '1';
                card.style.transform = 'translateY(0)';
            }, index * 100);
        });
    }, 100);
});

console.log('🚀 MATH System - Direct Navigation Mode (Ultra Fast!)');