// ============ ACCIONES SOBRE UN USUARIO (solo admin) ============
function refreshUser() {
  openUserModal(currentUserDetail.id);
  if (currentView === 'users') loadUsers();
}

async function resetUserPassword() {
  const newPass = $('#newPass')?.value?.trim() || '';
  if (newPass.length < MIN_PASSWORD) { toast(`Contraseña mínima de ${MIN_PASSWORD} caracteres`, 'error'); return; }
  const { data, error } = await sb.rpc('admin_reset_password', { p_profile_id: currentUserDetail.id, p_new_password: newPass });
  const err = rpcError(error, data);
  if (err) { toast(err, 'error'); return; }
  $('#newPass').value = '';
  toast(`✓ Contraseña actualizada para ${data.email}. Compártala por un canal privado.`, 'success');
}

async function toggleUserActive(activate) {
  const action = activate ? 'reactivar' : 'desactivar';
  if (!confirm(`¿Confirma ${action} este usuario?\n\n${activate ? 'Podrá iniciar sesión nuevamente.' : 'Ya no podrá iniciar sesión hasta ser reactivado.'}`)) return;
  const { data, error } = await sb.rpc('admin_toggle_user_active', { p_profile_id: currentUserDetail.id, p_active: activate });
  const err = rpcError(error, data);
  if (err) { toast(err, 'error'); return; }
  toast(data.message, 'success');
  refreshUser();
}

async function deleteUser() {
  const u = currentUserDetail;
  const userName = u.name || u.email;
  if (!confirm(`⚠️ ELIMINAR USUARIO\n\n¿Está seguro de eliminar a "${userName}"?\n\n- Se borran sus datos personales\n- Si tiene órdenes pagadas se conserva el histórico (borrado suave)\n- Si no, se borra por completo`)) return;
  if (prompt('Para confirmar, escriba: ELIMINAR') !== 'ELIMINAR') { toast('Cancelado. Debe escribir ELIMINAR exactamente.', 'error'); return; }

  let { data, error } = await sb.rpc('admin_delete_user', { p_profile_id: u.id, p_hard_delete: true });
  if (data && !data.ok && data.error?.includes('orden(es) pagada(s)')) {
    if (!confirm(data.error + '\n\n¿Desea hacer un borrado suave? (anonimiza datos, preserva histórico)')) return;
    ({ data, error } = await sb.rpc('admin_delete_user', { p_profile_id: u.id, p_hard_delete: false }));
  }
  const err = rpcError(error, data);
  if (err) { toast(err, 'error'); return; }
  closeModal();
  toast(data.message, 'success');
  loadUsers();
}

async function changeUserRole() {
  const newRole = $('#changeRole')?.value;
  if (!newRole || newRole === currentUserDetail.role) return;
  if (!confirm(`¿Confirma cambiar el rol a "${ROLE_LABELS[newRole]?.text}"?`)) return;
  const { data, error } = await sb.rpc('admin_set_user_role', { p_profile_id: currentUserDetail.id, p_new_role: newRole });
  const err = rpcError(error, data);
  if (err) { toast(err, 'error'); return; }
  toast('Rol actualizado', 'success');
  refreshUser();
}

async function adjustUserPoints() {
  const delta = parseInt($('#pointsDelta')?.value);
  const reason = $('#pointsReason')?.value?.trim();
  if (!delta || !reason) { toast('Indique los puntos y el motivo', 'error'); return; }
  const { data, error } = await sb.rpc('admin_adjust_points', { p_profile_id: currentUserDetail.id, p_points_delta: delta, p_description: reason });
  const err = rpcError(error, data);
  if (err) { toast(err, 'error'); return; }
  toast(`Puntos ajustados. Nuevo balance: ${data.new_balance}`, 'success');
  refreshUser();
}
