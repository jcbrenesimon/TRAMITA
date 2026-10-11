// ============ SERVICIOS ============
let servicesFilter = 'all';
let allCategoriesCache = [];

async function renderServices() {
  setPageTitle('Servicios');
  const isAdmin = currentProfile.role === 'admin';
  $('#content').innerHTML = `
    <div style="margin-bottom:20px;display:flex;justify-content:space-between;align-items:center;gap:14px;flex-wrap:wrap">
      <p style="color:var(--ink-muted);margin:0">Gestione los servicios que ofrece Tramitá.</p>
      ${isAdmin ? `<button class="btn btn-primary" onclick="openServiceModal()">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
        Crear servicio
      </button>` : ''}
    </div>
    <div class="filters" id="servicesFilters"></div>
    <div id="servicesList"></div>
  `;
  await loadServices();
}

async function loadServices() {
  $('#servicesFilters').innerHTML = [
    ['all', 'Todos'],
    ['active', 'Activos'],
    ['inactive', 'Inactivos'],
    ['featured', 'Destacados']
  ].map(([k,label]) => `<button class="chip ${servicesFilter === k ? 'active' : ''}" onclick="filterServices('${k}')">${label}</button>`).join('');

  $('#servicesList').innerHTML = '<div class="page-loading"><span class="spinner" style="border-color:var(--navy);border-top-color:transparent"></span></div>';

  // Cargar categorías para el dropdown
  const { data: cats } = await sb.from('categories').select('*').order('display_order');
  allCategoriesCache = cats || [];

  let query = sb.from('services').select('*, categories(name)').order('category_id').order('id');
  if (servicesFilter === 'active') query = query.eq('active', true);
  else if (servicesFilter === 'inactive') query = query.eq('active', false);
  else if (servicesFilter === 'featured') query = query.eq('featured', true);

  const { data, error } = await query;
  if (error) { $('#servicesList').innerHTML = `<div class="empty"><p>Error: ${error.message}</p></div>`; return; }

  if (!data || data.length === 0) {
    $('#servicesList').innerHTML = `<div class="empty"><h3>Sin servicios</h3><p>No hay servicios en esta categoría.</p></div>`;
    return;
  }

  const isAdmin = currentProfile.role === 'admin';
  $('#servicesList').innerHTML = `
    <div class="data-card">
      <div class="data-head"><h3>${data.length} servicio${data.length !== 1 ? 's' : ''}</h3></div>
      <div class="table-scroll">
        <table>
          <thead><tr><th>Servicio</th><th>Categoría</th><th>Precio</th><th>Puntos</th><th>Tiempo</th><th>Estado</th><th></th></tr></thead>
          <tbody>
            ${data.map(s => `
              <tr class="clickable" onclick="openServiceModal(${s.id})">
                <td>
                  <div class="text-navy" style="font-weight:500">${s.icon || '📄'} ${s.name}</div>
                  <div class="text-muted" style="font-size:11.5px;max-width:280px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${s.short_description || ''}</div>
                </td>
                <td class="text-muted">${s.categories?.name || '—'}</td>
                <td class="text-navy">${fmt(s.price)}</td>
                <td class="text-muted">${s.points_percentage || 0}%</td>
                <td class="text-muted" style="font-size:12px">${s.estimated_time || '—'}</td>
                <td>
                  ${s.active ? '<span class="badge badge-success">Activo</span>' : '<span class="badge badge-muted">Inactivo</span>'}
                  ${s.featured ? '<span class="badge badge-warning" style="margin-left:4px">⭐</span>' : ''}
                </td>
                <td class="text-right">${isAdmin ? `<button class="btn btn-ghost btn-sm" onclick="event.stopPropagation();openServiceModal(${s.id})">Editar</button>` : ''}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

function filterServices(k) { servicesFilter = k; loadServices(); }

async function openServiceModal(serviceId) {
  const isNew = !serviceId;
  let s = { id: null, name: '', category_id: null, price: 0, short_description: '', long_description: '', estimated_time: '', required_documents: [], icon: '📄', points_percentage: 1, active: true, featured: false };

  if (!isNew) {
    showModal(`<div class="page-loading"><span class="spinner" style="border-color:var(--navy);border-top-color:transparent"></span></div>`, 'Cargando...');
    const { data, error } = await sb.from('services').select('*').eq('id', serviceId).single();
    if (error) { toast('Error cargando servicio', 'error'); closeModal(); return; }
    s = data;
    if (typeof s.required_documents === 'string') {
      try { s.required_documents = JSON.parse(s.required_documents); } catch { s.required_documents = []; }
    }
    if (!Array.isArray(s.required_documents)) s.required_documents = [];
  }

  // Asegurar categorías cargadas
  if (allCategoriesCache.length === 0) {
    const { data: cats } = await sb.from('categories').select('*').order('display_order');
    allCategoriesCache = cats || [];
  }

  const docsValue = Array.isArray(s.required_documents) ? s.required_documents.join('\n') : '';

  const body = `
    <div class="field-row">
      <div class="field"><label>Nombre del servicio *</label><input type="text" id="svcName" value="${s.name || ''}" placeholder="Ej. Traspaso de vehículo"></div>
      <div class="field"><label>Icono (emoji)</label><input type="text" id="svcIcon" value="${s.icon || '📄'}" maxlength="4" placeholder="📄"></div>
    </div>
    <div class="field-row">
      <div class="field">
        <label>Categoría *</label>
        <select id="svcCategory">
          <option value="">-- Seleccione --</option>
          ${allCategoriesCache.map(c => `<option value="${c.id}" ${s.category_id == c.id ? 'selected' : ''}>${c.name}</option>`).join('')}
        </select>
      </div>
      <div class="field"><label>Precio (₡) *</label><input type="number" id="svcPrice" value="${s.price || 0}" min="0" step="500"></div>
    </div>
    <div class="field"><label>Descripción corta</label><input type="text" id="svcShortDesc" value="${s.short_description || ''}" placeholder="Una línea que describe el servicio"></div>
    <div class="field"><label>Descripción larga</label><textarea id="svcLongDesc" rows="3" placeholder="Descripción completa para el cliente">${s.long_description || ''}</textarea></div>
    <div class="field-row">
      <div class="field"><label>Tiempo estimado</label><input type="text" id="svcTime" value="${s.estimated_time || ''}" placeholder="Ej. 3-5 días hábiles"></div>
      <div class="field"><label>% Puntos (0-100)</label><input type="number" id="svcPoints" value="${s.points_percentage ?? ''}" min="0" max="100" step="0.5"></div>
    </div>
    <div class="field">
      <label>Documentos requeridos (uno por línea)</label>
      <textarea id="svcDocs" rows="4" placeholder="Cédula del comprador&#10;Cédula del vendedor&#10;Título de propiedad">${docsValue}</textarea>
      <div class="field-hint">Estos documentos se le pedirán al cliente después del pago</div>
    </div>
    <div class="field-row">
      <div class="field">
        <label style="display:flex;align-items:center;gap:8px;cursor:pointer">
          <input type="checkbox" id="svcActive" ${s.active ? 'checked' : ''} style="width:auto">
          <span>Activo (visible en el catálogo)</span>
        </label>
      </div>
      <div class="field">
        <label style="display:flex;align-items:center;gap:8px;cursor:pointer">
          <input type="checkbox" id="svcFeatured" ${s.featured ? 'checked' : ''} style="width:auto">
          <span>⭐ Destacado</span>
        </label>
      </div>
    </div>
    <div id="svcError" style="display:none;color:var(--danger);font-size:12.5px;margin-top:10px"></div>
  `;
  const footer = `
    ${!isNew ? `<button class="btn btn-danger" onclick="deleteService(${s.id}, '${(s.name || '').replace(/'/g,"\\'")}')"  style="margin-right:auto">Eliminar</button>` : ''}
    <button class="btn btn-ghost" onclick="closeModal()">Cancelar</button>
    <button class="btn btn-primary" onclick="saveService(${s.id || 'null'})">Guardar</button>
  `;
  showModal(body, isNew ? 'Nuevo servicio' : `Editar: ${s.name}`, footer);
}

async function saveService(serviceId) {
  const name = $('#svcName')?.value?.trim();
  const categoryId = parseInt($('#svcCategory')?.value) || null;
  const price = parseInt($('#svcPrice')?.value) || 0;
  const errorEl = $('#svcError');

  if (!name) { errorEl.textContent = 'Nombre requerido'; errorEl.style.display = 'block'; return; }
  if (!categoryId) { errorEl.textContent = 'Debe seleccionar una categoría'; errorEl.style.display = 'block'; return; }

  const docsText = $('#svcDocs')?.value?.trim() || '';
  const docsArr = docsText ? docsText.split('\n').map(d => d.trim()).filter(Boolean) : [];

  const { data, error } = await sb.rpc('admin_save_service', {
    p_id: serviceId,
    p_name: name,
    p_category_id: categoryId,
    p_price: price,
    p_short_description: $('#svcShortDesc')?.value?.trim() || '',
    p_long_description: $('#svcLongDesc')?.value?.trim() || '',
    p_estimated_time: $('#svcTime')?.value?.trim() || '',
    p_required_documents: docsArr,
    p_icon: $('#svcIcon')?.value?.trim() || '📄',
    p_points_percentage: parseFloat($('#svcPoints')?.value) || 0,
    p_active: $('#svcActive')?.checked || false,
    p_featured: $('#svcFeatured')?.checked || false
  });

  if (error) { errorEl.textContent = error.message; errorEl.style.display = 'block'; return; }
  if (!data.ok) { errorEl.textContent = data.error; errorEl.style.display = 'block'; return; }

  closeModal();
  toast(serviceId ? 'Servicio actualizado' : 'Servicio creado', 'success');
  loadServices();
}

async function deleteService(serviceId, name) {
  if (!confirm(`¿Eliminar el servicio "${name}"?\n\nSi tiene órdenes asociadas, se desactivará en vez de eliminarse.`)) return;
  const { data, error } = await sb.rpc('admin_delete_service', { p_id: serviceId });
  if (error) { toast('Error: ' + error.message, 'error'); return; }
  if (!data.ok) { toast(data.error, 'error'); return; }
  closeModal();
  toast(data.message, 'success');
  loadServices();
}

