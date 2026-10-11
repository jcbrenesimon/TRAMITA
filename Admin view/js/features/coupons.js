// ============ CUPONES ============
async function renderCoupons() {
  setPageTitle('Cupones');
  const isAdmin = currentProfile.role === 'admin';
  $('#content').innerHTML = `
    <div style="margin-bottom:20px;display:flex;justify-content:space-between;align-items:center;gap:14px;flex-wrap:wrap">
      <p style="color:var(--ink-muted);margin:0">Códigos de descuento para sus clientes.</p>
      ${isAdmin ? `<button class="btn btn-primary" onclick="openCouponModal()">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
        Crear cupón
      </button>` : ''}
    </div>
    <div id="couponsList"></div>
  `;
  await loadCoupons();
}

async function loadCoupons() {
  $('#couponsList').innerHTML = '<div class="page-loading"><span class="spinner" style="border-color:var(--navy);border-top-color:transparent"></span></div>';
  const { data, error } = await sb.from('coupons').select('*').order('created_at', { ascending: false });
  if (error) { $('#couponsList').innerHTML = `<div class="empty"><p>Error: ${error.message}</p></div>`; return; }

  if (!data || data.length === 0) {
    $('#couponsList').innerHTML = `<div class="empty"><h3>Sin cupones</h3><p>Cree el primer cupón para ofrecer descuentos.</p></div>`;
    return;
  }

  const isAdmin = currentProfile.role === 'admin';
  $('#couponsList').innerHTML = `
    <div class="data-card">
      <div class="data-head"><h3>${data.length} cupón${data.length !== 1 ? 'es' : ''}</h3></div>
      <div class="table-scroll">
        <table>
          <thead><tr><th>Código</th><th>Tipo</th><th>Valor</th><th>Usos</th><th>Vigencia</th><th>Estado</th><th></th></tr></thead>
          <tbody>
            ${data.map(c => {
              const now = new Date();
              const until = c.valid_until ? new Date(c.valid_until) : null;
              const isExpired = until && until < now;
              return `
                <tr class="clickable" onclick="openCouponModal(${c.id})">
                  <td class="mono text-navy" style="font-weight:600">${c.code}</td>
                  <td class="text-muted">${c.coupon_type === 'percent' ? 'Porcentaje' : 'Monto fijo'}</td>
                  <td class="text-navy">${c.coupon_type === 'percent' ? c.value + '%' : fmt(c.value)}</td>
                  <td class="text-muted">${c.used_count || 0}${c.usage_limit ? ' / ' + c.usage_limit : ''}</td>
                  <td class="text-muted" style="font-size:12px">${until ? fmtDateOnly(c.valid_until) : 'Sin vencimiento'}</td>
                  <td>
                    ${isExpired ? '<span class="badge badge-danger">Vencido</span>' : c.active ? '<span class="badge badge-success">Activo</span>' : '<span class="badge badge-muted">Inactivo</span>'}
                  </td>
                  <td class="text-right">${isAdmin ? `<button class="btn btn-ghost btn-sm" onclick="event.stopPropagation();openCouponModal(${c.id})">Editar</button>` : ''}</td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

async function openCouponModal(couponId) {
  const isNew = !couponId;
  let c = { id: null, code: '', description: '', coupon_type: 'percent', value: 10, min_purchase: 0, max_discount: null, valid_from: new Date().toISOString(), valid_until: null, usage_limit: null, per_user_limit: 1, active: true };

  if (!isNew) {
    const { data, error } = await sb.from('coupons').select('*').eq('id', couponId).single();
    if (error) { toast('Error cargando cupón', 'error'); return; }
    c = data;
  }

  const validFrom = c.valid_from ? new Date(c.valid_from).toISOString().slice(0,16) : '';
  const validUntil = c.valid_until ? new Date(c.valid_until).toISOString().slice(0,16) : '';

  const body = `
    <div class="field-row">
      <div class="field"><label>Código *</label><input type="text" id="cpCode" value="${c.code || ''}" placeholder="Ej. BIENVENIDA10" style="text-transform:uppercase"></div>
      <div class="field">
        <label>Tipo *</label>
        <select id="cpType">
          <option value="percent" ${c.coupon_type === 'percent' ? 'selected' : ''}>Porcentaje</option>
          <option value="fixed" ${c.coupon_type === 'fixed' ? 'selected' : ''}>Monto fijo</option>
        </select>
      </div>
    </div>
    <div class="field"><label>Descripción interna</label><input type="text" id="cpDesc" value="${c.description || ''}" placeholder="Para qué es este cupón"></div>
    <div class="field-row">
      <div class="field"><label>Valor *</label><input type="number" id="cpValue" value="${c.value ?? ''}" min="1"><div class="field-hint">% o monto en colones</div></div>
      <div class="field"><label>Compra mínima (₡)</label><input type="number" id="cpMinPurchase" value="${c.min_purchase || 0}" min="0" step="500"></div>
    </div>
    <div class="field"><label>Descuento máximo (₡, opcional)</label><input type="number" id="cpMaxDiscount" value="${c.max_discount || ''}" min="0" placeholder="Sin límite"><div class="field-hint">Solo para tipo porcentaje</div></div>
    <div class="field-row">
      <div class="field"><label>Válido desde</label><input type="datetime-local" id="cpValidFrom" value="${validFrom}"></div>
      <div class="field"><label>Válido hasta</label><input type="datetime-local" id="cpValidUntil" value="${validUntil}"></div>
    </div>
    <div class="field-row">
      <div class="field"><label>Límite total de usos</label><input type="number" id="cpUsageLimit" value="${c.usage_limit || ''}" min="1" placeholder="Sin límite"></div>
      <div class="field"><label>Límite por usuario</label><input type="number" id="cpPerUserLimit" value="${c.per_user_limit || 1}" min="1"></div>
    </div>
    <div class="field">
      <label style="display:flex;align-items:center;gap:8px;cursor:pointer">
        <input type="checkbox" id="cpActive" ${c.active ? 'checked' : ''} style="width:auto">
        <span>Cupón activo</span>
      </label>
    </div>
    ${!isNew && c.used_count > 0 ? `<div style="background:var(--info-bg);padding:10px;border-radius:var(--radius);font-size:12.5px;color:var(--info)">📊 Usado ${c.used_count} vez(ces)</div>` : ''}
    <div id="cpError" style="display:none;color:var(--danger);font-size:12.5px;margin-top:10px"></div>
  `;
  const footer = `
    ${!isNew ? `<button class="btn btn-danger" onclick="deleteCoupon(${c.id}, '${(c.code || '').replace(/'/g,"\\'")}')"  style="margin-right:auto">Eliminar</button>` : ''}
    <button class="btn btn-ghost" onclick="closeModal()">Cancelar</button>
    <button class="btn btn-primary" onclick="saveCoupon(${c.id || 'null'})">Guardar</button>
  `;
  showModal(body, isNew ? 'Nuevo cupón' : `Editar: ${c.code}`, footer);
}

async function saveCoupon(couponId) {
  const errorEl = $('#cpError');
  const code = $('#cpCode')?.value?.trim().toUpperCase();
  if (!code) { errorEl.textContent = 'Código requerido'; errorEl.style.display = 'block'; return; }

  const { data, error } = await sb.rpc('admin_save_coupon', {
    p_id: couponId,
    p_code: code,
    p_description: $('#cpDesc')?.value?.trim() || '',
    p_coupon_type: $('#cpType')?.value,
    p_value: parseInt($('#cpValue')?.value) || 0,
    p_min_purchase: parseInt($('#cpMinPurchase')?.value) || 0,
    p_max_discount: $('#cpMaxDiscount')?.value ? parseInt($('#cpMaxDiscount').value) : null,
    p_valid_from: $('#cpValidFrom')?.value ? new Date($('#cpValidFrom').value).toISOString() : null,
    p_valid_until: $('#cpValidUntil')?.value ? new Date($('#cpValidUntil').value).toISOString() : null,
    p_usage_limit: $('#cpUsageLimit')?.value ? parseInt($('#cpUsageLimit').value) : null,
    p_per_user_limit: parseInt($('#cpPerUserLimit')?.value) || 1,
    p_active: $('#cpActive')?.checked || false
  });

  if (error) { errorEl.textContent = error.message; errorEl.style.display = 'block'; return; }
  if (!data.ok) { errorEl.textContent = data.error; errorEl.style.display = 'block'; return; }

  closeModal();
  toast(couponId ? 'Cupón actualizado' : 'Cupón creado', 'success');
  loadCoupons();
}

async function deleteCoupon(couponId, code) {
  if (!confirm(`¿Eliminar el cupón "${code}"?\n\nSi ya fue usado, se desactivará.`)) return;
  const { data, error } = await sb.rpc('admin_delete_coupon', { p_id: couponId });
  if (error) { toast('Error: ' + error.message, 'error'); return; }
  if (!data.ok) { toast(data.error, 'error'); return; }
  closeModal();
  toast(data.message, 'success');
  loadCoupons();
}

