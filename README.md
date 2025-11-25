# MATH - Manutenção Assistida por Tecnologia Helsen

Sistema unificado COMPLETO de gestão de manutenção da Helsen Service.

## 🚀 Visão Geral

O MATH é a unificação completa dos 3 sistemas da Helsen Service em uma única aplicação:
- **Sistema Técnico**: Gestão de ordens de serviço
- **Sistema Cliente**: Solicitação de manutenções
- **Sistema Admin**: Gerenciamento completo

## 📂 Estrutura Completa

```
Novo front/
├── index.html              # Página inicial com seleção de perfil
├── app.js                  # Roteador principal do sistema
├── styles.css              # Estilos da página de seleção
├── README.md               # Este arquivo
│
├── assets/                 # Recursos visuais compartilhados
│   ├── helsenservicelogo.png
│   ├── logohelsenbranca.png
│   └── mate-icon.jpg
│
├── shared/                 # Código compartilhado entre módulos
│   └── config.js          # Configuração global do sistema
│
└── modules/               # SISTEMAS COMPLETOS INTEGRADOS
    ├── technician/        # Sistema Técnico COMPLETO
    │   ├── index.html
    │   ├── tecnico.js     # Lógica principal (145KB)
    │   ├── styles.css
    │   ├── state-manager.js
    │   ├── company-info.js
    │   ├── helsenservicelogo.png
    │   ├── logohelsenbranca.png
    │   └── mate-icon.jpg
    │
    ├── client/           # Sistema Cliente COMPLETO
    │   ├── index.html
    │   ├── cliente.js    # Lógica principal (81KB)
    │   ├── styles.css
    │   ├── state-manager.js
    │   ├── helsenservicelogo.png
    │   └── logohelsenbranca.png
    │
    └── admin/            # Sistema Admin COMPLETO
        ├── index.html
        ├── administrativo.js  # Lógica principal (275KB)
        ├── styles.css
        ├── state-manager.js
        ├── review-functions.js
        ├── helsenservicelogo.png
        ├── logohelsen.png
        └── logohelsenbranca.png
```

## ✅ Recursos Completos

### Sistema Técnico
- Login de técnicos
- Gestão de ordens de serviço
- Chat em tempo real
- Tracking de deslocamentos (incluindo "Não houve deslocamento")
- Sistema offline (state-manager)
- Informações da empresa

### Sistema Cliente
- Login via CNPJ
- Solicitação de manutenções
- Acompanhamento de status
- Histórico de solicitações
- Sistema offline (state-manager)

### Sistema Admin
- Dashboard administrativo
- Criação e gestão de OS
- Gerenciamento de técnicos
- Gerenciamento de clientes
- Relatórios e PDFs
- Review de solicitações
- Sistema offline (state-manager)

## 🔧 Tecnologias

- **Frontend**: HTML, CSS, JavaScript puro (Vanilla JS)
- **Comunicação**: WebSocket (Socket.IO)
- **PDF**: jsPDF para geração de documentos
- **Backend**: API REST (https://hs-back-production-f54a.up.railway.app)
- **Armazenamento**: LocalStorage para cache e offline

## 📋 Como Funciona

1. **Página Inicial**: Seleção entre os 3 perfis disponíveis
2. **Carregamento**: Cada sistema é carregado em iframe isolado
3. **Isolamento**: Cada módulo mantém sua independência total
4. **Recursos**: Todos os arquivos necessários estão incluídos

## 🚦 Navegação

- **ESC**: Volta para seleção de perfil
- **Alt + 1**: Acesso rápido ao módulo Técnico
- **Alt + 2**: Acesso rápido ao módulo Cliente
- **Alt + 3**: Acesso rápido ao módulo Admin

## 🔒 Autenticação

- Cada módulo mantém sua autenticação independente
- Tokens JWT salvos em localStorage
- Auto-login se já autenticado
- Sessões isoladas por módulo

## 💻 Desenvolvimento

### Para rodar localmente:
1. Abra `index.html` em um navegador
2. Ou use servidor local: `python -m http.server 8000`

### Para testar:
- Técnico: usuário `tecnico1`, senha `senha123`
- Cliente: CNPJ `12345678000190`, senha `senha123`
- Admin: usuário `admin`, senha `admin123`

## 🎯 Vantagens do Sistema Unificado

1. **Completo**: TODOS os arquivos dos 3 sistemas incluídos
2. **Independente**: Cada módulo funciona isoladamente
3. **Manutenível**: Estrutura organizada e clara
4. **Performático**: Carregamento sob demanda via iframe
5. **Seguro**: Isolamento entre módulos

## 📝 Notas Importantes

- **Sistema 100% Completo**: Todos os arquivos necessários incluídos
- **Sem Dependências Externas**: Exceto CDNs (Socket.IO, jsPDF)
- **Compatibilidade Total**: Mantém funcionalidade original
- **Vanilla JavaScript**: Sem frameworks ou build process

## 🔄 Atualizações Recentes

- ✅ Opção "Não houve deslocamento" implementada
- ✅ Sistemas completamente integrados
- ✅ Estrutura unificada com todos os recursos
- ✅ Todos os arquivos necessários incluídos

## 📞 Backend API

URL: `https://hs-back-production-f54a.up.railway.app`

Endpoints principais:
- `/api/technicians/login` - Login técnico
- `/api/clients/login` - Login cliente
- `/api/admin/login` - Login admin
- `/api/os` - Gestão de ordens de serviço
- `/api/requests` - Solicitações de manutenção

---

**MATH v1.0.0** - Sistema Unificado COMPLETO Helsen Service