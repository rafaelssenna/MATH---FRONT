// ===== MATH - Configuração Global =====

// API Base URL (compartilhada para todos os módulos)
const API_URL = 'https://hs-back-production-f54a.up.railway.app';

// Configuração do sistema
const MATH_CONFIG = {
    version: '1.0.0',
    name: 'MATH - Manutenção Assistida por Tecnologia Helsen',
    company: 'Helsen Service',
    modules: {
        technician: {
            name: 'Técnico',
            color: '#0b5ed7',
            icon: '👷'
        },
        client: {
            name: 'Cliente',
            color: '#28a745',
            icon: '🏢'
        },
        admin: {
            name: 'Administrador',
            color: '#dc3545',
            icon: '⚙️'
        }
    }
};

// Export para uso global
window.API_URL = API_URL;
window.MATH_CONFIG = MATH_CONFIG;

console.log('✅ MATH Config carregado');