// ============ CUPONES ============
let currentCouponEdit = null;

async function renderCoupons() {
  setPageTitle('Cupones');
  $('#content').innerHTML = `
    <div class="view-intro view-intro-actions">
      <p>Códigos de descuento para sus clientes.</p>
      ${isAdmin() ? `<button class="btn btn-primary" type="button" onclick="openCouponModal()">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
        Crear cupón
      </button>` : ''}
    </div>
    <div id="couponsList">${LOADING}</div>
  `;
  await loadCoupons();
}

async function loadCoupons() {
  const { data, error } = await sb.from('coupons').select('*').order('created_at', { ascending: false });
  if (currentView !== 'coupons') return;
  const list = $('#couponsList');
  if (error) { list.innerHTML = emptyState('Error', friendlyError(error)); return; }
  if (!data.length) { list.innerHTML = emptyState('Sin cupones', 'Cree el primer cupón para ofrecer descuentos.'); return; }

  const now = new Date();
  list.innerHTML = `
    <div class="data-card">
      <div class="data-head"><h3>${data.length} cupón${data.length !== 1 ? 'es' : ''}</h3></div>
      ${dataTable(
        [{ label: 'Código' }, { label: 'Tipo' }, { label: 'Valor' }, { label: 'Usos' }, { label: 'Vigencia' }, { label: 'Estado' }],
        data.map(c => {
          const isExpired = c.valid_until && new Date(c.valid_until) < now;
          const exhausted = c.usage_limit && c.usage_count >= c.usage_limit;
          return {
            open: ['coupon', c.id],
            cells: [
              `<span class="mono text-navy strong">${esc(c.code)}</span>`,
              `<span class="text-muted">${c.coupon_type === 'percent' ? 'Porcentaje' : 'Monto fijo'}</span>`,
              `<span class="text-navy">${c.coupon_type === 'percent' ? esc(c.value) + '%' : fmt(c.value)}</span>`,
              `<span class="text-muted">${esc(c.usage_count || 0)}${c.usage_limit ? ' / ' + esc(c.usage_limit) : ''}</span>`,
              `<span class="text-muted small">${c.valid_until ? esc(fmtDateOnly(c.valid_until)) : 'Sin vencimiento'}</span>`,
              isExpired ? '<span class="badge badge-danger">Vencido</span>'
                : exhausted ? '<span class="badge badge-muted">Agotado</span>'
                : c.active ? '<span class="badge badge-success">Activo</span>' : '<span class="badge badge-muted">Inactivo</span>',
            ],
          };
        }))}
    </div>`;
}

// datetime-local espera hora local "YYYY-MM-DDTHH:mm"
function toLocalInput(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  const pad = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

async function openCouponModal(couponId) {
  const isNew = !couponId;
  let c = { id: null, code: '', description: '', coupon_type: 'percent', value: '', min_purchase: 0, max_discount: null, valid_from: new Date().toISOString(), valid_until: null, usage_limit: null, per_user_limit: 1, usage_count: 0, active: true };
  if (!isNew) {
    const { data, error } = await sb.from('coupons').select('*').eq('id', couponId).single();
    if (error) { toast('Error cargando cupón', 'error'); return; }
    c = data;
  }
  currentCouponEdit = c;
  const dis = isAdmin() ? '' : 'disabled';

  const body = `
    <div class="field-row">
      <div class="field"><label for="cpCode">Código *</label><input type="text" id="cpCode" class="uppercase" maxlength="40" value="${esc(c.code)}" placeholder="Ej. BIENVENIDA10" ${dis}></div>
      <div class="field">
        <label for="cpType">Tipo *</label>
        <select id="cpType" ${dis}>
          <option value="percent" ${c.coupon_type === 'percent' ? 'selected' : ''}>Porcentaje</option>
          <option value="fixed" ${c.coupon_type === 'fixed' ? 'selected' : ''}>Monto fijo</option>
        </select>
      </div>
    </div>
    <div class="field"><label for="cpDesc">Descripción interna</label><input type="text" id="cpDesc" maxlength="200" value="${esc(c.description)}" placeholder="Para qué es este cupón" ${dis}></div>
    <div class="field-row">
      <div class="field"><label for="cpValue">Valor *</label><input type="number" id="cpValue" value="${esc(c.value ?? '')}" min="1" ${dis}><div class="field-hint">% o monto en colones</div></div>
      <div class="field"><label for="cpMinPurchase">Compra mínima (₡)</label><input type="number" id="cpMinPurchase" value="${esc(c.min_purchase || 0)}" min="0" step="500" ${dis}></div>
    </div>
    <div class="field"><label for="cpMaxDiscount">Descuento máximo (₡, opcional)</label><input type="number" id="cpMaxDiscount" value="${esc(c.max_discount ?? '')}" min="0" placeholder="Sin límite" ${dis}><div class="field-hint">Útil para cupones de porcentaje</div></div>
    <div class="field-row">
      <div class="field"><label for="cpValidFrom">Válido desde</label><input type="datetime-local" id="cpValidFrom" value="${toLocalInput(c.valid_from)}" ${dis}></div>
      <div class="field"><label for="cpValidUntil">Válido hasta</label><input type="datetime-local" id="cpValidUntil" value="${toLocalInput(c.valid_until)}" ${dis}></div>
    </div>
    <div class="field-row">
      <div class="field"><label for="cpUsageLimit">Límite total de usos</label><input type="number" id="cpUsageLimit" value="${esc(c.usage_limit ?? '')}" min="1" placeholder="Sin límite" ${dis}></div>
      <div class="field"><label for="cpPerUserLimit">Límite por cliente</label><input type="number" id="cpPerUserLimit" value="${esc(c.per_user_limit ?? 1)}" min="1" ${dis}></div>
    </div>
    <label class="check-label"><input type="checkbox" id="cpActive" ${c.active ? 'checked' : ''} ${dis}><span>Cupón activo</span></label>
    ${!isNew ? `<div class="banner banner-info">📊 Usado ${esc(c.usage_count || 0)} ${c.usage_count === 1 ? 'vez' : 'veces'}. Las órdenes canceladas liberan su uso.</div>` : ''}
    <div id="cpError" class="form-error" role="alert" hidden></div>
  `;
  const footer = !isAdmin()
    ? '<button class="btn btn-ghost" type="button" onclick="closeModal()">Cerrar</button>'
    : `${!isNew ? '<button class="btn btn-danger mr-auto" type="button" onclick="deleteCoupon()">Eliminar</button>' : ''}
       <button class="btn btn-ghost" type="button" onclick="closeModal()">Cancelar</button>
       <button class="btn btn-primary" type="button" onclick="saveCoupon()">Guardar</button>`;
  showModal(body, isNew ? 'Nuevo cupón' : `Editar: ${c.code}`, footer);
}

async function saveCoupon() {
  const code = $('#cpCode')?.value?.trim().toUpperCase();
  const value = parseInt($('#cpValue')?.value);
  if (!code) { setError('#cpError', 'Código requerido'); return; }
  if (!(value > 0)) { setError('#cpError', 'Indique un valor mayor a 0'); return; }
  const num = id => ($(id)?.value ? parseInt($(id).value) : null);
  const date = id => ($(id)?.value ? new Date($(id).value).toISOString() : null);

  const { data, error } = await sb.rpc('admin_save_coupon', {
    p_id: currentCouponEdit.id,
    p_code: code,
    p_description: $('#cpDesc')?.value?.trim() || '',
    p_coupon_type: $('#cpType')?.value,
    p_value: value,
    p_min_purchase: num('#cpMinPurchase') || 0,
    p_max_discount: num('#cpMaxDiscount'),
    p_valid_from: date('#cpValidFrom'),
    p_valid_until: date('#cpValidUntil'),
    p_usage_limit: num('#cpUsageLimit'),
    p_per_user_limit: num('#cpPerUserLimit') || 1,
    p_active: $('#cpActive')?.checked || false,
  });
  const err = rpcError(error, data);
  if (err) { setError('#cpError', err); return; }
  closeModal();
  toast(currentCouponEdit.id ? 'Cupón actualizado' : 'Cupón creado', 'success');
  loadCoupons();
}

async function deleteCoupon() {
  const c = currentCouponEdit;
  if (!confirm(`¿Eliminar el cupón "${c.code}"?\n\nSi ya fue usado, se desactivará.`)) return;
  const { data, error } = await sb.rpc('admin_delete_coupon', { p_id: c.id });
  const err = rpcError(error, data);
  if (err) { toast(err, 'error'); return; }
  closeModal();
  toast(data.message, 'success');
  loadCoupons();
}
