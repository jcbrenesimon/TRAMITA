async function openUserModal(userId) {
  showModal(`<div class="page-loading"><span class="spinner" style="border-color:var(--navy);border-top-color:transparent"></span></div>`, 'Cargando...');

  const { data: u, error } = await sb.from('users_profile').select('*').eq('id', userId).single();
  if (error) { toast('Error cargando usuario', 'error'); closeModal(); return; }

  const { data: orders } = await sb.from('orders')
    .select('id, reference, total, order_status, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(10);

  const isSelf = u.user_id === currentUser.id;
  const isAdmin = currentProfile.role === 'admin';
  const canChangeRole = isAdmin && !isSelf;

  const body = `
    <div style="display:grid;grid-template-columns:1fr;gap:14px">
      <!-- DATOS PERSONALES (editables) -->
      <div class="detail-block">
        <div class="title" style="display:flex;justify-content:space-between;align-items:center">
          <span>Datos personales</span>
          ${isAdmin && !isSelf ? '<button class="btn btn-ghost btn-sm" onclick="toggleEditUser()" id="editToggleBtn" style="padding:3px 10px;font-size:11px">✏️ Editar</button>' : ''}
        </div>
        <div id="userDataView">
          <div class="detail-row"><span class="k">Nombre</span><span class="v">${u.name || '—'}</span></div>
          <div class="detail-row"><span class="k">Cédula</span><span class="v">${u.id_card || '—'}</span></div>
          <div class="detail-row"><span class="k">Correo</span><span class="v">${u.email}</span></div>
          <div class="detail-row"><span class="k">Teléfono</span><span class="v">${u.phone || '—'}</span></div>
          ${u.company ? `<div class="detail-row"><span class="k">Empresa</span><span class="v">${u.company}</span></div>` : ''}
          ${u.address ? `<div class="detail-row"><span class="k">Dirección</span><span class="v">${u.address}</span></div>` : ''}
          ${u.billing_email ? `<div class="detail-row"><span class="k">Correo fact.</span><span class="v">${u.billing_email}</span></div>` : ''}
        </div>
        <div id="userDataEdit" style="display:none">
          <div class="field"><label>Nombre</label><input type="text" id="editName" value="${u.name || ''}"></div>
          <div class="field-row">
            <div class="field"><label>Cédula</label><input type="text" id="editIdCard" value="${u.id_card || ''}"></div>
            <div class="field"><label>Teléfono</label><input type="text" id="editPhone" value="${u.phone || ''}"></div>
          </div>
          <div class="field"><label>Empresa</label><input type="text" id="editCompany" value="${u.company || ''}"></div>
          <div class="field"><label>Dirección</label><input type="text" id="editAddress" value="${u.address || ''}"></div>
          <div class="field"><label>Correo de facturación</label><input type="email" id="editBillingEmail" value="${u.billing_email || ''}"></div>
          <button class="btn btn-primary btn-block btn-sm" onclick="saveUserEdit('${u.id}')">Guardar cambios</button>
        </div>
      </div>

      <!-- CUENTA -->
      <div class="detail-block">
        <div class="title">Cuenta</div>
        <div class="detail-row"><span class="k">Rol</span><span class="v"><span class="role-badge ${ROLE_LABELS[u.role]?.cls}">${ROLE_LABELS[u.role]?.text}</span></span></div>
        <div class="detail-row"><span class="k">Estado</span><span class="v"><span class="badge ${u.active ? 'badge-success' : 'badge-muted'}">${u.active ? 'Activo' : 'Inactivo'}</span></span></div>
        <div class="detail-row"><span class="k">Puntos</span><span class="v">${u.points_balance || 0}</span></div>
        <div class="detail-row"><span class="k">Código ref.</span><span class="v mono">${u.referral_code || '—'}</span></div>
        <div class="detail-row"><span class="k">Registrado</span><span class="v">${fmtDate(u.created_at)}</span></div>
      </div>

      ${canChangeRole ? `
        <!-- ACCIONES DE ADMIN -->
        <div class="detail-block">
          <div class="title">🎭 Cambiar rol</div>
          <div style="display:flex;gap:6px;align-items:center;margin-top:6px">
            <select id="changeRole" style="flex:1;padding:8px 10px;border:1px solid var(--line);border-radius:var(--radius);font-size:13px">
              <option value="cliente" ${u.role === 'cliente' ? 'selected' : ''}>Cliente</option>
              <option value="consulta" ${u.role === 'consulta' ? 'selected' : ''}>Consulta (solo lectura)</option>
              <option value="operador" ${u.role === 'operador' ? 'selected' : ''}>Operador</option>
              <option value="admin" ${u.role === 'admin' ? 'selected' : ''}>Administrador</option>
            </select>
            <button class="btn btn-outline btn-sm" onclick="changeUserRole('${u.id}')">Guardar</button>
          </div>
        </div>

        <div class="detail-block">
          <div class="title">💰 Ajustar puntos</div>
          <div style="display:flex;gap:6px;margin-top:6px">
            <input type="number" id="pointsDelta" placeholder="Ej: 100 o -50" style="width:120px;padding:8px 10px;border:1px solid var(--line);border-radius:var(--radius);font-size:13px">
            <input type="text" id="pointsReason" placeholder="Motivo del ajuste" style="flex:1;padding:8px 10px;border:1px solid var(--line);border-radius:var(--radius);font-size:13px">
            <button class="btn btn-outline btn-sm" onclick="adjustUserPoints('${u.id}')">Aplicar</button>
          </div>
        </div>

        <div class="detail-block">
          <div class="title">🔒 Resetear contraseña</div>
          <div style="display:flex;gap:6px;margin-top:6px;align-items:center">
            <input type="text" id="newPass" placeholder="Nueva contraseña (mín. 6)" style="flex:1;padding:8px 10px;border:1px solid var(--line);border-radius:var(--radius);font-size:13px">
            <button class="btn btn-outline btn-sm" onclick="resetUserPassword('${u.id}')">Resetear</button>
          </div>
          <div style="font-size:11.5px;color:var(--ink-subtle);margin-top:4px">El usuario podrá entrar con esta contraseña y cambiarla luego.</div>
        </div>

        <div class="detail-block" style="background:${u.active ? 'var(--warning-bg)' : 'var(--success-bg)'};border-color:${u.active ? 'var(--warning)' : 'var(--success)'}">
          <div class="title">${u.active ? '⏸️ Desactivar cuenta' : '▶️ Reactivar cuenta'}</div>
          <p style="font-size:12px;color:var(--ink-muted);margin:6px 0 10px">
            ${u.active 
              ? 'El usuario no podrá iniciar sesión. Su historial se preserva.' 
              : 'El usuario volverá a poder iniciar sesión.'}
          </p>
          <button class="btn ${u.active ? 'btn-outline' : 'btn-success'} btn-sm" onclick="toggleUserActive('${u.id}', ${!u.active})" style="${u.active ? 'color:var(--warning);border-color:var(--warning)' : ''}">
            ${u.active ? 'Desactivar usuario' : 'Reactivar usuario'}
          </button>
        </div>

        <div class="detail-block" style="background:var(--danger-bg);border-color:var(--danger)">
          <div class="title" style="color:var(--danger)">🗑️ Zona peligrosa</div>
          <p style="font-size:12px;color:var(--ink-muted);margin:6px 0 10px">
            Elimina al usuario. Si tiene órdenes pagadas, se hace un borrado suave (anonimiza los datos pero preserva el histórico contable).
          </p>
          <button class="btn btn-danger btn-sm" onclick="deleteUser('${u.id}', '${u.name || u.email}')">
            Eliminar usuario
          </button>
        </div>
      ` : ''}

      <!-- ÚLTIMAS ÓRDENES -->
      <div class="detail-block">
        <div class="title">Últimas órdenes (${orders?.length || 0})</div>
        ${orders && orders.length > 0 ? orders.map(o => {
          const os = ORDER_LABELS[o.order_status];
          return `
            <div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid var(--line-soft);cursor:pointer" onclick="openOrderModal('${o.id}')">
              <div>
                <div class="mono" style="font-size:12.5px;color:var(--navy);font-weight:500">${o.reference}</div>
                <div style="font-size:11.5px;color:var(--ink-subtle)">${fmtDate(o.created_at)}</div>
              </div>
              <div style="text-align:right">
                <span class="badge ${os.cls}" style="font-size:10px">${os.text}</span>
                <div style="font-size:12.5px;font-weight:500;margin-top:3px">${fmt(o.total)}</div>
              </div>
            </div>
          `;
        }).join('') : '<p style="color:var(--ink-subtle);font-size:13px">Sin órdenes aún.</p>'}
      </div>
    </div>
  `;

  showModal(body, u.name || u.email, `<button class="btn btn-ghost" onclick="closeModal()">Cerrar</button>`);
}

function toggleEditUser() {
  const view = $('#userDataView');
  const edit = $('#userDataEdit');
  const btn = $('#editToggleBtn');
  if (view.style.display === 'none') {
    view.style.display = 'block';
    edit.style.display = 'none';
    btn.innerHTML = '✏️ Editar';
  } else {
    view.style.display = 'none';
    edit.style.display = 'block';
    btn.innerHTML = '✕ Cancelar';
  }
}

async function saveUserEdit(userId) {
  const { data, error } = await sb.rpc('admin_update_user', {
    p_profile_id: userId,
    p_name: $('#editName')?.value?.trim(),
    p_phone: $('#editPhone')?.value?.trim(),
    p_id_card: $('#editIdCard')?.value?.trim(),
    p_company: $('#editCompany')?.value?.trim(),
    p_address: $('#editAddress')?.value?.trim(),
    p_billing_email: $('#editBillingEmail')?.value?.trim()
  });

  if (error) { toast('Error: ' + error.message, 'error'); return; }
  if (!data.ok) { toast(data.error, 'error'); return; }

  toast('Datos actualizados', 'success');
  openUserModal(userId);
  if (currentView === 'users') loadUsers();
}

