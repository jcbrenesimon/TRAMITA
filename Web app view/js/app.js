// ============================================================
// INICIO
// ============================================================
(async function init() {
  await checkSession();
  await loadSettings();
  await loadCategoriesAndServices();
  await loadPaymentAccounts();
  updateCartBadge();

  // Escuchar cambios de sesión
  sb.auth.onAuthStateChange(async (event, session) => {
    currentUser = session?.user || null;
    if (currentUser) {
      const { data, error } = await sb.from('users_profile')
        .select('*')
        .eq('user_id', currentUser.id)
        .maybeSingle();
      if (error || !data) {
        console.warn('Cambio de auth sin perfil válido');
        currentProfile = null;
      } else {
        currentProfile = data;
      }
    } else {
      currentProfile = null;
    }
    updateAuthUI();
  });
})();
