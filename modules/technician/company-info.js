/**
 * Funções para carregar e exibir informações da empresa
 */

/**
 * Carrega informações da empresa e preenche os campos do modal
 * @param {number} companyId - ID da empresa
 * @param {string} requester - Nome do solicitante
 */
async function loadCompanyInfo(companyId, requester) {
  try {
    // Busca dados da empresa
    if (companyId) {
      const response = await fetch(`${API_URL}/api/companies/${companyId}`)
      if (response.ok) {
        const company = await response.json()
        
        // Preenche nome da empresa
        const companyNameEl = document.getElementById('companyNameInfo')
        if (companyNameEl) {
          companyNameEl.textContent = company.name || '-'
        }
        
        // Monta endereço completo
        const addressEl = document.getElementById('companyAddressInfo')
        if (addressEl) {
          const addressParts = []
          if (company.address) addressParts.push(company.address)
          if (company.bairro) addressParts.push(company.bairro)
          if (company.localidade) addressParts.push(company.localidade)
          if (company.cep) addressParts.push(`CEP: ${company.cep}`)
          if (company.uf) addressParts.push(company.uf)
          
          const fullAddress = addressParts.length > 0 ? addressParts.join(', ') : '-'
          addressEl.textContent = fullAddress
          
          // Se tiver endereço, torna clicável para abrir no Google Maps
          if (fullAddress !== '-') {
            addressEl.style.cursor = 'pointer'
            addressEl.style.textDecoration = 'underline'
            addressEl.style.color = 'var(--primary-blue)'
            addressEl.title = 'Clique para abrir no Google Maps'
            addressEl.onclick = () => {
              const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(fullAddress)}`
              window.open(mapsUrl, '_blank')
            }
          }
        }
        
        // Preenche telefone (prioriza phone1, senão phone2)
        const phoneEl = document.getElementById('companyPhoneInfo')
        if (phoneEl) {
          const phone = company.phone1 || company.phone2 || '-'
          phoneEl.textContent = phone
          // Se tiver telefone, torna clicável para ligar
          if (phone !== '-') {
            phoneEl.style.cursor = 'pointer'
            phoneEl.style.textDecoration = 'underline'
            phoneEl.style.color = 'var(--primary-blue)'
            phoneEl.title = 'Clique para ligar'
            phoneEl.onclick = () => {
              window.location.href = `tel:${phone.replace(/\D/g, '')}`
            }
          }
        }
      }
    }
    
    // Preenche solicitante ou mostra campo de input
    const requesterEl = document.getElementById('requesterInfo')
    const requesterDisplayContainer = document.getElementById('requesterDisplayContainer')
    const requesterInputContainer = document.getElementById('requesterInputContainer')
    const requesterInput = document.getElementById('requesterInput')

    if (requester) {
      // Tem solicitante (veio de solicitação do cliente) - mostra apenas o texto
      if (requesterDisplayContainer) requesterDisplayContainer.style.display = 'block'
      if (requesterInputContainer) requesterInputContainer.style.display = 'none'
      if (requesterEl) requesterEl.textContent = requester
      if (requesterInput) requesterInput.value = ''
    } else {
      // Não tem solicitante (OS aberta pelo técnico) - mostra campo para preencher
      if (requesterDisplayContainer) requesterDisplayContainer.style.display = 'none'
      if (requesterInputContainer) requesterInputContainer.style.display = 'block'
      if (requesterInput) requesterInput.value = ''
    }
  } catch (err) {
    console.error('Erro ao carregar informações da empresa:', err)
    clearCompanyInfo()
  }
}

/**
 * Limpa as informações da empresa
 */
function clearCompanyInfo() {
  const companyNameEl = document.getElementById('companyNameInfo')
  const addressEl = document.getElementById('companyAddressInfo')
  const phoneEl = document.getElementById('companyPhoneInfo')
  const requesterEl = document.getElementById('requesterInfo')
  const requesterDisplayContainer = document.getElementById('requesterDisplayContainer')
  const requesterInputContainer = document.getElementById('requesterInputContainer')
  const requesterInput = document.getElementById('requesterInput')

  if (companyNameEl) companyNameEl.textContent = '-'
  if (addressEl) {
    addressEl.textContent = '-'
    addressEl.style.cursor = 'default'
    addressEl.style.textDecoration = 'none'
    addressEl.onclick = null
  }
  if (phoneEl) {
    phoneEl.textContent = '-'
    phoneEl.style.cursor = 'default'
    phoneEl.style.textDecoration = 'none'
    phoneEl.onclick = null
  }
  if (requesterEl) requesterEl.textContent = '-'
  // Reset requester containers
  if (requesterDisplayContainer) requesterDisplayContainer.style.display = 'block'
  if (requesterInputContainer) requesterInputContainer.style.display = 'none'
  if (requesterInput) requesterInput.value = ''
}

/**
 * Carrega informações da empresa para o modal de preview
 * @param {number} companyId - ID da empresa
 * @param {string} requester - Nome do solicitante
 */
async function loadCompanyInfoForPreview(companyId, requester) {
  const companyNameEl = document.getElementById('previewCompanyName')
  const addressEl = document.getElementById('previewAddress')
  const phoneEl = document.getElementById('previewPhone')
  const requesterEl = document.getElementById('previewRequester')
  
  try {
    if (!companyId) {
      if (companyNameEl) companyNameEl.textContent = 'Não informado'
      if (addressEl) addressEl.textContent = 'Não informado'
      if (phoneEl) phoneEl.textContent = 'Não informado'
      if (requesterEl) requesterEl.textContent = requester || 'Não informado'
      return
    }
    
    const response = await fetch(`${API_URL}/api/companies/${companyId}`)
    if (!response.ok) {
      if (companyNameEl) companyNameEl.textContent = 'Erro ao carregar'
      if (addressEl) addressEl.textContent = 'Erro ao carregar'
      if (phoneEl) phoneEl.textContent = 'Erro ao carregar'
      if (requesterEl) requesterEl.textContent = requester || 'Não informado'
      return
    }
    
    const company = await response.json()
    
    // Nome da empresa
    if (companyNameEl) {
      companyNameEl.textContent = company.name || 'Não informado'
    }
    
    // Monta endereço completo
    const addressParts = []
    if (company.address) addressParts.push(company.address)
    if (company.bairro) addressParts.push(company.bairro)
    if (company.localidade) addressParts.push(company.localidade)
    if (company.cep) addressParts.push(`CEP: ${company.cep}`)
    if (company.uf) addressParts.push(company.uf)
    const fullAddress = addressParts.length > 0 ? addressParts.join(', ') : 'Não informado'
    
    // Monta HTML com as informações
    let infoHTML = `
      <div style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.75rem;">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
          <circle cx="12" cy="10" r="3"/>
        </svg>
        <strong style="font-size: 0.9rem; color: var(--text-primary);">Informações da Empresa</strong>
      </div>
      <div style="font-size: 0.85rem; line-height: 1.8;">
        <p style="margin: 0.5rem 0; display: flex; align-items: start; gap: 0.5rem;">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="flex-shrink: 0; margin-top: 2px;">
            <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
            <circle cx="12" cy="10" r="3"/>
          </svg>
          <span style="flex: 1;">
            <strong style="color: var(--text-secondary);">Endereço:</strong><br>
            ${fullAddress !== 'Não informado' 
              ? `<span style="color: var(--primary-blue); cursor: pointer; text-decoration: underline;" onclick="window.open('https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(fullAddress)}', '_blank')" title="Clique para abrir no Google Maps">${fullAddress}</span>`
              : '<span style="color: var(--text-secondary);">Não informado</span>'
            }
          </span>
        </p>
        <p style="margin: 0.5rem 0; display: flex; align-items: center; gap: 0.5rem;">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="flex-shrink: 0;">
            <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/>
          </svg>
          <span style="flex: 1;">
            <strong style="color: var(--text-secondary);">Telefone:</strong> 
            ${company.phone1 || company.phone2 || 'Não informado'}
          </span>
        </p>
        ${requester ? `<p style="margin: 0.5rem 0; display: flex; align-items: center; gap: 0.5rem;">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="flex-shrink: 0;">
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
            <circle cx="12" cy="7" r="4"/>
          </svg>
          <span style="flex: 1;">
            <strong style="color: var(--text-secondary);">Solicitante:</strong> ${requester}
          </span>
        </p>` : ''}
      </div>
    `;
    
    if (addressEl) {
      addressEl.innerHTML = infoHTML;
    }
    
    // Telefone
    const phone = company.phone1 || company.phone2 || 'Não informado'
    if (phoneEl) {
      phoneEl.innerHTML = phone !== 'Não informado'
        ? `<span style="color: var(--primary-blue); cursor: pointer; text-decoration: underline;" onclick="window.location.href='tel:${phone.replace(/\D/g, '')}'" title="Clique para ligar">${phone}</span>`
        : 'Não informado'
    }
    
    // Solicitante
    if (requesterEl) {
      requesterEl.textContent = requester || 'Não informado'
    }
  } catch (err) {
    console.error('Erro ao carregar informações da empresa:', err)
    if (companyNameEl) companyNameEl.textContent = 'Erro ao carregar'
    if (addressEl) addressEl.textContent = 'Erro ao carregar'
    if (phoneEl) phoneEl.textContent = 'Erro ao carregar'
    if (requesterEl) requesterEl.textContent = requester || 'Não informado'
  }
}
