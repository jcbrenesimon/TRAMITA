// ============ FICHA DE USUARIO ============
let currentUserDetail = null;

async function openUserModal(userId) {
  showModal(LOADING, 'Cargando...');

  const [{ data: u, error }, { data: orders }] = await Promise.all([
    sb.from('users_profile').select('*').eq('id', userId).single(),
    sb.from('orders').select('id, reference, total, order_status, created_at').eq('user_id', userId)
      .order('created_at', { ascending: false }).limit(10),
  ]);
  if (error) { toast('Error cargando usuario', 'error'); closeModal(); return; }
  currentUserDetail = u;

  const isSelf = u.user_id === currentUser.id;
  const canManage = isAdmin() && !isSelf;

  const body = `
    <div class="stack-14">
      <div class="detail-block">
        <div class="title title-row">
          <span>Datos personales</span>
          ${canManage ? '<button class="btn btn-ghost btn-xs" type="button" onclick="toggleEditUser()" id="editToggleBtn">✏️ Editar</button>' : ''}
        </div>
        <div id="userDataView">
          <div class="detail-row"><span class="k">Nombre</span><span class="v">${esc(u.name || '—')}</span></div>
          <div class="detail-row"><span class="k">Cédula</span><span class="v">${esc(u.id_card || '—')}</span></div>
          <div class="detail-row"><span class="k">Correo</span><span class="v break">${esc(u.email)}</span></div>
          <div class="detail-row"><span class="k">Teléfono</span><span class="v">${esc(u.phone || '—')}</span></div>
          ${u.company ? `<div class="detail-row"><span class="k">Empresa</span><span class="v">${esc(u.company)}</span></div>` : ''}
          ${u.address ? `<div class="detail-row"><span class="k">Dirección</span><span class="v">${esc(u.address)}</span></div>` : ''}
          ${u.billing_email ? `<div class="detail-row"><span class="k">Correo fact.</span><span class="v break">${esc(u.billing_email)}</span></div>` : ''}
          ${u.terms_accepted_at ? `<div class="detail-row"><span class="k">Aceptó términos</span><span class="v">${esc(fmtDateOnly(u.terms_accepted_at))}</span></div>` : ''}
        </div>
        <div id="userDataEdit" hidden>
          <div class="field"><label for="editName">Nombre</label><input type="text" id="editName" maxlength="150"></div>
          <div class="field-row">
            <div class="field"><label for="editIdCard">Cédula</label><input type="text" id="editIdCard" maxlength="30"></div>
            <div class="field"><label for="editPhone">Teléfono</label><input type="text" id="editPhone" maxlength="30"></div>
          </div>
          <div class="field"><label for="editCompany">Empresa</label><input type="text" id="editCompany" maxlength="150"></div>
          <div class="field"><label for="editAddress">Dirección</label><input type="text" id="editAddress" maxlength="300"></div>
          <div class="field"><label for="editBillingEmail">Correo de facturación</label><input type="email" id="editBillingEmail" maxlength="200"></div>
          <button class="btn btn-primary btn-block btn-sm" type="button" onclick="saveUserEdit()">Guardar cambios</button>
        </div>
      </div>

      <div class="detail-block">
        <div class="title">Cuenta</div>
        <div class="detail-row"><span class="k">Rol</span><span class="v"><span class="role-badge ${ROLE_LABELS[u.role]?.cls}">${esc(ROLE_LABELS[u.role]?.text || u.role)}</span></span></div>
        <div class="detail-row"><span class="k">Estado</span><span class="v"><span class="badge ${u.active ? 'badge-success' : 'badge-muted'}">${u.active ? 'Activo' : 'Inactivo'}</span></span></div>
        <div class="detail-row"><span class="k">Puntos</span><span class="v">${esc(u.points_balance || 0)}</span></div>
        <div class="detail-row"><span class="k">Código ref.</span><span class="v mono">${esc(u.referral_code || '—')}</span></div>
        <div class="detail-row"><span class="k">Registrado</span><span class="v">${esc(fmtDate(u.created_at))}</span></div>
      </div>

      ${canManage ? `
        <div class="detail-block">
          <div class="title">🎭 Cambiar rol</div>
          <div class="inline-form">
            <label for="changeRole" class="sr-only">Rol</label>
            <select id="changeRole">
              ${['cliente', 'consulta', 'operador', 'admin'].map(r => `<option value="${r}" ${u.role === r ? 'selected' : ''}>${esc(ROLE_LABELS[r].text)}</option>`).join('')}
            </select>
            <button class="btn btn-outline btn-sm" type="button" onclick="changeUserRole()">Guardar</button>
          </div>
        </div>

        <div class="detail-block">
          <div class="title">💰 Ajustar puntos</div>
          <div class="inline-form">
            <label for="pointsDelta" class="sr-only">Puntos</label>
            <input type="number" id="pointsDelta" class="input-narrow" placeholder="100 o -50">
            <label for="pointsReason" class="sr-only">Motivo</label>
            <input type="text" id="pointsReason" maxlength="300" placeholder="Motivo del ajuste">
            <button class="btn btn-outline btn-sm" type="button" onclick="adjustUserPoints()">Aplicar</button>
          </div>
        </div>

        <div class="detail-block">
          <div class="title">🔒 Resetear contraseña</div>
          <div class="inline-form">
            <label for="newPass" class="sr-only">Nueva contraseña</label>
            <input type="text" id="newPass" minlength="${MIN_PASSWORD}" autocomplete="off" placeholder="Nueva contraseña (mín. ${MIN_PASSWORD})">
            <button class="btn btn-outline btn-sm" type="button" onclick="resetUserPassword()">Resetear</button>
          </div>
          <div class="field-hint">Mejor alternativa: pídale usar "¿Olvidó su contraseña?" en la app pública.</div>
        </div>

        <div class="detail-block ${u.active ? 'block-warning' : 'block-success'}">
          <div class="title">${u.active ? '⏸️ Desactivar cuenta' : '▶️ Reactivar cuenta'}</div>
          <p class="block-text">${u.active ? 'El usuario no podrá iniciar sesión. Su historial se preserva.' : 'El usuario volverá a poder iniciar sesión.'}</p>
          <button class="btn ${u.active ? 'btn-warning-outline' : 'btn-success'} btn-sm" type="button" onclick="toggleUserActive(${!u.active})">
            ${u.active ? 'Desactivar usuario' : 'Reactivar usuario'}
          </button>
        </div>

        <div class="detail-block block-danger">
          <div class="title text-danger">🗑️ Zona peligrosa</div>
          <p class="block-text">Elimina al usuario. Si tiene órdenes pagadas, se hace un borrado suave (anonimiza los datos y conserva el histórico contable).</p>
          <button class="btn btn-danger btn-sm" type="button" onclick="deleteUser()">Eliminar usuario</button>
        </div>
      ` : ''}

      <div class="detail-block">
        <div class="title">Últimas órdenes (${orders?.length || 0})</div>
        ${orders?.length ? orders.map(o => `
          <div class="list-row clickable" ${openAttrs('order', o.id)}>
            <div>
              <div class="list-row-title mono">${esc(o.reference)}</div>
              <div class="list-row-sub">${esc(fmtDate(o.created_at))}</div>
            </div>
            <div class="right">
              ${badge(ORDER_LABELS, o.order_status)}
              <div class="list-row-amount">${fmt(o.total)}</div>
            </div>
          </div>`).join('') : '<p class="text-muted small">Sin órdenes aún.</p>'}
      </div>
    </div>
  `;

  showModal(body, u.name || u.email, '<button class="btn btn-ghost" type="button" onclick="closeModal()">Cerrar</button>');
}

function toggleEditUser() {
  const u = currentUserDetail;
  const editing = $('#userDataEdit').hidden;
  $('#userDataView').hidden = editing;
  $('#userDataEdit').hidden = !editing;
  $('#editToggleBtn').textContent = editing ? '✕ Cancelar' : '✏️ Editar';
  if (editing) {
    // Valores asignados por propiedad: no se interpretan como HTML
    $('#editName').value = u.name || '';
    $('#editIdCard').value = u.id_card || '';
    $('#editPhone').value = u.phone || '';
    $('#editCompany').value = u.company || '';
    $('#editAddress').value = u.address || '';
    $('#editBillingEmail').value = u.billing_email || '';
    $('#editName').focus();
  }
}

async function saveUserEdit() {
  const { data, error } = await sb.rpc('admin_update_user', {
    p_profile_id: currentUserDetail.id,
    p_name: $('#editName')?.value?.trim(),
    p_phone: $('#editPhone')?.value?.trim(),
    p_id_card: $('#editIdCard')?.value?.trim(),
    p_company: $('#editCompany')?.value?.trim(),
    p_address: $('#editAddress')?.value?.trim(),
    p_billing_email: $('#editBillingEmail')?.value?.trim(),
  });
  const err = rpcError(error, data);
  if (err) { toast(err, 'error'); return; }
  toast('Datos actualizados', 'success');
  openUserModal(currentUserDetail.id);
  if (currentView === 'users') loadUsers();
}
