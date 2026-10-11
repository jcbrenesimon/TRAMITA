// ============ USUARIOS ============
async function renderUsers() {
  setPageTitle('Usuarios');
  $('#content').innerHTML = `
    <div style="margin-bottom:20px;display:flex;justify-content:space-between;align-items:center;gap:14px;flex-wrap:wrap">
      <p style="color:var(--ink-muted);margin:0">Clientes y equipo de Tramitá.</p>
      ${currentProfile.role === 'admin' ? `
        <button class="btn btn-primary" onclick="openCreateUserModal()">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          Crear usuario
        </button>
      ` : ''}
    </div>
    <div class="filters" id="usersFilters"></div>
    <div id="usersList"></div>
  `;
  await loadUsers();
}

function openCreateUserModal() {
  const body = `
    <p style="margin-bottom:14px;color:var(--ink-muted)">Cree un nuevo usuario para el equipo. El sistema le dará acceso inmediato.</p>
    <div class="field">
      <label>Nombre completo</label>
      <input type="text" id="newUserName" placeholder="Ej. María González" required>
    </div>
    <div class="field-row">
      <div class="field">
        <label>Correo</label>
        <input type="email" id="newUserEmail" placeholder="maria@tramita.app" required>
      </div>
      <div class="field">
        <label>Teléfono</label>
        <input type="tel" id="newUserPhone" placeholder="8888-8888">
      </div>
    </div>
    <div class="field-row">
      <div class="field">
        <label>Contraseña temporal</label>
        <input type="text" id="newUserPassword" placeholder="Mínimo 6 caracteres" required>
        <div class="field-hint">El usuario podrá cambiarla después</div>
      </div>
      <div class="field">
        <label>Rol</label>
        <select id="newUserRole">
          <option value="operador">Operador</option>
          <option value="admin">Administrador</option>
          <option value="consulta">Consulta (solo lectura)</option>
          <option value="cliente">Cliente</option>
        </select>
      </div>
    </div>
    <div class="field">
      <label>Cédula <span style="color:var(--ink-subtle);font-weight:400">(opcional)</span></label>
      <input type="text" id="newUserIdCard" placeholder="1-1234-5678">
    </div>
    <div id="createUserError" style="display:none;color:var(--danger);font-size:12.5px;margin-top:10px"></div>
  `;
  const footer = `
    <button class="btn btn-ghost" onclick="closeModal()">Cancelar</button>
    <button class="btn btn-primary" id="createUserBtn" onclick="createUser()">Crear usuario</button>
  `;
  showModal(body, 'Crear nuevo usuario', footer);
}

async function createUser() {
  const email = $('#newUserEmail')?.value?.trim();
  const password = $('#newUserPassword')?.value;
  const name = $('#newUserName')?.value?.trim();
  const phone = $('#newUserPhone')?.value?.trim();
  const idCard = $('#newUserIdCard')?.value?.trim();
  const role = $('#newUserRole')?.value;
  const errorEl = $('#createUserError');

  if (!email || !password || !name || !role) {
    errorEl.textContent = 'Complete los campos obligatorios (nombre, correo, contraseña, rol)';
    errorEl.style.display = 'block';
    return;
  }
  if (password.length < 6) {
    errorEl.textContent = 'La contraseña debe tener al menos 6 caracteres';
    errorEl.style.display = 'block';
    return;
  }

  const btn = $('#createUserBtn');
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner"></span> Creando...';
  errorEl.style.display = 'none';

  const { data, error } = await sb.rpc('admin_create_user', {
    p_email: email,
    p_password: password,
    p_name: name,
    p_phone: phone || '',
    p_id_card: idCard || '',
    p_role: role
  });

  btn.disabled = false;
  btn.textContent = 'Crear usuario';

  if (error) {
    errorEl.textContent = 'Error: ' + error.message;
    errorEl.style.display = 'block';
    return;
  }
  if (!data.ok) {
    errorEl.textContent = data.error;
    errorEl.style.display = 'block';
    return;
  }

  closeModal();
  toast(`✓ Usuario "${name}" creado`, 'success');
  loadUsers();
}

async function loadUsers() {
  $('#usersFilters').innerHTML = [
    ['all', 'Todos'],
    ['cliente', 'Clientes'],
    ['operador', 'Operadores'],
    ['admin', 'Admins'],
    ['consulta', 'Consulta'],
  ].map(([k,label]) =>
    `<button class="chip ${usersFilter === k ? 'active' : ''}" onclick="filterUsers('${k}')">${label}</button>`
  ).join('');

  $('#usersList').innerHTML = '<div class="page-loading"><span class="spinner" style="border-color:var(--navy);border-top-color:transparent"></span></div>';

  let query = sb.from('users_profile')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(500);

  if (usersFilter !== 'all') query = query.eq('role', usersFilter);

  const { data, error } = await query;
  if (error) { $('#usersList').innerHTML = `<div class="empty"><p>Error: ${error.message}</p></div>`; return; }

  if (!data || data.length === 0) {
    $('#usersList').innerHTML = `<div class="empty"><h3>Sin usuarios</h3><p>No hay usuarios en esta categoría.</p></div>`;
    return;
  }

  $('#usersList').innerHTML = `
    <div class="data-card">
      <div class="data-head">
        <h3>${data.length} usuario${data.length !== 1 ? 's' : ''}</h3>
      </div>
      <div class="table-scroll">
        <table>
          <thead>
            <tr><th>Nombre</th><th>Correo</th><th>Teléfono</th><th>Rol</th><th>Puntos</th><th>Estado</th><th></th></tr>
          </thead>
          <tbody>
            ${data.map(u => {
              const rl = ROLE_LABELS[u.role] || {text:u.role,cls:'role-cliente'};
              return `
                <tr class="clickable" onclick="openUserModal('${u.id}')">
                  <td>${u.name || '—'}<br><span class="text-muted mono" style="font-size:11px">${u.id_card || ''}</span></td>
                  <td class="text-muted">${u.email}</td>
                  <td class="text-muted">${u.phone || '—'}</td>
                  <td><span class="role-badge ${rl.cls}">${rl.text}</span></td>
                  <td class="text-navy">${u.points_balance || 0}</td>
                  <td><span class="badge ${u.active ? 'badge-success' : 'badge-muted'}">${u.active ? 'Activo' : 'Inactivo'}</span></td>
                  <td class="text-right"><button class="btn btn-ghost btn-sm" onclick="event.stopPropagation();openUserModal('${u.id}')">Ver</button></td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

function filterUsers(k) { usersFilter = k; loadUsers(); }

