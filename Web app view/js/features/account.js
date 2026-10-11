// ============================================================
// MI CUENTA
// ============================================================
async function loadAccount() {
  if (!currentUser) { go('login'); return; }
  await checkSession();
  if (!currentProfile) return;
  const firstName = (currentProfile.name || '').trim().split(' ')[0] || 'Usuario';
  $('#accountGreeting').innerHTML = `Hola, <em>${esc(firstName)}</em>.`;
  $('#accName').value = currentProfile.name || '';
  $('#accIdCard').value = currentProfile.id_card || '';
  $('#accPhone').value = currentProfile.phone || '';
  $('#accCompany').value = currentProfile.company || '';
  $('#accAddress').value = currentProfile.address || '';
  $('#accEmail').value = currentProfile.email || '';
  $('#accBillingEmail').value = currentProfile.billing_email || '';
  $('#accPointsDisplay').textContent = currentProfile.points_balance || 0;
  $('#accReferralCode').textContent = currentProfile.referral_code || '—';
}

async function saveAccount(e) {
  e.preventDefault();
  if (!currentProfile) return;
  // Solo datos personales: rol, puntos y código los protege la base de datos
  const { error } = await sb.from('users_profile').update({
    name: $('#accName').value.trim(),
    id_card: $('#accIdCard').value.trim(),
    phone: $('#accPhone').value.trim(),
    company: $('#accCompany').value.trim(),
    address: $('#accAddress').value.trim(),
    billing_email: $('#accBillingEmail').value.trim(),
  }).eq('id', currentProfile.id);
  if (error) { toast('Error al guardar: ' + friendlyError(error), true); return; }
  await checkSession();
  toast('Cambios guardados');
}
