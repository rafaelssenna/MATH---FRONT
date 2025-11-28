// ===================================
// CONFIGURAÇÃO PARA TESTES LOCAIS
// ===================================
// Para usar este arquivo, renomeie para config.js
// ou mude o import no HTML para config.local.js
// ===================================

// API Base URL - Aponta para servidor local
const API_URL = 'http://localhost:3000';

// Configuração do sistema
const MATH_CONFIG = {
    version: '1.0.0-local',
    name: 'MATH - Manutenção Assistida por Tecnologia Helsen (LOCAL)',
    company: 'Helsen Service',
    environment: 'development',
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

console.log('🔧 MATH Config LOCAL carregado - Ambiente de TESTE');
console.log('📡 API URL:', API_URL);
