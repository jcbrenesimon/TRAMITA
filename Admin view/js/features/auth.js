// ============ AUTH ============
const STAFF_ROLES = ['admin', 'operador', 'consulta'];

function showScreen(name) {
  show('#loginWrap', name === 'login');
  show('#deniedWrap', name === 'denied');
  $('#app').classList.toggle('active', name === 'app');
}

function show(sel, visible) {
  const el = $(sel);
  if (el) el.hidden = !visible;
}

async function checkSession() {
  const { data: { session } } = await sb.auth.getSession();
  currentUser = session?.user || null;
  currentProfile = null;

  if (!currentUser) { showScreen('login'); return false; }

  const { data: profile, error } = await sb.from('users_profile')
    .select('*')
    .eq('user_id', currentUser.id)
    .maybeSingle();

  if (error || !profile) {
    await sb.auth.signOut();
    showScreen('login');
    return false;
  }
  currentProfile = profile;

  if (!STAFF_ROLES.includes(profile.role) || !profile.active) {
    showScreen('denied');
    return false;
  }

  showApp();
  return true;
}

function showApp() {
  showScreen('app');
  $('#sidebarAvatar').textContent = getInitials(currentProfile.name || currentProfile.email);
  $('#sidebarName').textContent = currentProfile.name || currentProfile.email.split('@')[0];
  $('#sidebarRole').textContent = ROLE_LABELS[currentProfile.role]?.text || currentProfile.role;
  routeFromHash();
}

async function doLogin(e) {
  e.preventDefault();
  const btn = $('#loginBtn');
  setBusy(btn, true, 'Ingresando...');
  setError('#loginError', '');

  const { error } = await sb.auth.signInWithPassword({
    email: $('#loginEmail').value.trim(),
    password: $('#loginPassword').value,
  });
  setBusy(btn, false, 'Ingresar al panel');

  if (error) { setError('#loginError', friendlyError(error)); return; }
  $('#loginPassword').value = '';
  await checkSession();
}

async function doLogout() {
  await sb.auth.signOut();
  currentUser = null;
  currentProfile = null;
  window.location.hash = '';
  window.location.reload();
}
