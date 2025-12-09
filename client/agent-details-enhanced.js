// Enhanced Agent Details Modal
// Replace the showAgentDetails function in app-simple.js with this version

async function showAgentDetails(id) {
  try {
    const response = await fetchWithAuth(`/api/agents/${id}`);
    const agent = await response.json();

    const html = `
      <div class="modal modal-open">
        <div class="modal-box max-w-5xl max-h-[90vh] overflow-y-auto">
          <div class="flex justify-between items-start mb-6">
            <div>
              <h3 class="font-bold text-3xl text-gray-800">${agent.name || ''} ${agent.lastName || ''}</h3>
              <p class="text-sm text-gray-500 mt-1">${agent.role || 'Mäklare'} ${agent.company ? 'på ' + agent.company : ''}</p>
              ${agent.brand ? `<p class="text-sm text-gray-400 mt-1">${agent.brand}</p>` : ''}
            </div>
            <button onclick="closeModal()" class="btn btn-sm btn-circle">✕</button>
          </div>

          <div class="divider my-4"></div>

          <div class="grid grid-cols-3 gap-6">
            <!-- Column 1: Basic Info -->
            <div class="space-y-4">
              <h4 class="font-semibold text-lg text-gray-700 mb-3">Grunduppgifter</h4>

              <div>
                <label class="text-sm font-medium text-gray-500 uppercase tracking-wide">Namn</label>
                <p class="text-base mt-1 font-medium">${agent.name || ''} ${agent.lastName || ''}</p>
              </div>

              <div>
                <label class="text-sm font-medium text-gray-500 uppercase tracking-wide">Registreringstyp</label>
                <p class="text-base mt-1">${agent.registrationType || '-'}</p>
              </div>

              <div>
                <label class="text-sm font-medium text-gray-500 uppercase tracking-wide">Roll</label>
                <p class="text-base mt-1">${agent.role || '-'}</p>
              </div>

              <div>
                <label class="text-sm font-medium text-gray-500 uppercase tracking-wide">Status</label>
                <div class="mt-1">
                  <span class="px-3 py-1 inline-flex text-sm font-semibold rounded-full ${getStatusBadgeClass(agent.status)}">
                    ${agent.status || 'aktiv'}
                  </span>
                </div>
              </div>

              <div>
                <label class="text-sm font-medium text-gray-500 uppercase tracking-wide">Licenstyp</label>
                <p class="text-base mt-1">${agent.licenseType || '-'}</p>
              </div>
            </div>

            <!-- Column 2: Company & Contact -->
            <div class="space-y-4">
              <h4 class="font-semibold text-lg text-gray-700 mb-3">Företag & Kontakt</h4>

              <div>
                <label class="text-sm font-medium text-gray-500 uppercase tracking-wide">Företag</label>
                <p class="text-base mt-1 font-medium">${agent.company || '-'}</p>
              </div>

              <div>
                <label class="text-sm font-medium text-gray-500 uppercase tracking-wide">Varumärke</label>
                <p class="text-base mt-1">${agent.brand || '-'}</p>
              </div>

              <div>
                <label class="text-sm font-medium text-gray-500 uppercase tracking-wide">E-post</label>
                <p class="text-base mt-1">${agent.email ? '<a href="mailto:' + agent.email + '" class="text-blue-600 hover:text-blue-800">' + agent.email + '</a>' : '-'}</p>
              </div>

              <div>
                <label class="text-sm font-medium text-gray-500 uppercase tracking-wide">Telefon</label>
                <p class="text-base mt-1">${agent.phone ? '<a href="tel:' + agent.phone + '" class="text-blue-600 hover:text-blue-800">' + agent.phone + '</a>' : '-'}</p>
              </div>

              <div>
                <label class="text-sm font-medium text-gray-500 uppercase tracking-wide">Adress</label>
                <p class="text-base mt-1">${agent.address || ''}</p>
                <p class="text-sm text-gray-600">${agent.postalCode || ''} ${agent.city || ''}</p>
              </div>

              <div>
                <label class="text-sm font-medium text-gray-500 uppercase tracking-wide">Kontor</label>
                <p class="text-base mt-1">${agent.office || '-'}</p>
              </div>
            </div>

            <!-- Column 3: Broker Package & Products -->
            <div class="space-y-4">
              <h4 class="font-semibold text-lg text-gray-700 mb-3">Mäklarpaket</h4>

              ${agent.brokerPackage ? `
                <div>
                  <label class="text-sm font-medium text-gray-500 uppercase tracking-wide">Användare</label>
                  <p class="text-base mt-1">${agent.brokerPackage.userId || '-'}</p>
                </div>

                <div>
                  <label class="text-sm font-medium text-gray-500 uppercase tracking-wide">MSN Namn</label>
                  <p class="text-base mt-1">${agent.brokerPackage.msnName || '-'}</p>
                </div>

                <div>
                  <label class="text-sm font-medium text-gray-500 uppercase tracking-wide">Aktiv</label>
                  <p class="text-base mt-1">
                    <span class="px-2 py-1 text-xs font-semibold rounded ${agent.brokerPackage.active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}">
                      ${agent.brokerPackage.active ? 'Ja' : 'Nej'}
                    </span>
                  </p>
                </div>

                <div>
                  <label class="text-sm font-medium text-gray-500 uppercase tracking-wide">Kostnad</label>
                  <p class="text-base mt-1 font-medium">${agent.brokerPackage.totalCost ? agent.brokerPackage.totalCost + ' kr' : '-'}</p>
                  ${agent.brokerPackage.discount ? `<p class="text-sm text-gray-600">Rabatt: ${agent.brokerPackage.discount} kr</p>` : ''}
                </div>
              ` : '<p class="text-gray-500 italic">Ingen mäklarpaket-information</p>'}

              ${agent.products && agent.products.length > 0 ? `
                <div class="mt-6">
                  <label class="text-sm font-medium text-gray-500 uppercase tracking-wide">Produkter</label>
                  <div class="mt-2 flex flex-wrap gap-2">
                    ${agent.products.map(p => `<span class="px-2 py-1 bg-blue-100 text-blue-800 text-xs font-medium rounded">${p}</span>`).join('')}
                  </div>
                </div>
              ` : ''}

              ${agent.matchType ? `
                <div>
                  <label class="text-sm font-medium text-gray-500 uppercase tracking-wide">Matchtyp</label>
                  <p class="text-base mt-1">${agent.matchType}</p>
                </div>
              ` : ''}
            </div>
          </div>

          <div class="modal-action mt-8 pt-4 border-t">
            <button onclick="closeModal()" class="btn btn-ghost">Stäng</button>
            <button onclick="closeModal(); editAgent('${agent._id}')" class="btn btn-primary">Redigera mäklare</button>
          </div>
        </div>
        <div class="modal-backdrop bg-black bg-opacity-50" onclick="closeModal()"></div>
      </div>
    `;

    showModal(html);
  } catch (error) {
    console.error('Error loading agent details:', error);
    alert('Kunde inte ladda mäklardetaljer');
  }
}
