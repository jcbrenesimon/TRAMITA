async function resetUserPassword(userId) {
  const newPass = $('#newPass')?.value?.trim();
  if (!newPass || newPass.length < 6) {
    toast('Contraseña mínima de 6 caracteres', 'error');
    return;
  }

  const { data, error } = await sb.rpc('admin_reset_password', {
    p_profile_id: userId,
    p_new_password: newPass
  });

  if (error) { toast('Error: ' + error.message, 'error'); return; }
  if (!data.ok) { toast(data.error, 'error'); return; }

  toast(`✓ Contraseña reseteada para ${data.email}`, 'success');
  $('#newPass').value = '';
  alert(`Contraseña actualizada ✓\n\nEmail: ${data.email}\nNueva contraseña: ${newPass}\n\n⚠️ Compártala de forma segura con el usuario.`);
}

async function toggleUserActive(userId, activate) {
  const action = activate ? 'reactivar' : 'desactivar';
  if (!confirm(`¿Confirma ${action} este usuario?\n\n${activate ? 'Podrá iniciar sesión nuevamente.' : 'Ya no podrá iniciar sesión hasta ser reactivado.'}`)) return;

  const { data, error } = await sb.rpc('admin_toggle_user_active', {
    p_profile_id: userId,
    p_active: activate
  });

  if (error) { toast('Error: ' + error.message, 'error'); return; }
  if (!data.ok) { toast(data.error, 'error'); return; }

  toast(data.message, 'success');
  openUserModal(userId);
  if (currentView === 'users') loadUsers();
}

async function deleteUser(userId, userName) {
  const step1 = confirm(`⚠️ ELIMINAR USUARIO\n\n¿Está seguro de eliminar a "${userName}"?\n\nEsta acción:\n- Borrará los datos personales del usuario\n- Si tiene órdenes pagadas, preservará el histórico (borrado suave)\n- Si no tiene órdenes pagadas, lo borrará completamente`);
  if (!step1) return;

  const step2 = prompt(`Para confirmar, escriba: ELIMINAR`);
  if (step2 !== 'ELIMINAR') {
    toast('Cancelado. Debe escribir ELIMINAR exactamente.', 'error');
    return;
  }

  // Intentar borrado duro primero; si no se puede, hacer borrado suave
  let { data, error } = await sb.rpc('admin_delete_user', {
    p_profile_id: userId,
    p_hard_delete: true
  });

  // Si falló el borrado duro por tener órdenes pagadas, intentar suave
  if (data && !data.ok && data.error?.includes('orden(es) pagada(s)')) {
    const confirmSoft = confirm(data.error + '\n\n¿Desea hacer un borrado suave? (anonimiza datos, preserva histórico)');
    if (!confirmSoft) return;
    const res = await sb.rpc('admin_delete_user', {
      p_profile_id: userId,
      p_hard_delete: false
    });
    data = res.data;
    error = res.error;
  }

  if (error) { toast('Error: ' + error.message, 'error'); return; }
  if (!data.ok) { toast(data.error, 'error'); return; }

  closeModal();
  toast(data.message, 'success');
  loadUsers();
}

async function changeUserRole(userId) {
  const newRole = $('#changeRole')?.value;
  if (!newRole) return;
  if (!confirm(`¿Confirma cambiar el rol a "${newRole}"?`)) return;

  const { data, error } = await sb.rpc('admin_set_user_role', {
    profile_id: userId,
    new_role: newRole
  });

  if (error) { toast('Error: ' + error.message, 'error'); return; }
  if (!data.ok) { toast(data.error, 'error'); return; }

  toast('Rol actualizado', 'success');
  openUserModal(userId);
  if (currentView === 'users') loadUsers();
}

async function adjustUserPoints(userId) {
  const delta = parseInt($('#pointsDelta')?.value);
  const reason = $('#pointsReason')?.value?.trim();
  if (!delta || !reason) { toast('Complete ambos campos', 'error'); return; }

  const { data, error } = await sb.rpc('admin_adjust_points', {
    profile_id: userId,
    points_delta: delta,
    description: reason
  });

  if (error) { toast('Error: ' + error.message, 'error'); return; }
  if (!data.ok) { toast(data.error, 'error'); return; }

  toast(`Puntos ajustados. Nuevo balance: ${data.new_balance}`, 'success');
  openUserModal(userId);
}

