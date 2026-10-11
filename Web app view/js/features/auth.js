// ============================================================
// AUTENTICACIÓN
// ============================================================
async function fetchProfile(userId) {
  const { data, error } = await sb.from('users_profile').select('*').eq('user_id', userId).maybeSingle();
  return error ? null : data;
}

async function checkSession() {
  const { data: { session } } = await sb.auth.getSession();
  currentUser = session?.user || null;
  currentProfile = null;

  if (currentUser) {
    currentProfile = await fetchProfile(currentUser.id);
    if (!currentProfile) {
      // Sesión sin perfil válido (cuenta eliminada o error al crearla)
      console.warn('Sesión sin perfil válido. Cerrando sesión...');
      await sb.auth.signOut();
      currentUser = null;
    }
  }
  updateAuthUI();
}

// Página a la que volver después de iniciar sesión (?volver=pago)
let loginReturnTo = null;

function prepareLogin(params) {
  loginReturnTo = params?.get('volver') === 'pago' ? 'checkout' : null;
  const notice = params?.get('aviso');
  const box = $('#loginNotice');
  const messages = {
    confirmada: 'Su correo fue confirmado. Ya puede iniciar sesión.',
    contrasena: 'Su contraseña se actualizó. Inicie sesión con la nueva contraseña.',
  };
  box.textContent = messages[notice] || '';
  box.hidden = !messages[notice];
  setError('#loginError', '');
  if (currentUser) go(loginReturnTo || 'account');
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
  setBusy(btn, false, 'Ingresar');
  if (error) { setError('#loginError', friendlyError(error)); return; }
  await checkSession();
  $('#loginPassword').value = '';
  toast('Sesión iniciada');
  go(loginReturnTo || 'account');
}

function prepareRegister() {
  show('#registerCard', true);
  show('#registerDone', false);
  setError('#regError', '');
  if (currentUser) go('account');
}

// #12: todos los datos viajan en los metadatos de Auth y el trigger
// handle_new_user los guarda en el perfil (con o sin confirmación de correo).
async function doRegister(e) {
  e.preventDefault();
  const email = $('#regEmail').value.trim();
  const password = $('#regPassword').value;
  const name = $('#regName').value.trim();

  if (password.length < MIN_PASSWORD) { setError('#regError', `La contraseña debe tener al menos ${MIN_PASSWORD} caracteres.`); return; }
  if (!$('#regTerms').checked) { setError('#regError', 'Debe aceptar los términos y la política de privacidad.'); return; }
  for (const id of ['#regName', '#regIdCard', '#regPhone', '#regAddress', '#regEmail']) {
    if (!$(id).value.trim()) { setError('#regError', 'Complete todos los campos obligatorios.'); $(id).focus(); return; }
  }

  const btn = $('#registerBtn');
  setBusy(btn, true, 'Creando cuenta...');
  setError('#regError', '');

  const { data, error } = await sb.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: location.origin + location.pathname + '#/ingresar?aviso=confirmada',
      data: {
        name,
        id_card: $('#regIdCard').value.trim(),
        phone: $('#regPhone').value.trim(),
        company: $('#regCompany').value.trim(),
        address: $('#regAddress').value.trim(),
        billing_email: $('#regBillingEmail').value.trim() || email,
        terms_accepted: true,
      },
    },
  });
  setBusy(btn, false, 'Crear cuenta');

  if (error) { setError('#regError', friendlyError(error)); return; }

  // Supabase no revela si el correo ya existe: devuelve un usuario sin identities
  if (data.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) {
    setError('#regError', 'Ya existe una cuenta con ese correo. Inicie sesión o recupere su contraseña.');
    return;
  }

  $('#regPassword').value = '';
  if (data.session) {
    await checkSession();
    toast('¡Cuenta creada!');
    go('account');
  } else {
    // Confirmación de correo activada
    $('#registerDoneEmail').textContent = email;
    show('#registerCard', false);
    show('#registerDone', true);
    $('#registerDone h1').focus();
  }
}

async function doLogout() {
  await sb.auth.signOut();
  currentUser = null;
  currentProfile = null;
  currentOrder = null;
  updateAuthUI();
  toast('Sesión cerrada');
  go('home');
}

// #15: recuperar contraseña
async function doRecover(e) {
  e.preventDefault();
  const btn = $('#recoverBtn');
  const msg = $('#recoverMsg');
  setBusy(btn, true, 'Enviando...');
  const { error } = await sb.auth.resetPasswordForEmail($('#recoverEmail').value.trim(), {
    redirectTo: location.origin + location.pathname + '#/nueva-contrasena',
  });
  setBusy(btn, false, 'Enviar enlace');
  msg.hidden = false;
  if (error) {
    msg.className = 'field-error mb-10';
    msg.textContent = friendlyError(error);
    return;
  }
  // Mismo mensaje exista o no la cuenta (no revelar qué correos están registrados)
  msg.className = 'banner banner-success mb-10';
  msg.textContent = 'Si el correo está registrado, recibirá un enlace para crear una contraseña nueva. Revise también la carpeta de spam.';
}

async function doSetNewPassword(e) {
  e.preventDefault();
  const p1 = $('#newPassword').value;
  const p2 = $('#newPassword2').value;
  if (p1.length < MIN_PASSWORD) { setError('#newPassError', `La contraseña debe tener al menos ${MIN_PASSWORD} caracteres.`); return; }
  if (p1 !== p2) { setError('#newPassError', 'Las contraseñas no coinciden.'); return; }
  const btn = $('#newPassBtn');
  setBusy(btn, true, 'Guardando...');
  const { error } = await sb.auth.updateUser({ password: p1 });
  setBusy(btn, false, 'Guardar contraseña');
  if (error) { setError('#newPassError', friendlyError(error)); return; }
  $('#newPassword').value = '';
  $('#newPassword2').value = '';
  setError('#newPassError', '');
  toast('Contraseña actualizada');
  go('account');
}
