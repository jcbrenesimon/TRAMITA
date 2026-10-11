// ============ CUENTAS BANCARIAS ============
async function renderPaymentAccounts() {
  setPageTitle('Cuentas bancarias');
  const isAdmin = currentProfile.role === 'admin';
  $('#content').innerHTML = `
    <div style="margin-bottom:20px;display:flex;justify-content:space-between;align-items:center;gap:14px;flex-wrap:wrap">
      <p style="color:var(--ink-muted);margin:0">Cuentas donde los clientes pueden pagar (SINPE, transferencia, depósito, link).</p>
      ${isAdmin ? `<button class="btn btn-primary" onclick="openPaymentAccountModal()">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
        Agregar cuenta
      </button>` : ''}
    </div>
    <div id="paymentAccountsList"></div>
  `;
  await loadPaymentAccounts();
}

async function loadPaymentAccounts() {
  $('#paymentAccountsList').innerHTML = '<div class="page-loading"><span class="spinner" style="border-color:var(--navy);border-top-color:transparent"></span></div>';
  const { data, error } = await sb.from('payment_accounts').select('*').order('display_order');
  if (error) { $('#paymentAccountsList').innerHTML = `<div class="empty"><p>Error: ${error.message}</p></div>`; return; }

  if (!data || data.length === 0) {
    $('#paymentAccountsList').innerHTML = `<div class="empty"><h3>Sin cuentas bancarias</h3><p>Agregue la primera cuenta para recibir pagos.</p></div>`;
    return;
  }

  const isAdmin = currentProfile.role === 'admin';
  $('#paymentAccountsList').innerHTML = `
    <div class="data-card">
      <div class="data-head"><h3>${data.length} cuenta${data.length !== 1 ? 's' : ''}</h3></div>
      <div class="table-scroll">
        <table>
          <thead><tr><th>Orden</th><th>Nombre</th><th>Método</th><th>Banco</th><th>Titular</th><th>Moneda</th><th>Estado</th><th></th></tr></thead>
          <tbody>
            ${data.map(a => `
              <tr class="clickable" onclick="openPaymentAccountModal(${a.id})">
                <td class="mono">${a.display_order || 0}</td>
                <td class="text-navy" style="font-weight:500">${a.display_name}</td>
                <td class="text-muted" style="text-transform:capitalize">${a.payment_method}</td>
                <td class="text-muted">${a.bank || '—'}</td>
                <td class="text-muted" style="max-width:180px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${a.account_holder || '—'}</td>
                <td class="text-muted">${a.currency || 'CRC'}</td>
                <td>${a.active ? '<span class="badge badge-success">Activa</span>' : '<span class="badge badge-muted">Inactiva</span>'}</td>
                <td class="text-right">${isAdmin ? `<button class="btn btn-ghost btn-sm" onclick="event.stopPropagation();openPaymentAccountModal(${a.id})">Editar</button>` : ''}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

async function openPaymentAccountModal(accountId) {
  const isNew = !accountId;
  let a = { id: null, display_name: '', payment_method: 'sinpe', bank: '', currency: 'CRC', iban: '', account_number: '', account_holder: '', holder_id: '', sinpe_number: '', payment_link_url: '', instructions: '', display_order: 0, active: true };

  if (!isNew) {
    const { data, error } = await sb.from('payment_accounts').select('*').eq('id', accountId).single();
    if (error) { toast('Error cargando cuenta', 'error'); return; }
    a = data;
  }

  const body = `
    <div class="field-row">
      <div class="field"><label>Nombre para mostrar *</label><input type="text" id="paName" value="${a.display_name || ''}" placeholder="Ej. BCR - Colones"></div>
      <div class="field">
        <label>Método de pago *</label>
        <select id="paMethod" onchange="togglePaymentFields()">
          <option value="sinpe" ${a.payment_method === 'sinpe' ? 'selected' : ''}>SINPE Móvil</option>
          <option value="transferencia" ${a.payment_method === 'transferencia' ? 'selected' : ''}>Transferencia</option>
          <option value="deposito" ${a.payment_method === 'deposito' ? 'selected' : ''}>Depósito</option>
          <option value="link_bancario" ${a.payment_method === 'link_bancario' ? 'selected' : ''}>Link bancario</option>
        </select>
      </div>
    </div>
    <div class="field-row">
      <div class="field"><label>Banco</label><input type="text" id="paBank" value="${a.bank || ''}" placeholder="Ej. Banco de Costa Rica"></div>
      <div class="field">
        <label>Moneda</label>
        <select id="paCurrency">
          <option value="CRC" ${a.currency === 'CRC' ? 'selected' : ''}>Colones (CRC)</option>
          <option value="USD" ${a.currency === 'USD' ? 'selected' : ''}>Dólares (USD)</option>
        </select>
      </div>
    </div>
    <div class="field-row">
      <div class="field"><label>Titular de la cuenta</label><input type="text" id="paHolder" value="${a.account_holder || ''}" placeholder="Ej. Tramitá S.A."></div>
      <div class="field"><label>Cédula del titular</label><input type="text" id="paHolderId" value="${a.holder_id || ''}" placeholder="3-101-123456"></div>
    </div>
    <div class="field" id="fldIban"><label>IBAN</label><input type="text" id="paIban" value="${a.iban || ''}" placeholder="CR05 0000 0000 0000 0000 00"></div>
    <div class="field" id="fldAccountNum"><label>Número de cuenta (opcional)</label><input type="text" id="paAccountNum" value="${a.account_number || ''}" placeholder="Ej. 001-0123456-0"></div>
    <div class="field" id="fldSinpe"><label>Número SINPE</label><input type="text" id="paSinpe" value="${a.sinpe_number || ''}" placeholder="Ej. 8888-8888"></div>
    <div class="field" id="fldLink" style="display:none"><label>URL del link bancario</label><input type="url" id="paLink" value="${a.payment_link_url || ''}" placeholder="https://..."></div>
    <div class="field"><label>Instrucciones para el cliente</label><textarea id="paInstructions" rows="2" placeholder="Ej. Incluir referencia de la orden en el detalle">${a.instructions || ''}</textarea></div>
    <div class="field-row">
      <div class="field"><label>Orden de visualización</label><input type="number" id="paOrder" value="${a.display_order || 0}" min="0"></div>
      <div class="field" style="display:flex;align-items:flex-end">
        <label style="display:flex;align-items:center;gap:8px;cursor:pointer;padding-bottom:10px">
          <input type="checkbox" id="paActive" ${a.active ? 'checked' : ''} style="width:auto">
          <span>Cuenta activa</span>
        </label>
      </div>
    </div>
    <div id="paError" style="display:none;color:var(--danger);font-size:12.5px;margin-top:10px"></div>
  `;
  const footer = `
    ${!isNew ? `<button class="btn btn-danger" onclick="deletePaymentAccount(${a.id}, '${(a.display_name || '').replace(/'/g,"\\'")}')"  style="margin-right:auto">Eliminar</button>` : ''}
    <button class="btn btn-ghost" onclick="closeModal()">Cancelar</button>
    <button class="btn btn-primary" onclick="savePaymentAccount(${a.id || 'null'})">Guardar</button>
  `;
  showModal(body, isNew ? 'Nueva cuenta bancaria' : `Editar: ${a.display_name}`, footer);
  togglePaymentFields();
}

function togglePaymentFields() {
  const method = $('#paMethod')?.value;
  const fldIban = $('#fldIban');
  const fldAccountNum = $('#fldAccountNum');
  const fldSinpe = $('#fldSinpe');
  const fldLink = $('#fldLink');
  if (method === 'sinpe') {
    fldSinpe.style.display = ''; fldIban.style.display = 'none'; fldAccountNum.style.display = 'none'; fldLink.style.display = 'none';
  } else if (method === 'link_bancario') {
    fldLink.style.display = ''; fldIban.style.display = 'none'; fldAccountNum.style.display = 'none'; fldSinpe.style.display = 'none';
  } else {
    fldIban.style.display = ''; fldAccountNum.style.display = ''; fldSinpe.style.display = 'none'; fldLink.style.display = 'none';
  }
}

async function savePaymentAccount(accountId) {
  const errorEl = $('#paError');
  const name = $('#paName')?.value?.trim();
  if (!name) { errorEl.textContent = 'Nombre requerido'; errorEl.style.display = 'block'; return; }

  const { data, error } = await sb.rpc('admin_save_payment_account', {
    p_id: accountId,
    p_display_name: name,
    p_payment_method: $('#paMethod')?.value || 'sinpe',
    p_bank: $('#paBank')?.value?.trim() || '',
    p_currency: $('#paCurrency')?.value || 'CRC',
    p_iban: $('#paIban')?.value?.trim() || '',
    p_account_number: $('#paAccountNum')?.value?.trim() || '',
    p_account_holder: $('#paHolder')?.value?.trim() || '',
    p_holder_id: $('#paHolderId')?.value?.trim() || '',
    p_sinpe_number: $('#paSinpe')?.value?.trim() || '',
    p_payment_link_url: $('#paLink')?.value?.trim() || '',
    p_instructions: $('#paInstructions')?.value?.trim() || '',
    p_display_order: parseInt($('#paOrder')?.value) || 0,
    p_active: $('#paActive')?.checked || false
  });

  if (error) { errorEl.textContent = error.message; errorEl.style.display = 'block'; return; }
  if (!data.ok) { errorEl.textContent = data.error; errorEl.style.display = 'block'; return; }

  closeModal();
  toast(accountId ? 'Cuenta actualizada' : 'Cuenta agregada', 'success');
  loadPaymentAccounts();
}

async function deletePaymentAccount(accountId, name) {
  if (!confirm(`¿Eliminar la cuenta "${name}"?\n\nSi fue usada en órdenes, se desactivará.`)) return;
  const { data, error } = await sb.rpc('admin_delete_payment_account', { p_id: accountId });
  if (error) { toast('Error: ' + error.message, 'error'); return; }
  if (!data.ok) { toast(data.error, 'error'); return; }
  closeModal();
  toast(data.message, 'success');
  loadPaymentAccounts();
}

