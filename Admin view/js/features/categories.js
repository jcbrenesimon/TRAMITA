// ============ CATEGORÍAS ============
async function renderCategories() {
  setPageTitle('Categorías');
  const isAdmin = currentProfile.role === 'admin';
  $('#content').innerHTML = `
    <div style="margin-bottom:20px;display:flex;justify-content:space-between;align-items:center;gap:14px;flex-wrap:wrap">
      <p style="color:var(--ink-muted);margin:0">Organice los servicios por categorías.</p>
      ${isAdmin ? `<button class="btn btn-primary" onclick="openCategoryModal()">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
        Crear categoría
      </button>` : ''}
    </div>
    <div id="categoriesList"></div>
  `;
  await loadCategories();
}

async function loadCategories() {
  $('#categoriesList').innerHTML = '<div class="page-loading"><span class="spinner" style="border-color:var(--navy);border-top-color:transparent"></span></div>';
  const { data, error } = await sb.from('categories').select('*, services(count)').order('display_order');
  if (error) { $('#categoriesList').innerHTML = `<div class="empty"><p>Error: ${error.message}</p></div>`; return; }

  if (!data || data.length === 0) {
    $('#categoriesList').innerHTML = `<div class="empty"><h3>Sin categorías</h3><p>Cree la primera categoría para organizar sus servicios.</p></div>`;
    return;
  }

  const isAdmin = currentProfile.role === 'admin';
  $('#categoriesList').innerHTML = `
    <div class="data-card">
      <div class="data-head"><h3>${data.length} categoría${data.length !== 1 ? 's' : ''}</h3></div>
      <div class="table-scroll">
        <table>
          <thead><tr><th>Orden</th><th>Nombre</th><th>Servicios</th><th>Estado</th><th></th></tr></thead>
          <tbody>
            ${data.map(c => `
              <tr class="clickable" onclick="openCategoryModal(${c.id})">
                <td class="mono">${c.display_order || 0}</td>
                <td class="text-navy" style="font-weight:500">${c.name}</td>
                <td class="text-muted">${c.services?.[0]?.count || 0}</td>
                <td>${c.active ? '<span class="badge badge-success">Activa</span>' : '<span class="badge badge-muted">Inactiva</span>'}</td>
                <td class="text-right">${isAdmin ? `<button class="btn btn-ghost btn-sm" onclick="event.stopPropagation();openCategoryModal(${c.id})">Editar</button>` : ''}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

async function openCategoryModal(categoryId) {
  const isNew = !categoryId;
  let c = { id: null, name: '', display_order: 0, active: true };

  if (!isNew) {
    const { data, error } = await sb.from('categories').select('*').eq('id', categoryId).single();
    if (error) { toast('Error cargando categoría', 'error'); return; }
    c = data;
  }

  const body = `
    <div class="field"><label>Nombre *</label><input type="text" id="catName" value="${c.name || ''}" placeholder="Ej. Vehículos"></div>
    <div class="field"><label>Orden de visualización</label><input type="number" id="catOrder" value="${c.display_order || 0}" min="0"><div class="field-hint">Menor número = aparece primero</div></div>
    <div class="field">
      <label style="display:flex;align-items:center;gap:8px;cursor:pointer">
        <input type="checkbox" id="catActive" ${c.active ? 'checked' : ''} style="width:auto">
        <span>Activa (visible en el catálogo)</span>
      </label>
    </div>
    <div id="catError" style="display:none;color:var(--danger);font-size:12.5px;margin-top:10px"></div>
  `;
  const footer = `
    ${!isNew ? `<button class="btn btn-danger" onclick="deleteCategory(${c.id}, '${(c.name || '').replace(/'/g,"\\'")}')"  style="margin-right:auto">Eliminar</button>` : ''}
    <button class="btn btn-ghost" onclick="closeModal()">Cancelar</button>
    <button class="btn btn-primary" onclick="saveCategory(${c.id || 'null'})">Guardar</button>
  `;
  showModal(body, isNew ? 'Nueva categoría' : `Editar: ${c.name}`, footer);
}

async function saveCategory(categoryId) {
  const name = $('#catName')?.value?.trim();
  const errorEl = $('#catError');
  if (!name) { errorEl.textContent = 'Nombre requerido'; errorEl.style.display = 'block'; return; }

  const { data, error } = await sb.rpc('admin_save_category', {
    p_id: categoryId,
    p_name: name,
    p_display_order: parseInt($('#catOrder')?.value) || 0,
    p_active: $('#catActive')?.checked || false
  });

  if (error) { errorEl.textContent = error.message; errorEl.style.display = 'block'; return; }
  if (!data.ok) { errorEl.textContent = data.error; errorEl.style.display = 'block'; return; }

  closeModal();
  toast(categoryId ? 'Categoría actualizada' : 'Categoría creada', 'success');
  loadCategories();
}

async function deleteCategory(categoryId, name) {
  if (!confirm(`¿Eliminar la categoría "${name}"?\n\nSi tiene servicios asociados, se desactivará.`)) return;
  const { data, error } = await sb.rpc('admin_delete_category', { p_id: categoryId });
  if (error) { toast('Error: ' + error.message, 'error'); return; }
  if (!data.ok) { toast(data.error, 'error'); return; }
  closeModal();
  toast(data.message, 'success');
  loadCategories();
}

