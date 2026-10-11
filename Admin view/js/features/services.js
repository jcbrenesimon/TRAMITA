// ============ SERVICIOS ============
let servicesFilter = 'all';
let allCategoriesCache = [];
let currentServiceEdit = null;
let pendingServiceImage = null;   // { file } o { remove: true }

async function renderServices() {
  setPageTitle('Servicios');
  $('#content').innerHTML = `
    <div class="view-intro view-intro-actions">
      <p>Gestione los servicios que ofrece Tramitá.</p>
      ${isAdmin() ? `<button class="btn btn-primary" type="button" onclick="openServiceModal()">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
        Crear servicio
      </button>` : ''}
    </div>
    <div class="filters" id="servicesFilters" role="toolbar" aria-label="Filtrar servicios"></div>
    <div id="servicesList">${LOADING}</div>
  `;
  await loadServices();
}

async function loadServices() {
  $('#servicesFilters').innerHTML = [
    ['all', 'Todos'], ['active', 'Activos'], ['inactive', 'Inactivos'], ['featured', 'Destacados'],
  ].map(([k, label]) => `<button type="button" class="chip ${servicesFilter === k ? 'active' : ''}" aria-pressed="${servicesFilter === k}" onclick="filterServices('${k}')">${label}</button>`).join('');

  const { data: cats } = await sb.from('categories').select('*').order('display_order');
  allCategoriesCache = cats || [];

  let query = sb.from('services').select('*, categories(name)').order('category_id').order('display_order').order('id');
  if (servicesFilter === 'active') query = query.eq('active', true);
  else if (servicesFilter === 'inactive') query = query.eq('active', false);
  else if (servicesFilter === 'featured') query = query.eq('featured', true);

  const { data, error } = await query;
  if (currentView !== 'services') return;
  const list = $('#servicesList');
  if (error) { list.innerHTML = emptyState('Error', friendlyError(error)); return; }
  if (!data.length) { list.innerHTML = emptyState('Sin servicios', 'No hay servicios en esta categoría.'); return; }

  list.innerHTML = `
    <div class="data-card">
      <div class="data-head"><h3>${data.length} servicio${data.length !== 1 ? 's' : ''}</h3></div>
      ${dataTable(
        [{ label: 'Servicio' }, { label: 'Categoría' }, { label: 'Precio' }, { label: 'Puntos' }, { label: 'Tiempo' }, { label: 'Estado' }],
        data.map(s => ({
          open: ['service', s.id],
          cells: [
            `<div class="svc-cell">
               ${safeUrl(s.image_url) ? `<img src="${esc(safeUrl(s.image_url))}" alt="" class="svc-thumb" loading="lazy">` : `<span class="svc-ico">${serviceIcon(s.icon)}</span>`}
               <div class="min-w-0"><div class="text-navy">${esc(s.name)}</div><div class="cell-sub truncate">${esc(s.short_description || '')}</div></div>
             </div>`,
            `<span class="text-muted">${esc(s.categories?.name || '—')}</span>`,
            `<span class="text-navy">${fmt(s.price)}</span>`,
            `<span class="text-muted">${esc(s.points_percentage || 0)}%</span>`,
            `<span class="text-muted small">${esc(s.estimated_time || '—')}</span>`,
            `${s.active ? '<span class="badge badge-success">Activo</span>' : '<span class="badge badge-muted">Inactivo</span>'}
             ${s.featured ? '<span class="badge badge-warning" title="Destacado">⭐</span>' : ''}`,
          ],
        })))}
    </div>`;
}

function filterServices(k) { servicesFilter = k; loadServices(); }

async function openServiceModal(serviceId) {
  const isNew = !serviceId;
  let s = { id: null, name: '', category_id: null, price: '', short_description: '', long_description: '', estimated_time: '', required_documents: [], icon: 'doc', points_percentage: 0, active: true, featured: false, image_url: null };

  if (!isNew) {
    showModal(LOADING, 'Cargando...');
    const { data, error } = await sb.from('services').select('*').eq('id', serviceId).single();
    if (error) { toast('Error cargando servicio', 'error'); closeModal(); return; }
    s = data;
    if (!Array.isArray(s.required_documents)) s.required_documents = [];
  }
  currentServiceEdit = s;
  pendingServiceImage = null;

  if (allCategoriesCache.length === 0) {
    const { data: cats } = await sb.from('categories').select('*').order('display_order');
    allCategoriesCache = cats || [];
  }
  const readonly = !isAdmin();
  const dis = readonly ? 'disabled' : '';
  const iconIsKey = ICON_OPTIONS.some(o => o.key === s.icon);
  const img = safeUrl(s.image_url);

  const body = `
    <div class="field-row">
      <div class="field"><label for="svcName">Nombre del servicio *</label><input type="text" id="svcName" value="${esc(s.name)}" maxlength="150" placeholder="Ej. Traspaso de vehículo" ${dis}></div>
      <div class="field">
        <label for="svcIconSel">Ícono</label>
        <div class="icon-picker">
          <span class="svc-ico" id="svcIconPreview">${serviceIcon(s.icon)}</span>
          <select id="svcIconSel" onchange="onServiceIconChange()" ${dis}>
            ${ICON_OPTIONS.map(o => `<option value="${o.key}" ${s.icon === o.key ? 'selected' : ''}>${esc(o.label)}</option>`).join('')}
            <option value="custom" ${!iconIsKey ? 'selected' : ''}>Emoji…</option>
          </select>
          <label for="svcIconCustom" class="sr-only">Emoji</label>
          <input type="text" id="svcIconCustom" maxlength="8" class="input-narrow" placeholder="📄" value="${iconIsKey ? '' : esc(s.icon || '')}" ${iconIsKey ? 'hidden' : ''} oninput="onServiceIconChange()" ${dis}>
        </div>
      </div>
    </div>
    <div class="field-row">
      <div class="field">
        <label for="svcCategory">Categoría *</label>
        <select id="svcCategory" ${dis}>
          <option value="">-- Seleccione --</option>
          ${allCategoriesCache.map(c => `<option value="${c.id}" ${s.category_id == c.id ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}
        </select>
      </div>
      <div class="field"><label for="svcPrice">Precio (₡) *</label><input type="number" id="svcPrice" value="${esc(s.price)}" min="0" step="500" ${dis}></div>
    </div>
    <div class="field"><label for="svcShortDesc">Descripción corta</label><input type="text" id="svcShortDesc" maxlength="300" value="${esc(s.short_description)}" placeholder="Una línea que describe el servicio" ${dis}></div>
    <div class="field"><label for="svcLongDesc">Descripción larga</label><textarea id="svcLongDesc" rows="3" maxlength="5000" placeholder="Descripción completa para el cliente" ${dis}>${esc(s.long_description)}</textarea></div>
    <div class="field-row">
      <div class="field"><label for="svcTime">Tiempo estimado</label><input type="text" id="svcTime" maxlength="100" value="${esc(s.estimated_time)}" placeholder="Ej. 3-5 días hábiles" ${dis}></div>
      <div class="field"><label for="svcPoints">% Puntos (0-100)</label><input type="number" id="svcPoints" value="${esc(s.points_percentage ?? 0)}" min="0" max="100" step="0.5" ${dis}></div>
    </div>
    <div class="field">
      <label for="svcDocs">Documentos requeridos (uno por línea)</label>
      <textarea id="svcDocs" rows="4" placeholder="Cédula del comprador&#10;Cédula del vendedor" ${dis}>${esc(s.required_documents.join('\n'))}</textarea>
      <div class="field-hint">Se muestran al cliente en el detalle del servicio.</div>
    </div>
    <div class="field">
      <label>Imagen <span class="optional">(opcional, JPG/PNG/WEBP hasta 3 MB)</span></label>
      <div class="image-field">
        <div class="image-preview" id="svcImagePreview">${img ? `<img src="${esc(img)}" alt="Imagen actual del servicio">` : '<span class="text-muted small">Sin imagen</span>'}</div>
        ${readonly ? '' : `
          <div class="image-actions">
            <label class="btn btn-outline btn-sm file-btn">Elegir imagen<input type="file" id="svcImageFile" accept="image/jpeg,image/png,image/webp" onchange="onServiceImageChange(this.files[0])"></label>
            <button class="btn btn-ghost btn-sm" type="button" id="svcImageRemove" onclick="removeServiceImage()" ${img ? '' : 'hidden'}>Quitar imagen</button>
          </div>`}
      </div>
    </div>
    <div class="field-row">
      <label class="check-label"><input type="checkbox" id="svcActive" ${s.active ? 'checked' : ''} ${dis}><span>Activo (visible en el catálogo)</span></label>
      <label class="check-label"><input type="checkbox" id="svcFeatured" ${s.featured ? 'checked' : ''} ${dis}><span>⭐ Destacado en el inicio</span></label>
    </div>
    <div id="svcError" class="form-error" role="alert" hidden></div>
  `;
  const footer = readonly
    ? '<button class="btn btn-ghost" type="button" onclick="closeModal()">Cerrar</button>'
    : `${!isNew ? '<button class="btn btn-danger mr-auto" type="button" onclick="deleteService()">Eliminar</button>' : ''}
       <button class="btn btn-ghost" type="button" onclick="closeModal()">Cancelar</button>
       <button class="btn btn-primary" type="button" id="svcSaveBtn" onclick="saveService()">Guardar</button>`;
  showModal(body, isNew ? 'Nuevo servicio' : `Editar: ${s.name}`, footer);
}

function currentIconValue() {
  const sel = $('#svcIconSel')?.value;
  return sel === 'custom' ? ($('#svcIconCustom').value.trim() || 'doc') : sel;
}

function onServiceIconChange() {
  $('#svcIconCustom').hidden = $('#svcIconSel').value !== 'custom';
  $('#svcIconPreview').innerHTML = serviceIcon(currentIconValue());
}

function onServiceImageChange(file) {
  if (!file) return;
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) { toast('Use una imagen JPG, PNG o WEBP', 'error'); return; }
  if (file.size > SERVICE_IMAGE_MAX_BYTES) { toast('La imagen supera los 3 MB', 'error'); return; }
  pendingServiceImage = { file };
  const url = URL.createObjectURL(file);
  $('#svcImagePreview').innerHTML = `<img src="${esc(url)}" alt="Vista previa de la imagen">`;
  $('#svcImageRemove').hidden = false;
}

function removeServiceImage() {
  pendingServiceImage = { remove: true };
  $('#svcImagePreview').innerHTML = '<span class="text-muted small">Sin imagen</span>';
  $('#svcImageRemove').hidden = true;
  $('#svcImageFile').value = '';
}

async function uploadServiceImage(serviceKey) {
  const file = pendingServiceImage.file;
  const ext = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' }[file.type];
  const path = `${serviceKey}/${Date.now()}.${ext}`;
  const { error } = await sb.storage.from('service-images').upload(path, file, { contentType: file.type, upsert: false });
  if (error) throw error;
  return sb.storage.from('service-images').getPublicUrl(path).data.publicUrl;
}

async function saveService() {
  const s = currentServiceEdit;
  const name = $('#svcName')?.value?.trim();
  const categoryId = parseInt($('#svcCategory')?.value) || null;
  const price = parseInt($('#svcPrice')?.value);
  if (!name) { setError('#svcError', 'Nombre requerido'); return; }
  if (!categoryId) { setError('#svcError', 'Debe seleccionar una categoría'); return; }
  if (!(price >= 0)) { setError('#svcError', 'Indique un precio válido'); return; }

  const btn = $('#svcSaveBtn');
  setBusy(btn, true, 'Guardando...');
  setError('#svcError', '');

  let imageUrl = s.image_url || null;
  try {
    if (pendingServiceImage?.file) imageUrl = await uploadServiceImage(s.id || 'nuevo');
    else if (pendingServiceImage?.remove) imageUrl = null;
  } catch (e) {
    setBusy(btn, false, 'Guardar');
    setError('#svcError', 'No se pudo subir la imagen: ' + friendlyError(e));
    return;
  }

  const docs = ($('#svcDocs')?.value || '').split('\n').map(d => d.trim()).filter(Boolean);
  const { data, error } = await sb.rpc('admin_save_service', {
    p_id: s.id,
    p_name: name,
    p_category_id: categoryId,
    p_price: price,
    p_short_description: $('#svcShortDesc')?.value?.trim() || '',
    p_long_description: $('#svcLongDesc')?.value?.trim() || '',
    p_estimated_time: $('#svcTime')?.value?.trim() || '',
    p_required_documents: docs,
    p_icon: currentIconValue(),
    p_points_percentage: parseFloat($('#svcPoints')?.value) || 0,
    p_active: $('#svcActive')?.checked || false,
    p_featured: $('#svcFeatured')?.checked || false,
    p_image_url: imageUrl,
  });
  setBusy(btn, false, 'Guardar');
  const err = rpcError(error, data);
  if (err) { setError('#svcError', err); return; }

  closeModal();
  toast(s.id ? 'Servicio actualizado' : 'Servicio creado', 'success');
  loadServices();
}

async function deleteService() {
  const s = currentServiceEdit;
  if (!confirm(`¿Eliminar el servicio "${s.name}"?\n\nSi tiene órdenes asociadas, se desactivará en vez de eliminarse.`)) return;
  const { data, error } = await sb.rpc('admin_delete_service', { p_id: s.id });
  const err = rpcError(error, data);
  if (err) { toast(err, 'error'); return; }
  closeModal();
  toast(data.message, 'success');
  loadServices();
}
