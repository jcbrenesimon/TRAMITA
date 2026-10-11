// ============ CUENTAS BANCARIAS ============
let currentAccountEdit = null;

async function renderPaymentAccounts() {
  setPageTitle('Cuentas bancarias');
  $('#content').innerHTML = `
    <div class="view-intro view-intro-actions">
      <p>Cuentas donde los clientes pueden pagar (SINPE, transferencia, depósito, link).</p>
      ${isAdmin() ? `<button class="btn btn-primary" type="button" onclick="openPaymentAccountModal()">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
        Agregar cuenta
      </button>` : ''}
    </div>
    <div id="paymentAccountsList">${LOADING}</div>
  `;
  await loadPaymentAccounts();
}

async function loadPaymentAccounts() {
  const { data, error } = await sb.from('payment_accounts').select('*').order('display_order');
  if (currentView !== 'payment-accounts') return;
  const list = $('#paymentAccountsList');
  if (error) { list.innerHTML = emptyState('Error', friendlyError(error)); return; }
  if (!data.length) { list.innerHTML = emptyState('Sin cuentas bancarias', 'Agregue la primera cuenta para recibir pagos.'); return; }

  list.innerHTML = `
    <div class="data-card">
      <div class="data-head"><h3>${data.length} cuenta${data.length !== 1 ? 's' : ''}</h3></div>
      ${dataTable(
        [{ label: 'Orden' }, { label: 'Nombre' }, { label: 'Método' }, { label: 'Banco' }, { label: 'Titular' }, { label: 'Moneda' }, { label: 'Estado' }],
        data.map(a => ({
          open: ['account', a.id],
          cells: [
            `<span class="mono">${esc(a.display_order || 0)}</span>`,
            `<span class="text-navy">${esc(a.display_name)}</span>`,
            `<span class="text-muted">${esc(PAYMENT_METHODS[a.payment_method] || a.payment_method)}</span>`,
            `<span class="text-muted">${esc(a.bank || '—')}</span>`,
            `<span class="text-muted truncate">${esc(a.account_holder || '—')}</span>`,
            `<span class="text-muted">${esc(a.currency || 'CRC')}</span>`,
            a.active ? '<span class="badge badge-success">Activa</span>' : '<span class="badge badge-muted">Inactiva</span>',
          ],
        })))}
    </div>`;
}

async function openPaymentAccountModal(accountId) {
  const isNew = !accountId;
  let a = { id: null, display_name: '', payment_method: 'sinpe', bank: '', currency: 'CRC', iban: '', account_number: '', account_holder: '', holder_id: '', sinpe_number: '', payment_link_url: '', instructions: '', display_order: 0, active: true };
  if (!isNew) {
    const { data, error } = await sb.from('payment_accounts').select('*').eq('id', accountId).single();
    if (error) { toast('Error cargando cuenta', 'error'); return; }
    a = data;
  }
  currentAccountEdit = a;
  const dis = isAdmin() ? '' : 'disabled';
  const input = (id, label, value, attrs = '') =>
    `<div class="field" id="fld_${id}"><label for="${id}">${label}</label><input id="${id}" value="${esc(value)}" ${attrs} ${dis}></div>`;

  const body = `
    <div class="field-row">
      ${input('paName', 'Nombre para mostrar *', a.display_name, 'type="text" maxlength="100" placeholder="Ej. BCR - Colones"')}
      <div class="field">
        <label for="paMethod">Método de pago *</label>
        <select id="paMethod" onchange="togglePaymentFields()" ${dis}>
          ${Object.entries(PAYMENT_METHODS).map(([k, v]) => `<option value="${k}" ${a.payment_method === k ? 'selected' : ''}>${esc(v)}</option>`).join('')}
        </select>
      </div>
    </div>
    <div class="field-row">
      ${input('paBank', 'Banco', a.bank, 'type="text" maxlength="100" placeholder="Ej. Banco de Costa Rica"')}
      <div class="field">
        <label for="paCurrency">Moneda</label>
        <select id="paCurrency" ${dis}>
          <option value="CRC" ${a.currency === 'CRC' ? 'selected' : ''}>Colones (CRC)</option>
          <option value="USD" ${a.currency === 'USD' ? 'selected' : ''}>Dólares (USD)</option>
        </select>
      </div>
    </div>
    <div class="field-row">
      ${input('paHolder', 'Titular de la cuenta', a.account_holder, 'type="text" maxlength="150" placeholder="Ej. Tramitá S.A."')}
      ${input('paHolderId', 'Cédula del titular', a.holder_id, 'type="text" maxlength="30" placeholder="3-101-123456"')}
    </div>
    ${input('paIban', 'IBAN', a.iban, 'type="text" maxlength="40" placeholder="CR05 0000 0000 0000 0000 00"')}
    ${input('paAccountNum', 'Número de cuenta (opcional)', a.account_number, 'type="text" maxlength="40" placeholder="Ej. 001-0123456-0"')}
    ${input('paSinpe', 'Número SINPE', a.sinpe_number, 'type="text" maxlength="20" placeholder="Ej. 8888-8888"')}
    ${input('paLink', 'URL del link bancario', a.payment_link_url, 'type="url" maxlength="500" placeholder="https://..."')}
    <div class="field"><label for="paInstructions">Instrucciones para el cliente</label><textarea id="paInstructions" rows="2" maxlength="500" placeholder="Ej. Incluir la referencia de la orden en el detalle" ${dis}>${esc(a.instructions)}</textarea></div>
    <div class="field-row">
      ${input('paOrder', 'Orden de visualización', a.display_order || 0, 'type="number" min="0"')}
      <label class="check-label check-label-bottom"><input type="checkbox" id="paActive" ${a.active ? 'checked' : ''} ${dis}><span>Cuenta activa</span></label>
    </div>
    <div class="field-hint">⚠️ Revise dos veces el IBAN y el número SINPE: los clientes pagarán a esta cuenta.</div>
    <div id="paError" class="form-error" role="alert" hidden></div>
  `;
  const footer = !isAdmin()
    ? '<button class="btn btn-ghost" type="button" onclick="closeModal()">Cerrar</button>'
    : `${!isNew ? '<button class="btn btn-danger mr-auto" type="button" onclick="deletePaymentAccount()">Eliminar</button>' : ''}
       <button class="btn btn-ghost" type="button" onclick="closeModal()">Cancelar</button>
       <button class="btn btn-primary" type="button" onclick="savePaymentAccount()">Guardar</button>`;
  showModal(body, isNew ? 'Nueva cuenta bancaria' : `Editar: ${a.display_name}`, footer);
  togglePaymentFields();
}

function togglePaymentFields() {
  const method = $('#paMethod')?.value;
  const showMap = {
    sinpe: ['paSinpe'],
    link_bancario: ['paLink'],
    transferencia: ['paIban', 'paAccountNum'],
    deposito: ['paIban', 'paAccountNum'],
  };
  ['paIban', 'paAccountNum', 'paSinpe', 'paLink'].forEach(id => {
    $('#fld_' + id).hidden = !(showMap[method] || []).includes(id);
  });
}

async function savePaymentAccount() {
  const name = $('#paName')?.value?.trim();
  if (!name) { setError('#paError', 'Nombre requerido'); return; }
  const link = $('#paLink')?.value?.trim() || '';
  if (link && !/^https:\/\//i.test(link)) { setError('#paError', 'El link de pago debe empezar con https://'); return; }

  const { data, error } = await sb.rpc('admin_save_payment_account', {
    p_id: currentAccountEdit.id,
    p_display_name: name,
    p_payment_method: $('#paMethod')?.value || 'sinpe',
    p_bank: $('#paBank')?.value?.trim() || '',
    p_currency: $('#paCurrency')?.value || 'CRC',
    p_iban: $('#paIban')?.value?.trim() || '',
    p_account_number: $('#paAccountNum')?.value?.trim() || '',
    p_account_holder: $('#paHolder')?.value?.trim() || '',
    p_holder_id: $('#paHolderId')?.value?.trim() || '',
    p_sinpe_number: $('#paSinpe')?.value?.trim() || '',
    p_payment_link_url: link,
    p_instructions: $('#paInstructions')?.value?.trim() || '',
    p_display_order: parseInt($('#paOrder')?.value) || 0,
    p_active: $('#paActive')?.checked || false,
  });
  const err = rpcError(error, data);
  if (err) { setError('#paError', err); return; }
  closeModal();
  toast(currentAccountEdit.id ? 'Cuenta actualizada' : 'Cuenta agregada', 'success');
  loadPaymentAccounts();
}

async function deletePaymentAccount() {
  const a = currentAccountEdit;
  if (!confirm(`¿Eliminar la cuenta "${a.display_name}"?\n\nSi fue usada en órdenes, se desactivará.`)) return;
  const { data, error } = await sb.rpc('admin_delete_payment_account', { p_id: a.id });
  const err = rpcError(error, data);
  if (err) { toast(err, 'error'); return; }
  closeModal();
  toast(data.message, 'success');
  loadPaymentAccounts();
}
