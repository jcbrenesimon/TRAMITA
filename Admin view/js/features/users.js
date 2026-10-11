// ============ USUARIOS (búsqueda y paginación en el servidor) ============
async function renderUsers() {
  setPageTitle('Usuarios');
  $('#content').innerHTML = `
    <div class="view-intro view-intro-actions">
      <p>Clientes y equipo de Tramitá.</p>
      ${isAdmin() ? `
        <button class="btn btn-primary" type="button" onclick="openCreateUserModal()">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          Crear usuario
        </button>` : ''}
    </div>
    <form class="search-row" role="search" onsubmit="event.preventDefault();usersSearch=$('#usersSearchInput').value.trim();usersPage=0;loadUsers()">
      <label for="usersSearchInput" class="sr-only">Buscar usuarios</label>
      <input type="search" id="usersSearchInput" class="search-input" placeholder="Nombre, correo, cédula o teléfono" value="${esc(usersSearch)}">
      <button class="btn btn-outline btn-sm" type="submit">Buscar</button>
    </form>
    <div class="filters" id="usersFilters" role="toolbar" aria-label="Filtrar usuarios"></div>
    <div id="usersList">${LOADING}</div>
  `;
  await loadUsers();
}

function openCreateUserModal() {
  const body = `
    <p class="text-muted mb-14">Cree un usuario para el equipo. Tendrá acceso inmediato.</p>
    <div class="field">
      <label for="newUserName">Nombre completo</label>
      <input type="text" id="newUserName" maxlength="150" placeholder="Ej. María González" required>
    </div>
    <div class="field-row">
      <div class="field">
        <label for="newUserEmail">Correo</label>
        <input type="email" id="newUserEmail" placeholder="maria@tramita.app" required>
      </div>
      <div class="field">
        <label for="newUserPhone">Teléfono</label>
        <input type="tel" id="newUserPhone" maxlength="30" placeholder="8888-8888">
      </div>
    </div>
    <div class="field-row">
      <div class="field">
        <label for="newUserPassword">Contraseña temporal</label>
        <input type="text" id="newUserPassword" minlength="${MIN_PASSWORD}" placeholder="Mínimo ${MIN_PASSWORD} caracteres" autocomplete="off" required>
        <div class="field-hint">Compártala por un canal privado. El usuario puede cambiarla con "¿Olvidó su contraseña?".</div>
      </div>
      <div class="field">
        <label for="newUserRole">Rol</label>
        <select id="newUserRole">
          <option value="operador">Operador</option>
          <option value="admin">Administrador</option>
          <option value="consulta">Consulta (solo lectura)</option>
          <option value="cliente">Cliente</option>
        </select>
      </div>
    </div>
    <div class="field">
      <label for="newUserIdCard">Cédula <span class="optional">(opcional)</span></label>
      <input type="text" id="newUserIdCard" maxlength="30" placeholder="1-1234-5678">
    </div>
    <div id="createUserError" class="form-error" role="alert" hidden></div>
  `;
  const footer = `
    <button class="btn btn-ghost" type="button" onclick="closeModal()">Cancelar</button>
    <button class="btn btn-primary" type="button" id="createUserBtn" onclick="createUser()">Crear usuario</button>
  `;
  showModal(body, 'Crear nuevo usuario', footer);
}

async function createUser() {
  const email = $('#newUserEmail')?.value?.trim();
  const password = $('#newUserPassword')?.value || '';
  const name = $('#newUserName')?.value?.trim();
  const role = $('#newUserRole')?.value;

  if (!email || !password || !name || !role) { setError('#createUserError', 'Complete nombre, correo, contraseña y rol.'); return; }
  if (password.length < MIN_PASSWORD) { setError('#createUserError', `La contraseña debe tener al menos ${MIN_PASSWORD} caracteres.`); return; }

  const btn = $('#createUserBtn');
  setBusy(btn, true, 'Creando...');
  setError('#createUserError', '');
  const { data, error } = await sb.rpc('admin_create_user', {
    p_email: email, p_password: password, p_name: name,
    p_phone: $('#newUserPhone')?.value?.trim() || '', p_id_card: $('#newUserIdCard')?.value?.trim() || '', p_role: role,
  });
  setBusy(btn, false, 'Crear usuario');
  const err = rpcError(error, data);
  if (err) { setError('#createUserError', err); return; }

  closeModal();
  toast(`✓ Usuario "${name}" creado`, 'success');
  loadUsers();
}

async function loadUsers() {
  $('#usersFilters').innerHTML = [
    ['all', 'Todos'], ['cliente', 'Clientes'], ['operador', 'Operadores'], ['admin', 'Admins'], ['consulta', 'Consulta'],
  ].map(([k, label]) =>
    `<button type="button" class="chip ${usersFilter === k ? 'active' : ''}" aria-pressed="${usersFilter === k}" onclick="filterUsers('${k}')">${label}</button>`
  ).join('');
  const list = $('#usersList');
  list.innerHTML = LOADING;

  const { data, error } = await sb.rpc('admin_search_users', {
    p_search: usersSearch, p_role: usersFilter, p_limit: PAGE_SIZE, p_offset: usersPage * PAGE_SIZE,
  });
  if (currentView !== 'users') return;
  const err = rpcError(error, data);
  if (err) { list.innerHTML = emptyState('Error', err); return; }
  if (!data.total) { list.innerHTML = emptyState('Sin usuarios', 'No hay usuarios con estos filtros.'); return; }

  list.innerHTML = `
    <div class="data-card">
      <div class="data-head"><h3>${data.total} usuario${data.total !== 1 ? 's' : ''}</h3></div>
      ${dataTable(
        [{ label: 'Nombre' }, { label: 'Correo' }, { label: 'Teléfono' }, { label: 'Rol' }, { label: 'Puntos' }, { label: 'Estado' }],
        data.rows.map(u => ({
          open: ['user', u.id],
          cells: [
            `${esc(u.name || '—')}<span class="cell-sub mono">${esc(u.id_card || '')}</span>`,
            `<span class="text-muted break">${esc(u.email)}</span>`,
            `<span class="text-muted">${esc(u.phone || '—')}</span>`,
            `<span class="role-badge ${ROLE_LABELS[u.role]?.cls || 'role-cliente'}">${esc(ROLE_LABELS[u.role]?.text || u.role)}</span>`,
            `<span class="text-navy">${esc(u.points_balance || 0)}</span>`,
            `<span class="badge ${u.active ? 'badge-success' : 'badge-muted'}">${u.active ? 'Activo' : 'Inactivo'}</span>`,
          ],
        })))}
      ${pager(data.total, usersPage, 'goUsersPage')}
    </div>`;
}

function filterUsers(k) { usersFilter = k; usersPage = 0; loadUsers(); }
function goUsersPage(p) { usersPage = Math.max(0, p); loadUsers(); window.scrollTo(0, 0); }
