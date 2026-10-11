// ============ AUTH ============
async function checkSession() {
  const { data: { session } } = await sb.auth.getSession();
  currentUser = session?.user || null;
  currentProfile = null;

  if (!currentUser) {
    showLogin();
    return false;
  }

  const { data: profile, error } = await sb.from('users_profile')
    .select('*')
    .eq('user_id', currentUser.id)
    .maybeSingle();

  if (error || !profile) {
    await sb.auth.signOut();
    showLogin();
    return false;
  }

  currentProfile = profile;

  // Validar rol de staff
  if (!['admin','operador','consulta'].includes(profile.role)) {
    showDenied();
    return false;
  }

  showApp();
  return true;
}

function showLogin() {
  $('#loginWrap').style.display = 'flex';
  $('#deniedWrap').style.display = 'none';
  $('#app').classList.remove('active');
}

function showDenied() {
  $('#loginWrap').style.display = 'none';
  $('#deniedWrap').style.display = 'flex';
  $('#app').classList.remove('active');
}

function showApp() {
  $('#loginWrap').style.display = 'none';
  $('#deniedWrap').style.display = 'none';
  $('#app').classList.add('active');

  // Llenar info de admin en sidebar
  $('#sidebarAvatar').textContent = getInitials(currentProfile.name || currentProfile.email);
  $('#sidebarName').textContent = currentProfile.name || currentProfile.email.split('@')[0];
  $('#sidebarRole').textContent = currentProfile.role;

  // Cargar primera vista
  go('dashboard');
}

async function doLogin(e) {
  e.preventDefault();
  const btn = $('#loginBtn');
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner"></span> Ingresando...';
  $('#loginError').style.display = 'none';

  const { error } = await sb.auth.signInWithPassword({
    email: $('#loginEmail').value.trim(),
    password: $('#loginPassword').value,
  });

  btn.disabled = false;
  btn.textContent = 'Ingresar al panel';

  if (error) {
    $('#loginError').textContent = error.message.includes('Invalid') ? 'Correo o contraseña incorrectos' : error.message;
    $('#loginError').style.display = 'block';
    return;
  }

  await checkSession();
}

async function doLogout() {
  await sb.auth.signOut();
  currentUser = null;
  currentProfile = null;
  window.location.reload();
}

