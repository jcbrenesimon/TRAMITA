// ============ CATEGORÍAS ============
let currentCategoryEdit = null;

async function renderCategories() {
  setPageTitle('Categorías');
  $('#content').innerHTML = `
    <div class="view-intro view-intro-actions">
      <p>Organice los servicios por categorías.</p>
      ${isAdmin() ? `<button class="btn btn-primary" type="button" onclick="openCategoryModal()">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
        Crear categoría
      </button>` : ''}
    </div>
    <div id="categoriesList">${LOADING}</div>
  `;
  await loadCategories();
}

async function loadCategories() {
  const { data, error } = await sb.from('categories').select('*, services(count)').order('display_order');
  if (currentView !== 'categories') return;
  const list = $('#categoriesList');
  if (error) { list.innerHTML = emptyState('Error', friendlyError(error)); return; }
  if (!data.length) { list.innerHTML = emptyState('Sin categorías', 'Cree la primera categoría para organizar sus servicios.'); return; }

  list.innerHTML = `
    <div class="data-card">
      <div class="data-head"><h3>${data.length} categoría${data.length !== 1 ? 's' : ''}</h3></div>
      ${dataTable(
        [{ label: 'Orden' }, { label: 'Nombre' }, { label: 'Servicios' }, { label: 'Estado' }],
        data.map(c => ({
          open: ['category', c.id],
          cells: [
            `<span class="mono">${esc(c.display_order || 0)}</span>`,
            `<span class="text-navy">${esc(c.name)}</span>`,
            `<span class="text-muted">${esc(c.services?.[0]?.count || 0)}</span>`,
            c.active ? '<span class="badge badge-success">Activa</span>' : '<span class="badge badge-muted">Inactiva</span>',
          ],
        })))}
    </div>`;
}

async function openCategoryModal(categoryId) {
  const isNew = !categoryId;
  let c = { id: null, name: '', display_order: 0, active: true };
  if (!isNew) {
    const { data, error } = await sb.from('categories').select('*').eq('id', categoryId).single();
    if (error) { toast('Error cargando categoría', 'error'); return; }
    c = data;
  }
  currentCategoryEdit = c;
  const dis = isAdmin() ? '' : 'disabled';

  const body = `
    <div class="field"><label for="catName">Nombre *</label><input type="text" id="catName" maxlength="100" value="${esc(c.name)}" placeholder="Ej. Vehículos" ${dis}></div>
    <div class="field"><label for="catOrder">Orden de visualización</label><input type="number" id="catOrder" value="${esc(c.display_order || 0)}" min="0" ${dis}><div class="field-hint">Menor número = aparece primero</div></div>
    <label class="check-label"><input type="checkbox" id="catActive" ${c.active ? 'checked' : ''} ${dis}><span>Activa (visible en el catálogo)</span></label>
    <div id="catError" class="form-error" role="alert" hidden></div>
  `;
  const footer = !isAdmin()
    ? '<button class="btn btn-ghost" type="button" onclick="closeModal()">Cerrar</button>'
    : `${!isNew ? '<button class="btn btn-danger mr-auto" type="button" onclick="deleteCategory()">Eliminar</button>' : ''}
       <button class="btn btn-ghost" type="button" onclick="closeModal()">Cancelar</button>
       <button class="btn btn-primary" type="button" onclick="saveCategory()">Guardar</button>`;
  showModal(body, isNew ? 'Nueva categoría' : `Editar: ${c.name}`, footer);
}

async function saveCategory() {
  const name = $('#catName')?.value?.trim();
  if (!name) { setError('#catError', 'Nombre requerido'); return; }
  const { data, error } = await sb.rpc('admin_save_category', {
    p_id: currentCategoryEdit.id,
    p_name: name,
    p_display_order: parseInt($('#catOrder')?.value) || 0,
    p_active: $('#catActive')?.checked || false,
  });
  const err = rpcError(error, data);
  if (err) { setError('#catError', err); return; }
  closeModal();
  toast(currentCategoryEdit.id ? 'Categoría actualizada' : 'Categoría creada', 'success');
  loadCategories();
}

async function deleteCategory() {
  const c = currentCategoryEdit;
  if (!confirm(`¿Eliminar la categoría "${c.name}"?\n\nSi tiene servicios asociados, se desactivará.`)) return;
  const { data, error } = await sb.rpc('admin_delete_category', { p_id: c.id });
  const err = rpcError(error, data);
  if (err) { toast(err, 'error'); return; }
  closeModal();
  toast(data.message, 'success');
  loadCategories();
}
