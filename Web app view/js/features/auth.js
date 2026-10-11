// ============================================================
// AUTENTICACIÓN
// ============================================================
async function checkSession() {
  const { data: { session } } = await sb.auth.getSession();
  currentUser = session?.user || null;
  currentProfile = null;

  if (currentUser) {
    const { data, error } = await sb.from('users_profile')
      .select('*')
      .eq('user_id', currentUser.id)
      .maybeSingle();

    if (error || !data) {
      // Sesión huérfana: usuario existe en auth pero no tiene perfil
      // Esto puede pasar si el trigger de creación falló
      console.warn('Sesión sin perfil válido. Cerrando sesión...');
      await sb.auth.signOut();
      currentUser = null;
      currentProfile = null;
    } else {
      currentProfile = data;
    }
  }

  updateAuthUI();
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
  btn.textContent = 'Ingresar';
  if (error) {
    $('#loginError').textContent = error.message.includes('Invalid') ? 'Correo o contraseña incorrectos' : error.message;
    $('#loginError').style.display = 'block';
    return;
  }
  await checkSession();
  toast('Sesión iniciada');
  go('account');
}

async function doRegister(e) {
  e.preventDefault();
  const btn = $('#registerBtn');
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner"></span> Creando cuenta...';
  $('#regError').style.display = 'none';

  const email = $('#regEmail').value.trim();
  const password = $('#regPassword').value;
  const name = $('#regName').value.trim();

  const { data, error } = await sb.auth.signUp({
    email, password,
    options: { data: { name } }
  });

  if (error) {
    btn.disabled = false;
    btn.textContent = 'Crear cuenta';
    $('#regError').textContent = error.message;
    $('#regError').style.display = 'block';
    return;
  }

  // Esperar un poquito a que el trigger cree el profile
  await new Promise(r => setTimeout(r, 800));

  // Iniciar sesión automáticamente
  await sb.auth.signInWithPassword({ email, password });
  await checkSession();

  // Actualizar datos del perfil con el resto de la info
  if (currentProfile) {
    await sb.from('users_profile').update({
      name,
      id_card: $('#regIdCard').value.trim(),
      phone: $('#regPhone').value.trim(),
      company: $('#regCompany').value.trim(),
      address: $('#regAddress').value.trim(),
      billing_email: $('#regBillingEmail').value.trim() || email,
    }).eq('id', currentProfile.id);
    await checkSession();
  }

  btn.disabled = false;
  btn.textContent = 'Crear cuenta';
  toast('¡Cuenta creada!');
  go('account');
}

async function doLogout() {
  await sb.auth.signOut();
  currentUser = null;
  currentProfile = null;
  updateAuthUI();
  toast('Sesión cerrada');
  go('home');
}

